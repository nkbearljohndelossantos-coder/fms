import db from '../db.js';

/**
 * Log an audit trail entry for sensitive actions
 */
export async function logAudit(req, action, entity, entityId, previousValues = null, newValues = null) {
  try {
    const userId = req.user ? req.user.id : null;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    await db('audit_logs').insert({
      user_id: userId,
      action,
      entity,
      entity_id: entityId,
      previous_values: previousValues ? JSON.stringify(previousValues) : null,
      new_values: newValues ? JSON.stringify(newValues) : null,
      ip_address: ipAddress,
      user_agent: userAgent,
    });
  } catch (err) {
    console.error('Audit Logging Error:', err);
  }
}
