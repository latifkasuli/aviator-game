#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function generateReferralCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'AV8R-';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function fixReferralCodes() {
  try {
    console.log('Finding users without referral codes...');
    
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
    
    if (usersWithoutCodes.length === 0) {
      console.log('All users already have referral codes!');
      return;
    }
    
    console.log('Adding referral codes...');
    
    let updated = 0;
    for (const user of usersWithoutCodes) {
      let referralCode;
      let codeExists = true;
      
      while (codeExists) {
        referralCode = generateReferralCode();
        const existing = await prisma.user.findUnique({
          where: { referralCode }
        });
        codeExists = !!existing;
      }
      
      await prisma.user.update({
        where: { id: user.id },
        data: { referralCode }
      });
      
      console.log(`  ${user.username}: ${referralCode}`);
      updated++;
    }
    
    console.log(`\nSuccessfully added referral codes to ${updated} users!`);
    
  } catch (error) {
    console.error('Error fixing referral codes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixReferralCodes();
