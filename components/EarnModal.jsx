// 🎮 EarnModal.jsx - Daily Quest System Modal
// Complete earn system with daily login, bets, wins, referrals, and more!

import React, { useState, useEffect } from 'react';
import authService from './services/authService.js';

const EarnModal = ({ isOpen, onClose }) => {
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claimingQuest, setClaimingQuest] = useState(null);
  const [playSession, setPlaySession] = useState(null);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Quest icons mapping
  const questIcons = {
    DAILY_LOGIN: '📅',
    PLACE_BETS: '🎲',
    WIN_ROUNDS: '🏆',
    REACH_MULTIPLIER: '🚀',
    PLAY_TIME: '⏰',
    REFER_PLAYER: '👥',
    SHARE_GAME: '📤',
    WEEKLY_STREAK: '🔥'
  };

  // Quest colors for progress bars
  const questColors = {
    DAILY_LOGIN: 'bg-green-500',
    PLACE_BETS: 'bg-blue-500', 
    WIN_ROUNDS: 'bg-yellow-500',
    REACH_MULTIPLIER: 'bg-purple-500',
    PLAY_TIME: 'bg-orange-500',
    REFER_PLAYER: 'bg-pink-500',
    SHARE_GAME: 'bg-cyan-500',
    WEEKLY_STREAK: 'bg-red-500'
  };

  // Load quests when modal opens
  useEffect(() => {
    if (isOpen) {
      const token = authService.getToken();
      setIsAuthenticated(!!token);
      
      if (token) {
        loadQuests();
        startPlaySession();
      } else {
        setLoading(false);
      }
    }
  }, [isOpen]);

  // Cleanup play session when modal closes
  useEffect(() => {
    return () => {
      if (playSession) {
        endPlaySession();
      }
    };
  }, []);

  const loadQuests = async () => {
    try {
      setLoading(true);
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3002';
      const response = await fetch(`${backendUrl}/api/quests`, {
        headers: {
          'Authorization': `Bearer ${authService.getToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setQuests(data.quests);
        setError(null);
      } else {
        throw new Error(data.error || 'Failed to load quests');
      }
    } catch (error) {
      console.error('❌ Failed to load quests:', error);
      setError('Failed to load daily quests');
    } finally {
      setLoading(false);
    }
  };

  const claimQuest = async (questId) => {
    try {
      setClaimingQuest(questId);
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3002';
      
      const response = await fetch(`${backendUrl}/api/quests/${questId}/claim`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authService.getToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        // Show success popup
        const popup = document.createElement('div');
        popup.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-bounce';
        popup.innerHTML = `
          <div class="flex items-center space-x-2">
            <span class="text-xl">🎉</span>
            <span class="font-bold">+${data.rewardPoints} pts!</span>
          </div>
        `;
        document.body.appendChild(popup);
        
        setTimeout(() => {
          document.body.removeChild(popup);
        }, 3000);

        // Reload quests to update status
        await loadQuests();
      } else {
        throw new Error(data.error || 'Failed to claim quest');
      }
    } catch (error) {
      console.error('❌ Failed to claim quest:', error);
      alert(`Failed to claim quest: ${error.message}`);
    } finally {
      setClaimingQuest(null);
    }
  };

  const shareGame = async () => {
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3002';
      // Record the share action
      const response = await fetch(`${backendUrl}/api/quests/share`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authService.getToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        console.log('📤 Share recorded successfully');
        await loadQuests(); // Reload to update quest progress
      }

      // Try native sharing first
      if (navigator.share) {
        await navigator.share({
          title: 'Aviator Game',
          text: 'Join me in this exciting crash game!',
          url: window.location.origin
        });
      } else if (window.Telegram?.WebApp?.openTelegramLink) {
        // Telegram share
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(window.location.origin)}&text=${encodeURIComponent('Join me in this exciting Aviator game!')}`;
        window.Telegram.WebApp.openTelegramLink(shareUrl);
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(window.location.origin);
        alert('Game link copied to clipboard!');
      }
    } catch (error) {
      console.error('❌ Failed to share game:', error);
    }
  };

  const startPlaySession = async () => {
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3002';
      const response = await fetch(`${backendUrl}/api/play-session/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authService.getToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setPlaySession(data.sessionId);
          console.log('⏰ Play session started:', data.sessionId);
        }
      }
    } catch (error) {
      console.error('❌ Failed to start play session:', error);
    }
  };

  const endPlaySession = async () => {
    if (!playSession) return;

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3002';
      const response = await fetch(`${backendUrl}/api/play-session/end`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authService.getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sessionId: playSession })
      });

      if (response.ok) {
        console.log('⏰ Play session ended:', playSession);
        setPlaySession(null);
      }
    } catch (error) {
      console.error('❌ Failed to end play session:', error);
    }
  };

  const formatTimeRemaining = (validUntil) => {
    const now = new Date();
    const end = new Date(validUntil);
    const diff = end - now;
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  // Show login required message for guests
  if (!isAuthenticated && !loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center p-6">
          <div className="text-yellow-400 text-6xl mb-4">🔐</div>
          <h2 className="text-xl font-bold text-white mb-2">Login Required</h2>
          <p className="text-gray-400 mb-4">You need to login to access daily quests and earn rewards!</p>
          <div className="text-sm text-gray-500">
            <p>🎯 Login to unlock:</p>
            <p>• Daily login rewards (100pts)</p>
            <p>• Quest system (up to 2,350pts/day)</p>
            <p>• Weekly streak bonuses (1,000pts)</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400 mx-auto mb-2"></div>
          <div className="text-gray-400">Loading daily quests...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-400 text-4xl mb-2">❌</div>
          <div className="text-red-400 mb-4">{error}</div>
          <button 
            onClick={loadQuests}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Don't render if modal is not open
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header with close button */}
        <div className="flex items-center justify-between mb-6">
          <div className="text-center flex-1">
            <h2 className="text-2xl font-bold text-white mb-1">🎯 Daily Quests</h2>
            <p className="text-gray-400 text-sm">Complete tasks to earn points!</p>
          </div>
          <button 
            onClick={onClose}
            className="ml-4 text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {/* Quest List */}
        <div className="space-y-3">
        {quests.map((quest) => (
          <div
            key={quest.id}
            className="bg-gray-800 rounded-lg p-4 border border-gray-700"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{questIcons[quest.questType] || '⭐'}</span>
                <div>
                  <h3 className="font-semibold text-white">{quest.description}</h3>
                  <p className="text-sm text-gray-400">
                    {quest.currentValue}/{quest.targetValue} • {quest.rewardPoints} pts
                  </p>
                </div>
              </div>
              
              {quest.isClaimed ? (
                <div className="bg-green-600 text-white px-3 py-1 rounded-full text-xs font-medium">
                  ✅ Claimed
                </div>
              ) : quest.isCompleted ? (
                <button
                  onClick={() => claimQuest(quest.id)}
                  disabled={claimingQuest === quest.id}
                  className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50"
                >
                  {claimingQuest === quest.id ? '...' : 'Claim'}
                </button>
              ) : (
                <div className="text-gray-500 text-xs">
                  {formatTimeRemaining(quest.validUntil)}
                </div>
              )}
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${questColors[quest.questType] || 'bg-gray-500'}`}
                style={{ width: `${Math.min(quest.progress * 100, 100)}%` }}
              ></div>
            </div>

            {/* Special Actions */}
            {quest.questType === 'SHARE_GAME' && !quest.isCompleted && (
              <button
                onClick={shareGame}
                className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm"
              >
                📤 Share Game
              </button>
            )}
          </div>
        ))}
        </div>

        {quests.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            <div className="text-4xl mb-2">🎯</div>
            <p>No active quests available</p>
            <button 
              onClick={loadQuests}
              className="mt-2 text-blue-400 hover:text-blue-300 underline"
            >
              Refresh
            </button>
          </div>
        )}

        {/* Info Footer */}
        <div className="text-center text-xs text-gray-500 border-t border-gray-700 pt-4 mt-6">
          <p>Quests reset daily at midnight UTC</p>
          <p>Keep playing to unlock more rewards!</p>
          {playSession && (
            <p className="text-green-400 mt-1">⏰ Play session active</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default EarnModal;