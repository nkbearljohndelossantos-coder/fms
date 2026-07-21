/**
 * Migration 012: Perfume Formula Details
 */
export async function up(knex) {
  await knex.schema.createTable('perfume_formula_details', (table) => {
    table.increments('id').primary();
    table.integer('version_id').unsigned().notNullable().references('id').inTable('formula_versions').onDelete('CASCADE').unique();
    table.string('concentration_tier', 50).notNullable(); // Body Mist, Cologne, EdC, EdT, EdP, Parfum, Extrait de Parfum, Custom
    table.decimal('fragrance_pct', 9, 6).notNullable().defaultTo(0);
    table.decimal('alcohol_pct', 9, 6).notNullable().defaultTo(0);
    table.decimal('water_pct', 9, 6).notNullable().defaultTo(0);
    table.decimal('fixative_pct', 9, 6).notNullable().defaultTo(0);
    table.decimal('solubilizer_pct', 9, 6).notNullable().defaultTo(0);
    table.integer('maceration_days').nullable().defaultTo(14);
    table.boolean('filtration_required').notNullable().defaultTo(true);
    table.string('cooling_required_c', 50).nullable();
    table.string('odor_profile', 255).nullable();
    table.string('packaging_recommendation', 255).nullable();
    table.timestamps(true, true);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('perfume_formula_details');
}
