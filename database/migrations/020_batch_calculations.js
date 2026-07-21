/**
 * Migration 020: Batch Calculations (Isolated Scaling Sessions)
 */
export async function up(knex) {
  await knex.schema.createTable('batch_calculations', (table) => {
    table.increments('id').primary();
    table.integer('version_id').unsigned().notNullable().references('id').inTable('formula_versions').onDelete('RESTRICT');
    table.decimal('target_batch_qty', 18, 6).notNullable();
    table.string('target_uom', 20).notNullable();
    table.decimal('process_loss_pct', 9, 6).notNullable().defaultTo(0);
    table.integer('created_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('batch_calculations');
}
