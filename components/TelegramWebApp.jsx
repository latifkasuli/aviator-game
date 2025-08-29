import React, { useEffect, useState, useCallback } from 'react';
import authService from './services/authService.js';
import gameService from './services/gameService.js';

// Fred's Build Tag System - capture version from URL or Telegram params  
const getBuildTag = () => {
  const qsV = new URLSearchParams(location.search).get('v');
  const tgV = window.Telegram?.WebApp?.initDataUnsafe?.start_param || null;
  // support "ref_XXXX__v_YYYY" combined param
  if (tgV && tgV.includes('__v_')) return tgV.split('__v_')[1];
  return qsV || tgV || null;
};

// Telegram WebApp integration component
const TelegramWebApp = ({ children }) => {
  const [tg, setTg] = useState(null);
  const [user, setUser] = useState(null);
  const [themeParams, setThemeParams] = useState({});
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [debugLogs, setDebugLogs] = useState([]);
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  // Add debug log function
  const addDebugLog = (message) => {
    console.log(message);
    setDebugLogs(prev => [...prev.slice(-10), `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  // Authenticate user with backend
  const authenticateUser = async (telegramUser, startParam) => {
    try {
      addDebugLog(`🔐 Authenticating: ${telegramUser.username || telegramUser.first_name}`);
      addDebugLog(`📨 Start param: ${startParam || 'NONE'}`);
      addDebugLog(`📋 Telegram data: id=${telegramUser.id} (${typeof telegramUser.id})`);
      addDebugLog(`📋 First name: "${telegramUser.first_name || 'MISSING'}"`);
      addDebugLog('🔍 Calling authService.authenticateWithTelegram...');
      
      const result = await authService.authenticateWithTelegram(telegramUser, startParam);
      addDebugLog(`🔍 Auth result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      
      if (!result.success) {
        addDebugLog(`❌ Auth error: ${result.error || 'Unknown error'}`);
        if (result.details) {
          addDebugLog(`🔍 Error details: ${result.details}`);
        }
        if (result.status) {
          addDebugLog(`🌐 HTTP status: ${result.status}`);
        }
        // Check if XMLHttpRequest fallback was used
        if (result.details && result.details.includes('XHR:')) {
          addDebugLog(`🔄 XMLHttpRequest fallback attempted!`);
        }
        addDebugLog(`🔍 Full result: ${JSON.stringify(result)}`);
      }
      
      if (result.success) {
        setIsAuthenticated(true);
        setAuthError(null);
        addDebugLog('✅ Authentication successful');
        
        // Fred's Fix: Reconnect WebSocket with fresh JWT token
        addDebugLog('🔄 Reconnecting WebSocket...');
        addDebugLog(`🔍 Auth token: ${authService.getToken() ? 'PRESENT' : 'MISSING'}`);
        gameService.reconnect();
        
        // Show referral message if present - Safe for older browsers
        if (result.referralMessage) {
          if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.showAlert) {
            window.Telegram.WebApp.showAlert(result.referralMessage);
          } else {
            alert(result.referralMessage);
          }
        }
      } else {
        setIsAuthenticated(false);
        setAuthError(result.error);
        console.error('❌ Authentication failed:', result.error);
      }
    } catch (error) {
      setIsAuthenticated(false);
      setAuthError('Network error');
      console.error('❌ Authentication error:', error);
    }
  };

  useEffect(() => {
    // Initialize Telegram WebApp - Safe for older browsers  
    addDebugLog('🔍 TelegramWebApp useEffect triggered');
    addDebugLog(`🔍 window.Telegram: ${!!window.Telegram}`);
    addDebugLog(`🔍 window.Telegram.WebApp: ${!!window.Telegram?.WebApp}`);
    
    if (window.Telegram && window.Telegram.WebApp) {
      const webApp = window.Telegram.WebApp;
      setTg(webApp);

      addDebugLog(`🤖 Telegram WebApp detected: platform=${webApp.platform}, version=${webApp.version}`);
      addDebugLog(`🤖 User data: ${webApp.initDataUnsafe?.user ? 'FOUND' : 'MISSING'}`);

      // Initialize the app
      webApp.ready();
      webApp.expand();

      // Fred's One-time hard reload for new builds
      try {
        const buildTag = getBuildTag();
        if (buildTag) {
          const key = 'aviator_reload_for_' + buildTag;
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, '1');
            // bumps query to bust HTML cache once
            location.replace(location.pathname + '?v=' + encodeURIComponent(buildTag) + '&r=' + Date.now());
            return; // stop init; new load will continue
          }
        }
      } catch (_) {}
      
      // Get user data and authenticate - Safe for older browsers
      addDebugLog('🔍 Checking for Telegram user...');
      addDebugLog(`🔍 initDataUnsafe exists: ${!!webApp.initDataUnsafe}`);
      addDebugLog(`🔍 user exists: ${!!webApp.initDataUnsafe?.user}`);
      
      if (webApp.initDataUnsafe && webApp.initDataUnsafe.user) {
        const telegramUser = webApp.initDataUnsafe.user;
        const startParam = webApp.initDataUnsafe.start_param || null;
        
        addDebugLog(`✅ Telegram user found: ${telegramUser.username || telegramUser.first_name}`);
        addDebugLog(`📨 Start param: ${startParam || 'NONE'}`);
        
        setUser(telegramUser);
        
        // Fred's Token Freshness Guard - comprehensive authentication flow
        const ensureFreshAuth = async () => {
          addDebugLog('🔒 Starting authentication flow...');
          addDebugLog(`🔍 Currently authenticated: ${authService.isAuthenticated()}`);
          
          if (authService.isAuthenticated()) {
            addDebugLog('🔄 Validating existing token...');
            const validation = await authService.validateCurrentToken();
            addDebugLog(`🔍 Token validation result: ${validation.valid}`);
            
            if (!validation.valid) {
              addDebugLog('🧹 Clearing invalid token and re-authenticating...');
              authService.clearTokens();
              await authenticateUser(telegramUser, startParam);
              gameService.reconnect();
            } else {
              addDebugLog('✅ Token valid, setting authenticated state...');
              setIsAuthenticated(true);
              gameService.reconnect();
            }
          } else {
            addDebugLog('🔐 No existing authentication, starting fresh...');
            await authenticateUser(telegramUser, startParam);
          }
        };
        ensureFreshAuth();
      } else {
        addDebugLog('❌ No Telegram user found - this explains the guest session!');
        addDebugLog(`🔍 initDataUnsafe: ${JSON.stringify(webApp.initDataUnsafe)}`);
      }

      // Get theme parameters
      setThemeParams(webApp.themeParams);

      // Apply Telegram theme
      applyTelegramTheme(webApp.themeParams);

      // Set up event listeners
      webApp.onEvent('themeChanged', () => {
        setThemeParams(webApp.themeParams);
        applyTelegramTheme(webApp.themeParams);
      });

      webApp.onEvent('viewportChanged', () => {
        console.log('Viewport changed:', webApp.viewportHeight, webApp.viewportStableHeight);
      });

      setIsReady(true);

      console.log('🤖 Telegram WebApp initialized:', {
        user: webApp.initDataUnsafe && webApp.initDataUnsafe.user,
        platform: webApp.platform,
        version: webApp.version,
        colorScheme: webApp.colorScheme
      });
    } else {
      // Fallback for development/testing outside Telegram
      console.log('⚠️ Running outside Telegram - using fallback mode');
      console.log('🔍 window.Telegram exists:', !!window.Telegram);
      console.log('🔍 window.Telegram.WebApp exists:', !!window.Telegram?.WebApp);
      setIsReady(true);
    }
  }, []);

  // Fred's Auth Stale Event Listener - handles real-time token recovery
  useEffect(() => {
    const onStale = () => {
      // Re-run Telegram auth using current initDataUnsafe
      const webApp = window.Telegram?.WebApp;
      const u = webApp?.initDataUnsafe?.user;
      const sp = webApp?.initDataUnsafe?.start_param || null;
      if (u) authenticateUser(u, sp);
    };
    window.addEventListener('auth:stale', onStale);
    return () => window.removeEventListener('auth:stale', onStale);
  }, []);

  const applyTelegramTheme = (theme) => {
    const root = document.documentElement;
    
    // Apply Telegram theme colors
    if (theme.bg_color) {
      root.style.setProperty('--tg-bg-color', theme.bg_color);
      root.style.setProperty('--tw-bg-gray-900', theme.bg_color);
    }
    
    if (theme.text_color) {
      root.style.setProperty('--tg-text-color', theme.text_color);
      root.style.setProperty('--tw-text-white', theme.text_color);
    }
    
    if (theme.hint_color) {
      root.style.setProperty('--tg-hint-color', theme.hint_color);
      root.style.setProperty('--tw-text-gray-400', theme.hint_color);
    }
    
    if (theme.button_color) {
      root.style.setProperty('--tg-button-color', theme.button_color);
      root.style.setProperty('--tw-bg-blue-600', theme.button_color);
    }
    
    if (theme.button_text_color) {
      root.style.setProperty('--tg-button-text-color', theme.button_text_color);
    }

    if (theme.secondary_bg_color) {
      root.style.setProperty('--tg-secondary-bg-color', theme.secondary_bg_color);
      root.style.setProperty('--tw-bg-gray-800', theme.secondary_bg_color);
    }

    // Apply theme class to body - Safe for older browsers
    document.body.className = 'telegram-theme ' + (tg && tg.colorScheme ? tg.colorScheme : 'dark');
  };

  return (
    <TelegramContext.Provider value={{ 
      tg, 
      user, 
      themeParams, 
      isReady, 
      isAuthenticated, 
      authError,
      authenticateUser 
    }}>
      {/* Debug Toggle Button */}
      {debugLogs.length > 0 && (
        <button
          onClick={() => setShowDebugPanel(!showDebugPanel)}
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            background: showDebugPanel ? '#0f0' : '#333',
            color: showDebugPanel ? '#000' : '#0f0',
            border: '2px solid #0f0',
            fontSize: '12px',
            fontWeight: 'bold',
            cursor: 'pointer',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title={showDebugPanel ? 'Hide Debug Panel' : 'Show Debug Panel'}
        >
          🔍
        </button>
      )}

      {/* Debug Panel - Toggleable */}
      {showDebugPanel && debugLogs.length > 0 && (
        <div style={{
          position: 'fixed',
          top: 10,
          left: 10,
          right: 10,
          maxHeight: '200px',
          background: '#000',
          color: '#0f0',
          padding: '10px',
          fontSize: '10px',
          fontFamily: 'monospace',
          overflowY: 'auto',
          zIndex: 9999,
          border: '1px solid #333',
          borderRadius: '5px'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '5px'
          }}>
            <div style={{ fontWeight: 'bold' }}>🔍 DEBUG LOG:</div>
            <button
              onClick={() => setShowDebugPanel(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#0f0',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '0 5px'
              }}
              title="Close Debug Panel"
            >
              ✕
            </button>
          </div>
          {debugLogs.map((log, i) => (
            <div key={i} style={{ marginBottom: '2px' }}>{log}</div>
          ))}
        </div>
      )}
      {children}
    </TelegramContext.Provider>
  );
};

