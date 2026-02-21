import React, { useEffect, useRef, useCallback } from 'react';
import { perf, perfMonitor, getPlaneFPS, isLowSpec } from '../state/performanceGovernor.js';

export default function CanvasRenderer({ 
  getCurrentMultiplier, 
  gameState, 
  countdown = 0,
  crashPoint = null 
}) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const lastFrameRef = useRef(0);
  const animationStateRef = useRef({
    planeX: 0,
    planeY: 0,
    targetX: 0,
    targetY: 0
  });

  const render = useCallback((timestamp) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const now = timestamp || performance.now();
    
    const targetFPS = getPlaneFPS();
    const frameInterval = 1000 / targetFPS;
    
    if (now - lastFrameRef.current < frameInterval) {
      rafRef.current = requestAnimationFrame(render);
      return;
    }
    lastFrameRef.current = now;
    
    perfMonitor.tick();
    
    const multiplier = getCurrentMultiplier();
    
    const DPR = Math.min(window.devicePixelRatio || 1, isLowSpec() ? 1 : 2);
    const rect = canvas.getBoundingClientRect();
    const W = rect.width * DPR;
    const H = rect.height * DPR;
    
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
      ctx.scale(DPR, DPR);
    }
    
    const w = rect.width;
    const h = rect.height;
    
    ctx.fillStyle = isLowSpec() ? '#111827' : '#0f172a';
    ctx.fillRect(0, 0, w, h);
    
    if (gameState === 'running' && multiplier > 1) {
      const progress = Math.max(0, multiplier - 1);
      const maxX = w - 40;
      const maxY = h * 0.4;
      
      animationStateRef.current.targetX = 20 + maxX * Math.tanh(progress / 6);
      animationStateRef.current.targetY = h * 0.7 - maxY * Math.tanh(progress / 8);
      
      const lerpFactor = isLowSpec() ? 0.3 : 0.15;
      animationStateRef.current.planeX += (animationStateRef.current.targetX - animationStateRef.current.planeX) * lerpFactor;
      animationStateRef.current.planeY += (animationStateRef.current.targetY - animationStateRef.current.planeY) * lerpFactor;
      
      const x = animationStateRef.current.planeX;
      const y = animationStateRef.current.planeY;
      
      ctx.fillStyle = isLowSpec() ? '#10b981' : '#2dd4bf';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 16, y + 8);
      ctx.lineTo(x - 8, y);
      ctx.lineTo(x - 16, y - 8);
      ctx.closePath();
      ctx.fill();
      
      if (!isLowSpec() && progress > 2) {
        ctx.fillStyle = 'rgba(45, 212, 191, 0.3)';
        for (let i = 1; i <= 3; i++) {
          ctx.beginPath();
          ctx.arc(x - i * 8, y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else {
      animationStateRef.current.planeX = 20;
      animationStateRef.current.planeY = h * 0.7;
      
      ctx.fillStyle = '#6b7280';
      ctx.beginPath();
      ctx.moveTo(20, h * 0.7);
      ctx.lineTo(4, h * 0.7 + 8);
      ctx.lineTo(12, h * 0.7);
      ctx.lineTo(4, h * 0.7 - 8);
      ctx.closePath();
      ctx.fill();
    }
    
    const baseFontSize = isLowSpec() ? 28 : 36;
    const fontSize = Math.min(baseFontSize, w / 8);
    ctx.font = `bold ${fontSize}px ${isLowSpec() ? 'monospace' : 'ui-monospace, monospace'}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    let multiplierColor;
    if (gameState === 'crashed') {
      multiplierColor = '#ef4444';
    } else if (multiplier >= 10) {
      multiplierColor = isLowSpec() ? '#fbbf24' : '#f59e0b';
    } else if (multiplier >= 5) {
      multiplierColor = isLowSpec() ? '#a855f7' : '#8b5cf6';
    } else if (multiplier >= 2) {
      multiplierColor = isLowSpec() ? '#3b82f6' : '#2563eb';
    } else {
      multiplierColor = isLowSpec() ? '#10b981' : '#059669';
    }
    
    ctx.fillStyle = multiplierColor;
    
    let multiplierText;
    if (gameState === 'crashed') {
      multiplierText = crashPoint ? `${crashPoint.toFixed(2)}x` : 'CRASHED!';
    } else {
      multiplierText = `${multiplier.toFixed(2)}x`;
    }
    
    if (!isLowSpec() && gameState === 'running') {
      ctx.shadowColor = multiplierColor;
      ctx.shadowBlur = 15;
    }
    
    ctx.fillText(multiplierText, w / 2, h * 0.25);
    
    ctx.shadowBlur = 0;
    
    ctx.font = `${isLowSpec() ? 12 : 14}px ${isLowSpec() ? 'sans-serif' : 'ui-sans-serif, sans-serif'}`;
    ctx.fillStyle = '#9ca3af';
    
    let statusText;
    if (gameState === 'betting') {
      if (countdown > 0) {
        statusText = `Starting in ${countdown}s...`;
        ctx.fillStyle = '#fbbf24';
      } else {
        statusText = 'Place your bets!';
      }
    } else if (gameState === 'running') {
      statusText = 'Cash out before it crashes!';
      ctx.fillStyle = '#10b981';
    } else if (gameState === 'crashed') {
      statusText = 'Better luck next time!';
      ctx.fillStyle = '#ef4444';
    } else {
      statusText = 'Get ready...';
    }
    
    ctx.fillText(statusText, w / 2, h * 0.85);
    
    if (perf.showPerfHUD) {
      ctx.font = '10px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.fillText(`FPS: ${perfMonitor.getFPS()}`, 10, 20);
      ctx.fillText(`Mode: ${isLowSpec() ? 'LOW-SPEC' : 'HIGH-SPEC'}`, 10, 35);
      ctx.fillText(`Target FPS: ${targetFPS}`, 10, 50);
      ctx.fillText(`Canvas: ${W}x${H} (DPR: ${DPR})`, 10, 65);
    }
    
    rafRef.current = requestAnimationFrame(render);
  }, [getCurrentMultiplier, gameState, countdown, crashPoint]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    rafRef.current = requestAnimationFrame(render);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [render]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      } else {
        if (!rafRef.current) {
          rafRef.current = requestAnimationFrame(render);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [render]);

  return (
    <div style={{ 
      width: '100%', 
      height: isLowSpec() ? '160px' : '200px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          imageRendering: isLowSpec() ? 'pixelated' : 'auto'
        }}
        aria-label={`Game canvas showing ${gameState} state with ${getCurrentMultiplier().toFixed(2)}x multiplier`}
      />
    </div>
  );
}
