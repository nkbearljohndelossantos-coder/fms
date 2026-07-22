import express from 'express';
import crypto from 'crypto';
import Decimal from 'decimal.js';
import db from '../db.js';
import { authenticateToken, requirePermission, requireRoles } from '../middleware/auth.js';
import { AuditService } from '../services/AuditService.js';
import { SequenceService } from '../services/SequenceService.js';
import { validateFormulaPercentage, assertVersionIsMutable } from '../services/validationEngine.js';

const router = express.Router();

function calculateFormulaCosting(materials, targetBatchSize = '100.000000') {
  let totalCost = new Decimal(0);
  const batchSizeDec = new Decimal(targetBatchSize);

  const lineCosts = materials.map(m => {
    const pctDec = new Decimal(m.percentage || '0');
    const costPerKg = new Decimal(m.cost || '0');
    const reqWeight = pctDec.div(100).times(batchSizeDec);
    const lineCost = reqWeight.times(costPerKg);

    totalCost = totalCost.plus(lineCost);
    return {
      materialId: m.material_id,
      percentage: pctDec.toFixed(6),
      requiredWeight: reqWeight.toFixed(6),
      costPerKg: costPerKg.toFixed(6),
      lineCost: lineCost.toFixed(6),
    };
  });

  const costPerKg = batchSizeDec.gt(0) ? totalCost.div(batchSizeDec) : new Decimal(0);

  return {
    totalBatchCost: totalCost.toFixed(6),
    costPerKg: costPerKg.toFixed(6),
    lineCosts,
  };
}

async function saveFormulaCostSnapshot(trx, versionId, costingResult) {
  await trx('formula_cost_snapshots').insert({
    version_id: versionId,
    snapshot_data: JSON.stringify(costingResult),
    total_cost: costingResult.totalBatchCost,
    unit_cost: costingResult.costPerKg,
  });
}

// 1. GET /api/v1/formulas
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { category, search } = req.query;

    let query = db('formulas').select('*').orderBy('id', 'desc');

    if (category) {
      query = query.where({ product_category: category });
    }
    if (search) {
      query = query.where(builder => {
        builder.where('code', 'like', `%${search}%`).orWhere('name', 'like', `%${search}%`);
      });
    }

    const formulas = await query;

    if (!formulas || formulas.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const formulaIds = formulas.map(f => f.id);
    const versions = await db('formula_versions')
      .whereIn('formula_id', formulaIds)
      .orderBy('major_version', 'desc')
      .orderBy('minor_version', 'desc');

    const result = formulas.map(f => {
      const fVersions = versions.filter(v => Number(v.formula_id) === Number(f.id));
      const activeVer = fVersions.find(v => v.version_status === 'APPROVED') || fVersions[0] || null;
      return {
        ...f,
        active_version: activeVer ? `${activeVer.major_version ?? 1}.${activeVer.minor_version ?? 0}` : '1.0',
        active_version_id: activeVer?.id || null,
        versions: fVersions.map(v => ({
          id: v.id,
          version: `V${v.major_version ?? 1}.${v.minor_version ?? 0}`,
          major_version: v.major_version ?? 1,
          minor_version: v.minor_version ?? 0,
          version_status: v.version_status || 'DRAFT',
          target_batch_size: v.target_batch_size || '100.00',
          target_batch_uom: v.target_batch_uom || 'g',
          created_at: v.created_at,
        })),
      };
    });

    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch formulas', error: err.message });
  }
});

