# Aviator Crash Game - Telegram Mini App

A beautiful Telegram Mini App featuring an Aviator-style crash game built with React 18 and TailwindCSS. Fully integrated with Telegram's WebApp API for native mobile experience.

## Features

### Telegram Integration
- **Native WebApp**: Runs seamlessly inside Telegram
- **User Authentication**: Uses Telegram identity (no separate login)
- **Haptic Feedback**: Native vibration on interactions
- **Theme Integration**: Adapts to user's Telegram theme
- **MainButton Support**: Uses Telegram's native button API

### Game Features
- **Real-time Gameplay**: Live multiplier with crash mechanics
- **Smart Betting**: Auto-cashout and quick bet options
- **Statistics Tracking**: Comprehensive bet history and analytics
- **Responsible Gaming**: Daily limits and spending controls
- **Sound Effects**: Immersive audio feedback

### Mobile Optimized
- **Touch-First Design**: Optimized for mobile interactions
- **Responsive Layout**: Works on all screen sizes
- **Performance Optimized**: Smooth 60fps animations
- **Offline Support**: PWA capabilities with service worker

## Game Components

### Header
- Game title with logo
- Real-time balance display
- Settings icon

### Main Gameplay Area
- Gradient sky background with animated stars
- Large animated multiplier display (1.25x → 2.00x → ...)
- Red plane SVG flying upward with engine fire effects
- Curved multiplier line (cosmetic)

### Bet Panel
- Bet amount input with +/- controls
- Quick bet buttons ($5, $10, $25, $50, $100)
- Dynamic main button (BET → CASH OUT → ROUND OVER)
- Potential winnings display during flight

### History Strip
- Colored pills showing past crash multipliers
- Blue (<5x), Purple (5+), Pink (10+), Gold (100+)

### Bottom Navigation
- 6 tabs: Play, Ranks, Earn, Wallet, Friends, Work
- Only "Play" tab is functional in this demo

## Getting Started

### Prerequisites
- Node.js 16+ 
- npm or yarn

### Installation

1. **Clone or download the project**
   ```bash
   cd aviator-game
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   Navigate to `http://localhost:3000`

### Build for Production

```bash
npm run build
```

The built files will be in the `dist` folder.

## Design System

### Color Palette
- **Primary Background**: `#111827` (gray-900)
- **Secondary Background**: `#1F2937` (gray-800)
- **Accent Color**: `#e40539` (custom red)
- **Text Colors**: White, gray variants, and colored accents

### Typography
- **Font Family**: Inter (sans-serif)
- **Multiplier Display**: Monospace with heavy weight
- **UI Text**: Various weights (400-900)

### Animations
- **Smooth Transitions**: 300ms cubic-bezier easing
- **Hover Effects**: Scale and glow transformations
- **Game States**: Pulse, bounce, and shimmer effects

## Mobile Optimization

- Touch-friendly controls (44px minimum)
- Optimized for various screen sizes
- Prevented zoom on double-tap
- Safe area considerations for modern phones
- Smooth scrolling with hidden scrollbars

## Game States

The game supports three main states controlled by the `gameState` prop:

1. **'betting'**: Users can place bets, plane is at starting position
2. **'running'**: Multiplier increasing, plane flying, users can cash out
3. **'crashed'**: Round ended, showing crash multiplier and waiting for next round

## Tech Stack

- **React 18**: Modern functional components with hooks
- **TailwindCSS**: Utility-first CSS framework
- **Vite**: Fast build tool and dev server
- **PostCSS**: CSS processing with Autoprefixer

## Project Structure

```
aviator-game/
├── components/
│   ├── MultiplierDisplay.js    # Animated multiplier display
│   ├── Plane.js               # SVG plane with animations
│   ├── BetPanel.js            # Betting controls and buttons
│   ├── HistoryItem.js         # Individual history pills
│   └── BottomNav.js           # Navigation menu
├── App.js                     # Main app component
├── main.jsx                   # React entry point
├── index.html                 # HTML template
├── styles.css                 # Custom CSS and Tailwind imports
├── tailwind.config.js         # Tailwind configuration
├── vite.config.js            # Vite configuration
└── package.json              # Dependencies and scripts
```

## Usage

The main `App.js` component manages the game state and coordinates all child components. You can customize the game by:

- Modifying the crash algorithm in the `useEffect` hook
- Adjusting colors and animations in the Tailwind config
- Adding new game features in the component files
- Customizing the bet amounts and balance logic

## Contributing

Feel free to submit issues, feature requests, or pull requests to improve the game!

## License

MIT License - feel free to use this code for your own projects.

3. Enhanced Betting System (Medium Priority)
Bet history - Track player's betting performance over time
Statistics dashboard - Win rate, biggest win, total wagered
Risk management - Daily loss limits, responsible gaming features

4. Technical Improvements (Medium Priority)
User authentication - Persistent accounts and balances
Better error handling - Connection drops, invalid bets
Performance optimization - Reduce WebSocket message frequency

5. Advanced Game Features
Multiple betting positions - Bet on multiple rounds simultaneously
Tournament mode - Compete in structured competitions
Achievements system - Unlock rewards for milestones
Custom themes - Different visual styles

Keep the current frontend (it's great!)
Add PostgreSQL database (essential)
Move game logic to server (security)
Implement provably fair (trust)
Add proper authentication (Telegram integration)

https://t.me/aviador_game_test_bot/app?startapp=v2025-08-21-01