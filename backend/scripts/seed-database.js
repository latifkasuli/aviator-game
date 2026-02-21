#!/usr/bin/env node

const prisma = require('../lib/prisma');
const databaseService = require('../services/databaseService');

async function seedDatabase() {
  console.log('Seeding database with initial data...\n');
  
  try {
    console.log('Creating demo users...');
    
    const demoUser = await databaseService.createUser({
      username: 'demo_player',
      firstName: 'Demo',
      lastName: 'Player',
      email: 'demo@aviator.game'
    });
    console.log(`Created demo user: ${demoUser.username}`);
    
    const testUser = await databaseService.createUser({
      telegramId: '123456789',
      username: 'telegram_user',
      firstName: 'Telegram',
      lastName: 'User'
    });
    console.log(`Created Telegram user: ${testUser.username}`);
    
    console.log('\nSetting up system configuration...');
    
    const configs = [
      { key: 'GAME_VERSION', value: '1.0.0', description: 'Current game version' },
      { key: 'MIN_BET', value: '1', description: 'Minimum bet amount' },
      { key: 'MAX_BET', value: '10000', description: 'Maximum bet amount' },
      { key: 'DEFAULT_BALANCE', value: '1000', description: 'Default user balance' },
      { key: 'HOUSE_EDGE', value: '0.01', description: 'House edge percentage' },
      { key: 'MAINTENANCE_MODE', value: 'false', description: 'Maintenance mode flag' }
    ];
    
    for (const config of configs) {
      await prisma.systemConfig.upsert({
        where: { key: config.key },
        update: { value: config.value },
        create: config
      });
    }
    console.log(`Created ${configs.length} system configurations`);
    
    console.log('\nCreating sample game rounds...');
    
    const provablyFairService = require('../services/provablyFairService');
    
    for (let i = 0; i < 10; i++) {
      const fairRound = provablyFairService.generateFairRound();
      await databaseService.createGameRound(fairRound);
    }
    console.log(`Created 10 sample game rounds with provably fair data`);
    
    console.log('\nSetting up daily limits...');
    
    const today = new Date().toISOString().split('T')[0];
    await prisma.dailyLimit.create({
      data: {
        userId: demoUser.id,
        date: new Date(today),
        maxWager: 5000,
        maxLoss: 2000,
        maxGames: 100,
        currentWager: 0,
        currentLoss: 0,
        currentGames: 0
      }
    });
    console.log('Set daily limits for demo user');
    
    console.log('\nDatabase seeding completed successfully!');
    console.log('\nSummary:');
    console.log(`- Users created: 2`);
    console.log(`- System configs: ${configs.length}`);
    console.log('- Sample game rounds: 10');
    console.log(`- Daily limits configured: 1`);
    
  } catch (error) {
    console.error('Database seeding failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('\nSeeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nSeeding failed:', error);
      process.exit(1);
    });
}

module.exports = seedDatabase;
