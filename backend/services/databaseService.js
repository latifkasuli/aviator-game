const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = require('../lib/prisma');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

class DatabaseService {
  getTodayDate() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  
  async createUser(userData) {
    const { telegramId, username, email, firstName, lastName, avatar, password, role } = userData;
    
    try {
      let passwordHash = null;
      if (password) {
        passwordHash = await bcrypt.hash(password, 12);
      }
      
      let referralCode;
      let codeExists = true;
      while (codeExists) {
        referralCode = this.generateReferralCode();
        const existing = await prisma.user.findUnique({
          where: { referralCode }
        });
        codeExists = !!existing;
      }

      const user = await prisma.user.create({
        data: {
          telegramId: telegramId?.toString(),
          username,
          email,
          firstName,
          lastName,
          avatar,
          passwordHash,
          referralCode,
          role: role || 'PLAYER',
          balance: process.env.DEFAULT_BALANCE || 1000,
          isVerified: !!telegramId,
        },
      });

      try {
        await prisma.playerSettings.create({
          data: {
            userId: user.id,
            autoCashoutEnabled: false,
            autoCashoutMultiplier: new Prisma.Decimal(2.0),
            soundEnabled: true,
          }
        });
      } catch (_) {}
      
      console.log(`Created user: ${username} (${user.id})`);
      return { success: true, user: this.sanitizeUser(user) };
    } catch (error) {
      console.error('Error creating user:', error);
      return { success: false, error: 'Failed to create user' };
    }
  }

  async getPlayerSettings(userId) {
    try {
      const settings = await prisma.playerSettings.findUnique({ where: { userId } });
      if (!settings) return null;
      
      return {
        ...settings,
        autoCashoutMultiplier: settings.autoCashoutMultiplier ? Number(settings.autoCashoutMultiplier) : 2.0,
        maxDailyWager: settings.maxDailyWager ? Number(settings.maxDailyWager) : 10000,
        maxDailyLoss: settings.maxDailyLoss ? Number(settings.maxDailyLoss) : 5000
      };
    } catch (error) {
      console.error('Error getting player settings:', error);
      return null;
    }
  }

  async upsertPlayerSettings(userId, partialSettings) {
    try {
      console.log(`upsertPlayerSettings called for user ${userId} with:`, partialSettings);
      
      const updated = await prisma.playerSettings.upsert({
        where: { userId },
        update: {
          ...('autoCashoutEnabled' in partialSettings ? { autoCashoutEnabled: partialSettings.autoCashoutEnabled } : {}),
          ...('autoCashoutMultiplier' in partialSettings ? { autoCashoutMultiplier: new Prisma.Decimal(partialSettings.autoCashoutMultiplier) } : {}),
          ...('soundEnabled' in partialSettings ? { soundEnabled: partialSettings.soundEnabled } : {}),
          ...('dailyLimitsEnabled' in partialSettings ? { dailyLimitsEnabled: partialSettings.dailyLimitsEnabled } : {}),
          ...('maxDailyWager' in partialSettings ? { maxDailyWager: new Prisma.Decimal(partialSettings.maxDailyWager) } : {}),
          ...('maxDailyLoss' in partialSettings ? { maxDailyLoss: new Prisma.Decimal(partialSettings.maxDailyLoss) } : {}),
          ...('maxGamesPerDay' in partialSettings ? { maxGamesPerDay: partialSettings.maxGamesPerDay } : {}),
        },
        create: {
          userId,
          autoCashoutEnabled: !!partialSettings.autoCashoutEnabled,
          autoCashoutMultiplier: new Prisma.Decimal(partialSettings.autoCashoutMultiplier ?? 2.0),
          soundEnabled: 'soundEnabled' in partialSettings ? !!partialSettings.soundEnabled : true,
          dailyLimitsEnabled: 'dailyLimitsEnabled' in partialSettings ? !!partialSettings.dailyLimitsEnabled : true,
          maxDailyWager: new Prisma.Decimal(partialSettings.maxDailyWager ?? 10000),
          maxDailyLoss: new Prisma.Decimal(partialSettings.maxDailyLoss ?? 5000),
          maxGamesPerDay: partialSettings.maxGamesPerDay ?? 100,
        }
      });
      console.log(`Player settings upserted successfully:`, updated);
      
      return {
        ...updated,
        autoCashoutMultiplier: updated.autoCashoutMultiplier ? Number(updated.autoCashoutMultiplier) : 2.0,
        maxDailyWager: updated.maxDailyWager ? Number(updated.maxDailyWager) : 10000,
        maxDailyLoss: updated.maxDailyLoss ? Number(updated.maxDailyLoss) : 5000
      };
    } catch (error) {
      console.error('Error upserting player settings:', error);
      console.error('Full error details:', error);
      return null;
    }
  }
  
