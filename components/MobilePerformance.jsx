import React, { useEffect, useState, useCallback } from 'react';

const MobilePerformance = {
  isMobile: () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  },

  isTouchDevice: () => {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  },

  getPixelRatio: () => {
    return window.devicePixelRatio || 1;
  },

  optimizeAnimations: () => {
    if (MobilePerformance.isMobile()) {
      document.documentElement.style.setProperty('--animation-duration', '0.2s');
      document.documentElement.style.setProperty('--transition-duration', '0.15s');
    }
  },

  debounce: (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  throttle: (func, limit) => {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  lazyLoadImages: () => {
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            img.classList.remove('lazy');
            imageObserver.unobserve(img);
          }
        });
      });

      document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
      });
    }
  },

  optimizeWebSocket: (ws) => {
    if (MobilePerformance.isMobile()) {
      const originalSend = ws.send;
      let lastSent = 0;
      const minInterval = 100;

      ws.send = function(data) {
        const now = Date.now();
        if (now - lastSent >= minInterval) {
          originalSend.call(this, data);
          lastSent = now;
        }
      };
    }
  },

  cleanupMemory: () => {
    if (window.gc) {
      window.gc();
    }
    
    const events = ['resize', 'scroll', 'touchmove', 'touchstart', 'touchend'];
    events.forEach(event => {
      const listeners = window.getEventListeners?.(window)?.[event] || [];
      listeners.forEach(listener => {
        if (listener.useCapture === false && !listener.passive) {
          window.removeEventListener(event, listener.listener);
        }
      });
    });
  },

  optimizeForBattery: () => {
    if ('getBattery' in navigator) {
      navigator.getBattery().then(battery => {
        const updateBatteryOptimizations = () => {
          if (battery.level < 0.2 || !battery.charging) {
            document.documentElement.classList.add('low-battery-mode');
            document.documentElement.style.setProperty('--animation-duration', '0.1s');
            document.documentElement.style.setProperty('--glow-opacity', '0.1');
          } else {
            document.documentElement.classList.remove('low-battery-mode');
            document.documentElement.style.removeProperty('--animation-duration');
            document.documentElement.style.removeProperty('--glow-opacity');
          }
        };

        battery.addEventListener('levelchange', updateBatteryOptimizations);
        battery.addEventListener('chargingchange', updateBatteryOptimizations);
        updateBatteryOptimizations();
      });
    }
  },

  optimizeForNetwork: () => {
    if ('connection' in navigator) {
      const connection = navigator.connection;
      const updateNetworkOptimizations = () => {
        if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
          document.documentElement.classList.add('slow-network');
          window.dispatchEvent(new CustomEvent('slowNetwork', { detail: true }));
        } else {
          document.documentElement.classList.remove('slow-network');
          window.dispatchEvent(new CustomEvent('slowNetwork', { detail: false }));
        }
      };

      connection.addEventListener('change', updateNetworkOptimizations);
      updateNetworkOptimizations();
    }
  }
};

export const useMobilePerformance = () => {
  const [performanceMetrics, setPerformanceMetrics] = useState({
    fps: 60,
    memoryUsage: 0,
    isLowPower: false,
    networkSpeed: 'fast'
  });

  const measureFPS = useCallback(() => {
    let frames = 0;
    let lastTime = performance.now();

    const countFrames = (currentTime) => {
      frames++;
      if (currentTime >= lastTime + 1000) {
        const fps = Math.round((frames * 1000) / (currentTime - lastTime));
        setPerformanceMetrics(prev => ({ ...prev, fps }));
        frames = 0;
        lastTime = currentTime;
      }
      requestAnimationFrame(countFrames);
    };

    requestAnimationFrame(countFrames);
  }, []);

  const measureMemory = useCallback(() => {
    if ('memory' in performance) {
      const memory = performance.memory;
      const memoryUsage = Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100);
      setPerformanceMetrics(prev => ({ ...prev, memoryUsage }));
    }
  }, []);

  useEffect(() => {
    measureFPS();
    
    const memoryInterval = setInterval(measureMemory, 5000);
    
    if ('getBattery' in navigator) {
      navigator.getBattery().then(battery => {
        const updatePowerMode = () => {
          setPerformanceMetrics(prev => ({
            ...prev,
            isLowPower: battery.level < 0.2 || !battery.charging
          }));
        };
        
        battery.addEventListener('levelchange', updatePowerMode);
        battery.addEventListener('chargingchange', updatePowerMode);
        updatePowerMode();
      });
    }

    if ('connection' in navigator) {
      const connection = navigator.connection;
      const updateNetworkSpeed = () => {
        const speed = connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g' 
          ? 'slow' : 'fast';
        setPerformanceMetrics(prev => ({ ...prev, networkSpeed: speed }));
      };
      
      connection.addEventListener('change', updateNetworkSpeed);
      updateNetworkSpeed();
    }

    return () => {
      clearInterval(memoryInterval);
    };
  }, [measureFPS, measureMemory]);

  return performanceMetrics;
};

export const PerformanceMonitor = ({ showMetrics = false }) => {
  const metrics = useMobilePerformance();

  if (!showMetrics) return null;

  return (
    <div className="fixed top-16 right-4 bg-black bg-opacity-75 text-white p-2 rounded text-xs font-mono z-50">
      <div>FPS: {metrics.fps}</div>
      <div>Memory: {metrics.memoryUsage}%</div>
      <div>Power: {metrics.isLowPower ? 'Low' : 'Normal'}</div>
      <div>Network: {metrics.networkSpeed}</div>
    </div>
  );
};

export const initializeMobileOptimizations = () => {
  MobilePerformance.optimizeAnimations();
  MobilePerformance.optimizeForBattery();
  MobilePerformance.optimizeForNetwork();
  
  window.addEventListener('beforeunload', () => {
    MobilePerformance.cleanupMemory();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      window.dispatchEvent(new CustomEvent('appBackground'));
    } else {
      window.dispatchEvent(new CustomEvent('appForeground'));
    }
  });

  console.log('Mobile optimizations initialized');
};

export default MobilePerformance;
