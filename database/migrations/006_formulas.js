/**
 * Migration 006: Formulas Master
 */
export async function up(knex) {
  await knex.schema.createTable('formulas', (table) => {
    table.increments('id').primary();
    table.string('code', 50).notNullable().unique();
    table.string('name', 150).notNullable();
    table.string('product_category', 50).notNullable(); // Cosmetic, Perfume No Brand, Perfume Brand, Food Supplement
    table.string('product_subcategory', 50).nullable();
    table.string('brand_type', 50).nullable();
    table.string('status', 30).notNullable().defaultTo('ACTIVE'); // ACTIVE, ARCHIVED
    table.integer('owner_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.string('department', 100).nullable();
    table.timestamps(true, true);

    table.check(`status IN ('ACTIVE', 'ARCHIVED')`, [], 'chk_formulas_status');
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('formulas');
}
