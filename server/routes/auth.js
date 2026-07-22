import { express, bcrypt, jwt } from '../cjsRequire.js';
import crypto from 'crypto';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { SignatureService } from '../services/SignatureService.js';
import { AuditService } from '../services/AuditService.js';

const router = express.Router();

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'nkb_access_super_secret_key_2026_change_in_production';
const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';

async function getUserPermissions(userId, roleNames) {
  if (roleNames.includes('Super Admin')) {
    const all = await db('permissions').select('key');
    return all.map(p => p.key);
  }

  const records = await db('user_roles')
    .join('role_permissions', 'user_roles.role_id', 'role_permissions.role_id')
    .join('permissions', 'role_permissions.permission_id', 'permissions.id')
    .where('user_roles.user_id', userId)
    .select('permissions.key');

  return Array.from(new Set(records.map(p => p.key)));
}

async function generateTokenPair(user, req) {
  const roles = await db('user_roles')
    .join('roles', 'user_roles.role_id', 'roles.id')
    .where('user_roles.user_id', user.id)
    .select('roles.name');

  const roleNames = roles.map(r => r.name);
  const permissions = await getUserPermissions(user.id, roleNames);

  const payload = {
    userId: user.id,
    username: user.username,
    email: user.email,
    roles: roleNames,
    primaryRole: roleNames[0] || 'Compounding Operator',
    permissions,
  };

  const accessToken = jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES_IN });

  const rawRefreshToken = crypto.randomBytes(40).toString('hex');
  const refreshTokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress;
  const userAgent = req.headers['user-agent'];

  await db('user_sessions').insert({
    user_id: user.id,
    refresh_token_hash: refreshTokenHash,
    device_info: userAgent ? String(userAgent).substring(0, 255) : 'Standard Browser',
    ip_address: ipAddress ? String(ipAddress).substring(0, 45) : '127.0.0.1',
    is_revoked: false,
    expires_at: expiresAt,
  });

  return { accessToken, refreshToken: rawRefreshToken, userPayload: payload };
}

// POST /api/v1/auth/login
router.post('/login', async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;
    if (!usernameOrEmail || !password) {
      return res.status(400).json({ success: false, message: 'Username/Email and Password are required.' });
    }

    const user = await db('users')
      .where(builder => {
        builder.where({ username: usernameOrEmail }).orWhere({ email: usernameOrEmail });
      })
      .andWhere({ is_active: true })
      .first();

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials or inactive account.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const tokens = await generateTokenPair(user, req);

    res.cookie('nkb_refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    await db.transaction(async (trx) => {
      await AuditService.logEvent({
        trx,
        userId: user.id,
        userRole: tokens.userPayload.primaryRole,
        action: 'USER_LOGIN',
        entityType: 'User',
        entityId: user.id,
        newValues: { username: user.username, ip: req.ip },
      });
    });

    return res.json({
      success: true,
      message: 'Login successful',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: tokens.userPayload.primaryRole,
        roles: tokens.userPayload.roles,
        permissions: tokens.userPayload.permissions,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Login failed server error.', error: err.message });
  }
});

// POST /api/v1/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies?.nkb_refresh_token || req.body?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'Refresh token required.' });
    }

    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const session = await db('user_sessions').where({ refresh_token_hash: hash }).first();

    if (!session || session.is_revoked || new Date(session.expires_at) < new Date()) {
      return res.status(401).json({ success: false, message: 'Invalid, revoked, or expired refresh session.' });
    }

    await db('user_sessions').where({ id: session.id }).update({ is_revoked: true });

    const user = await db('users').where({ id: session.user_id, is_active: true }).first();
    if (!user) {
      return res.status(401).json({ success: false, message: 'User account inactive or not found.' });
    }

    const newTokens = await generateTokenPair(user, req);

    res.cookie('nkb_refresh_token', newTokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      success: true,
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: newTokens.userPayload.primaryRole,
        roles: newTokens.userPayload.roles,
        permissions: newTokens.userPayload.permissions,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Token refresh failed.', error: err.message });
  }
});

// POST /api/v1/auth/logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const refreshToken = req.cookies?.nkb_refresh_token || req.body?.refreshToken;
    if (refreshToken) {
      const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await db('user_sessions').where({ refresh_token_hash: hash }).update({ is_revoked: true });
    }

    res.clearCookie('nkb_refresh_token');

    await db.transaction(async (trx) => {
      await AuditService.logEvent({
        trx,
        userId: req.user.id,
        userRole: req.user.roles[0] || 'User',
        action: 'USER_LOGOUT',
        entityType: 'User',
        entityId: req.user.id,
      });
    });

    return res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Logout failed.', error: err.message });
  }
});

// POST /api/v1/signatures/challenge (Step 1 Electronic Signature)
router.post('/signatures/challenge', authenticateToken, async (req, res) => {
  try {
    const { passwordOrPin, action, entityType, entityId, reason } = req.body;
    if (!passwordOrPin || !action || !entityType || !entityId) {
      return res.status(400).json({
        success: false,
        message: 'passwordOrPin, action, entityType, and entityId are required for electronic signature challenge.',
      });
    }

    const challenge = await SignatureService.createChallengeToken({
      userId: req.user.id,
      passwordOrPin,
      action,
      entityType,
      entityId,
      reason,
    });

    return res.json({
      success: true,
      message: 'Electronic signature challenge authorized',
      signatureToken: challenge.signatureToken,
      expiresAt: challenge.expiresAt,
    });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  return res.json({ success: true, user: req.user });
});

export default router;
