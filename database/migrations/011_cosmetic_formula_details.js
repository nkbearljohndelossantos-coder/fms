/**
 * Migration 011: Cosmetic Formula Details
 */
export async function up(knex) {
  await knex.schema.createTable('cosmetic_formula_details', (table) => {
    table.increments('id').primary();
    table.integer('version_id').unsigned().notNullable().references('id').inTable('formula_versions').onDelete('CASCADE').unique();
    table.string('target_ph', 50).nullable();
    table.string('viscosity_cp', 50).nullable();
    table.string('appearance', 100).nullable();
    table.string('color', 50).nullable();
    table.string('odor', 100).nullable();
    table.string('texture', 100).nullable();
    table.string('preservative_system', 150).nullable();
    table.text('manufacturing_conditions').nullable();
    table.timestamps(true, true);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('cosmetic_formula_details');
}
