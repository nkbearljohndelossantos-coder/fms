/**
 * Migration 010: Formula Instructions
 */
export async function up(knex) {
  await knex.schema.createTable('formula_instructions', (table) => {
    table.increments('id').primary();
    table.integer('version_id').unsigned().notNullable().references('id').inTable('formula_versions').onDelete('CASCADE');
    table.integer('phase_id').unsigned().nullable().references('id').inTable('formula_phases').onDelete('SET NULL');
    table.integer('step_number').notNullable().defaultTo(1);
    table.text('instruction_text').notNullable();
    table.timestamps(true, true);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('formula_instructions');
}
