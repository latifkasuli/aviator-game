import React, { useState, useEffect } from 'react';
import authService from '../services/authService.js';

const AdminStats = () => {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = async () => {
    try {
      setRefreshing(true);
      const response = await authService.apiRequest('/admin/stats');
      if (response.success) {
        setStats(response.stats);
        setError('');
      } else {
        setError('Failed to load stats');
      }
    } catch (err) {
      setError(err.message || 'Failed to load stats');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900 bg-opacity-50 border border-red-600 rounded-lg p-4">
        <p className="text-red-300">{error}</p>
        <button
          onClick={loadStats}
          className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  const StatCard = ({ title, value, subtitle, icon, color = 'blue' }) => {
    const colorClasses = {
      blue: 'bg-blue-900 bg-opacity-50 border-blue-600 text-blue-300',
      green: 'bg-green-900 bg-opacity-50 border-green-600 text-green-300',
      yellow: 'bg-yellow-900 bg-opacity-50 border-yellow-600 text-yellow-300',
      red: 'bg-red-900 bg-opacity-50 border-red-600 text-red-300',
      purple: 'bg-purple-900 bg-opacity-50 border-purple-600 text-purple-300',
    };

    return (
      <div className={`p-6 rounded-lg border ${colorClasses[color]}`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-gray-400 text-sm">{title}</p>
            <p className="text-3xl font-bold text-white mt-1">{value}</p>
            {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
          </div>
          {icon && <span className="text-3xl opacity-50">{icon}</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {
}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Dashboard Overview</h2>
        <button
          onClick={loadStats}
          disabled={refreshing}
          className={`px-4 py-2 rounded flex items-center space-x-2 ${
            refreshing 
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {
}
      {stats?.websocket && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-lg font-semibold mb-3">Live Game Status</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-gray-400 text-sm">Connected</p>
              <p className="text-xl font-bold">{stats.websocket.connectedClients}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Active Bets</p>
              <p className="text-xl font-bold">{stats.websocket.activeBets}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Game State</p>
              <p className="text-xl font-bold capitalize">{stats.websocket.currentState}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Multiplier</p>
              <p className="text-xl font-bold">{stats.websocket.currentMultiplier.toFixed(2)}x</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Round ID</p>
              <p className="text-sm font-mono">{stats.websocket.roundId || 'N/A'}</p>
            </div>
          </div>
        </div>
      )}

      {
}
      <div>
        <h3 className="text-lg font-semibold mb-3">User Statistics</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            title="Total Users"
            value={stats?.users.total || 0}
            icon={null}
            color="blue"
          />
          <StatCard
            title="Active Today"
            value={stats?.users.activeToday || 0}
            subtitle={`${stats?.users.percentActiveToday || 0}% of total`}
            icon={null}
            color="green"
          />
          <StatCard
            title="Active This Week"
            value={stats?.users.activeThisWeek || 0}
            icon={null}
            color="yellow"
          />
          <StatCard
            title="New Today"
            value={stats?.referrals.newToday || 0}
            subtitle="Via referrals"
            icon={null}
            color="purple"
          />
        </div>
      </div>

      {
}
      <div>
        <h3 className="text-lg font-semibold mb-3">Gameplay Statistics</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            title="Rounds Today"
            value={stats?.gameplay.roundsToday || 0}
            icon={null}
            color="blue"
          />
          <StatCard
            title="Bets Today"
            value={stats?.gameplay.betsToday || 0}
            subtitle={`${stats?.gameplay.avgBetsPerPlayer || 0} per player`}
            icon={null}
            color="green"
          />
          <StatCard
            title="Unique Players"
            value={stats?.gameplay.uniquePlayersToday || 0}
            icon={null}
            color="yellow"
          />
          <StatCard
            title="Avg Crash"
            value={`${stats?.gameplay.avgCrashToday || 0}x`}
            icon={null}
            color="red"
          />
        </div>
      </div>

      {
}
      <div>
        <h3 className="text-lg font-semibold mb-3">Economy Statistics</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            title="Wagered Today"
            value={`${parseInt(stats?.economy.totalWageredToday || 0).toLocaleString()} pts`}
            icon={null}
            color="blue"
          />
          <StatCard
            title="Won Today"
            value={`${parseInt(stats?.economy.totalWonToday || 0).toLocaleString()} pts`}
            icon={null}
            color="green"
          />
          <StatCard
            title="House Edge"
            value={`${parseInt(stats?.economy.houseEdgeToday || 0).toLocaleString()} pts`}
            subtitle={`${stats?.economy.houseEdgePercent || 0}%`}
            icon={null}
            color="yellow"
          />
          <StatCard
            title="Referral Conv."
            value={`${stats?.referrals.conversionRate || 0}%`}
            subtitle={`${stats?.referrals.activatedToday || 0} activated`}
            icon={null}
            color="purple"
          />
        </div>
      </div>
    </div>
  );
};

export default AdminStats;
