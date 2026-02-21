import React, { useEffect, useRef } from 'react';
import useOptimizedAnimation from './hooks/useOptimizedAnimation.js';

export default function PlaneOptimized({ wsState, gameState, lastServerTick }) {
  const planeRef = useRef(null);

  const { updateServerFrame, setCrashed } = useOptimizedAnimation({
    onApply: (mult) => {
      if (!planeRef.current) return;
      
      let x = 20, y = 75, rotation = 0;
      
      if (gameState === 'betting') {
        x = 20; y = 75; rotation = 0;
      } else if (gameState === 'running') {
        const t = Math.min(mult / 5, 1);
        x = 20 + t * 50 + Math.sin(Date.now() / 300) * 2;
        y = 75 - Math.pow(t, 0.7) * 50;
        rotation = 2 - (t * 12);
        
        const isMobile = window.innerWidth < 640;
        const maxX = isMobile ? 80 : 85;
        const minY = isMobile ? 20 : 15;
        x = Math.min(x, maxX);
        y = Math.max(y, minY);
      } else if (gameState === 'crashed') {
        x = 110; y = 5; rotation = -15;
      }
      
      planeRef.current.style.transform = `translate(${x}vw, ${y}vh) rotate(${rotation}deg)`;
      planeRef.current.style.willChange = 'transform';
    }
  });

  useEffect(() => {
    if (!lastServerTick) return;
    const { serverTime, multiplier, state } = lastServerTick;
    updateServerFrame(serverTime, multiplier);
    if (state === 'crashed') setCrashed(multiplier);
  }, [lastServerTick, updateServerFrame, setCrashed]);

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
      <div
        ref={planeRef}
        className="absolute w-12 h-8 flex items-center justify-center"
        style={{ 
          transform: 'translate(20vw, 75vh) rotate(0deg)',
          transition: 'none'
        }}
        aria-label="plane"
      >
        <svg viewBox="0 0 48 32" className="w-full h-full">
          <defs>
            <linearGradient id="planeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="50%" stopColor="#1e40af" />
              <stop offset="100%" stopColor="#1e3a8a" />
            </linearGradient>
            <filter id="planeShadow">
              <feDropShadow dx="2" dy="2" stdDeviation="1" floodColor="rgba(0,0,0,0.3)" />
            </filter>
          </defs>
          
          <ellipse cx="24" cy="16" rx="20" ry="3" fill="url(#planeGradient)" filter="url(#planeShadow)" />

          <ellipse cx="18" cy="16" rx="8" ry="2" fill="#1e40af" />
          <ellipse cx="30" cy="16" rx="6" ry="1.5" fill="#1e3a8a" />

          <circle cx="38" cy="16" r="2" fill="#60a5fa" />
          <circle cx="38" cy="16" r="1" fill="#93c5fd" opacity="0.8" />
        </svg>
      </div>
    </div>
  );
}
