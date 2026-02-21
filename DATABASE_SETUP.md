# PostgreSQL Database Setup Guide

## Overview
This guide will help you set up PostgreSQL with Prisma ORM for the Aviator game, making it production-ready and cheat-proof.

## Quick Setup

### 1. Install PostgreSQL

#### macOS (using Homebrew)
```bash
brew install postgresql
brew services start postgresql
```

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### Windows
Download and install from [PostgreSQL official website](https://www.postgresql.org/download/windows/)

### 2. Create Database and User
```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create database and user
CREATE DATABASE aviator_game;
CREATE USER aviator_user WITH ENCRYPTED PASSWORD 'aviator_password';
GRANT ALL PRIVILEGES ON DATABASE aviator_game TO aviator_user;
\q
```

### 3. Configure Environment
```bash
cd backend
cp env.example .env
```

Update `.env` with your database credentials:
```env
DATABASE_URL="postgresql://aviator_user:aviator_password@localhost:5432/aviator_game?schema=public"
```

### 4. Run Database Setup
```bash
# Make setup script executable
chmod +x scripts/setup-database.js

# Run the setup
node scripts/setup-database.js
```

## Database Schema

### Core Tables

#### Users
- **Authentication**: Telegram ID, username, password hash
- **Balance**: Current balance, transaction history
- **Statistics**: Total wagered, won, lost, games played
- **Limits**: Daily spending and gaming limits

#### Game Rounds
- **Provably Fair**: Server seeds, client seeds, nonces
- **Game Data**: Crash points, start/end times, status
- **Verification**: Hash verification for fairness

#### Bets
- **Bet Details**: Amount, cashout targets, actual payouts
- **Timing**: Placed at, cashed out at timestamps
- **Status**: Active, cashed out, lost, cancelled

#### Transactions
- **Financial Records**: All balance changes with audit trail
- **Types**: Deposits, withdrawals, bets, wins, losses
- **Metadata**: Game rounds, bet references, descriptions

## Security Features

### Provably Fair System
```javascript
// Each game round uses cryptographic seeds
const serverSeed = crypto.randomBytes(32).toString('hex');
const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
const crashPoint = calculateCrashPoint(serverSeed, clientSeed, nonce);
```

### Transaction Safety
- **Database Transactions**: All bet/cashout operations are atomic
- **Balance Validation**: Server-side balance checks prevent cheating
- **Audit Trail**: Complete transaction history for all operations

### Daily Limits
- **Responsible Gaming**: Configurable daily limits per user
- **Real-time Tracking**: Current usage tracked against limits
- **Automatic Enforcement**: Bets blocked when limits exceeded

## Database Operations

### User Management
```javascript
// Create user
const user = await databaseService.createUser({
  telegramId: '123456789',
  username: 'player1',
  firstName: 'John',
  lastName: 'Doe'
});

// Update balance
await databaseService.updateBalance(userId, 100, 'Deposit');
```

### Game Operations
```javascript
// Create game round
const round = await databaseService.createGameRound(2.45);

// Place bet
const bet = await databaseService.placeBet(userId, roundId, 100, 2.0);

// Cash out
await databaseService.cashoutBet(betId, 1.85);
```

### Statistics
```javascript
// Get user stats
const stats = await databaseService.getUserStats(userId);

// Get leaderboard
const leaderboard = await databaseService.getLeaderboard(10);
```

## Database Migrations

### Initial Migration
```bash
npx prisma migrate dev --name init
```

### Future Migrations
```bash
# After schema changes
npx prisma migrate dev --name add_new_feature
```

### Production Deployment
```bash
npx prisma migrate deploy
```

## Monitoring & Maintenance

### Health Checks
```javascript
const health = await databaseService.healthCheck();
console.log(health); // { status: 'healthy', database: 'connected' }
```

### Performance Monitoring
- **Query Logging**: Enabled in development
- **Connection Pooling**: Handled by Prisma
- **Index Optimization**: Critical queries indexed

### Backup Strategy
```bash
# Daily backup
pg_dump aviator_game > backup_$(date +%Y%m%d).sql

# Restore backup
psql aviator_game < backup_20231201.sql
```

## Production Considerations

### Environment Variables
```env
# Production database
DATABASE_URL="postgresql://user:pass@prod-host:5432/aviator_game?schema=public"

# Security
JWT_SECRET="your-super-secure-secret-key"
JWT_REFRESH_SECRET="your-super-secure-refresh-key"

# Performance
DATABASE_POOL_SIZE=20
DATABASE_TIMEOUT=30000
```

### Scaling
- **Connection Pooling**: Configure based on server capacity
- **Read Replicas**: For high-traffic scenarios
- **Caching**: Redis for frequently accessed data

### Security
- **SSL/TLS**: Enable for production connections
- **Firewall**: Restrict database access to application servers
- **Monitoring**: Set up alerts for unusual activity

## Troubleshooting

### Common Issues

#### Connection Refused
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Check connection
psql -h localhost -U aviator_user -d aviator_game
```

#### Migration Errors
```bash
# Reset database (development only)
npx prisma migrate reset

# Check migration status
npx prisma migrate status
```

#### Performance Issues
```bash
# Analyze query performance
EXPLAIN ANALYZE SELECT * FROM bets WHERE user_id = 'user123';

# Check database size
SELECT pg_size_pretty(pg_database_size('aviator_game'));
```

## Benefits of Database Migration

### Before (File-based)
- [X] No transaction safety
- [X] Easy to manipulate
- [X] No audit trail
- [X] Limited scalability
- [X] No concurrent access

### After (PostgreSQL)
- [OK] ACID transactions
- [OK] Server-side validation
- [OK] Complete audit trail
- [OK] Horizontal scaling
- [OK] Concurrent users
- [OK] Provably fair system
- [OK] Real-time statistics
- [OK] Backup & recovery

## Next Steps

1. **Set up PostgreSQL** following the installation guide
2. **Run the setup script** to initialize the database
3. **Update server.js** to use the new database service
4. **Test the migration** with the existing frontend
5. **Deploy to production** with proper security measures

The database is now ready to handle thousands of concurrent users with complete transaction safety and provably fair gameplay!
