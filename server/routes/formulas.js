import { express } from '../cjsRequire.js';
import Decimal from 'decimal.js';
import db from '../db.js';
import { authenticateToken, requireRoles, requirePermission } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';
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

    // Phases
    const phases = await db('formula_phases').where({ version_id: versionId }).orderBy('phase_order', 'asc');

    // Materials
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

    // Instructions
    const instructions = await db('formula_instructions').where({ version_id: versionId }).orderBy('step_number', 'asc');

    // Detail specs depending on category
    let categoryDetails = null;
    if (version.product_category === 'Cosmetic') {
      categoryDetails = await db('cosmetic_formula_details').where({ version_id: versionId }).first();
    } else if (version.product_category === 'Perfume No Brand' || version.product_category === 'Perfume Brand') {
      categoryDetails = await db('perfume_formula_details').where({ version_id: versionId }).first();
    } else if (version.product_category === 'Food Supplement') {
      categoryDetails = await db('supplement_formula_details').where({ version_id: versionId }).first();
    }

    // Costing Snapshot (if approved)
    const costSnapshot = await db('formula_cost_snapshots').where({ version_id: versionId }).first();
    let snapshotItems = [];
    if (costSnapshot) {
      snapshotItems = await db('formula_cost_snapshot_items').where({ snapshot_id: costSnapshot.id });
    }

    // Workflow Records History
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

