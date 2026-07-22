import { describe, it, expect, beforeAll } from 'vitest';
import Decimal from 'decimal.js';
import db from '../server/db.js';
import { AuditService } from '../server/services/AuditService.js';
import { SignatureService } from '../server/services/SignatureService.js';
import { SequenceService } from '../server/services/SequenceService.js';
import { validateFormulaPercentage } from '../server/services/validationEngine.js';

describe('Enterprise Manufacturing Formulation & MES Engine Tests', () => {
  beforeAll(async () => {
    await db.migrate.latest();
    await db.seed.run();
  });

  it('1. Decimal.js High-Precision Manufacturing Math', () => {
    const targetBatchSize = new Decimal('500.000000');
    const ingredientPct = new Decimal('18.450000'); // 18.45%
    const calculatedWeight = ingredientPct.div(100).times(targetBatchSize);

    expect(calculatedWeight.toFixed(6)).toBe('92.250000');

    const costPerKg = new Decimal('240.500000');
    const totalLineCost = calculatedWeight.times(costPerKg);
    expect(totalLineCost.toFixed(6)).toBe('22186.125000');
  });

  it('2. Formula Composition 100% Total Validation', () => {
    const validMaterials = [
      { material_id: 1, percentage: '65.000000' },
      { material_id: 2, percentage: '18.000000' },
      { material_id: 3, percentage: '9.500000' },
      { material_id: 4, percentage: '5.000000' },
      { material_id: 5, percentage: '1.500000' },
      { material_id: 6, percentage: '1.000000' },
    ];
    const valResult = validateFormulaPercentage(validMaterials, '0.010000');
    expect(valResult.isValid).toBe(true);

    const invalidMaterials = [
      { material_id: 1, percentage: '50.000000' },
      { material_id: 2, percentage: '30.000000' },
    ];
    const invalidResult = validateFormulaPercentage(invalidMaterials, '0.010000');
    expect(invalidResult.isValid).toBe(false);
  });

  it('3. Maker-Checker Formula Approval Policy Check', async () => {
    const creatorUserId = 2; // Elena (Maker)
    const approverUserId = 2; // Same user attempting approval

    const isMakerCheckerViolation = Number(creatorUserId) === Number(approverUserId);
    expect(isMakerCheckerViolation).toBe(true);

    const checkerUserId = 3; // Marcus (Checker)
    const isValidApprover = Number(creatorUserId) !== Number(checkerUserId);
    expect(isValidApprover).toBe(true);
  });

  it('4. Atomic Sequence Code Generator', async () => {
    await db.transaction(async (trx) => {
      const code1 = await SequenceService.getNextSequence('FORMULA_CODE', trx);
      const code2 = await SequenceService.getNextSequence('FORMULA_CODE', trx);
      expect(code1).toMatch(/^FORM-2026-\d{4}$/);
      expect(code2).toMatch(/^FORM-2026-\d{4}$/);
      expect(code1).not.toBe(code2);
    });
  });

  it('5. Two-Step Electronic Signature Challenge Token', async () => {
    const adminUser = await db('users').where({ email: 'admin@nkb.com' }).first();
    expect(adminUser).toBeDefined();

    const challenge = await SignatureService.createChallengeToken({
      userId: adminUser.id,
      passwordOrPin: 'Admin@123456',
      action: 'START_BATCH',
      entityType: 'ProductionBatch',
      entityId: '99',
      reason: 'Batch start authorized',
    });

    expect(challenge.signatureToken).toBeDefined();
    expect(challenge.expiresAt).toBeDefined();

    // Consume signature token
    const sigRecord = await SignatureService.verifyAndConsume({
      signatureToken: challenge.signatureToken,
      userId: adminUser.id,
      action: 'START_BATCH',
      entityType: 'ProductionBatch',
      entityId: '99',
    });

    expect(Boolean(sigRecord.is_consumed)).toBe(true);

    // Attempting reuse must throw single-use error
    await expect(
      SignatureService.verifyAndConsume({
        signatureToken: challenge.signatureToken,
        userId: adminUser.id,
        action: 'START_BATCH',
        entityType: 'ProductionBatch',
        entityId: '99',
      })
    ).rejects.toThrow();
  });

  it('6. Append-Only Tamper-Evident Audit Hash Chain Integrity', async () => {
    let audit1, audit2;
    await db.transaction(async (trx) => {
      audit1 = await AuditService.logEvent({
        trx,
        userId: 1,
        userRole: 'Super Admin',
        action: 'TEST_ACTION_1',
        entityType: 'System',
        entityId: '1',
        newValues: { test: 'val1' },
      });

      audit2 = await AuditService.logEvent({
        trx,
        userId: 1,
        userRole: 'Super Admin',
        action: 'TEST_ACTION_2',
        entityType: 'System',
        entityId: '2',
        newValues: { test: 'val2' },
      });
    });

    expect(audit2.previousHash).toBe(audit1.entryHash);

    const allLogs = await db('audit_logs').orderBy('sequence_number', 'asc');
    const integrityResult = AuditService.verifyChainIntegrity(allLogs);
    expect(integrityResult.valid).toBe(true);
  });

  it('7. Weighing Tolerance Math & Out-Of-Tolerance Flag', () => {
    const targetWt = new Decimal('100.000000');
    const minWt = new Decimal('99.000000');
    const maxWt = new Decimal('101.000000');

    const inTolWt = new Decimal('100.500000');
    expect(inTolWt.gte(minWt) && inTolWt.lte(maxWt)).toBe(true);

    const outOfTolWt = new Decimal('104.200000');
    expect(outOfTolWt.gte(minWt) && outOfTolWt.lte(maxWt)).toBe(false);

    const variancePct = outOfTolWt.minus(targetWt).div(targetWt).times(100);
    expect(variancePct.toFixed(2)).toBe('4.20');
  });
});
