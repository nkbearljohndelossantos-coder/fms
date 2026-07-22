import { express } from '../cjsRequire.js';
import Decimal from 'decimal.js';
import crypto from 'crypto';
import db from '../db.js';
import { authenticateToken, requireRoles, requirePermission } from '../middleware/auth.js';
import { AuditService } from '../services/AuditService.js';
import { SequenceService } from '../services/SequenceService.js';
import { validateFormulaPercentage, assertVersionIsMutable, validateWorkflowTransition } from '../services/validationEngine.js';
import { calculateSupplementDosage } from '../services/supplementEngine.js';
import { calculateFormulaCosting, saveFormulaCostSnapshot } from '../services/formulaCostingService.js';

const router = express.Router();

// GET /api/v1/formulas - List Formulas
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { category, search, status } = req.query;

    const query = db('formulas')
      .leftJoin('users', 'formulas.owner_id', 'users.id')
      .select('formulas.*', 'users.first_name as owner_first_name', 'users.last_name as owner_last_name');

    if (category) {
      query.andWhere('formulas.product_category', category);
    }
    if (status) {
      query.andWhere('formulas.status', status);
    }
    if (search) {
      query.andWhere(b => {
        b.where('formulas.name', 'like', `%${search}%`)
         .orWhere('formulas.code', 'like', `%${search}%`);
      });
    }

    const formulas = await query.orderBy('formulas.updated_at', 'desc');

    for (const f of formulas) {
      const versions = await db('formula_versions')
        .where({ formula_id: f.id })
        .select('id', 'major_version', 'minor_version', 'version_status', 'created_at', 'effective_date')
        .orderBy('created_at', 'desc');

      f.versions = versions;
      f.latest_version = versions[0] || null;
      f.approved_version = versions.find(v => v.version_status === 'APPROVED') || null;
    }

    return res.json({ success: true, data: formulas });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch formulas.', error: err.message });
  }
});

