import { express } from '../cjsRequire.js';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';
import { SequenceService } from '../services/SequenceService.js';

const router = express.Router();

// Auto-create `sample_requests` database table if it doesn't exist
async function ensureSampleRequestsTable() {
  try {
    const exists = await db.schema.hasTable('sample_requests');
    if (!exists) {
      await db.schema.createTable('sample_requests', (table) => {
        table.increments('id').primary();
        table.string('request_code', 50).unique().notNullable();
        table.string('revision_no', 50).defaultTo('REV-001');
        table.string('request_date', 50);
        table.string('company_name', 255);
        table.text('address');
        table.string('contact_person', 255);
        table.string('product_name', 255);
        table.string('product_classification', 100);
        table.text('benchmark');
        table.text('specific_raw_materials');
        table.text('texture');
        table.text('form');
        table.text('scent_aroma_direction');
        table.text('color_description');
        table.text('flavor');
        table.text('function_claims');
        table.text('direction_of_use');
        table.string('net_content', 100);
        table.string('target_price', 100);
        table.text('special_instructions');
        table.string('quantity', 100);
        table.text('primary_packaging');
        table.text('remarks');
        table.text('formatted_content_json');
        table.string('status', 50).defaultTo('PENDING'); // PENDING | APPROVED | DECLINED
        table.integer('requested_by_user_id').unsigned();
        table.string('requested_by_name', 255);
        table.string('noted_by_name', 255);
        table.string('received_by_name', 255);
        table.integer('approved_by_user_id').unsigned();
        table.string('approved_by_name', 255);
        table.timestamp('approved_at').nullable();
        table.integer('declined_by_user_id').unsigned();
        table.string('declined_by_name', 255);
        table.timestamp('declined_at').nullable();
        table.text('decline_reason');
        table.timestamps(true, true);
      });
      console.log('✅ Created sample_requests table in database.');
    }
  } catch (err) {
    console.error('Error ensuring sample_requests table:', err);
  }
}

ensureSampleRequestsTable();

// GET /api/v1/sample-requests - List sample requests
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, search } = req.query;
    const userRole = (req.user?.role || '').toLowerCase();
    const isRequestorOnly = userRole.includes('requestor') && !userRole.includes('admin') && !userRole.includes('formulator');

    const query = db('sample_requests').orderBy('id', 'desc');

    if (isRequestorOnly) {
      query.where('requested_by_user_id', req.user.id);
    }

    if (status && status !== 'ALL') {
      query.andWhere('status', status.toUpperCase());
    }

    if (search) {
      query.andWhere((b) => {
        b.where('request_code', 'like', `%${search}%`)
         .orWhere('company_name', 'like', `%${search}%`)
         .orWhere('product_name', 'like', `%${search}%`)
         .orWhere('contact_person', 'like', `%${search}%`);
      });
    }

    const requests = await query;
    return res.json({ success: true, data: requests });
  } catch (err) {
    console.error('Error fetching sample requests:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch sample requests.', error: err.message });
  }
});

// GET /api/v1/sample-requests/:id - Get single sample request details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const item = await db('sample_requests').where({ id }).first();
    if (!item) {
      return res.status(404).json({ success: false, message: 'Sample Request not found.' });
    }
    return res.json({ success: true, data: item });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch sample request.', error: err.message });
  }
});

