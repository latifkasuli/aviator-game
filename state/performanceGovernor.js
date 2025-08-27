// 🚀 Fred's Performance Governor
// Global performance state manager for device-appropriate settings

import { detectLowSpec } from '../utils/lowSpecDetector.js';

// Global performance configuration
export const perf = {
  // Detection state
  lowSpec: false,
  initialized: false,
  
  // Frame rate controls
  multiplierFps: 20,       // DOM text updates per second
  planeFps: 60,            // Canvas animation rate
  broadcastThrottle: 200,  // WebSocket message throttling (ms)
  
  // Visual effects
  glowEffects: true,       // CSS glows and shadows
  animations: true,        // CSS animations and transitions
  backgroundEffects: true, // Particle effects, backgrounds
  
  // Audio & interaction
  audioEnabled: true,      // Sound effects
  hapticsEnabled: true,    // Telegram haptic feedback
  
  // Rendering optimizations
  useCanvas: false,        // Use Canvas instead of DOM for critical animations
  reducedMotion: false,    // Respect user's motion preferences
  
  // Debug
  showPerfHUD: false,      // Performance debugging overlay
};

// Initialize the performance governor
export function initPerformanceGovernor(forceLowSpec = null) {
  console.log('⚡ Initializing Performance Governor...');
  
  // Check URL parameters for overrides
  const urlParams = new URLSearchParams(window.location.search);
  const lowSpecOverride = urlParams.get('lowspec') === '1' || urlParams.get('low') === '1';
  const perfHUDOverride = urlParams.get('perf') === '1' || urlParams.get('debug') === '1';
  
  // Determine low-spec mode
  if (forceLowSpec !== null) {
    perf.lowSpec = !!forceLowSpec;
    console.log(`📱 Low-spec mode FORCED: ${perf.lowSpec}`);
  } else if (lowSpecOverride) {
    perf.lowSpec = true;
    console.log('📱 Low-spec mode ENABLED via URL parameter');
  } else {
    perf.lowSpec = detectLowSpec();
    console.log(`📱 Low-spec mode AUTO-DETECTED: ${perf.lowSpec}`);
  }
  
  // Configure performance settings based on device capability
  if (perf.lowSpec) {
    // 🥔 Potato phone settings - prioritize smoothness over beauty
    perf.multiplierFps = 10;        // Very low DOM text update rate
    perf.planeFps = 30;             // Reduced canvas animation rate
    perf.broadcastThrottle = 250;   // Less frequent WebSocket updates
    
    perf.glowEffects = false;       // No expensive CSS effects
    perf.animations = false;        // Minimal animations
    perf.backgroundEffects = false; // No particle effects
    
    perf.audioEnabled = false;      // No audio processing overhead
    perf.hapticsEnabled = false;    // No haptic feedback
    
    perf.useCanvas = true;          // Canvas is more performant than DOM
    perf.reducedMotion = true;      // Minimal motion
    
    console.log('🥔 POTATO MODE: Performance optimized for low-end devices');
  } else {
    // 🚀 High-end device settings - full experience
    perf.multiplierFps = 20;        // Smooth DOM text updates
    perf.planeFps = 60;             // Full-rate canvas animation
    perf.broadcastThrottle = 200;   // Standard WebSocket throttling
    
    perf.glowEffects = true;        // Beautiful CSS effects
    perf.animations = true;         // Full animations
    perf.backgroundEffects = true;  // Rich visual effects
    
    perf.audioEnabled = true;       // Full audio experience
    perf.hapticsEnabled = true;     // Haptic feedback
    
    perf.useCanvas = false;         // DOM is fine on good devices
    perf.reducedMotion = false;     // Full motion effects
    
    console.log('🚀 HIGH-PERFORMANCE MODE: Full visual experience enabled');
  }
  
  // Debug HUD
  perf.showPerfHUD = perfHUDOverride;
  
  // Apply CSS class to body for styling
  document.body.classList.toggle('low-spec', perf.lowSpec);
  document.body.classList.toggle('high-spec', !perf.lowSpec);
  document.body.classList.toggle('perf-hud', perf.showPerfHUD);
  
  // Set CSS custom properties for dynamic theming
  document.documentElement.style.setProperty('--multiplier-fps', perf.multiplierFps);
  document.documentElement.style.setProperty('--plane-fps', perf.planeFps);
  
  perf.initialized = true;
  
  console.log('⚡ Performance Governor initialized:', perf);
  
  // Dispatch event for other components to listen
  window.dispatchEvent(new CustomEvent('performance:initialized', { 
    detail: { ...perf } 
  }));
  
  return perf;
}

// Runtime performance setting updates
export function updatePerformanceSetting(key, value) {
  if (perf.hasOwnProperty(key)) {
    const oldValue = perf[key];
    perf[key] = value;
    console.log(`⚡ Performance setting updated: ${key} ${oldValue} → ${value}`);
    
    // Update CSS class if needed
    if (key === 'lowSpec') {
      document.body.classList.toggle('low-spec', value);
      document.body.classList.toggle('high-spec', !value);
    }
    
    // Dispatch update event
    window.dispatchEvent(new CustomEvent('performance:updated', { 
      detail: { key, oldValue, newValue: value } 
    }));
  } else {
    console.warn(`⚠️ Unknown performance setting: ${key}`);
  }
}

// Convenience getters for common checks
export const isLowSpec = () => perf.lowSpec;
export const shouldUseCanvas = () => perf.useCanvas;
export const getMultiplierFPS = () => perf.multiplierFps;
export const getPlaneFPS = () => perf.planeFps;
export const shouldPlayAudio = () => perf.audioEnabled;
export const shouldUseHaptics = () => perf.hapticsEnabled;
export const shouldShowGlowEffects = () => perf.glowEffects;
export const shouldShowAnimations = () => perf.animations;
export const getBroadcastThrottle = () => perf.broadcastThrottle;

// Performance monitoring helpers
export const perfMonitor = {
  frameCount: 0,
  lastFrameTime: 0,
  fps: 0,
  
  tick() {
    const now = performance.now();
    this.frameCount++;
    if (now - this.lastFrameTime >= 1000) {
      this.fps = Math.round(this.frameCount * 1000 / (now - this.lastFrameTime));
      this.frameCount = 0;
      this.lastFrameTime = now;
    }
  },
  
  getFPS() {
    return this.fps;
  }
};

// Export the performance object as default for easy importing
export default perf;
