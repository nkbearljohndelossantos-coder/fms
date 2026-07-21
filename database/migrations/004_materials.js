/**
 * Migration 004: Materials
 */
export async function up(knex) {
  await knex.schema.createTable('materials', (table) => {
    table.increments('id').primary();
    table.string('code', 50).notNullable().unique();
    table.string('name', 150).notNullable();
    table.integer('company_id').unsigned().nullable().references('id').inTable('companies').onDelete('SET NULL');
    table.integer('vendor_id').unsigned().nullable().references('id').inTable('vendors').onDelete('SET NULL');
    table.string('uom', 20).notNullable();
    table.string('uom_category', 20).notNullable(); // MASS, VOLUME, COUNT
    table.decimal('cost', 18, 6).notNullable().defaultTo(0);
    table.string('currency_code', 3).notNullable().defaultTo('PHP');
    table.decimal('density_kg_per_l', 12, 6).notNullable().defaultTo(1.000000);
    table.decimal('specific_gravity', 12, 6).notNullable().defaultTo(1.000000);
    table.decimal('unit_weight', 18, 6).nullable();
    table.string('unit_weight_uom', 20).nullable();
    table.text('description').nullable();
    table.boolean('is_inventoried').notNullable().defaultTo(false); // Reference field only
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('archived_at').nullable();
    table.integer('archived_by').nullable();
    table.timestamps(true, true);

    table.check(`uom_category IN ('MASS', 'VOLUME', 'COUNT')`, [], 'chk_materials_uom_cat');
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('materials');
}
