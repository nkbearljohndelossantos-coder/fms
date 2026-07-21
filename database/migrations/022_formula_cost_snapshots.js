/**
 * Migration 022: Formula Cost Snapshots (Immutable Summary Costing)
 */
export async function up(knex) {
  await knex.schema.createTable('formula_cost_snapshots', (table) => {
    table.increments('id').primary();
    table.integer('version_id').unsigned().notNullable().references('id').inTable('formula_versions').onDelete('RESTRICT').unique();
    table.decimal('raw_material_cost', 18, 6).notNullable();
    table.decimal('process_loss_pct', 9, 6).notNullable().defaultTo(0);
    table.decimal('packaging_cost', 18, 6).notNullable().defaultTo(0);
    table.decimal('labor_cost', 18, 6).notNullable().defaultTo(0);
    table.decimal('overhead_cost', 18, 6).notNullable().defaultTo(0);
    table.decimal('total_cost', 18, 6).notNullable();
    table.decimal('cost_per_unit', 18, 6).notNullable();
    table.string('currency_code', 3).notNullable().defaultTo('PHP');
    table.timestamps(true, true);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('formula_cost_snapshots');
}
