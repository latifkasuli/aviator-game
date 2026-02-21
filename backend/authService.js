
const jwt = require('jsonwebtoken');
const databaseService = require('./services/databaseService');

class AuthService {
  constructor() {
    if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    
    this.jwtSecret = process.env.JWT_SECRET || (process.env.NODE_ENV === 'development' ? 'dev-only-secret' : null);
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
    this.refreshTokenExpiresIn = '30d';
    
    this.activeSessions = new Map();
    this.sessionTTL = 24 * 60 * 60 * 1000;
  }

  generateToken(user) {
    try {
      const payload = {
        sub: String(user.id),
        userId: String(user.id),
        username: user.username || null,
        email: user.email || null,
        role: user.role || 'PLAYER',
        telegramId: user.telegramId || null,
      };

      const token = jwt.sign(payload, this.jwtSecret, {
        expiresIn: this.jwtExpiresIn,
        issuer: 'aviator-game',
        audience: 'aviator-players'
      });

      this.activeSessions.set(token, {
        token,
        userId: String(user.id),
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        expiresAt: new Date(Date.now() + this.sessionTTL).toISOString()
      });

      this.cleanupExpiredSessions();
      console.log(`Generated token for user: ${user.username}`);
      return { success: true, token };
    } catch (e) {
      console.error('Error generating token:', e);
      return { success: false, error: 'Failed to generate token' };
    }
  }

  generateRefreshToken(user) {
    try {
      const payload = {
        userId: user.id,
        type: 'refresh',
        iat: Math.floor(Date.now() / 1000)
      };

      const refreshToken = jwt.sign(payload, this.jwtSecret, {
        expiresIn: this.refreshTokenExpiresIn,
        issuer: 'aviator-game',
        audience: 'aviator-players'
      });

      return { success: true, refreshToken };
    } catch (error) {
      console.error('Error generating refresh token:', error);
      return { success: false, error: 'Failed to generate refresh token' };
    }
  }

  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: 'aviator-game',
        audience: 'aviator-players'
      });

      const session = this.activeSessions.get(token);
      if (session) session.lastActivity = new Date().toISOString();

      return { success: true, decoded };
    } catch (error) {
      if (error.name === 'TokenExpiredError') return { success: false, error: 'Token expired' };
      if (error.name === 'JsonWebTokenError') return { success: false, error: 'Invalid token' };
      console.error('Error verifying token:', error);
      return { success: false, error: 'Token verification failed' };
    }
  }

  async refreshAccessToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, this.jwtSecret);
      
      if (decoded.type !== 'refresh') {
        return { success: false, error: 'Invalid refresh token' };
      }

      const user = await databaseService.findUserById(decoded.userId);
      if (!user || !user.isActive) {
        return { success: false, error: 'User not found or inactive' };
      }

      return this.generateToken(user);
    } catch (error) {
      console.error('Error refreshing token:', error);
      return { success: false, error: 'Failed to refresh token' };
    }
  }

  logout(token) {
    try {
      const session = this.activeSessions.get(token);
      if (session) {
        this.activeSessions.delete(token);
        console.log(`Token logged out for user: ${session.userId}`);
      }
      return { success: true };
    } catch (error) {
      console.error('Error logging out token:', error);
      return { success: false, error: 'Logout failed' };
    }
  }

  logoutAllSessions(userId) {
    try {
      let loggedOutCount = 0;
      for (const [token, session] of this.activeSessions.entries()) {
        if (session.userId === userId) {
          this.activeSessions.delete(token);
          loggedOutCount++;
        }
      }
      console.log(`Logged out ${loggedOutCount} sessions for user: ${userId}`);
      return { success: true };
    } catch (error) {
      console.error('Error logging out all sessions:', error);
      return { success: false, error: 'Logout failed' };
    }
  }

  async authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const verification = this.verifyToken(token);
    if (!verification.success) {
      return res.status(403).json({ error: verification.error });
    }

    const user = await databaseService.findUserById(verification.decoded.userId);
    if (!user || !user.isActive) {
      return res.status(403).json({ error: 'User not found or inactive' });
    }

    req.user = user;
    next();
  }

  async optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const verification = this.verifyToken(token);
      if (verification.success) {
        const user = await databaseService.findUserById(verification.decoded.userId);
        if (user && user.isActive) {
          req.user = user;
        }
      }
    }

    next();
  }

  requireRole(roles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userRoles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];
      const requiredRoles = Array.isArray(roles) ? roles : [roles];

      const hasRole = requiredRoles.some(role => userRoles.includes(role));
      if (!hasRole) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    };
  }

  getActiveSessionsCount() {
    return this.activeSessions.size;
  }

  cleanupExpiredSessions() {
    const now = new Date().toISOString();
    let cleanedCount = 0;

    for (const [token, session] of this.activeSessions.entries()) {
      if (session.expiresAt && new Date(session.expiresAt) < new Date(now)) {
        this.activeSessions.delete(token);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired sessions`);
    }
    
    const maxSessions = 10000;
    if (this.activeSessions.size > maxSessions) {
      const sortedSessions = Array.from(this.activeSessions.entries())
        .sort((a, b) => new Date(a[1].createdAt) - new Date(b[1].createdAt));
      
      const toRemove = sortedSessions.slice(0, this.activeSessions.size - maxSessions);
      toRemove.forEach(([userId]) => this.activeSessions.delete(userId));
      
      console.log(`Removed ${toRemove.length} oldest sessions to maintain size limit`);
    }
  }

  getSessionInfo(userId) {
    return this.activeSessions.get(userId);
  }
}

const authService = new AuthService();

setInterval(() => {
  authService.cleanupExpiredSessions();
}, 60 * 60 * 1000);

module.exports = authService;
