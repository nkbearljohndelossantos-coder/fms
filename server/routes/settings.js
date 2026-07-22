import { express } from '../cjsRequire.js';
import db from '../db.js';
import { authenticateToken, requireRoles } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';

const router = express.Router();

// GET /api/v1/settings
router.get('/', authenticateToken, async (req, res) => {
  try {
    const settings = await db('system_settings').select('*');
    const settingsMap = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }
    return res.json({ success: true, data: settingsMap, raw: settings });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch settings.', error: err.message });
  }
});

// PUT /api/v1/settings
router.put('/', authenticateToken, requireRoles('Super Admin'), async (req, res) => {
  try {
    const { settings } = req.body; // Object of key-value pairs
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, message: 'Settings object required.' });
    }

    for (const [key, value] of Object.entries(settings)) {
      const existing = await db('system_settings').where({ key }).first();
      if (existing) {
        await db('system_settings').where({ key }).update({ value: String(value), updated_at: db.fn.now() });
      } else {
        await db('system_settings').insert({ key, value: String(value) });
      }
    }

    await logAudit(req, 'UPDATE_SYSTEM_SETTINGS', 'SystemSettings', null, null, settings);
    return res.json({ success: true, message: 'System settings updated successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update settings.', error: err.message });
  }
});

// POST /api/v1/settings/reset - Dangerous Database Reset (Super Admin Only)
router.post('/reset', authenticateToken, requireRoles('Super Admin'), async (req, res) => {
  try {
    const { confirmation } = req.body;
    if (confirmation !== 'RESET_ALL_DATA') {
      return res.status(400).json({ success: false, message: 'Invalid confirmation code. Please type RESET_ALL_DATA.' });
    }

    await db.raw('SET FOREIGN_KEY_CHECKS = 0');

    const tables = [
      'production_batches',
      'batch_phases',
      'batch_steps',
      'batch_material_requirements',
      'batch_material_entries',
      'batch_assignments',
      'batch_execution_locks',
      'electronic_signatures',
      'qr_tokens',
      'formula_workflow_records',
      'formula_cost_snapshots',
      'formula_cost_snapshot_items',
      'formula_version_materials',
      'formula_instructions',
      'formula_phases',
      'cosmetic_formula_details',
      'perfume_formula_details',
      'supplement_formula_details',
      'formula_versions',
      'formulas',
      'material_cost_history',
      'materials',
      'audit_logs'
    ];

    for (const table of tables) {
      await db(table).truncate();
    }

    await db.raw('SET FOREIGN_KEY_CHECKS = 1');

    return res.json({ success: true, message: 'Database reset completed. All formulation, materials, and batch records have been permanently cleared.' });
  } catch (err) {
    console.error('Database reset failed:', err);
    try {
      await db.raw('SET FOREIGN_KEY_CHECKS = 1');
    } catch (_) {}
    return res.status(500).json({ success: false, message: 'Failed to reset database.', error: err.message });
  }
});

export default router;
