import React, { useState, useEffect } from 'react';
import authService from '../services/authService.js';

const AdminAuditLog = () => {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    action: '',
    targetType: '',
    adminUserId: '',
    startDate: '',
    endDate: ''
  });

  const loadAuditLogs = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page,
        limit: 50,
        ...Object.entries(filters).reduce((acc, [key, value]) => {
          if (value) acc[key] = value;
          return acc;
        }, {})
      });
      
      const response = await authService.apiRequest(`/admin/audit-logs?${params}`);
      if (response.success) {
        setLogs(response.logs);
        setTotalPages(response.totalPages);
        setError('');
      } else {
        setError('Failed to load audit logs');
      }
    } catch (err) {
      setError(err.message || 'Failed to load audit logs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, [page, filters]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getActionColor = (action) => {
    if (action.includes('BAN')) return 'text-red-400';
    if (action.includes('UNBAN')) return 'text-green-400';
    if (action.includes('BALANCE')) return 'text-yellow-400';
    if (action.includes('REFERRAL')) return 'text-purple-400';
    return 'text-blue-400';
  };

  const actionOptions = [
    'USER_BALANCE_ADJUST',
    'USER_BAN',
    'USER_UNBAN',
    'REFERRAL_APPROVE',
    'REFERRAL_REJECT',
    'PLAYER_SETTINGS_UPDATE',
    'CHANGE_REQUEST_CREATE'
  ];

  const targetTypeOptions = ['USER', 'REFERRAL', 'ROUND', 'SYSTEM'];

  return (
    <div className="space-y-6">
      {
}
      <div>
        <h2 className="text-2xl font-bold text-white mb-4">Audit Log</h2>
        
        {
}
        <div className="bg-gray-800 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <select
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
            >
              <option value="">All Actions</option>
              {actionOptions.map(action => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>

            <select
              value={filters.targetType}
              onChange={(e) => handleFilterChange('targetType', e.target.value)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
            >
              <option value="">All Target Types</option>
              {targetTypeOptions.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>

            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
              placeholder="Start Date"
            />

            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
              placeholder="End Date"
            />

            <button
              onClick={() => {
                setFilters({
                  action: '',
                  targetType: '',
                  adminUserId: '',
                  startDate: '',
                  endDate: ''
                });
                setPage(1);
              }}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {
}
      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      )}

      {
}
      {error && (
        <div className="bg-red-900 bg-opacity-50 border border-red-600 rounded-lg p-4">
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {
}
      {!isLoading && !error && (
        <>
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`font-semibold ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                      <span className="text-sm text-gray-400">
                        on {log.targetType} {log.targetId.slice(0, 8)}...
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span>By {log.adminUser?.username || 'Unknown'}</span>
                      <span>{formatDate(log.createdAt)}</span>
                      {log.ip && <span>IP: {log.ip}</span>}
                    </div>

                    {log.notes && (
                      <p className="mt-2 text-sm text-gray-300">
                        Notes: {log.notes}
                      </p>
                    )}

                    {
}
                    {log.action === 'USER_BALANCE_ADJUST' && log.before && log.after && (
                      <div className="mt-2 text-sm">
                        <span className="text-gray-400">Balance: </span>
                        <span className="text-red-400">{parseFloat(log.before.balance).toLocaleString()}</span>
                        <span className="text-gray-400"> → </span>
                        <span className="text-green-400">{parseFloat(log.after.balance).toLocaleString()}</span>
                        <span className="text-gray-400"> pts</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {logs.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              No audit logs found for the selected filters
            </div>
          )}

          {
}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className={`px-4 py-2 rounded ${
                  page === 1
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                Previous
              </button>
              <span className="px-4 py-2 text-white">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className={`px-4 py-2 rounded ${
                  page === totalPages
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminAuditLog;
