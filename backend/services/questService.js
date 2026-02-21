
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class QuestService {
  
  static getTodayString() {
    return new Date().toISOString().split('T')[0];
  }
  
  static getCurrentHour() {
    return new Date().getHours();
  }
  
  static async initializeDailyQuests(userId) {
    const today = this.getTodayString();
    
    try {
      const activeQuests = await prisma.quest.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' }
      });
      
      for (const quest of activeQuests) {
        await prisma.userQuest.upsert({
          where: {
            userId_questId_resetDate: {
              userId,
              questId: quest.id,
              resetDate: today
            }
          },
          update: {},
          create: {
            userId,
            questId: quest.id,
            resetDate: today,
            status: 'AVAILABLE',
            currentValue: 0,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
          }
        });
      }
      
      console.log(`Initialized daily quests for user ${userId}`);
      return true;
      
    } catch (error) {
      console.error('Error initializing daily quests:', error);
      return false;
    }
  }
  
  static async getUserQuests(userId) {
    const today = this.getTodayString();
    
    try {
      await this.initializeDailyQuests(userId);
      
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
      console.error('Error getting user quests:', error);
      return [];
    }
  }
  
  static async updateQuestProgress(userId, questType, incrementValue = 1, metadata = null) {
    const today = this.getTodayString();
    
    try {
      const quest = await prisma.quest.findUnique({
        where: { type: questType }
      });
      
      if (!quest || !quest.isActive) {
        return false;
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
      
      if (!userQuest || userQuest.status === 'CLAIMED') {
        return false;
      }
      
      let newValue = userQuest.currentValue + incrementValue;
      let newStatus = userQuest.status;
      let completedAt = userQuest.completedAt;
      
      if (newValue >= quest.targetValue && userQuest.status !== 'COMPLETED') {
        newStatus = 'COMPLETED';
        completedAt = new Date();
        console.log(`Quest completed: ${quest.name} for user ${userId}`);
      }
      
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
      console.error(`Error updating quest progress for ${questType}:`, error);
      return false;
    }
  }
  
  static async claimQuest(userId, questType) {
    const today = this.getTodayString();
    
    try {
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
      
      const result = await prisma.$transaction(async (tx) => {
        await tx.userQuest.update({
          where: { id: userQuest.id },
          data: {
            status: 'CLAIMED',
            claimedAt: new Date()
          }
        });
        
        const user = await tx.user.update({
          where: { id: userId },
          data: {
            balance: {
              increment: quest.rewardPoints
            }
          }
        });
        
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
      
      console.log(`Quest claimed: ${quest.name} (+${quest.rewardPoints} pts) for user ${userId}`);
      return result;
      
    } catch (error) {
      console.error('Error claiming quest:', error);
      throw error;
    }
  }
  
  static async trackLogin(userId) {
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
      
      await prisma.userQuest.update({
        where: { id: userQuest.id },
        data: {
          currentValue: 1,
          status: 'COMPLETED',
          completedAt: new Date()
        }
      });
      
      console.log(`Daily login quest completed for user ${userId}`);
    } catch (error) {
      console.error('Error tracking daily login:', error);
    }
  }
  
  static async trackBetPlaced(userId, betAmount) {
    await this.updateQuestProgress(userId, 'PLACE_BETS', 1);
    
    if (betAmount >= 1000) {
      await this.updateQuestProgress(userId, 'HIGH_ROLLER', 1);
    }
    
    const currentHour = this.getCurrentHour();
    if (currentHour === 0) {
      await this.updateQuestProgress(userId, 'EARLY_BIRD', 1);
    } else if (currentHour >= 22) {
      await this.updateQuestProgress(userId, 'NIGHT_OWL', 1);
    }
  }
  
  static async trackCashout(userId, multiplier) {
    if (multiplier >= 5.0) {
      await this.updateQuestProgress(userId, 'RISK_TAKER', 1);
    }
    
    await this.updateLuckyStreak(userId, true);
  }
  
  static async trackBetLoss(userId) {
    await this.updateLuckyStreak(userId, false);
  }
  
  static async trackReferral(referrerUserId) {
    await this.updateQuestProgress(referrerUserId, 'SUCCESSFUL_REFERRAL', 1);
  }
  
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
          console.log(`Lucky streak completed for user ${userId}!`);
        }
        
      } else {
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
      console.error('Error updating lucky streak:', error);
    }
  }
  
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
      console.error('Error getting quest stats:', error);
      return [];
    }
  }
}

module.exports = QuestService;
