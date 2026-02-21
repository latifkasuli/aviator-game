import React, { useEffect, useRef } from 'react';
import useOptimizedAnimation from './hooks/useOptimizedAnimation.js';

export default function MultiplierDisplayOptimized({ lastServerTick, gameState, countdown }) {
  const spanRef = useRef(null);
  const { updateServerFrame, setCrashed } = useOptimizedAnimation({
    onApply: (mult) => {
      if (!spanRef.current) return;
      
      if (gameState === 'crashed') {
        spanRef.current.textContent = 'FLEW AWAY!';
        spanRef.current.className = 'text-6xl md:text-7xl font-black font-mono tracking-wider text-red-400 drop-shadow-[0_0_20px_rgba(239,68,68,0.8)] animate-bounce';
      } else {
        spanRef.current.textContent = mult.toFixed(2) + 'x';
        
        let colorClass, glowClass;
        if (mult >= 10) {
          colorClass = 'text-yellow-400';
          glowClass = 'drop-shadow-[0_0_20px_rgba(251,191,36,0.8)]';
        } else if (mult >= 5) {
          colorClass = 'text-purple-400';
          glowClass = 'drop-shadow-[0_0_20px_rgba(168,85,247,0.8)]';
        } else if (mult >= 2) {
          colorClass = 'text-blue-400';
          glowClass = 'drop-shadow-[0_0_20px_rgba(59,130,246,0.8)]';
        } else {
          colorClass = 'text-green-400';
          glowClass = 'drop-shadow-[0_0_20px_rgba(34,197,94,0.8)]';
        }
        
        const pulseClass = gameState === 'running' ? 'animate-pulse' : '';
        spanRef.current.className = `text-6xl md:text-7xl font-black font-mono tracking-wider ${colorClass} ${glowClass} ${pulseClass}`;
      }
    },
  });

  useEffect(() => {
    if (!lastServerTick) return;
    const { serverTime, multiplier, state } = lastServerTick;
    updateServerFrame(serverTime, multiplier);
    if (state === 'crashed') setCrashed(multiplier);
  }, [lastServerTick, updateServerFrame, setCrashed]);

  return (
    <div className="text-center">
      <span ref={spanRef} className="text-6xl md:text-7xl font-black font-mono tracking-wider text-green-400 drop-shadow-[0_0_20px_rgba(34,197,94,0.8)]">
        1.00x
      </span>
      
      <div className="mt-4 space-y-2">
        {gameState === 'betting' && countdown > 0 && (
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-400 animate-pulse">
              {countdown}
            </div>
            <div className="text-sm text-gray-400 font-medium">
              Starting in...
            </div>
          </div>
        )}
        
        {gameState === 'betting' && countdown <= 0 && (
          <div className="text-gray-400 text-sm font-medium">
            Place your bets now!
          </div>
        )}
        
        {gameState === 'running' && (
          <div className="text-gray-300 text-sm font-medium animate-pulse">
            Flying... Cash out before it crashes!
          </div>
        )}
        
        {gameState === 'crashed' && (
          <div className="text-red-400 text-sm font-bold">
            Better luck next time!
          </div>
        )}
      </div>
    </div>
  );
}
