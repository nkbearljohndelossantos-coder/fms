/**
 * Migration 005: Material Cost History
 */
export async function up(knex) {
  await knex.schema.createTable('material_cost_history', (table) => {
    table.increments('id').primary();
    table.integer('material_id').unsigned().notNullable().references('id').inTable('materials').onDelete('RESTRICT');
    table.decimal('old_cost', 18, 6).notNullable();
    table.decimal('new_cost', 18, 6).notNullable();
    table.string('old_currency_code', 3).notNullable();
    table.string('new_currency_code', 3).notNullable();
    table.timestamp('effective_date').notNullable().defaultTo(knex.fn.now());
    table.integer('changed_by_user_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('material_cost_history');
}
