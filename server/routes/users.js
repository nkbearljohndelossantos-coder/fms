import { express, bcrypt } from '../cjsRequire.js';
import db from '../db.js';
import { authenticateToken, requireRoles } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';

const router = express.Router();

// GET /api/v1/users - List users
router.get('/', authenticateToken, requireRoles('Super Admin'), async (req, res) => {
  try {
    const users = await db('users')
      .select('id', 'username', 'email', 'first_name', 'last_name', 'is_active', 'created_at')
      .orderBy('id', 'asc');

    for (const u of users) {
      const roles = await db('user_roles')
        .join('roles', 'user_roles.role_id', 'roles.id')
        .where('user_roles.user_id', u.id)
        .select('roles.id', 'roles.name');
      u.roles = roles;
    }

    return res.json({ success: true, data: users });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch users.', error: err.message });
  }
});

// GET /api/v1/users/roles - List all roles
router.get('/roles', authenticateToken, async (req, res) => {
  try {
    const roles = await db('roles').select('*');
    return res.json({ success: true, data: roles });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch roles.', error: err.message });
  }
});

// POST /api/v1/users - Create User
router.post('/', authenticateToken, requireRoles('Super Admin'), async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, roleIds } = req.body;
    if (!username || !email || !password || !firstName || !lastName) {
      return res.status(400).json({ success: false, message: 'Required fields missing.' });
    }

    const existing = await db('users').where({ username }).orWhere({ email }).first();
    if (existing) {
      return res.status(400).json({ success: false, message: 'Username or Email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [userId] = await db('users').insert({
      username,
      email,
      password_hash: passwordHash,
      first_name: firstName,
      last_name: lastName,
      is_active: true,
    }).then(res => [res[0]]);

    if (Array.isArray(roleIds) && roleIds.length > 0) {
      for (const rId of roleIds) {
        await db('user_roles').insert({ user_id: userId, role_id: rId });
      }
    }

    await logAudit(req, 'CREATE_USER', 'User', userId, null, { username, email });
    return res.status(201).json({ success: true, message: 'User created successfully', userId });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to create user.', error: err.message });
  }
});

// PUT /api/v1/users/:id/roles - Update user role assignments
router.put('/:id/roles', authenticateToken, requireRoles('Super Admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { roleIds } = req.body;

    await db('user_roles').where({ user_id: id }).del();
    if (Array.isArray(roleIds)) {
      for (const rId of roleIds) {
        await db('user_roles').insert({ user_id: id, role_id: rId });
      }
    }

    await logAudit(req, 'UPDATE_USER_ROLES', 'User', id, null, { roleIds });
    return res.json({ success: true, message: 'User roles updated.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update user roles.', error: err.message });
  }
});

// PUT /api/v1/users/:id/status - Toggle active/inactive
router.put('/:id/status', authenticateToken, requireRoles('Super Admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const user = await db('users').where({ id }).first();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    await db('users').where({ id }).update({
      is_active: Boolean(isActive),
      archived_at: isActive ? null : db.fn.now(),
      archived_by: isActive ? null : req.user.id,
    });

    await logAudit(req, 'TOGGLE_USER_STATUS', 'User', id, { is_active: user.is_active }, { is_active: isActive });
    return res.json({ success: true, message: `User status changed to ${isActive ? 'Active' : 'Inactive'}.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update user status.', error: err.message });
  }
});

export default router;
