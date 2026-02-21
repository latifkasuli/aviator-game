import React, { useState, useEffect, useCallback, useRef } from 'react';
import betHistoryService from './services/betHistoryService.js';
import authService from './services/authService.js';
import { usePlayerSettings } from './hooks/usePlayerSettings.js';

const StatsPanel = ({ isOpen, onClose }) => {
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [dailyLimits, setDailyLimits] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showLimitSettings, setShowLimitSettings] = useState(false);
  
  const { 
    settings,
    saving,
    updateSetting,
    dailyLimitsEnabled,
    maxDailyWager,
    maxDailyLoss,
    maxGamesPerDay
  } = usePlayerSettings();

  const loadData = React.useCallback(() => {
    setStats(betHistoryService.getStats());
    setHistory(betHistoryService.getRecentHistory(100));
    
    if (authService.isAuthenticated()) {
      const serverLimits = {
        enabled: dailyLimitsEnabled,
        maxDailyWager: maxDailyWager,
        maxDailyLoss: maxDailyLoss,
        maxGamesPerDay: maxGamesPerDay
      };
      
      betHistoryService.updateDailyLimits(serverLimits);
      console.log('Daily limits synced from server');
    }
    
    setDailyLimits(betHistoryService.getDailyLimitsStatus());
  }, [dailyLimitsEnabled, maxDailyWager, maxDailyLoss, maxGamesPerDay]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);
  

  const safeNum = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;

  const toPercent = (val) => {
    const n = safeNum(val);
    return n <= 1 ? n * 100 : n;
  };

  const formatNumber = (num) => {
    const n = safeNum(num);
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toFixed(0);
  };

  const formatCurrency = (num) => {
    return safeNum(num).toFixed(0) + ' pts';
  };

  const formatPercentage = (num) => {
    return safeNum(num).toFixed(1) + '%';
  };

  const StatCard = ({ title, value, subtitle, color = 'text-white', icon }) => (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm text-gray-400">{title}</h3>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
    </div>
  );

  const updateDailyLimits = useCallback((newLimits) => {
    betHistoryService.updateDailyLimits(newLimits);
    setDailyLimits(betHistoryService.getDailyLimitsStatus());
    
    if (authService.isAuthenticated()) {
      if ('enabled' in newLimits) {
        updateSetting('dailyLimitsEnabled', newLimits.enabled);
      }
      if ('maxDailyWager' in newLimits) {
        updateSetting('maxDailyWager', newLimits.maxDailyWager);
      }
      if ('maxDailyLoss' in newLimits) {
        updateSetting('maxDailyLoss', newLimits.maxDailyLoss);
      }
      if ('maxGamesPerDay' in newLimits) {
        updateSetting('maxGamesPerDay', newLimits.maxGamesPerDay);
      }
    }
  }, [updateSetting]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {
}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Player Statistics</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
            </svg>
          </button>
        </div>

        {
}
        <div className="flex border-b border-gray-700">
          {[
            { id: 'overview', label: 'Overview', icon: null }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-800'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {
}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {activeTab === 'overview' && stats && (
            <div className="space-y-6">
              {
}
              <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-blue-400">[i]</span>
                    <span className="text-gray-300">
                      These statistics are based on your current session. 
                      View your profile for lifetime stats.
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('openUserProfile', { detail: { tab: 'history' } }));
                      }}
                      className="text-blue-400 hover:text-blue-300 text-xs underline"
                    >
                      View Full History
                    </button>
                    <span className="text-gray-600">•</span>
                    <button
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('openUserProfile', { detail: { tab: 'limits' } }));
                      }}
                      className="text-blue-400 hover:text-blue-300 text-xs underline"
                    >
                      Manage Limits
                    </button>
                  </div>
                </div>
              </div>
              {
}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  title="Total Bets"
                  value={formatNumber(stats.totalBets)}
                  subtitle={`${stats.gamesPlayed} rounds played`}
                  icon={null}
                />
                <StatCard
                  title="Win Rate"
                  value={formatPercentage(toPercent(stats.winRate))}
                  subtitle={`${stats.currentStreak} ${stats.currentStreakType || 'game'} streak`}
                  color={toPercent(stats.winRate) >= 50 ? 'text-green-400' : 'text-red-400'}
                  icon={null}
                />
                <StatCard
                  title="Total Wagered"
                  value={formatCurrency(stats.totalWagered)}
                  subtitle="This session"
                  icon={null}
                />
                <StatCard
                  title="Net Profit"
                  value={formatCurrency(stats.netProfit)}
                  subtitle={`ROI: ${formatPercentage(toPercent(stats.roi))}`}
                  color={stats.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}
                  icon={null}
                />
              </div>

              {
}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <StatCard
                  title="Biggest Win"
                  value={formatCurrency(stats.biggestWin)}
                  color="text-green-400"
                  icon={null}
                />
                <StatCard
                  title="Biggest Loss"
                  value={formatCurrency(Math.abs(stats.biggestLoss))}
                  color="text-red-400"
                  icon={null}
                />
                <StatCard
                  title="Avg Multiplier"
                  value={safeNum(stats.averageMultiplier).toFixed(2) + 'x'}
                  icon={null}
                />
              </div>

              {
}
              <div className="grid grid-cols-2 gap-4">
                <StatCard
                  title="Longest Win Streak"
                  value={stats.longestWinStreak}
                  subtitle="consecutive wins"
                  color="text-green-400"
                  icon={null}
                />
                <StatCard
                  title="Longest Loss Streak"
                  value={stats.longestLossStreak}
                  subtitle="consecutive losses"
                  color="text-red-400"
                  icon={null}
                />
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Recent Bets</h3>
                <span className="text-sm text-gray-400">{history.length} total bets</span>
              </div>
              
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {history.length > 0 ? history.map((bet) => (
                  <div key={bet.id} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className={`w-3 h-3 rounded-full ${
                          bet.status === 'won' ? 'bg-green-500' : 
                          bet.status === 'lost' ? 'bg-red-500' : 'bg-yellow-500'
                        }`}></span>
                        <div>
                          <div className="font-medium">{formatCurrency(bet.amount)} bet</div>
                          <div className="text-xs text-gray-400">
                            {new Date(bet.timestamp).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {bet.multiplier && (
                          <div className="font-medium">{bet.multiplier.toFixed(2)}x</div>
                        )}
                        <div className={`text-sm ${
                          bet.profit > 0 ? 'text-green-400' : 
                          bet.profit < 0 ? 'text-red-400' : 'text-gray-400'
                        }`}>
                          {bet.profit > 0 ? '+' : ''}{formatCurrency(bet.profit)}
                        </div>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center text-gray-400 py-8">
                    No betting history yet. Place your first bet to see statistics!
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'limits' && dailyLimits && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Daily Limits</h3>
                <div className="flex items-center gap-2">
                  {saving && <span className="text-xs text-gray-400">Saving...</span>}
                  <button
                    onClick={() => setShowLimitSettings(!showLimitSettings)}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  >
                    {showLimitSettings ? 'Hide Settings' : 'Edit Limits'}
                  </button>
                </div>
              </div>

              {
}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h4 className="text-sm text-gray-400 mb-2">Daily Wagered</h4>
                  <div className="text-xl font-bold">
                    {formatCurrency(dailyLimits.dailyWagered)}
                  </div>
                  <div className="text-xs text-gray-500">
                    of {formatCurrency(dailyLimits.maxDailyWager)} limit
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${Math.min(100, (dailyLimits.dailyWagered / dailyLimits.maxDailyWager) * 100)}%` }}
                    ></div>
                  </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h4 className="text-sm text-gray-400 mb-2">Daily Lost</h4>
                  <div className="text-xl font-bold text-red-400">
                    {formatCurrency(dailyLimits.dailyLost)}
                  </div>
                  <div className="text-xs text-gray-500">
                    of {formatCurrency(dailyLimits.maxDailyLoss)} limit
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                    <div 
                      className="bg-red-500 h-2 rounded-full"
                      style={{ width: `${Math.min(100, (dailyLimits.dailyLost / dailyLimits.maxDailyLoss) * 100)}%` }}
                    ></div>
                  </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h4 className="text-sm text-gray-400 mb-2">Games Played</h4>
                  <div className="text-xl font-bold">
                    {dailyLimits.gamesPlayedToday}
                  </div>
                  <div className="text-xs text-gray-500">
                    of {dailyLimits.maxGamesPerDay} limit
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                    <div 
                      className="bg-yellow-500 h-2 rounded-full"
                      style={{ width: `${Math.min(100, (dailyLimits.gamesPlayedToday / dailyLimits.maxGamesPerDay) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {
}
              {showLimitSettings && (
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h4 className="text-lg font-semibold mb-4">Responsible Gaming Settings</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Enable Daily Limits</label>
                      <button
                        onClick={() => updateDailyLimits({ enabled: !dailyLimits.enabled })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          dailyLimits.enabled ? 'bg-green-600' : 'bg-gray-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            dailyLimits.enabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    {dailyLimits.enabled && (
                      <>
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Max Daily Wager: {formatCurrency(dailyLimits.maxDailyWager)}
                          </label>
                          <input
                            type="range"
                            min="1000"
                            max="50000"
                            step="1000"
                            value={dailyLimits.maxDailyWager}
                            onChange={(e) => updateDailyLimits({ maxDailyWager: parseInt(e.target.value) })}
                            className="w-full"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Max Daily Loss: {formatCurrency(dailyLimits.maxDailyLoss)}
                          </label>
                          <input
                            type="range"
                            min="500"
                            max="25000"
                            step="500"
                            value={dailyLimits.maxDailyLoss}
                            onChange={(e) => updateDailyLimits({ maxDailyLoss: parseInt(e.target.value) })}
                            className="w-full"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Max Games Per Day: {dailyLimits.maxGamesPerDay}
                          </label>
                          <input
                            type="range"
                            min="10"
                            max="500"
                            step="10"
                            value={dailyLimits.maxGamesPerDay}
                            onChange={(e) => updateDailyLimits({ maxGamesPerDay: parseInt(e.target.value) })}
                            className="w-full"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatsPanel;
