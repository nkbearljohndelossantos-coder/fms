import { express } from '../cjsRequire.js';
import Decimal from 'decimal.js';
import db from '../db.js';
import { authenticateToken, requireRoles } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';
import { calculatePerfumeConversion, completePerfumeConversion } from '../services/perfumeConversionEngine.js';

const router = express.Router();

// GET /api/v1/perfume-conversions/mixtures - List recorded perfume source mixtures
router.get('/mixtures', authenticateToken, async (req, res) => {
  try {
    const mixtures = await db('perfume_mixtures')
      .leftJoin('users', 'perfume_mixtures.created_by', 'users.id')
      .leftJoin('formula_versions', 'perfume_mixtures.source_formula_version_id', 'formula_versions.id')
      .leftJoin('formulas', 'formula_versions.formula_id', 'formulas.id')
      .select(
        'perfume_mixtures.*',
        'users.username as created_by_username',
        'formulas.name as source_formula_name',
        'formulas.code as source_formula_code'
      )
      .orderBy('perfume_mixtures.created_at', 'desc');

    for (const m of mixtures) {
      const materials = await db('perfume_mixture_materials')
        .join('materials', 'perfume_mixture_materials.material_id', 'materials.id')
        .where('perfume_mixture_materials.mixture_id', m.id)
        .select('perfume_mixture_materials.*', 'materials.name', 'materials.code');
      m.materials = materials;
    }

    return res.json({ success: true, data: mixtures });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch perfume mixtures.', error: err.message });
  }
});

// POST /api/v1/perfume-conversions/mixtures - Record actual compounded source mixture
router.post('/mixtures', authenticateToken, requireRoles('Super Admin', 'Formulator'), async (req, res) => {
  try {
    const { mixtureCode, mixtureName, sourceFormulaVersionId, actualTotalWeight, weightUom, remarks, materials } = req.body;

    if (!mixtureCode || !mixtureName || !actualTotalWeight || !materials || materials.length === 0) {
      return res.status(400).json({ success: false, message: 'Mixture Code, Name, Actual Weight, and Materials are required.' });
    }

    const existing = await db('perfume_mixtures').where({ mixture_code: mixtureCode }).first();
    if (existing) {
      return res.status(400).json({ success: false, message: `Mixture code '${mixtureCode}' already exists.` });
    }

    const [mixtureId] = await db.transaction(async trx => {
      const [mId] = await trx('perfume_mixtures').insert({
        mixture_code: mixtureCode,
        mixture_name: mixtureName,
        source_formula_version_id: sourceFormulaVersionId || null,
        actual_total_weight: new Decimal(actualTotalWeight).toFixed(6),
        weight_uom: weightUom || 'kg',
        remarks: remarks || null,
        created_by: req.user.id,
      }).then(res => [res[0]]);

      for (const mat of materials) {
        await trx('perfume_mixture_materials').insert({
          mixture_id: mId,
          material_id: mat.material_id,
          percentage: new Decimal(mat.percentage || '0').toFixed(6),
          actual_quantity: new Decimal(mat.actual_quantity || '0').toFixed(6),
          uom: mat.uom || 'kg',
        });
      }
      return mId;
    });

    await logAudit(req, 'CREATE_PERFUME_MIXTURE', 'PerfumeMixture', mixtureId, null, { mixtureCode, mixtureName });
    return res.status(201).json({ success: true, message: 'Source perfume mixture recorded.', mixtureId });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to record perfume mixture.', error: err.message });
  }
});

