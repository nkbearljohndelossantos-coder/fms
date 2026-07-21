/**
 * Migration 018: Perfume Conversions
 */
export async function up(knex) {
  await knex.schema.createTable('perfume_conversions', (table) => {
    table.increments('id').primary();
    table.integer('mixture_id').unsigned().notNullable().references('id').inTable('perfume_mixtures').onDelete('RESTRICT');
    table.integer('target_brand_version_id').unsigned().notNullable().references('id').inTable('formula_versions').onDelete('RESTRICT');
    table.string('mode', 30).notNullable().defaultTo('FIXED_TARGET_WEIGHT'); // FIXED_TARGET_WEIGHT, AUTO_MINIMUM_FINAL_WEIGHT
    table.decimal('initial_weight', 18, 6).notNullable();
    table.decimal('final_target_weight', 18, 6).notNullable();
    table.decimal('min_feasible_weight', 18, 6).nullable();
    table.decimal('actual_final_weight', 18, 6).nullable();
    table.text('actual_final_composition_snapshot').nullable(); // JSON string snapshot
    table.string('conversion_status', 30).notNullable().defaultTo('DRAFT'); // DRAFT, CALCULATED, INFEASIBLE, COMPLETED, CANCELLED
    table.boolean('is_feasible').notNullable().defaultTo(true);
    table.text('blocking_warning_text').nullable();
    table.integer('created_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.integer('completed_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('completed_at').nullable();
    table.timestamps(true, true);

    table.check(
      `mode IN ('FIXED_TARGET_WEIGHT', 'AUTO_MINIMUM_FINAL_WEIGHT')`,
      [],
      'chk_perfume_conv_mode'
    );
    table.check(
      `conversion_status IN ('DRAFT', 'CALCULATED', 'INFEASIBLE', 'COMPLETED', 'CANCELLED')`,
      [],
      'chk_perfume_conv_status'
    );
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('perfume_conversions');
}
