#!/usr/bin/env node

const axios = require('axios');

const API_BASE = 'http://localhost:3002/api';
let adminToken = null;
let testUserId = null;

const adminCredentials = {
  usernameOrEmail: 'admin',
  password: 'admin123'
};

const green = (text) => `\x1b[32m${text}\x1b[0m`;
const red = (text) => `\x1b[31m${text}\x1b[0m`;
const yellow = (text) => `\x1b[33m${text}\x1b[0m`;
const blue = (text) => `\x1b[34m${text}\x1b[0m`;

async function test(name, fn) {
  try {
    await fn();
    console.log(green(`PASS ${name}`));
  } catch (error) {
    console.log(red(`FAIL ${name}`));
    if (error.response) {
      console.error(red(`  Status: ${error.response.status}`));
      console.error(red(`  Error: ${error.response.data?.error || error.message}`));
      if (error.response.status === 403) {
        console.error(red(`  This might be due to IP restrictions. Check ADMIN_IP_RANGES env var.`));
      }
    } else if (error.request) {
      console.error(red(`  Error: No response received. Is the server running on port 3002?`));
    } else {
      console.error(red(`  Error: ${error.message}`));
    }
  }
}

async function adminRequest(endpoint, options = {}) {
  return axios({
    url: `${API_BASE}${endpoint}`,
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
}

async function runTests() {
  console.log(blue('\nTesting Admin System\n'));

  await test('Admin login', async () => {
    const response = await axios.post(`${API_BASE}/admin/login`, adminCredentials);
    if (!response.data.success || !response.data.token) {
      throw new Error('Login failed');
    }
    adminToken = response.data.token;
    console.log(yellow(`  Admin logged in as: ${response.data.user.username}`));
  });

  await test('Get admin stats', async () => {
    const response = await adminRequest('/admin/stats');
    const stats = response.data.stats;
    console.log(yellow(`  Total users: ${stats.users.total}`));
    console.log(yellow(`  Active today: ${stats.users.activeToday}`));
    console.log(yellow(`  Connected clients: ${stats.websocket.connectedClients}`));
  });

  await test('Get users list', async () => {
    const response = await adminRequest('/admin/users?limit=5');
    const users = response.data.users;
    console.log(yellow(`  Found ${users.length} users`));
    if (users.length > 0) {
      testUserId = users[0].id;
      console.log(yellow(`  First user: ${users[0].username} (${users[0].balance} pts)`));
    }
  });

  if (testUserId) {
    await test('Get user details', async () => {
      const response = await adminRequest(`/admin/users/${testUserId}`);
      const user = response.data.user;
      console.log(yellow(`  User: ${user.username}`));
      console.log(yellow(`  Balance: ${user.balance} pts`));
      console.log(yellow(`  Role: ${user.role}`));
    });

    await test('Adjust user balance', async () => {
      const response = await adminRequest(`/admin/users/${testUserId}/adjust-balance`, {
        method: 'POST',
        data: {
          amount: 100,
          reason: 'Test balance adjustment'
        }
      });
      console.log(yellow(`  New balance: ${response.data.user.balance} pts`));
    });
  }

  await test('Get game rounds', async () => {
    const response = await adminRequest('/admin/game-rounds?limit=5');
    const rounds = response.data.rounds.rounds;
    console.log(yellow(`  Found ${rounds.length} rounds`));
    if (rounds.length > 0) {
      console.log(yellow(`  Latest crash: ${rounds[0].crashPoint}x`));
    }
  });

  await test('Get referrals', async () => {
    const response = await adminRequest('/admin/referrals?limit=5');
    const referrals = response.data.referrals;
    console.log(yellow(`  Found ${referrals.length} referrals`));
    console.log(yellow(`  Total pages: ${response.data.totalPages}`));
  });

  await test('Get audit logs', async () => {
    const response = await adminRequest('/admin/audit-logs?limit=5');
    const logs = response.data.logs;
    console.log(yellow(`  Found ${logs.length} audit logs`));
    if (logs.length > 0) {
      console.log(yellow(`  Latest action: ${logs[0].action} by ${logs[0].adminUser?.username}`));
    }
  });

  if (process.env.ADMIN_IP_RANGES) {
    console.log(yellow('\n  Note: IP restrictions are enabled. Make sure your IP is in ADMIN_IP_RANGES'));
  }

  console.log(blue('\nAdmin system tests completed!\n'));
}

runTests().catch(error => {
  console.error(red('\nTest suite failed:'), error.message);
  process.exit(1);
});