// 2. GET /api/v1/formulas/versions/:versionId
router.get('/versions/:versionId', authenticateToken, async (req, res) => {
  try {
    const { versionId } = req.params;

    const version = await db('formula_versions').where({ id: versionId }).first();
    if (!version) {
      return res.status(404).json({ success: false, message: 'Formula version not found' });
    }

    const formula = await db('formulas').where({ id: version.formula_id }).first();

    const materials = await db('formula_version_materials')
      .leftJoin('materials', 'formula_version_materials.material_id', 'materials.id')
      .where({ version_id: versionId })
      .select(
        'formula_version_materials.*',
        'materials.code as material_code',
        'materials.name as material_name',
        'materials.cost',
        'materials.currency_code',
        'materials.density_kg_per_l',
        'materials.specific_gravity'
      )
      .orderBy('formula_version_materials.addition_order', 'asc');

    const phases = await db('formula_phases').where({ version_id: versionId }).orderBy('phase_order', 'asc');
    const instructions = await db('formula_instructions').where({ version_id: versionId }).orderBy('step_number', 'asc');

    let categoryDetails = null;
    const cat = formula?.product_category || 'Cosmetic';
    if (cat === 'Cosmetic' || cat === 'Cosmetics') {
      categoryDetails = await db('cosmetic_formula_details').where({ version_id: versionId }).first();
    } else if (cat === 'Perfume No Brand' || cat === 'Perfume Brand' || cat === 'Perfumes') {
      categoryDetails = await db('perfume_formula_details').where({ version_id: versionId }).first();
    } else if (cat === 'Food Supplement' || cat === 'Food Supplements') {
      categoryDetails = await db('supplement_formula_details').where({ version_id: versionId }).first();
    }

    const costing = calculateFormulaCosting(materials, version.target_batch_size);
    const valResult = validateFormulaPercentage(materials);

    return res.json({
      success: true,
      data: {
        formula: formula || { id: version.formula_id, name: 'Formula', product_category: 'Cosmetic' },
        version,
        materials,
        phases,
        instructions,
        categoryDetails,
        costing,
        validation: valResult,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch formula version', error: err.message });
  }
});

// PUT /api/v1/formulas/versions/:versionId (Save draft version composition & specs)
router.put('/versions/:versionId', authenticateToken, async (req, res) => {
  try {
    const { versionId } = req.params;
    const { materials, categoryDetails } = req.body;

    const version = await db('formula_versions').where({ id: versionId }).first();
    if (!version) {
      return res.status(404).json({ success: false, message: 'Formula version not found' });
    }

    if (version.version_status === 'APPROVED' || version.version_status === 'SUPERSEDED' || version.version_status === 'REJECTED' || version.version_status === 'LOCKED') {
      return res.status(422).json({
        success: false,
        message: `Formula Version V${version.major_version}.${version.minor_version} is ${version.version_status} and locked as read-only. Create a new draft revision to modify.`,
      });
    }

    await db.transaction(async (trx) => {
      // 1. Resolve and create formula phases dynamically based on materials phase names
      const existingPhases = await trx('formula_phases').where({ version_id: versionId });
      const phaseMap = {};
      existingPhases.forEach(p => {
        phaseMap[p.phase_name] = p.id;
      });

      const uniquePhaseNames = [...new Set((materials || []).map(m => m.phase_name).filter(Boolean))];
      let order = existingPhases.length ? Math.max(...existingPhases.map(p => p.phase_order)) + 1 : 1;

      for (const pName of uniquePhaseNames) {
        if (!phaseMap[pName]) {
          const [newPhaseId] = await trx('formula_phases').insert({
            version_id: versionId,
            phase_name: pName,
            phase_order: order++,
          }).then(res => [res[0]]);
          phaseMap[pName] = newPhaseId;
        }
      }

      // 2. Fetch unit costs for materials to compute line costs
      const materialIds = (materials || []).map(m => m.material_id);
      const rawMaterials = await trx('materials').whereIn('id', materialIds);
      const materialCostMap = {};
      rawMaterials.forEach(m => {
        materialCostMap[m.id] = new Decimal(m.cost || '0');
      });

      const batchSizeDec = new Decimal(version.target_batch_size || '100.000000');

      // 3. Clear existing material composition rows
      await trx('formula_version_materials').where({ version_id: versionId }).del();

      // 4. Insert resolved composition rows
      if (Array.isArray(materials) && materials.length > 0) {
        const insertMats = materials.map((m, idx) => {
          const pId = phaseMap[m.phase_name] || null;
          const pctDec = new Decimal(m.percentage || '0');
          const costPerG = materialCostMap[m.material_id] || new Decimal(0);
          const reqWeight = pctDec.div(100).times(batchSizeDec);
          const lineCost = reqWeight.times(costPerG);

          return {
            version_id: versionId,
            phase_id: pId,
            material_id: m.material_id,
            material_code_snapshot: m.material_code_snapshot,
            material_name_snapshot: m.material_name_snapshot,
            uom_snapshot: m.uom_snapshot || 'g',
            percentage: pctDec.toFixed(6),
            calculated_quantity: reqWeight.toFixed(6),
            addition_order: m.addition_order || (idx + 1),
            function_name: m.function_name || null,
            temp_c: m.temp_c || null,
            mixing_speed_rpm: m.mixing_speed_rpm || null,
            duration_min: m.duration_min || null,
            line_cost: lineCost.toFixed(6),
          };
        });
        await trx('formula_version_materials').insert(insertMats);
      }

      const formula = await trx('formulas').where({ id: version.formula_id }).first();
      const cat = formula?.product_category || 'Cosmetic';

      if (cat === 'Cosmetic' || cat === 'Cosmetics') {
        const exists = await trx('cosmetic_formula_details').where({ version_id: versionId }).first();
        const detailsPayload = {
          target_ph: categoryDetails?.target_ph || null,
          viscosity_cp: categoryDetails?.viscosity_cp || null,
          appearance: categoryDetails?.appearance || null,
          color: categoryDetails?.color || null,
          odor: categoryDetails?.odor || null,
          texture: categoryDetails?.texture || null,
          preservative_system: categoryDetails?.preservative_system || null,
          manufacturing_conditions: categoryDetails?.manufacturing_conditions || null,
        };

        if (exists) {
          await trx('cosmetic_formula_details').where({ version_id: versionId }).update(detailsPayload);
        } else {
          await trx('cosmetic_formula_details').insert({ version_id: versionId, ...detailsPayload });
        }
      }

      await trx('formula_versions')
        .where({ id: versionId })
        .update({
          updated_at: trx.fn.now(),
        });

      await AuditService.logEvent({
        trx,
        userId: req.user.id,
        userRole: req.user.roles[0] || 'User',
        action: 'UPDATE_FORMULA_VERSION',
        entityType: 'FormulaVersion',
        entityId: versionId,
        newValues: { materials_count: materials?.length || 0 },
      });
    });

    return res.json({ success: true, message: 'Formula draft version updated successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Database operation failed', error: err.message });
  }
});

// 3. GET /api/v1/formulas/:id/revisions
router.get('/:id/revisions', authenticateToken, async (req, res) => {
  try {
    const formulaId = req.params.id;
    const versions = await db('formula_versions')
      .where({ formula_id: formulaId })
      .orderBy('major_version', 'desc')
      .orderBy('minor_version', 'desc');

    return res.json({ success: true, data: versions });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch revisions', error: err.message });
  }
});

// 4. POST /api/v1/formulas/:id/revisions
router.post('/:id/revisions', authenticateToken, async (req, res) => {
  try {
    const formulaId = req.params.id;
    const { revisionReason, parentVersionId } = req.body;

    const formula = await db('formulas').where({ id: formulaId }).first();
    if (!formula) {
      return res.status(404).json({ success: false, message: 'Formula not found.' });
    }

    const sourceVersionId = parentVersionId || (
      await db('formula_versions')
        .where({ formula_id: formulaId })
        .orderBy('major_version', 'desc')
        .orderBy('minor_version', 'desc')
        .first()
    )?.id;

    const parentVer = sourceVersionId ? await db('formula_versions').where({ id: sourceVersionId }).first() : null;

    const nextMajor = (parentVer?.major_version || 1) + 1;
    const nextMinor = 0;

    const result = await db.transaction(async (trx) => {
      const insertVer = {
        formula_id: formulaId,
        major_version: nextMajor,
        minor_version: nextMinor,
        lock_version: 0,
        version_status: 'DRAFT',
        change_type: 'REVISION',
        revision_reason: revisionReason || `Draft revision from Version ${parentVer?.major_version || 1}.${parentVer?.minor_version || 0}`,
        target_batch_size: parentVer?.target_batch_size || '100.000000',
        target_batch_uom: parentVer?.target_batch_uom || 'g',
        expected_yield: '100.000000',
        created_by: req.user.id,
      };

      const [newVersionId] = await trx('formula_versions').insert(insertVer).then(r => [r[0]]);

      if (sourceVersionId) {
        // 1. Copy materials
        const oldMats = await trx('formula_version_materials').where({ version_id: sourceVersionId });
        for (const m of oldMats) {
          const { id, version_id, created_at, updated_at, ...matData } = m;
          await trx('formula_version_materials').insert({
            ...matData,
            version_id: newVersionId,
          });
        }

        // 2. Copy phases
        const oldPhases = await trx('formula_phases').where({ version_id: sourceVersionId });
        for (const p of oldPhases) {
          const { id, version_id, created_at, updated_at, ...phaseData } = p;
          await trx('formula_phases').insert({
            ...phaseData,
            version_id: newVersionId,
          });
        }

        // 3. Copy category details
        const oldCosmetic = await trx('cosmetic_formula_details').where({ version_id: sourceVersionId }).first();
        if (oldCosmetic) {
          const { id, version_id, created_at, updated_at, ...cosData } = oldCosmetic;
          await trx('cosmetic_formula_details').insert({
            ...cosData,
            version_id: newVersionId,
          });
        }

        const oldPerfume = await trx('perfume_formula_details').where({ version_id: sourceVersionId }).first();
        if (oldPerfume) {
          const { id, version_id, created_at, updated_at, ...perfData } = oldPerfume;
          await trx('perfume_formula_details').insert({
            ...perfData,
            version_id: newVersionId,
          });
        }

        const oldSupplement = await trx('supplement_formula_details').where({ version_id: sourceVersionId }).first();
        if (oldSupplement) {
          const { id, version_id, created_at, updated_at, ...suppData } = oldSupplement;
          await trx('supplement_formula_details').insert({
            ...suppData,
            version_id: newVersionId,
          });
        }
      }

      await AuditService.logEvent({
        trx,
        userId: req.user.id,
        userRole: req.user.roles[0] || 'Chemist',
        action: 'CREATE_REVISION',
        entityType: 'FormulaVersion',
        entityId: newVersionId,
        newValues: { formula_id: formulaId, version: `V${nextMajor}.${nextMinor}` },
      });

      return { newVersionId, version: `V${nextMajor}.${nextMinor}` };
    });

    return res.status(201).json({
      success: true,
      message: 'New draft revision created successfully.',
      data: {
        formula_id: String(formulaId),
        version_id: String(result.newVersionId),
        version: result.version,
        version_status: 'DRAFT',
      },
      versionId: result.newVersionId,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to create formula revision.', error: err.message });
  }
});

// 5. GET /api/v1/formulas/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const formula = await db('formulas').where({ id: req.params.id }).first();
    if (!formula) {
      return res.status(404).json({ success: false, message: 'Formula not found' });
    }

    const versions = await db('formula_versions')
      .where({ formula_id: formula.id })
      .orderBy('major_version', 'desc')
      .orderBy('minor_version', 'desc');

    return res.json({
      success: true,
      data: {
        ...formula,
        versions,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch formula details', error: err.message });
  }
});

// 6. POST /api/v1/formulas (Create master formula & initial v1.0 draft - STRICT MYSQL COMPATIBLE)
router.post('/', authenticateToken, requirePermission('formula.create'), async (req, res) => {
  try {
    const { name, category, formula_type, product_category, product_subcategory, brand_type, reference_batch_size, batchSize = '100.000000', batchUom = 'g', revisionReason = 'Initial creation' } = req.body;

    const formulaName = name || 'New Formula';
    const rawCategory = category || formula_type || product_category || 'Cosmetic';

    const allowedCategories = ['Cosmetic', 'Perfume No Brand', 'Perfume Brand', 'Food Supplement'];
    const normalizedCategory = allowedCategories.find(c => c.toLowerCase() === rawCategory.toLowerCase()) || 'Cosmetic';

    const targetBatchSize = reference_batch_size || batchSize || '100.000000';

    const txResult = await db.transaction(async (trx) => {
      const code = await SequenceService.getNextSequence('FORMULA_CODE', trx);

      const insertFormula = {
        code,
        name: formulaName,
        product_category: normalizedCategory,
        status: 'ACTIVE',
        owner_id: req.user?.id || null,
      };

      if (product_subcategory) insertFormula.product_subcategory = product_subcategory;
      if (brand_type) insertFormula.brand_type = brand_type;

      const [formulaId] = await trx('formulas').insert(insertFormula).then(res => [res[0]]);

      const insertVersion = {
        formula_id: formulaId,
        major_version: 1,
        minor_version: 0,
        lock_version: 0,
        version_status: 'DRAFT',
        change_type: 'INITIAL_CREATION',
        revision_reason: revisionReason,
        target_batch_size: targetBatchSize,
        target_batch_uom: batchUom || 'g',
        expected_yield: '100.000000',
        created_by: req.user?.id || null,
      };

      const [versionId] = await trx('formula_versions').insert(insertVersion).then(res => [res[0]]);

      if (normalizedCategory === 'Cosmetic') {
        await trx('cosmetic_formula_details').insert({ version_id: versionId });
      } else if (normalizedCategory === 'Perfume No Brand' || normalizedCategory === 'Perfume Brand') {
        await trx('perfume_formula_details').insert({
          version_id: versionId,
          concentration_tier: 'Eau de Parfum',
          fragrance_pct: '0.000000',
          alcohol_pct: '0.000000',
          water_pct: '0.000000',
          fixative_pct: '0.000000',
          solubilizer_pct: '0.000000',
        });
      } else if (normalizedCategory === 'Food Supplement') {
        await trx('supplement_formula_details').insert({
          version_id: versionId,
          dosage_form: 'Capsules',
          composition_mode: 'PERCENTAGE',
          serving_size: '1.000000',
          serving_uom: 'serving',
        });
      }

      await AuditService.logEvent({
        trx,
        userId: req.user?.id || 1,
        userRole: req.user?.roles?.[0] || 'Chemist',
        action: 'CREATE_FORMULA',
        entityType: 'Formula',
        entityId: formulaId,
        newValues: { code, name: formulaName, category: normalizedCategory },
      });

      return { formulaId, versionId, code };
    });

    return res.status(201).json({
      success: true,
      message: 'Formula created successfully',
      data: {
        formula_id: String(txResult.formulaId),
        version_id: String(txResult.versionId),
        code: txResult.code,
        version: '1.0',
        version_status: 'DRAFT',
      },
      formulaId: txResult.formulaId,
      versionId: txResult.versionId,
    });
  } catch (err) {
    console.error('Create Formula Error:', err);
    return res.status(500).json({ success: false, message: 'Database operation failed', error: err.message });
  }
});

// 7. POST /api/v1/formulas/versions/:versionId/workflow
router.post('/versions/:versionId/workflow', authenticateToken, async (req, res) => {
  try {
    const { versionId } = req.params;
    const { action, comments } = req.body;

    const version = await db('formula_versions').where({ id: versionId }).first();
    if (!version) {
      return res.status(404).json({ success: false, message: 'Formula version not found.' });
    }

    if ((version.version_status === 'APPROVED' || version.version_status === 'LOCKED') && action !== 'REJECT') {
      return res.status(422).json({
        success: false,
        message: 'Approved and locked formula versions are immutable. Changes require creating a new formula version.',
      });
    }

    let targetStatus;
    if (action === 'SUBMIT') targetStatus = 'UNDER_REVIEW';
    else if (action === 'RETURN') targetStatus = 'DRAFT';
    else if (action === 'ENDORSE') targetStatus = 'FOR_APPROVAL';
    else if (action === 'APPROVE') targetStatus = 'APPROVED';
    else if (action === 'REJECT') targetStatus = 'REJECTED';
    else return res.status(400).json({ success: false, message: 'Invalid workflow action.' });

    // MAKER-CHECKER SEPARATION ENFORCEMENT
    if (action === 'APPROVE') {
      if (!req.user.permissions?.includes('formula.approve') && !req.user.roles?.includes('Super Admin')) {
        return res.status(403).json({ success: false, message: 'Forbidden. formula.approve permission required.' });
      }

      if (Number(version.created_by) === Number(req.user.id)) {
        return res.status(422).json({
          success: false,
          message: 'Maker-Checker policy violation: The user who created the formula version cannot approve it.',
        });
      }

      const submitRecord = await db('formula_workflow_records')
        .where({ version_id: versionId, action: 'SUBMIT' })
        .orderBy('id', 'desc')
        .first();

      if (submitRecord && Number(submitRecord.actor_id) === Number(req.user.id)) {
        return res.status(422).json({
          success: false,
          message: 'Maker-Checker policy violation: The user who submitted the formula version cannot approve it.',
        });
      }
    }

    const formula = await db('formulas').where({ id: version.formula_id }).first();
    const materials = await db('formula_version_materials')
      .leftJoin('materials', 'formula_version_materials.material_id', 'materials.id')
      .where({ version_id: versionId })
      .select('formula_version_materials.*', 'materials.cost', 'materials.currency_code');

    if (targetStatus === 'UNDER_REVIEW' || targetStatus === 'FOR_APPROVAL' || targetStatus === 'APPROVED') {
      const valResult = validateFormulaPercentage(materials, '0.010000');
      if (!valResult.isValid) {
        return res.status(422).json({ success: false, message: `Workflow validation failed: ${valResult.message}` });
      }
    }

    await db.transaction(async trx => {
      const updatePayload = {
        version_status: targetStatus,
        updated_at: trx.fn.now(),
      };

      if (action === 'APPROVE') {
        updatePayload.approved_by = req.user.id;
        updatePayload.approval_timestamp = trx.fn.now();
        updatePayload.effective_date = trx.fn.now();

        await trx('formula_versions')
          .where({ formula_id: formula.id, version_status: 'APPROVED' })
          .andWhereNot({ id: versionId })
          .update({ version_status: 'SUPERSEDED', updated_at: trx.fn.now() });

        const costingResult = calculateFormulaCosting(materials, version.target_batch_size);
        await saveFormulaCostSnapshot(trx, versionId, costingResult);

        // AUTOMATICALLY CREATE PRODUCTION BATCH ON APPROVAL
        const batchNumber = await SequenceService.getNextSequence('BATCH_NUMBER', trx);
        const batchSizeDec = new Decimal(version.target_batch_size || '100.000000');

        const phases = await trx('formula_phases').where({ version_id: versionId }).orderBy('phase_order', 'asc');
        const versionMaterials = await trx('formula_version_materials').where({ version_id: versionId }).orderBy('addition_order', 'asc');
        let versionInstructions = await trx('formula_instructions').where({ version_id: versionId }).orderBy('step_number', 'asc');

        if (versionInstructions.length === 0) {
          versionInstructions = versionMaterials.map((m, idx) => ({
            id: `virtual-${m.id}`,
            phase_id: m.phase_id,
            material_id: m.material_id,
            step_number: idx + 1,
            instruction_text: `Weigh and add ${m.material_name_snapshot} (${m.percentage}% w/w) to the mix. Temp: ${m.temp_c || 'N/A'}°C, Mixing Speed: ${m.mixing_speed_rpm || 'N/A'} RPM, Duration: ${m.duration_min || 'N/A'} min.`,
          }));
        }

        const snapshotPayload = JSON.stringify({
          formulaCode: formula.code,
          version: `${version.major_version}.${version.minor_version}`,
          targetBatchSize: batchSizeDec.toFixed(6),
          materials: versionMaterials.map(m => ({ code: m.material_code_snapshot, pct: m.percentage })),
          instructions: versionInstructions.map(i => i.instruction_text),
        });
        const snapshotHash = crypto.createHash('sha256').update(snapshotPayload).digest('hex');

        const [batchId] = await trx('production_batches').insert({
          batch_number: batchNumber,
          formula_id: formula.id,
          formula_version_id: version.id,
          category: formula.product_category,
          status: 'Assigned',
          target_batch_size: batchSizeDec.toFixed(6),
          snapshot_hash: snapshotHash,
          lock_version: 1,
          assigned_operator_id: null,
          assigned_machine_id: null,
          created_by: req.user.id,
        }).then(r => [r[0]]);

        const phaseIdMap = {};
        for (const p of phases) {
          const [bpId] = await trx('batch_phases').insert({
            batch_id: batchId,
            phase_letter: String.fromCharCode(64 + p.phase_order),
            phase_name: p.phase_name,
            sequence: p.phase_order,
            status: 'Waiting',
          }).then(r => [r[0]]);
          phaseIdMap[p.id] = bpId;
        }

        for (let i = 0; i < versionInstructions.length; i++) {
          const inst = versionInstructions[i];
          const bpId = phaseIdMap[inst.phase_id] || (Object.values(phaseIdMap)[0] || null);

          const [bsId] = await trx('batch_steps').insert({
            batch_id: batchId,
            batch_phase_id: bpId,
            step_number: inst.step_number || (i + 1),
            instructions: inst.instruction_text,
            status: 'Pending',
            lock_version: 1,
          }).then(r => [r[0]]);

          const mat = versionMaterials.find(m => m.id === inst.material_id || m.material_id === inst.material_id) || versionMaterials[i];
          if (mat) {
            const pctDec = new Decimal(mat.percentage || '0');
            const targetWeightDec = pctDec.div(100).times(batchSizeDec);
            const tolPctDec = new Decimal(mat.tolerance_percent || '1.000000');
            const tolWeight = targetWeightDec.times(tolPctDec.div(100));

            await trx('batch_material_requirements').insert({
              batch_id: batchId,
              step_id: bsId,
              material_id: mat.material_id,
              material_code: mat.material_code_snapshot,
              material_name: mat.material_name_snapshot,
              percentage: pctDec.toFixed(6),
              target_weight: targetWeightDec.toFixed(6),
              tolerance_percent: tolPctDec.toFixed(6),
              min_weight: targetWeightDec.minus(tolWeight).toFixed(6),
              max_weight: targetWeightDec.plus(tolWeight).toFixed(6),
            });
          }
        }

        const rawQrToken = crypto.randomBytes(32).toString('hex');
        const qrHash = crypto.createHash('sha256').update(rawQrToken).digest('hex');
        const qrExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        await trx('qr_tokens').insert({
          token_hash: qrHash,
          batch_id: batchId,
          formula_version_id: version.id,
          is_single_use: false,
          expires_at: qrExpiresAt,
        });

        await AuditService.logEvent({
          trx,
          userId: req.user.id,
          userRole: req.user.roles[0] || 'User',
          action: 'CREATE_PRODUCTION_BATCH',
          entityType: 'ProductionBatch',
          entityId: batchId,
          newValues: { batchNumber, targetBatchSize: batchSizeDec.toFixed(6), snapshotHash },
        });
      }

      await trx('formula_versions').where({ id: versionId }).update(updatePayload);

      await trx('formula_workflow_records').insert({
        version_id: versionId,
        action,
        from_status: version.version_status,
        to_status: targetStatus,
        actor_id: req.user.id,
        comments: comments || null,
      });

      await AuditService.logEvent({
        trx,
        userId: req.user.id,
        userRole: req.user.roles[0] || 'User',
        action: `FORMULA_${action}`,
        entityType: 'FormulaVersion',
        entityId: versionId,
        oldValues: { status: version.version_status },
        newValues: { status: targetStatus },
      });
    });

    return res.json({ success: true, message: `Formula version successfully transitioned to ${targetStatus}` });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

// 8. POST /api/v1/formulas/versions/:versionId/create-batch
router.post('/versions/:versionId/create-batch', authenticateToken, async (req, res) => {
  try {
    const { versionId } = req.params;
    const { targetBatchSize, assignedOperatorId, assignedMachineId } = req.body;

    const version = await db('formula_versions').where({ id: versionId }).first();
    if (!version) {
      return res.status(404).json({ success: false, message: 'Formula version not found.' });
    }

    if (version.version_status !== 'APPROVED' && version.version_status !== 'LOCKED') {
      return res.status(422).json({
        success: false,
        message: 'Production batches can only be generated from Approved or Locked formula versions.',
      });
    }

    const formula = await db('formulas').where({ id: version.formula_id }).first();
    const batchSizeDec = new Decimal(targetBatchSize || version.target_batch_size);

    const phases = await db('formula_phases').where({ version_id: versionId }).orderBy('phase_order', 'asc');
    const materials = await db('formula_version_materials').where({ version_id: versionId }).orderBy('addition_order', 'asc');
    let instructions = await db('formula_instructions').where({ version_id: versionId }).orderBy('step_number', 'asc');

    if (instructions.length === 0) {
      instructions = materials.map((m, idx) => ({
        id: `virtual-${m.id}`,
        phase_id: m.phase_id,
        material_id: m.material_id,
        step_number: idx + 1,
        instruction_text: `Weigh and add ${m.material_name_snapshot} (${m.percentage}% w/w) to the mix. Temp: ${m.temp_c || 'N/A'}°C, Mixing Speed: ${m.mixing_speed_rpm || 'N/A'} RPM, Duration: ${m.duration_min || 'N/A'} min.`,
      }));
    }

    const result = await db.transaction(async (trx) => {
      const batchNumber = await SequenceService.getNextSequence('BATCH_NUMBER', trx);

      const snapshotPayload = JSON.stringify({
        formulaCode: formula.code,
        version: `${version.major_version}.${version.minor_version}`,
        targetBatchSize: batchSizeDec.toFixed(6),
        materials: materials.map(m => ({ code: m.material_code_snapshot, pct: m.percentage })),
        instructions: instructions.map(i => i.instruction_text),
      });
      const snapshotHash = crypto.createHash('sha256').update(snapshotPayload).digest('hex');

      const [batchId] = await trx('production_batches').insert({
        batch_number: batchNumber,
        formula_id: formula.id,
        formula_version_id: version.id,
        category: formula.product_category,
        status: 'Assigned',
        target_batch_size: batchSizeDec.toFixed(6),
        snapshot_hash: snapshotHash,
        lock_version: 1,
        assigned_operator_id: assignedOperatorId || null,
        assigned_machine_id: assignedMachineId || null,
        created_by: req.user.id,
      }).then(r => [r[0]]);

      const phaseIdMap = {};
      for (const p of phases) {
        const [bpId] = await trx('batch_phases').insert({
          batch_id: batchId,
          phase_letter: String.fromCharCode(64 + p.phase_order),
          phase_name: p.phase_name,
          sequence: p.phase_order,
          status: 'Waiting',
        }).then(r => [r[0]]);
        phaseIdMap[p.id] = bpId;
      }

      for (let i = 0; i < instructions.length; i++) {
        const inst = instructions[i];
        const bpId = phaseIdMap[inst.phase_id] || (Object.values(phaseIdMap)[0] || null);

        const [bsId] = await trx('batch_steps').insert({
          batch_id: batchId,
          batch_phase_id: bpId,
          step_number: inst.step_number || (i + 1),
          instructions: inst.instruction_text,
          status: 'Pending',
          lock_version: 1,
        }).then(r => [r[0]]);

        const mat = materials.find(m => m.id === inst.material_id || m.material_id === inst.material_id) || materials[i];
        if (mat) {
          const pctDec = new Decimal(mat.percentage || '0');
          const targetWeightDec = pctDec.div(100).times(batchSizeDec);
          const tolPctDec = new Decimal(mat.tolerance_percent || '1.000000');
          const tolWeight = targetWeightDec.times(tolPctDec.div(100));

          await trx('batch_material_requirements').insert({
            batch_id: batchId,
            step_id: bsId,
            material_id: mat.material_id,
            material_code: mat.material_code_snapshot,
            material_name: mat.material_name_snapshot,
            percentage: pctDec.toFixed(6),
            target_weight: targetWeightDec.toFixed(6),
            tolerance_percent: tolPctDec.toFixed(6),
            min_weight: targetWeightDec.minus(tolWeight).toFixed(6),
            max_weight: targetWeightDec.plus(tolWeight).toFixed(6),
          });
        }
      }

      const rawQrToken = crypto.randomBytes(32).toString('hex');
      const qrHash = crypto.createHash('sha256').update(rawQrToken).digest('hex');
      const qrExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await trx('qr_tokens').insert({
        token_hash: qrHash,
        batch_id: batchId,
        formula_version_id: version.id,
        is_single_use: false,
        expires_at: qrExpiresAt,
      });

      await AuditService.logEvent({
        trx,
        userId: req.user.id,
        userRole: req.user.roles[0] || 'User',
        action: 'CREATE_PRODUCTION_BATCH',
        entityType: 'ProductionBatch',
        entityId: batchId,
        newValues: { batchNumber, targetBatchSize: batchSizeDec.toFixed(6), snapshotHash },
      });

      return {
        batchId,
        batchNumber,
        snapshotHash,
        qrToken: rawQrToken,
      };
    });

    return res.status(201).json({
      success: true,
      message: `Production batch ${result.batchNumber} created with relational snapshot.`,
      batchId: result.batchId,
      batchNumber: result.batchNumber,
      snapshotHash: result.snapshotHash,
      qrToken: result.qrToken,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Batch creation failed', error: err.message });
  }
});

export default router;
