import { express } from '../cjsRequire.js';
import Decimal from 'decimal.js';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { convertUnit } from '../services/unitConversionService.js';
import { logAudit } from '../middleware/audit.js';

const router = express.Router();

// POST /api/v1/batch-calculations - Run Batch Calculator Session (Isolated scaling)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { versionId, targetBatchQty, targetUom, processLossPct } = req.body;

    if (!versionId || !targetBatchQty || !targetUom) {
      return res.status(400).json({ success: false, message: 'Version ID, Target Batch Quantity, and Target UOM are required.' });
    }

    const version = await db('formula_versions')
      .join('formulas', 'formula_versions.formula_id', 'formulas.id')
      .where('formula_versions.id', versionId)
      .select('formula_versions.*', 'formulas.code as formula_code', 'formulas.name as formula_name', 'formulas.product_category')
      .first();

    if (!version) {
      return res.status(404).json({ success: false, message: 'Formula version not found.' });
    }

    const materials = await db('formula_version_materials')
      .join('materials', 'formula_version_materials.material_id', 'materials.id')
      .where('formula_version_materials.version_id', versionId)
      .select(
        'formula_version_materials.*',
        'materials.code as mat_code',
        'materials.name as mat_name',
        'materials.uom as default_uom',
        'materials.cost as current_cost',
        'materials.currency_code',
        'materials.density_kg_per_l',
        'materials.specific_gravity',
        'materials.unit_weight',
        'materials.unit_weight_uom'
      );

    const targetQtyDec = new Decimal(targetBatchQty);
    const lossPctDec = new Decimal(processLossPct || '0');
    const lossMultiplier = new Decimal(1).plus(lossPctDec.div(100));

    // Convert target batch to KG (or base unit) if needed to compute scale factor
    const refBatchSize = new Decimal(version.target_batch_size || '1');
    const refUom = version.target_batch_uom || 'kg';

    // 1. Calculate scaling ratio: targetQtyInRefUom / refBatchSize
    // Convert targetBatchQty in targetUom to refUom
    const targetQtyInRefUom = new Decimal(
      convertUnit(targetBatchQty, targetUom, refUom, '1.000000', null)
    );

    const scaleFactor = targetQtyInRefUom.div(refBatchSize);

    const items = [];
    let totalBatchCost = new Decimal(0);

    for (const m of materials) {
      const baseQty = new Decimal(m.calculated_quantity || '0');
      // Scaled quantity in material default UOM = baseQty * scaleFactor * (1 + loss%)
      const scaledQtyDec = baseQty.times(scaleFactor).times(lossMultiplier);

      const unitCost = new Decimal(m.current_cost || m.cost_per_uom || '0');
      const lineCostDec = scaledQtyDec.times(unitCost);
      totalBatchCost = totalBatchCost.plus(lineCostDec);

      items.push({
        material_id: m.material_id,
        material_code_snapshot: m.material_code_snapshot || m.mat_code,
        material_name_snapshot: m.material_name_snapshot || m.mat_name,
        percentage: new Decimal(m.percentage || '0').toFixed(6),
        scaled_qty: scaledQtyDec.toFixed(6),
        scaled_uom: m.uom_snapshot || m.default_uom || 'kg',
        cost_per_uom: unitCost.toFixed(6),
        line_cost: lineCostDec.toFixed(6),
        currency_code: m.currency_code || 'PHP',
      });
    }

    // Save batch calculation record
    const batchCalcId = await db.transaction(async trx => {
      const insertRes = await trx('batch_calculations').insert({
        version_id: versionId,
        target_batch_qty: targetQtyDec.toFixed(2),
        target_uom: targetUom,
        process_loss_pct: lossPctDec.toFixed(2),
        created_by: req.user.id,
      });
      const id = Array.isArray(insertRes) ? insertRes[0] : (typeof insertRes === 'object' ? insertRes.id : insertRes);

      for (const item of items) {
        await trx('batch_calculation_items').insert({
          batch_calculation_id: id,
          material_id: item.material_id,
          material_code_snapshot: item.material_code_snapshot,
          material_name_snapshot: item.material_name_snapshot,
          percentage: item.percentage,
          scaled_qty: item.scaled_qty,
          scaled_uom: item.scaled_uom,
          line_cost: item.line_cost,
        });
      }
      return id;
    });

    await logAudit(req, 'CALCULATE_BATCH', 'BatchCalculation', batchCalcId, null, { versionId, targetBatchQty, targetUom });

    return res.json({
      success: true,
      batchCalculationId: batchCalcId,
      data: {
        formula_code: version.formula_code,
        formula_name: version.formula_name,
        version: `${version.major_version}.${version.minor_version}`,
        target_batch_qty: targetQtyDec.toFixed(2),
        target_uom: targetUom,
        process_loss_pct: lossPctDec.toFixed(2),
        scale_factor: scaleFactor.toFixed(2),
        total_batch_cost: totalBatchCost.toFixed(2),
        items,
      },
    });
  } catch (err) {
    console.error('Batch Calculator Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/batch-calculations/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const calc = await db('batch_calculations')
      .join('formula_versions', 'batch_calculations.version_id', 'formula_versions.id')
      .join('formulas', 'formula_versions.formula_id', 'formulas.id')
      .leftJoin('users', 'batch_calculations.created_by', 'users.id')
      .where('batch_calculations.id', req.params.id)
      .select(
        'batch_calculations.*',
        'formulas.code as formula_code',
        'formulas.name as formula_name',
        'formula_versions.major_version',
        'formula_versions.minor_version',
        'users.username as created_by_username'
      )
      .first();

    if (!calc) {
      return res.status(404).json({ success: false, message: 'Batch calculation record not found.' });
    }

    const items = await db('batch_calculation_items').where({ batch_calculation_id: req.params.id });

    return res.json({ success: true, data: { ...calc, items } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch batch calculation.', error: err.message });
  }
});

export default router;
