import { jwt } from '../cjsRequire.js';
import db from '../db.js';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'nkb_access_super_secret_key_2026_change_in_production';

/**
 * Express middleware to authenticate JWT access tokens
 */
export async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required. Access token missing.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET);

    // Fetch user and roles from DB
    const user = await db('users').where({ id: decoded.userId, is_active: true }).first();
    if (!user) {
      return res.status(401).json({ success: false, message: 'User account not found or deactivated.' });
    }

    const roles = await db('user_roles')
      .join('roles', 'user_roles.role_id', 'roles.id')
      .where('user_roles.user_id', user.id)
      .select('roles.name');

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      roles: roles.map(r => r.name),
    };

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired access token.', error: err.message });
  }
}

/**
 * Middleware factory to enforce required Role-Based Access Control permissions
 */
export function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.roles) {
      return res.status(403).json({ success: false, message: 'Access denied. User roles missing.' });
    }

    const hasRole = req.user.roles.some(role => allowedRoles.includes(role) || role === 'Super Admin');
    if (!hasRole) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Requires one of the following roles: ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
}

/**
 * Middleware factory to enforce specific RBAC permission (e.g. formula.create)
 */
export function requirePermission(permissionName) {
  return async (req, res, next) => {
    if (!req.user || !req.user.roles) {
      return res.status(403).json({ success: false, message: 'You do not have permission to create formulas' });
    }

    // Super Admin has all permissions
    if (req.user.roles.includes('Super Admin')) {
      return next();
    }

    // Formulator role has default formula.create & formula.edit permissions
    if ((permissionName === 'formula.create' || permissionName === 'formula.edit') && req.user.roles.includes('Formulator')) {
      return next();
    }

    try {
      const permissionRecord = await db('user_roles')
        .join('role_permissions', 'user_roles.role_id', 'role_permissions.role_id')
        .join('permissions', 'role_permissions.permission_id', 'permissions.id')
        .where('user_roles.user_id', req.user.id)
        .where('permissions.name', permissionName)
        .first();

      if (permissionRecord) {
        return next();
      }
    } catch (err) {
      // If permission tables are not queried, check standard role mappings
    }

    return res.status(403).json({
      success: false,
      message: 'You do not have permission to create formulas',
    });
  };
}

