import React, { useState, useEffect, useRef, useCallback } from 'react';
import authService from './services/authService.js';
import betHistoryService from './services/betHistoryService.js';
import { usePlayerSettings } from './hooks/usePlayerSettings.js';

const UserProfile = ({ isOpen, onClose, initialTab }) => {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState(initialTab || 'profile');
  const [isLoading, setIsLoading] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardType, setLeaderboardType] = useState('balance');
  
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const lastFetchRef = useRef(0);
  const inFlightRef = useRef(false);

  const [history, setHistory] = useState([]);
  const [dailyLimits, setDailyLimits] = useState(null);
  const [showLimitSettings, setShowLimitSettings] = useState(false);

  const {
    saving,
    updateSetting,
    dailyLimitsEnabled,
    maxDailyWager,
    maxDailyLoss,
    maxGamesPerDay
  } = usePlayerSettings();

  const fetchUserProfile = useCallback(async (force = false) => {
    const now = Date.now();
    const MIN_INTERVAL = 3000;

    if (!force) {
      if (inFlightRef.current) return;
      if (now - lastFetchRef.current < MIN_INTERVAL) return;
    }

    inFlightRef.current = true;
    try {
      const response = await authService.apiRequest('/auth/profile');
      if (response.success && response.user) {
        setUser(response.user);
        authService.saveUser(response.user);
      }
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
    } finally {
      lastFetchRef.current = Date.now();
      inFlightRef.current = false;
    }
  }, []);

  const loadLeaderboard = useCallback(async () => {
    try {
      const result = await authService.getLeaderboard(leaderboardType, 10);
      if (result.success) {
        setLeaderboard(result.leaderboard);
      }
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    }
  }, [leaderboardType]);

  const loadSessionData = useCallback(() => {
    try {
      setHistory(betHistoryService.getRecentHistory(100));

      const serverLimits = {
        enabled: dailyLimitsEnabled,
        maxDailyWager: maxDailyWager,
        maxDailyLoss: maxDailyLoss,
        maxGamesPerDay: maxGamesPerDay
      };
      betHistoryService.updateDailyLimits(serverLimits);
      setDailyLimits(betHistoryService.getDailyLimitsStatus());
    } catch (err) {
      console.error('Failed to load session data:', err);
    }
  }, [dailyLimitsEnabled, maxDailyWager, maxDailyLoss, maxGamesPerDay]);

  const updateDailyLimits = useCallback((newLimits) => {
    betHistoryService.updateDailyLimits(newLimits);
    setDailyLimits(betHistoryService.getDailyLimitsStatus());

    if (authService.isAuthenticated()) {
      if ('enabled' in newLimits) updateSetting('dailyLimitsEnabled', newLimits.enabled);
      if ('maxDailyWager' in newLimits) updateSetting('maxDailyWager', newLimits.maxDailyWager);
      if ('maxDailyLoss' in newLimits) updateSetting('maxDailyLoss', newLimits.maxDailyLoss);
      if ('maxGamesPerDay' in newLimits) updateSetting('maxGamesPerDay', newLimits.maxGamesPerDay);
    }
  }, [updateSetting]);

  useEffect(() => {
    if (!isOpen) return;
    
    setUser(authService.getUser());
    
    const fetchTimer = setTimeout(() => {
      fetchUserProfile(true);
    }, 100);
    
    return () => clearTimeout(fetchTimer);
  }, [isOpen, fetchUserProfile]);

  useEffect(() => {
    if (!isOpen) return;
    
    if (activeTab === 'leaderboard') {
      loadLeaderboard();
    } else if (activeTab === 'profile') {
      fetchUserProfile();
    } else if (activeTab === 'history' || activeTab === 'limits') {
      loadSessionData();
    }
  }, [activeTab, isOpen, fetchUserProfile, loadLeaderboard, loadSessionData]);

  useEffect(() => {
    if (!isOpen) return;
    
    const handleBalanceUpdate = () => fetchUserProfile();
    
    window.addEventListener('balanceUpdated', handleBalanceUpdate);
    window.addEventListener('authStateChanged', handleBalanceUpdate);

    return () => {
      window.removeEventListener('balanceUpdated', handleBalanceUpdate);
      window.removeEventListener('authStateChanged', handleBalanceUpdate);
    };
  }, [isOpen, fetchUserProfile]);

  useEffect(() => {
    const handler = (e) => {
      const tab = e?.detail?.tab;
      if (tab) setActiveTab(tab);
    };
    window.addEventListener('userProfileSetTab', handler);
    return () => window.removeEventListener('userProfileSetTab', handler);
  }, []);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    const errors = {};
    if (!passwordForm.oldPassword) {
      errors.oldPassword = 'Current password is required';
    }
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 6) {
      errors.newPassword = 'New password must be at least 6 characters';
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      return;
    }

    setIsLoading(true);
    setPasswordErrors({});
    setPasswordSuccess(false);

    try {
      const result = await authService.changePassword(
        passwordForm.oldPassword,
        passwordForm.newPassword
      );

      if (result.success) {
        setPasswordSuccess(true);
        setPasswordForm({
          oldPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      } else {
        setPasswordErrors({ general: result.error });
      }
    } catch (error) {
      setPasswordErrors({ general: 'Failed to change password' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    onClose();
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount, useCompact = false) => {
    const n = Number.isFinite(Number(amount)) ? Number(amount) : 0;
    if (useCompact && n >= 1000) {
      if (n >= 1000000) {
        return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M pts';
      }
      return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k pts';
    }
    return n.toLocaleString() + ' pts';
  };

  const getNextLevelXP = (currentLevel) => {
    if (currentLevel < 1) return 100;
    if (currentLevel === 1) return 100;
    if (currentLevel === 2) return 250;
    if (currentLevel === 3) return 500;
    if (currentLevel === 4) return 1000;
    if (currentLevel === 5) return 2000;
    if (currentLevel === 6) return 3500;
    if (currentLevel === 7) return 5500;
    if (currentLevel === 8) return 8000;
    if (currentLevel === 9) return 11000;
    if (currentLevel === 10) return 15000;
    return 15000 + ((currentLevel - 10) * 5000);
  };

  const getCurrentLevelXP = (level) => {
    if (level <= 1) return 0;
    return getNextLevelXP(level - 1);
  };

  const getXPProgress = (experience, level) => {
    const currentLevelXP = getCurrentLevelXP(level);
    const nextLevelXP = getNextLevelXP(level);
    const levelProgress = experience - currentLevelXP;
    const levelRequirement = nextLevelXP - currentLevelXP;
    return Math.min(100, Math.max(0, (levelProgress / levelRequirement) * 100));
  };

  const getRankIcon = (index) => {
    switch (index) {
      case 0: return '1st';
      case 1: return '2nd';
      case 2: return '3rd';
      default: return `#${index + 1}`;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {
}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-lg font-bold">{(user?.username?.[0] || 'G').toUpperCase()}</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{user?.username || 'Guest'}</h2>
              {user && (
                <p className="text-sm text-gray-400">Level {user.level || 1} • {user.role}</p>
              )}
            </div>
          </div>
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
            { id: 'profile', label: 'Profile', icon: null },
            { id: 'history', label: 'History', icon: null },
            { id: 'limits', label: 'Limits', icon: null },
            ...(user?.telegramId ? [] : [{ id: 'security', label: 'Security', icon: null }]),
            { id: 'leaderboard', label: 'Leaderboard', icon: null }
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
          {!user && (
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-2">Guest Profile</h3>
                <p className="text-gray-300 text-sm">You are playing in guest mode. Log in or register to save progress and access security settings.</p>
              </div>
            </div>
          )}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {
}
              {user && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-400">{formatCurrency(user.balance, true)}</div>
                  <div className="text-sm text-gray-400">Balance</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-400">{user.gamesPlayed}</div>
                  <div className="text-sm text-gray-400">Games Played</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-400">{Number(user?.winRate ?? 0).toFixed(1)}%</div>
                  <div className="text-sm text-gray-400">Win Rate</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-purple-400">{user.level || 1}</div>
                  <div className="text-sm text-gray-400">Level</div>
                </div>
              </div>
              )}

              {
}
              {user && (
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold">Experience Progress</h3>
                  <span className="text-xs text-gray-400">Level {user.level || 1}</span>
                </div>
                <div className="mb-2">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>{user.experience || 0} XP</span>
                    <span>Next: {getNextLevelXP(user.level || 1)} XP</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${getXPProgress(user.experience || 0, user.level || 1)}%` }}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  Earn XP by playing games, winning bets, and claiming daily rewards!
                </p>
              </div>
              )}

              {
}
              {user && (
              <>
              <div className="text-xs text-gray-400 text-center mb-2">
                Lifetime statistics from server
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-4">Financial Stats</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total Wagered:</span>
                      <span className="font-medium">{formatCurrency(user.totalWagered)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total Won:</span>
                      <span className="font-medium text-green-400">{formatCurrency(user.totalWon)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total Lost:</span>
                      <span className="font-medium text-red-400">{formatCurrency(user.totalLost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Net Profit:</span>
                      <span className={`font-medium ${user.totalWon - user.totalLost >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(user.totalWon - user.totalLost)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-4">Performance</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Biggest Win:</span>
                      <span className="font-medium text-green-400">{formatCurrency(user.biggestWin)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Biggest Loss:</span>
                      <span className="font-medium text-red-400">{formatCurrency(Math.abs(Number(user.biggestLoss || 0)))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Experience:</span>
                      <span className="font-medium text-purple-400">{user.experience || 0} XP</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Member Since:</span>
                      <span className="font-medium">{formatDate(user.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
              </>
              )}

              {
}
              {user && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4">Account Information</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Email:</span>
                    <span className="font-medium">{user.email || (user.telegramId ? 'Telegram User' : 'Not provided')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Last Login:</span>
                    <span className="font-medium">
                      {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Account Status:</span>
                    <span className="font-medium text-green-400">
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Recent Bets</h3>
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
                      style={{ width: `${dailyLimits.maxDailyWager > 0 ? Math.min(100, (dailyLimits.dailyWagered / dailyLimits.maxDailyWager) * 100) : 0}%` }}
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
                      style={{ width: `${dailyLimits.maxDailyLoss > 0 ? Math.min(100, (dailyLimits.dailyLost / dailyLimits.maxDailyLoss) * 100) : 0}%` }}
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
                      style={{ width: `${dailyLimits.maxGamesPerDay > 0 ? Math.min(100, (dailyLimits.gamesPlayedToday / dailyLimits.maxGamesPerDay) * 100) : 0}%` }}
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

          {activeTab === 'security' && user && !user.telegramId && (
            <div className="space-y-6">
              {
}
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4">Change Password</h3>
                
                {passwordSuccess && (
                  <div className="bg-green-600 text-white p-3 rounded-lg mb-4">
                    Password changed successfully!
                  </div>
                )}

                {passwordErrors.general && (
                  <div className="bg-red-600 text-white p-3 rounded-lg mb-4">
                    {passwordErrors.general}
                  </div>
                )}

                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={passwordForm.oldPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, oldPassword: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      disabled={isLoading}
                    />
                    {passwordErrors.oldPassword && (
                      <p className="text-red-400 text-xs mt-1">{passwordErrors.oldPassword}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      disabled={isLoading}
                    />
                    {passwordErrors.newPassword && (
                      <p className="text-red-400 text-xs mt-1">{passwordErrors.newPassword}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      disabled={isLoading}
                    />
                    {passwordErrors.confirmPassword && (
                      <p className="text-red-400 text-xs mt-1">{passwordErrors.confirmPassword}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg"
                  >
                    {isLoading ? 'Changing...' : 'Change Password'}
                  </button>
                </form>
              </div>

              {
}
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4">Account Actions</h3>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
                >
                  Logout
                </button>
              </div>
            </div>
          )}

          {activeTab === 'leaderboard' && (
            <div className="space-y-4">
              {
}
              <div className="flex space-x-2">
                {[
                  { key: 'balance', label: 'Balance' },
                  { key: 'totalWon', label: 'Total Won' },
                  { key: 'winRate', label: 'Win Rate' }
                ].map(type => (
                  <button
                    key={type.key}
                    onClick={() => {
                      setLeaderboardType(type.key);
                      loadLeaderboard();
                    }}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      leaderboardType === type.key
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>

              {
}
              <div className="bg-gray-800 rounded-lg overflow-hidden">
                <div className="p-4 border-b border-gray-700">
                  <h3 className="text-lg font-semibold">Top Players</h3>
                </div>
                <div className="divide-y divide-gray-700">
                  {leaderboard.map((player, index) => (
                    <div key={player.id} className="p-4 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">{getRankIcon(index)}</span>
                        <div>
                          <div className="font-medium text-white">{player.username}</div>
                          <div className="text-sm text-gray-400">Level {player.level || 1}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-white">
                          {leaderboardType === 'winRate' 
                            ? `${Number(player[leaderboardType] ?? 0).toFixed(1)}%`
                            : formatCurrency(player[leaderboardType])
                          }
                        </div>
                        <div className="text-sm text-gray-400">
                          {player.gamesPlayed} games
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