// POST /api/v1/sample-requests - Create new sample request
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      revisionNo,
      requestDate,
      companyName,
      address,
      contactPerson,
      productName,
      productClassification,
      benchmark,
      specificRawMaterials,
      texture,
      form,
      scentAromaDirection,
      colorDescription,
      flavor,
      functionClaims,
      directionOfUse,
      netContent,
      targetPrice,
      specialInstructions,
      quantity,
      primaryPackaging,
      remarks,
      formattedContentJson,
      requestedByName,
      notedByName,
      receivedByName,
    } = req.body;

    const yr = new Date().getFullYear();
    const countRes = await db('sample_requests').count('id as count').first();
    const count = (parseInt(countRes?.count || 0, 10) + 1);
    const requestCode = `SRF-${yr}-${String(count).padStart(4, '0')}`;

    const requestedBy = requestedByName || `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() || req.user?.username || 'Requestor';

    const payload = {
      request_code: requestCode,
      revision_no: revisionNo || 'REV-001',
      request_date: requestDate || new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      company_name: companyName || '',
      address: address || '',
      contact_person: contactPerson || '',
      product_name: productName || '',
      product_classification: productClassification || 'Cosmetics',
      benchmark: benchmark || '',
      specific_raw_materials: specificRawMaterials || '',
      texture: texture || '',
      form: form || '',
      scent_aroma_direction: scentAromaDirection || '',
      color_description: colorDescription || '',
      flavor: flavor || '',
      function_claims: functionClaims || '',
      direction_of_use: directionOfUse || '',
      net_content: netContent || '',
      target_price: targetPrice || '',
      special_instructions: specialInstructions || '',
      quantity: quantity || '',
      primary_packaging: primaryPackaging || '',
      remarks: remarks || '',
      formatted_content_json: typeof formattedContentJson === 'object' ? JSON.stringify(formattedContentJson) : (formattedContentJson || '{}'),
      status: 'PENDING',
      requested_by_user_id: req.user.id,
      requested_by_name: requestedBy,
      noted_by_name: notedByName || '',
      received_by_name: receivedByName || '',
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    };

    const [id] = await db('sample_requests').insert(payload).then(r => [Array.isArray(r) ? r[0] : (typeof r === 'object' ? r.id : r)]);

    await logAudit(req, 'CREATE_SAMPLE_REQUEST', 'SampleRequest', id, null, { requestCode, companyName, productName });

    return res.status(201).json({ success: true, message: 'Sample Request submitted successfully.', id, requestCode });
  } catch (err) {
    console.error('Error creating sample request:', err);
    return res.status(500).json({ success: false, message: 'Failed to submit sample request.', error: err.message });
  }
});

// PUT /api/v1/sample-requests/:id - Update sample request
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db('sample_requests').where({ id }).first();
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Sample Request not found.' });
    }

    const {
      revisionNo,
      requestDate,
      companyName,
      address,
      contactPerson,
      productName,
      productClassification,
      benchmark,
      specificRawMaterials,
      texture,
      form,
      scentAromaDirection,
      colorDescription,
      flavor,
      functionClaims,
      directionOfUse,
      netContent,
      targetPrice,
      specialInstructions,
      quantity,
      primaryPackaging,
      remarks,
      formattedContentJson,
      requestedByName,
      notedByName,
      receivedByName,
    } = req.body;

    const payload = {
      revision_no: revisionNo !== undefined ? revisionNo : existing.revision_no,
      request_date: requestDate !== undefined ? requestDate : existing.request_date,
      company_name: companyName !== undefined ? companyName : existing.company_name,
      address: address !== undefined ? address : existing.address,
      contact_person: contactPerson !== undefined ? contactPerson : existing.contact_person,
      product_name: productName !== undefined ? productName : existing.product_name,
      product_classification: productClassification !== undefined ? productClassification : existing.product_classification,
      benchmark: benchmark !== undefined ? benchmark : existing.benchmark,
      specific_raw_materials: specificRawMaterials !== undefined ? specificRawMaterials : existing.specific_raw_materials,
      texture: texture !== undefined ? texture : existing.texture,
      form: form !== undefined ? form : existing.form,
      scent_aroma_direction: scentAromaDirection !== undefined ? scentAromaDirection : existing.scent_aroma_direction,
      color_description: colorDescription !== undefined ? colorDescription : existing.color_description,
      flavor: flavor !== undefined ? flavor : existing.flavor,
      function_claims: functionClaims !== undefined ? functionClaims : existing.function_claims,
      direction_of_use: directionOfUse !== undefined ? directionOfUse : existing.direction_of_use,
      net_content: netContent !== undefined ? netContent : existing.net_content,
      target_price: targetPrice !== undefined ? targetPrice : existing.target_price,
      special_instructions: specialInstructions !== undefined ? specialInstructions : existing.special_instructions,
      quantity: quantity !== undefined ? quantity : existing.quantity,
      primary_packaging: primaryPackaging !== undefined ? primaryPackaging : existing.primary_packaging,
      remarks: remarks !== undefined ? remarks : existing.remarks,
      formatted_content_json: formattedContentJson !== undefined ? (typeof formattedContentJson === 'object' ? JSON.stringify(formattedContentJson) : formattedContentJson) : existing.formatted_content_json,
      requested_by_name: requestedByName !== undefined ? requestedByName : existing.requested_by_name,
      noted_by_name: notedByName !== undefined ? notedByName : existing.noted_by_name,
      received_by_name: receivedByName !== undefined ? receivedByName : existing.received_by_name,
      updated_at: db.fn.now(),
    };

    await db('sample_requests').where({ id }).update(payload);
    await logAudit(req, 'UPDATE_SAMPLE_REQUEST', 'SampleRequest', id, existing, payload);

    return res.json({ success: true, message: 'Sample Request updated successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update sample request.', error: err.message });
  }
});

// PUT /api/v1/sample-requests/:id/approve - Approve Sample Request
router.put('/:id/approve', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db('sample_requests').where({ id }).first();
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Sample Request not found.' });
    }

    const reviewerName = `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() || req.user?.username || 'Admin/Formulator';

    await db('sample_requests').where({ id }).update({
      status: 'APPROVED',
      approved_by_user_id: req.user.id,
      approved_by_name: reviewerName,
      approved_at: db.fn.now(),
      noted_by_name: existing.noted_by_name || reviewerName,
      updated_at: db.fn.now(),
    });

    await logAudit(req, 'APPROVE_SAMPLE_REQUEST', 'SampleRequest', id, existing, { status: 'APPROVED', approved_by: reviewerName });

    return res.json({ success: true, message: `Sample Request ${existing.request_code} APPROVED successfully.`, approvedBy: reviewerName });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to approve sample request.', error: err.message });
  }
});

// PUT /api/v1/sample-requests/:id/decline - Decline Sample Request
router.put('/:id/decline', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { declineReason } = req.body;
    const existing = await db('sample_requests').where({ id }).first();
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Sample Request not found.' });
    }

    const reviewerName = `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() || req.user?.username || 'Admin/Formulator';

    await db('sample_requests').where({ id }).update({
      status: 'DECLINED',
      declined_by_user_id: req.user.id,
      declined_by_name: reviewerName,
      declined_at: db.fn.now(),
      decline_reason: declineReason || 'Declined during review.',
      updated_at: db.fn.now(),
    });

    await logAudit(req, 'DECLINE_SAMPLE_REQUEST', 'SampleRequest', id, existing, { status: 'DECLINED', declined_by: reviewerName, declineReason });

    return res.json({ success: true, message: `Sample Request ${existing.request_code} DECLINED.`, declinedBy: reviewerName });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to decline sample request.', error: err.message });
  }
});

// DELETE /api/v1/sample-requests/:id - Delete Sample Request
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db('sample_requests').where({ id }).first();
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Sample Request not found.' });
    }

    await db('sample_requests').where({ id }).del();
    await logAudit(req, 'DELETE_SAMPLE_REQUEST', 'SampleRequest', id, existing, null);

    return res.json({ success: true, message: 'Sample Request deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to delete sample request.', error: err.message });
  }
});

export default router;
