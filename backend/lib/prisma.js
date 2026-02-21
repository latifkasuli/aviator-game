const { PrismaClient } = require('@prisma/client');

const globalForPrisma = globalThis;

const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

prisma.$connect()
  .then(() => console.log('Database connected successfully'))
  .catch((error) => {
    console.error('Database connection failed:', error);
    console.error('DATABASE_URL:', process.env.DATABASE_URL ? 'Set (hidden)' : 'Not set');
  });

process.on('beforeExit', async () => {
  console.log('Disconnecting from database...');
  await prisma.$disconnect();
});

module.exports = prisma;
