import { express } from '../cjsRequire.js';
import db from '../db.js';
import { authenticateToken, requireRoles } from '../middleware/auth.js';

const router = express.Router();

// GET /api/v1/audit-logs
router.get('/', authenticateToken, requireRoles('Super Admin', 'Reviewer', 'Approver'), async (req, res) => {
  try {
    const { action, entity, limit = 100 } = req.query;

    const query = db('audit_logs')
      .leftJoin('users', 'audit_logs.user_id', 'users.id')
      .select('audit_logs.*', 'users.username', 'users.first_name', 'users.last_name');

    if (action) {
      query.andWhere('audit_logs.action', action);
    }
    if (entity) {
      query.andWhere('audit_logs.entity', entity);
    }

    const logs = await query.orderBy('audit_logs.created_at', 'desc').limit(Number(limit));
    return res.json({ success: true, data: logs });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch audit logs.', error: err.message });
  }
});

export default router;
