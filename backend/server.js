
const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
require('dotenv').config();

const databaseService = require('./services/databaseService');
const provablyFairService = require('./services/provablyFairService');
const QuestService = require('./services/questService');
const authService = require('./authService');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { AppError, asyncHandler, errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();
const server = http.createServer(app);

app.set('trust proxy', 1);

if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path} from ${req.ip}`);
    next();
  });
}

const isProduction = process.env.NODE_ENV === 'production';
app.use(helmet({
  contentSecurityPolicy: isProduction ? {
    useDefaults: true,
    directives: {
      defaultSrc: ["'none'"],
      connectSrc: [
        "'self'", 
        "wss://aviator-game-production.up.railway.app", 
        "https://aviator-game-production.up.railway.app",
        "https://aviator-game-topaz.vercel.app"
      ],
      frameAncestors: ["'self'", "https://*.telegram.org"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
    }
  } : false,
  crossOriginEmbedderPolicy: false
}));

const parseOrigins = (val) => (val || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const TELEGRAM_ORIGINS = [
  'https://t.me',
  'https://web.telegram.org',
  'https://web.telegram.org/a',
  'https://miniapp-assets.telegram.org',
  'https://telegram.org'
];

const allowedOrigins = isProduction
  ? [
      ...parseOrigins(process.env.CORS_ORIGINS),
      ...TELEGRAM_ORIGINS
    ]
  : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:3001'];

const corsMiddleware = cors({
  origin: (origin, callback) => {
    try {
      if (!origin) return callback(null, true);
      
      if (!isProduction) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        console.log(`CORS allowing origin: ${origin}`);
        return callback(null, true);
      }
      
      console.log(`CORS blocked origin: ${origin}`);
      console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
      return callback(new Error('CORS not allowed for this origin'));
    } catch (error) {
      console.error('CORS middleware error:', error);
      return callback(error);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Sec-WebSocket-Protocol',
    'X-Device-Id',
    'X-Telegram-Init-Data',
    'Accept',
    'Accept-Language',
    'User-Agent'
  ],
  preflightContinue: false,
  optionsSuccessStatus: 204
});

app.use(corsMiddleware);

app.options('*', corsMiddleware);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  skip: (req) => req.method === 'OPTIONS',
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: req.rateLimit.resetTime
    });
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many authentication attempts, please try again later.',
  skip: (req) => req.method === 'OPTIONS',
  validate: false,
});

const settingsReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
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
  windowMs: 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  validate: false,
  keyGenerator: (req) => {
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

const profileReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  skip: (req) => req.method === 'OPTIONS',
  validate: false,
  keyGenerator: (req) => {
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

app.use('/api/auth/telegram', authLimiter);
app.use('/api/auth/refresh', authLimiter);
app.use('/api/admin/login', authLimiter);
app.use('/api/admin/register', authLimiter);

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

let gameState = {
  state: 'betting',
  multiplier: 1.00,
  countdown: 5,
  crashPoint: 0,
  startTime: 0,
  players: new Map(),
  activeBets: new Map(),
  crashHistory: [2.45, 1.89, 5.67, 1.23, 8.91, 3.45, 2.17, 12.34]
};

app.post('/api/auth/telegram', [
  body('telegramUser').isObject(),
  body('telegramUser.id').isNumeric(),
  body('telegramUser.first_name').notEmpty().trim().escape(),
  body('startParam').optional().isString().trim()
], async (req, res) => {
  try {
    console.log('Telegram auth request:', JSON.stringify(req.body, null, 2));
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ error: 'Invalid Telegram data', details: errors.array() });
    }

    const { telegramUser, startParam } = req.body;
    
    let user = await databaseService.findUserByTelegramId(telegramUser.id);
    
    if (!user) {
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
      const updates = { lastLoginAt: new Date() };
      if (!user.avatar && telegramUser.photo_url) updates.avatar = telegramUser.photo_url;
      if (!user.firstName && telegramUser.first_name) updates.firstName = telegramUser.first_name;
      if (!user.lastName && telegramUser.last_name) updates.lastName = telegramUser.last_name;
      if (!user.username && telegramUser.username) updates.username = telegramUser.username;
      if (Object.keys(updates).length > 0) {
        const r = await databaseService.updateUser(user.id, updates);
        if (r.success) {
          user = r.user;
        }
      }
    }

    const tokenResult = authService.generateToken(user);
    const refreshTokenResult = authService.generateRefreshToken(user);

    if (!tokenResult.success || !refreshTokenResult.success) {
      return res.status(500).json({ error: 'Failed to generate tokens' });
    }

    let referralMessage = null;
    if (startParam && typeof startParam === 'string') {
      const [maybeRef, maybeV] = startParam.split('__v_');
      
      if (maybeRef && maybeRef.startsWith('ref_')) {
        const refCode = maybeRef.substring(4);
        try {
          const referralResult = await databaseService.attributeReferral({
            inviteeUserId: user.id,
            referralCode: refCode,
            ip: req.ip,
            deviceId: req.headers['x-device-id'] || null
          });
          
          if (referralResult.success && referralResult.inviteeBonusPaid) {
            user = await databaseService.findUserById(user.id);
            referralMessage = `Welcome! You've been referred by ${referralResult.referrerUsername} and received 1,000 points!`;
            
            if (referralResult.referrerUserId) {
              QuestService.trackReferral(referralResult.referrerUserId).catch(error => {
                console.error('Quest tracking error (referral):', error);
              });
            }
          }
        } catch (e) {
          console.warn('Referral attribution skipped:', e.message);
        }
      }
      
      req.buildTag = maybeV || null;
      if (req.buildTag) {
        console.log(`User authenticated with build version: ${req.buildTag}`);
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
    console.error('Telegram authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

app.post('/api/admin/register', [
  body('username').isLength({ min: 3, max: 20 }).trim().escape(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_ADMIN_REGISTRATION !== 'true') {
    return res.status(403).json({ error: 'Admin registration disabled in production' });
  }
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid input', details: errors.array() });
    }

    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_REGISTRATION_KEY) {
      return res.status(403).json({ error: 'Admin registration not allowed' });
    }

    const { username, email, password } = req.body;
    const result = await databaseService.createUser({ 
      username, 
      email, 
      password,
      role: 'ADMIN'
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

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
    console.error('Admin registration error:', error);
    res.status(500).json({ error: 'Admin registration failed' });
  }
});

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

    if (result.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

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
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

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
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

app.post('/api/auth/logout', authService.authenticateToken.bind(authService), (req, res) => {
  try {
    const result = authService.logout(req.user.id);
    res.json(result);
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

app.get('/api/auth/profile', 
  profileReadLimiter,
  authService.authenticateToken.bind(authService), 
  async (req, res) => {
    try {
      const user = await databaseService.findUserById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json({
        success: true,
        user: user
      });
    } catch (error) {
      console.error('Profile fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch profile' });
    }
  }
);

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

    res.json({
      success: true,
      user: req.user
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Profile update failed' });
  }
});

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
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Password change failed' });
  }
});

