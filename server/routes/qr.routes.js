import { express } from '../cjsRequire.js';
import crypto from 'crypto';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// POST /api/v1/qr/validate - Validate tokenized QR code
router.post('/validate', authenticateToken, async (req, res) => {
  try {
    const { qrToken, qrCode } = req.body;
    const tokenInput = qrToken || qrCode;

    if (!tokenInput || typeof tokenInput !== 'string') {
      return res.status(400).json({ success: false, message: 'QR token parameter is required.' });
    }

    const cleanToken = tokenInput.trim();
    const tokenHash = crypto.createHash('sha256').update(cleanToken).digest('hex');

    // Query token record by hash or direct token string lookup
    let tokenRec = await db('qr_tokens').where({ token_hash: tokenHash }).first();
    if (!tokenRec) {
      // Fallback lookup if direct batch_number or token payload sent
      const batchRec = await db('production_batches').where({ batch_number: cleanToken }).first();
      if (batchRec) {
        tokenRec = await db('qr_tokens').where({ batch_id: batchRec.id }).first();
      }
    }

    if (!tokenRec) {
      return res.status(404).json({ success: false, message: 'Invalid or unrecognized QR token.' });
    }

    if (tokenRec.is_revoked) {
      return res.status(422).json({ success: false, message: 'This QR token has been revoked.' });
    }

    if (new Date(tokenRec.expires_at) < new Date()) {
      return res.status(422).json({ success: false, message: 'This QR token has expired.' });
    }

    if (tokenRec.is_single_use && tokenRec.is_consumed) {
      return res.status(422).json({ success: false, message: 'Single-use QR token has already been consumed.' });
    }

    let batchData = null;
    if (tokenRec.batch_id) {
      batchData = await db('production_batches')
        .leftJoin('formulas', 'production_batches.formula_id', 'formulas.id')
        .leftJoin('formula_versions', 'production_batches.formula_version_id', 'formula_versions.id')
        .leftJoin('users as op', 'production_batches.assigned_operator_id', 'op.id')
        .leftJoin('machines as m', 'production_batches.assigned_machine_id', 'm.id')
        .where('production_batches.id', tokenRec.batch_id)
        .select(
          'production_batches.*',
          'formulas.code as formula_code',
          'formulas.name as formula_name',
          'formula_versions.major_version',
          'formula_versions.minor_version',
          'op.first_name as operator_first_name',
          'op.last_name as operator_last_name',
          'm.name as machine_name'
        )
        .first();
    }

    return res.json({
      success: true,
      valid: true,
      message: 'QR Code validated successfully.',
      data: {
        tokenId: tokenRec.id,
        batch: batchData,
        expiresAt: tokenRec.expires_at,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/v1/qr/generate - Generate standalone QR token for batch
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const { batchId, isSingleUse } = req.body;
    if (!batchId) return res.status(400).json({ success: false, message: 'batchId is required.' });

    const batch = await db('production_batches').where({ id: batchId }).first();
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found.' });

    const rawQrToken = crypto.randomBytes(32).toString('hex');
    const qrHash = crypto.createHash('sha256').update(rawQrToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const [id] = await db('qr_tokens').insert({
      token_hash: qrHash,
      batch_id: batchId,
      formula_version_id: batch.formula_version_id,
      is_single_use: Boolean(isSingleUse),
      expires_at: expiresAt,
    }).then(r => [r[0]]);

    return res.status(201).json({
      success: true,
      message: 'QR Token generated successfully.',
      qrToken: rawQrToken,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
