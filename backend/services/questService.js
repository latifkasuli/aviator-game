// 🎮 Quest Service - Handle all quest logic and progress tracking
// Comprehensive system for daily quests with automatic progress tracking

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class QuestService {
  
  /**
   * Get today's date string for quest reset tracking
   */
  static getTodayString() {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  }
  
  /**
   * Get current hour (0-23) for time-based quests
   */
  static getCurrentHour() {
    return new Date().getHours();
  }
  
  /**
   * Initialize daily quests for a user (called on first login of the day)
   */
  static async initializeDailyQuests(userId) {
    const today = this.getTodayString();
    
    try {
      // Get all active quests
      const activeQuests = await prisma.quest.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' }
      });
      
      // Create user quest entries for today if they don't exist
      for (const quest of activeQuests) {
        await prisma.userQuest.upsert({
          where: {
            userId_questId_resetDate: {
              userId,
              questId: quest.id,
              resetDate: today
            }
          },
          update: {}, // Don't update if exists
          create: {
            userId,
            questId: quest.id,
            resetDate: today,
            status: 'AVAILABLE',
            currentValue: 0,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
          }
        });
      }
      
      console.log(`✅ Initialized daily quests for user ${userId}`);
      return true;
      
    } catch (error) {
      console.error('❌ Error initializing daily quests:', error);
      return false;
    }
  }
  
  /**
   * Get user's current quest status for today
   */
  static async getUserQuests(userId) {
    const today = this.getTodayString();
    
    try {
      // Ensure quests are initialized for today
      await this.initializeDailyQuests(userId);
      
      // Get user's quest progress
      const userQuests = await prisma.userQuest.findMany({
        where: {
          userId,
          resetDate: today
        },
        include: {
          quest: true
        },
        orderBy: {
          quest: { sortOrder: 'asc' }
        }
      });
      
      return userQuests.map(uq => ({
        id: uq.id,
        type: uq.quest.type,
        name: uq.quest.name,
        description: uq.quest.description,
        icon: uq.quest.icon,
        rewardPoints: uq.quest.rewardPoints,
        targetValue: uq.quest.targetValue,
        currentValue: uq.currentValue,
        status: uq.status,
        progress: uq.quest.targetValue > 0 ? (uq.currentValue / uq.quest.targetValue) : 0,
        completedAt: uq.completedAt,
        claimedAt: uq.claimedAt,
        expiresAt: uq.expiresAt
      }));
      
    } catch (error) {
      console.error('❌ Error getting user quests:', error);
      return [];
    }
  }
  
  /**
   * Update quest progress for a specific quest type
   */
  static async updateQuestProgress(userId, questType, incrementValue = 1, metadata = null) {
    const today = this.getTodayString();
    
    try {
      // Find the quest definition
      const quest = await prisma.quest.findUnique({
        where: { type: questType }
      });
      
      if (!quest || !quest.isActive) {
        return false;
      }
      
      // Find user's quest progress for today
      const userQuest = await prisma.userQuest.findUnique({
        where: {
          userId_questId_resetDate: {
            userId,
            questId: quest.id,
            resetDate: today
          }
        }
      });
      
      if (!userQuest || userQuest.status === 'CLAIMED') {
        return false; // Quest not found or already claimed
      }
      
      // Calculate new progress value
      let newValue = userQuest.currentValue + incrementValue;
      let newStatus = userQuest.status;
      let completedAt = userQuest.completedAt;
      
      // Check if quest is completed
      if (newValue >= quest.targetValue && userQuest.status !== 'COMPLETED') {
        newStatus = 'COMPLETED';
        completedAt = new Date();
        console.log(`🎯 Quest completed: ${quest.name} for user ${userId}`);
      }
      
      // Update the user quest
      await prisma.userQuest.update({
        where: { id: userQuest.id },
        data: {
          currentValue: newValue,
          status: newStatus,
          completedAt,
          metadata: metadata ? JSON.stringify(metadata) : userQuest.metadata
        }
      });
      
      return true;
      
    } catch (error) {
      console.error(`❌ Error updating quest progress for ${questType}:`, error);
      return false;
    }
  }
  
  /**
   * Claim a completed quest reward
   */
  static async claimQuest(userId, questType) {
    const today = this.getTodayString();
    
    try {
      // Find the quest and user progress
      const quest = await prisma.quest.findUnique({
        where: { type: questType }
      });
      
      if (!quest) {
        throw new Error('Quest not found');
      }
      
      const userQuest = await prisma.userQuest.findUnique({
        where: {
          userId_questId_resetDate: {
            userId,
            questId: quest.id,
            resetDate: today
          }
        }
      });
      
      if (!userQuest) {
        throw new Error('User quest not found');
      }
      
      if (userQuest.status !== 'COMPLETED') {
        throw new Error('Quest not completed yet');
      }
      
      if (userQuest.claimedAt) {
        throw new Error('Quest reward already claimed');
      }
      
      // Start transaction to claim reward
      const result = await prisma.$transaction(async (tx) => {
        // Mark quest as claimed
        await tx.userQuest.update({
          where: { id: userQuest.id },
          data: {
            status: 'CLAIMED',
            claimedAt: new Date()
          }
        });
        
        // Add reward to user balance
        const user = await tx.user.update({
          where: { id: userId },
          data: {
            balance: {
              increment: quest.rewardPoints
            }
          }
        });
        
        // Create transaction record
        await tx.transaction.create({
          data: {
            userId,
            type: 'QUEST_REWARD',
            amount: quest.rewardPoints,
            balanceBefore: user.balance - quest.rewardPoints,
            balanceAfter: user.balance,
            description: `Quest reward: ${quest.name}`,
            metadata: {
              questType: quest.type,
              questName: quest.name
            }
          }
        });
        
        // Create completion history record
        await tx.questCompletion.create({
          data: {
            userId,
            questType: quest.type,
            rewardPoints: quest.rewardPoints,
            completedAt: userQuest.completedAt,
            claimedAt: new Date()
          }
        });
        
        return {
          success: true,
          rewardPoints: quest.rewardPoints,
          newBalance: user.balance,
          questName: quest.name
        };
      });
      
      console.log(`🎉 Quest claimed: ${quest.name} (+${quest.rewardPoints} pts) for user ${userId}`);
      return result;
      
    } catch (error) {
      console.error('❌ Error claiming quest:', error);
      throw error;
    }
  }
  
  /**
   * Track user login (for daily login quest)
   */
  static async trackLogin(userId) {
    // For daily login, we set the value to 1 (not increment)
    // This ensures it shows 1/1 instead of incrementing with each login
    const today = this.getTodayString();
    
    try {
      const quest = await prisma.quest.findUnique({
        where: { type: 'DAILY_LOGIN' }
      });
      
      if (!quest || !quest.isActive) return;
      
      const userQuest = await prisma.userQuest.findUnique({
        where: {
          userId_questId_resetDate: {
            userId,
            questId: quest.id,
            resetDate: today
          }
        }
      });
      
      if (!userQuest || userQuest.status === 'CLAIMED') return;
      
      // Set to 1 (logged in today) instead of incrementing
      await prisma.userQuest.update({
        where: { id: userQuest.id },
        data: {
          currentValue: 1,
          status: 'COMPLETED',
          completedAt: new Date()
        }
      });
      
      console.log(`🎯 Daily login quest completed for user ${userId}`);
    } catch (error) {
      console.error('❌ Error tracking daily login:', error);
    }
  }
  
  /**
   * Track bet placement (for place bets quest)
   */
  static async trackBetPlaced(userId, betAmount) {
    // Track general bet placement
    await this.updateQuestProgress(userId, 'PLACE_BETS', 1);
    
    // Track high roller quest (if bet >= 1000)
    if (betAmount >= 1000) {
      await this.updateQuestProgress(userId, 'HIGH_ROLLER', 1);
    }
    
    // Track time-based quests
    const currentHour = this.getCurrentHour();
    if (currentHour === 0) { // First hour of the day (00:00-00:59)
      await this.updateQuestProgress(userId, 'EARLY_BIRD', 1);
    } else if (currentHour >= 22) { // After 10 PM (22:00-23:59)
      await this.updateQuestProgress(userId, 'NIGHT_OWL', 1);
    }
  }
  
  /**
   * Track successful cashout (for lucky streak and risk taker quests)
   */
  static async trackCashout(userId, multiplier) {
    // Track risk taker quest (5x+ multiplier)
    if (multiplier >= 5.0) {
      await this.updateQuestProgress(userId, 'RISK_TAKER', 1);
    }
    
    // Track lucky streak quest (consecutive cashouts)
    await this.updateLuckyStreak(userId, true);
  }
  
  /**
   * Track bet loss (affects lucky streak)
   */
  static async trackBetLoss(userId) {
    await this.updateLuckyStreak(userId, false);
  }
  
  /**
   * Track successful referral
   */
  static async trackReferral(referrerUserId) {
    await this.updateQuestProgress(referrerUserId, 'SUCCESSFUL_REFERRAL', 1);
  }
  
  /**
   * Update lucky streak progress
   */
  static async updateLuckyStreak(userId, isWin) {
    const today = this.getTodayString();
    
    try {
      const quest = await prisma.quest.findUnique({
        where: { type: 'LUCKY_STREAK' }
      });
      
      if (!quest) return;
      
      const userQuest = await prisma.userQuest.findUnique({
        where: {
          userId_questId_resetDate: {
            userId,
            questId: quest.id,
            resetDate: today
          }
        }
      });
      
      if (!userQuest || userQuest.status === 'CLAIMED') return;
      
      let currentStreak = 0;
      if (userQuest.metadata) {
        const metadata = JSON.parse(userQuest.metadata);
        currentStreak = metadata.currentStreak || 0;
      }
      
      if (isWin) {
        currentStreak += 1;
        
        // Update progress (current streak towards target of 3)
        await prisma.userQuest.update({
          where: { id: userQuest.id },
          data: {
            currentValue: Math.min(currentStreak, quest.targetValue),
            status: currentStreak >= quest.targetValue ? 'COMPLETED' : 'IN_PROGRESS',
            completedAt: currentStreak >= quest.targetValue ? new Date() : null,
            metadata: JSON.stringify({ currentStreak })
          }
        });
        
        if (currentStreak >= quest.targetValue) {
          console.log(`🍀 Lucky streak completed for user ${userId}!`);
        }
        
      } else {
        // Loss resets the streak
        await prisma.userQuest.update({
          where: { id: userQuest.id },
          data: {
            currentValue: 0,
            status: 'AVAILABLE',
            completedAt: null,
            metadata: JSON.stringify({ currentStreak: 0 })
          }
        });
      }
      
    } catch (error) {
      console.error('❌ Error updating lucky streak:', error);
    }
  }
  
  /**
   * Get quest statistics for admin/analytics
   */
  static async getQuestStats() {
    try {
      const stats = await prisma.questCompletion.groupBy({
        by: ['questType'],
        _count: {
          id: true
        },
        _sum: {
          rewardPoints: true
        }
      });
      
      return stats.map(stat => ({
        questType: stat.questType,
        completions: stat._count.id,
        totalRewards: stat._sum.rewardPoints || 0
      }));
      
    } catch (error) {
      console.error('❌ Error getting quest stats:', error);
      return [];
    }
  }
}

module.exports = QuestService;
