// 🎮 useGameBackend.js - React hook for syncing with WebSocket Aviator backend

import { useState, useEffect, useRef } from 'react';
import gameService from '../services/gameService';
import betHistoryService from '../services/betHistoryService';

export function useGameBackend() {
  const [isConnected, setIsConnected] = useState(false);
  const [playerId, setPlayerId] = useState(null);

  // server-driven game state:
  const [gameState, setGameState] = useState('betting');
  const [multiplier, setMultiplier] = useState(1.0);
  const [countdown, setCountdown] = useState(0);
  const [playersOnline, setPlayersOnline] = useState(0);

  // server-driven player state:
  const [balance, setBalance] = useState(0);
  const [hasActiveBet, setHasActiveBet] = useState(false);
  const [activeBetAmount, setActiveBetAmount] = useState(0);
  const [cashedOut, setCashedOut] = useState(false);
  const [cashedOutMultiplier, setCashedOutMultiplier] = useState(0);
  const [crashHistory, setCrashHistory] = useState([]);
  
  // Bet tracking state
  const [currentBetId, setCurrentBetId] = useState(null);
  
  // Debug crash history state
  console.log('🎲 Hook crashHistory state:', crashHistory);

  // store callback ref
  const listenerRef = useRef((msg) => {
    console.log('🔥 [Hook] received ws msg:', msg);

    if (msg.type === 'connected') {
      const pid = msg?.data?.playerId || msg?.data?.userId;
      if (pid) {
        console.log('🆔 Assigned player ID:', pid);
        setPlayerId(pid);
      }
      setIsConnected(true);
    }

    if (msg.type === 'gameState') {
      const d = msg.data;
      console.log('📡 Update from server:', d);
      console.log('🔍 Crash history received:', d.crashHistory);

      // We are clearly connected if we receive gameState
      setIsConnected(true);

      // Handle common game state
      setGameState(d.state);
      setMultiplier(d.multiplier);
      setCountdown(d.countdown);
      setPlayersOnline(d.playersOnline);
      if (d.crashHistory) {
        console.log('✅ Setting crash history:', d.crashHistory);
        setCrashHistory(d.crashHistory);
      } else {
        console.log('❌ No crash history in message');
      }
      
      // Player-specific data might come in playerOverlay message
      // If this message contains player data (old format), handle it
      if ('hasActiveBet' in d) {
        setHasActiveBet(d.hasActiveBet);
        setActiveBetAmount(d.activeBetAmount);
        setCashedOut(d.cashedOut);
        setCashedOutMultiplier(d.cashedOutMultiplier);
        setBalance(d.balance);
        
        // Handle crashed bets (when game crashes and player had active bet but didn't cash out)
        if (d.state === 'crashed' && currentBetId && !cashedOut) {
          console.log('💥 Recording crashed bet:', currentBetId, 'at multiplier:', d.multiplier);
          betHistoryService.recordBetOutcome(currentBetId, d.multiplier, 0); // 0 winnings = loss
          setCurrentBetId(null);
        }
      }
    }
    
    if (msg.type === 'playerOverlay') {
      const d = msg.data;
      console.log('👤 Player overlay update:', d);
      
      // Update player-specific state
      setHasActiveBet(d.hasActiveBet);
      setActiveBetAmount(d.activeBetAmount);
      setCashedOut(d.cashedOut);
      setCashedOutMultiplier(d.cashedOutMultiplier);
      setBalance(d.balance);
      
      // Dispatch balance update event
      if (d.balance !== undefined) {
        window.dispatchEvent(new CustomEvent('balanceUpdated', { 
          detail: { balance: d.balance } 
        }));
      }
      
      // Handle crashed bets (when game crashes and player had active bet but didn't cash out)
      if (gameState === 'crashed' && currentBetId && !cashedOut) {
        console.log('💥 Recording crashed bet:', currentBetId, 'at multiplier:', multiplier);
        betHistoryService.recordBetOutcome(currentBetId, multiplier, 0); // 0 winnings = loss
        setCurrentBetId(null);
      }
    }

    if (msg.type === 'betPlaced') {
      console.log('✅ [Hook] Bet placed successfully:', msg.data);
      console.log('✅ [Hook] Bet amount:', msg.data.amount, 'pts');
      console.log('✅ [Hook] New balance:', msg.data.balance, 'pts');
      
      // Record bet in history
      const bet = betHistoryService.recordBet(msg.data.amount);
      setCurrentBetId(bet.id);
    }

    if (msg.type === 'cashedOut') {
      console.log('✅ [Hook] Cashed out successfully:', msg.data);
      console.log('✅ [Hook] Winnings:', msg.data.winnings, 'pts at', msg.data.multiplier, 'x');
      console.log('✅ [Hook] New balance:', msg.data.balance, 'pts');
      
      // 🚀 FRED'S FIX: Emit event for BetPanelOptimized to show success message
      window.dispatchEvent(new CustomEvent('game:cashedOut', { 
        detail: { 
          multiplier: msg.data.multiplier,
          isAutomatic: msg.data.isAutomatic || false,
          winnings: msg.data.winnings
        } 
      }));
      
      // Record cashout in history
      if (currentBetId) {
        betHistoryService.recordBetOutcome(currentBetId, msg.data.multiplier, msg.data.winnings);
        setCurrentBetId(null);
      }
    }
  });

  // initial connect
  useEffect(() => {
    gameService.connect();
    gameService.addListener(listenerRef.current);

    // If the WS already connected before listener attached, mark as connected
    if (gameService.isConnected) {
      setIsConnected(true);
    }

    return () => {
      gameService.removeListener(listenerRef.current);
      gameService.disconnect();
    };
  }, []);

  // Enhanced bet placement with limit checking
  const placeBetWithLimits = (amount) => {
    const limitCheck = betHistoryService.canPlaceBet(amount);
    if (!limitCheck.allowed) {
      console.warn('Bet blocked by daily limits:', limitCheck.reasons);
      return { success: false, reasons: limitCheck.reasons };
    }
    gameService.placeBet(amount);
    return { success: true };
  };

  return {
    isConnected,
    playerId,
    gameState,
    multiplier,
    countdown,
    playersOnline,
    crashHistory,

    // synced player values
    playerBalance: balance,
    hasActiveBet,
    activeBetAmount,
    cashedOut,
    cashedOutMultiplier,

    // actions
    placeBet: placeBetWithLimits,
    cashOut: () => gameService.cashOut(),
    checkHealth: () => gameService.checkHealth(),
    
    // betting history & stats
    getBetHistory: () => betHistoryService.getRecentHistory(),
    getStats: () => betHistoryService.getStats(),
    getDailyLimits: () => betHistoryService.getDailyLimitsStatus(),
    canPlaceBet: (amount) => betHistoryService.canPlaceBet(amount)
  };
}