// POST /api/v1/formulas (and /api/formulas) - Create new Formula master & initial v1.0 draft
router.post('/', authenticateToken, requirePermission('formula.create'), async (req, res) => {
  try {
    const rawCode = req.body.code || req.body.formula_code;
    const rawName = req.body.name || req.body.formula_name;
    const rawType = req.body.formula_type || req.body.formulaType || req.body.productCategory || req.body.product_category;
    const productSubcategory = req.body.productSubcategory || req.body.product_subcategory || null;
    const brandType = req.body.brandType || req.body.brand_type || null;
    const rawBatchSize = req.body.targetBatchSize ?? req.body.target_batch_size ?? req.body.referenceBatchSize ?? req.body.reference_batch_size;
    const batchUom = req.body.targetBatchUom || req.body.target_batch_uom || req.body.referenceBatchUom || req.body.reference_batch_uom || 'kg';
    const revisionReason = req.body.revisionReason || req.body.revision_reason || 'Initial formula creation';

    let code = rawCode && typeof rawCode === 'string' && rawCode.trim() ? rawCode.trim() : null;
    if (!code) {
      const countRes = await db('formulas').count('id as cnt').first();
      const nextNum = (countRes && countRes.cnt !== undefined && countRes.cnt !== null ? Number(countRes.cnt) : 0) + 1;
      const year = new Date().getFullYear();
      const pad = String(nextNum).padStart(3, '0');
      code = `COS-${year}-${pad}`;
    }

    if (!rawName || typeof rawName !== 'string' || !rawName.trim()) {
      return res.status(400).json({ success: false, message: 'Formula name is required' });
    }

    const name = rawName.trim();

    // Map type enum
    let normalizedCategory = null;
    if (!rawType) {
      return res.status(400).json({ success: false, message: 'Invalid formula type' });
    }

    const typeUpper = String(rawType).toUpperCase();
    if (typeUpper === 'COSMETIC' || rawType === 'Cosmetic') {
      normalizedCategory = 'Cosmetic';
    } else if (typeUpper === 'PERFUME_NO_BRAND' || typeUpper === 'PERFUME - NO BRAND' || rawType === 'Perfume No Brand') {
      normalizedCategory = 'Perfume No Brand';
    } else if (typeUpper === 'PERFUME_BRAND' || typeUpper === 'PERFUME - BRAND' || rawType === 'Perfume Brand') {
      normalizedCategory = 'Perfume Brand';
    } else if (typeUpper === 'FOOD_SUPPLEMENT' || typeUpper === 'FOOD SUPPLEMENT' || rawType === 'Food Supplement') {
      normalizedCategory = 'Food Supplement';
    } else {
      return res.status(400).json({ success: false, message: 'Invalid formula type' });
    }

    let batchSize = '1.000000';
    if (rawBatchSize !== undefined && rawBatchSize !== null && rawBatchSize !== '') {
      const numSize = Number(rawBatchSize);
      if (isNaN(numSize) || numSize <= 0) {
        return res.status(400).json({ success: false, message: 'Reference batch size must be greater than zero' });
      }
      batchSize = new Decimal(numSize).toFixed(6);
    }

    // Uniqueness check
    const existing = await db('formulas').where({ code }).first();
    if (existing) {
      return res.status(409).json({ success: false, message: 'Formula code already exists' });
    }

    // Execute Knex transaction
    const txResult = await db.transaction(async (trx) => {
      const insertFormula = {
        code,
        name,
        product_category: normalizedCategory,
        product_subcategory: productSubcategory,
        brand_type: brandType,
        status: 'ACTIVE',
        owner_id: req.user.id,
      };

      const formulaResult = await trx('formulas').insert(insertFormula);
      const formulaId = Array.isArray(formulaResult) ? formulaResult[0] : (formulaResult.id || formulaResult);

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

      const versionResult = await trx('formula_versions').insert(insertVersion);
      const versionId = Array.isArray(versionResult) ? versionResult[0] : (versionResult.id || versionResult);

      // Insert category details if applicable
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

      return { formulaId, versionId };
    });

    await logAudit(req, 'CREATE_FORMULA', 'Formula', txResult.formulaId, null, { code, name, category: normalizedCategory });

    return res.status(201).json({
      success: true,
      message: 'Formula created successfully',
      data: {
        formula_id: String(txResult.formulaId),
        version_id: String(txResult.versionId),
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

// POST /api/v1/formulas/:id/revisions - Create new revision draft from an existing version
router.post('/:id/revisions', authenticateToken, requireRoles('Super Admin', 'Formulator'), async (req, res) => {
  try {
    const { id } = req.params;
    const { parentVersionId, revisionReason, changeType } = req.body;

    const parentVersion = await db('formula_versions').where({ id: parentVersionId, formula_id: id }).first();
    if (!parentVersion) {
      return res.status(404).json({ success: false, message: 'Parent formula version not found.' });
    }

    // Determine next version number (e.g. 1.0 -> 1.1) based on MAX minor version
    const maxVer = await db('formula_versions')
      .where({ formula_id: id, major_version: parentVersion.major_version })
      .max('minor_version as max_minor')
      .first();

    const nextMinor = (maxVer && maxVer.max_minor !== null && maxVer.max_minor !== undefined ? Number(maxVer.max_minor) : parentVersion.minor_version) + 1;
    const nextMajor = parentVersion.major_version;

    const insertRes = await db('formula_versions').insert({
      formula_id: id,
      parent_version_id: parentVersion.id,
      major_version: nextMajor,
      minor_version: nextMinor,
      lock_version: 0,
      version_status: 'DRAFT',
      change_type: changeType || 'REVISION',
      revision_reason: revisionReason || `Revision based on Version ${parentVersion.major_version}.${parentVersion.minor_version}`,
      target_batch_size: parentVersion.target_batch_size,
      target_batch_uom: parentVersion.target_batch_uom,
      expected_yield: parentVersion.expected_yield,
      shelf_life: parentVersion.shelf_life,
      storage_condition: parentVersion.storage_condition,
      remarks: parentVersion.remarks,
      created_by: req.user.id,
    });
    const newVersionId = Array.isArray(insertRes) ? insertRes[0] : (typeof insertRes === 'object' ? insertRes.id : insertRes);

    // Duplicate phases
    const parentPhases = await db('formula_phases').where({ version_id: parentVersion.id });
    const phaseMap = {};
    for (const p of parentPhases) {
      const pRes = await db('formula_phases').insert({
        version_id: newVersionId,
        phase_name: p.phase_name,
        phase_order: p.phase_order,
      });
      const newPId = Array.isArray(pRes) ? pRes[0] : (typeof pRes === 'object' ? pRes.id : pRes);
      phaseMap[p.id] = newPId;
    }

    // Duplicate materials
    const parentMaterials = await db('formula_version_materials').where({ version_id: parentVersion.id });
    for (const m of parentMaterials) {
      const { id: oldVmId, version_id, phase_id, created_at, updated_at, ...mFields } = m;
      const vmRes = await db('formula_version_materials').insert({
        ...mFields,
        version_id: newVersionId,
        phase_id: phase_id ? phaseMap[phase_id] : null,
      });
      const newVmId = Array.isArray(vmRes) ? vmRes[0] : (typeof vmRes === 'object' ? vmRes.id : vmRes);

      // Duplicate supplement serving details if present
      const suppDetail = await db('supplement_serving_details').where({ version_material_id: oldVmId }).first();
      if (suppDetail) {
        const { id: oldSdId, version_material_id, created_at, updated_at, ...sdFields } = suppDetail;
        await db('supplement_serving_details').insert({
          ...sdFields,
          version_material_id: newVmId,
        });
      }
    }

    // Duplicate instructions
    const parentInstructions = await db('formula_instructions').where({ version_id: parentVersion.id });
    for (const inst of parentInstructions) {
      const { id: oldInstId, version_id, phase_id, created_at, updated_at, ...iFields } = inst;
      await db('formula_instructions').insert({
        ...iFields,
        version_id: newVersionId,
        phase_id: phase_id ? phaseMap[phase_id] : null,
      });
    }

    // Duplicate category details if present
    const cosDet = await db('cosmetic_formula_details').where({ version_id: parentVersion.id }).first();
    if (cosDet) {
      const { id: oldId, version_id, created_at, updated_at, ...detFields } = cosDet;
      await db('cosmetic_formula_details').insert({ ...detFields, version_id: newVersionId });
    }

    const perfDet = await db('perfume_formula_details').where({ version_id: parentVersion.id }).first();
    if (perfDet) {
      const { id: oldId, version_id, created_at, updated_at, ...detFields } = perfDet;
      await db('perfume_formula_details').insert({ ...detFields, version_id: newVersionId });
    }

    const suppDet = await db('supplement_formula_details').where({ version_id: parentVersion.id }).first();
    if (suppDet) {
      const { id: oldId, version_id, created_at, updated_at, ...detFields } = suppDet;
      await db('supplement_formula_details').insert({ ...detFields, version_id: newVersionId });
    }

    await logAudit(req, 'CREATE_REVISION', 'FormulaVersion', newVersionId, null, { parentVersionId, nextMajor, nextMinor });
    return res.status(201).json({ success: true, message: `Created Draft Version ${nextMajor}.${nextMinor}`, versionId: newVersionId });
  } catch (err) {
    console.error('Create Revision Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create version revision.', error: err.message });
  }
});

// PUT /api/v1/formulas/versions/:versionId - Save/Update Draft Version (with Optimistic Concurrency Control)
router.put('/versions/:versionId', authenticateToken, requireRoles('Super Admin', 'Formulator'), async (req, res) => {
  try {
    const { versionId } = req.params;
    const {
      lockVersion,
      targetBatchSize,
      targetBatchUom,
      expectedYield,
      shelfLife,
      storageCondition,
      remarks,
      phases,
      materials,
      instructions,
      categoryDetails,
    } = req.body;

    const version = await db('formula_versions').where({ id: versionId }).first();
    if (!version) {
      return res.status(404).json({ success: false, message: 'Formula version not found.' });
    }

    // Assert read-only immutability
    assertVersionIsMutable(version);

    // Optimistic Concurrency Check
    if (lockVersion !== undefined && Number(lockVersion) !== version.lock_version) {
      return res.status(409).json({
        success: false,
        message: 'This formula version was modified by another user in the background. Please reload before saving.',
      });
    }

    await db.transaction(async trx => {
      // 1. Update version metadata and increment lock_version
      const updatedRows = await trx('formula_versions')
        .where({ id: versionId, lock_version: version.lock_version })
        .update({
          target_batch_size: targetBatchSize !== undefined ? new Decimal(targetBatchSize).toFixed(6) : version.target_batch_size,
          target_batch_uom: targetBatchUom || version.target_batch_uom,
          expected_yield: expectedYield !== undefined ? new Decimal(expectedYield).toFixed(6) : version.expected_yield,
          shelf_life: shelfLife !== undefined ? shelfLife : version.shelf_life,
          storage_condition: storageCondition !== undefined ? storageCondition : version.storage_condition,
          remarks: remarks !== undefined ? remarks : version.remarks,
          lock_version: version.lock_version + 1,
          updated_at: trx.fn.now(),
        });

      if (updatedRows === 0) {
        throw new Error('Optimistic lock error: Formula version was modified concurrently.');
      }

      // 2. Replace Phases if provided
      if (Array.isArray(phases)) {
        await trx('formula_phases').where({ version_id: versionId }).del();
        const phaseNameMap = {};
        for (let i = 0; i < phases.length; i++) {
          const p = phases[i];
          const [pId] = await trx('formula_phases').insert({
            version_id: versionId,
            phase_name: p.phase_name,
            phase_order: i + 1,
          }).then(res => [res[0]]);
          phaseNameMap[p.phase_name] = pId;
        }
      }

      // Fetch fresh phase map
      const dbPhases = await trx('formula_phases').where({ version_id: versionId });
      const phaseIdByName = {};
      for (const p of dbPhases) {
        phaseIdByName[p.phase_name] = p.id;
      }

      // 3. Replace Materials if provided
      if (Array.isArray(materials)) {
        await trx('formula_version_materials').where({ version_id: versionId }).del();

        const batchSizeDec = new Decimal(targetBatchSize || version.target_batch_size);

        for (let i = 0; i < materials.length; i++) {
          const m = materials[i];
          const matMaster = await trx('materials').where({ id: m.material_id }).first();
          if (!matMaster) {
            throw new Error(`Material ID ${m.material_id} not found in database.`);
          }

          const pctDec = new Decimal(m.percentage || '0');
          const qtyDec = pctDec.div(100).times(batchSizeDec);
          const lineCostDec = qtyDec.times(new Decimal(matMaster.cost));

          const [vmId] = await trx('formula_version_materials').insert({
            version_id: versionId,
            phase_id: m.phase_name ? phaseIdByName[m.phase_name] : (m.phase_id || null),
            material_id: m.material_id,
            material_code_snapshot: matMaster.code,
            material_name_snapshot: matMaster.name,
            uom_snapshot: matMaster.uom,
            percentage: pctDec.toFixed(6),
            serving_amount: m.serving_amount ? new Decimal(m.serving_amount).toFixed(6) : null,
            serving_uom: m.serving_uom || null,
            calculated_quantity: qtyDec.toFixed(6),
            addition_order: i + 1,
            temp_c: m.temp_c || null,
            mixing_speed_rpm: m.mixing_speed_rpm || null,
            duration_min: m.duration_min || null,
            line_cost: lineCostDec.toFixed(6),
            function_name: m.function_name || null,
            is_qs_balancing_material: Boolean(m.is_qs_balancing_material),
          }).then(res => [res[0]]);

          if (m.supplement_serving) {
            await trx('supplement_serving_details').insert({
              version_material_id: vmId,
              active_amount_per_serving: new Decimal(m.supplement_serving.active_amount_per_serving || '0').toFixed(6),
              active_uom: m.supplement_serving.active_uom || 'mg',
              overage_pct: new Decimal(m.supplement_serving.overage_pct || '0').toFixed(6),
              is_excipient: Boolean(m.supplement_serving.is_excipient),
              is_fixed_non_active: Boolean(m.supplement_serving.is_fixed_non_active),
            });
          }
        }
      }

      // 4. Replace Instructions if provided
      if (Array.isArray(instructions)) {
        await trx('formula_instructions').where({ version_id: versionId }).del();
        for (let i = 0; i < instructions.length; i++) {
          const inst = instructions[i];
          await trx('formula_instructions').insert({
            version_id: versionId,
            phase_id: inst.phase_name ? phaseIdByName[inst.phase_name] : (inst.phase_id || null),
            step_number: i + 1,
            instruction_text: inst.instruction_text,
          });
        }
      }

      // 5. Category Details update
      const formula = await trx('formulas').where({ id: version.formula_id }).first();
      if (categoryDetails) {
        if (formula.product_category === 'Cosmetic') {
          await trx('cosmetic_formula_details').where({ version_id: versionId }).delete();
          await trx('cosmetic_formula_details').insert({ version_id: versionId, ...categoryDetails });
        } else if (formula.product_category === 'Perfume No Brand' || formula.product_category === 'Perfume Brand') {
          await trx('perfume_formula_details').where({ version_id: versionId }).delete();
          await trx('perfume_formula_details').insert({
            version_id: versionId,
            concentration_tier: categoryDetails.concentration_tier || 'Eau de Parfum',
            fragrance_pct: new Decimal(categoryDetails.fragrance_pct || '0').toFixed(6),
            alcohol_pct: new Decimal(categoryDetails.alcohol_pct || '0').toFixed(6),
            water_pct: new Decimal(categoryDetails.water_pct || '0').toFixed(6),
            fixative_pct: new Decimal(categoryDetails.fixative_pct || '0').toFixed(6),
            solubilizer_pct: new Decimal(categoryDetails.solubilizer_pct || '0').toFixed(6),
            maceration_days: categoryDetails.maceration_days || 14,
            filtration_required: categoryDetails.filtration_required !== false,
            cooling_required_c: categoryDetails.cooling_required_c || null,
            odor_profile: categoryDetails.odor_profile || null,
            packaging_recommendation: categoryDetails.packaging_recommendation || null,
          });
        } else if (formula.product_category === 'Food Supplement') {
          await trx('supplement_formula_details').where({ version_id: versionId }).delete();
          await trx('supplement_formula_details').insert({
            version_id: versionId,
            dosage_form: categoryDetails.dosage_form || 'Capsules',
            composition_mode: categoryDetails.composition_mode || 'PERCENTAGE',
            serving_size: new Decimal(categoryDetails.serving_size || '1.000000').toFixed(6),
            serving_uom: categoryDetails.serving_uom || 'serving',
            servings_per_container: categoryDetails.servings_per_container || 30,
            capsule_size: categoryDetails.capsule_size || null,
            tablet_weight: categoryDetails.tablet_weight ? new Decimal(categoryDetails.tablet_weight).toFixed(6) : null,
            tablet_weight_uom: categoryDetails.tablet_weight_uom || 'mg',
            daily_recommended_intake: categoryDetails.daily_recommended_intake || null,
            warning_statement: categoryDetails.warning_statement || null,
            storage_instruction: categoryDetails.storage_instruction || null,
          });
        }
      }
    });

    await logAudit(req, 'UPDATE_FORMULA_DRAFT', 'FormulaVersion', versionId, null, { lockVersion });
    return res.json({ success: true, message: 'Draft formula version saved successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/v1/formulas/versions/:versionId/workflow - Workflow State Transitions (Submit, Return, Endorse, Approve, Reject)
router.post('/versions/:versionId/workflow', authenticateToken, async (req, res) => {
  try {
    const { versionId } = req.params;
    const { action, comments } = req.body;

    const version = await db('formula_versions').where({ id: versionId }).first();
    if (!version) {
      return res.status(404).json({ success: false, message: 'Formula version not found.' });
    }

    const formula = await db('formulas').where({ id: version.formula_id }).first();
    const materials = await db('formula_version_materials')
      .leftJoin('materials', 'formula_version_materials.material_id', 'materials.id')
      .where({ version_id: versionId })
      .select('formula_version_materials.*', 'materials.cost', 'materials.currency_code');

    let targetStatus;
    if (action === 'SUBMIT') targetStatus = 'UNDER_REVIEW';
    else if (action === 'RETURN') targetStatus = 'DRAFT';
    else if (action === 'ENDORSE') targetStatus = 'FOR_APPROVAL';
    else if (action === 'APPROVE') targetStatus = 'APPROVED';
    else if (action === 'REJECT') targetStatus = 'REJECTED';
    else return res.status(400).json({ success: false, message: 'Invalid workflow action.' });

    // Validate RBAC and status transition
    validateWorkflowTransition(version.version_status, targetStatus, req.user.roles, action);

    // GATEWAY VALIDATION: Submitting/Endorsing/Approving requires FULL backend calculation validation
    if (targetStatus === 'UNDER_REVIEW' || targetStatus === 'FOR_APPROVAL' || targetStatus === 'APPROVED') {
      const toleranceSetting = await db('system_settings').where({ key: 'formula_tolerance_pct' }).first();
      const tolerance = toleranceSetting ? toleranceSetting.value : '0.010000';

      const suppDetails = await db('supplement_formula_details').where({ version_id: versionId }).first();

      if (formula.product_category === 'Food Supplement' && suppDetails?.composition_mode === 'AMOUNT_PER_SERVING') {
        // Run Supplement Excipient calculation check
        calculateSupplementDosage(suppDetails, materials);
      } else {
        // Run 100% total percentage validation
        const valResult = validateFormulaPercentage(materials, tolerance);
        if (!valResult.isValid) {
          return res.status(400).json({ success: false, message: `Workflow validation failed: ${valResult.message}` });
        }
      }
    }

    // ATOMIC TRANSACTION FOR APPROVAL
    await db.transaction(async trx => {
      const updatePayload = {
        version_status: targetStatus,
        updated_at: trx.fn.now(),
      };

      if (action === 'SUBMIT') {
        // keep created_by
      } else if (action === 'RETURN' || action === 'ENDORSE') {
        updatePayload.reviewed_by = req.user.id;
      } else if (action === 'APPROVE') {
        updatePayload.approved_by = req.user.id;
        updatePayload.approval_timestamp = trx.fn.now();
        updatePayload.effective_date = trx.fn.now();

        // Mark previous approved version of this formula as SUPERSEDED
        await trx('formula_versions')
          .where({ formula_id: formula.id, version_status: 'APPROVED' })
          .andWhereNot({ id: versionId })
          .update({ version_status: 'SUPERSEDED', updated_at: trx.fn.now() });

        // Calculate and save IMMUTABLE COSTING SNAPSHOT
        const costingResult = calculateFormulaCosting(materials, version.target_batch_size);
        await saveFormulaCostSnapshot(trx, versionId, costingResult);
      } else if (action === 'REJECT') {
        updatePayload.approved_by = req.user.id;
      }

      await trx('formula_versions').where({ id: versionId }).update(updatePayload);

      // Record Workflow log
      await trx('formula_workflow_records').insert({
        version_id: versionId,
        action,
        from_status: version.version_status,
        to_status: targetStatus,
        actor_id: req.user.id,
        comments: comments || null,
      });
    });

    await logAudit(req, `WORKFLOW_${action}`, 'FormulaVersion', versionId, { status: version.version_status }, { status: targetStatus });
    return res.json({ success: true, message: `Formula status successfully transitioned to ${targetStatus}` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
