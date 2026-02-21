import React, { useState, useEffect, useMemo, useCallback } from 'react';
import BetPanel from './components/BetPanel.jsx';
import AviatorGameStandalone from './components/AviatorGameStandalone.jsx';
import HistoryItem from './components/HistoryItem.jsx';
import BottomNav from './components/BottomNav.jsx';
import BackendTest from './components/BackendTest.jsx';
import NotificationSystem from './components/NotificationSystem.jsx';
import AuthModal from './components/AuthModal.jsx';
import AdminLoginModal from './components/AdminLoginModal.jsx';
import UserProfile from './components/UserProfile.jsx';
import RanksPanel from './components/RanksPanel.jsx';
import FairnessPage from './components/FairnessPage.jsx';
import WorkPanel from './components/WorkPanel.jsx';
import FriendsPanel from './components/FriendsPanel.jsx';
import EarnTab from './components/EarnTab.jsx';
import AdminDashboard from './components/admin/AdminDashboard.jsx';
import { useGameBackend } from './components/hooks/useGameBackend.js';
import soundEffects from './components/utils/soundEffects.js';
import authService from './components/services/authService.js';
import gameService from './components/services/gameService.js';
import TelegramWebApp, { useTelegramWebApp, TelegramThemeStyles } from './components/TelegramWebApp.jsx';
import UpdateChecker from './components/UpdateChecker.jsx';
import { initPerformanceGovernor } from './state/performanceGovernor.js';

