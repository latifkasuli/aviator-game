// 🚀 Optimized BetPanel - Reduced Re-renders!
// Uses getCurrentMultiplier callback instead of multiplier prop dependency
// Prevents React re-renders on every multiplier update

import React, { useState, useEffect, useRef, useCallback } from 'react';
import soundEffects from './utils/soundEffects.js';
import { TelegramButton, useTelegramWebApp } from './TelegramWebApp.jsx';
import { usePlayerSettings } from './hooks/usePlayerSettings.js';

const BetPanelOptimized = ({ 
  gameState, 
  betAmount, 
  setBetAmount, 
  onBet, 
  onCashOut, 
  userBalance, 
  getCurrentMultiplier, // Function instead of direct multiplier prop
  hasBet, 
  countdown, 
  activeBet, 
  cashedOutMultiplier 
}) => {
  // Telegram WebApp integration
  const { hapticFeedback, showAlert } = useTelegramWebApp();
  
  // Player settings hook
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
  
  // 🚀 FRED'S FIX: Removed client-side auto-cashout - server handles it now!
  // Auto-cashout is now server-authoritative for lag-free precision
  // Settings UI remains for user configuration, but execution is server-side

  // 🚀 FRED'S FIX: Only show success after server confirmation
  useEffect(() => {
    function handleServerCashedOut(evt) {
      const { multiplier, isAutomatic } = evt.detail || {};
      const action = isAutomatic ? 'auto-cashout' : 'cashout';
      const message = isAutomatic 
        ? `Auto-cashed out at ${Number(multiplier).toFixed(2)}x!`
        : `Cashed out at ${Number(multiplier).toFixed(2)}x!`;
      
      if (isAutomatic) {
        soundEffects.playAutoCashoutSound();
      }
      showFeedback(message, action);
    }
    
    window.addEventListener('game:cashedOut', handleServerCashedOut);
    return () => window.removeEventListener('game:cashedOut', handleServerCashedOut);
  }, []);

  const handleDecrease = () => {
    setBetAmount(prev => Math.max(100, prev - 100));
  };

  const handleIncrease = () => {
    setBetAmount(prev => Math.min(userBalance, prev + 100));
  };

  const getButtonText = () => {
    switch (gameState) {
      case 'betting':
        return countdown > 0 ? `Starting in ${countdown}s` : 'Place Bet';
      case 'running':
        return hasBet ? 'Cash Out' : 'Next Round';
      case 'crashed':
        return 'Place Bet';
      default:
        return 'Place Bet';
    }
  };

  const isButtonDisabled = () => {
    if (gameState === 'betting' && countdown > 0) return true;
    if (gameState === 'running' && !hasBet) return true;
    if (gameState === 'betting' && betAmount > userBalance) return true;
    return false;
  };

  const handleMainAction = () => {
    if (gameState === 'running' && hasBet) {
      onCashOut();
      // 🚀 FRED'S FIX: Removed optimistic success - only show after server confirmation
      // showFeedback(`Cashed out at ${getCurrentMultiplier().toFixed(2)}x!`, 'cashout');
    } else if (gameState === 'betting' || gameState === 'crashed') {
      onBet();
      showFeedback(`Bet placed: ${betAmount} points`, 'bet');
    }
  };

  const showFeedback = (message, action) => {
    setSuccessMessage(message);
    setLastAction(action);
    setShowSuccessAnimation(true);
    setTimeout(() => setShowSuccessAnimation(false), 3000);
    
    // Haptic feedback
    hapticFeedback('notification', 'success');
  };

  return (
    <div className="bg-gray-800 rounded-xl p-4 space-y-4">
      {/* Bet Amount Controls */}
      {(gameState === 'betting' || gameState === 'crashed') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 font-medium">Bet Amount</span>
            <div className="text-xs text-gray-500">
              Balance: {userBalance.toLocaleString()} pts
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <TelegramButton
              onClick={handleDecrease}
              disabled={betAmount <= 100}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium"
              haptic="impact"
              hapticStyle="light"
            >
              -
            </TelegramButton>
            
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(Math.max(100, parseInt(e.target.value) || 100))}
              className="flex-1 bg-gray-700 text-white text-center py-2 px-3 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="100"
              max={userBalance}
            />
            
            <TelegramButton
              onClick={handleIncrease}
              disabled={betAmount >= userBalance}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium"
              haptic="impact"
              hapticStyle="light"
            >
              +
            </TelegramButton>
          </div>

          {/* Quick bet buttons */}
          <div className="grid grid-cols-4 gap-2">
            {[100, 500, 1000, 'Max'].map((amount) => (
              <TelegramButton
                key={amount}
                onClick={() => setBetAmount(amount === 'Max' ? userBalance : amount)}
                className="py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded-md font-medium transition-colors"
                haptic="impact"
                hapticStyle="light"
              >
                {amount === 'Max' ? 'Max' : amount}
              </TelegramButton>
            ))}
          </div>
        </div>
      )}

      {/* Auto-Cashout Settings */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoCashoutEnabled}
              onChange={(e) => updateSetting('autoCashoutEnabled', e.target.checked)}
              className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800"
            />
            <span className="text-sm font-medium text-gray-300">Auto Cashout</span>
          </label>
          
          <TelegramButton
            onClick={() => setShowAutoCashoutSettings(!showAutoCashoutSettings)}
            className="text-xs text-blue-400 hover:text-blue-300 underline"
            unstyled={true}
            haptic="selection"
          >
            {showAutoCashoutSettings ? 'Hide' : 'Settings'}
          </TelegramButton>
        </div>

        {showAutoCashoutSettings && (
          <div className="space-y-2 p-3 bg-gray-700 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Cashout at:</span>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  value={autoCashoutMultiplier}
                  onChange={(e) => updateSetting('autoCashoutMultiplier', parseFloat(e.target.value) || 2.0)}
                  step="0.1"
                  min="1.1"
                  max="100"
                  className="w-16 bg-gray-600 text-white text-center py-1 px-2 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-400">x</span>
              </div>
            </div>
            
            <div className="text-xs text-gray-500">
              Automatically cash out when the multiplier reaches your target
            </div>
          </div>
        )}
      </div>

      {/* Main Action Button */}
      <TelegramButton
        onClick={handleMainAction}
        disabled={isButtonDisabled()}
        className={`w-full py-3 px-6 rounded-xl font-bold text-lg transition-all duration-200 ${
          gameState === 'running' && hasBet
            ? 'bg-green-600 hover:bg-green-500 text-white'
            : 'bg-blue-600 hover:bg-blue-500 text-white disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed'
        }`}
        haptic={gameState === 'running' && hasBet ? 'notification' : 'impact'}
        hapticStyle={gameState === 'running' && hasBet ? 'success' : 'medium'}
      >
        {getButtonText()}
      </TelegramButton>

      {/* Success Animation */}
      {showSuccessAnimation && (
        <div className={`text-center py-2 px-4 rounded-lg text-sm font-medium transition-all duration-300 ${
          lastAction === 'auto-cashout' ? 'bg-purple-500/20 text-purple-400' :
          lastAction === 'cashout' ? 'bg-green-500/20 text-green-400' :
          'bg-blue-500/20 text-blue-400'
        }`}>
          ✓ {successMessage}
        </div>
      )}

      {/* Current Bet Display */}
      {hasBet && (
        <div className="bg-gray-700 rounded-lg p-3 text-center">
          <div className="text-sm text-gray-400">Your Bet</div>
          <div className="text-lg font-bold text-white">{activeBet} pts</div>
          {cashedOutMultiplier > 0 && (
            <div className="text-green-400 text-sm font-medium">
              Cashed out at {cashedOutMultiplier.toFixed(2)}x
            </div>
          )}
        </div>
      )}

      {saving && (
        <div className="text-center text-gray-500 text-xs">
          Saving settings...
        </div>
      )}
    </div>
  );
};

export default BetPanelOptimized;
