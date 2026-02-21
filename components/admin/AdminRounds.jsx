import React, { useState, useEffect } from 'react';
import authService from '../services/authService.js';

const AdminRounds = () => {
  const [rounds, setRounds] = useState([]);
  const [selectedRound, setSelectedRound] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadRounds = async () => {
    try {
      setIsLoading(true);
      const response = await authService.apiRequest(`/admin/game-rounds?page=${page}&limit=20`);
      if (response.success) {
        setRounds(response.rounds.rounds);
        setTotalPages(response.rounds.totalPages);
        setError('');
      } else {
        setError('Failed to load rounds');
      }
    } catch (err) {
      setError(err.message || 'Failed to load rounds');
    } finally {
      setIsLoading(false);
    }
  };

  const loadRoundDetails = async (roundId) => {
    try {
      const response = await authService.apiRequest(`/admin/game-rounds/${roundId}`);
      if (response.success) {
        setSelectedRound(response.round);
      }
    } catch (err) {
      console.error('Failed to load round details:', err);
    }
  };

  useEffect(() => {
    loadRounds();
  }, [page]);

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

  const getStatusColor = (status) => {
    switch (status) {
      case 'CRASHED': return 'text-red-400';
      case 'IN_PROGRESS': return 'text-yellow-400';
      case 'PENDING': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  if (selectedRound) {
    return (
      <div className="space-y-6">
        {
}
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setSelectedRound(null)} 
            className="text-blue-400 hover:text-blue-300"
          >
            ← Back to Rounds
          </button>
          <h2 className="text-2xl font-bold text-white">Round Details</h2>
          <div className="w-24"></div>
        </div>

        {
}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Round Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-gray-400 text-sm">Round ID</p>
              <p className="text-white font-mono">{selectedRound.id}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Status</p>
              <p className={`font-medium ${getStatusColor(selectedRound.status)}`}>
                {selectedRound.status}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Crash Point</p>
              <p className="text-white font-bold text-xl">{selectedRound.crashPoint}x</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Created At</p>
              <p className="text-white">{formatDate(selectedRound.createdAt)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Server Seed Hash</p>
              <p className="text-white font-mono text-xs break-all">{selectedRound.serverSeedHash}</p>
            </div>
            {selectedRound.serverSeed && (
              <div>
                <p className="text-gray-400 text-sm">Server Seed (Revealed)</p>
                <p className="text-white font-mono text-xs break-all">{selectedRound.serverSeed}</p>
              </div>
            )}
            <div>
              <p className="text-gray-400 text-sm">Client Seed</p>
              <p className="text-white font-mono text-xs">{selectedRound.clientSeed}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Nonce</p>
              <p className="text-white">{selectedRound.nonce}</p>
            </div>
          </div>
        </div>

        {
}
        {selectedRound.bets && selectedRound.bets.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">
              Bets ({selectedRound.bets.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-400">Player</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-400">Amount</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-400">Cashout</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-400">Payout</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {selectedRound.bets.map((bet) => (
                    <tr key={bet.id}>
                      <td className="px-4 py-2">
                        <p className="text-white">{bet.user?.username || 'Unknown'}</p>
                      </td>
                      <td className="px-4 py-2 text-white">
                        {parseFloat(bet.amount).toLocaleString()} pts
                      </td>
                      <td className="px-4 py-2 text-white">
                        {bet.cashedOutAt ? `${bet.cashedOutAt}x` : '-'}
                      </td>
                      <td className="px-4 py-2">
                        {bet.payout ? (
                          <span className="text-green-400">
                            +{parseFloat(bet.payout).toLocaleString()} pts
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-sm ${
                          bet.status === 'WON' ? 'text-green-400' : 
                          bet.status === 'LOST' ? 'text-red-400' : 
                          'text-yellow-400'
                        }`}>
                          {bet.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {
}
      <div>
        <h2 className="text-2xl font-bold text-white mb-4">Game Rounds</h2>
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
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Round ID</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Crash Point</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Bets</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Total Wagered</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Total Payout</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Created</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {rounds.map((round) => (
                  <tr key={round.id} className="hover:bg-gray-700 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-white font-mono text-sm">{round.id.slice(0, 8)}...</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-white font-bold">{round.crashPoint}x</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${getStatusColor(round.status)}`}>
                        {round.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white">
                      {round.betCount || 0}
                    </td>
                    <td className="px-4 py-3 text-white">
                      {parseFloat(round.totalWagered || 0).toLocaleString()} pts
                    </td>
                    <td className="px-4 py-3">
                      <span className={round.totalPayout > 0 ? 'text-red-400' : 'text-gray-400'}>
                        {parseFloat(round.totalPayout || 0).toLocaleString()} pts
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {formatDate(round.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => loadRoundDetails(round.id)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
                      >
                        View Details
                      </button>
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

export default AdminRounds;
