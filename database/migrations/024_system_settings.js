/**
 * Migration 024: System Settings
 */
export async function up(knex) {
  await knex.schema.createTable('system_settings', (table) => {
    table.increments('id').primary();
    table.string('key', 100).notNullable().unique();
    table.text('value').notNullable();
    table.string('description', 255).nullable();
    table.timestamps(true, true);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('system_settings');
}
