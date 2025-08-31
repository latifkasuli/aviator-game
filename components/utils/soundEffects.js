// 🔊 Sound Effects Utility for Aviator Game
// Uses actual sound files from assets

class SoundEffects {
  constructor() {
    this.enabled = true;
    this.volume = 0.3;
    this.sounds = {};
    this.bgMusic = null;
    this.loadSounds();
  }

  // Load all sound files
  async loadSounds() {
    const soundFiles = {
      bet: '/assets/general/sound/take.mp3',
      cashout: '/assets/general/sound/win.mp3',
      crash: '/assets/general/sound/flew.mp3',
      background: '/assets/general/sound/bg-sound.mp3'
    };

    // Pre-load all sounds
    for (const [key, path] of Object.entries(soundFiles)) {
      try {
        const audio = new Audio(path);
        audio.preload = 'auto';
        audio.volume = this.volume;
        
        if (key === 'background') {
          audio.loop = true;
          this.bgMusic = audio;
        } else {
          this.sounds[key] = audio;
        }
      } catch (error) {
        console.warn(`Failed to load sound ${key}:`, error);
      }
    }
  }

  // Play a sound by key
  playSound(key) {
    if (!this.enabled || !this.sounds[key]) return;

    try {
      const audio = this.sounds[key].cloneNode();
      audio.volume = this.volume;
      audio.play().catch(err => {
        if (err.name !== 'AbortError') {
          console.warn(`Failed to play sound ${key}:`, err);
        }
      });
    } catch (error) {
      console.warn(`Error playing sound ${key}:`, error);
    }
  }

  // Bet placed sound
  playBetSound() {
    this.playSound('bet');
  }

  // Cashout sound
  playCashoutSound() {
    this.playSound('cashout');
  }

  // Crash sound
  playCrashSound() {
    this.playSound('crash');
  }

  // Start background music
  startBackgroundMusic() {
    if (!this.enabled || !this.bgMusic) return;

    try {
      this.bgMusic.volume = this.volume * 0.3; // Lower volume for background
      this.bgMusic.play().catch(err => {
        if (err.name !== 'AbortError') {
          console.warn('Failed to start background music:', err);
        }
      });
    } catch (error) {
      console.warn('Error starting background music:', error);
    }
  }

  // Stop background music
  stopBackgroundMusic() {
    if (!this.bgMusic) return;

    try {
      this.bgMusic.pause();
      this.bgMusic.currentTime = 0;
    } catch (error) {
      console.warn('Error stopping background music:', error);
    }
  }

  // Countdown beep (using bet sound at lower volume)
  playCountdownBeep() {
    const prevVolume = this.volume;
    this.volume = 0.2;
    this.playSound('bet');
    this.volume = prevVolume;
  }

  // Final countdown beep (using bet sound)
  playFinalCountdownBeep() {
    this.playSound('bet');
  }

  // Auto-cashout sound (using cashout sound)
  playAutoCashoutSound() {
    this.playSound('cashout');
  }

  // Engine sound - start background music during flight
  playEngineSound(intensity = 1) {
    if (!this.enabled) return;

    // Adjust background music volume based on intensity
    if (this.bgMusic) {
      this.bgMusic.volume = this.volume * 0.2 * intensity;
    }

    // Return stop function that fades out
    return () => {
      if (this.bgMusic) {
        // Fade out gradually
        const fadeOut = setInterval(() => {
          if (this.bgMusic.volume > 0.01) {
            this.bgMusic.volume *= 0.9;
          } else {
            clearInterval(fadeOut);
            this.stopBackgroundMusic();
          }
        }, 50);
      }
    };
  }

  // Toggle sound on/off
  toggleSound() {
    this.enabled = !this.enabled;
    
    if (!this.enabled) {
      this.stopBackgroundMusic();
    }
    
    return this.enabled;
  }

  // Set volume (0-1)
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    
    // Update volume for all loaded sounds
    for (const audio of Object.values(this.sounds)) {
      if (audio) audio.volume = this.volume;
    }
    
    // Update background music volume
    if (this.bgMusic) {
      this.bgMusic.volume = this.volume * 0.3; // Keep background quieter
    }
  }

  // Initialize sound system (call on user interaction)
  async init() {
    // This ensures sounds can play on user interaction
    if (this.bgMusic) {
      try {
        // Create a silent play to unlock audio on mobile
        this.bgMusic.volume = 0;
        await this.bgMusic.play();
        this.bgMusic.pause();
        this.bgMusic.volume = this.volume * 0.3;
      } catch (err) {
        console.log('Audio initialization:', err);
      }
    }
  }
}

// Create singleton instance
const soundEffects = new SoundEffects();

export default soundEffects;
