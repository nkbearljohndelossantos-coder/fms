/**
 * Migration 009: Formula Version Materials
 */
export async function up(knex) {
  await knex.schema.createTable('formula_version_materials', (table) => {
    table.increments('id').primary();
    table.integer('version_id').unsigned().notNullable().references('id').inTable('formula_versions').onDelete('CASCADE');
    table.integer('phase_id').unsigned().nullable().references('id').inTable('formula_phases').onDelete('SET NULL');
    table.integer('material_id').unsigned().notNullable().references('id').inTable('materials').onDelete('RESTRICT');
    table.string('material_code_snapshot', 50).notNullable();
    table.string('material_name_snapshot', 150).notNullable();
    table.string('uom_snapshot', 20).notNullable();
    table.decimal('percentage', 9, 6).notNullable().defaultTo(0);
    table.decimal('serving_amount', 18, 6).nullable();
    table.string('serving_uom', 20).nullable();
    table.decimal('calculated_quantity', 18, 6).notNullable().defaultTo(0);
    table.integer('addition_order').notNullable().defaultTo(1);
    table.decimal('temp_c', 9, 2).nullable();
    table.integer('mixing_speed_rpm').nullable();
    table.integer('duration_min').nullable();
    table.decimal('line_cost', 18, 6).notNullable().defaultTo(0);
    table.string('function_name', 100).nullable();
    table.boolean('is_qs_balancing_material').notNullable().defaultTo(false);
    table.timestamps(true, true);

    table.unique(['version_id', 'material_id', 'phase_id'], 'uq_version_mat_phase');
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('formula_version_materials');
}
