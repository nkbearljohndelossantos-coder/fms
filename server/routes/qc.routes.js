import { express } from '../cjsRequire.js';
import Decimal from 'decimal.js';
import db from '../db.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import { AuditService } from '../services/AuditService.js';
import { SignatureService } from '../services/SignatureService.js';
import { SequenceService } from '../services/SequenceService.js';

const router = express.Router();

// GET /api/v1/qc/inspections - List QC Inspections
router.get('/inspections', authenticateToken, async (req, res) => {
  try {
    const { status, category } = req.query;

    const query = db('qc_inspections')
      .join('production_batches', 'qc_inspections.batch_id', 'production_batches.id')
      .join('qc_templates', 'qc_inspections.template_id', 'qc_templates.id')
      .leftJoin('users as insp', 'qc_inspections.inspector_id', 'insp.id')
      .select(
        'qc_inspections.*',
        'production_batches.batch_number',
        'production_batches.target_batch_size',
        'production_batches.category as batch_category',
        'production_batches.assigned_operator_id',
        'qc_templates.code as template_code',
        'qc_templates.name as template_name',
        'insp.first_name as inspector_first_name',
        'insp.last_name as inspector_last_name'
      );

    if (status) query.andWhere('qc_inspections.status', status);
    if (category) query.andWhere('production_batches.category', category);

    const list = await query.orderBy('qc_inspections.updated_at', 'desc');

    return res.json({ success: true, data: list });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch QC inspections.', error: err.message });
  }
});

