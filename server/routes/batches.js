import { express } from '../cjsRequire.js';
import Decimal from 'decimal.js';
import crypto from 'crypto';
import db from '../db.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import { AuditService } from '../services/AuditService.js';
import { SignatureService } from '../services/SignatureService.js';
import { SequenceService } from '../services/SequenceService.js';

const router = express.Router();

// GET /api/v1/batches - List Batches
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, category, operatorId } = req.query;

    const query = db('production_batches')
      .leftJoin('formulas', 'production_batches.formula_id', 'formulas.id')
      .leftJoin('formula_versions', 'production_batches.formula_version_id', 'formula_versions.id')
      .leftJoin('users as op', 'production_batches.assigned_operator_id', 'op.id')
      .leftJoin('machines as m', 'production_batches.assigned_machine_id', 'm.id')
      .select(
        'production_batches.*',
        'formulas.code as formula_code',
        'formulas.name as formula_name',
        'formula_versions.major_version',
        'formula_versions.minor_version',
        'op.first_name as operator_first_name',
        'op.last_name as operator_last_name',
        'm.name as machine_name',
        'm.code as machine_code'
      );

    if (status) query.andWhere('production_batches.status', status);
    if (category) query.andWhere('production_batches.category', category);
    if (operatorId) query.andWhere('production_batches.assigned_operator_id', operatorId);

    const batches = await query.orderBy('production_batches.updated_at', 'desc');

    return res.json({ success: true, data: batches });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch batches.', error: err.message });
  }
});

// GET /api/v1/batches/:id - Full MES Batch View Details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const batch = await db('production_batches')
      .leftJoin('formulas', 'production_batches.formula_id', 'formulas.id')
      .leftJoin('formula_versions', 'production_batches.formula_version_id', 'formula_versions.id')
      .leftJoin('users as op', 'production_batches.assigned_operator_id', 'op.id')
      .leftJoin('machines as m', 'production_batches.assigned_machine_id', 'm.id')
      .where('production_batches.id', id)
      .select(
        'production_batches.*',
        'formulas.code as formula_code',
        'formulas.name as formula_name',
        'formula_versions.major_version',
        'formula_versions.minor_version',
        'op.first_name as operator_first_name',
        'op.last_name as operator_last_name',
        'm.name as machine_name',
        'm.code as machine_code'
      )
      .first();

    if (!batch) {
      return res.status(404).json({ success: false, message: 'Production batch not found.' });
    }

    const phases = await db('batch_phases').where({ batch_id: id }).orderBy('sequence', 'asc');
    const steps = await db('batch_steps').where({ batch_id: id }).orderBy('step_number', 'asc');
    const requirements = await db('batch_material_requirements').where({ batch_id: id });
    const entries = await db('batch_material_entries').where({ batch_id: id }).orderBy('weighed_at', 'asc');
    const lock = await db('batch_execution_locks').where({ batch_id: id }).first();
    const deviations = await db('batch_deviations').where({ batch_id: id }).orderBy('created_at', 'desc');

    return res.json({
      success: true,
      data: {
        batch,
        phases,
        steps,
        requirements,
        entries,
        lock,
        deviations,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch batch detail.', error: err.message });
  }
});

