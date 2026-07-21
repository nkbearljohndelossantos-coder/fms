import { express } from '../cjsRequire.js';
import db from '../db.js';
import { authenticateToken, requireRoles } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';

const router = express.Router();

// GET /api/v1/companies - List active companies
router.get('/', authenticateToken, async (req, res) => {
  try {
    const companies = await db('companies')
      .where({ is_active: true })
      .orderBy('name', 'asc');
    return res.json({ success: true, data: companies });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch companies.', error: err.message });
  }
});

// POST /api/v1/companies - Create company reference
router.post('/', authenticateToken, requireRoles('Super Admin', 'Formulator'), async (req, res) => {
  try {
    const { code, name, contactPerson, email, phone } = req.body;
    if (!code || !name) {
      return res.status(400).json({ success: false, message: 'Company code and name are required.' });
    }

    const existing = await db('companies').where({ code }).first();
    if (existing) {
      return res.status(400).json({ success: false, message: `Company code '${code}' already exists.` });
    }

    const [id] = await db('companies').insert({
      code,
      name,
      contact_person: contactPerson || null,
      email: email || null,
      phone: phone || null,
      is_active: true,
    }).then(res => [res[0]]);

    await logAudit(req, 'CREATE_COMPANY', 'Company', id, null, { code, name });
    return res.status(201).json({ success: true, message: 'Company reference created.', companyId: id });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to create company.', error: err.message });
  }
});

export default router;
