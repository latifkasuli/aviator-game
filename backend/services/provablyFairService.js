const crypto = require('crypto');

class ProvablyFairService {
  constructor() {
    this.serverSeedLength = parseInt(process.env.SERVER_SEED_LENGTH) || 64;
    this.clientSeedLength = parseInt(process.env.CLIENT_SEED_LENGTH) || 32;
    this.houseEdge = parseFloat(process.env.HOUSE_EDGE) || 0.01;
  }
  
  generateServerSeed() {
    return crypto.randomBytes(this.serverSeedLength / 2).toString('hex');
  }
  
  hashServerSeed(serverSeed) {
    return crypto.createHash('sha256').update(serverSeed).digest('hex');
  }
  
  generateClientSeed() {
    return crypto.randomBytes(this.clientSeedLength / 2).toString('hex');
  }
  
  calculateCrashPoint(serverSeed, clientSeed, nonce = 0) {
    const message = `${clientSeed}:${nonce}`;
    const hash = crypto.createHmac('sha256', serverSeed).update(message).digest('hex');
    
    const hex = hash.substring(0, 8);
    const intValue = parseInt(hex, 16);
    
    const crashPoint = this.calculateMultiplierFromHash(intValue);
    
    return Math.max(1.00, crashPoint);
  }
  
  calculateMultiplierFromHash(intValue) {
    const maxValue = 0xFFFFFFFF;
    
    const probability = intValue / maxValue;
    
    const adjustedProbability = probability * (1 - this.houseEdge);
    
    if (adjustedProbability === 0) {
      return 1.00;
    }
    
    const crashPoint = 1 / adjustedProbability;
    
    return Math.min(crashPoint, 1000);
  }
  
  verifyCrashPoint(serverSeed, clientSeed, nonce, expectedCrashPoint) {
    const calculatedCrashPoint = this.calculateCrashPoint(serverSeed, clientSeed, nonce);
    const tolerance = 0.01;
    
    return Math.abs(calculatedCrashPoint - expectedCrashPoint) < tolerance;
  }
  
  generateFairRound(clientSeed = null, nonce = 0) {
    const serverSeed = this.generateServerSeed();
    const serverSeedHash = this.hashServerSeed(serverSeed);
    const finalClientSeed = clientSeed || this.generateClientSeed();
    
    const crashPoint = this.calculateCrashPoint(serverSeed, finalClientSeed, nonce);
    
    return {
      serverSeed,
      serverSeedHash,
      clientSeed: finalClientSeed,
      nonce,
      crashPoint: parseFloat(crashPoint.toFixed(2))
    };
  }
  
  createVerificationData(serverSeed, clientSeed, nonce, crashPoint) {
    return {
      serverSeed,
      clientSeed,
      nonce,
      crashPoint,
      verification: {
        serverSeedHash: this.hashServerSeed(serverSeed),
        isValid: this.verifyCrashPoint(serverSeed, clientSeed, nonce, crashPoint),
        algorithm: 'HMAC-SHA256',
        houseEdge: this.houseEdge
      }
    };
  }
  
  generateRealisticCrashPoint() {
    const fairRound = this.generateFairRound();
    
    return fairRound;
  }
  
  getDistributionStats(crashPoints) {
    const total = crashPoints.length;
    if (total === 0) return {};
    
    const sorted = [...crashPoints].sort((a, b) => a - b);
    const sum = crashPoints.reduce((acc, val) => acc + val, 0);
    
    return {
      total,
      average: parseFloat((sum / total).toFixed(2)),
      median: sorted[Math.floor(total / 2)],
      min: sorted[0],
      max: sorted[total - 1],
      distribution: {
        under2x: crashPoints.filter(x => x < 2).length / total * 100,
        under5x: crashPoints.filter(x => x < 5).length / total * 100,
        under10x: crashPoints.filter(x => x < 10).length / total * 100,
        over10x: crashPoints.filter(x => x >= 10).length / total * 100,
        over50x: crashPoints.filter(x => x >= 50).length / total * 100,
        over100x: crashPoints.filter(x => x >= 100).length / total * 100
      }
    };
  }
}

module.exports = new ProvablyFairService();
