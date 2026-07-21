/**
 * Migration 014: Supplement Serving Details
 */
export async function up(knex) {
  await knex.schema.createTable('supplement_serving_details', (table) => {
    table.increments('id').primary();
    table.integer('version_material_id').unsigned().notNullable().references('id').inTable('formula_version_materials').onDelete('CASCADE').unique();
    table.decimal('active_amount_per_serving', 18, 6).notNullable().defaultTo(0);
    table.string('active_uom', 20).notNullable().defaultTo('mg');
    table.decimal('overage_pct', 9, 6).notNullable().defaultTo(0);
    table.boolean('is_excipient').notNullable().defaultTo(false);
    table.boolean('is_fixed_non_active').notNullable().defaultTo(false);
    table.timestamps(true, true);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('supplement_serving_details');
}
