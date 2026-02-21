
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const quests = [
  {
    type: 'DAILY_LOGIN',
    name: 'Daily Login Bonus',
    description: 'Open the game daily to claim your reward',
    icon: '[T]',
    rewardPoints: 100,
    targetValue: 1,
    resetPeriod: 'daily',
    sortOrder: 1
  },
  {
    type: 'PLACE_BETS', 
    name: 'Active Player',
    description: 'Place 5 bets to show your dedication',
    icon: '[D]',
    rewardPoints: 500,
    targetValue: 5,
    resetPeriod: 'daily',
    sortOrder: 2
  },
  {
    type: 'SUCCESSFUL_REFERRAL',
    name: 'Referral Master', 
    description: 'Successfully refer 1 new player',
    icon: '[F]',
    rewardPoints: 500,
    targetValue: 1,
    resetPeriod: 'daily',
    sortOrder: 3
  },
  
  {
    type: 'LUCKY_STREAK',
    name: 'Lucky Streak',
    description: 'Cash out successfully 3 times in a row',
    icon: '[L]',
    rewardPoints: 300,
    targetValue: 3,
    resetPeriod: 'daily',
    sortOrder: 4
  },
  {
    type: 'HIGH_ROLLER',
    name: 'High Roller',
    description: 'Place a bet of 1000 points or more',
    icon: '[H]',
    rewardPoints: 200,
    targetValue: 1000,
    resetPeriod: 'daily',
    sortOrder: 5
  },
  {
    type: 'EARLY_BIRD',
    name: 'Early Bird',
    description: 'Play within the first hour of day reset',
    icon: '[E]',
    rewardPoints: 150,
    targetValue: 1,
    resetPeriod: 'daily',
    sortOrder: 6
  },
  {
    type: 'NIGHT_OWL',
    name: 'Night Owl', 
    description: 'Play after 10 PM local time',
    icon: '[N]',
    rewardPoints: 150,
    targetValue: 1,
    resetPeriod: 'daily',
    sortOrder: 7
  },
  {
    type: 'RISK_TAKER',
    name: 'Risk Taker',
    description: 'Successfully cash out at 5x multiplier or higher',
    icon: '[R]',
    rewardPoints: 400,
    targetValue: 500,
    resetPeriod: 'daily',
    sortOrder: 8
  }
];

async function seedQuests() {
  console.log('Starting quest system seeding...');
  
  try {
    for (const questData of quests) {
      const quest = await prisma.quest.upsert({
        where: { type: questData.type },
        update: {
          name: questData.name,
          description: questData.description,
          icon: questData.icon,
          rewardPoints: questData.rewardPoints,
          targetValue: questData.targetValue,
          resetPeriod: questData.resetPeriod,
          sortOrder: questData.sortOrder,
          isActive: true
        },
        create: questData
      });
      
      console.log(`${quest.type}: ${quest.name} (${quest.rewardPoints} pts)`);
    }
    
    console.log(`\nSuccessfully seeded ${quests.length} quests!`);
    console.log('\nQuest Summary:');
    console.log(`Total daily rewards available: ${quests.reduce((sum, q) => sum + q.rewardPoints, 0)} points`);
    console.log(`Quest types: ${quests.map(q => q.type).join(', ')}`);
    
  } catch (error) {
    console.error('Error seeding quests:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  seedQuests();
}

module.exports = { seedQuests, quests };
