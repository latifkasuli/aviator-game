import React, { useState, useEffect } from 'react';
import authService from './services/authService.js';

const RanksPanel = ({ isOpen, onClose }) => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardType, setLeaderboardType] = useState('balance');
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setCurrentUser(authService.getUser());
      loadLeaderboard();
    }
  }, [isOpen, leaderboardType]);

  const loadLeaderboard = async () => {
    setIsLoading(true);
    try {
      const result = await authService.getLeaderboard(leaderboardType, 20);
      if (result.success) {
        setLeaderboard(result.leaderboard);
      }
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatValue = (value, type) => {
    switch (type) {
      case 'balance':
      case 'totalWon':
        return `${value.toFixed(0)} pts`;
      case 'winRate':
        return `${value}%`;
      default:
        return value;
    }
  };

  const getValueForType = (player) => {
    switch (leaderboardType) {
      case 'balance':
        return player.balance;
      case 'totalWon':
        return player.totalWon;
      case 'winRate':
        return player.winRate;
      default:
        return player.balance;
    }
  };

  const getRankIcon = (position) => {
    switch (position) {
      case 1: return '1st';
      case 2: return '2nd';
      case 3: return '3rd';
      default: return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Leaderboard</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
            </svg>
          </button>
        </div>

        <div className="p-4">
          <div className="flex space-x-2 mb-6">
            {[
              { key: 'balance', label: 'Richest', icon: null },
              { key: 'totalWon', label: 'Top Winners', icon: null },
              { key: 'winRate', label: 'Best Win Rate', icon: null }
            ].map(type => (
              <button
                key={type.key}
                onClick={() => setLeaderboardType(type.key)}
                className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  leaderboardType === type.key
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {type.icon && <span className="mr-2">{type.icon}</span>}
                {type.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-gray-400">
              Loading leaderboard...
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No players on leaderboard yet
            </div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((player, index) => {
                const isCurrentUser = currentUser?.id === player.id;
                const rankIcon = getRankIcon(index + 1);
                
                return (
                  <div
                    key={player.id}
                    className={`
                      flex items-center justify-between p-4 rounded-lg transition-all
                      ${isCurrentUser 
                        ? 'bg-blue-900 bg-opacity-30 border border-blue-600' 
                        : 'bg-gray-800 hover:bg-gray-750'
                      }
                    `}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`
                        w-10 h-10 rounded-full flex items-center justify-center font-bold
                        ${index < 3 ? 'text-xl' : 'bg-gray-700 text-sm'}
                      `}>
                        {rankIcon || index + 1}
                      </div>
                      <div>
                        <div className="font-semibold text-white flex items-center">
                          {player.username}
                          {isCurrentUser && (
                            <span className="ml-2 text-xs text-blue-400">(You)</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400">
                          {player.gamesPlayed} games played
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className={`font-bold ${
                        index === 0 ? 'text-yellow-400' :
                        index === 1 ? 'text-gray-300' :
                        index === 2 ? 'text-orange-400' :
                        'text-white'
                      }`}>
                        {formatValue(getValueForType(player), leaderboardType)}
                      </div>
                      {leaderboardType === 'winRate' && (
                        <div className="text-xs text-gray-400">
                          {player.totalWon.toFixed(0)} pts won
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {leaderboardType === 'winRate' && (
            <div className="mt-4 text-xs text-gray-500 text-center">
              * Minimum 10 games required for win rate leaderboard
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RanksPanel;