  async findUserById(userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          dailyLimits: {
            where: {
              date: this.getTodayDate()
            }
          }
        }
      });
      
      return user ? this.sanitizeUser(user) : null;
    } catch (error) {
      console.error('Error finding user by ID:', error);
      return null;
    }
  }
  
  async findUserByTelegramId(telegramId) {
    try {
      const user = await prisma.user.findUnique({
        where: { telegramId: telegramId.toString() },
        include: {
          dailyLimits: {
            where: {
              date: this.getTodayDate()
            }
          }
        }
      });
      
      return user ? this.sanitizeUser(user) : null;
    } catch (error) {
      console.error('Error finding user by Telegram ID:', error);
      return null;
    }
  }
  
  async findUserByUsername(username) {
    try {
      const user = await prisma.user.findUnique({
        where: { username },
      });
      
      return user ? this.sanitizeUser(user) : null;
    } catch (error) {
      console.error('Error finding user by username:', error);
      return null;
    }
  }
  
  async authenticateUser(username, password) {
    try {
      const user = await prisma.user.findUnique({
        where: { username },
      });
      
      if (!user || !user.passwordHash) {
        return null;
      }
      
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return null;
      }
      
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      });
      
      return this.sanitizeUser(user);
    } catch (error) {
      console.error('Error authenticating user:', error);
      return null;
    }
  }
  
  
  async updateBalance(userId, amount, description = null) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: userId }
        });
        
        if (!user) {
          throw new Error('User not found');
        }
        
        const balanceBefore = parseFloat(user.balance);
        const balanceAfter = balanceBefore + amount;
        
        if (balanceAfter < 0) {
          throw new Error('Insufficient balance');
        }
        
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: { balance: balanceAfter }
        });
        
        await tx.transaction.create({
          data: {
            userId,
            type: amount > 0 ? 'DEPOSIT' : 'WITHDRAWAL',
            amount: Math.abs(amount),
            balanceBefore,
            balanceAfter,
            description
          }
        });
        
        return updatedUser;
      });
      
      console.log(`Updated balance for ${userId}: ${amount} (new: ${result.balance})`);
      return this.sanitizeUser(result);
    } catch (error) {
      console.error('Error updating balance:', error);
      throw error;
    }
  }
  
  
  async createGameRound(fairRoundData) {
    try {
      const gameRound = await prisma.gameRound.create({
        data: {
          serverSeed: fairRoundData.serverSeed,
          serverSeedHash: fairRoundData.serverSeedHash,
          clientSeed: fairRoundData.clientSeed || null,
          nonce: fairRoundData.nonce || 0,
          crashPoint: fairRoundData.crashPoint,
          startTime: new Date(),
          status: 'BETTING'
        }
      });
      
      console.log(`Created game round ${gameRound.roundNumber} (crash: ${fairRoundData.crashPoint}x)`);
      return gameRound;
    } catch (error) {
      console.error('Error creating game round:', error);
      throw error;
    }
  }
  
  async updateGameRoundStatus(roundId, status, endTime = null) {
    try {
      const updateData = { status };
      if (endTime) {
        updateData.endTime = endTime;
      }
      
      const gameRound = await prisma.gameRound.update({
        where: { id: roundId },
        data: updateData
      });
      
      return gameRound;
    } catch (error) {
      console.error('Error updating game round status:', error);
      throw error;
    }
  }
  
  async getCurrentGameRound() {
    try {
      const gameRound = await prisma.gameRound.findFirst({
        where: {
          status: { in: ['BETTING', 'RUNNING'] }
        },
        orderBy: { createdAt: 'desc' }
      });
      
      return gameRound;
    } catch (error) {
      console.error('Error getting current game round:', error);
      return null;
    }
  }
  
  
  async placeBet(userId, gameRoundId, amount, cashoutAt = null) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: userId }
        });
        
        if (!user) {
          throw new Error('User not found');
        }
        
        if (parseFloat(user.balance) < amount) {
          throw new Error('Insufficient balance');
        }
        
        await this.checkDailyLimits(userId, amount, tx);
        
        const balanceBefore = parseFloat(user.balance);
        const balanceAfter = balanceBefore - amount;
        
        await tx.user.update({
          where: { id: userId },
          data: { 
            balance: balanceAfter,
            totalWagered: { increment: amount }
          }
        });
        
        const bet = await tx.bet.create({
          data: {
            userId,
            gameRoundId,
            amount,
            cashoutAt,
            status: 'ACTIVE'
          }
        });
        
        await tx.transaction.create({
          data: {
            userId,
            betId: bet.id,
            type: 'BET_PLACED',
            amount,
            balanceBefore,
            balanceAfter,
            description: `Bet placed for round ${gameRoundId}`
          }
        });
        
        await this.updateDailyLimits(userId, amount, 0, 1, tx);
        
        const betCount = await tx.bet.count({
          where: { userId }
        });
        
        const isFirstBet = betCount === 1;
        
        return { bet, isFirstBet };
      });
      
      if (result.isFirstBet) {
        try {
          const activationResult = await this.markReferralActivated(userId);
          if (activationResult.success && activationResult.paid) {
            console.log(`Referral activated for user ${userId} - referrer received bonus`);
          }
        } catch (error) {
          console.error('Referral activation error (non-fatal):', error);
        }
      }
      
      console.log(`Bet placed: ${userId} - ${amount} (${result.bet.id})`);
      return result.bet;
    } catch (error) {
      console.error('Error placing bet:', error);
      throw error;
    }
  }
  
  async cashoutBet(betId, multiplier) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const bet = await tx.bet.findUnique({
          where: { id: betId },
          include: { user: true }
        });
        
        if (!bet || bet.status !== 'ACTIVE') {
          throw new Error('Invalid bet');
        }
        
        const payout = parseFloat(bet.amount) * multiplier;
        const balanceBefore = parseFloat(bet.user.balance);
        const balanceAfter = balanceBefore + payout;
        
        const updatedBet = await tx.bet.update({
          where: { id: betId },
          data: {
            actualCashout: multiplier,
            payout,
            cashedOutAt: new Date(),
            status: 'CASHED_OUT'
          }
        });
        
        const expGained = Math.min(50, Math.floor(10 + (multiplier * 5)));
        
        await tx.user.update({
          where: { id: bet.userId },
          data: { 
            balance: balanceAfter,
            totalWon: { increment: payout },
            biggestWin: { set: Math.max(parseFloat(bet.user.biggestWin), payout) },
            gamesPlayed: { increment: 1 },
            experience: { increment: expGained }
          }
        });
        
        await tx.transaction.create({
          data: {
            userId: bet.userId,
            betId: bet.id,
            type: 'BET_WON',
            amount: payout,
            balanceBefore,
            balanceAfter,
            description: `Cashout at ${multiplier}x`
          }
        });
        
        return updatedBet;
      });
      
      await this.updateUserLevel(result.userId);
      
      console.log(`Bet cashed out: ${betId} at ${multiplier}x (payout: ${result.payout})`);
      return result;
    } catch (error) {
      console.error('Error cashing out bet:', error);
      throw error;
    }
  }
  
  async crashBets(gameRoundId, crashPoint) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const activeBets = await tx.bet.findMany({
          where: {
            gameRoundId,
            status: 'ACTIVE'
          },
          include: { user: true }
        });
        
        let lostBets = 0;
        
        for (const bet of activeBets) {
          await tx.bet.update({
            where: { id: bet.id },
            data: {
              status: 'LOST',
              actualCashout: crashPoint
            }
          });
          
          const betAmount = parseFloat(bet.amount);
          const currentUser = await tx.user.findUnique({
            where: { id: bet.userId },
            select: { biggestLoss: true }
          });
          
          await tx.user.update({
            where: { id: bet.userId },
            data: {
              totalLost: { increment: betAmount },
              gamesPlayed: { increment: 1 },
              biggestLoss: betAmount > parseFloat(currentUser.biggestLoss || 0) 
                ? betAmount 
                : currentUser.biggestLoss,
              experience: { increment: 5 }
            }
          });
          
          await tx.transaction.create({
            data: {
              userId: bet.userId,
              betId: bet.id,
              type: 'BET_LOST',
              amount: parseFloat(bet.amount),
              balanceBefore: parseFloat(bet.user.balance),
              balanceAfter: parseFloat(bet.user.balance),
              description: `Lost at ${crashPoint}x`
            }
          });
          
          await this.updateDailyLimits(bet.userId, 0, parseFloat(bet.amount), 0, tx);
          
          lostBets++;
        }
        
        return { lostBets, totalBets: activeBets.length, userIds: activeBets.map(bet => bet.userId) };
      });
      
      for (const userId of result.userIds) {
        await this.updateUserLevel(userId);
      }
      
      console.log(`Crashed ${result.lostBets} bets at ${crashPoint}x`);
      return result;
    } catch (error) {
      console.error('Error crashing bets:', error);
      throw error;
    }
  }
  
  
  async checkDailyLimits(userId, betAmount, tx = prisma) {
    const today = this.getTodayDate();
    
    const limits = await tx.dailyLimit.findUnique({
      where: {
        userId_date: {
          userId,
          date: new Date(today)
        }
      }
    });
    
    if (limits) {
      if (limits.maxWager && (parseFloat(limits.currentWager) + betAmount) > parseFloat(limits.maxWager)) {
        throw new Error('Daily wager limit exceeded');
      }
      
      if (limits.maxGames && (limits.currentGames + 1) > limits.maxGames) {
        throw new Error('Daily games limit exceeded');
      }
    }
  }
  
  async updateDailyLimits(userId, wager, loss, games, tx = prisma) {
    const today = this.getTodayDate();
    
    await tx.dailyLimit.upsert({
      where: {
        userId_date: {
          userId,
          date: new Date(today)
        }
      },
      update: {
        currentWager: { increment: wager },
        currentLoss: { increment: loss },
        currentGames: { increment: games }
      },
      create: {
        userId,
        date: new Date(today),
        currentWager: wager,
        currentLoss: loss,
        currentGames: games
      }
    });
  }
  
  
  async getUserStats(userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          bets: {
            orderBy: { placedAt: 'desc' },
            take: 50,
            include: {
              gameRound: true
            }
          },
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 20
          }
        }
      });
      
      if (!user) return null;
      
      const totalBets = user.bets.length;
      const wonBets = user.bets.filter(bet => bet.status === 'CASHED_OUT').length;
      const winRate = totalBets > 0 ? (wonBets / totalBets * 100).toFixed(2) : 0;
      const netProfit = parseFloat(user.totalWon) - parseFloat(user.totalLost);
      
      return {
        ...this.sanitizeUser(user),
        stats: {
          totalBets,
          wonBets,
          winRate: parseFloat(winRate),
          netProfit,
          recentBets: user.bets,
          recentTransactions: user.transactions
        }
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      return null;
    }
  }
  
  async getRecentRoundsForFairness(limit = 50) {
    try {
      const rounds = await prisma.gameRound.findMany({
        where: {
          status: 'CRASHED'
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit,
        select: {
          id: true,
          roundNumber: true,
          serverSeed: true,
          serverSeedHash: true,
          clientSeed: true,
          nonce: true,
          crashPoint: true,
          startTime: true,
          endTime: true,
          createdAt: true
        }
      });
      
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      return rounds.map(round => ({
        ...round,
        serverSeed: round.endTime && new Date(round.endTime) < fiveMinutesAgo 
          ? round.serverSeed 
          : null,
        crashPoint: round.crashPoint.toString()
      }));
    } catch (error) {
      console.error('Error getting recent rounds for fairness:', error);
      return [];
    }
  }
  
  async getLeaderboard(type = 'balance', limit = 10) {
    try {
      let orderBy = {};
      switch (type) {
        case 'balance':
          orderBy = { balance: 'desc' };
          break;
        case 'totalWon':
          orderBy = { totalWon: 'desc' };
          break;
        case 'winRate':
          orderBy = { gamesPlayed: 'desc' };
          break;
        default:
          orderBy = { balance: 'desc' };
      }
      
      const users = await prisma.user.findMany({
        where: {
          isActive: true,
          role: 'PLAYER'
        },
        orderBy,
        take: type === 'winRate' ? 100 : limit,
        include: {
          bets: {
            select: {
              status: true
            }
          }
        }
      });
      
      let processedUsers = users.map(user => {
        const wonBets = user.bets.filter(bet => bet.status === 'CASHED_OUT').length;
        const totalBets = user.bets.length;
        const winRate = totalBets > 0 ? (wonBets / totalBets * 100) : 0;
        
        return {
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          balance: parseFloat(user.balance),
          totalWon: parseFloat(user.totalWon),
          totalWagered: parseFloat(user.totalWagered),
          gamesPlayed: user.gamesPlayed,
          biggestWin: parseFloat(user.biggestWin),
          netProfit: parseFloat(user.totalWon) - parseFloat(user.totalLost),
          winRate: parseFloat(winRate.toFixed(2))
        };
      });
      
      if (type === 'winRate') {
        processedUsers = processedUsers
          .filter(user => user.gamesPlayed >= 10)
          .sort((a, b) => b.winRate - a.winRate)
          .slice(0, limit);
      }
      
      return processedUsers;
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      return [];
    }
  }
  
  async updateUser(userId, updateData) {
    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: updateData
      });
      
      return { success: true, user: this.sanitizeUser(user) };
    } catch (error) {
      console.error('Error updating user:', error);
      return { success: false, error: 'Failed to update user' };
    }
  }

  async authenticateUser(usernameOrEmail, password) {
    try {
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { username: usernameOrEmail },
            { email: usernameOrEmail }
          ]
        }
      });

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      if (!user.passwordHash) {
        return { success: false, error: 'No password set for this user' };
      }

      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        return { success: false, error: 'Invalid password' };
      }

      if (!user.isActive) {
        return { success: false, error: 'Account is disabled' };
      }

      return { success: true, user: this.sanitizeUser(user) };
    } catch (error) {
      console.error('Error authenticating user:', error);
      return { success: false, error: 'Authentication failed' };
    }
  }

  
  async attributeReferral({ inviteeUserId, referralCode, ip, deviceId }) {
    try {
      const invitee = await prisma.user.findUnique({
        where: { id: inviteeUserId }
      });

      if (!invitee) {
        throw new Error('Invitee user not found');
      }

      if (invitee.referredByUserId) {
        return { success: true, alreadyAttributed: true };
      }

      const referrer = await prisma.user.findFirst({
        where: { 
          referralCode: {
            equals: referralCode,
            mode: 'insensitive'
          }
        }
      });

      if (!referrer) {
        throw new Error('Invalid referral code');
      }

      if (referrer.id === invitee.id) {
        throw new Error('Self-referral not allowed');
      }

      if (invitee.telegramId && referrer.telegramId && invitee.telegramId === referrer.telegramId) {
        throw new Error('Cannot refer yourself');
      }

      const result = await prisma.$transaction(async (tx) => {
        await tx.referral.create({
          data: {
            referrerUserId: referrer.id,
            inviteeUserId: invitee.id,
            referralCode,
            ip,
            deviceId
          }
        });

        await tx.user.update({
          where: { id: invitee.id },
          data: {
            referredBy: referralCode,
            referredByUserId: referrer.id
          }
        });

        let inviteeBonusPaid = false;
        if (!invitee.referralJoinRewardClaimed) {
          const newBalance = parseFloat(invitee.balance) + 1000;
          
          await tx.user.update({
            where: { id: invitee.id },
            data: {
              balance: newBalance,
              referralJoinRewardClaimed: true
            }
          });

          await tx.transaction.create({
            data: {
              userId: invitee.id,
              type: 'BONUS',
              amount: 1000,
              balanceBefore: parseFloat(invitee.balance),
              balanceAfter: newBalance,
              description: `Referral join bonus from ${referrer.username}`,
              metadata: {
                type: 'referral_join_bonus',
                referrerId: referrer.id,
                referralCode
              }
            }
          });

          inviteeBonusPaid = true;
        }

        return { 
          success: true, 
          inviteeBonusPaid, 
          referrerId: referrer.id,
          referrerUsername: referrer.username 
        };
      });

      console.log(`Referral attributed: ${invitee.username} referred by ${referrer.username}`);
      return result;

    } catch (error) {
      console.error('Error attributing referral:', error);
      throw error;
    }
  }

  async markReferralActivated(inviteeUserId) {
    try {
      const referral = await prisma.referral.findUnique({
        where: { inviteeUserId },
        include: {
          referrer: true,
          invitee: true
        }
      });

      if (!referral) {
        return { success: false, reason: 'No referral found' };
      }

      if (referral.referrerRewardStatus !== 'PENDING') {
        return { success: false, reason: 'Referral already processed' };
      }

      const fraudChecks = await this.performReferralFraudChecks(referral);
      if (!fraudChecks.passed) {
        await prisma.referral.update({
          where: { id: referral.id },
          data: {
            referrerRewardStatus: 'REJECTED',
            activationEventAt: new Date(),
            notes: fraudChecks.reason
          }
        });
        return { success: false, reason: 'Failed fraud checks', details: fraudChecks.reason };
      }

      const result = await prisma.$transaction(async (tx) => {
        const referrerBonus = 1000;
        const newBalance = parseFloat(referral.referrer.balance) + referrerBonus;

        await tx.user.update({
          where: { id: referral.referrerUserId },
          data: { balance: newBalance }
        });

        await tx.referral.update({
          where: { id: referral.id },
          data: {
            referrerRewardStatus: 'PAID',
            activationEventAt: new Date()
          }
        });

        await tx.transaction.create({
          data: {
            userId: referral.referrerUserId,
            type: 'BONUS',
            amount: referrerBonus,
            balanceBefore: parseFloat(referral.referrer.balance),
            balanceAfter: newBalance,
            description: `Referral activation bonus for ${referral.invitee.username}`,
            metadata: {
              type: 'referral_activation_bonus',
              inviteeId: inviteeUserId,
              referralId: referral.id
            }
          }
        });

        return { 
          success: true, 
          paid: true, 
          amount: referrerBonus,
          referrerId: referral.referrerUserId 
        };
      });

      console.log(`Referral activation bonus paid: ${referral.referrer.username} earned 1000 pts`);
      return result;

    } catch (error) {
      console.error('Error marking referral activated:', error);
      throw error;
    }
  }

  async performReferralFraudChecks(referral) {
    try {
      const inviteeAge = Date.now() - new Date(referral.invitee.createdAt).getTime();
      const maxAge = 7 * 24 * 60 * 60 * 1000;
      if (inviteeAge > maxAge) {
        return { passed: false, reason: 'Invitee account too old' };
      }

      if (referral.ip) {
        const sameIpReferrals = await prisma.referral.count({
          where: {
            referrerUserId: referral.referrerUserId,
            ip: referral.ip,
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
          }
        });
        if (sameIpReferrals > 2) {
          return { passed: false, reason: 'Too many referrals from same IP' };
        }
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const paidReferralsToday = await prisma.referral.count({
        where: {
          referrerUserId: referral.referrerUserId,
          referrerRewardStatus: 'PAID',
          activationEventAt: {
            gte: today
          }
        }
      });
      if (paidReferralsToday >= 10) {
        return { passed: false, reason: 'Daily referral limit reached' };
      }

      return { passed: true };
    } catch (error) {
      console.error('Error in fraud checks:', error);
      return { passed: false, reason: 'Fraud check error' };
    }
  }

  async getUserBets(userId, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;
      const [bets, total] = await Promise.all([
        prisma.bet.findMany({
          where: { userId },
          skip,
          take: limit,
          orderBy: { placedAt: 'desc' },
          include: {
            gameRound: {
              select: {
                id: true,
                roundNumber: true,
                crashPoint: true,
                createdAt: true
              }
            }
          }
        }),
        prisma.bet.count({ where: { userId } })
      ]);

      return {
        success: true,
        bets,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('Error getting user bets:', error);
      return { success: false, error: 'Failed to get user bets' };
    }
  }

  async getReferralStats(userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          referralsAsReferrer: {
            include: {
              invitee: {
                select: {
                  username: true,
                  createdAt: true
                }
              }
            },
            orderBy: {
              createdAt: 'desc'
            }
          },
          referredByUser: {
            select: {
              username: true
            }
          }
        }
      });

      if (!user) {
        return null;
      }

      const stats = {
        referralCode: user.referralCode,
        referredBy: user.referredByUser?.username || null,
        totalReferrals: user.referralsAsReferrer.length,
        pendingReferrals: user.referralsAsReferrer.filter(r => r.referrerRewardStatus === 'PENDING').length,
        paidReferrals: user.referralsAsReferrer.filter(r => r.referrerRewardStatus === 'PAID').length,
        totalEarned: user.referralsAsReferrer.filter(r => r.referrerRewardStatus === 'PAID').length * 1000,
        recentReferrals: user.referralsAsReferrer.slice(0, 10).map(r => ({
          username: r.invitee.username,
          joinedAt: r.createdAt,
          status: r.referrerRewardStatus,
          activatedAt: r.activationEventAt
        }))
      };

      return stats;
    } catch (error) {
      console.error('Error getting referral stats:', error);
      return null;
    }
  }

  
  async claimFarmingPoints(userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      const now = new Date();
      const lastClaimed = user.lastClaimedAt ? new Date(user.lastClaimedAt) : null;
      const hoursElapsed = lastClaimed 
        ? (now - lastClaimed) / (1000 * 60 * 60) 
        : 6;

      if (hoursElapsed < 6) {
        const timeRemaining = 6 - hoursElapsed;
        return { 
          success: false, 
          error: 'Cannot claim yet',
          timeRemaining: timeRemaining * 60 * 60 * 1000,
          nextClaimTime: new Date(lastClaimed.getTime() + 6 * 60 * 60 * 1000)
        };
      }

      const pointsToAward = 6000;
      const newBalance = parseFloat(user.balance) + pointsToAward;

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          balance: newBalance,
          lastClaimedAt: now,
          experience: { increment: 20 }
        }
      });

      await prisma.transaction.create({
        data: {
          userId,
          type: 'FARMING_CLAIM',
          amount: pointsToAward,
          balanceBefore: parseFloat(user.balance),
          balanceAfter: newBalance,
          description: 'Daily farming points claim',
          metadata: {
            source: 'farming',
            claimedAt: now.toISOString(),
            hoursElapsed: Math.min(hoursElapsed, 6)
          }
        }
      });

      await this.updateUserLevel(userId);
      
      console.log(`User ${userId} claimed ${pointsToAward} farming points`);

      return {
        success: true,
        pointsClaimed: pointsToAward,
        newBalance,
        lastClaimedAt: now,
        nextClaimTime: new Date(now.getTime() + 6 * 60 * 60 * 1000)
      };
    } catch (error) {
      console.error('Error claiming farming points:', error);
      return { success: false, error: 'Failed to claim farming points' };
    }
  }

  
  async getAdminStats() {
    try {
      const [
        totalUsers,
        totalGames,
        totalBets,
        activeUsers,
        recentUsers
      ] = await Promise.all([
        prisma.user.count(),
        prisma.gameRound.count(),
        prisma.bet.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.user.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
          }
        })
      ]);

      const totalWagered = await prisma.bet.aggregate({
        _sum: { amount: true }
      });

      const totalWon = await prisma.bet.aggregate({
        _sum: { payout: true },
        where: { status: 'CASHED_OUT' }
      });

      return {
        totalUsers,
        totalGames,
        totalBets,
        activeUsers,
        recentUsers,
        totalWagered: totalWagered._sum.amount || 0,
        totalWon: totalWon._sum.payout || 0,
        houseProfit: (totalWagered._sum.amount || 0) - (totalWon._sum.payout || 0)
      };
    } catch (error) {
      console.error('Error getting admin stats:', error);
      throw error;
    }
  }

  async getAllUsers(page = 1, limit = 50, search = '') {
    try {
      const skip = (page - 1) * limit;
      const where = search ? {
        OR: [
          { username: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } }
        ]
      } : {};

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            telegramId: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            balance: true,
            isActive: true,
            isVerified: true,
            totalWagered: true,
            totalWon: true,
            gamesPlayed: true,
            createdAt: true,
            lastLoginAt: true
          }
        }),
        prisma.user.count({ where })
      ]);

      return {
        users,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('Error getting all users:', error);
      throw error;
    }
  }

  async getGameRounds(page = 1, limit = 50) {
    try {
      const skip = (page - 1) * limit;

      const [rounds, total] = await Promise.all([
        prisma.gameRound.findMany({
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            bets: {
              select: {
                id: true,
                amount: true,
                payout: true,
                status: true,
                user: {
                  select: {
                    username: true,
                    telegramId: true
                  }
                }
              }
            }
          }
        }),
        prisma.gameRound.count()
      ]);

      return {
        rounds,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('Error getting game rounds:', error);
      throw error;
    }
  }

  
  async incrementBalance(userId, amount) {
    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          balance: {
            increment: amount
          }
        }
      });
      
      return this.sanitizeUser(user);
    } catch (error) {
      console.error('Error incrementing balance:', error);
      throw error;
    }
  }

  async getGameRoundWithBets(roundId) {
    try {
      const round = await prisma.gameRound.findUnique({
        where: { id: roundId },
        include: {
          bets: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true
                }
              }
            }
          }
        }
      });
      
      return round;
    } catch (error) {
      console.error('Error getting game round with bets:', error);
      return null;
    }
  }

  async getReferralById(referralId) {
    try {
      return await prisma.referral.findUnique({
        where: { id: referralId },
        include: {
          referrer: {
            select: {
              id: true,
              username: true,
              email: true
            }
          },
          invitee: {
            select: {
              id: true,
              username: true,
              email: true
            }
          }
        }
      });
    } catch (error) {
      console.error('Error getting referral:', error);
      return null;
    }
  }

  async approveReferral(referralId, adminUserId) {
    try {
      const referral = await prisma.referral.findUnique({
        where: { id: referralId },
        include: {
          referrer: true,
          invitee: true
        }
      });

      if (!referral) {
        throw new Error('Referral not found');
      }

      if (referral.referrerRewardStatus !== 'PENDING') {
        throw new Error('Referral is not pending');
      }

      const result = await prisma.$transaction(async (tx) => {
        const referrerBonus = 1000;
        const newBalance = parseFloat(referral.referrer.balance) + referrerBonus;

        await tx.user.update({
          where: { id: referral.referrerUserId },
          data: { balance: newBalance }
        });

        await tx.referral.update({
          where: { id: referralId },
          data: {
            referrerRewardStatus: 'PAID',
            activationEventAt: new Date(),
            notes: `Approved by admin ${adminUserId}`
          }
        });

        await tx.transaction.create({
          data: {
            userId: referral.referrerUserId,
            type: 'BONUS',
            amount: referrerBonus,
            balanceBefore: parseFloat(referral.referrer.balance),
            balanceAfter: newBalance,
            description: `Admin-approved referral for ${referral.invitee.username}`,
            metadata: {
              type: 'referral_activation_bonus',
              inviteeId: referral.inviteeUserId,
              referralId: referral.id,
              approvedBy: adminUserId
            }
          }
        });

        return { success: true };
      });

      return result;
    } catch (error) {
      console.error('Error approving referral:', error);
      throw error;
    }
  }

  async rejectReferral(referralId, adminUserId, reason) {
    try {
      const referral = await prisma.referral.update({
        where: { id: referralId },
        data: {
          referrerRewardStatus: 'REJECTED',
          notes: `Rejected by admin ${adminUserId}: ${reason}`
        }
      });

      return { success: true, referral };
    } catch (error) {
      console.error('Error rejecting referral:', error);
      throw error;
    }
  }

  async createAdminChangeRequest(data) {
    try {
      return await prisma.adminChangeRequest.create({
        data
      });
    } catch (error) {
      console.error('Error creating admin change request:', error);
      throw error;
    }
  }

  async getAdminStats() {
    try {
      console.log('Getting admin stats...');
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);

      console.log('Date ranges:', { today, weekAgo });

      let totalUsers, activeToday, activeThisWeek, roundsToday, totalBetsToday,
          uniquePlayersToday, totalWageredToday, totalWonToday, referralsToday, activationsToday;

      try {
        console.log('Getting total users...');
        totalUsers = await prisma.user.count();
        
        console.log('Getting active users today...');
        activeToday = await prisma.user.count({
          where: { lastLoginAt: { gte: today } }
        });
        
        console.log('Getting active users this week...');
        activeThisWeek = await prisma.user.count({
          where: { lastLoginAt: { gte: weekAgo } }
        });
        
        console.log('Getting game rounds today...');
        roundsToday = await prisma.gameRound.count({
          where: { createdAt: { gte: today } }
        });
        
        console.log('Getting bets today...');
        totalBetsToday = await prisma.bet.count({
          where: { placedAt: { gte: today } }
        });
        
        console.log('Getting unique players today...');
        const uniquePlayers = await prisma.bet.findMany({
          where: { placedAt: { gte: today } },
          select: { userId: true },
          distinct: ['userId']
        });
        uniquePlayersToday = uniquePlayers.length;
        
        console.log('Getting total wagered today...');
        const wagerResult = await prisma.bet.aggregate({
          where: { placedAt: { gte: today } },
          _sum: { amount: true }
        });
        totalWageredToday = wagerResult._sum.amount || 0;
        
        console.log('Getting total won today...');
        const wonResult = await prisma.bet.aggregate({
          where: { 
            placedAt: { gte: today },
            status: 'CASHED_OUT'
          },
          _sum: { payout: true }
        });
        totalWonToday = wonResult._sum.payout || 0;
        
        console.log('Getting referrals today...');
        referralsToday = await prisma.referral.count({
          where: { createdAt: { gte: today } }
        });
        
        console.log('Getting activations today...');
        activationsToday = await prisma.referral.count({
          where: {
            activationEventAt: { gte: today },
            referrerRewardStatus: 'PAID'
          }
        });
        
        console.log('All queries completed successfully');
        
      } catch (queryError) {
        console.error('Query error in admin stats:', queryError);
        throw queryError;
      }

      const houseEdgeToday = totalWageredToday - totalWonToday;
      const avgCrashToday = await prisma.gameRound.aggregate({
        where: {
          createdAt: {
            gte: today
          },
          status: 'CRASHED'
        },
        _avg: {
          crashPoint: true
        }
      }).then(result => result._avg.crashPoint || 0);

      return {
        users: {
          total: totalUsers,
          activeToday,
          activeThisWeek,
          percentActiveToday: totalUsers > 0 ? ((activeToday / totalUsers) * 100).toFixed(1) : 0
        },
        gameplay: {
          roundsToday,
          betsToday: totalBetsToday,
          uniquePlayersToday,
          avgBetsPerPlayer: uniquePlayersToday > 0 ? (totalBetsToday / uniquePlayersToday).toFixed(1) : 0,
          avgCrashToday: parseFloat(avgCrashToday).toFixed(2)
        },
        economy: {
          totalWageredToday: parseFloat(totalWageredToday).toFixed(0),
          totalWonToday: parseFloat(totalWonToday).toFixed(0),
          houseEdgeToday: parseFloat(houseEdgeToday).toFixed(0),
          houseEdgePercent: totalWageredToday > 0 ? ((houseEdgeToday / totalWageredToday) * 100).toFixed(1) : 0
        },
        referrals: {
          newToday: referralsToday,
          activatedToday: activationsToday,
          conversionRate: referralsToday > 0 ? ((activationsToday / referralsToday) * 100).toFixed(1) : 0
        }
      };
    } catch (error) {
      console.error('Error getting admin stats:', error);
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
      
      return {
        users: { total: 0, activeToday: 0, activeThisWeek: 0, percentActiveToday: 0 },
        gameplay: { roundsToday: 0, betsToday: 0, uniquePlayersToday: 0, avgBetsPerPlayer: 0, avgCrashToday: '0.00' },
        economy: { totalWageredToday: '0', totalWonToday: '0', houseEdgeToday: '0', houseEdgePercent: 0 },
        referrals: { newToday: 0, activatedToday: 0, conversionRate: 0 },
        error: 'Failed to load complete stats: ' + error.message
      };
    }
  }

  
  generateReferralCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `AV8R-${code}`;
  }
  
  calculateLevel(experience) {
    if (experience < 100) return 1;
    if (experience < 250) return 2;
    if (experience < 500) return 3;
    if (experience < 1000) return 4;
    if (experience < 2000) return 5;
    if (experience < 3500) return 6;
    if (experience < 5500) return 7;
    if (experience < 8000) return 8;
    if (experience < 11000) return 9;
    if (experience < 15000) return 10;
    
    return Math.floor(10 + (experience - 15000) / 5000);
  }

  async updateUserLevel(userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { experience: true, level: true }
      });
      
      if (!user) return;
      
      const newLevel = this.calculateLevel(user.experience);
      if (newLevel !== user.level) {
        await prisma.user.update({
          where: { id: userId },
          data: { level: newLevel }
        });
      }
      
      return newLevel;
    } catch (error) {
      console.error('Error updating user level:', error);
    }
  }

  sanitizeUser(user) {
    if (!user) return null;
    
    const { passwordHash, ...sanitized } = user;
    return {
      ...sanitized,
      balance: parseFloat(sanitized.balance),
      totalWagered: parseFloat(sanitized.totalWagered),
      totalWon: parseFloat(sanitized.totalWon),
      totalLost: parseFloat(sanitized.totalLost),
      biggestWin: parseFloat(sanitized.biggestWin),
      biggestLoss: parseFloat(sanitized.biggestLoss || 0),
      experience: sanitized.experience || 0,
      level: sanitized.level || 1
    };
  }
  
  async healthCheck() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'healthy', database: 'connected' };
    } catch (error) {
      console.error('Database health check failed:', error);
      return { status: 'unhealthy', database: 'disconnected', error: error.message };
    }
  }
}

module.exports = new DatabaseService();
