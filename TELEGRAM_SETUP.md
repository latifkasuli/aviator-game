# Telegram Mini App Setup Guide

## Overview
This Aviator game is now optimized as a **Telegram Mini App** (WebApp) that runs inside Telegram with native integration.

## Quick Setup

### 1. Create a Telegram Bot
1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot` command
3. Choose a name: `Aviator Game Bot`
4. Choose a username: `aviator_game_bot` (must be unique)
5. Save the **Bot Token** you receive

### 2. Configure WebApp
Send these commands to @BotFather:

```
/setmenubutton
@your_bot_username
Play Aviator
https://your-domain.com
```

### 3. Set Bot Description
```
/setdescription
@your_bot_username
Aviator - The ultimate crash game! Bet on the plane's flight and cash out before it crashes. Test your timing and win big!
```

### 4. Set Bot Commands
```
/setcommands
@your_bot_username
start - Start playing Aviator
help - Get help and instructions
stats - View your game statistics
```

## Deployment Options

### Option 1: Vercel (Recommended)
1. Push your code to GitHub
2. Connect to [Vercel](https://vercel.com)
3. Deploy automatically
4. Use the Vercel URL for your WebApp

### Option 2: Netlify
1. Push to GitHub
2. Connect to [Netlify](https://netlify.com)
3. Build command: `npm run build`
4. Publish directory: `dist`

### Option 3: Your Own Server
1. Build the project: `npm run build`
2. Serve the `dist` folder
3. Ensure HTTPS is enabled (required for Telegram)

## Telegram WebApp Features Implemented

### Core Integration
- **Telegram WebApp SDK** loaded and initialized
- **User Authentication** via Telegram (no separate login needed)
- **Theme Integration** adapts to user's Telegram theme
- **Viewport Handling** optimized for Telegram's interface

### Native Features
- **Haptic Feedback** on button interactions
- **MainButton** integration for primary actions
- **BackButton** support for navigation
- **Theme Colors** automatically match Telegram's theme
- **User Data** access (name, username, photo)

### UI Adaptations
- **Telegram-native buttons** with proper styling
- **Safe area handling** for different devices
- **Theme-aware colors** that adapt to light/dark mode
- **Optimized layout** for Telegram's viewport

## Game Features for Telegram

### User Experience
- **No Registration Required** - uses Telegram identity
- **Instant Play** - launches directly in Telegram
- **Native Feel** - integrated haptic feedback and animations
- **Theme Consistency** - matches user's Telegram theme

### Social Features (Future)
- **Leaderboards** with Telegram usernames
- **Share Results** to Telegram chats
- **Invite Friends** via Telegram links
- **Group Competitions** within Telegram groups

## Development & Testing

### Local Testing
1. Start the development server: `npm run dev`
2. Use ngrok for HTTPS tunnel: `ngrok http 3000`
3. Update your bot's WebApp URL to the ngrok URL
4. Test in Telegram

### Production Deployment
1. Build: `npm run build`
2. Deploy to your hosting platform
3. Update bot WebApp URL to production domain
4. Test thoroughly in Telegram

## Telegram WebApp API Usage

### Available in Components
```javascript
import { useTelegramWebApp } from './components/TelegramWebApp.jsx';

const { 
  tg,              // Telegram WebApp instance
  user,            // Telegram user data
  themeParams,     // Theme colors
  hapticFeedback,  // Vibration feedback
  showAlert,       // Native Telegram alerts
  setMainButton,   // Configure main button
  close            // Close the WebApp
} = useTelegramWebApp();
```

### Haptic Feedback Types
```javascript
hapticFeedback('impact', 'light');    // Light tap
hapticFeedback('impact', 'medium');   // Medium tap
hapticFeedback('impact', 'heavy');    // Heavy tap
hapticFeedback('notification', 'success'); // Success notification
hapticFeedback('notification', 'error');   // Error notification
hapticFeedback('selection');          // Selection change
```

## Theme Integration

The app automatically adapts to Telegram's theme:
- **Background colors** match Telegram's background
- **Text colors** adapt to light/dark mode
- **Button colors** use Telegram's accent color
- **Secondary colors** match Telegram's secondary background

## Security Considerations

### Data Validation
- Always validate `initData` on your backend
- Use Telegram's data validation methods
- Don't trust client-side user data

### HTTPS Required
- Telegram WebApps require HTTPS
- Use valid SSL certificates
- Test with real HTTPS URLs

## Analytics & Monitoring

### Telegram-specific Metrics
- Track WebApp launches
- Monitor user engagement
- Analyze crash/success rates
- Track sharing and invites

### Recommended Tools
- **Telegram Analytics** (built-in)
- **Google Analytics** for web metrics
- **Custom backend analytics** for game-specific data

## Launch Checklist

- [ ] Bot created and configured
- [ ] WebApp URL set in BotFather
- [ ] HTTPS deployment working
- [ ] Telegram theme integration tested
- [ ] Haptic feedback working on mobile
- [ ] User data properly handled
- [ ] Game mechanics tested in Telegram
- [ ] Error handling for Telegram-specific issues
- [ ] Performance optimized for mobile
- [ ] Analytics tracking implemented

## Best Practices

### Performance
- Keep initial load under 3 seconds
- Optimize images and assets
- Use efficient animations
- Minimize JavaScript bundle size

### User Experience
- Provide clear onboarding
- Use Telegram's native UI patterns
- Handle network issues gracefully
- Provide offline functionality where possible

### Engagement
- Use push notifications sparingly
- Implement sharing features
- Create social leaderboards
- Encourage return visits

## Useful Links

- [Telegram WebApp Documentation](https://core.telegram.org/bots/webapps)
- [BotFather Commands](https://core.telegram.org/bots#6-botfather)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [WebApp Examples](https://github.com/telegram-bot-sdk/examples)

## Troubleshooting

### Common Issues
1. **WebApp not loading**: Check HTTPS and valid SSL
2. **Theme not applying**: Ensure Telegram WebApp SDK is loaded
3. **Haptic not working**: Test on actual mobile device
4. **User data missing**: Check bot permissions and initData

### Debug Mode
Add `?debug=true` to your URL to enable debug logging and see Telegram WebApp data in console.
