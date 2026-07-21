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

export default router;
