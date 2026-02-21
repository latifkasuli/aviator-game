
class SoundEffects {
  constructor() {
    this.enabled = true;
    this.volume = 0.3;
    this.sounds = {};
    this.bgMusic = null;
    this.loadSounds();
  }

  async loadSounds() {
    const soundFiles = {
      bet: '/assets/general/sound/take.mp3',
      cashout: '/assets/general/sound/win.mp3',
      crash: '/assets/general/sound/flew.mp3',
      background: '/assets/general/sound/bg-sound.mp3'
    };

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

  playBetSound() {
    this.playSound('bet');
  }

  playCashoutSound() {
    this.playSound('cashout');
  }

  playCrashSound() {
    this.playSound('crash');
  }

  startBackgroundMusic() {
    if (!this.enabled || !this.bgMusic) return;

    try {
      this.bgMusic.volume = this.volume * 0.3;
      this.bgMusic.play().catch(err => {
        if (err.name !== 'AbortError') {
          console.warn('Failed to start background music:', err);
        }
      });
    } catch (error) {
      console.warn('Error starting background music:', error);
    }
  }

  stopBackgroundMusic() {
    if (!this.bgMusic) return;

    try {
      this.bgMusic.pause();
      this.bgMusic.currentTime = 0;
    } catch (error) {
      console.warn('Error stopping background music:', error);
    }
  }

  playCountdownBeep() {
    const prevVolume = this.volume;
    this.volume = 0.2;
    this.playSound('bet');
    this.volume = prevVolume;
  }

  playFinalCountdownBeep() {
    this.playSound('bet');
  }

  playAutoCashoutSound() {
    this.playSound('cashout');
  }

  playEngineSound(intensity = 1) {
    if (!this.enabled) return;

    if (this.bgMusic) {
      this.bgMusic.volume = this.volume * 0.2 * intensity;
    }

    return () => {
      if (this.bgMusic) {
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

  toggleSound() {
    this.enabled = !this.enabled;
    
    if (!this.enabled) {
      this.stopBackgroundMusic();
    }
    
    return this.enabled;
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    
    for (const audio of Object.values(this.sounds)) {
      if (audio) audio.volume = this.volume;
    }
    
    if (this.bgMusic) {
      this.bgMusic.volume = this.volume * 0.3;
    }
  }

  async init() {
    if (this.bgMusic) {
      try {
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

const soundEffects = new SoundEffects();

export default soundEffects;
