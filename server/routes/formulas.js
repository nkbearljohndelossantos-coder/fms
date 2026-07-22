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

    const formulaIds = formulas.map(f => f.id);
    const versions = await db('formula_versions')
      .whereIn('formula_id', formulaIds.length ? formulaIds : [0])
      .orderBy('major_version', 'desc')
      .orderBy('minor_version', 'desc');

    const result = formulas.map(f => {
      const fVersions = versions.filter(v => v.formula_id === f.id);
      const activeVer = fVersions.find(v => v.version_status === 'APPROVED') || fVersions[0] || null;
      return {
        ...f,
        active_version: activeVer ? `${activeVer.major_version}.${activeVer.minor_version}` : '1.0',
        active_version_id: activeVer?.id || null,
        versions: fVersions.map(v => ({
          id: v.id,
          version: `${v.major_version}.${v.minor_version}`,
          version_status: v.version_status,
          target_batch_size: v.target_batch_size,
          created_at: v.created_at,
        })),
      };
    });

    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch formulas', error: err.message });
  }
});

// 2. GET /api/v1/formulas/versions/:versionId (SPECIFIC SUB-PATH FIRST)
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
        'materials.physical_form',
        'materials.density_g_cm3'
      )
      .orderBy('formula_version_materials.addition_order', 'asc');

    const phases = await db('formula_phases').where({ version_id: versionId }).orderBy('phase_order', 'asc');
    const instructions = await db('formula_instructions').where({ version_id: versionId }).orderBy('step_number', 'asc');

    let categoryDetails = null;
    if (formula.product_category === 'Cosmetic') {
      categoryDetails = await db('cosmetic_formula_details').where({ version_id: versionId }).first();
    } else if (formula.product_category === 'Perfume No Brand' || formula.product_category === 'Perfume Brand') {
      categoryDetails = await db('perfume_formula_details').where({ version_id: versionId }).first();
    } else if (formula.product_category === 'Food Supplement') {
      categoryDetails = await db('supplement_formula_details').where({ version_id: versionId }).first();
    }

    const costing = calculateFormulaCosting(materials, version.target_batch_size);
    const valResult = validateFormulaPercentage(materials);

    return res.json({
      success: true,
      data: {
        formula,
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

// 3. GET /api/v1/formulas/:id/revisions (SPECIFIC REVISIONS ROUTE BEFORE GENERIC GET /:id)
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

// 4. POST /api/v1/formulas/:id/revisions (CREATE DRAFT REVISION FROM EXISTING FORMULA)
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
        version_code: `V${nextMajor}.${nextMinor}`,
        lock_version: 0,
        version_status: 'DRAFT',
        change_type: 'REVISION',
        revision_reason: revisionReason || `Draft revision from Version ${parentVer?.major_version || 1}.${parentVer?.minor_version || 0}`,
        target_batch_size: parentVer?.target_batch_size || '100.000000',
        target_batch_uom: parentVer?.target_batch_uom || 'kg',
        expected_yield: '100.000000',
        created_by: req.user.id,
      };

      const [newVersionId] = await trx('formula_versions').insert(insertVer).then(r => [r[0]]);

      if (sourceVersionId) {
        const oldMats = await trx('formula_version_materials').where({ version_id: sourceVersionId });
        for (const m of oldMats) {
          await trx('formula_version_materials').insert({
            version_id: newVersionId,
            material_id: m.material_id,
            material_code_snapshot: m.material_code_snapshot,
            material_name_snapshot: m.material_name_snapshot,
            percentage: m.percentage,
            phase_name: m.phase_name,
            addition_order: m.addition_order,
            mixing_speed_rpm: m.mixing_speed_rpm,
            temperature_celsius: m.temperature_celsius,
            mixing_time_minutes: m.mixing_time_minutes,
            tolerance_percent: m.tolerance_percent,
            quality_grade_required: m.quality_grade_required,
            notes: m.notes,
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

// 5. GET /api/v1/formulas/:id (GENERIC PARAMETERIZED ROUTE PLACED AFTER SPECIFIC SUB-PATHS)
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

// 6. POST /api/v1/formulas (Create master formula & initial v1.0 draft)
router.post('/', authenticateToken, requirePermission('formula.create'), async (req, res) => {
  try {
    const { name, category, batchSize = '100.000000', batchUom = 'kg', revisionReason = 'Initial creation' } = req.body;

    if (!name || !category) {
      return res.status(400).json({ success: false, message: 'Formula name and product category are required.' });
    }

    const allowedCategories = ['Cosmetic', 'Perfume No Brand', 'Perfume Brand', 'Food Supplement'];
    const normalizedCategory = allowedCategories.find(c => c.toLowerCase() === category.toLowerCase()) || category;

    const txResult = await db.transaction(async (trx) => {
      const code = await SequenceService.getNextSequence('FORMULA_CODE', trx);

      const [formulaId] = await trx('formulas').insert({
        code,
        name,
        product_category: normalizedCategory,
        is_active: true,
        created_by: req.user.id,
      }).then(res => [res[0]]);

      const insertVersion = {
        formula_id: formulaId,
        major_version: 1,
        minor_version: 0,
        version_code: 'V1.0',
        lock_version: 0,
        version_status: 'DRAFT',
        change_type: 'INITIAL_CREATION',
        revision_reason: revisionReason,
        target_batch_size: batchSize,
        target_batch_uom: batchUom,
        expected_yield: '100.000000',
        created_by: req.user.id,
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
        userId: req.user.id,
        userRole: req.user.roles[0] || 'Chemist',
        action: 'CREATE_FORMULA',
        entityType: 'Formula',
        entityId: formulaId,
        newValues: { code, name, category: normalizedCategory },
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
    const instructions = await db('formula_instructions').where({ version_id: versionId }).orderBy('step_number', 'asc');

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

        const mat = materials.find(m => m.id === inst.material_id) || materials[i];
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