// Context for Telegram WebApp
const TelegramContext = React.createContext({});

// Hook to use Telegram WebApp features
export const useTelegramWebApp = () => {
  const context = React.useContext(TelegramContext);
  
  const showAlert = useCallback((message) => {
    if (context.tg) {
      context.tg.showAlert(message);
    } else {
      alert(message);
    }
  }, [context.tg]);

  const showConfirm = useCallback((message, callback) => {
    if (context.tg) {
      context.tg.showConfirm(message, callback);
    } else {
      const result = confirm(message);
      callback(result);
    }
  }, [context.tg]);

  const hapticFeedback = useCallback((type = 'impact', style = 'medium') => {
    if (context.tg && context.tg.HapticFeedback) {
      switch (type) {
        case 'impact':
          context.tg.HapticFeedback.impactOccurred(style); // light, medium, heavy
          break;
        case 'notification':
          context.tg.HapticFeedback.notificationOccurred(style); // error, success, warning
          break;
        case 'selection':
          context.tg.HapticFeedback.selectionChanged();
          break;
      }
    } else if (navigator.vibrate) {
      // Fallback vibration
      const patterns = {
        light: 10,
        medium: 20,
        heavy: 30,
        success: [10, 50, 10],
        error: [20, 100, 20],
        warning: [15, 75, 15]
      };
      navigator.vibrate(patterns[style] || patterns.medium);
    }
  }, [context.tg]);

  const setMainButton = useCallback((text, callback, color = null) => {
    if (context.tg && context.tg.MainButton) {
      context.tg.MainButton.setText(text);
      if (color) {
        context.tg.MainButton.setParams({ color });
      }
      context.tg.MainButton.onClick(callback);
      context.tg.MainButton.show();
    }
  }, [context.tg]);

  const hideMainButton = useCallback(() => {
    if (context.tg && context.tg.MainButton) {
      context.tg.MainButton.hide();
    }
  }, [context.tg]);

  const setBackButton = useCallback((callback) => {
    if (context.tg && context.tg.BackButton) {
      context.tg.BackButton.onClick(callback);
      context.tg.BackButton.show();
    }
  }, [context.tg]);

  const hideBackButton = useCallback(() => {
    if (context.tg && context.tg.BackButton) {
      context.tg.BackButton.hide();
    }
  }, [context.tg]);

  const close = useCallback(() => {
    if (context.tg) {
      context.tg.close();
    }
  }, [context.tg]);

  const sendData = useCallback((data) => {
    if (context.tg) {
      context.tg.sendData(JSON.stringify(data));
    }
  }, [context.tg]);

  return {
    ...context,
    showAlert,
    showConfirm,
    hapticFeedback,
    setMainButton,
    hideMainButton,
    setBackButton,
    hideBackButton,
    close,
    sendData
  };
};

