/**
 * Migration 023: Formula Cost Snapshot Items (Immutable Material Line-Item Costing)
 */
export async function up(knex) {
  await knex.schema.createTable('formula_cost_snapshot_items', (table) => {
    table.increments('id').primary();
    table.integer('snapshot_id').unsigned().notNullable().references('id').inTable('formula_cost_snapshots').onDelete('CASCADE');
    table.integer('material_id').unsigned().notNullable().references('id').inTable('materials').onDelete('RESTRICT');
    table.string('material_code_snapshot', 50).notNullable();
    table.string('material_name_snapshot', 150).notNullable();
    table.decimal('percentage', 9, 6).notNullable();
    table.decimal('quantity', 18, 6).notNullable();
    table.string('uom', 20).notNullable();
    table.decimal('cost_per_uom', 18, 6).notNullable();
    table.decimal('line_cost', 18, 6).notNullable();
    table.string('currency_code', 3).notNullable().defaultTo('PHP');
    table.timestamps(true, true);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('formula_cost_snapshot_items');
}
