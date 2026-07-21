/**
 * Migration 008: Formula Phases
 */
export async function up(knex) {
  await knex.schema.createTable('formula_phases', (table) => {
    table.increments('id').primary();
    table.integer('version_id').unsigned().notNullable().references('id').inTable('formula_versions').onDelete('CASCADE');
    table.string('phase_name', 50).notNullable(); // Phase A, Phase B, Phase C, Cooling Phase, Post-Addition Phase
    table.integer('phase_order').notNullable().defaultTo(1);
    table.timestamps(true, true);

    table.unique(['version_id', 'phase_name'], 'uq_formula_phase');
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('formula_phases');
}
