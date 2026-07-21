/**
 * Migration 025: Audit Logs
 */
export async function up(knex) {
  await knex.schema.createTable('audit_logs', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.string('action', 100).notNullable();
    table.string('entity', 100).notNullable();
    table.integer('entity_id').unsigned().nullable();
    table.text('previous_values').nullable(); // JSON string
    table.text('new_values').nullable();      // JSON string
    table.string('ip_address', 45).nullable();
    table.string('user_agent', 255).nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('audit_logs');
}