function App() {
  const { user: telegramUser } = useTelegramWebApp();

  const {
    isConnected,
    gameState,
    multiplier,
    countdown,
    playerBalance,
    hasActiveBet,
    activeBetAmount,
    cashedOut,
    cashedOutMultiplier,
    crashHistory,
    placeBet,
    cashOut
  } = useGameBackend();

  const [betAmount, setBetAmount] = useState(100);
  const [showBackendTest, setShowBackendTest] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showRanksPanel, setShowRanksPanel] = useState(false);
  const [activeNavTab, setActiveNavTab] = useState('Play');
  const [showFairnessPage, setShowFairnessPage] = useState(false);
  const [showWorkPanel, setShowWorkPanel] = useState(false);
  const [showFriendsPanel, setShowFriendsPanel] = useState(false);
  const [showEarnPanel, setShowEarnPanel] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [prevGameState, setPrevGameState] = useState(gameState);
  const [prevCountdown, setPrevCountdown] = useState(countdown);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [performanceInitialized, setPerformanceInitialized] = useState(false);
  const [cashoutTrigger, setCashoutTrigger] = useState({ timestamp: 0, isMe: true });

  useEffect(() => {
    try {
      initPerformanceGovernor();
      setPerformanceInitialized(true);
    } catch (error) {
      console.error('Failed to initialize performance governor:', error);
      setPerformanceInitialized(true);
    }
  }, []);

  const setGameHeight = useCallback(() => {
    const vh = window.innerHeight;
    const header = document.querySelector('.app-header')?.offsetHeight || 0;
    const history = document.querySelector('.app-history-strip')?.offsetHeight || 0;
    const bet = document.querySelector('.app-bet-panel')?.offsetHeight || 0;
    const nav = document.querySelector('[data-bottom-nav]')?.offsetHeight || 0;

    const gameH = Math.max(240, vh - header - history - bet - nav);
    document.documentElement.style.setProperty('--game-h', `${gameH}px`);
  }, []);

  useEffect(() => {
    setTimeout(setGameHeight, 100);
    window.addEventListener('resize', setGameHeight);
    window.addEventListener('orientationchange', setGameHeight);
    
    return () => {
      window.removeEventListener('resize', setGameHeight);
      window.removeEventListener('orientationchange', setGameHeight);
    };
  }, [setGameHeight]);

  useEffect(() => {
    setTimeout(setGameHeight, 50);
  }, [gameState, setGameHeight]);

  useEffect(() => {
    const initSounds = async () => {
      await soundEffects.init();
      document.removeEventListener('click', initSounds);
      document.removeEventListener('touchstart', initSounds);
    };

    document.addEventListener('click', initSounds);
    document.addEventListener('touchstart', initSounds);

    return () => {
      document.removeEventListener('click', initSounds);
      document.removeEventListener('touchstart', initSounds);
    };
  }, []);

  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const avatarUrl = useMemo(() => {
    if (telegramUser?.photo_url) return telegramUser.photo_url;
    if (user?.avatar) return user.avatar;
    const seed = telegramUser?.username || telegramUser?.first_name || user?.username || 'Guest';
    return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}&backgroundType=gradientLinear`;
  }, [telegramUser, user]);

  const displayName = useMemo(() => {
    return telegramUser?.first_name || user?.username || 'Guest';
  }, [telegramUser, user]);

  const displayUsername = useMemo(() => {
    return telegramUser?.username || user?.username || 'user';
  }, [telegramUser, user]);

  const addNotification = useCallback((notification) => {
    const id = Date.now() + Math.random();
    setNotifications(prev => [...prev, { ...notification, id }]);
  }, []);

  const dismissNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const formatCompactNumber = (num) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return num.toString();
  };

  const handleLogout = useCallback(async () => {
    try {
      await authService.logout();
      setIsAuthenticated(false);
      setUser(null);
      addNotification({ type: 'success', title: 'Logged out', message: 'You have been logged out', duration: 2000 });
    } finally {
      setShowUserMenu(false);
    }
  }, [addNotification]);

  useEffect(() => {
    let hasShownWelcome = false;

    const initializeAuth = () => {
      const isAuth = authService.isAuthenticated();
      const currentUser = authService.getUser();
      
      setIsAuthenticated(isAuth);
      setUser(currentUser);
      
      if (isAuth && currentUser && !hasShownWelcome) {
        hasShownWelcome = true;
        addNotification({
          type: 'success',
          title: 'Welcome back!',
          message: `Logged in as ${currentUser.username}`,
          duration: 3000
        });
      }
    };

    initializeAuth();

    const handleAuthChange = () => {
      const isAuth = authService.isAuthenticated();
      const currentUser = authService.getUser();
      
      if (isAuth !== isAuthenticated) {
        setIsAuthenticated(isAuth);
        setUser(currentUser);
        
        if (isAuth && currentUser) {
          if (!hasShownWelcome) {
            hasShownWelcome = true;
            addNotification({
              type: 'success',
              title: 'Welcome back!',
              message: `Logged in as ${currentUser.username}`,
              duration: 3000
            });
          }
          
          gameService.disconnect();
          gameService.connect();

          loadPlayerSettings();
        } else {
          setSettingsLoaded(false);
          hasShownWelcome = false;
        }
      } else if (isAuth && currentUser?.id !== user?.id) {
        setUser(currentUser);
        loadPlayerSettings();
      }
    };

    const handleStorageChange = (e) => {
      if (e.key === 'token' || e.key === 'user') {
        handleAuthChange();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    window.addEventListener('authStateChanged', handleAuthChange);

    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === '1' && !(authService.isAuthenticated() && authService.isAdmin())) {
      setShowAdminLogin(true);
    }
    
    const handleOpenUserProfile = (e) => {
      setShowUserProfile(true);
      if (e?.detail?.tab) {
        window.dispatchEvent(new CustomEvent('userProfileSetTab', { detail: { tab: e.detail.tab } }));
      }
    };
    window.addEventListener('openUserProfile', handleOpenUserProfile);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('authStateChanged', handleAuthChange);
      window.removeEventListener('openUserProfile', handleOpenUserProfile);
    };
  }, [addNotification, isAuthenticated, user]);

  useEffect(() => {
    const handleCashout = () => {
      setCashoutTrigger({ 
        timestamp: Date.now(), 
        isMe: true
      });
    };
    
    window.addEventListener('game:cashedOut', handleCashout);
    
    return () => {
      window.removeEventListener('game:cashedOut', handleCashout);
    };
  }, []);

  const loadPlayerSettings = useCallback(async () => {
    if (!authService.isAuthenticated() || settingsLoaded) return;
    
    try {
      const result = await authService.getPlayerSettings();
      if (result.success && result.settings) {
        setSoundEnabled(result.settings.soundEnabled);
        soundEffects.enabled = result.settings.soundEnabled;
        setSettingsLoaded(true);
      }
    } catch (error) {
      console.error('Failed to load player settings:', error);
    }
  }, [settingsLoaded]);

  useEffect(() => {
    if (isAuthenticated && !settingsLoaded) {
      loadPlayerSettings();
    }
  }, [isAuthenticated, settingsLoaded, loadPlayerSettings]);

  useEffect(() => {
    if (!isAuthenticated || !settingsLoaded) return;
    
    const saveSettings = async () => {
      try {
        await authService.updatePlayerSettings({ soundEnabled });
      } catch (error) {
        console.error('Failed to save sound settings:', error);
      }
    };
    
    const debounceTimer = setTimeout(saveSettings, 1500);
    return () => clearTimeout(debounceTimer);
  }, [soundEnabled, isAuthenticated, settingsLoaded]);

  const handleBet = useCallback(() => {
    if (gameState === 'betting' && betAmount <= playerBalance && !hasActiveBet) {
      const result = placeBet(betAmount);
      if (!result.success) {
        addNotification({
          type: 'warning',
          title: 'Daily Limit Reached',
          message: 'Your bet was blocked by responsible gaming limits.',
          details: result.reasons,
          duration: 6000
        });
      }
    }
  }, [gameState, betAmount, playerBalance, hasActiveBet, placeBet, addNotification]);

  const handleCashOut = useCallback(() => {
    if (gameState === 'running' && hasActiveBet && !cashedOut) {
      cashOut();
    }
  }, [gameState, hasActiveBet, cashedOut, cashOut]);

  const getCurrentMultiplier = useCallback(() => {
    return multiplier;
  }, [multiplier]);

  useEffect(() => {
    if (gameState === 'betting' && countdown > 0 && countdown !== prevCountdown) {
      if (countdown <= 3 && countdown > 0) {
        if (countdown === 1) {
          soundEffects.playFinalCountdownBeep();
        } else {
          soundEffects.playCountdownBeep();
        }
      }
    }

    if (gameState === 'running' && prevGameState !== 'running') {
      soundEffects.startBackgroundMusic();
    }

    if (gameState === 'crashed' && prevGameState === 'running') {
      soundEffects.playCrashSound();
      soundEffects.stopBackgroundMusic();
      
      if (hasActiveBet && !cashedOut) {
        addNotification({
          type: 'error',
          title: 'Plane Crashed!',
          message: `The plane crashed at ${multiplier.toFixed(2)}x. Better luck next time!`,
          duration: 4000
        });
      }
    }

    setPrevGameState(gameState);
    setPrevCountdown(countdown);
  }, [gameState, countdown, prevGameState, prevCountdown, hasActiveBet, cashedOut, multiplier, addNotification]);

  if (showBackendTest) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-white mb-2">Aviator Backend Test</h1>
            <p className="text-gray-400">Testing connection to our new backend</p>
            <button 
              onClick={() => setShowBackendTest(false)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Switch to Main Game
            </button>
          </div>
          <BackendTest />
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">...</div>
          <h1 className="text-2xl font-bold mb-2">Connecting to Game Server...</h1>
          <p className="text-gray-400 mb-4">Please wait while we establish connection</p>
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <TelegramWebApp>
      <TelegramThemeStyles />
      <UpdateChecker />
      <div className="h-dvh flex flex-col bg-gray-900 text-white">
      <header className="app-header bg-gray-800 shadow-lg">
        <div className="flex items-center justify-between p-3 sm:p-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 12L8 10l2-2 2 2-2 2z"/>
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12z" clipRule="evenodd"/>
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold">Aviator</h1>
              {isAuthenticated && (
                <p className="text-xs text-gray-400">Welcome, {user.username}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="text-right">
              <div className="text-xs sm:text-sm text-gray-400">
                {isAuthenticated ? 'Balance' : 'Demo Balance'}
              </div>
              <div className={`font-bold text-sm sm:text-base ${isAuthenticated ? 'text-green-400' : 'text-yellow-400'}`}>
                {formatCompactNumber(playerBalance)} pts
              </div>
            </div>
            
            <div className="hidden sm:flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-xs text-gray-400 hidden md:inline">{isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
            
            <div className="flex items-center space-x-1 sm:space-x-2">
              {
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(v => !v)}
                    className="flex items-center space-x-2 focus:outline-none"
                  >
                    <img
                      src={avatarUrl}
                      alt="avatar"
                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border border-gray-700"
                      referrerPolicy="no-referrer"
                    />
                    <div className="hidden sm:block text-left">
                      <div className="text-sm font-medium">{displayName}</div>
                      <div className="text-xs text-gray-400">@{displayUsername}</div>
                    </div>
                  </button>

                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
                      <button
                        onClick={() => {
                          const newSoundState = soundEffects.toggleSound();
                          setSoundEnabled(newSoundState);
                          setShowUserMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700 rounded-t-lg"
                      >
                        <span className="mr-2">{soundEnabled ? 'Sound On' : 'Sound Off'}</span>
                      </button>
                      <button
                        onClick={() => setShowUserProfile(true)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700 rounded-t-lg"
                      >
                        Profile
                      </button>
                      {authService.isAdmin() && (
                        <button
                          onClick={handleLogout}
                          className="w-full text-left px-3 py-2 text-sm text-red-300 hover:bg-gray-700 rounded-b-lg"
                        >
                          Logout (Admin)
                        </button>
                      )}
                    </div>
                  )}
                </div>
              }
              
              <button 
                onClick={() => setShowFairnessPage(true)}
                className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-700 text-gray-300 rounded-full flex items-center justify-center hover:bg-gray-600 transition-colors"
                title="Provably Fair Verification"
              >
                <span className="text-xs sm:text-sm">F</span>
              </button>

              {isAuthenticated && authService.getUser()?.role === 'ADMIN' && (
                <button 
                  onClick={() => setShowAdminDashboard(true)}
                  className="w-8 h-8 sm:w-10 sm:h-10 bg-red-700 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                  title="Admin Dashboard"
                >
                  <span className="text-xs sm:text-sm">A</span>
                </button>
              )}

              <button 
                onClick={() => setShowBackendTest(true)}
                className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-700 text-gray-300 rounded-full flex items-center justify-center hover:bg-gray-600 transition-colors"
                title="Backend Test"
              >
                <span className="text-xs sm:text-sm">T</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="app-game-area relative overflow-hidden bg-gradient-to-br from-purple-900 via-gray-900 to-black"
           style={{ height: 'var(--game-h)' }}>
        {performanceInitialized ? (
          <div className="relative z-10 w-full h-full flex items-center justify-center">
            <AviatorGameStandalone
              gameState={gameState}
              multiplier={multiplier}
              countdown={countdown}
              crashHistory={crashHistory}
              className="w-full h-[50vh]"
              triggerCashout={cashoutTrigger}
            />
          </div>
        ) : (
          <div className="relative z-10 w-full h-full flex items-center justify-center">
            <div className="text-gray-400 text-lg">Initializing...</div>
          </div>
        )}

      </div>

      <div className="app-history-strip px-2 sm:px-4 py-2 sm:py-3 bg-gray-800/50 backdrop-blur-sm overflow-hidden">
        <div className="flex space-x-2 sm:space-x-3 overflow-x-auto scrollbar-hide pb-1">
          {crashHistory.length > 0 ? (
            crashHistory.map((crashMultiplier, index) => (
              <HistoryItem key={`${crashMultiplier}-${index}`} multiplier={crashMultiplier} />
            ))
          ) : (
            <div className="text-gray-400 text-sm">Waiting for crash history...</div>
          )}
        </div>
      </div>

      <div className="app-bet-panel p-4 sm:p-4 md:p-6 bg-gray-800 border-t border-gray-700 mobile-spacing">
        <BetPanel
          gameState={gameState}
          betAmount={betAmount}
          setBetAmount={setBetAmount}
          onBet={handleBet}
          onCashOut={handleCashOut}
          userBalance={playerBalance}
          getCurrentMultiplier={getCurrentMultiplier}
          hasBet={hasActiveBet}
          countdown={countdown}
          activeBet={activeBetAmount}
          cashedOutMultiplier={cashedOutMultiplier}
        />
      </div>

      <div className="h-[64px] md:h-[72px]" />

      <BottomNav 
        activeTab={activeNavTab}
        onTabChange={(tab) => {
          setActiveNavTab(tab);
          if (tab === 'Ranks') {
            setShowRanksPanel(true);
          } else if (tab === 'Earn') {
            setShowEarnPanel(true);
          } else if (tab === 'Work') {
            setShowWorkPanel(true);
          } else if (tab === 'Friends') {
            setShowFriendsPanel(true);
          }
        }}
      />

      <RanksPanel
        isOpen={showRanksPanel}
        onClose={() => {
          setShowRanksPanel(false);
          setActiveNavTab('Play');
        }}
      />

      <FairnessPage
        isOpen={showFairnessPage}
        onClose={() => setShowFairnessPage(false)}
      />

      <WorkPanel
        isOpen={showWorkPanel}
        onClose={() => {
          setShowWorkPanel(false);
          setActiveNavTab('Play');
        }}
      />

      <EarnTab
        isOpen={showEarnPanel}
        onClose={() => {
          setShowEarnPanel(false);
          setActiveNavTab('Play');
        }}
      />

      <FriendsPanel
        isOpen={showFriendsPanel}
        onClose={() => {
          setShowFriendsPanel(false);
          setActiveNavTab('Play');
        }}
      />

      <AdminDashboard
        isOpen={showAdminDashboard}
        onClose={() => setShowAdminDashboard(false)}
      />

      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {}}
      />

      <AdminLoginModal
        isOpen={showAdminLogin && !(isAuthenticated && authService.isAdmin())}
        onClose={() => setShowAdminLogin(false)}
        onSuccess={(user) => {
          setIsAuthenticated(true);
          setUser(user);
          addNotification({ type: 'success', title: 'Welcome, Admin', message: user.username, duration: 2500 });
          try {
            gameService.disconnect();
            setTimeout(() => {
              gameService.connect();
            }, 200);
          } catch {}
        }}
      />

      <UserProfile 
        isOpen={showUserProfile} 
        onClose={() => setShowUserProfile(false)}
      />

      <NotificationSystem 
        notifications={notifications}
        onDismiss={dismissNotification}
      />
      </div>
    </TelegramWebApp>
  );
}

export default App;
