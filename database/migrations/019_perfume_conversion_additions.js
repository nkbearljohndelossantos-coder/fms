/**
 * Migration 019: Perfume Conversion Additions
 */
export async function up(knex) {
  await knex.schema.createTable('perfume_conversion_additions', (table) => {
    table.increments('id').primary();
    table.integer('conversion_id').unsigned().notNullable().references('id').inTable('perfume_conversions').onDelete('CASCADE');
    table.integer('material_id').unsigned().notNullable().references('id').inTable('materials').onDelete('RESTRICT');
    table.decimal('target_percentage', 9, 6).notNullable();
    table.decimal('existing_amount', 18, 6).notNullable();
    table.decimal('target_amount', 18, 6).notNullable();
    table.decimal('required_addition', 18, 6).notNullable();
    table.decimal('actual_addition', 18, 6).nullable();
    table.decimal('variance', 18, 6).nullable();
    table.timestamps(true, true);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('perfume_conversion_additions');
}