// Telegram-specific button component
export const TelegramButton = ({ 
  children, 
  onClick, 
  haptic = 'impact', 
  hapticStyle = 'medium',
  className = '',
  unstyled = false,
  ...props 
}) => {
  const { hapticFeedback } = useTelegramWebApp();

  const handleClick = useCallback((e) => {
    hapticFeedback(haptic, hapticStyle);
    if (onClick) {
      onClick(e);
    }
  }, [onClick, hapticFeedback, haptic, hapticStyle]);

  return (
    <button
      className={`${unstyled ? '' : 'telegram-button'} ${className}`.trim()}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
};

// Telegram theme styles component
export const TelegramThemeStyles = () => {
  return (
    <style>{`
      .telegram-theme {
        --tg-bg-color: var(--tg-bg-color, #1a1a1a);
        --tg-text-color: var(--tg-text-color, #ffffff);
        --tg-hint-color: var(--tg-hint-color, #999999);
        --tg-button-color: var(--tg-button-color, #2ea6ff);
        --tg-button-text-color: var(--tg-button-text-color, #ffffff);
        --tg-secondary-bg-color: var(--tg-secondary-bg-color, #2a2a2a);
      }

      .telegram-theme.light {
        --tg-bg-color: var(--tg-bg-color, #ffffff);
        --tg-text-color: var(--tg-text-color, #000000);
        --tg-hint-color: var(--tg-hint-color, #999999);
        --tg-secondary-bg-color: var(--tg-secondary-bg-color, #f0f0f0);
      }

      .telegram-button {
        background: var(--tg-button-color);
        color: var(--tg-button-text-color);
        border: none;
        border-radius: 8px;
        padding: 12px 24px;
        font-size: 16px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        touch-action: manipulation;
        user-select: none;
      }

      .telegram-button:active {
        transform: scale(0.96);
        opacity: 0.8;
      }

      .telegram-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* Telegram-specific viewport handling */
      .telegram-viewport {
        height: 100vh;
        height: var(--tg-viewport-height, 100vh);
        overflow: hidden;
      }

      /* Hide elements that shouldn't appear in Telegram */
      .telegram-theme .hide-in-telegram {
        display: none !important;
      }

      /* Telegram-safe scrolling */
      .telegram-scroll {
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        -ms-overflow-style: none;
      }

      .telegram-scroll::-webkit-scrollbar {
        display: none;
      }
    `}</style>
  );
};

export default TelegramWebApp;
