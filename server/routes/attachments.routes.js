import { express } from '../cjsRequire.js';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { AuditService } from '../services/AuditService.js';

const router = express.Router();
const UPLOAD_DIR = path.join(process.cwd(), 'server', 'storage', 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// GET /api/v1/attachments/:id/download - Protected Document Download
router.get('/:id/download', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const attachment = await db('document_attachments').where({ id }).first();

    if (!attachment) {
      return res.status(404).json({ success: false, message: 'Document attachment not found.' });
    }

    const filePath = attachment.storage_path;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File asset missing from secure storage.' });
    }

    res.setHeader('Content-Type', attachment.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${attachment.filename}"`);

    await db.transaction(async (trx) => {
      await AuditService.logEvent({
        trx,
        userId: req.user.id,
        userRole: req.user.roles[0] || 'User',
        action: 'DOWNLOAD_ATTACHMENT',
        entityType: 'DocumentAttachment',
        entityId: id,
        newValues: { filename: attachment.filename },
      });
    });

    const readStream = fs.createReadStream(filePath);
    return readStream.pipe(res);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
