const BACKEND_URL = import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'https://aviator-game-production.up.railway.app';

import authService from './authService.js';

class GameService {
  constructor() {
    this.ws = null;
    this.listeners = new Set();
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.playerId = null;
    
    if (typeof window !== 'undefined') {
      window.addEventListener('authStateChanged', () => {
        console.log('Auth state changed, reconnecting WebSocket...');
        this.reconnect();
      });
    }
  }

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('Already connected, skipping new connection');
      return;
    }
    
    console.log('Connecting to game backend...');
    
    const token = authService.getToken();
    const baseWsUrl = import.meta.env.VITE_API_BASE_URL?.replace('https://', 'wss://').replace('/api', '') || 'wss://aviator-game-production.up.railway.app';
    const wsPath = '/ws';
    
    const wsUrl = token ? `${baseWsUrl}${wsPath}?token=${encodeURIComponent(token)}` : `${baseWsUrl}${wsPath}`;
    const protocols = token ? [`bearer.${token}`] : [];
    
    if (import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true') {
      console.log('WebSocket URL:', wsUrl.replace(/token=[^&]*/, 'token=***'));
      console.log('Auth token:', token ? 'Present' : 'Missing');
      console.log('Protocols:', protocols.length > 0 ? ['bearer.***'] : 'None');
    }
    
    try {
      this.ws = new WebSocket(wsUrl, protocols);
      
      this.ws.onopen = () => {
        if (import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true') {
          console.log('Connected to game backend');
          console.log('WebSocket URL:', this.ws.url);
          console.log('WebSocket readyState:', this.ws.readyState);
        }
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        const savedPlayerId = localStorage.getItem('aviator_player_id');
        if (savedPlayerId) {
          this.playerId = savedPlayerId;
          console.log('Restored player ID:', this.playerId);
        }
        
        this.notifyListeners({ type: 'connected' });
      };
      
      this.ws.onmessage = (event) => {
        try {
          if (import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true') {
            console.log('Raw message received:', event.data);
          }
          const message = JSON.parse(event.data);
          if (import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true') {
            console.log('Parsed message:', message);
          }
          
          if (message?.type === 'auth_error' && message?.data?.reason === 'STALE_TOKEN') {
            console.log('Server detected stale token, triggering re-authentication...');
            try {
              authService.clearTokens();
              window.dispatchEvent(new Event('auth:stale'));
            } catch (error) {
              console.error('Error handling stale token:', error);
            }
            return;
          }
          
          if (message.type === 'connected' && message.data?.userId) {
            this.playerId = message.data.userId;
            if (import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true') {
              console.log('Connected as:', message.data.isGuest ? 'Guest' : 'Authenticated User');
              console.log('User ID:', this.playerId);
            }
          }
          
          this.notifyListeners(message);
        } catch (error) {
          console.error('Error parsing message:', error);
          console.error('Raw message that failed:', event.data);
        }
      };
      
      this.ws.onclose = () => {
        if (import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true') {
          console.log('Connection closed');
        }
        this.isConnected = false;
        this.attemptReconnect();
      };
      
      this.ws.onerror = (error) => {
        if (import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true') {
          console.error('WebSocket error:', error);
          console.error('WebSocket readyState:', this.ws.readyState);
          console.error('WebSocket URL:', this.ws.url);
          console.error('Error details:', {
            type: error.type,
            target: error.target,
            isTrusted: error.isTrusted
          });
        }
      };
      
    } catch (error) {
      console.error('Failed to connect:', error);
      this.attemptReconnect();
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached. Please refresh the page.');
      return;
    }
    
    this.reconnectAttempts++;
    const backoffDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000);
    console.log(`Reconnecting... Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${backoffDelay}ms`);
    
    setTimeout(() => {
      console.log('Attempting reconnection now...');
      this.connect();
    }, backoffDelay);
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      if (import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true') {
        console.log('Sent:', message);
      }
    } else {
      if (import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true') {
        console.error('WebSocket not connected');
      }
    }
  }

  placeBet(amount) {
    console.log('[GameService] Placing bet:', amount, 'pts for player:', this.playerId);
    this.send({
      type: 'bet',
      amount: amount,
      playerId: this.playerId
    });
  }

  cashOut() {
    console.log('[GameService] Attempting cash out for player:', this.playerId);
    this.send({
      type: 'cashOut',
      playerId: this.playerId
    });
  }

  addListener(callback) {
    this.listeners.add(callback);
  }

  removeListener(callback) {
    this.listeners.delete(callback);
  }

  notifyListeners(message) {
    console.log('Notifying listeners, count:', this.listeners.size);
    this.listeners.forEach((callback, index) => {
      try {
        console.log(`Calling listener ${index}:`, callback);
        callback(message);
        console.log(`Listener ${index} executed successfully`);
      } catch (error) {
        console.error(`Error in listener ${index}:`, error);
        console.error('Listener function:', callback);
      }
    });
  }

  async getGameState() {
    try {
      const response = await fetch(`${BACKEND_URL}/api/game-state`);
      return await response.json();
    } catch (error) {
      console.error('Failed to get game state:', error);
      return null;
    }
  }

  async checkHealth() {
    try {
      const response = await fetch(`${BACKEND_URL}/api/health`);
      return await response.json();
    } catch (error) {
      console.error('Backend health check failed:', error);
      return null;
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.isConnected = false;
    }
  }
  
  reconnect() {
    console.log('Reconnecting WebSocket with fresh token...');
    try {
      this.disconnect();
    } catch (e) {
      console.warn('Disconnect error during reconnect:', e);
    }
    setTimeout(() => this.connect(), 100);
  }
}

const gameService = new GameService();

export default gameService;
