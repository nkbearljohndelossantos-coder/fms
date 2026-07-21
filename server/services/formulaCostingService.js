import Decimal from 'decimal.js/decimal.js';
import db from '../db.js';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

/**
 * High-precision Formula Costing & Snapshot Engine
 *
 * Calculates material line costs, raw material total, loss adjustments,
 * packaging, labor, overhead, cost per unit/kg, and creates immutable
 * cost snapshots upon formula approval.
 */
export function calculateFormulaCosting(materials, targetBatchSize, processLossPct = '0', packagingCost = '0', laborCost = '0', overheadCost = '0') {
  const batchSize = new Decimal(targetBatchSize || '1');
  const lossPct = new Decimal(processLossPct || '0');
  const packCost = new Decimal(packagingCost || '0');
  const labCost = new Decimal(laborCost || '0');
  const ovhCost = new Decimal(overheadCost || '0');

  let rawMaterialTotal = new Decimal(0);
  const items = [];

  for (const m of materials) {
    const qty = new Decimal(m.calculated_quantity || '0');
    const unitCost = new Decimal(m.cost || m.cost_per_uom || '0');
    const lineCost = qty.times(unitCost);

    rawMaterialTotal = rawMaterialTotal.plus(lineCost);

    items.push({
      material_id: m.material_id,
      material_code_snapshot: m.material_code_snapshot || m.code,
      material_name_snapshot: m.material_name_snapshot || m.name,
      percentage: new Decimal(m.percentage || '0').toFixed(6),
      quantity: qty.toFixed(6),
      uom: m.uom_snapshot || m.uom || 'kg',
      cost_per_uom: unitCost.toFixed(6),
      line_cost: lineCost.toFixed(6),
      currency_code: m.currency_code || 'PHP',
    });
  }

  // Adjusted Raw Material Cost with Process Loss = RawMaterialTotal * (1 + ProcessLoss% / 100)
  const lossMultiplier = new Decimal(1).plus(lossPct.div(100));
  const rawWithLoss = rawMaterialTotal.times(lossMultiplier);

  const totalCost = rawWithLoss.plus(packCost).plus(labCost).plus(ovhCost);
  const costPerUnit = batchSize.gt(0) ? totalCost.div(batchSize) : new Decimal(0);

  return {
    raw_material_cost: rawMaterialTotal.toFixed(6),
    process_loss_pct: lossPct.toFixed(6),
    packaging_cost: packCost.toFixed(6),
    labor_cost: labCost.toFixed(6),
    overhead_cost: ovhCost.toFixed(6),
    total_cost: totalCost.toFixed(6),
    cost_per_unit: costPerUnit.toFixed(6),
    currency_code: materials[0]?.currency_code || 'PHP',
    items,
  };
}

/**
 * Save immutable costing snapshot for an approved formula version inside a database transaction
 */
export async function saveFormulaCostSnapshot(trx, versionId, costingResult) {
  // Check if snapshot already exists
  const existing = await trx('formula_cost_snapshots').where({ version_id: versionId }).first();
  if (existing) {
    return existing.id;
  }

  const [snapshotId] = await trx('formula_cost_snapshots').insert({
    version_id: versionId,
    raw_material_cost: costingResult.raw_material_cost,
    process_loss_pct: costingResult.process_loss_pct,
    packaging_cost: costingResult.packaging_cost,
    labor_cost: costingResult.labor_cost,
    overhead_cost: costingResult.overhead_cost,
    total_cost: costingResult.total_cost,
    cost_per_unit: costingResult.cost_per_unit,
    currency_code: costingResult.currency_code,
  }).then(res => [res[0]]);

  for (const item of costingResult.items) {
    await trx('formula_cost_snapshot_items').insert({
      snapshot_id: snapshotId,
      material_id: item.material_id,
      material_code_snapshot: item.material_code_snapshot,
      material_name_snapshot: item.material_name_snapshot,
      percentage: item.percentage,
      quantity: item.quantity,
      uom: item.uom,
      cost_per_uom: item.cost_per_uom,
      line_cost: item.line_cost,
      currency_code: item.currency_code,
    });
  }

  return snapshotId;
}
