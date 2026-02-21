import React, { useState, useEffect, useCallback } from 'react';
import authService from './services/authService.js';

const WorkPanel = ({ isOpen, onClose }) => {
  const [farmingStatus, setFarmingStatus] = useState({
    canClaim: false,
    lastClaimedAt: null,
    nextClaimTime: null,
    hoursElapsed: 0,
    pointsAvailable: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [user, setUser] = useState(authService.getUser());
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const formatCompact = (num) => {
    if (!num) return '0';
    const n = Number(num);
    if (n >= 1000000) {
      return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (n >= 1000) {
      return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return n.toLocaleString();
  };

  const loadFarmingStatus = useCallback(async () => {
    try {
      const result = await authService.getFarmingStatus();
      if (result.success) {
        setFarmingStatus(result);
      }
    } catch (error) {
      console.error('Failed to load farming status:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleClaim = async () => {
    if (!farmingStatus.canClaim || isClaiming) return;

    setIsClaiming(true);
    setError('');
    try {
      const result = await authService.claimFarmingPoints();
      
      if (result.success) {
        const updatedUser = authService.getUser();
        setUser(updatedUser);
        
        window.dispatchEvent(new CustomEvent('balanceUpdated', { 
          detail: { balance: updatedUser?.balance } 
        }));
        
        await loadFarmingStatus();

        const points = farmingStatus.rewardPoints || 6000;
        setSuccess(`Successfully claimed ${points.toLocaleString()} points!`);
        setTimeout(() => setSuccess(''), 3000);

        if (window.Telegram?.WebApp?.HapticFeedback) {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
      } else {
        setError(result.error || 'Failed to claim points. Please try again.');
        if (window.Telegram?.WebApp?.HapticFeedback) {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
        }
      }
    } catch (error) {
      console.error('Claim error:', error);
      setError(error.message === 'Network error' ? 'Network error. Please check your connection.' : 'Failed to claim points. Please try again.');
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
      }
    } finally {
      setIsClaiming(false);
    }
  };

  useEffect(() => {
    if (!farmingStatus.nextClaimTime || farmingStatus.canClaim) {
      setTimeRemaining('');
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const next = new Date(farmingStatus.nextClaimTime);
      const diff = next - now;

      if (diff <= 0) {
        setTimeRemaining('Ready to claim!');
        loadFarmingStatus();
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [farmingStatus.nextClaimTime, farmingStatus.canClaim, loadFarmingStatus]);

  useEffect(() => {
    if (isOpen) {
      loadFarmingStatus();
      const currentUser = authService.getUser();
      setUser(currentUser);
    }
  }, [isOpen, loadFarmingStatus]);

  useEffect(() => {
    const handleBalanceUpdate = (event) => {
      const currentUser = authService.getUser();
      setUser(currentUser);
    };

    window.addEventListener('balanceUpdated', handleBalanceUpdate);
    window.addEventListener('authStateChanged', handleBalanceUpdate);

    return () => {
      window.removeEventListener('balanceUpdated', handleBalanceUpdate);
      window.removeEventListener('authStateChanged', handleBalanceUpdate);
    };
  }, []);

  if (!isOpen) return null;

  const cycleHours = farmingStatus.cycleHours || 6;
  const progressPercentage = Math.min((farmingStatus.hoursElapsed / cycleHours) * 100, 100);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg w-full max-w-md max-h-[90vh] overflow-hidden">
        {
}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Work & Earn</h2>
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
        <div className="p-6">
          {
}
          <div className="text-center mb-6">
            <div className="text-gray-400 text-sm">Current Balance</div>
            <div className="text-3xl font-bold text-yellow-400">
              {user ? formatCompact(user.balance) : '0'} pts
            </div>
          </div>

          {
}
          {error && (
            <div className="mb-4 p-3 bg-red-900 bg-opacity-30 border border-red-700 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-900 bg-opacity-30 border border-green-700 rounded-lg text-green-400 text-sm">
              {success}
            </div>
          )}

          {
}
          <div className="bg-gray-800 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Points Farming</h3>
              <div className="text-yellow-400 font-bold">
                +{formatCompact(farmingStatus.rewardPoints || 6000)} pts
              </div>
            </div>

            {
}
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-400 mb-2">
                <span>Progress</span>
                <span>{progressPercentage.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-yellow-400 to-yellow-600 h-full transition-all duration-500"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>

            {
}
            <div className="text-center mb-4">
              {farmingStatus.canClaim ? (
                <div className="text-green-400 font-semibold text-lg">
                  Ready to claim {(farmingStatus.rewardPoints || 6000).toLocaleString()} points!
                </div>
              ) : (
                <div>
                  <div className="text-gray-400 text-sm">Next claim in</div>
                  <div className="text-white font-mono text-xl">
                    {timeRemaining || 'Loading...'}
                  </div>
                </div>
              )}
            </div>

            {
}
            <button
              onClick={handleClaim}
              disabled={!farmingStatus.canClaim || isClaiming}
              className={`w-full py-3 rounded-lg font-semibold transition-all ${
                farmingStatus.canClaim && !isClaiming
                  ? 'bg-yellow-500 hover:bg-yellow-600 text-gray-900 transform hover:scale-[1.02]'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isClaiming ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Claiming...
                </span>
              ) : farmingStatus.canClaim ? (
                `Claim ${(farmingStatus.rewardPoints || 6000).toLocaleString()} Points`
              ) : (
                'Farming in Progress'
              )}
            </button>
          </div>

          {
}
          <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg p-4">
            <h4 className="text-blue-400 font-semibold mb-2">How it works:</h4>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• Earn {(farmingStatus.rewardPoints || 6000).toLocaleString()} points every {farmingStatus.cycleHours || 6} hours</li>
              <li>• Must claim to start next cycle</li>
              <li>• Points don't accumulate if not claimed</li>
              <li>• Check back regularly to maximize earnings!</li>
            </ul>
          </div>

          {
}
          {farmingStatus.lastClaimedAt && (
            <div className="mt-4 text-center text-sm text-gray-500">
              Last claimed: {new Date(farmingStatus.lastClaimedAt).toLocaleString()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkPanel;
