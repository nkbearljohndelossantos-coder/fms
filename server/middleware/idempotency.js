import crypto from 'crypto';
import db from '../db.js';

/**
 * Express middleware for Idempotency handling via X-Idempotency-Key
 * Same key + same payload -> returns original cached response
 * Same key + different payload -> returns HTTP 409 Conflict
 */
export function idempotencyMiddleware() {
  return async (req, res, next) => {
    const key = req.headers['x-idempotency-key'];
    if (!key || req.method === 'GET' || req.method === 'HEAD') {
      return next();
    }

    const userId = req.user ? req.user.id : 0;
    const rawPayload = JSON.stringify({ path: req.originalUrl || req.path, body: req.body });
    const requestHash = crypto.createHash('sha256').update(rawPayload).digest('hex');

    try {
      const existingKey = await db('idempotency_keys').where({ key }).first();

      if (existingKey) {
        if (existingKey.request_hash === requestHash) {
          // Payload matches -> return cached response
          return res.status(existingKey.response_status).json(JSON.parse(existingKey.response_body));
        } else {
          // Payload mismatch -> HTTP 409 Conflict
          return res.status(409).json({
            success: false,
            message: 'Idempotency Key payload mismatch. The same idempotency key cannot be re-used with a different request payload.',
          });
        }
      }

      // Capture original json/send response to store in database upon completion
      const originalJson = res.json;
      res.json = function (body) {
        res.json = originalJson;

        // Store idempotency response asynchronously
        if (res.statusCode >= 200 && res.statusCode < 400) {
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
          db('idempotency_keys')
            .insert({
              key,
              user_id: userId || 1,
              request_hash: requestHash,
              response_status: res.statusCode,
              response_body: JSON.stringify(body),
              expires_at: expiresAt,
            })
            .catch(() => {});
        }

        return originalJson.call(this, body);
      };

      next();
    } catch (err) {
      next();
    }
  };
}
