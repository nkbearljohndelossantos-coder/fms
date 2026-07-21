/**
 * Migration 007: Formula Versions
 */
export async function up(knex) {
  await knex.schema.createTable('formula_versions', (table) => {
    table.increments('id').primary();
    table.integer('formula_id').unsigned().notNullable().references('id').inTable('formulas').onDelete('RESTRICT');
    table.integer('parent_version_id').unsigned().nullable().references('id').inTable('formula_versions').onDelete('RESTRICT');
    table.integer('major_version').notNullable().defaultTo(1);
    table.integer('minor_version').notNullable().defaultTo(0);
    table.integer('lock_version').notNullable().defaultTo(0);
    table.string('version_status', 30).notNullable().defaultTo('DRAFT'); // DRAFT, UNDER_REVIEW, FOR_APPROVAL, APPROVED, REJECTED, SUPERSEDED
    table.string('change_type', 50).nullable();
    table.text('revision_reason').nullable();
    table.text('change_summary').nullable();
    table.decimal('target_batch_size', 18, 6).notNullable().defaultTo(1.000000);
    table.string('target_batch_uom', 20).notNullable().defaultTo('kg');
    table.decimal('expected_yield', 9, 6).notNullable().defaultTo(100.000000);
    table.string('shelf_life', 50).nullable();
    table.string('storage_condition', 100).nullable();
    table.text('remarks').nullable();
    table.integer('created_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.integer('reviewed_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.integer('approved_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('effective_date').nullable();
    table.timestamp('approval_timestamp').nullable();
    table.timestamps(true, true);

    table.unique(['formula_id', 'major_version', 'minor_version'], 'uq_formula_version');
    table.check(
      `version_status IN ('DRAFT', 'UNDER_REVIEW', 'FOR_APPROVAL', 'APPROVED', 'REJECTED', 'SUPERSEDED')`,
      [],
      'chk_formula_version_status'
    );
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('formula_versions');
}
