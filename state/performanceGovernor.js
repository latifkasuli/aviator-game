import { detectLowSpec } from '../utils/lowSpecDetector.js';

export const perf = {
  lowSpec: false,
  initialized: false,
  
  multiplierFps: 20,
  planeFps: 60,
  broadcastThrottle: 200,
  
  glowEffects: true,
  animations: true,
  backgroundEffects: true,
  
  audioEnabled: true,
  hapticsEnabled: true,
  
  useCanvas: false,
  reducedMotion: false,
  
  showPerfHUD: false,
};

export function initPerformanceGovernor(forceLowSpec = null) {
  console.log('Initializing performance governor...');
  
  const urlParams = new URLSearchParams(window.location.search);
  const lowSpecOverride = urlParams.get('lowspec') === '1' || urlParams.get('low') === '1';
  const perfHUDOverride = urlParams.get('perf') === '1' || urlParams.get('debug') === '1';
  
  if (forceLowSpec !== null) {
    perf.lowSpec = !!forceLowSpec;
    console.log(`Low-spec mode forced: ${perf.lowSpec}`);
  } else if (lowSpecOverride) {
    perf.lowSpec = true;
    console.log('Low-spec mode enabled via URL parameter');
  } else {
    perf.lowSpec = detectLowSpec();
    console.log(`Low-spec mode auto-detected: ${perf.lowSpec}`);
  }
  
  if (perf.lowSpec) {
    perf.multiplierFps = 10;
    perf.planeFps = 30;
    perf.broadcastThrottle = 250;
    
    perf.glowEffects = false;
    perf.animations = false;
    perf.backgroundEffects = false;
    
    perf.audioEnabled = false;
    perf.hapticsEnabled = false;
    
    perf.useCanvas = true;
    perf.reducedMotion = true;
    
    console.log('Low-spec mode: performance profile enabled');
  } else {
    perf.multiplierFps = 20;
    perf.planeFps = 60;
    perf.broadcastThrottle = 200;
    
    perf.glowEffects = true;
    perf.animations = true;
    perf.backgroundEffects = true;
    
    perf.audioEnabled = true;
    perf.hapticsEnabled = true;
    
    perf.useCanvas = false;
    perf.reducedMotion = false;
    
    console.log('High-performance mode enabled');
  }
  
  perf.showPerfHUD = perfHUDOverride;
  
  document.body.classList.toggle('low-spec', perf.lowSpec);
  document.body.classList.toggle('high-spec', !perf.lowSpec);
  document.body.classList.toggle('perf-hud', perf.showPerfHUD);
  
  document.documentElement.style.setProperty('--multiplier-fps', perf.multiplierFps);
  document.documentElement.style.setProperty('--plane-fps', perf.planeFps);
  
  perf.initialized = true;
  
  console.log('Performance governor initialized:', perf);
  
  window.dispatchEvent(new CustomEvent('performance:initialized', { 
    detail: { ...perf } 
  }));
  
  return perf;
}

export function updatePerformanceSetting(key, value) {
  if (perf.hasOwnProperty(key)) {
    const oldValue = perf[key];
    perf[key] = value;
    console.log(`Performance setting updated: ${key} ${oldValue} -> ${value}`);
    
    if (key === 'lowSpec') {
      document.body.classList.toggle('low-spec', value);
      document.body.classList.toggle('high-spec', !value);
    }
    
    window.dispatchEvent(new CustomEvent('performance:updated', { 
      detail: { key, oldValue, newValue: value } 
    }));
  } else {
    console.warn(`Unknown performance setting: ${key}`);
  }
}

export const isLowSpec = () => perf.lowSpec;
export const shouldUseCanvas = () => perf.useCanvas;
export const getMultiplierFPS = () => perf.multiplierFps;
export const getPlaneFPS = () => perf.planeFps;
export const shouldPlayAudio = () => perf.audioEnabled;
export const shouldUseHaptics = () => perf.hapticsEnabled;
export const shouldShowGlowEffects = () => perf.glowEffects;
export const shouldShowAnimations = () => perf.animations;
export const getBroadcastThrottle = () => perf.broadcastThrottle;

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

export default perf;
