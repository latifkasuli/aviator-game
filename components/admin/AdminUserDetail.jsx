import React, { useState, useEffect } from 'react';
import authService from '../services/authService.js';

const AdminUserDetail = ({ userId, onClose, onUserUpdate }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('profile');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);

  const loadUserDetails = async () => {
    try {
      setIsLoading(true);
      const response = await authService.apiRequest(`/admin/users/${userId}`);
      if (response.success) {
        setUser(response.user);
        setError('');
      } else {
        setError('Failed to load user details');
      }
    } catch (err) {
      setError(err.message || 'Failed to load user details');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const response = await authService.apiRequest(`/admin/audit-logs/USER/${userId}`);
      if (response.success) {
        setAuditLogs(response.logs);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    }
  };

  useEffect(() => {
    loadUserDetails();
    loadAuditLogs();
  }, [userId]);

  const handleBalanceAdjust = async (e) => {
    e.preventDefault();
    if (!adjustAmount || !adjustReason) {
      alert('Please enter amount and reason');
      return;
    }

    try {
      setIsAdjusting(true);
      const response = await authService.apiRequest(`/admin/users/${userId}/adjust-balance`, {
        method: 'POST',
        body: JSON.stringify({
          amount: parseFloat(adjustAmount),
          reason: adjustReason
        })
      });

      if (response.success) {
        setUser(response.user);
        setAdjustAmount('');
        setAdjustReason('');
        onUserUpdate(response.user);
        loadAuditLogs();
        
        if (window.Telegram?.WebApp?.showAlert) {
          window.Telegram.WebApp.showAlert('Balance adjusted successfully');
        }
      }
    } catch (err) {
      console.error('Balance adjust error:', err);
      alert('Failed to adjust balance: ' + err.message);
    } finally {
      setIsAdjusting(false);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    const num = parseFloat(amount);
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="space-y-4">
        <button onClick={onClose} className="text-blue-400 hover:text-blue-300">
          ← Back to Users
        </button>
        <div className="bg-red-900 bg-opacity-50 border border-red-600 rounded-lg p-4">
          <p className="text-red-300">{error || 'User not found'}</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'profile', label: 'Profile' },
    { id: 'balance', label: 'Balance' },
    { id: 'stats', label: 'Statistics' },
    { id: 'audit', label: 'Audit Log' }
  ];

  return (
    <div className="space-y-6">
      {
}
      <div className="flex items-center justify-between">
        <button onClick={onClose} className="text-blue-400 hover:text-blue-300">
          ← Back to Users
        </button>
        <h2 className="text-2xl font-bold text-white">User Details</h2>
        <div className="w-24"></div>
      </div>

      {
}
      <div className="bg-gray-800 rounded-lg p-4 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-white">{user.username}</h3>
          <p className="text-gray-400">{user.email || 'Telegram User'}</p>
          <p className="text-sm text-gray-500 font-mono">{user.id}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-green-400">{formatCurrency(user.balance)} pts</p>
          <span className={`px-2 py-1 text-xs rounded ${
            user.isActive ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
          }`}>
            {user.isActive ? 'Active' : 'Banned'}
          </span>
        </div>
      </div>

      {
}
      <div className="border-b border-gray-700">
        <nav className="flex space-x-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {
}
      <div>
        {
}
        {activeTab === 'profile' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Username</p>
                <p className="text-white font-medium">{user.username}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Email</p>
                <p className="text-white font-medium">{user.email || 'Not provided'}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Role</p>
                <p className="text-white font-medium">{user.role}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Telegram ID</p>
                <p className="text-white font-medium">{user.telegramId || 'N/A'}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Joined</p>
                <p className="text-white font-medium">{formatDate(user.createdAt)}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Last Login</p>
                <p className="text-white font-medium">
                  {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}
                </p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Referral Code</p>
                <p className="text-white font-medium font-mono">{user.referralCode || 'N/A'}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Referred By</p>
                <p className="text-white font-medium">{user.referredBy || 'None'}</p>
              </div>
            </div>
          </div>
        )}

        {
}
        {activeTab === 'balance' && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Current Balance</h3>
              <p className="text-4xl font-bold text-green-400">{formatCurrency(user.balance)} pts</p>
            </div>

            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Adjust Balance</h3>
              <form onSubmit={handleBalanceAdjust} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Amount (positive to add, negative to subtract)
                  </label>
                  <input
                    type="number"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
                    placeholder="e.g., 1000 or -500"
                    step="0.01"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Reason
                  </label>
                  <input
                    type="text"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
                    placeholder="Reason for adjustment"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isAdjusting}
                  className={`px-6 py-2 rounded font-medium ${
                    isAdjusting
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {isAdjusting ? 'Adjusting...' : 'Adjust Balance'}
                </button>
              </form>
            </div>
          </div>
        )}

        {
}
        {activeTab === 'stats' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-sm">Total Wagered</p>
              <p className="text-white font-medium">{formatCurrency(user.totalWagered || 0)} pts</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-sm">Total Won</p>
              <p className="text-white font-medium">{formatCurrency(user.totalWon || 0)} pts</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-sm">Total Lost</p>
              <p className="text-white font-medium">{formatCurrency(user.totalLost || 0)} pts</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-sm">Games Played</p>
              <p className="text-white font-medium">{user.gamesPlayed || 0}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-sm">Win Rate</p>
              <p className="text-white font-medium">{user.winRate || 0}%</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-sm">Biggest Win</p>
              <p className="text-white font-medium">{formatCurrency(user.biggestWin || 0)} pts</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-sm">Biggest Loss</p>
              <p className="text-white font-medium">{formatCurrency(user.biggestLoss || 0)} pts</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-sm">Level</p>
              <p className="text-white font-medium">Level {user.level || 1} ({user.experience || 0} XP)</p>
            </div>
          </div>
        )}

        {
}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            {auditLogs.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No audit logs found</p>
            ) : (
              <div className="space-y-2">
                {auditLogs.map((log) => (
                  <div key={log.id} className="bg-gray-800 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-white">{log.action}</p>
                        <p className="text-sm text-gray-400">
                          By {log.adminUser?.username} • {formatDate(log.createdAt)}
                        </p>
                        {log.notes && (
                          <p className="text-sm text-gray-300 mt-1">{log.notes}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUserDetail;
