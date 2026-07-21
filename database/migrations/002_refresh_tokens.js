/**
 * Migration 002: Refresh Tokens
 */
export async function up(knex) {
  await knex.schema.createTable('refresh_tokens', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('token_hash', 255).notNullable().unique();
    table.timestamp('expires_at').notNullable();
    table.timestamp('revoked_at').nullable();
    table.integer('replaced_by_token_id').unsigned().nullable();
    table.string('ip_address', 45).nullable();
    table.string('user_agent', 255).nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('refresh_tokens');
}
