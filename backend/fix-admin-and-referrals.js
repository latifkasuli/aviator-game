const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function fixAdminAndReferrals() {
  try {
    console.log('Starting admin and referral fixes...');
    
    console.log('\nSetting up admin user...');
    
    let adminUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: 'KnightRider' },
          { username: 'latifkasuli' }
        ]
      }
    });
    
    if (!adminUser) {
      console.log('No KnightRider or latifkasuli user found');
      return;
    }
    
    const hashedPassword = await bcrypt.hash('7175{rV1', 12);
    
    await prisma.user.update({
      where: { id: adminUser.id },
      data: {
        passwordHash: hashedPassword,
        role: 'ADMIN'
      }
    });
    
    console.log(`Admin password set for ${adminUser.username} with ADMIN role`);
    
    console.log('\nFixing referral codes...');
    
    const usersWithoutCodes = await prisma.user.findMany({
      where: {
        OR: [
          { referralCode: null },
          { referralCode: '' }
        ]
      },
      select: {
        id: true,
        username: true,
        referralCode: true
      }
    });
    
    console.log(`Found ${usersWithoutCodes.length} users without referral codes`);
    
    let fixedCount = 0;
    for (const user of usersWithoutCodes) {
      try {
        const referralCode = Math.random().toString(36).substring(2, 10).toUpperCase();
        
        await prisma.user.update({
          where: { id: user.id },
          data: { referralCode }
        });
        
        console.log(`Fixed referral code for ${user.username}: ${referralCode}`);
        fixedCount++;
      } catch (error) {
        console.error(`Failed to fix referral code for ${user.username}:`, error);
      }
    }
    
    console.log('\nSummary:');
    console.log(`Admin user: ${adminUser.username} setup complete`);
    console.log(`Referral codes fixed: ${fixedCount}/${usersWithoutCodes.length}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAdminAndReferrals();
