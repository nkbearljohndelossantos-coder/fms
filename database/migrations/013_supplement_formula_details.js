/**
 * Migration 013: Food Supplement Formula Details
 */
export async function up(knex) {
  await knex.schema.createTable('supplement_formula_details', (table) => {
    table.increments('id').primary();
    table.integer('version_id').unsigned().notNullable().references('id').inTable('formula_versions').onDelete('CASCADE').unique();
    table.string('dosage_form', 50).notNullable(); // Capsules, Tablets, Powders, Sachets, Syrups, Oral liquids, Gummies, Softgels, Drink mixes
    table.string('composition_mode', 30).notNullable().defaultTo('PERCENTAGE'); // PERCENTAGE, AMOUNT_PER_SERVING
    table.decimal('serving_size', 18, 6).notNullable().defaultTo(1.000000);
    table.string('serving_uom', 20).notNullable().defaultTo('serving');
    table.integer('servings_per_container').notNullable().defaultTo(30);
    table.string('capsule_size', 20).nullable();
    table.decimal('tablet_weight', 18, 6).nullable();
    table.string('tablet_weight_uom', 20).nullable().defaultTo('mg');
    table.string('daily_recommended_intake', 255).nullable();
    table.text('warning_statement').nullable();
    table.string('storage_instruction', 255).nullable();
    table.timestamps(true, true);

    table.check(`composition_mode IN ('PERCENTAGE', 'AMOUNT_PER_SERVING')`, [], 'chk_supp_comp_mode');
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('supplement_formula_details');
}
