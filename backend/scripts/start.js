/*
  Start script with Prisma migrate retry to survive transient DB availability on Railway
*/
const { spawn } = require('child_process');

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: true, ...opts });
    child.on('exit', (code) => {
      if (code === 0) resolve(); else reject(new Error(`${cmd} ${args.join(' ')} exited with ${code}`));
    });
  });
}

async function migrateWithRetry(maxAttempts = 3) {
  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt++;
    try {
      console.log(`Prisma migrate deploy (attempt ${attempt}/${maxAttempts})`);
      await run('npx', ['prisma', 'migrate', 'deploy']);
      return;
    } catch (err) {
      console.error(`Migrate failed (attempt ${attempt}):`, err.message);
      if (attempt >= maxAttempts) throw err;
      const backoffMs = Math.min(3000 * Math.pow(2, attempt - 1), 15000);
      console.log(`Retrying in ${backoffMs}ms...`);
      await new Promise(r => setTimeout(r, backoffMs));
    }
  }
}

(async () => {
  try {
    await migrateWithRetry(4);
    
    // Seed quests if they don't exist
    try {
      console.log('Checking and seeding quests...');
      await run('node', ['scripts/seed-quests.js']);
    } catch (e) {
      console.log('Quest seeding completed or already seeded.');
    }
  } catch (e) {
    console.error('Prisma migrate failed after retries. Continuing to start server anyway...');
  }
  require('../server');
})();


