import crypto from 'crypto';

/**
 * Concurrency-Safe Cryptographic Append-Only Audit Logger
 * Maintains a tamper-evident hash chain:
 * entry_hash = SHA256(sequence_number + previous_hash + payload + timestamp)
 */
export class AuditService {
  static async logEvent({
    trx,
    userId,
    userRole = 'System',
    action,
    entityType,
    entityId,
    oldValues = null,
    newValues = null,
    ipAddress = '127.0.0.1',
    userAgent = 'System',
    signatureRef = null,
  }) {
    if (!trx) {
      throw new Error('AuditService.logEvent requires an active knex transaction context (trx).');
    }

    const lastLog = await trx('audit_logs')
      .orderBy('sequence_number', 'desc')
      .first()
      .forUpdate();

    const sequenceNumber = lastLog ? Number(lastLog.sequence_number || lastLog.id || 0) + 1 : 1;
    const previousHash = lastLog ? (lastLog.entry_hash || lastLog.hash || 'GENESIS_HASH_00000000000000000000000000000000000000000000000000000000') : 'GENESIS_HASH_00000000000000000000000000000000000000000000000000000000';

    const timestampUtc = new Date().toISOString();

    const payloadObj = {
      sequenceNumber,
      previousHash,
      userId,
      userRole,
      action,
      entityType,
      entityId: String(entityId),
      oldValues: oldValues ? JSON.stringify(oldValues) : null,
      newValues: newValues ? JSON.stringify(newValues) : null,
      timestampUtc,
    };

    const canonicalPayload = JSON.stringify(payloadObj);
    const entryHash = crypto.createHash('sha256').update(canonicalPayload).digest('hex');

    const insertData = {
      sequence_number: sequenceNumber,
      previous_hash: previousHash,
      entry_hash: entryHash,
      algorithm_version: 'SHA256',
      user_id: userId,
      action,
      entity: String(entityType),
      entity_id: entityId ? Number(entityId) : null,
      previous_values: oldValues ? JSON.stringify(oldValues) : null,
      new_values: newValues ? JSON.stringify(newValues) : null,
      ip_address: ipAddress,
      user_agent: userAgent,
      created_at: timestampUtc,
    };

    const [insertedId] = await trx('audit_logs').insert(insertData).then(res => [res[0]]);

    return {
      id: insertedId,
      sequenceNumber,
      previousHash,
      entryHash,
    };
  }

  static verifyChainIntegrity(auditLogs) {
    let previousHash = 'GENESIS_HASH_00000000000000000000000000000000000000000000000000000000';
    for (let i = 0; i < auditLogs.length; i++) {
      const log = auditLogs[i];
      if (log.previous_hash && log.previous_hash !== previousHash) {
        return { valid: false, brokenAtIndex: i, reason: 'Previous hash mismatch' };
      }
      if (log.entry_hash) {
        previousHash = log.entry_hash;
      }
    }
    return { valid: true };
  }
}
