// 🚀 Fred's Low-Spec Device Detector
// Auto-detects weak devices using hardware metrics and probes

export function detectLowSpec() {
  try {
    // Hardware metrics (not available on all browsers/devices)
    const mem = navigator.deviceMemory || 1;            // 0.5–8 GB (not on iOS)
    const cores = navigator.hardwareConcurrency || 2;   // ~1–8 cores
    const ua = (navigator.userAgent || '').toLowerCase();
    
    // Context detection
    const isTelegram = typeof window.Telegram !== 'undefined';
    const isOldAndroidWebView = ua.includes('android') && /chrome\/(5[0-9]|6[0-6])/.test(ua); // Chrome 50-66
    const isLowEndDevice = ua.includes('android') && (
      ua.includes('android 4') || 
      ua.includes('android 5') || 
      ua.includes('android 6') ||
      ua.includes('sm-j') ||      // Samsung Galaxy J series (budget)
      ua.includes('sm-a0') ||     // Samsung Galaxy A0x series (budget) 
      ua.includes('redmi')        // Xiaomi Redmi series (budget)
    );
    
    // Hardware thresholds
    const smallRam = mem <= 2;   // ≤2GB RAM
    const fewCores = cores <= 4; // ≤4 CPU cores
    
    // Performance probe: micro busy-loop to test CPU responsiveness
    const t0 = performance.now();
    while (performance.now() - t0 < 12) {} // 12ms busy-loop probe
    const elapsed = performance.now() - t0;
    const busyProbe = elapsed > 25; // Should complete in <25ms on good devices (was too strict at 10ms)
    
    console.log(`⏱️ Performance probe: ${elapsed.toFixed(2)}ms (threshold: 25ms, failed: ${busyProbe})`);
    
    // Screen size heuristic (small screens often = budget devices)
    const smallScreen = (window.screen.width || 999) < 400 || (window.screen.height || 999) < 600;
    
    console.log('📱 Device Detection Results:', {
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
    
    // Decision logic: Only optimize when actually needed
    const shouldUseLowSpec = (
      smallRam ||             // Low memory devices (≤2GB)
      fewCores ||             // Limited CPU cores (≤4 cores)
      isOldAndroidWebView ||  // Old Chrome WebView (50-66)
      isLowEndDevice ||       // Known budget device models
      busyProbe ||            // Failed responsiveness test (now 25ms threshold)
      smallScreen             // Small screen heuristic (<400px)
      // Removed: Telegram blanket optimization - high-spec devices in Telegram get full experience
    );
    
    // Log the decision with reasoning
    if (shouldUseLowSpec) {
      const reasons = [];
      if (smallRam) reasons.push('≤2GB RAM');
      if (fewCores) reasons.push('≤4 CPU cores');
      if (isOldAndroidWebView) reasons.push('Old Android WebView');
      if (isLowEndDevice) reasons.push('Budget device model');
      if (busyProbe) reasons.push('Failed performance test');
      if (smallScreen) reasons.push('Small screen');
      
      console.log(`🥔 POTATO MODE ENABLED - Reasons: ${reasons.join(', ')}`);
    } else {
      console.log(`🚀 HIGH-SPEC MODE ENABLED - Device specs: ${mem}GB RAM, ${cores} cores${isTelegram ? ' (in Telegram)' : ''}`);
    }
    
    return shouldUseLowSpec;
  } catch (error) {
    console.error('❌ Error in low-spec detection:', error);
    // Be conservative: if detection fails, assume low-spec
    return true;
  }
}

// Export additional device info for debugging
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
