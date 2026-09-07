/**
 * Migration 038: Create purchase_requests table
 * Enables Inventory Department to submit item purchase requisitions to Purchasing Department.
 */

export async function up(knex) {
  const exists = await knex.schema.hasTable('purchase_requests');
  if (!exists) {
    await knex.schema.createTable('purchase_requests', (table) => {
      table.increments('id').primary();
      table.string('request_number', 50).notNullable().unique();
      table.string('item_name', 255).notNullable();
      table.integer('material_id').unsigned().nullable().references('id').inTable('materials').onDelete('SET NULL');
      table.decimal('requested_quantity', 18, 6).notNullable();
      table.string('uom', 20).notNullable().defaultTo('kg');
      table.string('priority', 20).notNullable().defaultTo('Medium'); // Low, Medium, High, Critical
      table.date('needed_by_date').nullable();
      table.text('justification').nullable();
      table.integer('vendor_id').unsigned().nullable().references('id').inTable('vendors').onDelete('SET NULL');
      table.string('status', 30).notNullable().defaultTo('Pending Review'); // Pending Review, Approved, Order Placed, Fulfilled, Rejected
      table.integer('requested_by').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.integer('decided_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
      table.text('purchasing_remarks').nullable();
      table.timestamps(true, true);
    });
  }
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('purchase_requests');
}