const { requireAdmin } = require('./middleware/adminMiddleware');
const adminAudit = require('./services/adminAuditService');

app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const stats = await databaseService.getAdminStats();
    
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
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const users = await databaseService.getAllUsers(parseInt(page), parseInt(limit), search);
    res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

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
    console.error('Admin update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.get('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    const user = await databaseService.findUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
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
    console.error('Admin get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

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
    console.error('Admin adjust balance error:', error);
    res.status(500).json({ error: 'Failed to adjust balance' });
  }
});

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
    console.error('Admin ban user error:', error);
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

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
    console.error('Admin unban user error:', error);
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

app.get('/api/admin/game-rounds', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const rounds = await databaseService.getGameRounds(parseInt(page), parseInt(limit));
    res.json({
      success: true,
      rounds
    });
  } catch (error) {
    console.error('Admin get game rounds error:', error);
    res.status(500).json({ error: 'Failed to get game rounds' });
  }
});

app.get('/api/admin/game-rounds/:id', requireAdmin, async (req, res) => {
  try {
    const round = await databaseService.getGameRoundWithBets(req.params.id);
    if (!round) {
      return res.status(404).json({ error: 'Round not found' });
    }
    res.json({ success: true, round });
  } catch (error) {
    console.error('Admin get round error:', error);
    res.status(500).json({ error: 'Failed to get round' });
  }
});

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
    console.error('Admin get referrals error:', error);
    res.status(500).json({ error: 'Failed to get referrals' });
  }
});

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
    console.error('Admin approve referral error:', error);
    res.status(500).json({ error: 'Failed to approve referral' });
  }
});

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
    console.error('Admin reject referral error:', error);
    res.status(500).json({ error: 'Failed to reject referral' });
  }
});

