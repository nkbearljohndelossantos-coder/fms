/**
 * Migration 015: Formula Workflow Records (Reviews, Approvals, Comments)
 */
export async function up(knex) {
  await knex.schema.createTable('formula_workflow_records', (table) => {
    table.increments('id').primary();
    table.integer('version_id').unsigned().notNullable().references('id').inTable('formula_versions').onDelete('CASCADE');
    table.string('action', 50).notNullable(); // SUBMITTED_FOR_REVIEW, RETURNED_TO_DRAFT, ENDORSED_FOR_APPROVAL, APPROVED, REJECTED
    table.string('from_status', 30).notNullable();
    table.string('to_status', 30).notNullable();
    table.integer('actor_id').unsigned().notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.text('comments').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('formula_workflow_records');
}
