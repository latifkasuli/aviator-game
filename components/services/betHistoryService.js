
class BetHistoryService {
  constructor() {
    this.storageKey = 'aviator_bet_history';
    this.statsKey = 'aviator_player_stats';
    this.limitsKey = 'aviator_daily_limits';
    this.history = this.loadHistory();
    this.stats = this.loadStats();
    this.dailyLimits = this.loadDailyLimits();
  }

  loadHistory() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading bet history:', error);
      return [];
    }
  }

  loadStats() {
    try {
      const stored = localStorage.getItem(this.statsKey);
      return stored ? JSON.parse(stored) : {
        totalBets: 0,
        totalWagered: 0,
        totalWon: 0,
        totalLost: 0,
        biggestWin: 0,
        biggestLoss: 0,
        longestWinStreak: 0,
        longestLossStreak: 0,
        currentStreak: 0,
        currentStreakType: null,
        averageMultiplier: 0,
        gamesPlayed: 0,
        lastPlayDate: null
      };
    } catch (error) {
      console.error('Error loading stats:', error);
      return this.getDefaultStats();
    }
  }

  loadDailyLimits() {
    try {
      const stored = localStorage.getItem(this.limitsKey);
      const today = new Date().toDateString();
      const limits = stored ? JSON.parse(stored) : {};
      
      if (limits.date !== today) {
        limits.date = today;
        limits.dailyWagered = 0;
        limits.dailyLost = 0;
        limits.gamesPlayedToday = 0;
        this.saveDailyLimits(limits);
      }
      
      return {
        maxDailyWager: limits.maxDailyWager || 10000,
        maxDailyLoss: limits.maxDailyLoss || 5000,
        maxGamesPerDay: limits.maxGamesPerDay || 100,
        dailyWagered: limits.dailyWagered || 0,
        dailyLost: limits.dailyLost || 0,
        gamesPlayedToday: limits.gamesPlayedToday || 0,
        date: limits.date || today,
        enabled: limits.enabled !== false
      };
    } catch (error) {
      console.error('Error loading daily limits:', error);
      return this.getDefaultLimits();
    }
  }

  getDefaultStats() {
    return {
      totalBets: 0,
      totalWagered: 0,
      totalWon: 0,
      totalLost: 0,
      biggestWin: 0,
      biggestLoss: 0,
      longestWinStreak: 0,
      longestLossStreak: 0,
      currentStreak: 0,
      currentStreakType: null,
      averageMultiplier: 0,
      gamesPlayed: 0,
      lastPlayDate: null
    };
  }

  getDefaultLimits() {
    const today = new Date().toDateString();
    return {
      maxDailyWager: 10000,
      maxDailyLoss: 5000,
      maxGamesPerDay: 100,
      dailyWagered: 0,
      dailyLost: 0,
      gamesPlayedToday: 0,
      date: today,
      enabled: true
    };
  }

  saveHistory() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.history));
    } catch (error) {
      console.error('Error saving bet history:', error);
    }
  }

  saveStats() {
    try {
      localStorage.setItem(this.statsKey, JSON.stringify(this.stats));
    } catch (error) {
      console.error('Error saving stats:', error);
    }
  }

  saveDailyLimits(limits = this.dailyLimits) {
    try {
      localStorage.setItem(this.limitsKey, JSON.stringify(limits));
    } catch (error) {
      console.error('Error saving daily limits:', error);
    }
  }

  recordBet(betAmount, gameId = null) {
    const bet = {
      id: Date.now() + Math.random(),
      amount: betAmount,
      timestamp: new Date().toISOString(),
      gameId: gameId || `game_${Date.now()}`,
      status: 'active',
      multiplier: null,
      winnings: 0,
      profit: -betAmount
    };

    this.history.unshift(bet);
    
    if (this.history.length > 1000) {
      this.history = this.history.slice(0, 1000);
    }

    this.stats.totalBets++;
    this.stats.totalWagered += betAmount;
    this.stats.gamesPlayed++;
    this.stats.lastPlayDate = new Date().toISOString();

    this.dailyLimits.dailyWagered += betAmount;
    this.dailyLimits.gamesPlayedToday++;

    this.saveHistory();
    this.saveStats();
    this.saveDailyLimits();

    return bet;
  }

  recordBetOutcome(betId, multiplier, winnings = 0) {
    const bet = this.history.find(b => b.id === betId);
    if (!bet) return null;

    bet.multiplier = multiplier;
    bet.winnings = winnings;
    bet.profit = winnings - bet.amount;
    bet.status = winnings > 0 ? 'won' : 'lost';

    if (bet.status === 'won') {
      this.stats.totalWon += winnings;
      this.stats.biggestWin = Math.max(this.stats.biggestWin, bet.profit);
      
      if (this.stats.currentStreakType === 'win') {
        this.stats.currentStreak++;
      } else {
        this.stats.currentStreak = 1;
        this.stats.currentStreakType = 'win';
      }
      this.stats.longestWinStreak = Math.max(this.stats.longestWinStreak, this.stats.currentStreak);
    } else {
      this.stats.totalLost += bet.amount;
      this.stats.biggestLoss = Math.max(this.stats.biggestLoss, bet.amount);
      this.dailyLimits.dailyLost += bet.amount;
      
      if (this.stats.currentStreakType === 'loss') {
        this.stats.currentStreak++;
      } else {
        this.stats.currentStreak = 1;
        this.stats.currentStreakType = 'loss';
      }
      this.stats.longestLossStreak = Math.max(this.stats.longestLossStreak, this.stats.currentStreak);
    }

    const completedBets = this.history.filter(b => b.multiplier !== null);
    if (completedBets.length > 0) {
      this.stats.averageMultiplier = completedBets.reduce((sum, b) => sum + b.multiplier, 0) / completedBets.length;
    }

    this.saveHistory();
    this.saveStats();
    this.saveDailyLimits();

    return bet;
  }

  getRecentHistory(limit = 50) {
    return this.history.slice(0, limit);
  }

  getStats() {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    this.history.forEach(bet => {
      if (bet.status === 'active' && new Date(bet.timestamp).getTime() < fiveMinutesAgo) {
        console.log('Cleaning up orphaned bet:', bet.id);
        this.recordBetOutcome(bet.id, 1.0, 0);
      }
    });
    
    const winRate = this.stats.totalBets > 0 ? 
      (this.history.filter(b => b.status === 'won').length / this.stats.totalBets * 100) : 0;
    
    const netProfit = this.stats.totalWon - this.stats.totalLost;
    const roi = this.stats.totalWagered > 0 ? (netProfit / this.stats.totalWagered * 100) : 0;

    return {
      ...this.stats,
      winRate: winRate,
      netProfit: netProfit,
      roi: roi
    };
  }

  canPlaceBet(betAmount) {
    if (!this.dailyLimits.enabled) return { allowed: true };

    const reasons = [];

    if (this.dailyLimits.dailyWagered + betAmount > this.dailyLimits.maxDailyWager) {
      reasons.push(`Daily wager limit (${this.dailyLimits.maxDailyWager} pts) would be exceeded`);
    }

    if (this.dailyLimits.gamesPlayedToday >= this.dailyLimits.maxGamesPerDay) {
      reasons.push(`Daily game limit (${this.dailyLimits.maxGamesPerDay} games) reached`);
    }

    if (this.dailyLimits.dailyLost >= this.dailyLimits.maxDailyLoss) {
      reasons.push(`Daily loss limit (${this.dailyLimits.maxDailyLoss} pts) reached`);
    }

    return {
      allowed: reasons.length === 0,
      reasons: reasons
    };
  }

  updateDailyLimits(newLimits) {
    this.dailyLimits = { ...this.dailyLimits, ...newLimits };
    this.saveDailyLimits();
  }

  getDailyLimitsStatus() {
    return {
      ...this.dailyLimits,
      remainingWager: Math.max(0, this.dailyLimits.maxDailyWager - this.dailyLimits.dailyWagered),
      remainingLoss: Math.max(0, this.dailyLimits.maxDailyLoss - this.dailyLimits.dailyLost),
      remainingGames: Math.max(0, this.dailyLimits.maxGamesPerDay - this.dailyLimits.gamesPlayedToday)
    };
  }

  clearAllData() {
    this.history = [];
    this.stats = this.getDefaultStats();
    this.dailyLimits = this.getDefaultLimits();
    
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.statsKey);
    localStorage.removeItem(this.limitsKey);
  }

  exportData() {
    return {
      history: this.history,
      stats: this.stats,
      dailyLimits: this.dailyLimits,
      exportDate: new Date().toISOString()
    };
  }

  importData(data) {
    try {
      if (data.history) this.history = data.history;
      if (data.stats) this.stats = data.stats;
      if (data.dailyLimits) this.dailyLimits = data.dailyLimits;
      
      this.saveHistory();
      this.saveStats();
      this.saveDailyLimits();
      
      return true;
    } catch (error) {
      console.error('Error importing data:', error);
      return false;
    }
  }
}

const betHistoryService = new BetHistoryService();

export default betHistoryService;