app.get('/api/admin/users/:id/settings', requireAdmin, async (req, res) => {
  try {
    const settings = await databaseService.getPlayerSettings(req.params.id);
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Admin get player settings error:', error);
    res.status(500).json({ error: 'Failed to get player settings' });
  }
});

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
    console.error('Admin update player settings error:', error);
    res.status(500).json({ error: 'Failed to update player settings' });
  }
});

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
    console.error('Admin get audit logs error:', error);
    res.status(500).json({ error: 'Failed to get audit logs' });
  }
});

app.get('/api/admin/audit-logs/:targetType/:targetId', requireAdmin, async (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    const logs = await adminAudit.getLogsForTarget(targetType, targetId);
    res.json({ success: true, logs });
  } catch (error) {
    console.error('Admin get target audit logs error:', error);
    res.status(500).json({ error: 'Failed to get audit logs' });
  }
});

app.get('/api/auth/debug-token', (req, res) => {
  const token = (req.headers.authorization || '').split(' ')[1] || '';
  const result = authService.verifyToken(token);
  res.json({
    tokenProvided: !!token,
    verification: result,
    activeSessionsCount: authService.getActiveSessionsCount()
  });
});

app.post('/api/referral/track', async (req, res) => {
  try {
    const { ref } = req.body || {};
    if (!ref || typeof ref !== 'string') return res.status(400).json({ success:false, error: 'Invalid ref' });

    const m = ref.match(/^ref_(.+)$/);
    if (!m) return res.status(200).json({ success:true });

    const inviterId = m[1];

    const ua = (req.headers['user-agent'] || '').slice(0,256);
    const ip = req.ip;
    
    console.log(`Referral tracking: inviter=${inviterId}, ip=${ip}, ua=${ua.slice(0,50)}...`);

    return res.json({ success: true });
  } catch (e) {
    console.error('referral/track error:', e);
    res.status(500).json({ success:false, error: 'Failed to track referral' });
  }
});

app.get('/api/fairness/recent-rounds', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const rounds = await databaseService.getRecentRoundsForFairness(parseInt(limit));
    
    res.json({
      success: true,
      rounds
    });
  } catch (error) {
    console.error('Fairness rounds error:', error);
    res.status(500).json({ error: 'Failed to get recent rounds' });
  }
});

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
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

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
      console.error('Referral stats error:', error);
      res.status(500).json({ error: 'Failed to get referral stats' });
    }
  }
);

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
      
      const cycleHours = 6;
      const rewardPoints = 6000;
      
      const hoursElapsed = lastClaimed 
        ? (now - lastClaimed) / (1000 * 60 * 60) 
        : cycleHours;
      
      const canClaim = hoursElapsed >= cycleHours;
      const nextClaimTime = lastClaimed 
        ? new Date(lastClaimed.getTime() + cycleHours * 60 * 60 * 1000)
        : now;

      res.json({
        success: true,
        canClaim,
        lastClaimedAt: lastClaimed,
        nextClaimTime: canClaim ? now : nextClaimTime,
        hoursElapsed: Math.min(hoursElapsed, cycleHours),
        pointsAvailable: canClaim ? rewardPoints : 0,
        cycleHours,
        rewardPoints
      });
    } catch (error) {
      console.error('Farming status error:', error);
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

      const player = gameState.players.get(userId);
      if (player && player.user) {
        player.user.balance = result.newBalance;
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
      console.error('Farming claim error:', error);
      res.status(500).json({ error: 'Failed to claim farming points' });
    }
  }
);

