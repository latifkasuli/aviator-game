const provablyFairService = require('../services/provablyFairService');

describe('Provably Fair Service', () => {
  describe('generateServerSeed', () => {
    it('should generate a server seed of correct length', () => {
      const seed = provablyFairService.generateServerSeed();
      expect(seed).toHaveLength(provablyFairService.serverSeedLength);
      expect(typeof seed).toBe('string');
    });

    it('should generate unique seeds', () => {
      const seed1 = provablyFairService.generateServerSeed();
      const seed2 = provablyFairService.generateServerSeed();
      expect(seed1).not.toBe(seed2);
    });
  });

  describe('hashServerSeed', () => {
    it('should produce consistent hash for same seed', () => {
      const seed = 'test-seed-123';
      const hash1 = provablyFairService.hashServerSeed(seed);
      const hash2 = provablyFairService.hashServerSeed(seed);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });
  });

  describe('calculateCrashPoint', () => {
    it('should produce consistent crash point for same inputs', () => {
      const serverSeed = 'server-seed';
      const clientSeed = 'client-seed';
      const nonce = 1;
      
      const crash1 = provablyFairService.calculateCrashPoint(serverSeed, clientSeed, nonce);
      const crash2 = provablyFairService.calculateCrashPoint(serverSeed, clientSeed, nonce);
      
      expect(crash1).toBe(crash2);
      expect(crash1).toBeGreaterThanOrEqual(1.0);
    });

    it('should produce different crash points for different nonces', () => {
      const serverSeed = 'server-seed';
      const clientSeed = 'client-seed';
      
      const crash1 = provablyFairService.calculateCrashPoint(serverSeed, clientSeed, 1);
      const crash2 = provablyFairService.calculateCrashPoint(serverSeed, clientSeed, 2);
      
      expect(crash1).not.toBe(crash2);
    });
  });

  describe('verifyCrashPoint', () => {
    it('should verify correct crash point calculation', () => {
      const serverSeed = 'test-server-seed';
      const clientSeed = 'test-client-seed';
      const nonce = 1;
      
      const crashPoint = provablyFairService.calculateCrashPoint(serverSeed, clientSeed, nonce);
      const isValid = provablyFairService.verifyCrashPoint(serverSeed, clientSeed, nonce, crashPoint);
      
      expect(isValid).toBe(true);
    });

    it('should reject incorrect crash point', () => {
      const serverSeed = 'test-server-seed';
      const clientSeed = 'test-client-seed';
      const nonce = 1;
      
      const isValid = provablyFairService.verifyCrashPoint(serverSeed, clientSeed, nonce, 999.99);
      
      expect(isValid).toBe(false);
    });
  });

  describe('generateFairRound', () => {
    it('should generate complete fair round data', () => {
      const round = provablyFairService.generateFairRound();
      
      expect(round).toHaveProperty('serverSeed');
      expect(round).toHaveProperty('serverSeedHash');
      expect(round).toHaveProperty('clientSeed');
      expect(round).toHaveProperty('nonce');
      expect(round).toHaveProperty('crashPoint');
      
      expect(round.crashPoint).toBeGreaterThanOrEqual(1.0);
      expect(round.crashPoint).toBeLessThanOrEqual(1000);
    });

    it('should generate verifiable hash', () => {
      const round = provablyFairService.generateFairRound();
      const computedHash = provablyFairService.hashServerSeed(round.serverSeed);
      
      expect(round.serverSeedHash).toBe(computedHash);
    });
  });

  describe('generateRealisticCrashPoint', () => {
    it('should return pure provably fair result without manipulation', () => {
      const result = provablyFairService.generateRealisticCrashPoint();
      
      expect(result).toHaveProperty('serverSeed');
      expect(result).toHaveProperty('serverSeedHash');
      expect(result).toHaveProperty('crashPoint');
      
      const isValid = provablyFairService.verifyCrashPoint(
        result.serverSeed,
        result.clientSeed,
        result.nonce,
        result.crashPoint
      );
      expect(isValid).toBe(true);
    });
  });

  describe('getDistributionStats', () => {
    it('should calculate correct distribution statistics', () => {
      const crashPoints = [1.5, 2.3, 4.5, 8.2, 15.6, 1.1, 3.4, 55.2, 102.5, 2.8];
      const stats = provablyFairService.getDistributionStats(crashPoints);
      
      expect(stats.total).toBe(10);
      expect(stats.average).toBeCloseTo(19.71, 1);
      expect(stats.min).toBe(1.1);
      expect(stats.max).toBe(102.5);
      expect(stats.distribution.under2x).toBe(20);
      expect(stats.distribution.over100x).toBe(10);
    });
  });
});
