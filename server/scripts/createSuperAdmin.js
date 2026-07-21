import bcrypt from 'bcryptjs';
import db from '../db.js';

async function createSuperAdmin() {
  const email = process.env.DEFAULT_ADMIN_EMAIL || 'admin@nkb.com';
  const password = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@123456';
  const username = 'admin';

  try {
    const existing = await db('users').where({ email }).first();
    if (existing) {
      console.log(`ℹ️ Admin user with email '${email}' already exists.`);
      process.exit(0);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [userId] = await db('users').insert({
      username,
      email,
      password_hash: passwordHash,
      first_name: 'Super',
      last_name: 'Admin',
      is_active: true,
    }).then(res => [res[0]]);

    let adminRole = await db('roles').where({ name: 'Super Admin' }).first();
    if (!adminRole) {
      const [roleId] = await db('roles').insert({ name: 'Super Admin', description: 'Full system control' }).then(res => [res[0]]);
      adminRole = { id: roleId };
    }

    await db('user_roles').insert({ user_id: userId, role_id: adminRole.id });

    console.log(`✅ Super Admin created successfully!`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to create Super Admin:', err);
    process.exit(1);
  }
}

createSuperAdmin();