app.get('/api/quests',
  authService.authenticateToken.bind(authService),
  async (req, res) => {
    try {
      const quests = await QuestService.getUserQuests(req.user.id);
      res.json({ success: true, quests });
    } catch (error) {
      console.error('Error fetching quests:', error);
      res.status(500).json({ error: 'Failed to fetch quests' });
    }
  }
);

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
      
      const player = gameState.players.get(req.user.id);
      if (player && player.user) {
        player.user.balance = result.newBalance;
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
      console.error('Error claiming quest:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

app.get('/api/admin/quests/stats', requireAdmin, async (req, res) => {
  try {
    const stats = await QuestService.getQuestStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error fetching quest stats:', error);
    res.status(500).json({ error: 'Failed to fetch quest statistics' });
  }
});

app.get('/api/player/settings', 
  authService.authenticateToken.bind(authService),
  settingsReadLimiter,
  async (req, res) => {
    try {
      const settings = await databaseService.getPlayerSettings(req.user.id);
      res.set('Cache-Control', 'private, max-age=5');
      res.json({ success: true, settings: settings || null });
    } catch (error) {
      console.error('Player settings get error:', error);
      res.status(500).json({ error: 'Failed to get settings' });
    }
  }
);

app.put('/api/player/settings', 
  authService.authenticateToken.bind(authService),
  settingsWriteLimiter,
  async (req, res) => {
    try {
      console.log('PUT /api/player/settings - User:', req.user?.id, 'Body:', req.body);
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

      console.log('Saving settings payload:', payload);
      const updated = await databaseService.upsertPlayerSettings(req.user.id, payload);
      console.log('Settings saved to DB:', updated);
      
      const connectedPlayer = gameState.players.get(req.user.id);
      if (connectedPlayer) {
        connectedPlayer.settings = updated || connectedPlayer.settings;
        console.log('Updated cached settings for connected player:', req.user.username);
      }
      
      res.json({ success: true, settings: updated });
    } catch (error) {
      console.error('Player settings update error:', error);
      console.error('Full error stack:', error.stack);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  }
);

let currentGameRound = null;
let countdownInterval = null;

const BROADCAST_MS = 200;
let lastBroadcastAt = 0;

function startGameLoop() {
  console.log('Game loop started');
  async function startBetting() {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    
    gameState.state = 'betting';
    gameState.multiplier = 1.0;
    gameState.countdown = 5;
    
    const fairRound = provablyFairService.generateFairRound();
    currentGameRound = await databaseService.createGameRound(fairRound);
    gameState.crashPoint = fairRound.crashPoint;
    gameState.currentRoundHash = fairRound.serverSeedHash;
    gameState.currentRoundSeed = fairRound.serverSeed;
    gameState.activeBets.clear();
    console.log(`Betting phase. Crash at ${gameState.crashPoint.toFixed(2)}x`);
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
    
    if (currentGameRound) {
      try {
        await databaseService.updateGameRoundStatus(currentGameRound.id, 'RUNNING');
      } catch (error) {
        console.error('Error updating game round to running:', error);
      }
    }
    
    console.log("Plane taking off");
    broadcastAll(true);
    
    const TICK_MS = 50;
    
    const tick = async () => {
      const now = Date.now();
      gameState.multiplier = 1 + (now - gameState.startTime) / 3000;
      
      if (now - lastBroadcastAt >= BROADCAST_MS) {
        lastBroadcastAt = now;
        broadcastAll();
      }
      
      for (const [uid, bet] of gameState.activeBets.entries()) {
        if (bet.cashedOut) continue;
        if (bet.autoTarget && gameState.multiplier >= bet.autoTarget) {
          console.log(`Server auto-cashout triggered for ${uid} at ${gameState.multiplier.toFixed(2)}x (target: ${bet.autoTarget}x)`);
          await handleCashOut(uid, true);
        }
      }
      
      if (gameState.multiplier >= gameState.crashPoint) {
        broadcastAll(true);
        return crash();
      }
      setTimeout(tick, TICK_MS);
    };
    setTimeout(tick, TICK_MS);
  }
  async function crash() {
    const crashAt = Date.now();
    const GRACE_MS = 100;
    
    console.log('Checking grace window cashouts...');
    for (const [uid, bet] of gameState.activeBets.entries()) {
      if (!bet?.cashedOut && bet?.lastCashoutReqAt && (crashAt - bet.lastCashoutReqAt) <= GRACE_MS) {
        console.log(`Grace window cashout for ${uid}: received ${crashAt - bet.lastCashoutReqAt}ms before crash`);
        await handleCashOut(uid, false);
      }
    }
    
    gameState.state = 'crashed';
    gameState.multiplier = gameState.crashPoint;
    
    if (currentGameRound) {
      try {
        await databaseService.crashBets(currentGameRound.id, gameState.crashPoint);
        
        for (const [uid, bet] of gameState.activeBets.entries()) {
          if (!bet.cashedOut) {
            const player = gameState.players.get(uid);
            if (player && !player.isGuest && player.user?.id) {
              QuestService.trackBetLoss(player.user.id).catch(error => {
                console.error('Quest tracking error (bet loss):', error);
              });
            }
          }
        }
        
        await databaseService.updateGameRoundStatus(currentGameRound.id, 'CRASHED', new Date());
      } catch (error) {
        console.error('Error handling game round completion:', error);
      }
    }
    
    gameState.crashHistory.unshift(gameState.crashPoint);
    if (gameState.crashHistory.length > 10) {
      gameState.crashHistory.pop();
    }
    
    console.log(`Crashed at ${gameState.crashPoint.toFixed(2)}x`);
    broadcastAll();
    setTimeout(startBetting, 3000);
  }
  startBetting();
}

const wss = new WebSocket.Server({ 
  noServer: true,
  handleProtocols: (protocols, request) => {
    if (!protocols || protocols.size === 0) return false;

    if (protocols.has('access_token')) {
      return 'access_token';
    }

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
      serverTime: Date.now(),
    }
  };
  const commonFrame = JSON.stringify(frame);

  for (const [userId, p] of gameState.players.entries()) {
    if (p.ws.readyState !== WebSocket.OPEN) continue;

    if (!force && p.ws.bufferedAmount > 128 * 1024) {
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
  ws.isAlive = true;
  ws.on('pong', heartbeat);

  ws._msgWindowStart = Date.now();
  ws._msgCount = 0;

  let userId = null;
  let user = null;
  let isGuest = true;

  const url = new URL(req.url, `http://${req.headers.host}`);
  let token = url.searchParams.get('token') || req.headers.authorization?.split(' ')[1];
  
  if (!token && req.headers['sec-websocket-protocol']) {
    const prot = req.headers['sec-websocket-protocol'].split(',').map(s => s.trim());
    const bearer = prot.find(p => p.startsWith('bearer.'));
    if (bearer) token = bearer.substring('bearer.'.length);
  }

  if (!token) {
    console.log('WS connected without token -> guest session');
  }

  if (token) {
    const verification = authService.verifyToken(token);
    if (!verification.success) {
      console.log('JWT verification failed:', verification.error || verification);
    } else {
      const d = verification.decoded;
      const claimedId = d.sub || d.userId || d.id;
      let u = null;

      try {
        if (claimedId) u = await databaseService.findUserById(String(claimedId));
      } catch (e) {
        console.log('findUserById error:', e?.message);
      }

      if (!u && d.telegramId && databaseService.findUserByTelegramId) {
        try {
          u = await databaseService.findUserByTelegramId(d.telegramId);
          if (u) console.log('Found user via telegramId fallback');
        } catch (_) {}
      }

      if (u && u.isActive) {
        user = u;
        userId = String(u.id);
        isGuest = false;
        console.log(`WS authenticated as ${u.username} (${userId})`);
      } else if (!u) {
        console.log(`JWT OK but user not found (claimedId: ${claimedId}) - continuing as guest`);
        try {
          ws.send(JSON.stringify({ type: 'auth_error', data: { reason: 'STALE_TOKEN' } }));
        } catch(_) {}
      } else if (!u.isActive) {
        console.log('User inactive - continuing as guest');
      }
    }
  }

  if (isGuest) {
    userId = 'guest_' + Math.random().toString(36).substring(7);
    console.log(`Guest player connected: ${userId}`);
  }

  let playerSettings = null;
  if (!isGuest && user?.id) {
    try {
      playerSettings = await databaseService.getPlayerSettings(user.id) || {};
      console.log('Cached settings for user', user.username, ':', playerSettings);
    } catch (error) {
      console.error('Failed to load player settings:', error);
      playerSettings = {};
    }
  }

  gameState.players.set(userId, { 
    ws, 
    user: user,
    isGuest: isGuest,
    guestBalance: isGuest ? 10000 : 0,
    settings: playerSettings || {}
  });
  
  ws.userId = userId;
  ws.isGuest = isGuest;
  
  if (!isGuest && user?.id) {
    QuestService.trackLogin(user.id).catch(error => {
      console.error('Quest tracking error (login):', error);
    });
  }

  console.log(`Sending initial crash history:`, gameState.crashHistory);
  
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
      const now = Date.now();
      if (now - ws._msgWindowStart >= 1000) {
        ws._msgWindowStart = now;
        ws._msgCount = 0;
      }
      ws._msgCount += 1;
      if (ws._msgCount > 10) {
        console.warn(`Rate limit exceeded for user ${ws.userId}`);
        if (ws._msgCount === 11) {
          ws.send(JSON.stringify({
            type: 'warning',
            data: { message: 'Rate limit exceeded. Please slow down your requests.' }
          }));
        }
        return;
      }

      const data = JSON.parse(msg);
      if (!data || typeof data !== 'object' || typeof data.type !== 'string') {
        return;
      }

      if (data.type === 'bet') {
        const amount = Number(data.amount);
        if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
          return;
        }
      }

      const id = ws.userId;
      if (!id) return;
      if (data.type === 'bet') handleBet(id, data.amount);
      if (data.type === 'cashOut') {
        const bet = gameState.activeBets.get(id);
        if (bet && !bet.cashedOut) {
          bet.lastCashoutReqAt = Date.now();
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
      console.log(`Guest player ${userId} disconnected. Total players: ${gameState.players.size}`);
    } else {
      console.log(`User ${user.username} disconnected. Total players: ${gameState.players.size}`);
    }
  });
});

const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log(`Terminating dead connection for user: ${ws.userId}`);
      return ws.terminate();
    }
    if (ws.readyState === WebSocket.OPEN) {
      ws.isAlive = false;
      ws.ping();
    }
  });
}, 15000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

