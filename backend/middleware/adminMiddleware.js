const authService = require('../authService');
const ipRangeCheck = require('ip-range-check');

const ADMIN_IP_RANGES = (process.env.ADMIN_IP_RANGES || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const REQUIRE_ADMIN_2FA = process.env.REQUIRE_ADMIN_2FA === 'true';

const requireAdmin = async (req, res, next) => {
  try {
    const authResult = await new Promise((resolve) => {
      authService.authenticateToken(req, res, () => resolve({ success: true }));
    });

    if (!authResult.success) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!req.user || req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (req.user.isActive === false) {
      return res.status(403).json({ error: 'Account suspended' });
    }

    if (ADMIN_IP_RANGES.length > 0) {
      const clientIp = req.ip || req.connection.remoteAddress;
      const isAllowed = ipRangeCheck(clientIp, ADMIN_IP_RANGES);
      
      if (!isAllowed) {
        console.warn(`Admin access denied from IP: ${clientIp} for user: ${req.user.username}`);
        return res.status(403).json({ error: 'Admin access not allowed from this IP' });
      }
    }

    if (REQUIRE_ADMIN_2FA) {
      const otpHeader = req.headers['x-admin-otp'];
      if (!otpHeader) {
        return res.status(403).json({ error: '2FA required', requiresOTP: true });
      }
      
    }

    req.admin = {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    };

    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
};

const requirePermission = (permission) => {
  return async (req, res, next) => {
    if (!req.admin) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    next();
  };
};

module.exports = {
  requireAdmin,
  requirePermission
};
