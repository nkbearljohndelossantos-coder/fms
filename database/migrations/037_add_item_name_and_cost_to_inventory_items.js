/**
 * Migration 037: Add item_name and cost to inventory_items
 * Allows inventory items to exist standalone in Inventory Management without needing a record in the materials table.
 */

export async function up(knex) {
  const hasItemName = await knex.schema.hasColumn('inventory_items', 'item_name');
  const hasCost = await knex.schema.hasColumn('inventory_items', 'cost');

  await knex.schema.table('inventory_items', (table) => {
    if (!hasItemName) {
      table.string('item_name', 255).nullable();
    }
    if (!hasCost) {
      table.decimal('cost', 18, 6).notNullable().defaultTo(0);
    }
  });
}

export async function down(knex) {
  const hasItemName = await knex.schema.hasColumn('inventory_items', 'item_name');
  const hasCost = await knex.schema.hasColumn('inventory_items', 'cost');

  await knex.schema.table('inventory_items', (table) => {
    if (hasItemName) {
      table.dropColumn('item_name');
    }
    if (hasCost) {
      table.dropColumn('cost');
    }
  });
}
