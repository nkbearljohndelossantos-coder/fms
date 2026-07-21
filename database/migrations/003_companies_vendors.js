/**
 * Migration 003: Companies and Vendors
 */
export async function up(knex) {
  await knex.schema.createTable('companies', (table) => {
    table.increments('id').primary();
    table.string('code', 50).notNullable().unique();
    table.string('name', 100).notNullable();
    table.string('contact_person', 100).nullable();
    table.string('email', 100).nullable();
    table.string('phone', 50).nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('archived_at').nullable();
    table.integer('archived_by').nullable();
    table.timestamps(true, true);
  });

  await knex.schema.createTable('vendors', (table) => {
    table.increments('id').primary();
    table.string('code', 50).notNullable().unique();
    table.string('name', 100).notNullable();
    table.string('contact_person', 100).nullable();
    table.string('email', 100).nullable();
    table.string('phone', 50).nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('archived_at').nullable();
    table.integer('archived_by').nullable();
    table.timestamps(true, true);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('vendors');
  await knex.schema.dropTableIfExists('companies');
}
