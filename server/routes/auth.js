import { express, bcrypt, jwt } from '../cjsRequire.js';
import crypto from 'crypto';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';

const router = express.Router();

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'nkb_access_super_secret_key_2026_change_in_production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'nkb_refresh_super_secret_key_2026_change_in_production';
const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

/**
 * Generate Access and Refresh Token Pair with Hashed Refresh Token Storage
 */
async function generateTokenPair(user, req) {
  const payload = { userId: user.id, username: user.username, email: user.email };
  const accessToken = jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES_IN });

  const rawRefreshToken = crypto.randomBytes(40).toString('hex');
  const refreshTokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'];

  await db('refresh_tokens').insert({
    user_id: user.id,
    token_hash: refreshTokenHash,
    expires_at: expiresAt,
    ip_address: ipAddress,
    user_agent: userAgent,
  });

  return { accessToken, refreshToken: rawRefreshToken };
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

    const roles = await db('user_roles')
      .join('roles', 'user_roles.role_id', 'roles.id')
      .where('user_roles.user_id', user.id)
      .select('roles.name');

    const roleNames = roles.map(r => r.name);
    const tokens = await generateTokenPair(user, req);

    await logAudit(req, 'LOGIN', 'User', user.id, null, { username: user.username });

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
        roles: roleNames,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Login failed server error.', error: err.message });
  }
});

// POST /api/v1/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token required.' });
    }

    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const existingToken = await db('refresh_tokens').where({ token_hash: hash }).first();

    if (!existingToken || existingToken.revoked_at || new Date(existingToken.expires_at) < new Date()) {
      return res.status(401).json({ success: false, message: 'Invalid, revoked, or expired refresh token.' });
    }

    // Revoke used token for rotation
    await db('refresh_tokens').where({ id: existingToken.id }).update({ revoked_at: db.fn.now() });

    const user = await db('users').where({ id: existingToken.user_id, is_active: true }).first();
    if (!user) {
      return res.status(401).json({ success: false, message: 'User account inactive or not found.' });
    }

    const newTokens = await generateTokenPair(user, req);

    return res.json({
      success: true,
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Token refresh failed.', error: err.message });
  }
});

// POST /api/v1/auth/logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await db('refresh_tokens').where({ token_hash: hash }).update({ revoked_at: db.fn.now() });
    }

    await logAudit(req, 'LOGOUT', 'User', req.user.id);
    return res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Logout failed.', error: err.message });
  }
});

// GET /api/v1/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  return res.json({ success: true, user: req.user });
});

export default router;
