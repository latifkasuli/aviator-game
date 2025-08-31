import React, { useState, useEffect, useRef } from 'react';
import soundEffects from './utils/soundEffects.js';
import { TelegramButton, useTelegramWebApp } from './TelegramWebApp.jsx';
import { usePlayerSettings } from './hooks/usePlayerSettings.js';

const BetPanel = ({ gameState, betAmount, setBetAmount, onBet, onCashOut, userBalance, multiplier, hasBet, countdown, activeBet, cashedOutMultiplier }) => {
  // Telegram WebApp integration
  const { hapticFeedback, showAlert } = useTelegramWebApp();
  
  // Player settings hook - handles all the loading/saving/caching for us
  const { 
    settings,
    saving,
    updateSetting,
    autoCashoutEnabled,
    autoCashoutMultiplier
  } = usePlayerSettings();
  
  const [showAutoCashoutSettings, setShowAutoCashoutSettings] = useState(false);
  
  // Visual feedback state
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [lastAction, setLastAction] = useState(null);

  // Auto-cashout logic
  useEffect(() => {
    if (autoCashoutEnabled && gameState === 'running' && activeBet > 0 && cashedOutMultiplier === 0) {
      if (multiplier >= autoCashoutMultiplier) {
        console.log(`🤖 Auto-cashout triggered at ${multiplier.toFixed(2)}x (target: ${autoCashoutMultiplier}x)`);
        onCashOut();
        soundEffects.playAutoCashoutSound();
        showFeedback(`Auto-cashed out at ${multiplier.toFixed(2)}x!`, 'auto-cashout');
        // Keep autocashout enabled for next bet - better UX
      }
    }
  }, [multiplier, autoCashoutEnabled, autoCashoutMultiplier, gameState, activeBet, cashedOutMultiplier, onCashOut]);


  const handleDecrease = () => {
    setBetAmount(prev => Math.max(100, prev - 100));
  };

  const handleIncrease = () => {
    setBetAmount(prev => Math.min(userBalance, prev + 100));
  };

  const getButtonText = () => {
    switch (gameState) {
      case 'betting':
        if (activeBet > 0) {
          const autoText = autoCashoutEnabled ? ` (AUTO @ ${autoCashoutMultiplier.toFixed(1)}x)` : '';
          return `BET PLACED - STARTS IN ${countdown}${autoText}`;
        }
        if (countdown > 0) {
          return `BET (STARTS IN ${countdown})`;
        }
        return 'BET';
      case 'running':
        if (activeBet === 0) return 'WAIT FOR NEXT ROUND';
        if (cashedOutMultiplier > 0) return `CASHED OUT @ ${cashedOutMultiplier.toFixed(2)}x`;
        if (autoCashoutEnabled) {
          return `CASH OUT (AUTO @ ${autoCashoutMultiplier.toFixed(1)}x)`;
        }
        return 'CASH OUT';
      case 'crashed':
        if (activeBet === 0) return 'ROUND OVER';
        if (cashedOutMultiplier > 0) return `CASHED OUT @ ${cashedOutMultiplier.toFixed(2)}x`;
        return 'TOO LATE';
      default:
        return 'BET';
    }
  };

  const getButtonColor = () => {
    switch (gameState) {
      case 'betting':
        if (activeBet > 0) {
          return 'bg-gradient-to-r from-green-600 to-green-500 shadow-green-500/30';
        }
        // Suggestion: make the bet button green during betting to encourage action
        return 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 shadow-green-500/50';
      case 'running':
        if (activeBet === 0) {
          return 'bg-gray-600 cursor-not-allowed shadow-gray-500/30';
        }
        if (cashedOutMultiplier > 0) {
          return 'bg-gradient-to-r from-green-600 to-green-500 shadow-green-500/30';
        }
        return 'bg-gradient-to-r from-yellow-500 to-yellow-400 hover:from-yellow-600 hover:to-yellow-500 shadow-yellow-500/50 text-black font-bold';
      case 'crashed':
        if (cashedOutMultiplier > 0) {
          return 'bg-gradient-to-r from-green-600 to-green-500 shadow-green-500/30';
        }
        return 'bg-gray-600 cursor-not-allowed shadow-gray-500/30';
      default:
        return 'bg-gradient-to-r from-red-600 to-red-500';
    }
  };

  const isButtonDisabled = () => {
    return gameState === 'crashed' || 
           (gameState === 'betting' && betAmount > userBalance) ||
           (gameState === 'betting' && activeBet > 0) ||
           (gameState === 'running' && activeBet === 0) ||
           (gameState === 'running' && cashedOutMultiplier > 0);
  };

  const handleButtonClick = () => {
    if (gameState === 'betting' && activeBet === 0) {
      onBet();
      soundEffects.playBetSound();
      showFeedback('Bet placed!', 'bet');
    } else if (gameState === 'running' && activeBet > 0 && cashedOutMultiplier === 0) {
      onCashOut();
      // Don't show feedback here - wait for server confirmation
      // soundEffects and success message will be handled by the server event
    }
  };

  // Visual feedback function
  const showFeedback = (message, action) => {
    setSuccessMessage(message);
    setLastAction(action);
    setShowSuccessAnimation(true);
    setTimeout(() => {
      setShowSuccessAnimation(false);
    }, 2000);
  };

  // Track successful cashouts for feedback
  useEffect(() => {
    if (cashedOutMultiplier > 0 && lastAction !== 'cashout-shown') {
      const winnings = Math.floor(activeBet * cashedOutMultiplier);
      showFeedback(`Won ${winnings} pts at ${cashedOutMultiplier.toFixed(2)}x!`, 'cashout-shown');
      setLastAction('cashout-shown');
    }
  }, [cashedOutMultiplier, activeBet, lastAction]);

  // Listen for server-confirmed cashouts (including auto-cashouts)
  useEffect(() => {
    const handleServerCashout = (event) => {
      const { multiplier, isAutomatic, winnings } = event.detail;
      
      soundEffects.playCashoutSound();
      
      if (isAutomatic) {
        showFeedback(`Auto-cashed out! Won ${winnings} pts at ${multiplier.toFixed(2)}x!`, 'auto-cashout');
      } else {
        showFeedback(`Cashed out! Won ${winnings} pts at ${multiplier.toFixed(2)}x!`, 'cashout');
      }
    };

    window.addEventListener('game:cashedOut', handleServerCashout);
    return () => window.removeEventListener('game:cashedOut', handleServerCashout);
  }, []);

  const getPotentialWinnings = () => {
    if (gameState === 'running' && activeBet > 0) {
      if (cashedOutMultiplier > 0) {
        return Math.floor(activeBet * cashedOutMultiplier);
      }
      return Math.floor(activeBet * multiplier);
    }
    if (activeBet > 0) {
      return Math.floor(activeBet * 2);
    }
    return Math.floor(betAmount * 2);
  };

  return (
    <div className="bet-panel-content space-y-3">
      {/* Bet Amount Controls - Always visible */}
      {gameState === 'running' && (
        <div className="text-center mb-1">
          {activeBet > 0 ? (
            <div className="text-xs text-green-400 font-bold">
              Potential Win: {getPotentialWinnings()} pts
            </div>
          ) : (
            <div className="text-xs text-gray-500 italic">
              No bet placed
            </div>
          )}
        </div>
      )}

      {/* Horizontal layout for amount control and quick bets */}
      <div className="flex items-center justify-between gap-3">
        {/* Bet Amount Control - Left side */}
        <div className="flex items-center justify-center space-x-1 bg-gray-800 rounded-full px-2 py-1 border border-gray-600">
        {/* Decrease Button */}
        <TelegramButton
          onClick={handleDecrease}
          disabled={gameState !== 'betting' || betAmount <= 1 || activeBet > 0}
          haptic="selection"
          className="
            w-6 h-6 rounded-full border border-gray-600 
            bg-transparent hover:bg-gray-700 
            disabled:opacity-30 disabled:cursor-not-allowed
            flex items-center justify-center
            transition-all duration-200
          "
        >
          <span className="text-gray-400 text-sm leading-none">−</span>
        </TelegramButton>

        {/* Bet Amount Display */}
        <div className="flex-1 text-center px-2">
          <div className="text-sm font-medium text-white">
            {(activeBet > 0 ? activeBet : betAmount).toFixed(2)}
          </div>
        </div>

        {/* Increase Button */}
        <TelegramButton
          onClick={handleIncrease}
          disabled={gameState !== 'betting' || betAmount >= userBalance || activeBet > 0}
          haptic="selection"
          className="
            w-6 h-6 rounded-full border border-gray-600 
            bg-transparent hover:bg-gray-700 
            disabled:opacity-30 disabled:cursor-not-allowed
            flex items-center justify-center
            transition-all duration-200
          "
        >
          <span className="text-gray-400 text-sm leading-none">+</span>
        </TelegramButton>
        </div>
        
        {/* Quick Bet Buttons - Right side */}
        {activeBet === 0 && (
          <div className="flex items-center gap-2 flex-1">
            <div className="grid grid-cols-3 gap-1">
              {[10, 50, 100, 500, 1000, 'Max'].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setBetAmount(amount === 'Max' ? userBalance : Math.min(amount, userBalance))}
                  disabled={gameState !== 'betting' || (amount !== 'Max' && amount > userBalance)}
                  className={`
                    py-1.5 px-3 text-xs font-medium
                    bg-transparent border border-gray-600 rounded
                    transition-all duration-200
                    ${gameState !== 'betting' || (amount !== 'Max' && amount > userBalance)
                      ? 'text-gray-500 opacity-30 cursor-not-allowed'
                      : 'text-gray-300 hover:bg-gray-700 hover:border-gray-500'
                    }
                  `}
                >
                  {amount === 'Max' ? 'Max' : amount}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Auto-Cashout Settings - Always visible but disabled during running */}
      <div className="space-y-3">
        {activeBet === 0 && (
          <div className="space-y-3">
          {/* Auto-Cashout Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => updateSetting('autoCashoutEnabled', !autoCashoutEnabled)}
                  disabled={gameState !== 'betting'}
                  className={`
                    relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                    ${autoCashoutEnabled ? 'bg-green-600' : 'bg-gray-600'}
                    ${gameState !== 'betting' ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                <span
                  className={`
                    inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                    ${autoCashoutEnabled ? 'translate-x-6' : 'translate-x-1'}
                  `}
                />
              </button>
              <span className="text-sm font-medium text-gray-300">Auto Cashout</span>
              {saving && <span className="text-xs text-gray-400 ml-2">Saving...</span>}
            </div>
            
              {autoCashoutEnabled && (
                <button
                  onClick={() => setShowAutoCashoutSettings(!showAutoCashoutSettings)}
                  disabled={gameState !== 'betting'}
                  className={`text-xs underline transition-colors
                    ${gameState !== 'betting' 
                      ? 'text-gray-500 cursor-not-allowed' 
                      : 'text-blue-400 hover:text-blue-300'}
                  `}
                >
                  {showAutoCashoutSettings ? 'Hide' : 'Settings'}
                </button>
              )}
          </div>

          {/* Auto-Cashout Multiplier Settings */}
          {autoCashoutEnabled && showAutoCashoutSettings && (
            <div className="bg-gray-800 rounded-lg p-3 border border-gray-600">
              <div className="text-sm text-gray-400 mb-2">Auto-cashout at:</div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => updateSetting('autoCashoutMultiplier', Math.max(1.1, autoCashoutMultiplier - 0.1))}
                  disabled={gameState !== 'betting'}
                  className={`w-8 h-8 rounded flex items-center justify-center transition-colors
                    ${gameState !== 'betting' 
                      ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                      : 'bg-gray-700 hover:bg-gray-600'}
                  `}
                >
                  <span className="text-sm">-</span>
                </button>
                <div className="flex-1 text-center">
                  <input
                    type="number"
                    value={autoCashoutMultiplier}
                    onChange={(e) => updateSetting('autoCashoutMultiplier', Math.max(1.1, parseFloat(e.target.value) || 1.1))}
                    step="0.1"
                    min="1.1"
                    max="100"
                    disabled={gameState !== 'betting'}
                    className={`w-full border rounded px-2 py-1 text-center text-sm transition-colors
                      ${gameState !== 'betting' 
                        ? 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed' 
                        : 'bg-gray-700 border-gray-600'}
                    `}
                  />
                </div>
                <button
                  onClick={() => updateSetting('autoCashoutMultiplier', Math.min(100, autoCashoutMultiplier + 0.1))}
                  disabled={gameState !== 'betting'}
                  className={`w-8 h-8 rounded flex items-center justify-center transition-colors
                    ${gameState !== 'betting' 
                      ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                      : 'bg-gray-700 hover:bg-gray-600'}
                  `}
                >
                  <span className="text-sm">+</span>
                </button>
              </div>
              <div className="text-xs text-gray-500 mt-1 text-center">
                Will auto-cashout at {autoCashoutMultiplier.toFixed(1)}x
              </div>
            </div>
          )}

          {/* Quick Auto-Cashout Presets */}
          {autoCashoutEnabled && !showAutoCashoutSettings && (
            <div className="flex space-x-1">
              {[1.5, 2.0, 3.0, 5.0, 10.0].map((preset) => (
                <button
                  key={preset}
                  onClick={() => updateSetting('autoCashoutMultiplier', preset)}
                  disabled={gameState !== 'betting'}
                  className={`
                    flex-1 py-1 px-2 text-xs font-medium rounded
                    transition-all duration-200
                    ${gameState !== 'betting' ? 'cursor-not-allowed opacity-50' : ''}
                    ${autoCashoutMultiplier === preset 
                      ? 'bg-green-600 text-white' 
                      : gameState !== 'betting'
                        ? 'bg-gray-800 text-gray-500'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    }
                  `}
                >
                  {preset}x
                </button>
              ))}
            </div>
          )}
          </div>
        )}

      </div>

      {/* Main Action Button */}
      <TelegramButton
        onClick={handleButtonClick}
        disabled={isButtonDisabled()}
        haptic="impact"
        hapticStyle={gameState === 'running' ? 'heavy' : 'medium'}
        unstyled={true}
        className={`
          w-full py-4 px-6 rounded-2xl font-black text-lg
          transition-all duration-300 transform
          ${getButtonColor()}
          ${!isButtonDisabled() ? 'hover:scale-105 shadow-lg hover:shadow-2xl' : ''}
          disabled:transform-none disabled:opacity-50
          relative overflow-hidden
        `}
      >
        {/* Button glow effect */}
        {!isButtonDisabled() && (
          <div className="absolute inset-0 bg-white opacity-20 rounded-2xl animate-pulse"></div>
        )}
        
        <span className="relative z-10">{getButtonText()}</span>
        
        {gameState === 'running' && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
        )}
      </TelegramButton>

      {/* Status Messages */}
      {gameState === 'betting' && betAmount > userBalance && (
        <div className="text-center text-red-400 text-sm font-medium">
          Insufficient balance
        </div>
      )}

      {gameState === 'crashed' && (
        <div className="text-center text-gray-400 text-sm">
          Waiting for next round...
        </div>
      )}

      {/* Success Animation */}
      {showSuccessAnimation && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
          <div className="bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg animate-bounce">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
              </svg>
              <span className="font-bold">{successMessage}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BetPanel;
