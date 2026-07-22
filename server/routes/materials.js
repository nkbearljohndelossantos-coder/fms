import { express } from '../cjsRequire.js';
import Decimal from 'decimal.js';
import db from '../db.js';
import { authenticateToken, requireRoles } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';
import { UOM_CATEGORIES } from '../services/unitConversionService.js';

const router = express.Router();

// GET /api/v1/materials - Search & Filter Materials
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { search, category, companyId, vendorId, activeOnly } = req.query;

    const query = db('materials')
      .leftJoin('companies', 'materials.company_id', 'companies.id')
      .leftJoin('vendors', 'materials.vendor_id', 'vendors.id')
      .select(
        'materials.*',
        'companies.name as company_name',
        'companies.code as company_code',
        'vendors.name as vendor_name',
        'vendors.code as vendor_code'
      );

    if (activeOnly !== 'false') {
      query.where('materials.is_active', true);
    }

    if (search) {
      query.andWhere(b => {
        b.where('materials.name', 'like', `%${search}%`)
         .orWhere('materials.code', 'like', `%${search}%`)
         .orWhere('materials.description', 'like', `%${search}%`);
      });
    }

    if (category) {
      query.andWhere('materials.uom_category', category);
    }

    if (companyId) {
      query.andWhere('materials.company_id', companyId);
    }

    if (vendorId) {
      query.andWhere('materials.vendor_id', vendorId);
    }

    const materials = await query.orderBy('materials.name', 'asc');
    return res.json({ success: true, data: materials });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch materials.', error: err.message });
  }
});

// POST /api/v1/materials/bulk - Bulk Import/Upload/Update Materials
router.post('/bulk', authenticateToken, async (req, res) => {
  try {
    const { materials } = req.body;
    if (!Array.isArray(materials) || materials.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid materials list.' });
    }

    let inserted = 0;
    let updated = 0;

    await db.transaction(async (trx) => {
      for (const m of materials) {
        if (!m.code || !m.name) continue;

        // Clean values
        const payload = {
          code: String(m.code).trim(),
          name: String(m.name).trim(),
          description: m.description ? String(m.description).trim() : null,
          uom_category: m.uom_category ? String(m.uom_category).trim() : 'MASS',
          default_uom: m.default_uom ? String(m.default_uom).trim() : 'g',
          cost: m.cost && !isNaN(Number(m.cost)) ? Number(m.cost) : 0,
          currency_code: m.currency_code ? String(m.currency_code).trim() : 'PHP',
          density_kg_per_l: (m.density_kg_per_l !== null && m.density_kg_per_l !== undefined && !isNaN(Number(m.density_kg_per_l))) ? Number(m.density_kg_per_l) : null,
          specific_gravity: (m.specific_gravity !== null && m.specific_gravity !== undefined && !isNaN(Number(m.specific_gravity))) ? Number(m.specific_gravity) : null,
          is_active: m.is_active !== undefined ? Boolean(m.is_active) : true,
          updated_at: trx.fn.now(),
        };

        const existing = await trx('materials').where({ code: payload.code }).first();
        if (existing) {
          const oldCost = Number(existing.cost || 0);
          const newCost = Number(payload.cost || 0);
          if (oldCost !== newCost) {
            await trx('material_cost_history').insert({
              material_id: existing.id,
              previous_cost: oldCost,
              new_cost: newCost,
              currency_code: payload.currency_code,
              changed_by_user_id: req.user.id,
              notes: 'Bulk import update',
            });
          }

          await trx('materials').where({ id: existing.id }).update(payload);
          updated++;
        } else {
          payload.created_at = trx.fn.now();
          const [newId] = await trx('materials').insert(payload).then(res => [res[0]]);
          
          await trx('material_cost_history').insert({
            material_id: newId,
            previous_cost: 0,
            new_cost: payload.cost,
            currency_code: payload.currency_code,
            changed_by_user_id: req.user.id,
            notes: 'Bulk import initial cost',
          });

          inserted++;
        }
      }
    });

    return res.json({ success: true, message: `Successfully imported ${inserted} new and updated ${updated} existing materials.`, data: { inserted, updated } });
  } catch (err) {
    console.error('Bulk upload error:', err);
    return res.status(500).json({ success: false, message: 'Bulk upload failed.', error: err.message });
  }
});

// GET /api/v1/materials/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const material = await db('materials')
      .leftJoin('companies', 'materials.company_id', 'companies.id')
      .leftJoin('vendors', 'materials.vendor_id', 'vendors.id')
      .where('materials.id', req.params.id)
      .select(
        'materials.*',
        'companies.name as company_name',
        'vendors.name as vendor_name'
      )
      .first();

    if (!material) {
      return res.status(404).json({ success: false, message: 'Material not found.' });
    }

    return res.json({ success: true, data: material });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch material details.', error: err.message });
  }
});

// GET /api/v1/materials/:id/cost-history
router.get('/:id/cost-history', authenticateToken, async (req, res) => {
  try {
    const history = await db('material_cost_history')
      .leftJoin('users', 'material_cost_history.changed_by_user_id', 'users.id')
      .where('material_cost_history.material_id', req.params.id)
      .select(
        'material_cost_history.*',
        'users.username as changed_by_username',
        'users.first_name as changed_by_first_name',
        'users.last_name as changed_by_last_name'
      )
      .orderBy('material_cost_history.created_at', 'desc');

    return res.json({ success: true, data: history });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch material cost history.', error: err.message });
  }
});