// POST /api/v1/perfume-conversions/calculate - Run Mode A or Mode B calculation
router.post('/calculate', authenticateToken, async (req, res) => {
  try {
    const { mixtureId, targetBrandVersionId, mode, specifiedTargetWeight } = req.body;

    if (!mixtureId || !targetBrandVersionId || !mode) {
      return res.status(400).json({ success: false, message: 'Mixture ID, Target Brand Version ID, and Mode are required.' });
    }

    // Fetch mixture details
    const mixture = await db('perfume_mixtures').where({ id: mixtureId }).first();
    if (!mixture) {
      return res.status(404).json({ success: false, message: 'Source perfume mixture not found.' });
    }

    const mixMaterials = await db('perfume_mixture_materials')
      .join('materials', 'perfume_mixture_materials.material_id', 'materials.id')
      .where('perfume_mixture_materials.mixture_id', mixtureId)
      .select('perfume_mixture_materials.*', 'materials.name', 'materials.code');
    mixture.materials = mixMaterials;

    // Fetch target brand formula version details
    const targetVersion = await db('formula_versions').where({ id: targetBrandVersionId }).first();
    if (!targetVersion) {
      return res.status(404).json({ success: false, message: 'Target Brand Formula Version not found.' });
    }

    const targetMaterials = await db('formula_version_materials')
      .leftJoin('materials', 'formula_version_materials.material_id', 'materials.id')
      .where('formula_version_materials.version_id', targetBrandVersionId)
      .select('formula_version_materials.*', 'materials.name', 'materials.code');
    targetVersion.materials = targetMaterials;

    const result = calculatePerfumeConversion(mixture, targetVersion, mode, specifiedTargetWeight);
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

// POST /api/v1/perfume-conversions - Save conversion record (DRAFT, CALCULATED, or INFEASIBLE)
router.post('/', authenticateToken, requireRoles('Super Admin', 'Formulator'), async (req, res) => {
  try {
    const { mixtureId, targetBrandVersionId, mode, specifiedTargetWeight } = req.body;

    const mixture = await db('perfume_mixtures').where({ id: mixtureId }).first();
    const mixMaterials = await db('perfume_mixture_materials')
      .join('materials', 'perfume_mixture_materials.material_id', 'materials.id')
      .where('perfume_mixture_materials.mixture_id', mixtureId)
      .select('perfume_mixture_materials.*', 'materials.name', 'materials.code');
    mixture.materials = mixMaterials;

    const targetVersion = await db('formula_versions').where({ id: targetBrandVersionId }).first();
    const targetMaterials = await db('formula_version_materials')
      .leftJoin('materials', 'formula_version_materials.material_id', 'materials.id')
      .where('formula_version_materials.version_id', targetBrandVersionId)
      .select('formula_version_materials.*', 'materials.name', 'materials.code');
    targetVersion.materials = targetMaterials;

    const calc = calculatePerfumeConversion(mixture, targetVersion, mode, specifiedTargetWeight);

    const [conversionId] = await db.transaction(async trx => {
      const [cId] = await trx('perfume_conversions').insert({
        mixture_id: mixtureId,
        target_brand_version_id: targetBrandVersionId,
        mode: calc.mode,
        initial_weight: calc.initial_weight,
        final_target_weight: calc.final_target_weight,
        min_feasible_weight: calc.min_feasible_weight,
        conversion_status: calc.conversion_status,
        is_feasible: calc.is_feasible,
        blocking_warning_text: calc.blocking_warning_text,
        created_by: req.user.id,
      }).then(res => [res[0]]);

      for (const add of calc.additions) {
        await trx('perfume_conversion_additions').insert({
          conversion_id: cId,
          material_id: add.material_id,
          target_percentage: add.target_percentage,
          existing_amount: add.existing_amount,
          target_amount: add.target_amount,
          required_addition: add.required_addition,
        });
      }
      return cId;
    });

    await logAudit(req, 'SAVE_PERFUME_CONVERSION', 'PerfumeConversion', conversionId, null, { status: calc.conversion_status, is_feasible: calc.is_feasible });
    return res.status(201).json({ success: true, message: 'Perfume conversion calculation saved.', conversionId, calculation: calc });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to save perfume conversion.', error: err.message });
  }
});

// POST /api/v1/perfume-conversions/:id/complete - Complete conversion with actual additions
router.post('/:id/complete', authenticateToken, requireRoles('Super Admin', 'Formulator'), async (req, res) => {
  try {
    const { id } = req.params;
    const { actualAdditions } = req.body; // Array of { material_id, actual_addition }

    const conversion = await db('perfume_conversions').where({ id }).first();
    if (!conversion) {
      return res.status(404).json({ success: false, message: 'Perfume conversion record not found.' });
    }

    if (!conversion.is_feasible) {
      return res.status(400).json({
        success: false,
        message: 'Cannot complete an INFEASIBLE conversion. Reformulation or auto-minimum weight calculation is required.',
      });
    }

    const dbAdditions = await db('perfume_conversion_additions')
      .join('materials', 'perfume_conversion_additions.material_id', 'materials.id')
      .where({ conversion_id: id })
      .select('perfume_conversion_additions.*', 'materials.name as material_name', 'materials.code as material_code');

    const conversionRecord = {
      is_feasible: conversion.is_feasible,
      initial_weight: conversion.initial_weight,
      additions: dbAdditions,
    };

    const completion = completePerfumeConversion(conversionRecord, actualAdditions);

    await db.transaction(async trx => {
      await trx('perfume_conversions').where({ id }).update({
        actual_final_weight: completion.actual_actual_final_weight || completion.actual_final_weight,
        actual_final_composition_snapshot: completion.actual_final_composition_snapshot,
        conversion_status: 'COMPLETED',
        completed_by: req.user.id,
        completed_at: trx.fn.now(),
        updated_at: trx.fn.now(),
      });

      for (const updatedAdd of completion.updated_additions) {
        await trx('perfume_conversion_additions')
          .where({ conversion_id: id, material_id: updatedAdd.material_id })
          .update({
            actual_addition: updatedAdd.actual_addition,
            variance: updatedAdd.variance,
          });
      }
    });

    await logAudit(req, 'COMPLETE_PERFUME_CONVERSION', 'PerfumeConversion', id, null, { status: 'COMPLETED' });
    return res.json({ success: true, message: 'Perfume conversion marked COMPLETED successfully.', data: completion });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

// GET /api/v1/perfume-conversions - List conversion history
router.get('/', authenticateToken, async (req, res) => {
  try {
    const history = await db('perfume_conversions')
      .join('perfume_mixtures', 'perfume_conversions.mixture_id', 'perfume_mixtures.id')
      .join('formula_versions', 'perfume_conversions.target_brand_version_id', 'formula_versions.id')
      .join('formulas', 'formula_versions.formula_id', 'formulas.id')
      .leftJoin('users as c', 'perfume_conversions.created_by', 'c.id')
      .leftJoin('users as cmp', 'perfume_conversions.completed_by', 'cmp.id')
      .select(
        'perfume_conversions.*',
        'perfume_mixtures.mixture_code',
        'perfume_mixtures.mixture_name',
        'formulas.code as target_brand_formula_code',
        'formulas.name as target_brand_formula_name',
        'formula_versions.major_version',
        'formula_versions.minor_version',
        'c.username as created_by_username',
        'cmp.username as completed_by_username'
      )
      .orderBy('perfume_conversions.created_at', 'desc');

    return res.json({ success: true, data: history });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch conversion history.', error: err.message });
  }
});

export default router;
