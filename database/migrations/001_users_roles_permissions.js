/**
 * Migration 001: Users, Roles, Permissions, User-Roles, Role-Permissions
 */
export async function up(knex) {
  await knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.string('username', 50).notNullable().unique();
    table.string('email', 100).notNullable().unique();
    table.string('password_hash', 255).notNullable();
    table.string('first_name', 50).notNullable();
    table.string('last_name', 50).notNullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('archived_at').nullable();
    table.integer('archived_by').nullable();
    table.timestamps(true, true);
  });

  await knex.schema.createTable('roles', (table) => {
    table.increments('id').primary();
    table.string('name', 50).notNullable().unique();
    table.string('description', 255).nullable();
    table.timestamps(true, true);
  });

  await knex.schema.createTable('permissions', (table) => {
    table.increments('id').primary();
    table.string('name', 100).notNullable();
    table.string('key', 100).notNullable().unique();
    table.string('description', 255).nullable();
    table.timestamps(true, true);
  });

  await knex.schema.createTable('user_roles', (table) => {
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('role_id').unsigned().notNullable().references('id').inTable('roles').onDelete('CASCADE');
    table.primary(['user_id', 'role_id']);
  });

  await knex.schema.createTable('role_permissions', (table) => {
    table.integer('role_id').unsigned().notNullable().references('id').inTable('roles').onDelete('CASCADE');
    table.integer('permission_id').unsigned().notNullable().references('id').inTable('permissions').onDelete('CASCADE');
    table.primary(['role_id', 'permission_id']);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('role_permissions');
  await knex.schema.dropTableIfExists('user_roles');
  await knex.schema.dropTableIfExists('permissions');
  await knex.schema.dropTableIfExists('roles');
  await knex.schema.dropTableIfExists('users');
}
