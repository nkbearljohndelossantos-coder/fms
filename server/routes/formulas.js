import { express } from '../cjsRequire.js';
import crypto from 'crypto';
import Decimal from 'decimal.js';
import db from '../db.js';
import { authenticateToken, requirePermission, requireRoles } from '../middleware/auth.js';
import { AuditService } from '../services/AuditService.js';
import { SequenceService } from '../services/SequenceService.js';
import { validateFormulaPercentage, assertVersionIsMutable } from '../services/validationEngine.js';
import { CompoundingBatchService } from '../services/CompoundingBatchService.js';

const router = express.Router();

function calculateFormulaCosting(materials, targetBatchSize = '100.000000') {
  let totalCost = new Decimal(0);
  const batchSizeDec = new Decimal(targetBatchSize);

  const lineCosts = materials.map(m => {
    const pctDec = new Decimal(m.percentage || '0');
    const rawCost = new Decimal(m.cost || '0');
    const uom = String(m.material_uom || m.uom || m.uom_snapshot || 'g').trim().toLowerCase();

    // Convert raw cost to cost per gram if material UOM in DB is kg
    const costPerG = (uom === 'kg') ? rawCost.div(1000) : rawCost;
    const reqWeightGrams = pctDec.div(100).times(batchSizeDec);
    const lineCost = reqWeightGrams.times(costPerG);

    totalCost = totalCost.plus(lineCost);
    return {
      materialId: m.material_id,
      percentage: pctDec.toFixed(6),
      requiredWeight: reqWeightGrams.toFixed(6),
      costPerG: costPerG.toFixed(6),
      costPerKg: (uom === 'kg') ? rawCost.toFixed(6) : rawCost.times(1000).toFixed(6),
      lineCost: lineCost.toFixed(6),
    };
  });

  const costPerG = batchSizeDec.gt(0) ? totalCost.div(batchSizeDec) : new Decimal(0);

  return {
    totalBatchCost: totalCost.toFixed(6),
    costPerKg: costPerG.times(1000).toFixed(6),
    costPerG: costPerG.toFixed(6),
    lineCosts,
  };
}

