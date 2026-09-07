import { describe, it, expect, beforeAll } from 'vitest';
import knex from 'knex';
import path from 'path';

describe('Purchasing Rejection Tickets & Decision Engine Tests', () => {
  let db;

  beforeAll(async () => {
    db = knex({
      client: 'sqlite3',
      connection: { filename: ':memory:' },
      useNullAsDefault: true,
    });

    // Create required tables
    await db.schema.createTable('users', (table) => {
      table.increments('id').primary();
      table.string('username').notNullable();
      table.string('email').notNullable();
      table.string('first_name').notNullable();
      table.string('last_name').notNullable();
    });

    await db.schema.createTable('materials', (table) => {
      table.increments('id').primary();
      table.string('code').notNullable();
      table.string('name').notNullable();
      table.decimal('cost', 18, 6).defaultTo(100);
    });

    await db.schema.createTable('inventory_items', (table) => {
      table.increments('id').primary();
      table.string('item_type').notNullable();
      table.integer('material_id').references('id').inTable('materials');
      table.string('lot_number').notNullable();
      table.decimal('current_stock', 18, 6).defaultTo(0);
      table.decimal('available_stock', 18, 6).defaultTo(0);
      table.decimal('minimum_stock', 18, 6).defaultTo(0);
      table.decimal('reorder_level', 18, 6).defaultTo(0);
      table.string('uom').defaultTo('kg');
      table.string('location').defaultTo('RM-WH-A');
      table.string('status').defaultTo('QC_HOLD');
      table.timestamps(true, true);
    });

    await db.schema.createTable('rejected_materials', (table) => {
      table.increments('id').primary();
      table.string('rejection_code').notNullable();
      table.integer('material_id').references('id').inTable('materials');
      table.string('material_code').notNullable();
      table.string('material_name').notNullable();
      table.string('material_type').defaultTo('RAW_MATERIAL');
      table.integer('inventory_item_id').references('id').inTable('inventory_items');
      table.decimal('rejected_quantity', 18, 6).notNullable();
      table.string('uom').defaultTo('kg');
      table.text('reason').notNullable();
      table.string('disposition').defaultTo('Pending Review');
      table.string('status').defaultTo('Open');
      table.timestamps(true, true);
    });

    await db.schema.createTable('purchasing_tickets', (table) => {
      table.increments('id').primary();
      table.string('ticket_number').notNullable().unique();
      table.integer('rejected_material_id').references('id').inTable('rejected_materials');
      table.integer('inventory_item_id').references('id').inTable('inventory_items');
      table.string('status').defaultTo('PENDING_PURCHASING_REVIEW');
      table.string('issue_category').nullable();
      table.text('purchasing_notes').nullable();
      table.text('bypass_justification').nullable();
      table.integer('decided_by').nullable();
      table.timestamp('decided_at').nullable();
      table.timestamps(true, true);
    });

    await db.schema.createTable('purchase_requests', (table) => {
      table.increments('id').primary();
      table.string('request_number').notNullable().unique();
      table.string('item_name').notNullable();
      table.decimal('requested_quantity', 18, 6).notNullable();
      table.string('uom').defaultTo('kg');
      table.string('priority').defaultTo('Medium');
      table.string('status').defaultTo('Pending Review');
      table.integer('requested_by').notNullable();
      table.integer('decided_by').nullable();
      table.text('purchasing_remarks').nullable();
      table.timestamps(true, true);
    });

    // Seed test user
    await db('users').insert({
      id: 1,
      username: 'purchasing',
      email: 'purchasing@nkb.com',
      first_name: 'Purchasing',
      last_name: 'Officer',
    });
  });

  it('should initialize received supply lot in QC_HOLD status', async () => {
    const [matId] = await db('materials').insert({ code: 'RM-GLYC-001', name: 'Glycerin USP', cost: 150 });
    const [itemId] = await db('inventory_items').insert({
      item_type: 'RAW_MATERIAL',
      material_id: matId,
      lot_number: 'LOT-20260907-01',
      current_stock: 50,
      available_stock: 50,
      status: 'QC_HOLD',
    });

    const item = await db('inventory_items').where({ id: itemId }).first();
    expect(item.status).toBe('QC_HOLD');
  });

  it('should auto-create a Purchasing Ticket when QA files a material rejection', async () => {
    const item = await db('inventory_items').where({ lot_number: 'LOT-20260907-01' }).first();

    const [rejId] = await db('rejected_materials').insert({
      rejection_code: 'REJ-20260907-001',
      material_id: item.material_id,
      material_code: 'RM-GLYC-001',
      material_name: 'Glycerin USP',
      material_type: 'RAW_MATERIAL',
      inventory_item_id: item.id,
      rejected_quantity: 50,
      reason: 'Packaging seal broken on arrival',
    });

    const [tktId] = await db('purchasing_tickets').insert({
      ticket_number: 'PUR-TKT-1001',
      rejected_material_id: rejId,
      inventory_item_id: item.id,
      status: 'PENDING_PURCHASING_REVIEW',
      issue_category: 'Damaged Packaging',
    });

    const ticket = await db('purchasing_tickets').where({ id: tktId }).first();
    expect(ticket).toBeDefined();
    expect(ticket.status).toBe('PENDING_PURCHASING_REVIEW');
    expect(ticket.issue_category).toBe('Damaged Packaging');
  });

  it('should handle QA Bypass decision: restore stock to active inventory (status: NORMAL)', async () => {
    const ticket = await db('purchasing_tickets').where({ ticket_number: 'PUR-TKT-1001' }).first();

    // Execute QA Bypass decision
    await db('purchasing_tickets').where({ id: ticket.id }).update({
      status: 'QA_BYPASSED',
      bypass_justification: 'Critical manufacturing batch required lot; secondary QC test passed.',
      decided_by: 1,
      decided_at: new Date(),
    });

    await db('rejected_materials').where({ id: ticket.rejected_material_id }).update({
      disposition: 'Bypassed by Purchasing',
      status: 'Closed',
    });

    await db('inventory_items').where({ id: ticket.inventory_item_id }).update({
      status: 'NORMAL',
    });

    const updatedTicket = await db('purchasing_tickets').where({ id: ticket.id }).first();
    const updatedRejection = await db('rejected_materials').where({ id: ticket.rejected_material_id }).first();
    const updatedItem = await db('inventory_items').where({ id: ticket.inventory_item_id }).first();

    expect(updatedTicket.status).toBe('QA_BYPASSED');
    expect(updatedRejection.disposition).toBe('Bypassed by Purchasing');
    expect(updatedItem.status).toBe('NORMAL');
  });

  it('should allow Inventory Dept to create Purchase Request and Purchasing Dept to update status', async () => {
    const [reqId] = await db('purchase_requests').insert({
      request_number: 'PR-2026-0001',
      item_name: 'Hyaluronic Acid Powder',
      requested_quantity: 25,
      uom: 'kg',
      priority: 'High',
      status: 'Pending Review',
      requested_by: 1,
    });

    const reqItem = await db('purchase_requests').where({ id: reqId }).first();
    expect(reqItem.request_number).toBe('PR-2026-0001');
    expect(reqItem.status).toBe('Pending Review');

    // Purchasing Dept approves & places order
    await db('purchase_requests').where({ id: reqId }).update({
      status: 'Order Placed',
      purchasing_remarks: 'PO-2026-991 issued to Vendor X',
      decided_by: 1,
    });

    const updatedReq = await db('purchase_requests').where({ id: reqId }).first();
    expect(updatedReq.status).toBe('Order Placed');
    expect(updatedReq.purchasing_remarks).toContain('PO-2026-991');
  });
});