// POST /api/v1/materials - Create Material (Matches exact requested fields)
router.post('/', authenticateToken, requireRoles('Super Admin', 'Formulator'), async (req, res) => {
  try {
    const {
      name,
      code,
      companyId,
      vendorId,
      uom,
      cost,
      currencyCode,
      densityKgPerL,
      specificGravity,
      unitWeight,
      unitWeightUom,
      description,
      isInventoried,
    } = req.body;

    if (!name || !code || !uom) {
      return res.status(400).json({ success: false, message: 'Material Name, Code, and UOM are required.' });
    }

    const existing = await db('materials').where({ code }).first();
    if (existing) {
      return res.status(400).json({ success: false, message: `Material Code '${code}' already exists.` });
    }

    const uomCategory = UOM_CATEGORIES[uom] || 'MASS';
    const costDec = new Decimal(cost || '0').toFixed(6);
    const densityDec = new Decimal(densityKgPerL || '1.000000').toFixed(6);
    const sgDec = new Decimal(specificGravity || densityKgPerL || '1.000000').toFixed(6);
    const unitWtDec = unitWeight ? new Decimal(unitWeight).toFixed(6) : null;

    const [materialId] = await db('materials').insert({
      code,
      name,
      company_id: companyId || null,
      vendor_id: vendorId || null,
      uom,
      uom_category: uomCategory,
      cost: costDec,
      currency_code: currencyCode || 'PHP',
      density_kg_per_l: densityDec,
      specific_gravity: sgDec,
      unit_weight: unitWtDec,
      unit_weight_uom: unitWeightUom || null,
      description: description || null,
      is_inventoried: Boolean(isInventoried), // Descriptive reference field only
      is_active: true,
    }).then(res => [res[0]]);

    // Record initial cost history entry
    await db('material_cost_history').insert({
      material_id: materialId,
      old_cost: '0.000000',
      new_cost: costDec,
      old_currency_code: currencyCode || 'PHP',
      new_currency_code: currencyCode || 'PHP',
      effective_date: db.fn.now(),
      changed_by_user_id: req.user.id,
    });

    await logAudit(req, 'CREATE_MATERIAL', 'Material', materialId, null, { code, name, cost: costDec });
    return res.status(201).json({ success: true, message: 'Material created successfully.', materialId });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to create material.', error: err.message });
  }
});

// PUT /api/v1/materials/:id - Edit Material (Tracks cost history automatically)
router.put('/:id', authenticateToken, requireRoles('Super Admin', 'Formulator'), async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db('materials').where({ id }).first();
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Material not found.' });
    }

    const {
      name,
      companyId,
      vendorId,
      uom,
      cost,
      currencyCode,
      densityKgPerL,
      specificGravity,
      unitWeight,
      unitWeightUom,
      description,
      isInventoried,
    } = req.body;

    const uomCategory = uom ? (UOM_CATEGORIES[uom] || existing.uom_category) : existing.uom_category;
    const newCostDec = cost !== undefined ? new Decimal(cost).toFixed(6) : existing.cost;
    const newCurrency = currencyCode || existing.currency_code;
    const oldCostDec = existing.cost;
    const oldCurrency = existing.currency_code;

    await db('materials').where({ id }).update({
      name: name || existing.name,
      company_id: companyId !== undefined ? companyId : existing.company_id,
      vendor_id: vendorId !== undefined ? vendorId : existing.vendor_id,
      uom: uom || existing.uom,
      uom_category: uomCategory,
      cost: newCostDec,
      currency_code: newCurrency,
      density_kg_per_l: densityKgPerL !== undefined ? new Decimal(densityKgPerL).toFixed(6) : existing.density_kg_per_l,
      specific_gravity: specificGravity !== undefined ? new Decimal(specificGravity).toFixed(6) : existing.specific_gravity,
      unit_weight: unitWeight !== undefined ? (unitWeight ? new Decimal(unitWeight).toFixed(6) : null) : existing.unit_weight,
      unit_weight_uom: unitWeightUom !== undefined ? unitWeightUom : existing.unit_weight_uom,
      description: description !== undefined ? description : existing.description,
      is_inventoried: isInventoried !== undefined ? Boolean(isInventoried) : existing.is_inventoried,
      updated_at: db.fn.now(),
    });

    // Check if cost or currency changed -> insert into material_cost_history
    if (newCostDec !== oldCostDec || newCurrency !== oldCurrency) {
      await db('material_cost_history').insert({
        material_id: id,
        old_cost: oldCostDec,
        new_cost: newCostDec,
        old_currency_code: oldCurrency,
        new_currency_code: newCurrency,
        effective_date: db.fn.now(),
        changed_by_user_id: req.user.id,
      });
    }

    await logAudit(req, 'UPDATE_MATERIAL', 'Material', id, existing, { cost: newCostDec, currency: newCurrency });
    return res.json({ success: true, message: 'Material updated successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update material.', error: err.message });
  }
});

// DELETE /api/v1/materials/:id - Soft delete / Deactivate
router.delete('/:id', authenticateToken, requireRoles('Super Admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const material = await db('materials').where({ id }).first();
    if (!material) {
      return res.status(404).json({ success: false, message: 'Material not found.' });
    }

    await db('materials').where({ id }).update({
      is_active: false,
      archived_at: db.fn.now(),
      archived_by: req.user.id,
    });

    await logAudit(req, 'DEACTIVATE_MATERIAL', 'Material', id, { is_active: true }, { is_active: false });
    return res.json({ success: true, message: 'Material deactivated.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to deactivate material.', error: err.message });
  }
});

export default router;
