# Aviator Game Backend

This is the backend server for the Aviator Telegram Mini App.

## What This Does

- **Real-time game state** - Manages the plane flight and multiplier
- **Player connections** - Handles multiple players simultaneously  
- **Betting system** - Players can place bets and cash out
- **WebSocket communication** - Live updates to all players
- **Game loop** - Automated game rounds (betting → flying → crash → repeat)

## Setup Instructions

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Set Environment Variables
```bash
# Copy the example file
cp env.example .env

# Edit .env if needed (defaults should work for development)
```

### 3. Run the Server
```bash
# Development mode (auto-restarts on changes)
npm run dev

# Production mode
npm start
```

### 4. Test It's Working
Open your browser and go to: http://localhost:3001/api/health

You should see: `{"status":"OK","message":"Aviator backend is running!"}`

## API Endpoints

- `GET /api/health` - Check if server is running
- `GET /api/game-state` - Get current game state
- `WebSocket ws://localhost:3001` - Real-time game updates

## Game Flow

1. **Betting Phase** (5 seconds)
   - Players can place bets
   - Countdown from 5 to 0
   
2. **Flying Phase** (variable duration)
   - Plane takes off
   - Multiplier increases over time
   - Players can cash out anytime
   
3. **Crash Phase** (3 seconds)
   - Plane crashes at predetermined point
   - Players who didn't cash out lose their bet
   - New round starts automatically

## Current Features

[OK] Real-time multiplayer game state  
[OK] WebSocket connections  
[OK] Betting and cash out system  
[OK] Automated game rounds  
[OK] Player balance management  
[OK] Crash point generation  

## Coming Next

[ ] Connect to React frontend  
[ ] Telegram bot integration  
[ ] Database for persistence  
[ ] Deploy to Railway  