async function saveFormulaCostSnapshot(trx, versionId, costingResult, materials) {
  const [snapshotId] = await trx('formula_cost_snapshots').insert({
    version_id: versionId,
    raw_material_cost: costingResult.totalBatchCost || '0.000000',
    process_loss_pct: '0.000000',
    packaging_cost: '0.000000',
    labor_cost: '0.000000',
    overhead_cost: '0.000000',
    total_cost: costingResult.totalBatchCost || '0.000000',
    cost_per_unit: costingResult.costPerKg || '0.000000',
    currency_code: 'PHP',
  }).then(res => [res[0]]);

  const materialMap = {};
  if (Array.isArray(materials)) {
    materials.forEach(m => {
      materialMap[m.material_id] = {
        code: m.material_code_snapshot || m.material_code || m.code || 'MAT',
        name: m.material_name_snapshot || m.material_name || m.name || 'Material',
        uom: m.uom_snapshot || m.uom || 'g',
      };
    });
  }

  if (Array.isArray(costingResult.lineCosts) && costingResult.lineCosts.length > 0) {
    const insertItems = costingResult.lineCosts.map(item => {
      const meta = materialMap[item.materialId] || {};
      return {
        snapshot_id: snapshotId,
        material_id: item.materialId,
        material_code_snapshot: meta.code || 'MAT',
        material_name_snapshot: meta.name || 'Material',
        percentage: item.percentage || '0.000000',
        quantity: item.requiredWeight || '0.000000',
        uom: meta.uom || 'g',
        cost_per_uom: item.costPerKg || '0.000000',
        line_cost: item.lineCost || '0.000000',
        currency_code: 'PHP',
      };
    });
    await trx('formula_cost_snapshot_items').insert(insertItems);
  }
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
          compounding_code: v.compounding_code || null,
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
      .leftJoin('vendors', 'materials.vendor_id', 'vendors.id')
      .leftJoin('formula_phases', 'formula_version_materials.phase_id', 'formula_phases.id')
      .where({ 'formula_version_materials.version_id': versionId })
      .select(
        'formula_version_materials.*',
        'materials.code as material_code',
        'materials.name as material_name',
        'materials.cost',
        'materials.uom as material_uom',
        'materials.currency_code',
        'materials.density_kg_per_l',
        'materials.specific_gravity',
        'vendors.name as vendor_name',
        'vendors.code as vendor_code',
        'formula_phases.phase_name'
      )
      .orderBy('formula_version_materials.addition_order', 'asc');

    const phases = await db('formula_phases').where({ version_id: versionId }).orderBy('phase_order', 'asc');
    const instructions = await db('formula_instructions').where({ version_id: versionId }).orderBy('step_number', 'asc');

    // Auto-repair missing phase_id in database for legacy records
    const missingPhase = materials.some(m => !m.phase_name);
    if (missingPhase && materials.length > 0) {
      let defaultPhase = phases[0];
      if (!defaultPhase) {
        const [newPId] = await db('formula_phases').insert({
          version_id: versionId,
          phase_name: 'Phase A - Water Phase',
          phase_order: 1,
        }).then(r => [r[0]]);
        defaultPhase = { id: newPId, phase_name: 'Phase A - Water Phase' };
        phases.push(defaultPhase);
      }
      await db('formula_version_materials')
        .where({ version_id: versionId })
        .whereNull('phase_id')
        .update({ phase_id: defaultPhase.id });

      materials.forEach(m => {
        if (!m.phase_name) {
          m.phase_name = defaultPhase.phase_name;
          m.phase_id = defaultPhase.id;
        }
      });
    }

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

// PUT /api/v1/formulas/:id (Rename / Update Formula Master Name & Details)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const formulaId = req.params.id;
    const { name, code, product_subcategory, brand_type } = req.body;

    const formula = await db('formulas').where({ id: formulaId }).first();
    if (!formula) {
      return res.status(404).json({ success: false, message: 'Formula not found.' });
    }

    const updatePayload = { updated_at: db.fn.now() };
    if (name && String(name).trim()) updatePayload.name = String(name).trim();
    if (code && String(code).trim()) updatePayload.code = String(code).trim();
    if (product_subcategory !== undefined) updatePayload.product_subcategory = product_subcategory;
    if (brand_type !== undefined) updatePayload.brand_type = brand_type;

    await db('formulas').where({ id: formulaId }).update(updatePayload);

    return res.json({ success: true, message: 'Formula renamed successfully' });
  } catch (err) {
    console.error('Error renaming formula:', err);
    return res.status(500).json({ success: false, message: 'Failed to rename formula', error: err.message });
  }
});

// PUT /api/v1/formulas/versions/:versionId/rename (Rename / Update Version Numbers & Reason)
router.put('/versions/:versionId/rename', authenticateToken, async (req, res) => {
  try {
    const { versionId } = req.params;
    const { majorVersion, minorVersion, revisionReason } = req.body;

    const version = await db('formula_versions').where({ id: versionId }).first();
    if (!version) {
      return res.status(404).json({ success: false, message: 'Formula version not found' });
    }

    const targetMajor = (majorVersion !== undefined && !isNaN(Number(majorVersion))) ? Number(majorVersion) : version.major_version;
    const targetMinor = (minorVersion !== undefined && !isNaN(Number(minorVersion))) ? Number(minorVersion) : version.minor_version;

    if (targetMajor !== version.major_version || targetMinor !== version.minor_version) {
      const collision = await db('formula_versions')
        .where({ formula_id: version.formula_id, major_version: targetMajor, minor_version: targetMinor })
        .whereNot({ id: versionId })
        .first();
      if (collision) {
        return res.status(400).json({
          success: false,
          message: `Version V${targetMajor}.${targetMinor} already exists for this formula. Please specify a unique version number.`,
        });
      }
    }

    const updatePayload = { updated_at: db.fn.now() };
    if (majorVersion !== undefined && !isNaN(Number(majorVersion))) {
      updatePayload.major_version = Number(majorVersion);
    }
    if (minorVersion !== undefined && !isNaN(Number(minorVersion))) {
      updatePayload.minor_version = Number(minorVersion);
    }
    if (revisionReason !== undefined) {
      updatePayload.revision_reason = revisionReason;
    }

    await db('formula_versions').where({ id: versionId }).update(updatePayload);

    return res.json({ success: true, message: 'Formula version updated successfully' });
  } catch (err) {
    console.error('Error updating version number:', err);
    return res.status(500).json({ success: false, message: 'Failed to update version number', error: err.message });
  }
});