// POST /api/v1/batches/:id/start - Pre-start validation & MES Execution Lock
router.post('/:id/start', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { machineId, signatureToken } = req.body;

    const batch = await db('production_batches').where({ id }).first();
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found.' });

    // 1. Validate assigned operator
    if (batch.assigned_operator_id && Number(batch.assigned_operator_id) !== Number(req.user.id)) {
      if (!req.user.roles.includes('Super Admin') && !req.user.roles.includes('Production Supervisor')) {
        return res.status(403).json({ success: false, message: 'This batch is assigned to a different operator.' });
      }
    }

    // 2. Validate machine authorization
    const targetMachineId = machineId || batch.assigned_machine_id;
    if (targetMachineId) {
      const authRec = await db('operator_machine_authorizations')
        .where({ user_id: req.user.id, machine_id: targetMachineId })
        .first();

      if (!authRec && !req.user.roles.includes('Super Admin')) {
        return res.status(403).json({
          success: false,
          message: 'Operator is not authorized to operate this compounding machine.',
        });
      }
    }

    // 3. Validate conflicting execution lock
    const now = new Date();
    const activeLock = await db('batch_execution_locks').where({ batch_id: id }).first();
    if (activeLock && new Date(activeLock.expires_at) > now && Number(activeLock.locked_by_user_id) !== Number(req.user.id)) {
      return res.status(409).json({
        success: false,
        message: 'Batch is currently locked by another operator in active compounding execution.',
      });
    }

    // 4. Verify & Consume 2-Step Electronic Signature Token
    await SignatureService.verifyAndConsume({
      signatureToken,
      userId: req.user.id,
      action: 'START_BATCH',
      entityType: 'ProductionBatch',
      entityId: id,
    });

    const lockToken = crypto.randomBytes(24).toString('hex');
    const lockExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min TTL

    await db.transaction(async (trx) => {
      // Upsert lock
      if (activeLock) {
        await trx('batch_execution_locks').where({ batch_id: id }).update({
          locked_by_user_id: req.user.id,
          lock_token: lockToken,
          heartbeat_at: trx.fn.now(),
          expires_at: lockExpiresAt,
          updated_at: trx.fn.now(),
        });
      } else {
        await trx('batch_execution_locks').insert({
          batch_id: id,
          locked_by_user_id: req.user.id,
          lock_token: lockToken,
          expires_at: lockExpiresAt,
        });
      }

      await trx('production_batches').where({ id }).update({
        status: 'In Progress',
        assigned_operator_id: req.user.id,
        assigned_machine_id: targetMachineId || batch.assigned_machine_id,
        started_at: trx.fn.now(),
        updated_at: trx.fn.now(),
      });

      await AuditService.logEvent({
        trx,
        userId: req.user.id,
        userRole: req.user.roles[0] || 'Operator',
        action: 'START_BATCH',
        entityType: 'ProductionBatch',
        entityId: id,
        newValues: { status: 'In Progress', lockToken },
      });
    });

    return res.json({
      success: true,
      message: `Batch ${batch.batch_number} started. MES Execution Lock engaged.`,
      lockToken,
    });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

// POST /api/v1/batches/:id/weigh-step - Single-Step MES Weighing Execution
router.post('/:id/weigh-step', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { stepId, actualWeight, scaleMode, operatorNotes, lockVersion } = req.body;

    if (!stepId || actualWeight === undefined || actualWeight === null) {
      return res.status(400).json({ success: false, message: 'stepId and actualWeight are required.' });
    }

    const actualWtDec = new Decimal(actualWeight);
    if (actualWtDec.isNegative()) {
      return res.status(422).json({ success: false, message: 'Actual weight cannot be negative.' });
    }

    const batch = await db('production_batches').where({ id }).first();
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found.' });

    const step = await db('batch_steps').where({ id: stepId, batch_id: id }).first();
    if (!step) return res.status(404).json({ success: false, message: 'Step not found.' });

    // Optimistic Concurrency Control Check
    if (lockVersion !== undefined && Number(lockVersion) !== Number(step.lock_version)) {
      return res.status(409).json({
        success: false,
        message: 'Step version conflict (HTTP 409). Another operator confirmed this step. Reloading...',
      });
    }

    const reqMat = await db('batch_material_requirements').where({ step_id: stepId }).first();
    if (!reqMat) {
      return res.status(400).json({ success: false, message: 'No material requirement found for this step.' });
    }

    const targetWtDec = new Decimal(reqMat.target_weight);
    const variancePctDec = actualWtDec.minus(targetWtDec).div(targetWtDec).times(100);
    const minWtDec = new Decimal(reqMat.min_weight);
    const maxWtDec = new Decimal(reqMat.max_weight);

    const isWithinTol = actualWtDec.gte(minWtDec) && actualWtDec.lte(maxWtDec);

    const result = await db.transaction(async (trx) => {
      if (isWithinTol) {
        // Within tolerance -> record entry and complete step
        const [entryId] = await trx('batch_material_entries').insert({
          batch_id: id,
          step_id: stepId,
          material_id: reqMat.material_id,
          operator_id: req.user.id,
          scale_mode: scaleMode || 'Manual',
          actual_weight: actualWtDec.toFixed(6),
          variance_percent: variancePctDec.toFixed(6),
          is_within_tolerance: true,
          operator_notes: operatorNotes || null,
        }).then(r => [r[0]]);

        await trx('batch_steps').where({ id: stepId }).update({
          status: 'Completed',
          lock_version: step.lock_version + 1,
          completed_at: trx.fn.now(),
        });

        // Compute overall batch progress
        const allSteps = await trx('batch_steps').where({ batch_id: id });
        const completedCount = allSteps.filter(s => s.status === 'Completed' || s.id === Number(stepId)).length;
        const progressPct = new Decimal(completedCount).div(allSteps.length).times(100).toFixed(6);

        await trx('production_batches').where({ id }).update({
          overall_progress_percent: progressPct,
          updated_at: trx.fn.now(),
        });

        await AuditService.logEvent({
          trx,
          userId: req.user.id,
          userRole: req.user.roles[0] || 'Operator',
          action: 'WEIGH_STEP_CONFIRMED',
          entityType: 'BatchStep',
          entityId: stepId,
          newValues: { actualWeight: actualWtDec.toFixed(6), variancePercent: variancePctDec.toFixed(6) },
        });

        return { status: 'Completed', isWithinTolerance: true, variancePercent: variancePctDec.toFixed(2), entryId };
      } else {
        // Out of tolerance -> generate DEVIATION record and block step
        const devCode = await SequenceService.getNextSequence('DEVIATION_CODE', trx);

        const [devId] = await trx('batch_deviations').insert({
          deviation_code: devCode,
          batch_id: id,
          step_id: stepId,
          operator_id: req.user.id,
          target_weight: targetWtDec.toFixed(6),
          actual_weight: actualWtDec.toFixed(6),
          variance_percent: variancePctDec.toFixed(6),
          reason: operatorNotes || 'Weighed value out of tolerance',
          status: 'Pending Review',
        }).then(r => [r[0]]);

        await trx('batch_steps').where({ id: stepId }).update({
          status: 'Deviation',
          lock_version: step.lock_version + 1,
        });

        await AuditService.logEvent({
          trx,
          userId: req.user.id,
          userRole: req.user.roles[0] || 'Operator',
          action: 'WEIGH_DEVIATION_FLAGGED',
          entityType: 'BatchDeviation',
          entityId: devId,
          newValues: { deviationCode: devCode, variancePercent: variancePctDec.toFixed(6) },
        });

        return { status: 'Deviation', isWithinTolerance: false, variancePercent: variancePctDec.toFixed(2), deviationId: devId, devCode };
      }
    });

    if (!result.isWithinTolerance) {
      return res.status(422).json({
        success: false,
        message: `Out of tolerance (${result.variancePercent}% variance). Step BLOCKED pending Production Supervisor deviation review.`,
        data: result,
      });
    }

    return res.json({
      success: true,
      message: 'Step weighed and confirmed successfully.',
      data: result,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/v1/batches/:id/deviations/:devId/approve - Supervisor Deviation Review
router.post('/:id/deviations/:devId/approve', authenticateToken, async (req, res) => {
  try {
    const { id, devId } = req.params;
    const { decision, remarks, signatureToken } = req.body;

    if (!req.user.permissions?.includes('deviation.review') && !req.user.roles?.includes('Super Admin') && !req.user.roles?.includes('Production Supervisor')) {
      return res.status(403).json({ success: false, message: 'Forbidden. Supervisor deviation review permission required.' });
    }

    if (!decision || !['Accepted Deviation', 'Correction Required', 'Rejected'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Valid decision (Accepted Deviation / Correction Required / Rejected) is required.' });
    }

    // Verify 2-step Electronic Signature token
    await SignatureService.verifyAndConsume({
      signatureToken,
      userId: req.user.id,
      action: 'APPROVE_DEVIATION',
      entityType: 'BatchDeviation',
      entityId: devId,
    });

    await db.transaction(async (trx) => {
      await trx('batch_deviations').where({ id: devId }).update({
        status: decision,
        supervisor_id: req.user.id,
        reviewed_at: trx.fn.now(),
        updated_at: trx.fn.now(),
      });

      await trx('batch_deviation_approvals').insert({
        deviation_id: devId,
        supervisor_id: req.user.id,
        decision,
        remarks: remarks || null,
      });

      const dev = await trx('batch_deviations').where({ id: devId }).first();

      if (decision === 'Accepted Deviation') {
        // Unblock step and mark as Completed
        await trx('batch_steps').where({ id: dev.step_id }).update({
          status: 'Completed',
          completed_at: trx.fn.now(),
        });
      }

      await AuditService.logEvent({
        trx,
        userId: req.user.id,
        userRole: req.user.roles[0] || 'Supervisor',
        action: 'DEVIATION_REVIEWED',
        entityType: 'BatchDeviation',
        entityId: devId,
        newValues: { decision, remarks },
      });
    });

    return res.json({ success: true, message: `Deviation review recorded: ${decision}` });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

// POST /api/v1/batches/:id/complete - Complete Compounding Execution & Transfer to QC
router.post('/:id/complete', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { signatureToken, remarks } = req.body;

    const batch = await db('production_batches').where({ id }).first();
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found.' });

    // Verify all steps completed
    const pendingSteps = await db('batch_steps').where({ batch_id: id }).andWhereNot({ status: 'Completed' });
    if (pendingSteps.length > 0) {
      return res.status(422).json({
        success: false,
        message: `Cannot complete batch. ${pendingSteps.length} required step(s) are still pending or in deviation.`,
      });
    }

    // Verify 2-step Electronic Signature
    await SignatureService.verifyAndConsume({
      signatureToken,
      userId: req.user.id,
      action: 'COMPLETE_BATCH',
      entityType: 'ProductionBatch',
      entityId: id,
    });

    await db.transaction(async (trx) => {
      // Release execution lock
      await trx('batch_execution_locks').where({ batch_id: id }).del();

      await trx('production_batches').where({ id }).update({
        status: 'Pending QC',
        overall_progress_percent: '100.000000',
        completed_at: trx.fn.now(),
        updated_at: trx.fn.now(),
      });

      // Find matching QC template for category
      const qcTemplate = await trx('qc_templates').where({ category: batch.category, is_active: true }).first();
      if (qcTemplate) {
        await trx('qc_inspections').insert({
          batch_id: id,
          template_id: qcTemplate.id,
          status: 'Pending QC',
          lock_version: 1,
        });
      }

      await AuditService.logEvent({
        trx,
        userId: req.user.id,
        userRole: req.user.roles[0] || 'Operator',
        action: 'COMPLETE_BATCH',
        entityType: 'ProductionBatch',
        entityId: id,
        newValues: { status: 'Pending QC', remarks },
      });
    });

    return res.json({ success: true, message: `Batch ${batch.batch_number} compounding completed. Submitted to Quality Control.` });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

export default router;
