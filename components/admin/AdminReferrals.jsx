import React, { useState, useEffect } from 'react';
import authService from '../services/authService.js';

const AdminReferrals = () => {
  const [referrals, setReferrals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [processingId, setProcessingId] = useState(null);

  const loadReferrals = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page,
        limit: 20,
        ...(statusFilter && { status: statusFilter })
      });
      
      const response = await authService.apiRequest(`/admin/referrals?${params}`);
      if (response.success) {
        setReferrals(response.referrals);
        setTotalPages(response.totalPages);
        setError('');
      } else {
        setError('Failed to load referrals');
      }
    } catch (err) {
      setError(err.message || 'Failed to load referrals');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReferrals();
  }, [page, statusFilter]);

  const handleApprove = async (referralId) => {
    if (!confirm('Are you sure you want to approve this referral?')) return;
    
    try {
      setProcessingId(referralId);
      const response = await authService.apiRequest(`/admin/referrals/${referralId}/approve`, {
        method: 'POST'
      });
      
      if (response.success) {
        loadReferrals();
        if (window.Telegram?.WebApp?.showAlert) {
          window.Telegram.WebApp.showAlert('Referral approved successfully');
        }
      }
    } catch (err) {
      console.error('Approve error:', err);
      alert('Failed to approve referral: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (referralId) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    
    try {
      setProcessingId(referralId);
      const response = await authService.apiRequest(`/admin/referrals/${referralId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
      
      if (response.success) {
        loadReferrals();
        if (window.Telegram?.WebApp?.showAlert) {
          window.Telegram.WebApp.showAlert('Referral rejected');
        }
      }
    } catch (err) {
      console.error('Reject error:', err);
      alert('Failed to reject referral: ' + err.message);
    } finally {
      setProcessingId(null);
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

  const getStatusBadge = (status) => {
    const badges = {
      PENDING: 'bg-yellow-900 text-yellow-300',
      APPROVED: 'bg-blue-900 text-blue-300',
      REJECTED: 'bg-red-900 text-red-300',
      PAID: 'bg-green-900 text-green-300'
    };
    return badges[status] || 'bg-gray-900 text-gray-300';
  };

  return (
    <div className="space-y-6">
      {
}
      <div>
        <h2 className="text-2xl font-bold text-white mb-4">Referral Management</h2>
        
        {
}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setStatusFilter('')}
            className={`px-4 py-2 rounded ${
              statusFilter === '' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            All
          </button>
          {['PENDING', 'APPROVED', 'REJECTED', 'PAID'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded ${
                statusFilter === status 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {status}
            </button>
          ))}
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
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Referrer</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Invitee</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Code</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Created</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Activated</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Notes</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {referrals.map((referral) => (
                  <tr key={referral.id} className="hover:bg-gray-700 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-white">{referral.referrer?.username || 'Unknown'}</p>
                        <p className="text-xs text-gray-400">{referral.referrer?.email || 'Telegram'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-white">{referral.invitee?.username || 'Unknown'}</p>
                        <p className="text-xs text-gray-400">{referral.invitee?.email || 'Telegram'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm text-white">{referral.referralCode}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded ${getStatusBadge(referral.referrerRewardStatus)}`}>
                        {referral.referrerRewardStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {formatDate(referral.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {referral.activationEventAt ? formatDate(referral.activationEventAt) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {referral.notes && (
                        <span className="text-sm text-gray-300" title={referral.notes}>
                          {referral.notes.length > 30 
                            ? referral.notes.substring(0, 30) + '...' 
                            : referral.notes}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {referral.referrerRewardStatus === 'PENDING' && (
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => handleApprove(referral.id)}
                            disabled={processingId === referral.id}
                            className={`px-2 py-1 text-xs rounded ${
                              processingId === referral.id
                                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                : 'bg-green-600 hover:bg-green-700 text-white'
                            }`}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(referral.id)}
                            disabled={processingId === referral.id}
                            className={`px-2 py-1 text-xs rounded ${
                              processingId === referral.id
                                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                : 'bg-red-600 hover:bg-red-700 text-white'
                            }`}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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

export default AdminReferrals;
