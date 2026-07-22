import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import db from '../db.js';

/**
 * Two-Step Electronic Signature Challenge Service
 * Step 1: Issue short-lived, single-use, purpose-bound signature token after verifying password/PIN
 * Step 2: Main business API endpoint consumes the signature token (raw password/PIN is never passed directly)
 */
export class SignatureService {
  /**
   * Step 1: Create signature challenge token
   */
  static async createChallengeToken({ userId, passwordOrPin, action, entityType, entityId, reason }) {
    const user = await db('users').where({ id: userId, is_active: true }).first();
    if (!user) {
      const err = new Error('User not found or inactive');
      err.status = 401;
      throw err;
    }

    const isValidPassword = await bcrypt.compare(passwordOrPin, user.password_hash);
    if (!isValidPassword) {
      const err = new Error('Invalid signature password or PIN credentials');
      err.status = 401;
      throw err;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const nonce = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

    const [id] = await db('electronic_signatures').insert({
      token_hash: tokenHash,
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: String(entityId),
      nonce,
      reason: reason || null,
      is_consumed: false,
      expires_at: expiresAt,
    }).then(res => [res[0]]);

    return {
      signatureToken: rawToken,
      expiresAt: expiresAt.toISOString(),
      action,
      entityType,
      entityId: String(entityId),
    };
  }

  /**
   * Step 2: Verify and consume signature token inside parent transaction
   */
  static async verifyAndConsume({ signatureToken, userId, action, entityType, entityId, trx }) {
    const dbClient = trx || db;
    if (!signatureToken) {
      const err = new Error('Electronic signature token is required for this action');
      err.status = 401;
      throw err;
    }

    const tokenHash = crypto.createHash('sha256').update(signatureToken).digest('hex');
    const sigRecord = await dbClient('electronic_signatures')
      .where({ token_hash: tokenHash })
      .first();

    if (!sigRecord) {
      const err = new Error('Invalid electronic signature token');
      err.status = 401;
      throw err;
    }

    if (sigRecord.is_consumed) {
      const err = new Error('Electronic signature token has already been consumed (single-use constraint)');
      err.status = 409;
      throw err;
    }

    if (new Date(sigRecord.expires_at) < new Date()) {
      const err = new Error('Electronic signature token has expired');
      err.status = 401;
      throw err;
    }

    if (Number(sigRecord.user_id) !== Number(userId)) {
      const err = new Error('Electronic signature token was issued to a different user');
      err.status = 403;
      throw err;
    }

    if (sigRecord.action !== action || sigRecord.entity_type !== entityType || String(sigRecord.entity_id) !== String(entityId)) {
      const err = new Error('Electronic signature token purpose mismatch (action/entity mismatch)');
      err.status = 422;
      throw err;
    }

    // Mark as consumed
    await dbClient('electronic_signatures')
      .where({ id: sigRecord.id })
      .update({ is_consumed: true, updated_at: dbClient.fn.now() });

    return { ...sigRecord, is_consumed: true };
  }
}
