/**
 * Migration 021: Batch Calculation Items
 */
export async function up(knex) {
  await knex.schema.createTable('batch_calculation_items', (table) => {
    table.increments('id').primary();
    table.integer('batch_calculation_id').unsigned().notNullable().references('id').inTable('batch_calculations').onDelete('CASCADE');
    table.integer('material_id').unsigned().notNullable().references('id').inTable('materials').onDelete('RESTRICT');
    table.string('material_code_snapshot', 50).notNullable();
    table.string('material_name_snapshot', 150).notNullable();
    table.decimal('percentage', 9, 6).notNullable();
    table.decimal('scaled_qty', 18, 6).notNullable();
    table.string('scaled_uom', 20).notNullable();
    table.decimal('line_cost', 18, 6).notNullable();
    table.timestamps(true, true);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('batch_calculation_items');
}
