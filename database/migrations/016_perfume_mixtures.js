/**
 * Migration 016: Perfume Mixtures (Actual Recorded Source Mixtures)
 */
export async function up(knex) {
  await knex.schema.createTable('perfume_mixtures', (table) => {
    table.increments('id').primary();
    table.string('mixture_code', 50).notNullable().unique();
    table.string('mixture_name', 150).notNullable();
    table.integer('source_formula_version_id').unsigned().nullable().references('id').inTable('formula_versions').onDelete('SET NULL');
    table.decimal('actual_total_weight', 18, 6).notNullable();
    table.string('weight_uom', 20).notNullable().defaultTo('kg');
    table.timestamp('recorded_date').notNullable().defaultTo(knex.fn.now());
    table.text('remarks').nullable();
    table.integer('created_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('perfume_mixtures');
}