// GET /api/v1/qc/inspections/:id - Get Full QC Inspection & Parameter Matrix
router.get('/inspections/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const inspection = await db('qc_inspections')
      .join('production_batches', 'qc_inspections.batch_id', 'production_batches.id')
      .join('qc_templates', 'qc_inspections.template_id', 'qc_templates.id')
      .leftJoin('formulas', 'production_batches.formula_id', 'formulas.id')
      .leftJoin('users as op', 'production_batches.assigned_operator_id', 'op.id')
      .leftJoin('users as insp', 'qc_inspections.inspector_id', 'insp.id')
      .where('qc_inspections.id', id)
      .select(
        'qc_inspections.*',
        'production_batches.batch_number',
        'production_batches.category as batch_category',
        'production_batches.assigned_operator_id',
        'formulas.code as formula_code',
        'formulas.name as formula_name',
        'qc_templates.code as template_code',
        'qc_templates.name as template_name',
        'op.first_name as operator_first_name',
        'op.last_name as operator_last_name',
        'insp.first_name as inspector_first_name',
        'insp.last_name as inspector_last_name'
      )
      .first();

    if (!inspection) {
      return res.status(404).json({ success: false, message: 'QC Inspection not found.' });
    }

    const parameters = await db('qc_template_parameters').where({ template_id: inspection.template_id });
    const results = await db('qc_results').where({ inspection_id: id });
    const decision = await db('qc_decisions').where({ inspection_id: id }).first();

    return res.json({
      success: true,
      data: {
        inspection,
        parameters,
        results,
        decision,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch QC inspection detail.', error: err.message });
  }
});

// POST /api/v1/qc/inspections/:id/results - Enter Parameter Test Results
router.post('/inspections/:id/results', authenticateToken, requirePermission('qc.inspect'), async (req, res) => {
  try {
    const { id } = req.params;
    const { results } = req.body; // Array of { parameterId, measuredNumeric, measuredText, notes }

    if (!Array.isArray(results) || results.length === 0) {
      return res.status(400).json({ success: false, message: 'Results array is required.' });
    }

    const inspection = await db('qc_inspections').where({ id }).first();
    if (!inspection) return res.status(404).json({ success: false, message: 'QC Inspection not found.' });

    await db.transaction(async (trx) => {
      await trx('qc_results').where({ inspection_id: id }).del();

      for (const r of results) {
        const param = await trx('qc_template_parameters').where({ id: r.parameterId }).first();
        if (!param) continue;

        let isPass = true;
        let numVal = null;
        if (r.measuredNumeric !== undefined && r.measuredNumeric !== null && r.measuredNumeric !== '') {
          numVal = new Decimal(r.measuredNumeric).toFixed(6);
          if (param.min_value !== null && new Decimal(numVal).lt(new Decimal(param.min_value))) isPass = false;
          if (param.max_value !== null && new Decimal(numVal).gt(new Decimal(param.max_value))) isPass = false;
        }

        if (r.measuredText && param.target_value_str) {
          if (String(r.measuredText).trim().toLowerCase() !== String(param.target_value_str).trim().toLowerCase()) {
            isPass = false;
          }
        }

        await trx('qc_results').insert({
          inspection_id: id,
          parameter_id: param.id,
          param_name: param.param_name,
          measured_numeric: numVal,
          measured_text: r.measuredText || null,
          is_pass: isPass,
          notes: r.notes || null,
        });
      }

      await trx('qc_inspections').where({ id }).update({
        inspector_id: req.user.id,
        status: 'Under Inspection',
        updated_at: trx.fn.now(),
      });

      await AuditService.logEvent({
        trx,
        userId: req.user.id,
        userRole: req.user.roles[0] || 'QC Specialist',
        action: 'ENTER_QC_RESULTS',
        entityType: 'QCInspection',
        entityId: id,
        newValues: { resultCount: results.length },
      });
    });

    return res.json({ success: true, message: 'QC parameter results saved successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/v1/qc/inspections/:id/decision - Final QC Decision (Release / Reject / Rework with Maker-Checker)
router.post('/inspections/:id/decision', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { decision, reason, signatureToken, reworkInstructions } = req.body;

    if (!decision || !['Released', 'QC Failed', 'Rework Required'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Valid decision (Released / QC Failed / Rework Required) is required.' });
    }

    const inspection = await db('qc_inspections').where({ id }).first();
    if (!inspection) return res.status(404).json({ success: false, message: 'QC Inspection not found.' });

    const batch = await db('production_batches').where({ id: inspection.batch_id }).first();
    if (!batch) return res.status(404).json({ success: false, message: 'Associated batch not found.' });

    // MAKER-CHECKER ENFORCEMENT: The operator who executed the batch CANNOT issue final release
    if (decision === 'Released') {
      if (Number(batch.assigned_operator_id) === Number(req.user.id) && !req.user.roles.includes('Super Admin')) {
        return res.status(422).json({
          success: false,
          message: 'Maker-Checker policy violation: The compounding operator who executed this batch cannot issue final QC release.',
        });
      }
    }

    // Check all required parameters tested
    const requiredParams = await db('qc_template_parameters').where({ template_id: inspection.template_id, is_required: true });
    const testedResults = await db('qc_results').where({ inspection_id: id });
    const testedParamIds = testedResults.map(r => r.parameter_id);

    const missingParams = requiredParams.filter(p => !testedParamIds.includes(p.id));
    if (missingParams.length > 0) {
      return res.status(422).json({
        success: false,
        message: `Cannot finalize decision. ${missingParams.length} required QC parameter(s) have not been tested.`,
      });
    }

    // Verify 2-step Electronic Signature token
    await SignatureService.verifyAndConsume({
      signatureToken,
      userId: req.user.id,
      action: 'QC_DECISION',
      entityType: 'QCInspection',
      entityId: id,
    });

    await db.transaction(async (trx) => {
      await trx('qc_decisions').insert({
        inspection_id: id,
        batch_id: batch.id,
        decision,
        decided_by_user_id: req.user.id,
        reason: reason || null,
      });

      await trx('qc_inspections').where({ id }).update({
        status: decision === 'Released' ? 'Released' : decision,
        completed_at: trx.fn.now(),
        updated_at: trx.fn.now(),
      });

      await trx('production_batches').where({ id: batch.id }).update({
        status: decision === 'Released' ? 'Released' : decision,
        updated_at: trx.fn.now(),
      });

      // If Rework Required -> Generate batch_rework_orders
      if (decision === 'Rework Required') {
        const reworkCode = await SequenceService.getNextSequence('REWORK_CODE', trx);
        await trx('batch_rework_orders').insert({
          rework_code: reworkCode,
          original_batch_id: batch.id,
          reason: reason || 'QC Rework Required',
          instructions: reworkInstructions || 'Perform re-maceration and secondary filtration',
          status: 'Assigned',
          created_by: req.user.id,
        });
      }

      await AuditService.logEvent({
        trx,
        userId: req.user.id,
        userRole: req.user.roles[0] || 'QC Specialist',
        action: 'QC_FINAL_DECISION',
        entityType: 'QCInspection',
        entityId: id,
        newValues: { decision, batchId: batch.id, batchNumber: batch.batch_number },
      });
    });

    return res.json({
      success: true,
      message: `QC Decision recorded: Batch ${batch.batch_number} is ${decision}.`,
    });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

export default router;
