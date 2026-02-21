
console.log('=== Aviator Bet History Diagnostic ===');

const history = localStorage.getItem('aviator_bet_history');
const historyData = history ? JSON.parse(history) : [];
console.log('Total bets in history:', historyData.length);
console.log('First 5 bets:', historyData.slice(0, 5));

const stats = localStorage.getItem('aviator_player_stats');
const statsData = stats ? JSON.parse(stats) : {};
console.log('\nPlayer Stats:', statsData);

const limits = localStorage.getItem('aviator_daily_limits');
const limitsData = limits ? JSON.parse(limits) : {};
console.log('\nDaily Limits:', limitsData);

const statusCounts = historyData.reduce((acc, bet) => {
  acc[bet.status] = (acc[bet.status] || 0) + 1;
  return acc;
}, {});
console.log('\nBet Status Breakdown:', statusCounts);

const activeBets = historyData.filter(bet => bet.status === 'active');
console.log('\nActive (incomplete) bets:', activeBets.length);

const actualStats = {
  totalBets: historyData.length,
  totalWon: historyData.filter(b => b.status === 'won').length,
  totalLost: historyData.filter(b => b.status === 'lost').length,
  totalWagered: historyData.reduce((sum, b) => sum + b.amount, 0),
  totalWinnings: historyData.reduce((sum, b) => sum + (b.winnings || 0), 0),
  actualProfit: historyData.reduce((sum, b) => sum + (b.profit || -b.amount), 0)
};
console.log('\nCalculated from history:', actualStats);
