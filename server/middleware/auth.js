import { jwt } from '../cjsRequire.js';
import db from '../db.js';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'nkb_access_super_secret_key_2026_change_in_production';

/**
 * Role equivalency map to ensure seamless backward compatibility between legacy and enterprise roles
 */
const ROLE_ALIASES = {
  'Formulator': ['Formulation Chemist'],
  'Formulation Chemist': ['Formulator'],
  'Reviewer': ['Formulation Chemist', 'Production Supervisor'],
  'Approver': ['Formulation Chemist', 'Production Supervisor', 'QC Specialist'],
  'Viewer': ['Compounding Operator', 'QC Specialist'],
};

/**
 * Express middleware to authenticate JWT access tokens
 */
export async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];

  if (!token && req.cookies) {
    token = req.cookies.nkb_access_token;
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required. Access token missing.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET);

    const user = await db('users').where({ id: decoded.userId, is_active: true }).first();
    if (!user) {
      return res.status(401).json({ success: false, message: 'User account not found or deactivated.' });
    }

    const roles = await db('user_roles')
      .join('roles', 'user_roles.role_id', 'roles.id')
      .where('user_roles.user_id', user.id)
      .select('roles.name');

    const roleNames = roles.map(r => r.name);

    // Fetch user permissions
    let permissions = [];
    if (roleNames.includes('Super Admin')) {
      const allP = await db('permissions').select('key');
      permissions = allP.map(p => p.key);
    } else {
      const pRecs = await db('user_roles')
        .join('role_permissions', 'user_roles.role_id', 'role_permissions.role_id')
        .join('permissions', 'role_permissions.permission_id', 'permissions.id')
        .where('user_roles.user_id', user.id)
        .select('permissions.key');

      permissions = Array.from(new Set(pRecs.map(p => p.key)));
    }

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      roles: roleNames,
      role: roleNames[0] || 'Compounding Operator',
      permissions,
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

    if (req.user.roles.includes('Super Admin')) {
      return next();
    }

    const userRoles = req.user.roles;
    const expandedUserRoles = [...userRoles];
    userRoles.forEach(r => {
      if (ROLE_ALIASES[r]) {
        expandedUserRoles.push(...ROLE_ALIASES[r]);
      }
    });

    const hasRole = expandedUserRoles.some(role => allowedRoles.includes(role));
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
export function requirePermission(permissionKey) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (req.user.roles?.includes('Super Admin')) {
      return next();
    }

    if (req.user.permissions && req.user.permissions.includes(permissionKey)) {
      return next();
    }

    try {
      const permissionRecord = await db('user_roles')
        .join('role_permissions', 'user_roles.role_id', 'role_permissions.role_id')
        .join('permissions', 'role_permissions.permission_id', 'permissions.id')
        .where('user_roles.user_id', req.user.id)
        .where(b => {
          b.where('permissions.key', permissionKey).orWhere('permissions.name', permissionKey);
        })
        .first();

      if (permissionRecord) {
        return next();
      }
    } catch (err) {}

    return res.status(403).json({
      success: false,
      message: `Access denied. Missing permission: ${permissionKey}`,
    });
  };
}
