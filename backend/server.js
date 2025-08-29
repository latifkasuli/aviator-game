// 🚀 Aviator Game Backend (SECURE AUTHENTICATED VERSION)

const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
require('dotenv').config();

// Import our database services
const databaseService = require('./services/databaseService');
const provablyFairService = require('./services/provablyFairService');
const QuestService = require('./services/questService');
const authService = require('./authService');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Import error handling middleware
const { AppError, asyncHandler, errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();
const server = http.createServer(app);

// Trust proxy headers (required for Railway/Heroku/AWS)
// Railway uses a single proxy, so we set trust proxy to 1
app.set('trust proxy', 1);

// Log all requests in development/debugging
if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path} from ${req.ip}`);
    next();
  });
}

// Security middleware
const isProduction = process.env.NODE_ENV === 'production';
app.use(helmet({
  // Enable CSP in production for API responses (minimal, API-safe)
  contentSecurityPolicy: isProduction ? {
    useDefaults: true,
    directives: {
      // API returns JSON; block everything by default
      defaultSrc: ["'none'"],
      // Allow API consumers to call us - specify exact origins
      connectSrc: [
        "'self'", 
        "wss://aviator-game-production.up.railway.app", 
        "https://aviator-game-production.up.railway.app",
        "https://aviator-game-topaz.vercel.app" // NEW: Vercel frontend
      ],
      // Disallow framing except Telegram (documented hostnames)
      frameAncestors: ["'self'", "https://*.telegram.org"],
      // Basic allowances; API does not serve scripts/styles
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
    }
  } : false,
  crossOriginEmbedderPolicy: false
}));

// CORS: allowlist via env in production; permissive in dev
const parseOrigins = (val) => (val || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// Fred's Fix: Telegram WebView Origins
const TELEGRAM_ORIGINS = [
  'https://t.me',
  'https://web.telegram.org',
  'https://web.telegram.org/a',     // new WebApp domain variant
  'https://miniapp-assets.telegram.org', // asset host some clients use
  'https://telegram.org'
];

const allowedOrigins = isProduction
  ? [
      ...parseOrigins(process.env.CORS_ORIGINS), // your comma-separated env list
      ...TELEGRAM_ORIGINS
    ]
  : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:3001'];

// CORS middleware with error handling
const corsMiddleware = cors({
  origin: (origin, callback) => {
    try {
      // Allow no origin (mobile apps, Postman, curl, Telegram WebView)
      if (!origin) return callback(null, true);
      
      // Development mode: allow all
      if (!isProduction) return callback(null, true);
      
      // Production: check allowlist (now includes Telegram origins)
      if (allowedOrigins.includes(origin)) {
        console.log(`✅ CORS allowing origin: ${origin}`);
        return callback(null, true);
      }
      
      console.log(`❌ CORS blocked origin: ${origin}`);
      console.log(`✅ Allowed origins: ${allowedOrigins.join(', ')}`);
      return callback(new Error('CORS not allowed for this origin'));
    } catch (error) {
      console.error('CORS middleware error:', error);
      return callback(error);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  // IMPORTANT: include any custom headers you actually send
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Sec-WebSocket-Protocol',
    'X-Device-Id',              // <-- Fred's fix: this was missing!
    'X-Telegram-Init-Data',     // (optional) if you decide to validate initData
    'Accept',
    'Accept-Language',
    'User-Agent'
  ],
  preflightContinue: false,
  optionsSuccessStatus: 204
});

// Apply CORS before rate limiting so error responses include CORS headers
app.use(corsMiddleware);

// Handle OPTIONS requests explicitly
app.options('*', corsMiddleware);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  skip: (req) => req.method === 'OPTIONS', // Skip rate limiting for CORS preflight
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  validate: false, // Disable validation for production deployments
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: req.rateLimit.resetTime
    });
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 auth requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  skip: (req) => req.method === 'OPTIONS', // Skip rate limiting for CORS preflight
  validate: false, // Disable validation for production deployments
});

// Separate rate limiters for reading vs writing settings
const settingsReadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 600, // up to 10 req per second per IP
  skip: (req) => req.method === 'OPTIONS',
  validate: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests, please try again later.',
      retryAfter: req.rateLimit.resetTime
    });
  }
});

const settingsWriteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 12, // limit to 12 writes per minute per user
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => req.method === 'OPTIONS',
  validate: false,
  keyGenerator: (req) => {
    // Use user ID if available, fallback to IP
    try { 
      return req.user?.id || req.ip; 
    } catch { 
      return req.ip; 
    }
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many settings updates, please try again later.',
      retryAfter: req.rateLimit.resetTime
    });
  }
});

// Profile read limiter - more generous than auth limiter
const profileReadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 1 request per second per user
  skip: (req) => req.method === 'OPTIONS',
  validate: false,
  keyGenerator: (req) => {
    // Use user ID if available, fallback to IP
    try { 
      return req.user?.id || req.ip; 
    } catch { 
      return req.ip; 
    }
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests, please try again later.',
      retryAfter: req.rateLimit.resetTime
    });
  }
});

// Apply rate limiters (order matters - specific before general)
// Note: We'll apply these directly on the routes instead of globally
// Only apply auth limiter to actual auth endpoints (login, register, refresh)
app.use('/api/auth/telegram', authLimiter);
app.use('/api/auth/refresh', authLimiter);
app.use('/api/admin/login', authLimiter);
app.use('/api/admin/register', authLimiter);

// Exclude health, game-state, player settings, and profile from global rate limiting
app.use('/api/', (req, res, next) => {
  if (
    req.path === '/health' || 
    req.path === '/game-state' ||
    req.path.startsWith('/player/settings') ||
    req.path === '/auth/profile'
  ) {
    return next();
  }
  limiter(req, res, next);
});

app.use(express.json({ limit: '10mb' }));

// =============================================================================
// GAME STATE
// =============================================================================
let gameState = {
  state: 'betting',     // 'betting' | 'running' | 'crashed'
  multiplier: 1.00,
  countdown: 5,
  crashPoint: 0,
  startTime: 0,
  players: new Map(),      // Map<userId, { ws, user, isGuest }>
  activeBets: new Map(),   // Map<userId, { amount, cashedOut, cashedOutMultiplier }>
  crashHistory: [2.45, 1.89, 5.67, 1.23, 8.91, 3.45, 2.17, 12.34]  // Array of recent crash multipliers (last 10)
};

// =============================================================================
// AUTHENTICATION ROUTES
// =============================================================================

// Telegram authentication for players
app.post('/api/auth/telegram', [
  body('telegramUser').isObject(),
  body('telegramUser.id').isNumeric(),
  body('telegramUser.first_name').notEmpty().trim().escape(),
  body('startParam').optional().isString().trim()
], async (req, res) => {
  try {
    console.log('🔐 Telegram auth request:', JSON.stringify(req.body, null, 2));
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      return res.status(400).json({ error: 'Invalid Telegram data', details: errors.array() });
    }

    const { telegramUser, startParam } = req.body;
    
    // Find or create user based on Telegram ID
    let user = await databaseService.findUserByTelegramId(telegramUser.id);
    
    if (!user) {
      // Create new user from Telegram data
      const result = await databaseService.createUser({
        telegramId: telegramUser.id,
        username: telegramUser.username || `user_${telegramUser.id}`,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
        avatar: telegramUser.photo_url,
        languageCode: telegramUser.language_code
      });
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      user = result.user;
    } else {
      // Update last login time and enrich any missing fields from Telegram payload
      const updates = { lastLoginAt: new Date() };
      if (!user.avatar && telegramUser.photo_url) updates.avatar = telegramUser.photo_url;
      if (!user.firstName && telegramUser.first_name) updates.firstName = telegramUser.first_name;
      if (!user.lastName && telegramUser.last_name) updates.lastName = telegramUser.last_name;
      // If username was empty, set it. Do not overwrite existing username to avoid collisions
      if (!user.username && telegramUser.username) updates.username = telegramUser.username;
      if (Object.keys(updates).length > 0) {
        const r = await databaseService.updateUser(user.id, updates);
        if (r.success) {
          user = r.user;
        }
      }
    }

    // Generate tokens
    const tokenResult = authService.generateToken(user);
    const refreshTokenResult = authService.generateRefreshToken(user);

    if (!tokenResult.success || !refreshTokenResult.success) {
      return res.status(500).json({ error: 'Failed to generate tokens' });
    }

    // Fred's combined referral + version parameter parsing
    let referralMessage = null;
    if (startParam && typeof startParam === 'string') {
      const [maybeRef, maybeV] = startParam.split('__v_');
      
      // Handle referral attribution
      if (maybeRef && maybeRef.startsWith('ref_')) {
        const refCode = maybeRef.substring(4); // remove 'ref_' prefix
        try {
          const referralResult = await databaseService.attributeReferral({
            inviteeUserId: user.id,
            referralCode: refCode,
            ip: req.ip,
            deviceId: req.headers['x-device-id'] || null
          });
          
          if (referralResult.success && referralResult.inviteeBonusPaid) {
            // Update user object to reflect new balance
            user = await databaseService.findUserById(user.id);
            referralMessage = `Welcome! You've been referred by ${referralResult.referrerUsername} and received 1,000 points!`;
            
            // 🎮 QUEST TRACKING: Track successful referral for referrer
            if (referralResult.referrerUserId) {
              QuestService.trackReferral(referralResult.referrerUserId).catch(error => {
                console.error('❌ Quest tracking error (referral):', error);
              });
            }
          }
        } catch (e) {
          // Log but don't fail auth if attribution fails
          console.warn('Referral attribution skipped:', e.message);
        }
      }
      
      // Fred's version tracking (optional: for logging/telemetry)
      req.buildTag = maybeV || null;
      if (req.buildTag) {
        console.log(`📊 User authenticated with build version: ${req.buildTag}`);
      }
    }

    res.json({
      success: true,
      user: user,
      token: tokenResult.token,
      refreshToken: refreshTokenResult.refreshToken,
      referralMessage
    });
  } catch (error) {
    console.error('❌ Telegram authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// =============================================================================
// ADMIN AUTHENTICATION ROUTES (Email/Password)
// =============================================================================

// Admin registration (restricted)
app.post('/api/admin/register', [
  body('username').isLength({ min: 3, max: 20 }).trim().escape(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  // Disallow new admin registration in production unless explicitly enabled
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_ADMIN_REGISTRATION !== 'true') {
    return res.status(403).json({ error: 'Admin registration disabled in production' });
  }
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid input', details: errors.array() });
    }

    // Check if admin registration is allowed (you can add your own logic here)
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_REGISTRATION_KEY) {
      return res.status(403).json({ error: 'Admin registration not allowed' });
    }

    const { username, email, password } = req.body;
    const result = await databaseService.createUser({ 
      username, 
      email, 
      password,
      role: 'ADMIN' // Set role as admin
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Generate tokens
    const tokenResult = authService.generateToken(result.user);
    const refreshTokenResult = authService.generateRefreshToken(result.user);

    if (!tokenResult.success || !refreshTokenResult.success) {
      return res.status(500).json({ error: 'Failed to generate tokens' });
    }

    res.status(201).json({
      success: true,
      user: result.user,
      token: tokenResult.token,
      refreshToken: refreshTokenResult.refreshToken
    });
  } catch (error) {
    console.error('❌ Admin registration error:', error);
    res.status(500).json({ error: 'Admin registration failed' });
  }
});

// Admin login
app.post('/api/admin/login', [
  body('usernameOrEmail').notEmpty().trim().escape(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid input', details: errors.array() });
    }

    const { usernameOrEmail, password } = req.body;
    const result = await databaseService.authenticateUser(usernameOrEmail, password);

    if (!result.success) {
      return res.status(401).json({ error: result.error });
    }

    // Check if user is admin
    if (result.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Generate tokens
    const tokenResult = authService.generateToken(result.user);
    const refreshTokenResult = authService.generateRefreshToken(result.user);

    if (!tokenResult.success || !refreshTokenResult.success) {
      return res.status(500).json({ error: 'Failed to generate tokens' });
    }

    res.json({
      success: true,
      user: result.user,
      token: tokenResult.token,
      refreshToken: refreshTokenResult.refreshToken
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Refresh token
app.post('/api/auth/refresh', [
  body('refreshToken').notEmpty()
], async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const result = await authService.refreshAccessToken(refreshToken);

    if (!result.success) {
      return res.status(401).json({ error: result.error });
    }

    res.json({
      success: true,
      token: result.token
    });
  } catch (error) {
    console.error('❌ Token refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// Logout
app.post('/api/auth/logout', authService.authenticateToken.bind(authService), (req, res) => {
  try {
    const result = authService.logout(req.user.id);
    res.json(result);
  } catch (error) {
    console.error('❌ Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get current user profile
app.get('/api/auth/profile', 
  profileReadLimiter,
  authService.authenticateToken.bind(authService), 
  async (req, res) => {
    try {
      // Get fresh user data from database
      const user = await databaseService.findUserById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json({
        success: true,
        user: user
      });
    } catch (error) {
      console.error('❌ Profile fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch profile' });
    }
  }
);

// Update user profile
app.put('/api/auth/profile', [
  authService.authenticateToken.bind(authService),
  body('username').optional().isLength({ min: 3, max: 20 }).trim().escape(),
  body('email').optional().isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid input', details: errors.array() });
    }

    // For now, we'll just return the current user
    // In a full implementation, you'd update the allowed fields
    res.json({
      success: true,
      user: req.user
    });
  } catch (error) {
    console.error('❌ Profile update error:', error);
    res.status(500).json({ error: 'Profile update failed' });
  }
});

// Change password
app.post('/api/auth/change-password', [
  authService.authenticateToken.bind(authService),
  body('oldPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid input', details: errors.array() });
    }

    const { oldPassword, newPassword } = req.body;
    const result = await databaseService.changePassword(req.user.id, oldPassword, newPassword);

    res.json(result);
  } catch (error) {
    console.error('❌ Password change error:', error);
    res.status(500).json({ error: 'Password change failed' });
  }
});

// =============================================================================
// ADMIN MIDDLEWARE
// =============================================================================

// Import admin middleware and audit service
const { requireAdmin } = require('./middleware/adminMiddleware');
const adminAudit = require('./services/adminAuditService');

// =============================================================================
// ADMIN ROUTES
// =============================================================================

// Admin dashboard stats (enhanced)
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const stats = await databaseService.getAdminStats();
    
    // Add WebSocket stats
    const wsStats = {
      connectedClients: gameState.players.size,
      activeBets: gameState.activeBets.size,
      currentState: gameState.state,
      currentMultiplier: gameState.multiplier,
      roundId: currentGameRound?.id || null
    };
    
    res.json({
      success: true,
      stats: {
        ...stats,
        websocket: wsStats
      }
    });
  } catch (error) {
    console.error('❌ Admin stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Get all users (admin only)
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const users = await databaseService.getAllUsers(parseInt(page), parseInt(limit), search);
    res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error('❌ Admin get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Update user (admin only)
app.put('/api/admin/users/:userId', [
  requireAdmin,
  body('balance').optional().isNumeric(),
  body('isActive').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid input', details: errors.array() });
    }

    const { userId } = req.params;
    const updateData = req.body;
    
    const result = await databaseService.updateUser(userId, updateData);
    res.json(result);
  } catch (error) {
    console.error('❌ Admin update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Get single user details (admin only)
app.get('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    const user = await databaseService.findUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get additional user stats
    const [bets, referrals] = await Promise.all([
      databaseService.getUserBets(req.params.id, 1, 10),
      databaseService.getReferralStats(req.params.id)
    ]);
    
    res.json({ 
      success: true, 
      user,
      recentBets: bets.bets,
      referralStats: referrals
    });
  } catch (error) {
    console.error('❌ Admin get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Adjust user balance (admin only)
app.post('/api/admin/users/:id/adjust-balance', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, reason } = req.body || {};
    
    if (!Number.isFinite(amount) || !reason) {
      return res.status(400).json({ error: 'Invalid amount or missing reason' });
    }

    const before = await databaseService.findUserById(id);
    if (!before) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check for dual control
    if (process.env.ADMIN_DUAL_CONTROL === 'true') {
      const changeRequest = await databaseService.createAdminChangeRequest({
        action: 'USER_BALANCE_ADJUST',
        payload: { userId: id, amount, reason },
        requestedBy: req.admin.id
      });
      
      await adminAudit.log({
        adminUserId: req.admin.id,
        action: 'CHANGE_REQUEST_CREATE',
        targetType: 'USER',
        targetId: id,
        before: null,
        after: changeRequest,
        notes: reason,
        ip: req.admin.ip,
        userAgent: req.admin.userAgent
      });
      
      return res.json({ success: true, pendingRequestId: changeRequest.id });
    }

    // Immediate change
    const after = await databaseService.incrementBalance(id, amount);
    
    await adminAudit.log({
      adminUserId: req.admin.id,
      action: 'USER_BALANCE_ADJUST',
      targetType: 'USER',
      targetId: id,
      before,
      after,
      notes: `${reason} (Amount: ${amount})`,
      ip: req.admin.ip,
      userAgent: req.admin.userAgent
    });

    res.json({ success: true, user: after });
  } catch (error) {
    console.error('❌ Admin adjust balance error:', error);
    res.status(500).json({ error: 'Failed to adjust balance' });
  }
});

// Ban user (admin only)
app.post('/api/admin/users/:id/ban', requireAdmin, async (req, res) => {
  try {
    const before = await databaseService.findUserById(req.params.id);
    if (!before) {
      return res.status(404).json({ error: 'User not found' });
    }

    const result = await databaseService.updateUser(req.params.id, { isActive: false });
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    await adminAudit.log({
      adminUserId: req.admin.id,
      action: 'USER_BAN',
      targetType: 'USER',
      targetId: req.params.id,
      before,
      after: result.user,
      notes: req.body?.reason || null,
      ip: req.admin.ip,
      userAgent: req.admin.userAgent
    });

    res.json({ success: true, user: result.user });
  } catch (error) {
    console.error('❌ Admin ban user error:', error);
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

// Unban user (admin only)
app.post('/api/admin/users/:id/unban', requireAdmin, async (req, res) => {
  try {
    const before = await databaseService.findUserById(req.params.id);
    if (!before) {
      return res.status(404).json({ error: 'User not found' });
    }

    const result = await databaseService.updateUser(req.params.id, { isActive: true });
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    await adminAudit.log({
      adminUserId: req.admin.id,
      action: 'USER_UNBAN',
      targetType: 'USER',
      targetId: req.params.id,
      before,
      after: result.user,
      notes: req.body?.reason || null,
      ip: req.admin.ip,
      userAgent: req.admin.userAgent
    });

    res.json({ success: true, user: result.user });
  } catch (error) {
    console.error('❌ Admin unban user error:', error);
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

// Get game rounds (admin only)
app.get('/api/admin/game-rounds', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const rounds = await databaseService.getGameRounds(parseInt(page), parseInt(limit));
    res.json({
      success: true,
      rounds
    });
  } catch (error) {
    console.error('❌ Admin get game rounds error:', error);
    res.status(500).json({ error: 'Failed to get game rounds' });
  }
});

// Get single game round details (admin only)
app.get('/api/admin/game-rounds/:id', requireAdmin, async (req, res) => {
  try {
    const round = await databaseService.getGameRoundWithBets(req.params.id);
    if (!round) {
      return res.status(404).json({ error: 'Round not found' });
    }
    res.json({ success: true, round });
  } catch (error) {
    console.error('❌ Admin get round error:', error);
    res.status(500).json({ error: 'Failed to get round' });
  }
});

// =============================================================================
// ADMIN REFERRAL MANAGEMENT
// =============================================================================

// Get referrals list (admin only)
app.get('/api/admin/referrals', requireAdmin, async (req, res) => {
  try {
    const { 
      status = null, 
      page = 1, 
      limit = 50, 
      search = '' 
    } = req.query;
    
    const where = {};
    if (status) where.referrerRewardStatus = status;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [referrals, total] = await Promise.all([
      prisma.referral.findMany({
        where,
        include: {
          referrer: {
            select: {
              id: true,
              username: true,
              email: true
            }
          },
          invitee: {
            select: {
              id: true,
              username: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: parseInt(limit)
      }),
      prisma.referral.count({ where })
    ]);
    
    res.json({
      success: true,
      referrals,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('❌ Admin get referrals error:', error);
    res.status(500).json({ error: 'Failed to get referrals' });
  }
});

// Approve referral (admin only)
app.post('/api/admin/referrals/:id/approve', requireAdmin, async (req, res) => {
  try {
    const before = await databaseService.getReferralById(req.params.id);
    if (!before) {
      return res.status(404).json({ error: 'Referral not found' });
    }

    const result = await databaseService.approveReferral(req.params.id, req.admin.id);
    const after = await databaseService.getReferralById(req.params.id);

    await adminAudit.log({
      adminUserId: req.admin.id,
      action: 'REFERRAL_APPROVE',
      targetType: 'REFERRAL',
      targetId: req.params.id,
      before,
      after,
      notes: req.body?.notes || null,
      ip: req.admin.ip,
      userAgent: req.admin.userAgent
    });

    res.json({ success: true, referral: after });
  } catch (error) {
    console.error('❌ Admin approve referral error:', error);
    res.status(500).json({ error: 'Failed to approve referral' });
  }
});

// Reject referral (admin only)
app.post('/api/admin/referrals/:id/reject', requireAdmin, async (req, res) => {
  try {
    const before = await databaseService.getReferralById(req.params.id);
    if (!before) {
      return res.status(404).json({ error: 'Referral not found' });
    }

    const result = await databaseService.rejectReferral(
      req.params.id,
      req.admin.id,
      req.body?.reason || 'Admin rejected'
    );
    const after = await databaseService.getReferralById(req.params.id);

    await adminAudit.log({
      adminUserId: req.admin.id,
      action: 'REFERRAL_REJECT',
      targetType: 'REFERRAL',
      targetId: req.params.id,
      before,
      after,
      notes: req.body?.reason || null,
      ip: req.admin.ip,
      userAgent: req.admin.userAgent
    });

    res.json({ success: true, referral: after });
  } catch (error) {
    console.error('❌ Admin reject referral error:', error);
    res.status(500).json({ error: 'Failed to reject referral' });
  }
});

// =============================================================================
// ADMIN PLAYER SETTINGS
// =============================================================================

// Get player settings (admin only)
app.get('/api/admin/users/:id/settings', requireAdmin, async (req, res) => {
  try {
    const settings = await databaseService.getPlayerSettings(req.params.id);
    res.json({ success: true, settings });
  } catch (error) {
    console.error('❌ Admin get player settings error:', error);
    res.status(500).json({ error: 'Failed to get player settings' });
  }
});

// Update player settings (admin only)
app.put('/api/admin/users/:id/settings', requireAdmin, async (req, res) => {
  try {
    const before = await databaseService.getPlayerSettings(req.params.id);
    const result = await databaseService.updatePlayerSettings(req.params.id, req.body);
    const after = await databaseService.getPlayerSettings(req.params.id);

    await adminAudit.log({
      adminUserId: req.admin.id,
      action: 'PLAYER_SETTINGS_UPDATE',
      targetType: 'USER',
      targetId: req.params.id,
      before,
      after,
      notes: 'Admin override',
      ip: req.admin.ip,
      userAgent: req.admin.userAgent
    });

    res.json({ success: true, settings: after });
  } catch (error) {
    console.error('❌ Admin update player settings error:', error);
    res.status(500).json({ error: 'Failed to update player settings' });
  }
});

// =============================================================================
// ADMIN AUDIT LOG
// =============================================================================

// Get audit logs (admin only)
app.get('/api/admin/audit-logs', requireAdmin, async (req, res) => {
  try {
    const {
      action = null,
      targetType = null,
      adminUserId = null,
      startDate = null,
      endDate = null,
      page = 1,
      limit = 50
    } = req.query;

    const result = await adminAudit.searchLogs({
      action,
      targetType,
      adminUserId,
      startDate,
      endDate,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('❌ Admin get audit logs error:', error);
    res.status(500).json({ error: 'Failed to get audit logs' });
  }
});

// Get audit logs for specific target (admin only)
app.get('/api/admin/audit-logs/:targetType/:targetId', requireAdmin, async (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    const logs = await adminAudit.getLogsForTarget(targetType, targetId);
    res.json({ success: true, logs });
  } catch (error) {
    console.error('❌ Admin get target audit logs error:', error);
    res.status(500).json({ error: 'Failed to get audit logs' });
  }
});

// =============================================================================
// PUBLIC ROUTES
// =============================================================================

// Fred's Debug Endpoint (remove after testing)
app.get('/api/auth/debug-token', (req, res) => {
  const token = (req.headers.authorization || '').split(' ')[1] || '';
  const result = authService.verifyToken(token);
  res.json({
    tokenProvided: !!token,
    verification: result,
    activeSessionsCount: authService.getActiveSessionsCount()
  });
});

// Telegram referral tracking (Fred's implementation)
app.post('/api/referral/track', async (req, res) => {
  try {
    const { ref } = req.body || {};
    if (!ref || typeof ref !== 'string') return res.status(400).json({ success:false, error: 'Invalid ref' });

    // Normalize: expect ref like "ref_<userId>"
    const m = ref.match(/^ref_(.+)$/);
    if (!m) return res.status(200).json({ success:true }); // ignore unknown formats quietly

    const inviterId = m[1];

    // Persist a "pending" attribution keyed to device fingerprint / IP+UA combo
    // A minimal approach:
    const ua = (req.headers['user-agent'] || '').slice(0,256);
    const ip = req.ip;
    
    // For now, just log the tracking attempt
    // TODO: Implement databaseService.recordReferralClick({ inviterId, ip, ua });
    console.log(`📊 Referral tracking: inviter=${inviterId}, ip=${ip}, ua=${ua.slice(0,50)}...`);

    return res.json({ success: true });
  } catch (e) {
    console.error('❌ referral/track error:', e);
    res.status(500).json({ success:false, error: 'Failed to track referral' });
  }
});

// Get recent rounds for fairness verification
app.get('/api/fairness/recent-rounds', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const rounds = await databaseService.getRecentRoundsForFairness(parseInt(limit));
    
    res.json({
      success: true,
      rounds
    });
  } catch (error) {
    console.error('❌ Fairness rounds error:', error);
    res.status(500).json({ error: 'Failed to get recent rounds' });
  }
});

// Get leaderboard
app.get('/api/leaderboard', authService.optionalAuth.bind(authService), async (req, res) => {
  try {
    const { type = 'balance', limit = 10 } = req.query;
    const leaderboard = await databaseService.getLeaderboard(type, parseInt(limit));
    
    res.json({
      success: true,
      leaderboard,
      type,
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('❌ Leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// =============================================================================
// REFERRAL SYSTEM ROUTES
// =============================================================================

app.get('/api/referrals/stats',
  authService.authenticateToken.bind(authService),
  async (req, res) => {
    try {
      const stats = await databaseService.getReferralStats(req.user.id);
      
      if (!stats) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      console.error('❌ Referral stats error:', error);
      res.status(500).json({ error: 'Failed to get referral stats' });
    }
  }
);

// =============================================================================
// FARMING SYSTEM ROUTES (auth required)
// =============================================================================

app.get('/api/farming/status',
  authService.authenticateToken.bind(authService),
  async (req, res) => {
    try {
      const user = await databaseService.findUserById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const now = new Date();
      const lastClaimed = user.lastClaimedAt ? new Date(user.lastClaimedAt) : null;
      
      // Configuration values
      const cycleHours = 6;
      const rewardPoints = 6000;
      
      const hoursElapsed = lastClaimed 
        ? (now - lastClaimed) / (1000 * 60 * 60) 
        : cycleHours; // If never claimed, allow first claim
      
      const canClaim = hoursElapsed >= cycleHours;
      const nextClaimTime = lastClaimed 
        ? new Date(lastClaimed.getTime() + cycleHours * 60 * 60 * 1000)
        : now;

      res.json({
        success: true,
        canClaim,
        lastClaimedAt: lastClaimed,
        nextClaimTime: canClaim ? now : nextClaimTime,
        hoursElapsed: Math.min(hoursElapsed, cycleHours), // Cap at cycleHours
        pointsAvailable: canClaim ? rewardPoints : 0,
        cycleHours,
        rewardPoints
      });
    } catch (error) {
      console.error('❌ Farming status error:', error);
      res.status(500).json({ error: 'Failed to get farming status' });
    }
  }
);

app.post('/api/farming/claim',
  authService.authenticateToken.bind(authService),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const result = await databaseService.claimFarmingPoints(userId);
      
      if (!result.success) {
        return res.status(400).json(result);
      }

      // Update cached balance if player is connected
      const player = gameState.players.get(userId);
      if (player && player.user) {
        player.user.balance = result.newBalance;
        // Force a player overlay update to sync the UI
        if (player.ws && player.ws.readyState === WebSocket.OPEN) {
          const personalBet = gameState.activeBets.get(userId);
          player.ws.send(JSON.stringify({
            type: 'playerOverlay',
            data: {
              hasActiveBet: !!personalBet,
              activeBetAmount: personalBet?.amount || 0,
              cashedOut: personalBet?.cashedOut || false,
              cashedOutMultiplier: personalBet?.cashedOutMultiplier || 0,
              balance: result.newBalance
            }
          }));
        }
      }

      res.json(result);
    } catch (error) {
      console.error('❌ Farming claim error:', error);
      res.status(500).json({ error: 'Failed to claim farming points' });
    }
  }
);

// =============================================================================
// QUEST SYSTEM ROUTES (auth required)
// =============================================================================

// Get user's current quest status
app.get('/api/quests',
  authService.authenticateToken.bind(authService),
  async (req, res) => {
    try {
      const quests = await QuestService.getUserQuests(req.user.id);
      res.json({ success: true, quests });
    } catch (error) {
      console.error('❌ Error fetching quests:', error);
      res.status(500).json({ error: 'Failed to fetch quests' });
    }
  }
);

// Claim a completed quest reward
app.post('/api/quests/claim',
  authService.authenticateToken.bind(authService),
  [
    body('questType').isString().notEmpty().withMessage('Quest type is required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { questType } = req.body;
      const result = await QuestService.claimQuest(req.user.id, questType);
      
      // Update cached balance if player is connected
      const player = gameState.players.get(req.user.id);
      if (player && player.user) {
        player.user.balance = result.newBalance;
        // Force a player overlay update to sync the UI
        if (player.ws && player.ws.readyState === WebSocket.OPEN) {
          const personalBet = gameState.activeBets.get(req.user.id);
          player.ws.send(JSON.stringify({
            type: 'playerOverlay',
            data: {
              hasActiveBet: !!personalBet,
              activeBetAmount: personalBet?.amount || 0,
              cashedOut: personalBet?.cashedOut || false,
              cashedOutMultiplier: personalBet?.cashedOutMultiplier || 0,
              balance: result.newBalance
            }
          }));
        }
      }

      res.json(result);
    } catch (error) {
      console.error('❌ Error claiming quest:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

// Get quest statistics (admin only)
app.get('/api/admin/quests/stats', requireAdmin, async (req, res) => {
  try {
    const stats = await QuestService.getQuestStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('❌ Error fetching quest stats:', error);
    res.status(500).json({ error: 'Failed to fetch quest statistics' });
  }
});

// =============================================================================
// PLAYER SETTINGS ROUTES (auth required)
// =============================================================================

app.get('/api/player/settings', 
  authService.authenticateToken.bind(authService),
  settingsReadLimiter,
  async (req, res) => {
    try {
      const settings = await databaseService.getPlayerSettings(req.user.id);
      res.set('Cache-Control', 'private, max-age=5'); // tiny cache
      res.json({ success: true, settings: settings || null });
    } catch (error) {
      console.error('❌ Player settings get error:', error);
      res.status(500).json({ error: 'Failed to get settings' });
    }
  }
);

// Restore the actual implementation with extra logging
app.put('/api/player/settings', 
  authService.authenticateToken.bind(authService),
  settingsWriteLimiter,
  async (req, res) => {
    try {
      console.log('📥 PUT /api/player/settings - User:', req.user?.id, 'Body:', req.body);
      console.log('  - Full user object:', req.user);
      
      const { 
        autoCashoutEnabled, 
        autoCashoutMultiplier, 
        soundEnabled,
        dailyLimitsEnabled,
        maxDailyWager,
        maxDailyLoss,
        maxGamesPerDay
      } = req.body || {};
      
      const payload = {};
      if (typeof autoCashoutEnabled === 'boolean') payload.autoCashoutEnabled = autoCashoutEnabled;
      if (typeof autoCashoutMultiplier === 'number') payload.autoCashoutMultiplier = autoCashoutMultiplier;
      if (typeof soundEnabled === 'boolean') payload.soundEnabled = soundEnabled;
      if (typeof dailyLimitsEnabled === 'boolean') payload.dailyLimitsEnabled = dailyLimitsEnabled;
      if (typeof maxDailyWager === 'number') payload.maxDailyWager = maxDailyWager;
      if (typeof maxDailyLoss === 'number') payload.maxDailyLoss = maxDailyLoss;
      if (typeof maxGamesPerDay === 'number') payload.maxGamesPerDay = maxGamesPerDay;

      console.log('📤 Saving settings payload:', payload);
      const updated = await databaseService.upsertPlayerSettings(req.user.id, payload);
      console.log('✅ Settings saved to DB:', updated);
      
      // 🚀 FRED'S FIX: Update cached settings for connected player
      const connectedPlayer = gameState.players.get(req.user.id);
      if (connectedPlayer) {
        connectedPlayer.settings = updated || connectedPlayer.settings;
        console.log('🔄 Updated cached settings for connected player:', req.user.username);
      }
      
      res.json({ success: true, settings: updated });
    } catch (error) {
      console.error('❌ Player settings update error:', error);
      console.error('Full error stack:', error.stack);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  }
);

// Crash point generation now uses provably fair system
let currentGameRound = null;
let countdownInterval = null; // Track countdown interval to prevent memory leaks

// NEW: Throttle broadcast cadence (5 Hz)
const BROADCAST_MS = 200;
let lastBroadcastAt = 0;

// =============================================================================
// GAME LOOP
// =============================================================================
function startGameLoop() {
  console.log('🎮 Game loop started');
  async function startBetting() {
    // Clear any existing countdown interval to prevent memory leaks
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    
    gameState.state = 'betting';
    gameState.multiplier = 1.0;
    gameState.countdown = 5;
    
    // Generate new game round with provably fair crash point
    const fairRound = provablyFairService.generateFairRound();
    currentGameRound = await databaseService.createGameRound(fairRound);
    gameState.crashPoint = fairRound.crashPoint;
    gameState.currentRoundHash = fairRound.serverSeedHash; // Show hash before round
    gameState.currentRoundSeed = fairRound.serverSeed; // Reveal after crash
    gameState.activeBets.clear();
    console.log(`💰 Betting phase. Crash at ${gameState.crashPoint.toFixed(2)}x`);
    broadcastAll();
    countdownInterval = setInterval(() => {
      gameState.countdown--;
      broadcastAll();
      if (gameState.countdown <= 0) {
        clearInterval(countdownInterval);
        countdownInterval = null;
        startFlying();
      }
    }, 1000);
  }
  async function startFlying() {
    gameState.state = 'running';
    gameState.startTime = Date.now();
    
    // Update game round status to running
    if (currentGameRound) {
      try {
        await databaseService.updateGameRoundStatus(currentGameRound.id, 'RUNNING');
      } catch (error) {
        console.error('❌ Error updating game round to running:', error);
      }
    }
    
    console.log("✈️ Plane taking off");
    broadcastAll(true); // immediate edge broadcast
    
    const TICK_MS = 50; // logic cadence (kept small for crash accuracy)
    
    const tick = async () => {
      const now = Date.now();
      // Stable formula: no incremental FP drift
      gameState.multiplier = 1 + (now - gameState.startTime) / 3000;
      
      // Throttled broadcast (5 Hz)
      if (now - lastBroadcastAt >= BROADCAST_MS) {
        lastBroadcastAt = now;
        broadcastAll();
      }
      
      // 🚀 FRED'S FIX: Server-side authoritative auto-cashout
      for (const [uid, bet] of gameState.activeBets.entries()) {
        if (bet.cashedOut) continue;
        if (bet.autoTarget && gameState.multiplier >= bet.autoTarget) {
          console.log(`🤖 Server auto-cashout triggered for ${uid} at ${gameState.multiplier.toFixed(2)}x (target: ${bet.autoTarget}x)`);
          await handleCashOut(uid, true); // Authoritative server auto-cashout
        }
      }
      
      if (gameState.multiplier >= gameState.crashPoint) {
        // Final edge broadcast just before crash
        broadcastAll(true);
        return crash();
      }
      setTimeout(tick, TICK_MS);
    };
    setTimeout(tick, TICK_MS);
  }
  async function crash() {
    const crashAt = Date.now();
    const GRACE_MS = 100; // Fred's fairness window: 80-120ms recommended
    
    // 🚀 FRED'S FIX: Accept manual cashouts received just before crash (fairness)
    console.log('🔍 Checking grace window cashouts...');
    for (const [uid, bet] of gameState.activeBets.entries()) {
      if (!bet?.cashedOut && bet?.lastCashoutReqAt && (crashAt - bet.lastCashoutReqAt) <= GRACE_MS) {
        console.log(`⚡ Grace window cashout for ${uid}: received ${crashAt - bet.lastCashoutReqAt}ms before crash`);
        await handleCashOut(uid, false); // Manual cashout within grace window
      }
    }
    
    gameState.state = 'crashed';
    gameState.multiplier = gameState.crashPoint;
    
    // Record crashed bets (bets that didn't cash out)
    if (currentGameRound) {
      try {
        // Handle all uncashed bets as crashed
        await databaseService.crashBets(currentGameRound.id, gameState.crashPoint);
        
        // 🎮 QUEST TRACKING: Track bet losses for lucky streak reset
        for (const [uid, bet] of gameState.activeBets.entries()) {
          if (!bet.cashedOut) {
            const player = gameState.players.get(uid);
            if (player && !player.isGuest && player.user?.id) {
              QuestService.trackBetLoss(player.user.id).catch(error => {
                console.error('❌ Quest tracking error (bet loss):', error);
              });
            }
          }
        }
        
        // Complete the game round in database
        await databaseService.updateGameRoundStatus(currentGameRound.id, 'CRASHED', new Date());
      } catch (error) {
        console.error('❌ Error handling game round completion:', error);
      }
    }
    
    // Add to crash history (keep last 10)
    gameState.crashHistory.unshift(gameState.crashPoint);
    if (gameState.crashHistory.length > 10) {
      gameState.crashHistory.pop();
    }
    
    console.log(`💥 Crashed at ${gameState.crashPoint.toFixed(2)}x`);
    broadcastAll();
    setTimeout(startBetting, 3000);
  }
  startBetting();
}

// =============================================================================
// WebSocket handling - Railway-compatible with heartbeat
// =============================================================================
// WebSocket server with proper subprotocol handling
const wss = new WebSocket.Server({ 
  noServer: true,
  handleProtocols: (protocols, request) => {
    // Guard against undefined or empty protocols
    if (!protocols || protocols.size === 0) return false;

    // Check for access_token subprotocol using Set.has()
    if (protocols.has('access_token')) {
      return 'access_token';
    }

    // Check for bearer token in protocols using spread operator for array methods
    const bearerProtocol = [...protocols].find(p => p.startsWith('bearer.'));
    return bearerProtocol || false;
  }
});

function heartbeat() { 
  this.isAlive = true; 
}

function broadcastAll(force = false) {
  const frame = {
    type: 'gameState',
    data: {
      state: gameState.state,
      multiplier: gameState.multiplier,
      countdown: gameState.countdown,
      playersOnline: gameState.players.size,
      crashHistory: gameState.crashHistory,
      serverTime: Date.now(), // NEW: clients use this to interpolate
    }
  };
  const commonFrame = JSON.stringify(frame);

  for (const [userId, p] of gameState.players.entries()) {
    if (p.ws.readyState !== WebSocket.OPEN) continue;

    // NEW: backpressure protection — skip non-forced frames when buffer is big
    if (!force && p.ws.bufferedAmount > 128 * 1024) {
      // Optional: once per window, warn the client they're falling behind
      continue;
    }

    const personalBet = gameState.activeBets.get(userId);
    const balance = p.isGuest ? p.guestBalance : p.user.balance;

    p.ws.send(commonFrame);
    p.ws.send(JSON.stringify({
      type: 'playerOverlay',
      data: {
        hasActiveBet: !!personalBet,
        activeBetAmount: personalBet && personalBet.amount || 0,
        cashedOut: personalBet && personalBet.cashedOut || false,
        cashedOutMultiplier: personalBet && personalBet.cashedOutMultiplier || 0,
        balance,
        isAuthenticated: !p.isGuest,
        user: p.isGuest ? null : p.user
      }
    }));
  }
}

wss.on('connection', async (ws, req) => {
  // Enable heartbeat for this connection
  ws.isAlive = true;
  ws.on('pong', heartbeat);

  // Per-connection simple rate limit (messages/second)
  ws._msgWindowStart = Date.now();
  ws._msgCount = 0;

  let userId = null;
  let user = null;
  let isGuest = true;

  // Fred's Enhanced Authentication & Logging
  const url = new URL(req.url, `http://${req.headers.host}`);
  let token = url.searchParams.get('token') || req.headers.authorization?.split(' ')[1];
  
  // Also accept token via WebSocket subprotocols: ['auth','bearer.<token>']
  if (!token && req.headers['sec-websocket-protocol']) {
    const prot = req.headers['sec-websocket-protocol'].split(',').map(s => s.trim());
    const bearer = prot.find(p => p.startsWith('bearer.'));
    if (bearer) token = bearer.substring('bearer.'.length);
  }

  if (!token) {
    console.log('🟨 WS connected without token → guest session');
  }

  if (token) {
    const verification = authService.verifyToken(token);
    if (!verification.success) {
      console.log('🟥 JWT verification failed:', verification.error || verification);
    } else {
      // Fred's Fix: Robust user resolution with sub claim + fallbacks
      const d = verification.decoded;
      const claimedId = d.sub || d.userId || d.id;   // prefer sub (Fred's standard)
      let u = null;

      // Look up by canonical DB id
      try {
        if (claimedId) u = await databaseService.findUserById(String(claimedId));
      } catch (e) {
        console.log('findUserById error:', e?.message);
      }

      // Fred's Fallback: try telegramId if present (and id lookup failed)
      if (!u && d.telegramId && databaseService.findUserByTelegramId) {
        try {
          u = await databaseService.findUserByTelegramId(d.telegramId);
          if (u) console.log('✅ Found user via telegramId fallback');
        } catch (_) {}
      }

      if (u && u.isActive) {
        user = u;
        userId = String(u.id);
        isGuest = false;
        console.log(`🔐 WS authenticated as ${u.username} (${userId})`);
      } else if (!u) {
        console.log(`🟥 JWT OK but user not found (claimedId: ${claimedId}) - continuing as guest`);
        // Fred's Fix: tell client so it can self-heal
        try {
          ws.send(JSON.stringify({ type: 'auth_error', data: { reason: 'STALE_TOKEN' } }));
        } catch(_) {}
      } else if (!u.isActive) {
        console.log('🟥 User inactive - continuing as guest');
      }
    }
  }

  // If not authenticated, create guest session
  if (isGuest) {
    userId = 'guest_' + Math.random().toString(36).substring(7);
    console.log(`👤 Guest player connected: ${userId}`);
  }

  // Fetch and cache player settings on connection
  let playerSettings = null;
  if (!isGuest && user?.id) {
    try {
      playerSettings = await databaseService.getPlayerSettings(user.id) || {};
      console.log('📋 Cached settings for user', user.username, ':', playerSettings);
    } catch (error) {
      console.error('❌ Failed to load player settings:', error);
      playerSettings = {};
    }
  }

  // Store player connection with cached settings
  gameState.players.set(userId, { 
    ws, 
    user: user,
    isGuest: isGuest,
    guestBalance: isGuest ? 10000 : 0, // Guests get demo balance
    settings: playerSettings || {} // Cache settings for server-side auto-cashout
  });
  
  ws.userId = userId;
  ws.isGuest = isGuest;
  
  // 🎮 QUEST TRACKING: Track login for registered users
  if (!isGuest && user?.id) {
    QuestService.trackLogin(user.id).catch(error => {
      console.error('❌ Quest tracking error (login):', error);
    });
  }

  console.log(`📊 Sending initial crash history:`, gameState.crashHistory);
  
  // Send connection confirmation
  ws.send(JSON.stringify({
    type: 'connected',
    data: { 
      userId: userId,
      playerId: userId,
      isGuest: isGuest,
      user: isGuest ? null : user
    }
  }));

  ws.on('message', (msg) => {
    try {
      // Rate limiting: allow up to 10 messages per second
      const now = Date.now();
      if (now - ws._msgWindowStart >= 1000) {
        ws._msgWindowStart = now;
        ws._msgCount = 0;
      }
      ws._msgCount += 1;
      if (ws._msgCount > 10) {
        console.warn(`🚧 Rate limit exceeded for user ${ws.userId}`);
        // Send rate limit warning once per window
        if (ws._msgCount === 11) {
          ws.send(JSON.stringify({
            type: 'warning',
            data: { message: 'Rate limit exceeded. Please slow down your requests.' }
          }));
        }
        return; // Drop excess messages
      }

      const data = JSON.parse(msg);
      if (!data || typeof data !== 'object' || typeof data.type !== 'string') {
        return; // Ignore invalid messages
      }

      // Basic schema validation
      if (data.type === 'bet') {
        const amount = Number(data.amount);
        if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
          return; // invalid bet
        }
      }

      const id = ws.userId;
      if (!id) return;
      if (data.type === 'bet') handleBet(id, data.amount);
      if (data.type === 'cashOut') {
        // 🚀 FRED'S FIX: Record manual cashout request timing for grace window
        const bet = gameState.activeBets.get(id);
        if (bet && !bet.cashedOut) {
          bet.lastCashoutReqAt = Date.now(); // Server receive time
        }
        handleCashOut(id);
      }
    } catch (err) {
      console.error("Could not parse:", msg);
    }
  });

  ws.on('close', () => {
    gameState.players.delete(userId);
    gameState.activeBets.delete(userId);
    if (isGuest) {
      console.log(`👋 Guest player ${userId} disconnected. Total players: ${gameState.players.size}`);
    } else {
      console.log(`👋 User ${user.username} disconnected. Total players: ${gameState.players.size}`);
    }
  });
});

// Heartbeat system - ping clients every 15s to keep connections alive
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log(`💀 Terminating dead connection for user: ${ws.userId}`);
      return ws.terminate();
    }
    // Check readyState before pinging to avoid errors
    if (ws.readyState === WebSocket.OPEN) {
      ws.isAlive = false;
      ws.ping();
    }
  });
}, 15000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

// Manual upgrade handling - only upgrade on /ws path
server.on('upgrade', (req, socket, head) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);
  console.log(`🔌 WebSocket upgrade request for: ${req.url}`);

  if (pathname !== '/ws') {
    console.log(`❌ Rejecting upgrade for non-WebSocket path: ${req.url}`);
    socket.destroy();
    return;
  }

  console.log(`✅ Upgrading connection to WebSocket on /ws`);
  
  // Check if client requested any subprotocols
  const requestedProtocols = req.headers['sec-websocket-protocol'];
  let acceptedProtocol = null;
  
  if (requestedProtocols) {
    // Parse requested protocols
    const protocols = requestedProtocols.split(',').map(p => p.trim());
    
    // We accept 'access_token' or any 'bearer.*' protocol
    if (protocols.includes('access_token')) {
      acceptedProtocol = 'access_token';
    } else {
      const bearerProtocol = protocols.find(p => p.startsWith('bearer.'));
      if (bearerProtocol) {
        acceptedProtocol = bearerProtocol;
      }
    }
  }
  
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

// =============================================================================
// Bet / CashOut logic
// =============================================================================
async function handleBet(userId, amount) {
  const player = gameState.players.get(userId);
  if (!player || gameState.state !== 'betting') return;

  // Get current balance
  const currentBalance = player.isGuest ? player.guestBalance : player.user.balance;
  
  if (amount > currentBalance) return;

  let betId = null;
  
  // Deduct bet amount
  if (player.isGuest) {
    player.guestBalance -= amount;
  } else {
    // Use placeBet which handles balance update and bet recording
    if (currentGameRound) {
      try {
        const bet = await databaseService.placeBet(userId, currentGameRound.id, amount);
        betId = bet.id;
        // Update cached user balance
        player.user.balance = parseFloat(player.user.balance) - amount;
      } catch (error) {
        console.error('❌ Failed to place bet:', error);
        player.ws.send(JSON.stringify({ 
          type: 'error', 
          data: { message: error.message || 'Failed to place bet' } 
        }));
        return;
      }
    }
  }

  // 🚀 FRED'S FIX: Tag bet with auto-cashout target from cached settings
  const autoTarget = (player?.settings?.autoCashoutEnabled && Number(player?.settings?.autoCashoutMultiplier) > 1)
    ? Number(player.settings.autoCashoutMultiplier)
    : null;

  gameState.activeBets.set(userId, {
    amount,
    cashedOut: false,
    cashedOutMultiplier: 0,
    betId,
    autoTarget,               // 🎯 Server-side auto-cashout target
    lastCashoutReqAt: null    // 🕒 Manual cashout timing for grace window
  });

  const newBalance = player.isGuest ? player.guestBalance : player.user.balance;
  player.ws.send(JSON.stringify({ 
    type: 'betPlaced', 
    data: { amount, balance: newBalance } 
  }));
  
  // 🎮 QUEST TRACKING: Track bet placement for registered users
  if (!player.isGuest && player.user?.id) {
    QuestService.trackBetPlaced(player.user.id, amount).catch(error => {
      console.error('❌ Quest tracking error (bet placed):', error);
    });
  }
}

async function handleCashOut(userId, isAutomatic = false) {
  const player = gameState.players.get(userId);
  const bet = gameState.activeBets.get(userId);
  if (!player || !bet || bet.cashedOut || gameState.state !== 'running') return;
  
  const winnings = Math.floor(bet.amount * gameState.multiplier);
  bet.cashedOut = true;
  bet.cashedOutMultiplier = gameState.multiplier;
  
  // Add winnings to balance
  if (player.isGuest) {
    player.guestBalance += winnings;
  } else {
    // Use cashoutBet which handles balance update and bet recording
    if (bet.betId) {
      try {
        await databaseService.cashoutBet(bet.betId, gameState.multiplier);
        // Update cached user balance
        player.user.balance = parseFloat(player.user.balance) + winnings;
      } catch (error) {
        console.error('❌ Failed to cashout bet:', error);
        // Revert cashout state
        bet.cashedOut = false;
        bet.cashedOutMultiplier = 0;
        player.ws.send(JSON.stringify({ 
          type: 'error', 
          data: { message: error.message || 'Failed to cashout' } 
        }));
        return;
      }
    }
  }

  const newBalance = player.isGuest ? player.guestBalance : player.user.balance;
  player.ws.send(JSON.stringify({ 
    type: 'cashedOut', 
    data: { 
      winnings, 
      multiplier: bet.cashedOutMultiplier, 
      balance: newBalance,
      isAutomatic // 🚀 FRED'S FIX: Flag for client to distinguish auto vs manual
    } 
  }));
  
  // 🎮 QUEST TRACKING: Track successful cashout for registered users
  if (!player.isGuest && player.user?.id) {
    QuestService.trackCashout(player.user.id, bet.cashedOutMultiplier).catch(error => {
      console.error('❌ Quest tracking error (cashout):', error);
    });
  }
}

// =============================================================================
// REST API
// =============================================================================
app.get('/api/health', (_, res) => {
  res.json({ 
    status: 'OK', 
    players: gameState.players.size,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});
app.get('/api/game-state', (_,res)=>res.json({ state:gameState.state, multiplier:gameState.multiplier, countdown:gameState.countdown, players:gameState.players.size }));

// Error handling middleware (must be last)
app.use(notFound);
app.use(errorHandler);

// Add error handler for uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

const PORT = process.env.PORT || 3002;

// Startup diagnostics
console.log('🔧 Starting server with configuration:');
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`   PORT: ${PORT}`);
console.log(`   CORS_ORIGINS: ${process.env.CORS_ORIGINS || 'not set'}`);
console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? 'set' : 'not set'}`);
if (process.env.DATABASE_URL) {
  try {
    const dbUrl = new URL(process.env.DATABASE_URL);
    console.log(`   DB Host: ${dbUrl.host}`);
    console.log(`   DB Name: ${dbUrl.pathname.slice(1)}`);
  } catch (e) {
    console.log('   DB URL parsing failed');
  }
}

// Temporary endpoint to set admin password (no auth required for first-time setup)
app.post('/api/admin/setup-password', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    // Check if user exists
    const user = await databaseService.prisma.user.findFirst({
      where: {
        OR: [
          { username: username },
          { email: username }
        ]
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Hash password and update user
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await databaseService.prisma.user.update({
      where: { id: user.id },
      data: { 
        password: hashedPassword,
        role: 'ADMIN' // Ensure they have admin role
      }
    });
    
    console.log(`✅ Password set for admin user: ${user.username}`);
    
    res.json({
      success: true,
      message: `Password set successfully for ${user.username}`,
      role: 'ADMIN'
    });
    
  } catch (error) {
    console.error('❌ Error setting admin password:', error);
    res.status(500).json({ error: 'Failed to set password' });
  }
});

// Temporary admin endpoint to fix referral codes
app.post('/api/admin/fix-referral-codes', requireAdmin, async (req, res) => {
  try {
    console.log('🔧 Admin triggered referral codes fix via API...');
    
    // Find users without referral codes
    const usersWithoutCodes = await databaseService.prisma.user.findMany({
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
    
    console.log(`📊 Found ${usersWithoutCodes.length} users without referral codes`);
    
    let fixedCount = 0;
    for (const user of usersWithoutCodes) {
      try {
        // Generate a unique referral code
        const referralCode = Math.random().toString(36).substring(2, 10).toUpperCase();
        
        await databaseService.prisma.user.update({
          where: { id: user.id },
          data: { referralCode }
        });
        
        console.log(`✅ Fixed referral code for user ${user.username}: ${referralCode}`);
        fixedCount++;
      } catch (error) {
        console.error(`❌ Failed to fix referral code for user ${user.username}:`, error);
      }
    }
    
    console.log(`🎉 Successfully fixed ${fixedCount} referral codes`);
    
    res.json({
      success: true,
      message: `Fixed ${fixedCount} referral codes`,
      usersFixed: fixedCount,
      totalUsersFound: usersWithoutCodes.length
    });
    
  } catch (error) {
    console.error('❌ Error in fix-referral-codes endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fix referral codes',
      details: error.message
    });
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔐 CORS origins: ${allowedOrigins.join(', ') || 'development mode (all origins)'}`);
  console.log(`🎯 Telegram origins supported: ${TELEGRAM_ORIGINS.join(', ')}`);
  console.log('✅ Server started successfully');
  startGameLoop();
}).on('error', (err) => {
  console.error('❌ Server failed to start:', err);
  process.exit(1);
});
