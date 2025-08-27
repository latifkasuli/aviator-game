const authService = require('../authService');

describe('Auth Service', () => {
  const mockUser = {
    id: 'test-user-123',
    username: 'testuser',
    email: 'test@example.com',
    role: 'PLAYER'
  };

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const result = authService.generateToken(mockUser);
      
      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(result.token.split('.')).toHaveLength(3); // JWT format
    });

    it('should store session in activeSessions', () => {
      authService.activeSessions.clear();
      const { token } = authService.generateToken(mockUser);
      
      // With Fred's token-based session management, token is now the key
      expect(authService.activeSessions.has(token)).toBe(true);
      const session = authService.activeSessions.get(token);
      expect(session.userId).toBe(mockUser.id);
      expect(session.expiresAt).toBeDefined();
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const { token } = authService.generateToken(mockUser);
      const result = authService.verifyToken(token);
      
      expect(result.success).toBe(true);
      expect(result.decoded.userId).toBe(mockUser.id);
      expect(result.decoded.username).toBe(mockUser.username);
    });

    it('should reject an invalid token', () => {
      const result = authService.verifyToken('invalid-token');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid token');
    });

    it('should accept valid JWT even without active session', () => {
      const { token } = authService.generateToken(mockUser);
      authService.activeSessions.clear(); // Simulate server restart
      
      const result = authService.verifyToken(token);
      
      expect(result.success).toBe(true);
      expect(result.decoded.userId).toBe(mockUser.id);
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should remove expired sessions', () => {
      authService.activeSessions.clear();
      
      // Add expired session
      authService.activeSessions.set('expired-user', {
        token: 'some-token',
        userId: 'expired-user',
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      });
      
      // Add valid session
      authService.activeSessions.set('valid-user', {
        token: 'some-token',
        userId: 'valid-user',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });
      
      authService.cleanupExpiredSessions();
      
      expect(authService.activeSessions.has('expired-user')).toBe(false);
      expect(authService.activeSessions.has('valid-user')).toBe(true);
    });

    it('should limit session map size', () => {
      authService.activeSessions.clear();
      
      // Add many sessions
      for (let i = 0; i < 10005; i++) {
        authService.activeSessions.set(`user-${i}`, {
          token: 'token',
          userId: `user-${i}`,
          createdAt: new Date(Date.now() - i * 1000).toISOString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });
      }
      
      authService.cleanupExpiredSessions();
      
      expect(authService.activeSessions.size).toBeLessThanOrEqual(10000);
    });
  });

  describe('refreshAccessToken', () => {
    it('should generate new token from refresh token', async () => {
      // Mock databaseService
      const databaseService = require('../services/databaseService');
      databaseService.findUserById = jest.fn().mockResolvedValue({
        ...mockUser,
        isActive: true
      });
      
      const refreshResult = authService.generateRefreshToken(mockUser);
      const result = await authService.refreshAccessToken(refreshResult.refreshToken);
      
      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
    });
  });
});