// PUT /api/v1/formulas/versions/:versionId (Save draft version composition & specs)
router.put('/versions/:versionId', authenticateToken, async (req, res) => {
  try {
    const { versionId } = req.params;
    const { materials, categoryDetails, targetBatchSize, target_batch_size, targetBatchUom, target_batch_uom } = req.body;

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
      const normalizePhaseName = (pName) => {
        if (!pName) return 'Phase A';
        const match = String(pName).trim().match(/^Phase\s+([A-Za-z0-9]+)/i);
        if (match) return `Phase ${match[1].toUpperCase()}`;
        const lower = String(pName).toLowerCase();
        if (lower.includes('water')) return 'Phase A';
        if (lower.includes('surfactant') || lower.includes('oil')) return 'Phase B';
        if (lower.includes('active')) return 'Phase C';
        if (lower.includes('cooling')) return 'Phase D';
        if (lower.includes('post')) return 'Phase E';
        return pName.startsWith('Phase') ? pName : `Phase ${pName}`;
      };

      const existingPhases = await trx('formula_phases').where({ version_id: versionId });
      const phaseMap = {};
      for (const p of existingPhases) {
        const normName = normalizePhaseName(p.phase_name);
        phaseMap[p.phase_name] = p.id;
        phaseMap[normName] = p.id;
        if (p.phase_name !== normName) {
          await trx('formula_phases').where({ id: p.id }).update({ phase_name: normName }).catch(() => {});
        }
      }

      const uniquePhaseNames = [...new Set((materials || []).map(m => normalizePhaseName(m.phase_name)).filter(Boolean))];
      let order = 1;
      if (existingPhases.length > 0) {
        const orders = existingPhases.map(p => Number(p.phase_order) || 0);
        order = Math.max(...orders, 0) + 1;
      }

      for (const pName of uniquePhaseNames) {
        if (!phaseMap[pName]) {
          try {
            const [newPhaseId] = await trx('formula_phases').insert({
              version_id: versionId,
              phase_name: pName,
              phase_order: order++,
            }).then(res => [res[0]]);
            phaseMap[pName] = newPhaseId;
          } catch (e) {
            const existing = await trx('formula_phases').where({ version_id: versionId, phase_name: pName }).first();
            if (existing) {
              phaseMap[pName] = existing.id;
            }
          }
        }
      }

      // 2. Fetch unit costs for materials to compute line costs
      const materialIds = (materials || []).map(m => m.material_id || m.id).filter(Boolean);
      const rawMaterials = await trx('materials').whereIn('id', materialIds);
      const materialCostMap = {};
      rawMaterials.forEach(m => {
        const uom = String(m.uom || 'g').trim().toLowerCase();
        const c = new Decimal(m.cost || '0');
        const costPerG = (uom === 'kg') ? c.div(1000) : c;
        materialCostMap[m.id] = costPerG;
      });

      const batchSizeDec = new Decimal(version.target_batch_size || '100.000000');

      // 3. Clear existing material composition rows
      await trx('formula_version_materials').where({ version_id: versionId }).del();

      // 4. Insert resolved composition rows
      if (Array.isArray(materials) && materials.length > 0) {
        const seenMatKeys = new Set();
        const insertMats = [];
        materials.forEach((m, idx) => {
          const mId = m.material_id || m.id;
          const pName = normalizePhaseName(m.phase_name);
          const uKey = `${pName}_${mId}`;
          if (seenMatKeys.has(uKey)) return;
          seenMatKeys.add(uKey);

          const pId = phaseMap[m.phase_name] || phaseMap[pName] || null;
          const pctDec = new Decimal(m.percentage || '0');
          const costPerG = materialCostMap[mId] || new Decimal(0);
          const reqWeight = pctDec.div(100).times(batchSizeDec);
          const lineCost = reqWeight.times(costPerG);

          const parseNum = (val) => {
            if (val === undefined || val === null) return null;
            const cleanStr = String(val).trim();
            if (cleanStr === '') return null;
            const parsed = Number(cleanStr);
            return isNaN(parsed) ? null : parsed;
          };

          insertMats.push({
            version_id: versionId,
            phase_id: pId,
            material_id: mId,
            material_code_snapshot: m.material_code_snapshot || m.material_code || m.code || 'MAT',
            material_name_snapshot: m.material_name_snapshot || m.material_name || m.name || 'Material',
            uom_snapshot: 'g',
            percentage: pctDec.toFixed(6),
            calculated_quantity: reqWeight.toFixed(6),
            addition_order: insertMats.length + 1,
            function_name: m.function_name || null,
            temp_c: parseNum(m.temp_c),
            mixing_speed_rpm: parseNum(m.mixing_speed_rpm),
            duration_min: parseNum(m.duration_min),
            line_cost: lineCost.toFixed(6),
          });
        });

        for (const matRow of insertMats) {
          try {
            await trx('formula_version_materials').insert(matRow);
          } catch (err) {
            // Fallback for legacy DB tables with unique constraint: insert without constraint block
            await trx.raw(
              'INSERT INTO formula_version_materials (version_id, phase_id, material_id, material_code_snapshot, material_name_snapshot, uom_snapshot, percentage, calculated_quantity, addition_order, function_name, line_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [matRow.version_id, matRow.phase_id, matRow.material_id, matRow.material_code_snapshot, matRow.material_name_snapshot, matRow.uom_snapshot, matRow.percentage, matRow.calculated_quantity, matRow.addition_order, matRow.function_name, matRow.line_cost]
            ).catch(() => {});
          }
        }
      }

      const formula = await trx('formulas').where({ id: version.formula_id }).first();
      const cat = formula?.product_category || 'Cosmetic';

      if (cat === 'Cosmetic' || cat === 'Cosmetics') {
        const hasRemarks = await trx.schema.hasColumn('cosmetic_formula_details', 'remarks');
        if (!hasRemarks) {
          await trx.schema.alterTable('cosmetic_formula_details', table => {
            table.text('remarks').nullable();
          });
        }
        const hasActualPh = await trx.schema.hasColumn('cosmetic_formula_details', 'actual_ph');
        if (!hasActualPh) {
          await trx.schema.alterTable('cosmetic_formula_details', table => {
            table.string('actual_ph').nullable();
          });
        }

        const exists = await trx('cosmetic_formula_details').where({ version_id: versionId }).first();
        const detailsPayload = {
          target_ph: categoryDetails?.target_ph || null,
          actual_ph: categoryDetails?.actual_ph || null,
          viscosity_cp: categoryDetails?.viscosity_cp || null,
          appearance: categoryDetails?.appearance || null,
          color: categoryDetails?.color || null,
          odor: categoryDetails?.odor || null,
          texture: categoryDetails?.texture || null,
          preservative_system: categoryDetails?.preservative_system || null,
          manufacturing_conditions: categoryDetails?.manufacturing_conditions || null,
          remarks: categoryDetails?.remarks || null,
        };

        if (exists) {
          await trx('cosmetic_formula_details').where({ version_id: versionId }).update(detailsPayload);
        } else {
          await trx('cosmetic_formula_details').insert({ version_id: versionId, ...detailsPayload });
        }
      }

      const compoundingCode = await SequenceService.getNextSequence('COMPOUNDING_CODE', trx);
      const verUpdate = {
        updated_at: trx.fn.now(),
        compounding_code: compoundingCode,
      };

      await trx('compounding_code_logs').insert({
        compounding_code: compoundingCode,
        batch_number: compoundingCode.replace('CP-', 'BAT-'),
        formula_code: formula?.code || null,
        formula_name: formula?.name || null,
        formula_version: `V${version.major_version}.${version.minor_version}`,
        target_batch_size: targetBatchSize || target_batch_size || version.target_batch_size,
        target_batch_uom: targetBatchUom || target_batch_uom || version.target_batch_uom || 'g',
        printed_by_id: req.user?.id || null,
        printed_by_name: req.user ? `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || req.user.username : 'Formulator',
        created_at: trx.fn.now(),
      }).catch(() => {});

      const newBatchSize = targetBatchSize || target_batch_size;
      if (newBatchSize !== undefined && newBatchSize !== null && String(newBatchSize).trim() !== '') {
        verUpdate.target_batch_size = new Decimal(newBatchSize).toFixed(6);
      }
      const newBatchUom = targetBatchUom || target_batch_uom;
      if (newBatchUom) {
        verUpdate.target_batch_uom = newBatchUom;
      }

      await trx('formula_versions')
        .where({ id: versionId })
        .update(verUpdate);

      await AuditService.logEvent({
        trx,
        userId: req.user.id,
        userRole: req.user.roles[0] || 'User',
        action: 'UPDATE_FORMULA_VERSION',
        entityType: 'FormulaVersion',
        entityId: versionId,
        newValues: { materials_count: materials?.length || 0, compounding_code: compoundingCode },
      });

      req._assignedCompoundingCode = compoundingCode;
    });

    return res.json({
      success: true,
      message: 'Formula draft version updated successfully',
      data: { compounding_code: req._assignedCompoundingCode },
    });
  } catch (err) {
    console.error('Error updating formula version:', err);
    return res.status(500).json({ success: false, message: err.message || 'Database operation failed', error: err.message });
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

    const maxVerRow = await db('formula_versions')
      .where({ formula_id: formulaId })
      .max('major_version as maxMajor')
      .first();

    const currentMax = (maxVerRow?.maxMajor !== undefined && maxVerRow?.maxMajor !== null) ? Number(maxVerRow.maxMajor) : (parentVer?.major_version || 1);
    const nextMajor = currentMax + 1;
    const nextMinor = 0;

    const result = await db.transaction(async (trx) => {
      const compoundingCode = await SequenceService.getNextSequence('COMPOUNDING_CODE', trx);

      const insertVer = {
        formula_id: formulaId,
        compounding_code: compoundingCode,
        major_version: nextMajor,
        minor_version: nextMinor,
        lock_version: 0,
        version_status: 'DRAFT',
        change_type: 'REVISION',
        revision_reason: revisionReason || `Draft revision from Version ${parentVer?.major_version || 1}.${parentVer?.minor_version || 0}`,
        target_batch_size: parentVer?.target_batch_size || '100.000000',
        target_batch_uom: parentVer?.target_batch_uom || 'g',
        expected_yield: '100.000000',
        created_by: req.user?.id || null,
      };

      const [newVersionId] = await trx('formula_versions').insert(insertVer).then(r => [r[0]]);

      await trx('compounding_code_logs').insert({
        compounding_code: compoundingCode,
        batch_number: compoundingCode.replace('CP-', 'BAT-'),
        formula_code: formula?.code || null,
        formula_name: formula?.name || null,
        formula_version: `V${nextMajor}.${nextMinor}`,
        target_batch_size: parentVer?.target_batch_size || '100.000000',
        target_batch_uom: parentVer?.target_batch_uom || 'g',
        printed_by_id: req.user?.id || null,
        printed_by_name: req.user ? `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || req.user.username : 'Formulator',
        created_at: trx.fn.now(),
      }).catch(() => {});

      if (sourceVersionId) {
        // 1. Copy phases first to map old phase_id -> new phase_id for the new version
        const phaseIdMap = {};
        const oldPhases = await trx('formula_phases').where({ version_id: sourceVersionId });
        for (const p of oldPhases) {
          const { id, version_id, created_at, updated_at, ...phaseData } = p;
          const [newPhaseId] = await trx('formula_phases').insert({
            ...phaseData,
            version_id: newVersionId,
          }).then(r => [r[0]]);
          if (id && newPhaseId) {
            phaseIdMap[id] = newPhaseId;
          }
        }

        // 2. Copy materials second with properly remapped phase_id
        const oldMats = await trx('formula_version_materials').where({ version_id: sourceVersionId });
        for (const m of oldMats) {
          const { id, version_id, created_at, updated_at, ...matData } = m;
          const remappedPhaseId = matData.phase_id ? (phaseIdMap[matData.phase_id] || null) : null;
          await trx('formula_version_materials').insert({
            ...matData,
            phase_id: remappedPhaseId,
            version_id: newVersionId,
          });
        }

        // 3. Copy instructions
        const oldInstructions = await trx('formula_instructions').where({ version_id: sourceVersionId });
        for (const inst of oldInstructions) {
          const { id, version_id, created_at, updated_at, ...instData } = inst;
          await trx('formula_instructions').insert({
            ...instData,
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
        userId: req.user?.id || null,
        userRole: (req.user?.roles && req.user.roles[0]) || 'Chemist',
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

// DELETE /api/v1/formulas/:id (Delete master formula and all its versions & linked records)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const formulaId = req.params.id;
    const formula = await db('formulas').where({ id: formulaId }).first();
    if (!formula) {
      return res.status(404).json({ success: false, message: 'Formula not found' });
    }

    await db.transaction(async (trx) => {
      // Temporarily disable foreign key checks to prevent recursive/self-referencing FK blocks
      await trx.raw('SET FOREIGN_KEY_CHECKS = 0;').catch(() => {});
      await trx.raw('PRAGMA foreign_keys = OFF;').catch(() => {});

      const versions = await trx('formula_versions').where({ formula_id: formulaId });
      const versionIds = versions.map(v => v.id);

      // Unlink parent_version_id self-references first
      if (versionIds.length > 0) {
        await trx('formula_versions').whereIn('id', versionIds).update({ parent_version_id: null }).catch(() => {});
      }

      // Clean up linked production batches and child records first to satisfy Foreign Key constraints
      const pBatches = await trx('production_batches')
        .where({ formula_id: formulaId })
        .orWhere(builder => {
          if (versionIds.length > 0) {
            builder.whereIn('formula_version_id', versionIds);
          }
        });
      const batchIds = pBatches.map(b => b.id);

      if (batchIds.length > 0) {
        await trx('batch_material_entries').whereIn('batch_id', batchIds).del().catch(() => {});
        await trx('batch_material_requirements').whereIn('batch_id', batchIds).del().catch(() => {});
        await trx('batch_steps').whereIn('batch_id', batchIds).del().catch(() => {});
        await trx('batch_phases').whereIn('batch_id', batchIds).del().catch(() => {});
        await trx('batch_execution_locks').whereIn('batch_id', batchIds).del().catch(() => {});
        await trx('batch_deviations').whereIn('batch_id', batchIds).del().catch(() => {});
        await trx('qr_tokens').whereIn('batch_id', batchIds).del().catch(() => {});
        await trx('production_batches').whereIn('id', batchIds).del().catch(() => {});
      }

      if (versionIds.length > 0) {
        await trx('batch_calculations').whereIn('formula_version_id', versionIds).del().catch(() => {});
        await trx('compounding_code_logs').where({ formula_id: formulaId }).del().catch(() => {});
        await trx('compounding_codes').where({ formula_code: formula.code }).del().catch(() => {});
        await trx('quality_parameters').whereIn('version_id', versionIds).del().catch(() => {});
        await trx('microbiology_tests').whereIn('version_id', versionIds).del().catch(() => {});
        await trx('packaging_specs').whereIn('version_id', versionIds).del().catch(() => {});
        await trx('stability_testing').whereIn('version_id', versionIds).del().catch(() => {});
        await trx('perfume_conversions').whereIn('target_brand_version_id', versionIds).del().catch(() => {});
        await trx('perfume_mixtures').whereIn('source_formula_version_id', versionIds).del().catch(() => {});

        await trx('formula_version_materials').whereIn('version_id', versionIds).del().catch(() => {});
        await trx('formula_phases').whereIn('version_id', versionIds).del().catch(() => {});
        await trx('formula_instructions').whereIn('version_id', versionIds).del().catch(() => {});
        await trx('cosmetic_formula_details').whereIn('version_id', versionIds).del().catch(() => {});
        await trx('perfume_formula_details').whereIn('version_id', versionIds).del().catch(() => {});
        await trx('supplement_formula_details').whereIn('version_id', versionIds).del().catch(() => {});
        await trx('formula_versions').whereIn('id', versionIds).del().catch(() => {});
      }

      await trx('formulas').where({ id: formulaId }).del();

      // Re-enable foreign key checks
      await trx.raw('SET FOREIGN_KEY_CHECKS = 1;').catch(() => {});
      await trx.raw('PRAGMA foreign_keys = ON;').catch(() => {});

      const userRole = (req.user?.roles && req.user.roles[0]) || req.user?.role || 'User';
      await AuditService.logEvent({
        trx,
        userId: req.user?.id || 1,
        userRole,
        action: 'DELETE_FORMULA',
        entityType: 'Formula',
        entityId: formulaId,
        newValues: { code: formula.code, name: formula.name },
      }).catch(() => {});
    });

    return res.json({ success: true, message: `Formula ${formula.code} deleted successfully.` });
  } catch (err) {
    console.error('Error deleting formula:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete formula', error: err.message });
  }
});

// DELETE /api/v1/formulas/versions/:versionId (Delete specific formula version)
router.delete('/versions/:versionId', authenticateToken, async (req, res) => {
  try {
    const { versionId } = req.params;
    const version = await db('formula_versions').where({ id: versionId }).first();
    if (!version) {
      return res.status(404).json({ success: false, message: 'Formula version not found' });
    }

    await db.transaction(async (trx) => {
      await trx.raw('SET FOREIGN_KEY_CHECKS = 0;').catch(() => {});
      await trx.raw('PRAGMA foreign_keys = OFF;').catch(() => {});

      // Unlink child parent_version_id references first
      await trx('formula_versions').where({ parent_version_id: versionId }).update({ parent_version_id: null }).catch(() => {});

      const pBatches = await trx('production_batches').where({ formula_version_id: versionId });
      const batchIds = pBatches.map(b => b.id);
      if (batchIds.length > 0) {
        await trx('batch_material_entries').whereIn('batch_id', batchIds).del().catch(() => {});
        await trx('batch_material_requirements').whereIn('batch_id', batchIds).del().catch(() => {});
        await trx('batch_steps').whereIn('batch_id', batchIds).del().catch(() => {});
        await trx('batch_phases').whereIn('batch_id', batchIds).del().catch(() => {});
        await trx('batch_execution_locks').whereIn('batch_id', batchIds).del().catch(() => {});
        await trx('batch_deviations').whereIn('batch_id', batchIds).del().catch(() => {});
        await trx('qr_tokens').whereIn('batch_id', batchIds).del().catch(() => {});
        await trx('production_batches').whereIn('id', batchIds).del().catch(() => {});
      }

      await trx('batch_calculations').where({ formula_version_id: versionId }).del().catch(() => {});
      await trx('quality_parameters').where({ version_id: versionId }).del().catch(() => {});
      await trx('microbiology_tests').where({ version_id: versionId }).del().catch(() => {});
      await trx('packaging_specs').where({ version_id: versionId }).del().catch(() => {});
      await trx('stability_testing').where({ version_id: versionId }).del().catch(() => {});
      await trx('perfume_conversions').where({ target_brand_version_id: versionId }).del().catch(() => {});
      await trx('perfume_mixtures').where({ source_formula_version_id: versionId }).del().catch(() => {});

      await trx('formula_version_materials').where({ version_id: versionId }).del().catch(() => {});
      await trx('formula_phases').where({ version_id: versionId }).del().catch(() => {});
      await trx('formula_instructions').where({ version_id: versionId }).del().catch(() => {});
      await trx('cosmetic_formula_details').where({ version_id: versionId }).del().catch(() => {});
      await trx('perfume_formula_details').where({ version_id: versionId }).del().catch(() => {});
      await trx('supplement_formula_details').where({ version_id: versionId }).del().catch(() => {});
      await trx('formula_versions').where({ id: versionId }).del();

      await trx.raw('SET FOREIGN_KEY_CHECKS = 1;').catch(() => {});
      await trx.raw('PRAGMA foreign_keys = ON;').catch(() => {});

      const userRole = (req.user?.roles && req.user.roles[0]) || req.user?.role || 'User';
      await AuditService.logEvent({
        trx,
        userId: req.user?.id || 1,
        userRole,
        action: 'DELETE_FORMULA_VERSION',
        entityType: 'FormulaVersion',
        entityId: versionId,
        newValues: { major_version: version.major_version, minor_version: version.minor_version },
      }).catch(() => {});
    });

    return res.json({ success: true, message: `Formula version V${version.major_version}.${version.minor_version} deleted successfully.` });
  } catch (err) {
    console.error('Error deleting formula version:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete formula version', error: err.message });
  }
});

// 6. POST /api/v1/formulas (Create master formula & initial v1.0 draft - STRICT MYSQL COMPATIBLE)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, category, formula_type, product_category, product_subcategory, brand_type, reference_batch_size, batchSize = '100.000000', batchUom = 'g', revisionReason = 'Initial creation' } = req.body;

    const formulaName = name || 'New Formula';
    const rawCat = String(category || product_category || formula_type || 'Cosmetic').trim();
    const lowerCat = rawCat.toLowerCase();

    let normalizedCategory = 'Cosmetic';
    if (lowerCat.includes('perfume') && lowerCat.includes('brand') && !lowerCat.includes('no')) {
      normalizedCategory = 'Perfume Brand';
    } else if (lowerCat.includes('perfume')) {
      normalizedCategory = 'Perfume No Brand';
    } else if (lowerCat.includes('supplement')) {
      normalizedCategory = 'Food Supplement';
    } else {
      normalizedCategory = 'Cosmetic';
    }

    const targetBatchSize = reference_batch_size || batchSize || '100.000000';

    const txResult = await db.transaction(async (trx) => {
      const code = await SequenceService.getNextSequence('FORMULA_CODE', trx);
      const compoundingCode = await SequenceService.getNextSequence('COMPOUNDING_CODE', trx);

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
        compounding_code: compoundingCode,
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

      await trx('compounding_code_logs').insert({
        compounding_code: compoundingCode,
        batch_number: compoundingCode.replace('CP-', 'BAT-'),
        formula_code: code,
        formula_name: formulaName,
        formula_version: 'V1.0',
        target_batch_size: targetBatchSize,
        target_batch_uom: batchUom || 'g',
        printed_by_id: req.user?.id || null,
        printed_by_name: req.user ? `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || req.user.username : 'Formulator',
        created_at: trx.fn.now(),
      }).catch(() => {});

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

    // APPROVAL PERMISSION & WORKFLOW TRANSITION
    if (action === 'APPROVE') {
      const isAuthorizedRole = req.user.roles?.some(r =>
        ['Super Admin', 'Formulator', 'Formulation Chemist', 'Perfume Admin', 'Production Supervisor', 'QC Specialist'].includes(r)
      );

      if (!req.user.permissions?.includes('formula.approve') && !isAuthorizedRole) {
        return res.status(403).json({ success: false, message: 'Forbidden. Approval permission required.' });
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
        await saveFormulaCostSnapshot(trx, versionId, costingResult, materials);

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
        if (phases.length === 0) {
          const [bpId] = await trx('batch_phases').insert({
            batch_id: batchId,
            phase_letter: 'A',
            phase_name: 'Phase A - Production',
            sequence: 1,
            status: 'Waiting',
          }).then(r => [r[0]]);
          phaseIdMap['default'] = bpId;
        } else {
          for (const p of phases) {
            const order = Number(p.phase_order) || 1;
            const [bpId] = await trx('batch_phases').insert({
              batch_id: batchId,
              phase_letter: String.fromCharCode(64 + order),
              phase_name: p.phase_name,
              sequence: order,
              status: 'Waiting',
            }).then(r => [r[0]]);
            phaseIdMap[p.id] = bpId;
          }
        }

        for (let i = 0; i < versionInstructions.length; i++) {
          const inst = versionInstructions[i];
          const bpId = phaseIdMap[inst.phase_id] || Object.values(phaseIdMap)[0] || null;

          const [bsId] = await trx('batch_steps').insert({
            batch_id: batchId,
            phase_id: bpId,
            step_number: inst.step_number || (i + 1),
            material_id: (versionMaterials.find(m => m.id === inst.material_id || m.material_id === inst.material_id) || versionMaterials[i])?.material_id || null,
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
      if (phases.length === 0) {
        const [bpId] = await trx('batch_phases').insert({
          batch_id: batchId,
          phase_letter: 'A',
          phase_name: 'Phase A - Production',
          sequence: 1,
          status: 'Waiting',
        }).then(r => [r[0]]);
        phaseIdMap['default'] = bpId;
      } else {
        for (const p of phases) {
          const order = Number(p.phase_order) || 1;
          const [bpId] = await trx('batch_phases').insert({
            batch_id: batchId,
            phase_letter: String.fromCharCode(64 + order),
            phase_name: p.phase_name,
            sequence: order,
            status: 'Waiting',
          }).then(r => [r[0]]);
          phaseIdMap[p.id] = bpId;
        }
      }

      for (let i = 0; i < instructions.length; i++) {
        const inst = instructions[i];
        const bpId = phaseIdMap[inst.phase_id] || Object.values(phaseIdMap)[0] || null;

        const [bsId] = await trx('batch_steps').insert({
          batch_id: batchId,
          phase_id: bpId,
          step_number: inst.step_number || (i + 1),
          material_id: (materials.find(m => m.id === inst.material_id || m.material_id === inst.material_id) || materials[i])?.material_id || null,
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
