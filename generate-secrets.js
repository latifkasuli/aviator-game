#!/usr/bin/env node

import crypto from 'crypto';

console.log('\nGenerating secure secrets for deployment...\n');

const jwtSecret = crypto.randomBytes(64).toString('hex');
const jwtRefreshSecret = crypto.randomBytes(64).toString('hex');
const adminRegKey = crypto.randomBytes(32).toString('hex');

console.log('Copy these to your Railway environment variables:\n');
console.log(`JWT_SECRET=${jwtSecret}`);
console.log(`JWT_REFRESH_SECRET=${jwtRefreshSecret}`);
console.log(`ADMIN_REGISTRATION_KEY=${adminRegKey}`);

console.log('\nKeep these secret and never commit them to git!');
console.log('Each environment (dev/staging/prod) should have different secrets.\n');
