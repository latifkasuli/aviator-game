import React, { useEffect, useState } from 'react';
import { useGameBackend } from './hooks/useGameBackend';

const UpdateChecker = () => {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [checking, setChecking] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const { gameState, hasActiveBet } = useGameBackend();
  
  const isDev = window.location.hostname === 'localhost' || 
                window.location.hostname === '127.0.0.1';
  
  const isTestingEnv = import.meta.env.VITE_ENABLE_AUTO_UPDATE === 'true' ||
                       (window.location.hostname.includes('aviator-game') && 
                        window.location.hostname.includes('vercel.app'));
  
  const isEnabled = !isDev && isTestingEnv;

  const checkForUpdates = async () => {
    if (!isEnabled) return;
    
    try {
      setChecking(true);
      const response = await fetch(`/version.json?t=${Date.now()}`);
      const serverVersion = await response.json();
      
      const storedVersion = localStorage.getItem('app-version');
      
      if (storedVersion && storedVersion !== serverVersion.buildTime) {
        const gameState = window.gameState || {};
        if (gameState.activeBet || gameState.state === 'running') {
          setTimeout(checkForUpdates, 60000);
          return;
        }
        setHasUpdate(true);
      } else if (!storedVersion) {
        localStorage.setItem('app-version', serverVersion.buildTime);
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (!isEnabled) return;
    
    checkForUpdates();
    
    const interval = setInterval(checkForUpdates, 120000);
    
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkForUpdates();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    const handleGameStart = () => {
      clearInterval(interval);
    };
    const handleGameEnd = () => {
      checkForUpdates();
    };
    
    window.addEventListener('gameStart', handleGameStart);
    window.addEventListener('gameEnd', handleGameEnd);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('gameStart', handleGameStart);
      window.removeEventListener('gameEnd', handleGameEnd);
    };
  }, [isDev]);

  const handleUpdate = () => {
    try {
      if (window.betHistoryService) {
        window.betHistoryService.saveToLocalStorage();
      }
    } catch (e) {
      console.error('Failed to save data before update:', e);
    }
    
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    
    localStorage.setItem('app-version', 'updating');
    
    if (window.Telegram?.WebApp) {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('warning');
      
      setCountdown(3);
      const countdownInterval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            window.location.href = window.location.href.split('?')[0] + '?v=' + Date.now();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (confirm('New version available! Reload now?')) {
        window.location.reload(true);
      }
    }
  };

  const handleDismiss = () => {
    setHasUpdate(false);
    setTimeout(checkForUpdates, 300000);
  };

  const showDebug = window.location.search.includes('debug=updates');
  
  if (showDebug && !hasUpdate) {
    return (
      <div className="fixed bottom-2 right-2 bg-gray-800 text-white p-2 rounded text-xs opacity-50">
        Auto-update: {isEnabled ? 'ON' : 'OFF'}
      </div>
    );
  }

  if (!hasUpdate || !isEnabled) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-green-600 to-green-700 text-white p-2 text-center">
      <div className="flex items-center justify-center gap-2">
        <span className="text-sm font-medium">
          {countdown !== null 
            ? `Updating in ${countdown}...` 
            : 'New version available!'}
        </span>
        {countdown === null && (
          <>
            <button
              onClick={handleUpdate}
              disabled={checking}
              className="px-3 py-1 bg-white text-green-700 rounded-full text-xs font-bold hover:bg-gray-100 transition-colors"
            >
              Update Now
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 py-1 bg-green-800 text-white rounded-full text-xs font-bold hover:bg-green-900 transition-colors"
            >
              Later
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default UpdateChecker;
