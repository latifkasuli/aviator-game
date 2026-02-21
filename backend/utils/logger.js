
const isDevelopment = process.env.NODE_ENV !== 'production';

const logger = {
  log: (...args) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  
  error: (...args) => {
    console.error(...args);
  },
  
  warn: (...args) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  
  info: (...args) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },
  
  debug: (...args) => {
    if (isDevelopment || process.env.DEBUG === 'true') {
      console.debug(...args);
    }
  },
  
  production: (...args) => {
    if (process.env.NODE_ENV === 'production') {
      console.log('[PROD]', new Date().toISOString(), ...args);
    }
  }
};

module.exports = logger;