server.on('upgrade', (req, socket, head) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);
  console.log(`WebSocket upgrade request for: ${req.url}`);

  if (pathname !== '/ws') {
    console.log(`Rejecting upgrade for non-WebSocket path: ${req.url}`);
    socket.destroy();
    return;
  }

  console.log(`Upgrading connection to WebSocket on /ws`);
  
  const requestedProtocols = req.headers['sec-websocket-protocol'];
  let acceptedProtocol = null;
  
  if (requestedProtocols) {
    const protocols = requestedProtocols.split(',').map(p => p.trim());
    
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

async function handleBet(userId, amount) {
  const player = gameState.players.get(userId);
  if (!player || gameState.state !== 'betting') return;

  const currentBalance = player.isGuest ? player.guestBalance : player.user.balance;
  
  if (amount > currentBalance) return;

  let betId = null;
  
  if (player.isGuest) {
    player.guestBalance -= amount;
  } else {
    if (currentGameRound) {
      try {
        const bet = await databaseService.placeBet(userId, currentGameRound.id, amount);
        betId = bet.id;
        player.user.balance = parseFloat(player.user.balance) - amount;
      } catch (error) {
        console.error('Failed to place bet:', error);
        player.ws.send(JSON.stringify({ 
          type: 'error', 
          data: { message: error.message || 'Failed to place bet' } 
        }));
        return;
      }
    }
  }

  const autoTarget = (player?.settings?.autoCashoutEnabled && Number(player?.settings?.autoCashoutMultiplier) > 1)
    ? Number(player.settings.autoCashoutMultiplier)
    : null;

  gameState.activeBets.set(userId, {
    amount,
    cashedOut: false,
    cashedOutMultiplier: 0,
    betId,
    autoTarget,
    lastCashoutReqAt: null
  });

  const newBalance = player.isGuest ? player.guestBalance : player.user.balance;
  player.ws.send(JSON.stringify({ 
    type: 'betPlaced', 
    data: { amount, balance: newBalance } 
  }));
  
  if (!player.isGuest && player.user?.id) {
    QuestService.trackBetPlaced(player.user.id, amount).catch(error => {
      console.error('Quest tracking error (bet placed):', error);
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
  
  if (player.isGuest) {
    player.guestBalance += winnings;
  } else {
    if (bet.betId) {
      try {
        await databaseService.cashoutBet(bet.betId, gameState.multiplier);
        player.user.balance = parseFloat(player.user.balance) + winnings;
      } catch (error) {
        console.error('Failed to cashout bet:', error);
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
      isAutomatic
    } 
  }));
  
  if (!player.isGuest && player.user?.id) {
    QuestService.trackCashout(player.user.id, bet.cashedOutMultiplier).catch(error => {
      console.error('Quest tracking error (cashout):', error);
    });
  }
}

app.get('/api/health', (_, res) => {
  res.json({ 
    status: 'OK', 
    players: gameState.players.size,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});
app.get('/api/game-state', (_,res)=>res.json({ state:gameState.state, multiplier:gameState.multiplier, countdown:gameState.countdown, players:gameState.players.size }));

app.use(notFound);
app.use(errorHandler);

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

const PORT = process.env.PORT || 3002;

console.log('Starting server with configuration:');
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

app.post('/api/admin/setup-password', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
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
    
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await databaseService.prisma.user.update({
      where: { id: user.id },
      data: { 
        password: hashedPassword,
        role: 'ADMIN'
      }
    });
    
    console.log(`Password set for admin user: ${user.username}`);
    
    res.json({
      success: true,
      message: `Password set successfully for ${user.username}`,
      role: 'ADMIN'
    });
    
  } catch (error) {
    console.error('Error setting admin password:', error);
    res.status(500).json({ error: 'Failed to set password' });
  }
});

app.post('/api/admin/fix-referral-codes', requireAdmin, async (req, res) => {
  try {
    console.log('Admin triggered referral codes fix via API...');
    
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
    
    console.log(`Found ${usersWithoutCodes.length} users without referral codes`);
    
    let fixedCount = 0;
    for (const user of usersWithoutCodes) {
      try {
        const referralCode = Math.random().toString(36).substring(2, 10).toUpperCase();
        
        await databaseService.prisma.user.update({
          where: { id: user.id },
          data: { referralCode }
        });
        
        console.log(`Fixed referral code for user ${user.username}: ${referralCode}`);
        fixedCount++;
      } catch (error) {
        console.error(`Failed to fix referral code for user ${user.username}:`, error);
      }
    }
    
    console.log(`Successfully fixed ${fixedCount} referral codes`);
    
    res.json({
      success: true,
      message: `Fixed ${fixedCount} referral codes`,
      usersFixed: fixedCount,
      totalUsersFound: usersWithoutCodes.length
    });
    
  } catch (error) {
    console.error('Error in fix-referral-codes endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fix referral codes',
      details: error.message
    });
  }
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`CORS origins: ${allowedOrigins.join(', ') || 'development mode (all origins)'}`);
  console.log(`Telegram origins supported: ${TELEGRAM_ORIGINS.join(', ')}`);
  console.log('Server started successfully');
  startGameLoop();
}).on('error', (err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
