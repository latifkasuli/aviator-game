export function detectLowSpec() {
  try {
    const mem = navigator.deviceMemory || 1;
    const cores = navigator.hardwareConcurrency || 2;
    const ua = (navigator.userAgent || '').toLowerCase();
    
    const isTelegram = typeof window.Telegram !== 'undefined';
    const isOldAndroidWebView = ua.includes('android') && /chrome\/(5[0-9]|6[0-6])/.test(ua);
    const isLowEndDevice = ua.includes('android') && (
      ua.includes('android 4') || 
      ua.includes('android 5') || 
      ua.includes('android 6') ||
      ua.includes('sm-j') ||
      ua.includes('sm-a0') ||
      ua.includes('redmi')
    );
    
    const smallRam = mem <= 2;
    const fewCores = cores <= 4;
    
    const t0 = performance.now();
    while (performance.now() - t0 < 12) {}
    const elapsed = performance.now() - t0;
    const busyProbe = elapsed > 25;
    
    console.log(`Performance probe: ${elapsed.toFixed(2)}ms (threshold: 25ms, failed: ${busyProbe})`);
    
    const smallScreen = (window.screen.width || 999) < 400 || (window.screen.height || 999) < 600;
    
    console.log('Device detection results:', {
      deviceMemory: mem,
      hardwareConcurrency: cores,
      isTelegram,
      isOldAndroidWebView,
      isLowEndDevice,
      smallRam,
      fewCores,
      busyProbe,
      smallScreen,
      userAgent: ua.substring(0, 100) + '...'
    });
    
    const shouldUseLowSpec = (
      smallRam ||
      fewCores ||
      isOldAndroidWebView ||
      isLowEndDevice ||
      busyProbe ||
      smallScreen
    );
    
    if (shouldUseLowSpec) {
      const reasons = [];
      if (smallRam) reasons.push('≤2GB RAM');
      if (fewCores) reasons.push('≤4 CPU cores');
      if (isOldAndroidWebView) reasons.push('Old Android WebView');
      if (isLowEndDevice) reasons.push('Budget device model');
      if (busyProbe) reasons.push('Failed performance test');
      if (smallScreen) reasons.push('Small screen');
      
      console.log(`Low-spec mode enabled: ${reasons.join(', ')}`);
    } else {
      console.log(`High-spec mode enabled: ${mem}GB RAM, ${cores} cores${isTelegram ? ' (in Telegram)' : ''}`);
    }
    
    return shouldUseLowSpec;
  } catch (error) {
    console.error('Error in low-spec detection:', error);
    return true;
  }
}

export function getDeviceInfo() {
  try {
    return {
      userAgent: navigator.userAgent || 'unknown',
      deviceMemory: navigator.deviceMemory || 'unknown',
      hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
      platform: navigator.platform || 'unknown',
      screenWidth: window.screen.width || 'unknown',
      screenHeight: window.screen.height || 'unknown',
      pixelRatio: window.devicePixelRatio || 1,
      isTelegram: typeof window.Telegram !== 'undefined',
      connection: navigator.connection ? {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt
      } : 'unknown'
    };
  } catch (error) {
    return { error: error.message };
  }
}
