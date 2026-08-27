import { express, bcrypt } from '../cjsRequire.js';
import db from '../db.js';
import { authenticateToken, requireRoles } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';

const router = express.Router();

// GET /api/v1/users - List users
router.get('/', authenticateToken, async (req, res) => {
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
    const requestorExists = await db('roles').where({ name: 'Requestor' }).first();
    if (!requestorExists) {
      await db('roles').insert({
        name: 'Requestor',
        description: 'Client sample request intake and specification creator',
      }).catch(() => {});
    }
    const roles = await db('roles').select('*');
    return res.json({ success: true, data: roles });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch roles.', error: err.message });
  }
});

// POST /api/v1/users - Create User
router.post('/', authenticateToken, async (req, res) => {
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
router.put('/:id/roles', authenticateToken, async (req, res) => {
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
router.put('/:id/status', authenticateToken, async (req, res) => {
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

// PUT /api/v1/users/:id - Edit Full User Credentials (Username, Email, Password, Name, Roles, Active Status)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, password, firstName, lastName, roleIds, isActive } = req.body;

    const existingUser = await db('users').where({ id }).first();
    if (!existingUser) {
      return res.status(404).json({ success: false, message: 'User account not found.' });
    }

    // Check unique username
    if (username && username !== existingUser.username) {
      const uCheck = await db('users').where({ username }).whereNot({ id }).first();
      if (uCheck) {
        return res.status(400).json({ success: false, message: `Username '${username}' is already taken.` });
      }
    }

    // Check unique email
    if (email && email !== existingUser.email) {
      const eCheck = await db('users').where({ email }).whereNot({ id }).first();
      if (eCheck) {
        return res.status(400).json({ success: false, message: `Email address '${email}' is already in use.` });
      }
    }

    const updateData = {
      username: username ? username.trim() : existingUser.username,
      email: email ? email.trim() : existingUser.email,
      first_name: firstName !== undefined ? firstName.trim() : existingUser.first_name,
      last_name: lastName !== undefined ? lastName.trim() : existingUser.last_name,
      is_active: isActive !== undefined ? Boolean(isActive) : existingUser.is_active,
      updated_at: db.fn.now(),
    };

    if (password && password.trim().length > 0) {
      updateData.password_hash = await bcrypt.hash(password.trim(), 10);
    }

    await db('users').where({ id }).update(updateData);

    if (Array.isArray(roleIds)) {
      await db('user_roles').where({ user_id: id }).del();
      for (const rId of roleIds) {
        await db('user_roles').insert({ user_id: id, role_id: rId });
      }
    }

    await logAudit(req, 'UPDATE_USER_CREDENTIALS', 'User', id, { username: existingUser.username, email: existingUser.email }, { username: updateData.username, email: updateData.email });
    return res.json({ success: true, message: 'User credentials and roles updated successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update user credentials.', error: err.message });
  }
});

// DELETE /api/v1/users/:id - Delete User account
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (String(id) === String(req.user.id)) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account while logged in.' });
    }

    const user = await db('users').where({ id }).first();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    await db.transaction(async (trx) => {
      await trx('user_roles').where({ user_id: id }).del();
      await trx('user_sessions').where({ user_id: id }).del();
      await trx('users').where({ id }).del();

      await logAudit(req, 'DELETE_USER', 'User', id, user, null);
    });

    return res.json({ success: true, message: `User '${user.username}' deleted successfully.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to delete user.', error: err.message });
  }
});

export default router;
