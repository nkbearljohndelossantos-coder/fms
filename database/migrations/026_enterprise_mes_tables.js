/**
 * Migration 026: Production 3-Tier Enterprise MES Tables
 * Adds high-precision manufacturing tables, two-step electronic signatures,
 * append-only audit hash chain, batch execution locks, deviations, corrections,
 * rework orders, and category-specific QC templates.
 */

export async function up(knex) {
  // 1. User Sessions (HttpOnly Cookie Rotation & Reuse Tracking)
  await knex.schema.createTable('user_sessions', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('refresh_token_hash', 255).notNullable().unique();
    table.string('device_info', 255).nullable();
    table.string('ip_address', 45).nullable();
    table.boolean('is_revoked').notNullable().defaultTo(false);
    table.string('replaced_by_token', 255).nullable();
    table.timestamp('expires_at').notNullable();
    table.timestamps(true, true);
  });

  // 2. Equipment & Production Lines
  await knex.schema.createTable('machines', (table) => {
    table.increments('id').primary();
    table.string('code', 50).notNullable().unique();
    table.string('name', 100).notNullable();
    table.string('type', 50).notNullable(); // Mixer, Reactor, Homogenizer, Maceration Tank, Tablet Press
    table.string('location', 100).nullable();
    table.string('status', 30).notNullable().defaultTo('Active'); // Active, Maintenance, Offline
    table.timestamps(true, true);
  });

  await knex.schema.createTable('production_lines', (table) => {
    table.increments('id').primary();
    table.string('code', 50).notNullable().unique();
    table.string('name', 100).notNullable();
    table.string('status', 30).notNullable().defaultTo('Active');
    table.timestamps(true, true);
  });

  await knex.schema.createTable('operator_machine_authorizations', (table) => {
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('machine_id').unsigned().notNullable().references('id').inTable('machines').onDelete('CASCADE');
    table.integer('authorized_by').unsigned().nullable().references('id').inTable('users');
    table.timestamp('authorized_at').defaultTo(knex.fn.now());
    table.primary(['user_id', 'machine_id']);
  });

  // 3. System Atomic Sequences
  await knex.schema.createTable('system_sequences', (table) => {
    table.string('sequence_name', 50).primary();
    table.integer('current_val').notNullable().defaultTo(0);
    table.string('prefix', 20).notNullable();
    table.integer('year').notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  // 4. Idempotency Keys
  await knex.schema.createTable('idempotency_keys', (table) => {
    table.string('key', 128).primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users');
    table.string('request_hash', 64).notNullable();
    table.integer('response_status').notNullable();
    table.text('response_body').notNullable();
    table.timestamp('expires_at').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 5. Document Attachments
  await knex.schema.createTable('document_attachments', (table) => {
    table.increments('id').primary();
    table.string('filename', 255).notNullable();
    table.string('stored_name', 255).notNullable().unique();
    table.string('mime_type', 100).notNullable();
    table.bigInteger('file_size').notNullable();
    table.string('checksum_sha256', 64).notNullable();
    table.integer('uploaded_by').unsigned().notNullable().references('id').inTable('users');
    table.integer('version').notNullable().defaultTo(1);
    table.string('classification', 50).notNullable().defaultTo('Confidential'); // Confidential, Public, Internal
    table.string('malware_scan_status', 30).notNullable().defaultTo('Clean'); // Clean, Pending, Quarantined
    table.string('storage_path', 500).notNullable();
    table.timestamps(true, true);
  });

  // 6. Two-Step Electronic Signatures
  await knex.schema.createTable('electronic_signatures', (table) => {
    table.increments('id').primary();
    table.string('token_hash', 255).notNullable().unique();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users');
    table.string('action', 100).notNullable();
    table.string('entity_type', 50).notNullable();
    table.string('entity_id', 100).notNullable();
    table.string('nonce', 64).notNullable();
    table.string('reason', 255).nullable();
    table.boolean('is_consumed').notNullable().defaultTo(false);
    table.timestamp('expires_at').notNullable();
    table.timestamps(true, true);
  });

  // 7. Production Batches
  await knex.schema.createTable('production_batches', (table) => {
    table.increments('id').primary();
    table.string('batch_number', 50).notNullable().unique();
    table.integer('formula_id').unsigned().notNullable().references('id').inTable('formulas');
    table.integer('formula_version_id').unsigned().notNullable().references('id').inTable('formula_versions');
    table.string('category', 50).notNullable(); // Cosmetics, Perfumes, Food Supplements
    table.string('status', 40).notNullable().defaultTo('Assigned'); // Assigned, Ready, In Progress, Paused, Completed, Pending QC, Under Inspection, QC Passed, QC Failed, Rework Required, Released, Cancelled
    table.decimal('target_batch_size', 18, 6).notNullable();
    table.decimal('actual_batch_size', 18, 6).nullable();
    table.decimal('batch_yield_percent', 12, 6).nullable();
    table.decimal('overall_progress_percent', 12, 6).notNullable().defaultTo(0);
    table.string('snapshot_hash', 64).notNullable();
    table.integer('lock_version').notNullable().defaultTo(1);
    table.integer('assigned_operator_id').unsigned().nullable().references('id').inTable('users');
    table.integer('assigned_machine_id').unsigned().nullable().references('id').inTable('machines');
    table.integer('created_by').unsigned().notNullable().references('id').inTable('users');
    table.timestamp('started_at').nullable();
    table.timestamp('completed_at').nullable();
    table.timestamps(true, true);
  });

  await knex.schema.createTable('batch_assignments', (table) => {
    table.increments('id').primary();
    table.integer('batch_id').unsigned().notNullable().references('id').inTable('production_batches').onDelete('CASCADE');
    table.integer('operator_id').unsigned().notNullable().references('id').inTable('users');
    table.integer('machine_id').unsigned().notNullable().references('id').inTable('machines');
    table.integer('assigned_by').unsigned().notNullable().references('id').inTable('users');
    table.timestamp('assigned_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('batch_phases', (table) => {
    table.increments('id').primary();
    table.integer('batch_id').unsigned().notNullable().references('id').inTable('production_batches').onDelete('CASCADE');
    table.string('phase_letter', 10).notNullable();
    table.string('phase_name', 100).notNullable();
    table.integer('sequence').notNullable();
    table.string('status', 30).notNullable().defaultTo('Waiting'); // Waiting, Running, Completed
    table.timestamp('started_at').nullable();
    table.timestamp('completed_at').nullable();
  });

  await knex.schema.createTable('batch_steps', (table) => {
    table.increments('id').primary();
    table.integer('batch_id').unsigned().notNullable().references('id').inTable('production_batches').onDelete('CASCADE');
    table.integer('phase_id').unsigned().notNullable().references('id').inTable('batch_phases').onDelete('CASCADE');
    table.integer('step_number').notNullable();
    table.integer('material_id').unsigned().nullable().references('id').inTable('materials');
    table.text('instructions').nullable();
    table.string('status', 30).notNullable().defaultTo('Pending'); // Pending, In Progress, Completed, Skipped, Deviation
    table.integer('lock_version').notNullable().defaultTo(1);
    table.timestamp('started_at').nullable();
    table.timestamp('completed_at').nullable();
  });

  // Planned snapshot requirements vs Actual weighings
  await knex.schema.createTable('batch_material_requirements', (table) => {
    table.increments('id').primary();
    table.integer('batch_id').unsigned().notNullable().references('id').inTable('production_batches').onDelete('CASCADE');
    table.integer('step_id').unsigned().notNullable().references('id').inTable('batch_steps').onDelete('CASCADE');
    table.integer('material_id').unsigned().notNullable().references('id').inTable('materials');
    table.string('material_code', 50).notNullable();
    table.string('material_name', 150).notNullable();
    table.decimal('percentage', 12, 6).notNullable();
    table.decimal('target_weight', 18, 6).notNullable();
    table.decimal('tolerance_percent', 12, 6).notNullable().defaultTo(1.000000);
    table.decimal('min_weight', 18, 6).notNullable();
    table.decimal('max_weight', 18, 6).notNullable();
  });

  await knex.schema.createTable('batch_material_entries', (table) => {
    table.increments('id').primary();
    table.integer('batch_id').unsigned().notNullable().references('id').inTable('production_batches').onDelete('CASCADE');
    table.integer('step_id').unsigned().notNullable().references('id').inTable('batch_steps').onDelete('CASCADE');
    table.integer('material_id').unsigned().notNullable().references('id').inTable('materials');
    table.integer('operator_id').unsigned().notNullable().references('id').inTable('users');
    table.string('scale_mode', 30).notNullable().defaultTo('Manual'); // Manual, Simulator, Hardware
    table.decimal('actual_weight', 18, 6).notNullable();
    table.decimal('variance_percent', 12, 6).notNullable();
    table.boolean('is_within_tolerance').notNullable();
    table.text('operator_notes').nullable();
    table.integer('signature_ref').unsigned().nullable();
    table.timestamp('weighed_at').defaultTo(knex.fn.now());
  });

  // 8. Tokenized QR Codes
  await knex.schema.createTable('qr_tokens', (table) => {
    table.increments('id').primary();
    table.string('token_hash', 255).notNullable().unique();
    table.integer('batch_id').unsigned().nullable().references('id').inTable('production_batches').onDelete('CASCADE');
    table.integer('formula_version_id').unsigned().nullable().references('id').inTable('formula_versions');
    table.boolean('is_single_use').notNullable().defaultTo(false);
    table.boolean('is_consumed').notNullable().defaultTo(false);
    table.boolean('is_revoked').notNullable().defaultTo(false);
    table.timestamp('expires_at').notNullable();
    table.timestamps(true, true);
  });

  // 9. Concurrency & Execution Locks
  await knex.schema.createTable('batch_execution_locks', (table) => {
    table.integer('batch_id').unsigned().primary().references('id').inTable('production_batches').onDelete('CASCADE');
    table.integer('locked_by_user_id').unsigned().notNullable().references('id').inTable('users');
    table.string('lock_token', 128).notNullable();
    table.timestamp('heartbeat_at').defaultTo(knex.fn.now());
    table.timestamp('expires_at').notNullable();
    table.timestamps(true, true);
  });

  await knex.schema.createTable('batch_operator_handovers', (table) => {
    table.increments('id').primary();
    table.integer('batch_id').unsigned().notNullable().references('id').inTable('production_batches').onDelete('CASCADE');
    table.integer('outgoing_operator_id').unsigned().notNullable().references('id').inTable('users');
    table.integer('incoming_operator_id').unsigned().notNullable().references('id').inTable('users');
    table.integer('outgoing_signature_ref').unsigned().nullable();
    table.integer('incoming_signature_ref').unsigned().nullable();
    table.text('notes').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('batch_pause_logs', (table) => {
    table.increments('id').primary();
    table.integer('batch_id').unsigned().notNullable().references('id').inTable('production_batches').onDelete('CASCADE');
    table.integer('operator_id').unsigned().notNullable().references('id').inTable('users');
    table.string('reason', 255).notNullable();
    table.timestamp('paused_at').defaultTo(knex.fn.now());
    table.timestamp('resumed_at').nullable();
  });

  await knex.schema.createTable('batch_status_history', (table) => {
    table.increments('id').primary();
    table.integer('batch_id').unsigned().notNullable().references('id').inTable('production_batches').onDelete('CASCADE');
    table.string('previous_status', 40).nullable();
    table.string('new_status', 40).notNullable();
    table.integer('changed_by_user_id').unsigned().notNullable().references('id').inTable('users');
    table.string('reason', 255).nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('formula_version_status_history', (table) => {
    table.increments('id').primary();
    table.integer('formula_version_id').unsigned().notNullable().references('id').inTable('formula_versions').onDelete('CASCADE');
    table.string('previous_status', 40).nullable();
    table.string('new_status', 40).notNullable();
    table.integer('changed_by_user_id').unsigned().notNullable().references('id').inTable('users');
    table.string('reason', 255).nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 10. Out-of-Tolerance Deviations & Material Corrections
  await knex.schema.createTable('batch_deviations', (table) => {
    table.increments('id').primary();
    table.string('deviation_code', 50).notNullable().unique();
    table.integer('batch_id').unsigned().notNullable().references('id').inTable('production_batches').onDelete('CASCADE');
    table.integer('step_id').unsigned().notNullable().references('id').inTable('batch_steps').onDelete('CASCADE');
    table.integer('operator_id').unsigned().notNullable().references('id').inTable('users');
    table.decimal('target_weight', 18, 6).notNullable();
    table.decimal('actual_weight', 18, 6).notNullable();
    table.decimal('variance_percent', 12, 6).notNullable();
    table.text('reason').notNullable();
    table.string('status', 30).notNullable().defaultTo('Pending Review'); // Pending Review, Accepted Deviation, Correction Required, Rejected
    table.integer('supervisor_id').unsigned().nullable().references('id').inTable('users');
    table.integer('supervisor_signature_ref').unsigned().nullable();
    table.timestamp('reviewed_at').nullable();
    table.timestamps(true, true);
  });

  await knex.schema.createTable('batch_deviation_approvals', (table) => {
    table.increments('id').primary();
    table.integer('deviation_id').unsigned().notNullable().references('id').inTable('batch_deviations').onDelete('CASCADE');
    table.integer('supervisor_id').unsigned().notNullable().references('id').inTable('users');
    table.string('decision', 30).notNullable();
    table.text('remarks').nullable();
    table.integer('signature_ref').unsigned().nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('batch_material_corrections', (table) => {
    table.increments('id').primary();
    table.string('correction_code', 50).notNullable().unique();
    table.integer('batch_id').unsigned().notNullable().references('id').inTable('production_batches').onDelete('CASCADE');
    table.integer('entry_id').unsigned().notNullable().references('id').inTable('batch_material_entries').onDelete('CASCADE');
    table.decimal('original_weight', 18, 6).notNullable();
    table.decimal('corrected_weight', 18, 6).notNullable();
    table.text('reason').notNullable();
    table.integer('requested_by').unsigned().notNullable().references('id').inTable('users');
    table.integer('approved_by').unsigned().notNullable().references('id').inTable('users');
    table.integer('signature_ref').unsigned().nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 11. Rework Orders
  await knex.schema.createTable('batch_rework_orders', (table) => {
    table.increments('id').primary();
    table.string('rework_code', 50).notNullable().unique();
    table.integer('original_batch_id').unsigned().notNullable().references('id').inTable('production_batches');
    table.integer('new_batch_id').unsigned().nullable().references('id').inTable('production_batches');
    table.text('reason').notNullable();
    table.text('instructions').notNullable();
    table.string('status', 30).notNullable().defaultTo('Assigned');
    table.integer('created_by').unsigned().notNullable().references('id').inTable('users');
    table.timestamps(true, true);
  });

  await knex.schema.createTable('batch_rework_steps', (table) => {
    table.increments('id').primary();
    table.integer('rework_order_id').unsigned().notNullable().references('id').inTable('batch_rework_orders').onDelete('CASCADE');
    table.integer('step_number').notNullable();
    table.text('description').notNullable();
    table.string('status', 30).notNullable().defaultTo('Pending');
    table.timestamp('completed_at').nullable();
  });

  // 12. Quality Control Engine (Category-Configurable Templates)
  await knex.schema.createTable('qc_templates', (table) => {
    table.increments('id').primary();
    table.string('code', 50).notNullable().unique();
    table.string('name', 100).notNullable();
    table.string('category', 50).notNullable(); // Cosmetics, Perfumes, Food Supplements
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamps(true, true);
  });

  await knex.schema.createTable('qc_template_parameters', (table) => {
    table.increments('id').primary();
    table.integer('template_id').unsigned().notNullable().references('id').inTable('qc_templates').onDelete('CASCADE');
    table.string('param_code', 50).notNullable();
    table.string('param_name', 100).notNullable();
    table.string('unit', 30).nullable();
    table.decimal('min_value', 18, 6).nullable();
    table.decimal('max_value', 18, 6).nullable();
    table.string('target_value_str', 100).nullable();
    table.boolean('is_required').notNullable().defaultTo(true);
  });

  await knex.schema.createTable('qc_inspections', (table) => {
    table.increments('id').primary();
    table.integer('batch_id').unsigned().notNullable().references('id').inTable('production_batches').onDelete('CASCADE');
    table.integer('template_id').unsigned().notNullable().references('id').inTable('qc_templates');
    table.integer('inspector_id').unsigned().nullable().references('id').inTable('users');
    table.string('status', 40).notNullable().defaultTo('Pending QC'); // Pending QC, Under Inspection, QC Passed, QC Failed, Rework Required, Released
    table.integer('lock_version').notNullable().defaultTo(1);
    table.timestamp('started_at').nullable();
    table.timestamp('completed_at').nullable();
    table.timestamps(true, true);
  });

  await knex.schema.createTable('qc_results', (table) => {
    table.increments('id').primary();
    table.integer('inspection_id').unsigned().notNullable().references('id').inTable('qc_inspections').onDelete('CASCADE');
    table.integer('parameter_id').unsigned().notNullable().references('id').inTable('qc_template_parameters');
    table.string('param_name', 100).notNullable();
    table.decimal('measured_numeric', 18, 6).nullable();
    table.string('measured_text', 255).nullable();
    table.boolean('is_pass').notNullable();
    table.text('notes').nullable();
    table.timestamp('tested_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('qc_attachments', (table) => {
    table.increments('id').primary();
    table.integer('inspection_id').unsigned().notNullable().references('id').inTable('qc_inspections').onDelete('CASCADE');
    table.integer('attachment_id').unsigned().notNullable().references('id').inTable('document_attachments').onDelete('CASCADE');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('qc_decisions', (table) => {
    table.increments('id').primary();
    table.integer('inspection_id').unsigned().notNullable().references('id').inTable('qc_inspections').onDelete('CASCADE');
    table.integer('batch_id').unsigned().notNullable().references('id').inTable('production_batches').onDelete('CASCADE');
    table.string('decision', 40).notNullable(); // Released, QC Failed, Rework Required
    table.integer('decided_by_user_id').unsigned().notNullable().references('id').inTable('users');
    table.text('reason').nullable();
    table.integer('signature_ref').unsigned().nullable();
    table.timestamp('decided_at').defaultTo(knex.fn.now());
  });

  // 13. Enhanced Audit Log Hash-Chaining Columns
  const hasAuditTable = await knex.schema.hasTable('audit_logs');
  if (hasAuditTable) {
    await knex.schema.alterTable('audit_logs', (table) => {
      table.bigInteger('sequence_number').nullable();
      table.string('previous_hash', 64).nullable();
      table.string('entry_hash', 64).nullable();
      table.string('algorithm_version', 20).defaultTo('SHA256');
    });
  }
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('qc_decisions');
  await knex.schema.dropTableIfExists('qc_attachments');
  await knex.schema.dropTableIfExists('qc_results');
  await knex.schema.dropTableIfExists('qc_inspections');
  await knex.schema.dropTableIfExists('qc_template_parameters');
  await knex.schema.dropTableIfExists('qc_templates');
  await knex.schema.dropTableIfExists('batch_rework_steps');
  await knex.schema.dropTableIfExists('batch_rework_orders');
  await knex.schema.dropTableIfExists('batch_material_corrections');
  await knex.schema.dropTableIfExists('batch_deviation_approvals');
  await knex.schema.dropTableIfExists('batch_deviations');
  await knex.schema.dropTableIfExists('formula_version_status_history');
  await knex.schema.dropTableIfExists('batch_status_history');
  await knex.schema.dropTableIfExists('batch_pause_logs');
  await knex.schema.dropTableIfExists('batch_operator_handovers');
  await knex.schema.dropTableIfExists('batch_execution_locks');
  await knex.schema.dropTableIfExists('qr_tokens');
  await knex.schema.dropTableIfExists('batch_material_entries');
  await knex.schema.dropTableIfExists('batch_material_requirements');
  await knex.schema.dropTableIfExists('batch_steps');
  await knex.schema.dropTableIfExists('batch_phases');
  await knex.schema.dropTableIfExists('batch_assignments');
  await knex.schema.dropTableIfExists('production_batches');
  await knex.schema.dropTableIfExists('electronic_signatures');
  await knex.schema.dropTableIfExists('document_attachments');
  await knex.schema.dropTableIfExists('idempotency_keys');
  await knex.schema.dropTableIfExists('system_sequences');
  await knex.schema.dropTableIfExists('operator_machine_authorizations');
  await knex.schema.dropTableIfExists('production_lines');
  await knex.schema.dropTableIfExists('machines');
  await knex.schema.dropTableIfExists('user_sessions');
}