// GET /api/v1/formulas/versions/:versionId - Get Full Version Detail
router.get('/versions/:versionId', authenticateToken, async (req, res) => {
  try {
    const { versionId } = req.params;

    const version = await db('formula_versions')
      .join('formulas', 'formula_versions.formula_id', 'formulas.id')
      .leftJoin('users as c', 'formula_versions.created_by', 'c.id')
      .leftJoin('users as r', 'formula_versions.reviewed_by', 'r.id')
      .leftJoin('users as a', 'formula_versions.approved_by', 'a.id')
      .where('formula_versions.id', versionId)
      .select(
        'formula_versions.*',
        'formulas.code as formula_code',
        'formulas.name as formula_name',
        'formulas.product_category',
        'formulas.product_subcategory',
        'formulas.brand_type',
        'formulas.status as formula_status',
        'formulas.department',
        'c.username as created_by_name',
        'r.username as reviewed_by_name',
        'a.username as approved_by_name'
      )
      .first();

    if (!version) {
      return res.status(404).json({ success: false, message: 'Formula version not found.' });
    }

    const phases = await db('formula_phases').where({ version_id: versionId }).orderBy('phase_order', 'asc');

    const materials = await db('formula_version_materials')
      .leftJoin('materials', 'formula_version_materials.material_id', 'materials.id')
      .leftJoin('supplement_serving_details', 'formula_version_materials.id', 'supplement_serving_details.version_material_id')
      .where('formula_version_materials.version_id', versionId)
      .select(
        'formula_version_materials.*',
        'materials.cost as current_material_cost',
        'materials.currency_code as current_material_currency',
        'materials.density_kg_per_l',
        'materials.specific_gravity',
        'supplement_serving_details.active_amount_per_serving',
        'supplement_serving_details.active_uom',
        'supplement_serving_details.overage_pct',
        'supplement_serving_details.is_excipient',
        'supplement_serving_details.is_fixed_non_active'
      )
      .orderBy('formula_version_materials.addition_order', 'asc');

    const instructions = await db('formula_instructions').where({ version_id: versionId }).orderBy('step_number', 'asc');

    let categoryDetails = null;
    if (version.product_category === 'Cosmetic') {
      categoryDetails = await db('cosmetic_formula_details').where({ version_id: versionId }).first();
    } else if (version.product_category === 'Perfume No Brand' || version.product_category === 'Perfume Brand') {
      categoryDetails = await db('perfume_formula_details').where({ version_id: versionId }).first();
    } else if (version.product_category === 'Food Supplement') {
      categoryDetails = await db('supplement_formula_details').where({ version_id: versionId }).first();
    }

    const costSnapshot = await db('formula_cost_snapshots').where({ version_id: versionId }).first();
    let snapshotItems = [];
    if (costSnapshot) {
      snapshotItems = await db('formula_cost_snapshot_items').where({ snapshot_id: costSnapshot.id });
    }

    const workflowHistory = await db('formula_workflow_records')
      .leftJoin('users', 'formula_workflow_records.actor_id', 'users.id')
      .where('formula_workflow_records.version_id', versionId)
      .select('formula_workflow_records.*', 'users.first_name', 'users.last_name', 'users.username')
      .orderBy('formula_workflow_records.created_at', 'desc');

    return res.json({
      success: true,
      data: {
        version,
        phases,
        materials,
        instructions,
        categoryDetails,
        costSnapshot,
        snapshotItems,
        workflowHistory,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch version detail.', error: err.message });
  }
});

// POST /api/v1/formulas - Create new Formula master & initial v1.0 draft
router.post('/', authenticateToken, requirePermission('formula.create'), async (req, res) => {
  try {
    const rawName = req.body.name || req.body.formula_name;
    const rawType = req.body.formula_type || req.body.formulaType || req.body.productCategory || req.body.product_category;
    const productSubcategory = req.body.productSubcategory || req.body.product_subcategory || null;
    const brandType = req.body.brandType || req.body.brand_type || null;
    const rawBatchSize = req.body.targetBatchSize ?? req.body.target_batch_size ?? req.body.referenceBatchSize ?? req.body.reference_batch_size;
    const batchUom = req.body.targetBatchUom || req.body.target_batch_uom || req.body.referenceBatchUom || req.body.reference_batch_uom || 'kg';
    const revisionReason = req.body.revisionReason || req.body.revision_reason || 'Initial formula creation';

    if (!rawName || typeof rawName !== 'string' || !rawName.trim()) {
      return res.status(400).json({ success: false, message: 'Formula name is required' });
    }
    const name = rawName.trim();

    let normalizedCategory = null;
    const typeUpper = String(rawType || '').toUpperCase();
    if (typeUpper === 'COSMETIC' || rawType === 'Cosmetic') normalizedCategory = 'Cosmetic';
    else if (typeUpper === 'PERFUME_NO_BRAND' || typeUpper === 'PERFUME - NO BRAND' || rawType === 'Perfume No Brand') normalizedCategory = 'Perfume No Brand';
    else if (typeUpper === 'PERFUME_BRAND' || typeUpper === 'PERFUME - BRAND' || rawType === 'Perfume Brand') normalizedCategory = 'Perfume Brand';
    else if (typeUpper === 'FOOD_SUPPLEMENT' || typeUpper === 'FOOD SUPPLEMENT' || rawType === 'Food Supplement') normalizedCategory = 'Food Supplement';
    else return res.status(400).json({ success: false, message: 'Invalid formula type' });

    let batchSize = '1.000000';
    if (rawBatchSize !== undefined && rawBatchSize !== null && rawBatchSize !== '') {
      const numSize = Number(rawBatchSize);
      if (isNaN(numSize) || numSize <= 0) {
        return res.status(400).json({ success: false, message: 'Reference batch size must be greater than zero' });
      }
      batchSize = new Decimal(numSize).toFixed(6);
    }

    const txResult = await db.transaction(async (trx) => {
      // Atomic Sequence Code Generator
      const code = await SequenceService.getNextSequence('FORMULA_CODE', trx);

      const insertFormula = {
        code,
        name,
        product_category: normalizedCategory,
        product_subcategory: productSubcategory,
        brand_type: brandType,
        status: 'ACTIVE',
        owner_id: req.user.id,
      };

      const [formulaId] = await trx('formulas').insert(insertFormula).then(res => [res[0]]);

      const insertVersion = {
        formula_id: formulaId,
        parent_version_id: null,
        major_version: 1,
        minor_version: 0,
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

// POST /api/v1/formulas/versions/:versionId/workflow (Submit, Return, Endorse, Approve, Reject with Maker-Checker)
router.post('/versions/:versionId/workflow', authenticateToken, async (req, res) => {
  try {
    const { versionId } = req.params;
    const { action, comments } = req.body;

    const version = await db('formula_versions').where({ id: versionId }).first();
    if (!version) {
      return res.status(404).json({ success: false, message: 'Formula version not found.' });
    }

    // Read-only check: Approved and locked formula versions are immutable
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
        .orderBy('created_at', 'desc')
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

    // Composition 100% total validation
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

// POST /api/v1/formulas/versions/:versionId/create-batch (Generate Atomic Relational Batch Snapshot)
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
      // 1. Concurrency-safe Batch Number
      const batchNumber = await SequenceService.getNextSequence('BATCH_NUMBER', trx);

      // 2. Compute canonical snapshot hash
      const snapshotPayload = JSON.stringify({
        formulaCode: formula.code,
        version: `${version.major_version}.${version.minor_version}`,
        targetBatchSize: batchSizeDec.toFixed(6),
        materials: materials.map(m => ({ code: m.material_code_snapshot, pct: m.percentage })),
        instructions: instructions.map(i => i.instruction_text),
      });
      const snapshotHash = crypto.createHash('sha256').update(snapshotPayload).digest('hex');

      // 3. Create production_batches master
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

      // 4. Create batch_phases
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

      // 5. Create batch_steps & batch_material_requirements (Planned Snapshot)
      for (let i = 0; i < instructions.length; i++) {
        const inst = instructions[i];
        const [stepId] = await trx('batch_steps').insert({
          batch_id: batchId,
          phase_id: inst.phase_id ? phaseIdMap[inst.phase_id] : (Object.values(phaseIdMap)[0] || 1),
          step_number: i + 1,
          material_id: null,
          instructions: inst.instruction_text,
          status: 'Pending',
          lock_version: 1,
        }).then(r => [r[0]]);

        // Find associated material for this step if any
        const m = materials[i];
        if (m) {
          const pctDec = new Decimal(m.percentage);
          const targetWtDec = pctDec.div(100).times(batchSizeDec);
          const tolDec = new Decimal('1.000000'); // 1% tolerance
          const minWtDec = targetWtDec.times(new Decimal(1).minus(tolDec.div(100)));
          const maxWtDec = targetWtDec.times(new Decimal(1).plus(tolDec.div(100)));

          await trx('batch_material_requirements').insert({
            batch_id: batchId,
            step_id: stepId,
            material_id: m.material_id,
            material_code: m.material_code_snapshot,
            material_name: m.material_name_snapshot,
            percentage: pctDec.toFixed(6),
            target_weight: targetWtDec.toFixed(6),
            tolerance_percent: tolDec.toFixed(6),
            min_weight: minWtDec.toFixed(6),
            max_weight: maxWtDec.toFixed(6),
          });
        }
      }

      // 6. Tokenized QR code
      const rawQrToken = crypto.randomBytes(32).toString('hex');
      const qrHash = crypto.createHash('sha256').update(rawQrToken).digest('hex');
      const qrExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      await trx('qr_tokens').insert({
        token_hash: qrHash,
        batch_id: batchId,
        formula_version_id: version.id,
        is_single_use: false,
        expires_at: qrExpiresAt,
      });

      // 7. Audit log in same transaction
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
