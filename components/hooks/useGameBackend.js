import { useState, useEffect, useRef } from 'react';
import gameService from '../services/gameService';
import betHistoryService from '../services/betHistoryService';

export function useGameBackend() {
  const [isConnected, setIsConnected] = useState(false);
  const [playerId, setPlayerId] = useState(null);

  const [gameState, setGameState] = useState('betting');
  const [multiplier, setMultiplier] = useState(1.0);
  const [countdown, setCountdown] = useState(0);
  const [playersOnline, setPlayersOnline] = useState(0);

  const [balance, setBalance] = useState(0);
  const [hasActiveBet, setHasActiveBet] = useState(false);
  const [activeBetAmount, setActiveBetAmount] = useState(0);
  const [cashedOut, setCashedOut] = useState(false);
  const [cashedOutMultiplier, setCashedOutMultiplier] = useState(0);
  const [crashHistory, setCrashHistory] = useState([]);
  
  const [currentBetId, setCurrentBetId] = useState(null);

  const listenerRef = useRef((msg) => {
    if (msg.type === 'connected') {
      const pid = msg?.data?.playerId || msg?.data?.userId;
      if (pid) {
        setPlayerId(pid);
      }
      setIsConnected(true);
    }

    if (msg.type === 'gameState') {
      const d = msg.data;
      setIsConnected(true);

      setGameState(d.state);
      setMultiplier(d.multiplier);
      setCountdown(d.countdown);
      setPlayersOnline(d.playersOnline);
      if (d.crashHistory) {
        setCrashHistory(d.crashHistory);
      }
      
      if ('hasActiveBet' in d) {
        setHasActiveBet(d.hasActiveBet);
        setActiveBetAmount(d.activeBetAmount);
        setCashedOut(d.cashedOut);
        setCashedOutMultiplier(d.cashedOutMultiplier);
        setBalance(d.balance);
        
        if (d.state === 'crashed' && currentBetId && !cashedOut) {
          betHistoryService.recordBetOutcome(currentBetId, d.multiplier, 0);
          setCurrentBetId(null);
        }
      }
    }
    
    if (msg.type === 'playerOverlay') {
      const d = msg.data;

      setHasActiveBet(d.hasActiveBet);
      setActiveBetAmount(d.activeBetAmount);
      setCashedOut(d.cashedOut);
      setCashedOutMultiplier(d.cashedOutMultiplier);
      setBalance(d.balance);
      
      if (d.balance !== undefined) {
        window.dispatchEvent(new CustomEvent('balanceUpdated', { 
          detail: { balance: d.balance } 
        }));
      }
      
      if (gameState === 'crashed' && currentBetId && !cashedOut) {
        betHistoryService.recordBetOutcome(currentBetId, multiplier, 0);
        setCurrentBetId(null);
      }
    }

    if (msg.type === 'betPlaced') {
      const bet = betHistoryService.recordBet(msg.data.amount);
      setCurrentBetId(bet.id);
    }

    if (msg.type === 'cashedOut') {
      window.dispatchEvent(new CustomEvent('game:cashedOut', { 
        detail: { 
          multiplier: msg.data.multiplier,
          isAutomatic: msg.data.isAutomatic || false,
          winnings: msg.data.winnings
        } 
      }));
      
      if (currentBetId) {
        betHistoryService.recordBetOutcome(currentBetId, msg.data.multiplier, msg.data.winnings);
        setCurrentBetId(null);
      }
    }
  });

  useEffect(() => {
    gameService.connect();
    gameService.addListener(listenerRef.current);

    if (gameService.isConnected) {
      setIsConnected(true);
    }

    return () => {
      gameService.removeListener(listenerRef.current);
      gameService.disconnect();
    };
  }, []);

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

    playerBalance: balance,
    hasActiveBet,
    activeBetAmount,
    cashedOut,
    cashedOutMultiplier,

    placeBet: placeBetWithLimits,
    cashOut: () => gameService.cashOut(),
    checkHealth: () => gameService.checkHealth(),
    
    getBetHistory: () => betHistoryService.getRecentHistory(),
    getStats: () => betHistoryService.getStats(),
    getDailyLimits: () => betHistoryService.getDailyLimitsStatus(),
    canPlaceBet: (amount) => betHistoryService.canPlaceBet(amount)
  };
}
