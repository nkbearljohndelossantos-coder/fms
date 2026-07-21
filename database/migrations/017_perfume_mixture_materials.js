/**
 * Migration 017: Perfume Mixture Materials
 */
export async function up(knex) {
  await knex.schema.createTable('perfume_mixture_materials', (table) => {
    table.increments('id').primary();
    table.integer('mixture_id').unsigned().notNullable().references('id').inTable('perfume_mixtures').onDelete('CASCADE');
    table.integer('material_id').unsigned().notNullable().references('id').inTable('materials').onDelete('RESTRICT');
    table.decimal('percentage', 9, 6).notNullable();
    table.decimal('actual_quantity', 18, 6).notNullable();
    table.string('uom', 20).notNullable();
    table.timestamps(true, true);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('perfume_mixture_materials');
}
