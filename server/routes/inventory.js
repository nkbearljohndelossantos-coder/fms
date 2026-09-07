import { express } from '../cjsRequire.js';
import db from '../db.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import { InventoryService } from '../services/InventoryService.js';
import { AuditService } from '../services/AuditService.js';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const router = express.Router();
const UPLOAD_DIR = path.join(process.cwd(), 'server', 'storage', 'uploads');

// GET /api/v1/inventory/dashboard - KPI Summary Cards
router.get('/dashboard', authenticateToken, requirePermission('inventory.view'), async (req, res) => {
  try {
    const totalRawMaterialsRes = await db('inventory_items').where({ item_type: 'RAW_MATERIAL' }).count('id as count').first();
    const totalPackagingRes = await db('inventory_items').where({ item_type: 'PACKAGING' }).count('id as count').first();
    const totalFinishedProductsRes = await db('inventory_items').where({ item_type: 'FINISHED_GOODS' }).count('id as count').first();

    const lowStockRes = await db('inventory_items').where({ status: 'LOW_STOCK' }).count('id as count').first();
    const outOfStockRes = await db('inventory_items').where({ status: 'OUT_OF_STOCK' }).count('id as count').first();
    const qcHoldRes = await db('inventory_items').where({ status: 'QC_HOLD' }).count('id as count').first();

    const reservedSumRes = await db('inventory_items').sum('reserved_stock as sum').first();
    const rejectedOpenRes = await db('rejected_materials').whereIn('status', ['Open', 'In Disposition']).count('id as count').first();

    return res.json({
      success: true,
      data: {
        totalRawMaterials: Number(totalRawMaterialsRes?.count || 0),
        totalPackaging: Number(totalPackagingRes?.count || 0),
        totalFinishedProducts: Number(totalFinishedProductsRes?.count || 0),
        lowStock: Number(lowStockRes?.count || 0),
        outOfStock: Number(outOfStockRes?.count || 0),
        qcHold: Number(qcHoldRes?.count || 0),
        reservedStock: Number(reservedSumRes?.sum || 0),
        rejectedMaterials: Number(rejectedOpenRes?.count || 0),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch inventory dashboard KPIs.', error: err.message });
  }
});

// GET /api/v1/inventory/raw-materials - List Raw Material Stock
router.get('/raw-materials', authenticateToken, requirePermission('inventory.view'), async (req, res) => {
  try {
    const { search, location, status } = req.query;

    const query = db('inventory_items')
      .leftJoin('materials', 'inventory_items.material_id', 'materials.id')
      .leftJoin('vendors', 'inventory_items.vendor_id', 'vendors.id')
      .where('inventory_items.item_type', 'RAW_MATERIAL')
      .select(
        'inventory_items.*',
        db.raw('COALESCE(materials.code, inventory_items.lot_number) as material_code'),
        db.raw('COALESCE(inventory_items.item_name, materials.name) as material_name'),
        'materials.category as material_group',
        'materials.description as inci_name',
        'vendors.name as vendor_name',
        'vendors.code as vendor_code'
      );

    if (location && location !== 'All') {
      query.andWhere('inventory_items.location', location);
    }
    if (status && status !== 'All') {
      query.andWhere('inventory_items.status', status);
    }
    if (search) {
      query.andWhere(b => {
        b.where('materials.name', 'like', `%${search}%`)
         .orWhere('inventory_items.item_name', 'like', `%${search}%`)
         .orWhere('materials.code', 'like', `%${search}%`)
         .orWhere('inventory_items.lot_number', 'like', `%${search}%`)
         .orWhere('inventory_items.supplier_lot_number', 'like', `%${search}%`);
      });
    }

    const rawItems = await query.orderBy('inventory_items.updated_at', 'desc');
    const items = rawItems.map(i => ({
      ...i,
      material_name: i.material_name || i.item_name || 'Unnamed Item',
    }));
    return res.json({ success: true, data: items });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch raw material inventory.', error: err.message });
  }
});

// GET /api/v1/inventory/packaging - List Packaging Materials Stock
router.get('/packaging', authenticateToken, requirePermission('inventory.view'), async (req, res) => {
  try {
    const { search, location, status } = req.query;

    const query = db('inventory_items')
      .leftJoin('materials', 'inventory_items.material_id', 'materials.id')
      .leftJoin('vendors', 'inventory_items.vendor_id', 'vendors.id')
      .where('inventory_items.item_type', 'PACKAGING')
      .select(
        'inventory_items.*',
        db.raw('COALESCE(materials.code, inventory_items.lot_number) as material_code'),
        db.raw('COALESCE(inventory_items.item_name, materials.name) as material_name'),
        'materials.category as packaging_group',
        'vendors.name as vendor_name'
      );

    if (location && location !== 'All') {
      query.andWhere('inventory_items.location', location);
    }
    if (status && status !== 'All') {
      query.andWhere('inventory_items.status', status);
    }
    if (search) {
      query.andWhere(b => {
        b.where('materials.name', 'like', `%${search}%`)
         .orWhere('inventory_items.item_name', 'like', `%${search}%`)
         .orWhere('materials.code', 'like', `%${search}%`)
         .orWhere('inventory_items.lot_number', 'like', `%${search}%`);
      });
    }

    const rawItems = await query.orderBy('inventory_items.updated_at', 'desc');
    const items = rawItems.map(i => ({
      ...i,
      material_name: i.material_name || i.item_name || 'Unnamed Item',
    }));
    return res.json({ success: true, data: items });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch packaging material inventory.', error: err.message });
  }
});

// GET /api/v1/inventory/finished-products - List Finished Goods Inventory
router.get('/finished-products', authenticateToken, requirePermission('inventory.view'), async (req, res) => {
  try {
    const { search, location, status } = req.query;

    const query = db('inventory_items')
      .leftJoin('formulas', 'inventory_items.formula_id', 'formulas.id')
      .leftJoin('formula_versions', 'inventory_items.formula_version_id', 'formula_versions.id')
      .leftJoin('production_batches', 'inventory_items.batch_id', 'production_batches.id')
      .where('inventory_items.item_type', 'FINISHED_GOODS')
      .select(
        'inventory_items.*',
        db.raw('COALESCE(formulas.code, inventory_items.lot_number) as product_code'),
        db.raw('COALESCE(inventory_items.item_name, formulas.name) as product_name'),
        'formula_versions.compounding_code',
        'formula_versions.major_version',
        'formula_versions.minor_version',
        'production_batches.batch_number',
        'production_batches.started_at as production_date',
        'production_batches.completed_at as batch_completed_at'
      );

    if (location && location !== 'All') {
      query.andWhere('inventory_items.location', location);
    }
    if (status && status !== 'All') {
      query.andWhere('inventory_items.status', status);
    }
    if (search) {
      query.andWhere(b => {
        b.where('formulas.name', 'like', `%${search}%`)
         .orWhere('inventory_items.item_name', 'like', `%${search}%`)
         .orWhere('formulas.code', 'like', `%${search}%`)
         .orWhere('inventory_items.lot_number', 'like', `%${search}%`)
         .orWhere('production_batches.batch_number', 'like', `%${search}%`);
      });
    }

    const rawItems = await query.orderBy('inventory_items.updated_at', 'desc');
    const items = rawItems.map(i => ({
      ...i,
      product_name: i.product_name || i.item_name || 'Unnamed Product',
    }));
    return res.json({ success: true, data: items });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch finished product inventory.', error: err.message });
  }
});

// GET /api/v1/inventory/rejected - List Rejected Materials with Attachments
router.get('/rejected', authenticateToken, requirePermission('rejected_material.view'), async (req, res) => {
  try {
    const { search, disposition, status, material_type, item_type } = req.query;
    const targetType = material_type || item_type;

    const query = db('rejected_materials')
      .leftJoin('users as rb', 'rejected_materials.rejected_by', 'rb.id')
      .leftJoin('users as db_user', 'rejected_materials.disposition_by', 'db_user.id')
      .select(
        'rejected_materials.*',
        'rb.first_name as rejected_by_first_name',
        'rb.last_name as rejected_by_last_name',
        'db_user.first_name as disposition_by_first_name',
        'db_user.last_name as disposition_by_last_name'
      );

    if (disposition && disposition !== 'All') {
      query.andWhere('rejected_materials.disposition', disposition);
    }
    if (status && status !== 'All') {
      query.andWhere('rejected_materials.status', status);
    }
    if (targetType && targetType !== 'All') {
      query.andWhere('rejected_materials.material_type', targetType);
    }
    if (search) {
      query.andWhere(b => {
        b.where('rejected_materials.material_name', 'like', `%${search}%`)
         .orWhere('rejected_materials.material_code', 'like', `%${search}%`)
         .orWhere('rejected_materials.rejection_code', 'like', `%${search}%`)
         .orWhere('rejected_materials.supplier_lot_number', 'like', `%${search}%`);
      });
    }

    const rejections = await query.orderBy('rejected_materials.id', 'desc');

    // Fetch attachments for each rejection
    const rejectionIds = rejections.map(r => r.id);
    let attachmentsMap = {};

    if (rejectionIds.length > 0) {
      const attachments = await db('rejected_material_attachments')
        .join('document_attachments', 'rejected_material_attachments.attachment_id', 'document_attachments.id')
        .leftJoin('users', 'document_attachments.uploaded_by', 'users.id')
        .whereIn('rejected_material_attachments.rejected_material_id', rejectionIds)
        .select(
          'rejected_material_attachments.rejected_material_id',
          'rejected_material_attachments.description as attachment_description',
          'document_attachments.id as attachment_id',
          'document_attachments.filename',
          'document_attachments.mime_type',
          'document_attachments.file_size',
          'document_attachments.created_at as uploaded_at',
          'users.first_name as uploader_first_name',
          'users.last_name as uploader_last_name'
        );

      attachments.forEach(att => {
        if (!attachmentsMap[att.rejected_material_id]) {
          attachmentsMap[att.rejected_material_id] = [];
        }
        attachmentsMap[att.rejected_material_id].push(att);
      });
    }

    const result = rejections.map(r => ({
      ...r,
      attachments: attachmentsMap[r.id] || [],
    }));

    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch rejected materials.', error: err.message });
  }
});

// GET /api/v1/inventory/logbook - Real-Time Material In/Out Audit Logbook
router.get('/logbook', authenticateToken, requirePermission('inventory.view'), async (req, res) => {
  try {
    const { direction, startDate, endDate, companyId, vendorId, search, sort } = req.query;

    const query = db('inventory_transactions')
      .leftJoin('inventory_items', 'inventory_transactions.inventory_item_id', 'inventory_items.id')
      .leftJoin('materials', 'inventory_transactions.material_id', 'materials.id')
      .leftJoin('companies', 'materials.company_id', 'companies.id')
      .leftJoin('vendors', 'inventory_items.vendor_id', 'vendors.id')
      .leftJoin('users', 'inventory_transactions.performed_by', 'users.id')
      .select(
        'inventory_transactions.*',
        db.raw('COALESCE(materials.code, inventory_items.lot_number) as material_code'),
        db.raw('COALESCE(inventory_items.item_name, materials.name) as material_name'),
        'materials.category as material_category',
        'companies.id as company_id',
        'companies.name as company_name',
        'companies.code as company_code',
        'vendors.id as vendor_id',
        'vendors.name as vendor_name',
        'vendors.code as vendor_code',
        'users.first_name as user_first_name',
        'users.last_name as user_last_name',
        'users.email as user_email'
      );

    // Direction Filter (IN, OUT, ADJUSTMENT, TRANSFER)
    if (direction && direction !== 'ALL') {
      if (direction === 'IN') {
        query.whereIn('inventory_transactions.transaction_type', ['STOCK_IN', 'ADJUSTMENT_IN', 'RETURN', 'REUSE', 'RELEASE']);
      } else if (direction === 'OUT') {
        query.whereIn('inventory_transactions.transaction_type', ['STOCK_OUT', 'ADJUSTMENT_OUT', 'DISPOSAL', 'CONSUMPTION', 'REJECTION']);
      } else if (direction === 'ADJUSTMENT') {
        query.whereIn('inventory_transactions.transaction_type', ['ADJUSTMENT_IN', 'ADJUSTMENT_OUT']);
      } else if (direction === 'TRANSFER') {
        query.where('inventory_transactions.transaction_type', 'TRANSFER');
      } else {
        query.where('inventory_transactions.transaction_type', direction);
      }
    }

    // Date & Time Range Filters
    if (startDate) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) {
        query.andWhere('inventory_transactions.created_at', '>=', start);
      }
    }

    if (endDate) {
      const end = new Date(endDate);
      if (!isNaN(end.getTime())) {
        if (endDate.length === 10) {
          end.setHours(23, 59, 59, 999);
        }
        query.andWhere('inventory_transactions.created_at', '<=', end);
      }
    }

    // Company & Vendor Filters
    if (companyId && companyId !== 'All') {
      query.andWhere('materials.company_id', companyId);
    }

    if (vendorId && vendorId !== 'All') {
      query.andWhere('inventory_items.vendor_id', vendorId);
    }

    // Search Query
    if (search) {
      query.andWhere(b => {
        b.where('materials.name', 'like', `%${search}%`)
         .orWhere('materials.code', 'like', `%${search}%`)
         .orWhere('inventory_transactions.lot_number', 'like', `%${search}%`)
         .orWhere('inventory_transactions.transaction_code', 'like', `%${search}%`)
         .orWhere('inventory_transactions.reference_number', 'like', `%${search}%`)
         .orWhere('companies.name', 'like', `%${search}%`)
         .orWhere('vendors.name', 'like', `%${search}%`)
         .orWhere('users.first_name', 'like', `%${search}%`)
         .orWhere('users.last_name', 'like', `%${search}%`);
      });
    }

    // Sorting Logic
    if (sort === 'date_asc') {
      query.orderBy('inventory_transactions.created_at', 'asc').orderBy('inventory_transactions.id', 'asc');
    } else if (sort === 'alpha_asc') {
      query.orderBy('materials.name', 'asc').orderBy('inventory_transactions.created_at', 'desc');
    } else if (sort === 'alpha_desc') {
      query.orderBy('materials.name', 'desc').orderBy('inventory_transactions.created_at', 'desc');
    } else if (sort === 'company_asc') {
      query.orderBy('companies.name', 'asc').orderBy('materials.name', 'asc');
    } else {
      query.orderBy('inventory_transactions.created_at', 'desc').orderBy('inventory_transactions.id', 'desc');
    }

    const transactions = await query;

    let totalInQty = 0;
    let totalOutQty = 0;
    let inCount = 0;
    let outCount = 0;

    transactions.forEach(t => {
      const q = parseFloat(t.quantity || 0);
      const isStockIn = ['STOCK_IN', 'ADJUSTMENT_IN', 'RETURN', 'REUSE', 'RELEASE'].includes(t.transaction_type);
      if (isStockIn) {
        totalInQty += q;
        inCount++;
      } else {
        totalOutQty += q;
        outCount++;
      }
    });

    const companies = await db('companies').where({ is_active: true }).select('id', 'name', 'code').orderBy('name', 'asc');
    const vendors = await db('vendors').select('id', 'name', 'code').orderBy('name', 'asc');

    return res.json({
      success: true,
      data: transactions,
      summary: {
        totalMovements: transactions.length,
        inCount,
        outCount,
        totalInQty: Number(totalInQty.toFixed(2)),
        totalOutQty: Number(totalOutQty.toFixed(2)),
      },
      companies,
      vendors,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch material logbook.', error: err.message });
  }
});

// POST /api/v1/inventory/stock-in - Receive / Stock In Lot
router.post('/stock-in', authenticateToken, requirePermission('inventory.stock_in'), async (req, res) => {
  try {
    const result = await InventoryService.stockIn(req.body, req.user);
    return res.json({ success: true, message: 'Inventory stock in logged successfully.', data: result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

// POST /api/v1/inventory/stock-out - Stock Out / Deduct Inventory
router.post('/stock-out', authenticateToken, requirePermission('inventory.stock_out'), async (req, res) => {
  try {
    const result = await InventoryService.stockOut(req.body, req.user);
    return res.json({ success: true, message: 'Inventory stock out logged successfully.', data: result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

// POST /api/v1/inventory/adjust - Adjust Inventory Quantity
router.post('/adjust', authenticateToken, requirePermission('inventory.adjust'), async (req, res) => {
  try {
    const result = await InventoryService.adjustStock(req.body, req.user);
    return res.json({ success: true, message: 'Inventory stock adjustment logged successfully.', data: result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

// POST /api/v1/inventory/transfer - Transfer Inventory Between Locations
router.post('/transfer', authenticateToken, requirePermission('inventory.transfer'), async (req, res) => {
  try {
    const result = await InventoryService.transferStock(req.body, req.user);
    return res.json({ success: true, message: 'Inventory stock transfer logged successfully.', data: result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

// GET /api/v1/inventory/items/:id/history - Transaction Ledger History
router.get('/items/:id/history', authenticateToken, requirePermission('inventory.history'), async (req, res) => {
  try {
    const { id } = req.params;
    const item = await db('inventory_items').where({ id }).first();
    if (!item) return res.status(404).json({ success: false, message: 'Inventory item not found.' });

    const transactions = await db('inventory_transactions')
      .leftJoin('users', 'inventory_transactions.performed_by', 'users.id')
      .where('inventory_transactions.inventory_item_id', id)
      .select(
        'inventory_transactions.*',
        'users.first_name as user_first_name',
        'users.last_name as user_last_name'
      )
      .orderBy('inventory_transactions.id', 'desc');

    return res.json({ success: true, data: { item, transactions } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch inventory item history.', error: err.message });
  }
});

// POST /api/v1/inventory/rejected - Create Rejection Record with Attachments
router.post('/rejected', authenticateToken, requirePermission('rejected_material.create'), async (req, res) => {
  try {
    const { data, attachments } = req.body;
    const result = await InventoryService.rejectMaterial(data || req.body, attachments || req.body.attachments || [], req.user);
    return res.json({ success: true, message: 'Material rejection record created successfully.', data: result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

// POST /api/v1/inventory/rejected/:id/attachments - Upload Additional Attachment to Rejection
router.post('/rejected/:id/attachments', authenticateToken, requirePermission('rejected_material.create'), async (req, res) => {
  try {
    const { id } = req.params;
    const { dataBase64, filename, mimeType, description } = req.body;

    if (!dataBase64 || !filename) {
      return res.status(400).json({ success: false, message: 'File asset and filename are required.' });
    }

    const rejection = await db('rejected_materials').where({ id }).first();
    if (!rejection) return res.status(404).json({ success: false, message: 'Rejection record not found.' });

    const base64Data = dataBase64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const fileExt = path.extname(filename) || '.bin';
    const storedName = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${fileExt}`;
    const storagePath = path.join(UPLOAD_DIR, storedName);

    fs.writeFileSync(storagePath, buffer);
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    const docRes = await db('document_attachments').insert({
      filename,
      stored_name: storedName,
      mime_type: mimeType || 'application/octet-stream',
      file_size: buffer.length,
      checksum_sha256: checksum,
      uploaded_by: req.user.id,
      classification: 'Confidential',
      malware_scan_status: 'Clean',
      storage_path: storagePath,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const docId = Array.isArray(docRes) ? (typeof docRes[0] === 'object' ? docRes[0].id : docRes[0]) : docRes;

    await db('rejected_material_attachments').insert({
      rejected_material_id: id,
      attachment_id: docId,
      description: description || null,
      created_at: new Date(),
    });

    await AuditService.logEvent({
      userId: req.user.id,
      userRole: req.user.roles?.[0] || 'User',
      action: 'REJECTION_ATTACHMENT_UPLOADED',
      entityType: 'RejectedMaterial',
      entityId: String(id),
      newValues: { filename, attachmentId: docId },
    });

    return res.json({ success: true, message: 'Attachment uploaded successfully.', data: { attachmentId: docId, filename } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/v1/inventory/rejected/:id/attachments/:attachmentId - Unlink Attachment
router.delete('/rejected/:id/attachments/:attachmentId', authenticateToken, requirePermission('rejected_material.create'), async (req, res) => {
  try {
    const { id, attachmentId } = req.params;

    const link = await db('rejected_material_attachments')
      .where({ rejected_material_id: id, attachment_id: attachmentId })
      .first();

    if (!link) {
      return res.status(404).json({ success: false, message: 'Attachment link not found.' });
    }

    await db('rejected_material_attachments')
      .where({ rejected_material_id: id, attachment_id: attachmentId })
      .delete();

    await AuditService.logEvent({
      userId: req.user.id,
      userRole: req.user.roles?.[0] || 'User',
      action: 'REJECTION_ATTACHMENT_DELETED',
      entityType: 'RejectedMaterial',
      entityId: String(id),
      newValues: { attachmentId },
    });

    return res.json({ success: true, message: 'Attachment removed successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/v1/inventory/rejected/:id/disposition - Set Rejection Disposition
router.put('/rejected/:id/disposition', authenticateToken, requirePermission('rejected_material.disposition'), async (req, res) => {
  try {
    const { id } = req.params;
    const { disposition, notes } = req.body;

    const result = await InventoryService.dispositionRejectedMaterial(id, disposition, notes, req.user);
    return res.json({ success: true, message: 'Rejection disposition updated successfully.', data: result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

// GET /api/v1/inventory/traceability/:reference - Forward & Reverse Traceability
router.get('/traceability/:reference', authenticateToken, requirePermission('inventory.view'), async (req, res) => {
  try {
    const { reference } = req.params;
    const result = await InventoryService.getTraceabilityTree(reference);

    if (!result) {
      return res.status(404).json({ success: false, message: `No traceability record found for reference '${reference}'.` });
    }

    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch traceability tree.', error: err.message });
  }
});

// GET /api/v1/inventory/costing - Financial Valuation & Costing Breakdown
router.get('/costing', authenticateToken, requirePermission('inventory.view'), async (req, res) => {
  try {
    const { companyId, search } = req.query;

    // 1. Raw Materials Stock & Valuation
    const rawQuery = db('inventory_items')
      .leftJoin('materials', 'inventory_items.material_id', 'materials.id')
      .leftJoin('companies', 'materials.company_id', 'companies.id')
      .leftJoin('vendors', 'inventory_items.vendor_id', 'vendors.id')
      .where('inventory_items.item_type', 'RAW_MATERIAL')
      .where('inventory_items.current_stock', '>', 0)
      .select(
        'inventory_items.id',
        'inventory_items.lot_number',
        'inventory_items.current_stock',
        'inventory_items.uom',
        db.raw('COALESCE(materials.code, inventory_items.lot_number) as material_code'),
        db.raw('COALESCE(inventory_items.item_name, materials.name) as material_name'),
        db.raw('COALESCE(inventory_items.cost, materials.cost, 0) as unit_cost'),
        'companies.id as company_id',
        'companies.name as company_name',
        'vendors.name as vendor_name'
      );

    if (companyId && companyId !== 'All') {
      rawQuery.andWhere('materials.company_id', companyId);
    }
    if (search) {
      rawQuery.andWhere(b => {
        b.where('materials.name', 'like', `%${search}%`)
         .orWhere('inventory_items.item_name', 'like', `%${search}%`)
         .orWhere('materials.code', 'like', `%${search}%`)
         .orWhere('inventory_items.lot_number', 'like', `%${search}%`);
      });
    }

    const rawItems = (await rawQuery).map(item => {
      const stock = parseFloat(item.current_stock || 0);
      const unitCost = parseFloat(item.unit_cost || 0);
      const lineCost = stock * unitCost;
      return {
        ...item,
        current_stock: stock,
        unit_cost: unitCost,
        line_cost: Number(lineCost.toFixed(2)),
      };
    });

    // 2. Packaging Stock & Valuation
    const packagingQuery = db('inventory_items')
      .leftJoin('materials', 'inventory_items.material_id', 'materials.id')
      .leftJoin('companies', 'materials.company_id', 'companies.id')
      .leftJoin('vendors', 'inventory_items.vendor_id', 'vendors.id')
      .where('inventory_items.item_type', 'PACKAGING')
      .where('inventory_items.current_stock', '>', 0)
      .select(
        'inventory_items.id',
        'inventory_items.lot_number',
        'inventory_items.current_stock',
        'inventory_items.uom',
        db.raw('COALESCE(materials.code, inventory_items.lot_number) as material_code'),
        db.raw('COALESCE(inventory_items.item_name, materials.name) as material_name'),
        db.raw('COALESCE(inventory_items.cost, materials.cost, 0) as unit_cost'),
        'companies.id as company_id',
        'companies.name as company_name',
        'vendors.name as vendor_name'
      );

    if (companyId && companyId !== 'All') {
      packagingQuery.andWhere('materials.company_id', companyId);
    }
    if (search) {
      packagingQuery.andWhere(b => {
        b.where('materials.name', 'like', `%${search}%`)
         .orWhere('inventory_items.item_name', 'like', `%${search}%`)
         .orWhere('materials.code', 'like', `%${search}%`)
         .orWhere('inventory_items.lot_number', 'like', `%${search}%`);
      });
    }

    const packagingItems = (await packagingQuery).map(item => {
      const stock = parseFloat(item.current_stock || 0);
      const unitCost = parseFloat(item.unit_cost || 0);
      const lineCost = stock * unitCost;
      return {
        ...item,
        current_stock: stock,
        unit_cost: unitCost,
        line_cost: Number(lineCost.toFixed(2)),
      };
    });

    // 3. Finished Products Stock & Valuation
    const finishedQuery = db('inventory_items')
      .leftJoin('formulas', 'inventory_items.formula_id', 'formulas.id')
      .leftJoin('formula_versions', 'inventory_items.formula_version_id', 'formula_versions.id')
      .leftJoin('formula_cost_snapshots', 'formula_versions.id', 'formula_cost_snapshots.version_id')
      .leftJoin('production_batches', 'inventory_items.batch_id', 'production_batches.id')
      .where('inventory_items.item_type', 'FINISHED_GOODS')
      .where('inventory_items.current_stock', '>', 0)
      .select(
        'inventory_items.id',
        'inventory_items.lot_number',
        'inventory_items.current_stock',
        'inventory_items.uom',
        'formulas.code as product_code',
        'formulas.name as product_name',
        'formula_versions.compounding_code',
        'production_batches.batch_number',
        'formula_cost_snapshots.cost_per_unit as unit_cost'
      );

    if (search) {
      finishedQuery.andWhere(b => {
        b.where('formulas.name', 'like', `%${search}%`)
         .orWhere('formulas.code', 'like', `%${search}%`)
         .orWhere('inventory_items.lot_number', 'like', `%${search}%`)
         .orWhere('production_batches.batch_number', 'like', `%${search}%`);
      });
    }

    const finishedItems = (await finishedQuery).map(item => {
      const stock = parseFloat(item.current_stock || 0);
      const unitCost = parseFloat(item.unit_cost || 0);
      const lineCost = stock * unitCost;
      return {
        ...item,
        current_stock: stock,
        unit_cost: unitCost,
        line_cost: Number(lineCost.toFixed(2)),
      };
    });

    // 4. Rejected Materials Valuation
    const rejectedQuery = db('rejected_materials')
      .leftJoin('materials', 'rejected_materials.material_id', 'materials.id')
      .leftJoin('companies', 'materials.company_id', 'companies.id')
      .select(
        'rejected_materials.id',
        'rejected_materials.rejection_code',
        'rejected_materials.material_code',
        'rejected_materials.material_name',
        'rejected_materials.material_type',
        'rejected_materials.rejected_quantity',
        'rejected_materials.uom',
        'rejected_materials.disposition',
        'rejected_materials.status',
        'materials.cost as unit_cost',
        'companies.id as company_id',
        'companies.name as company_name'
      );

    if (companyId && companyId !== 'All') {
      rejectedQuery.andWhere('materials.company_id', companyId);
    }
    if (search) {
      rejectedQuery.andWhere(b => {
        b.where('rejected_materials.material_name', 'like', `%${search}%`)
         .orWhere('rejected_materials.material_code', 'like', `%${search}%`)
         .orWhere('rejected_materials.rejection_code', 'like', `%${search}%`);
      });
    }

    const rejectedItems = (await rejectedQuery).map(item => {
      const qty = parseFloat(item.rejected_quantity || 0);
      const unitCost = parseFloat(item.unit_cost || 0);
      const lineCost = qty * unitCost;
      return {
        ...item,
        rejected_quantity: qty,
        unit_cost: unitCost,
        line_cost: Number(lineCost.toFixed(2)),
      };
    });

    // Aggregations
    const rawValuation = rawItems.reduce((acc, i) => acc + i.line_cost, 0);
    const packagingValuation = packagingItems.reduce((acc, i) => acc + i.line_cost, 0);
    const finishedValuation = finishedItems.reduce((acc, i) => acc + i.line_cost, 0);
    const activeInventoryValuation = rawValuation + packagingValuation + finishedValuation;
    const rejectedValuation = rejectedItems.reduce((acc, i) => acc + i.line_cost, 0);
    const overallCosting = activeInventoryValuation + rejectedValuation;

    const companies = await db('companies').where({ is_active: true }).select('id', 'name', 'code').orderBy('name', 'asc');

    return res.json({
      success: true,
      summary: {
        overallCosting: Number(overallCosting.toFixed(2)),
        activeInventoryValuation: Number(activeInventoryValuation.toFixed(2)),
        rawValuation: Number(rawValuation.toFixed(2)),
        packagingValuation: Number(packagingValuation.toFixed(2)),
        finishedValuation: Number(finishedValuation.toFixed(2)),
        rejectedValuation: Number(rejectedValuation.toFixed(2)),
        rawCount: rawItems.length,
        packagingCount: packagingItems.length,
        finishedCount: finishedItems.length,
        rejectedCount: rejectedItems.length,
      },
      data: {
        rawMaterials: rawItems,
        packaging: packagingItems,
        finishedProducts: finishedItems,
        rejectedMaterials: rejectedItems,
      },
      companies,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch inventory costing data.', error: err.message });
  }
});

// PUT /api/v1/inventory/items/:id/qa-status - QA/QC Receiving Supply Confirmation (Release/Hold)
router.put('/items/:id/qa-status', authenticateToken, requirePermission('inventory.stock_in'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const item = await db('inventory_items').where({ id }).first();
    if (!item) return res.status(404).json({ success: false, message: 'Inventory item not found.' });

    await db('inventory_items').where({ id }).update({
      status,
      updated_at: new Date(),
    });

    await AuditService.logEvent({
      userId: req.user.id,
      userRole: req.user.roles?.[0] || 'User',
      action: 'QA_RECEIVING_STATUS_CONFIRMED',
      entityType: 'InventoryItem',
      entityId: String(id),
      newValues: { lotNumber: item.lot_number, status, notes },
    });

    return res.json({ success: true, message: `Inventory item QA status updated to ${status}.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/inventory/purchasing-tickets - List Purchasing Rejection Tickets
router.get('/purchasing-tickets', authenticateToken, async (req, res) => {
  try {
    const { status, search } = req.query;

    const query = db('purchasing_tickets')
      .join('rejected_materials', 'purchasing_tickets.rejected_material_id', 'rejected_materials.id')
      .leftJoin('inventory_items', 'purchasing_tickets.inventory_item_id', 'inventory_items.id')
      .leftJoin('vendors', 'rejected_materials.vendor_id', 'vendors.id')
      .leftJoin('users as rb', 'rejected_materials.rejected_by', 'rb.id')
      .leftJoin('users as db_user', 'purchasing_tickets.decided_by', 'db_user.id')
      .select(
        'purchasing_tickets.*',
        'rejected_materials.rejection_code',
        'rejected_materials.material_code',
        'rejected_materials.material_name',
        'rejected_materials.material_type',
        'rejected_materials.supplier_lot_number',
        'rejected_materials.rejected_quantity',
        'rejected_materials.uom',
        'rejected_materials.reason as qc_rejection_reason',
        'rejected_materials.date_rejected',
        'rejected_materials.disposition',
        'vendors.name as vendor_name',
        'vendors.code as vendor_code',
        'rb.first_name as rejected_by_first_name',
        'rb.last_name as rejected_by_last_name',
        'db_user.first_name as decided_by_first_name',
        'db_user.last_name as decided_by_last_name'
      );

    if (status && status !== 'All') {
      query.andWhere('purchasing_tickets.status', status);
    }

    if (search) {
      query.andWhere(b => {
        b.where('purchasing_tickets.ticket_number', 'like', `%${search}%`)
         .orWhere('rejected_materials.material_name', 'like', `%${search}%`)
         .orWhere('rejected_materials.material_code', 'like', `%${search}%`)
         .orWhere('rejected_materials.rejection_code', 'like', `%${search}%`)
         .orWhere('vendors.name', 'like', `%${search}%`);
      });
    }

    const tickets = await query.orderBy('purchasing_tickets.id', 'desc');

    const rejectionIds = tickets.map(t => t.rejected_material_id);
    let attachmentsMap = {};

    if (rejectionIds.length > 0) {
      const attachments = await db('rejected_material_attachments')
        .join('document_attachments', 'rejected_material_attachments.attachment_id', 'document_attachments.id')
        .leftJoin('users', 'document_attachments.uploaded_by', 'users.id')
        .whereIn('rejected_material_attachments.rejected_material_id', rejectionIds)
        .select(
          'rejected_material_attachments.rejected_material_id',
          'rejected_material_attachments.description as caption',
          'document_attachments.id as attachment_id',
          'document_attachments.filename',
          'document_attachments.mime_type',
          'document_attachments.file_size',
          'document_attachments.created_at as uploaded_at',
          'users.first_name as uploader_first_name',
          'users.last_name as uploader_last_name'
        );

      attachments.forEach(att => {
        if (!attachmentsMap[att.rejected_material_id]) {
          attachmentsMap[att.rejected_material_id] = [];
        }
        attachmentsMap[att.rejected_material_id].push(att);
      });
    }

    const result = tickets.map(t => ({
      ...t,
      attachments: attachmentsMap[t.rejected_material_id] || [],
    }));

    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch purchasing rejection tickets.', error: err.message });
  }
});

// POST /api/v1/inventory/purchasing-tickets/:id/decision - Purchasing Department Decision Engine
router.post('/purchasing-tickets/:id/decision', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { decision, purchasing_notes, bypass_justification, issue_category } = req.body;

    if (!['RETURN_TO_SUPPLIER', 'ON_HOLD', 'QA_BYPASSED'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Invalid decision option. Must be RETURN_TO_SUPPLIER, ON_HOLD, or QA_BYPASSED.' });
    }

    if (decision === 'QA_BYPASSED' && (!bypass_justification || !String(bypass_justification).trim())) {
      return res.status(400).json({ success: false, message: 'Purchasing QA Bypass requires a valid justification note.' });
    }

    return await db.transaction(async (trx) => {
      const ticket = await trx('purchasing_tickets').where({ id }).first();
      if (!ticket) return res.status(404).json({ success: false, message: 'Purchasing ticket not found.' });

      const rejection = await trx('rejected_materials').where({ id: ticket.rejected_material_id }).first();

      let newTicketStatus = decision;
      let newRejectionDisposition = 'Pending Review';
      let rejectionStatus = 'In Disposition';

      if (decision === 'RETURN_TO_SUPPLIER') {
        newRejectionDisposition = 'Returned to Supplier';
        rejectionStatus = 'Closed';
      } else if (decision === 'ON_HOLD') {
        newRejectionDisposition = 'Hold / Under Vendor Investigation';
        rejectionStatus = 'In Disposition';
      } else if (decision === 'QA_BYPASSED') {
        newRejectionDisposition = 'Bypassed by Purchasing';
        rejectionStatus = 'Closed';

        if (ticket.inventory_item_id) {
          const invItem = await trx('inventory_items').where({ id: ticket.inventory_item_id }).first();
          if (invItem && rejection) {
            const currentStock = parseFloat(invItem.current_stock || 0);
            const rejQty = parseFloat(rejection.rejected_quantity || 0);
            const restoredCurrent = currentStock + rejQty;
            const restoredAvailable = parseFloat(invItem.available_stock || 0) + rejQty;

            await trx('inventory_items').where({ id: ticket.inventory_item_id }).update({
              current_stock: restoredCurrent.toFixed(6),
              available_stock: restoredAvailable.toFixed(6),
              status: 'NORMAL',
              updated_at: new Date(),
            });

            await trx('inventory_transactions').insert({
              transaction_code: `TXN-BYPASS-${Date.now()}`,
              inventory_item_id: ticket.inventory_item_id,
              item_type: invItem.item_type,
              material_id: invItem.material_id,
              transaction_type: 'RELEASE',
              quantity: rejQty.toFixed(6),
              uom: invItem.uom,
              previous_balance: currentStock.toFixed(6),
              new_balance: restoredCurrent.toFixed(6),
              lot_number: invItem.lot_number,
              from_location: 'Rejected Material Area',
              to_location: invItem.location,
              reference_number: ticket.ticket_number,
              reason: `Purchasing QA Bypass Override (${bypass_justification})`,
              department: 'Purchasing Department',
              performed_by: req.user.id,
              created_at: new Date(),
            });
          }
        }
      }

      await trx('purchasing_tickets').where({ id }).update({
        status: newTicketStatus,
        issue_category: issue_category || ticket.issue_category,
        purchasing_notes: purchasing_notes || null,
        bypass_justification: bypass_justification || null,
        decided_by: req.user.id,
        decided_at: new Date(),
        updated_at: new Date(),
      });

      await trx('rejected_materials').where({ id: ticket.rejected_material_id }).update({
        disposition: newRejectionDisposition,
        status: rejectionStatus,
        disposition_notes: purchasing_notes || bypass_justification || null,
        disposition_by: req.user.id,
        disposition_at: new Date(),
        updated_at: new Date(),
      });

      await AuditService.logEvent({
        trx,
        userId: req.user.id,
        userRole: req.user.roles?.[0] || 'User',
        action: `PURCHASING_TICKET_DECISION_${decision}`,
        entityType: 'PurchasingTicket',
        entityId: String(id),
        newValues: { ticketNumber: ticket.ticket_number, decision, purchasing_notes, bypass_justification },
      });

      return res.json({ success: true, message: `Purchasing ticket decision '${decision}' recorded successfully.` });
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/v1/inventory/purchase-requests - Submit Item Purchase Request from Inventory
router.post('/purchase-requests', authenticateToken, async (req, res) => {
  try {
    const { item_name, material_id, requested_quantity, uom, priority, needed_by_date, justification, vendor_id } = req.body;

    if (!item_name || !requested_quantity) {
      return res.status(400).json({ success: false, message: 'Item name and requested quantity are required.' });
    }

    const countRes = await db('purchase_requests').count('id as count').first();
    const count = Number(countRes?.count || 0) + 1;
    const request_number = `PR-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;

    const insertResult = await db('purchase_requests').insert({
      request_number,
      item_name: String(item_name).trim(),
      material_id: material_id ? Number(material_id) : null,
      requested_quantity: Number(requested_quantity),
      uom: uom || 'kg',
      priority: priority || 'Medium',
      needed_by_date: needed_by_date || null,
      justification: justification ? String(justification).trim() : null,
      vendor_id: vendor_id ? Number(vendor_id) : null,
      status: 'Pending Review',
      requested_by: req.user.id,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const id = Array.isArray(insertResult) ? (typeof insertResult[0] === 'object' ? insertResult[0].id : insertResult[0]) : insertResult;

    await AuditService.logEvent({
      userId: req.user.id,
      userRole: req.user.roles?.[0] || 'User',
      action: 'PURCHASE_REQUEST_CREATED',
      entityType: 'PurchaseRequest',
      entityId: String(id),
      newValues: { request_number, item_name, requested_quantity, uom, priority },
    });

    return res.json({
      success: true,
      message: `Purchase request ${request_number} submitted successfully to Purchasing Department.`,
      data: { id, request_number },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/inventory/purchase-requests - List Purchase Requests
router.get('/purchase-requests', authenticateToken, async (req, res) => {
  try {
    const { status, search, priority } = req.query;

    const query = db('purchase_requests')
      .leftJoin('vendors', 'purchase_requests.vendor_id', 'vendors.id')
      .leftJoin('users as rb', 'purchase_requests.requested_by', 'rb.id')
      .leftJoin('users as db_user', 'purchase_requests.decided_by', 'db_user.id')
      .select(
        'purchase_requests.*',
        'vendors.name as vendor_name',
        'vendors.code as vendor_code',
        'rb.first_name as requested_by_first_name',
        'rb.last_name as requested_by_last_name',
        'rb.email as requested_by_email',
        'db_user.first_name as decided_by_first_name',
        'db_user.last_name as decided_by_last_name'
      );

    if (status && status !== 'All') {
      query.andWhere('purchase_requests.status', status);
    }

    if (priority && priority !== 'All') {
      query.andWhere('purchase_requests.priority', priority);
    }

    if (search) {
      query.andWhere(b => {
        b.where('purchase_requests.request_number', 'like', `%${search}%`)
         .orWhere('purchase_requests.item_name', 'like', `%${search}%`)
         .orWhere('vendors.name', 'like', `%${search}%`);
      });
    }

    const requests = await query.orderBy('purchase_requests.id', 'desc');

    return res.json({ success: true, data: requests });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch purchase requests.', error: err.message });
  }
});

// PUT /api/v1/inventory/purchase-requests/:id/status - Update Purchase Request Status (Purchasing Action)
router.put('/purchase-requests/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, purchasing_remarks } = req.body;

    const request = await db('purchase_requests').where({ id }).first();
    if (!request) {
      return res.status(404).json({ success: false, message: 'Purchase request not found.' });
    }

    const validStatuses = ['Approved', 'Order Placed', 'Fulfilled', 'Rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Allowed values: ${validStatuses.join(', ')}` });
    }

    await db('purchase_requests').where({ id }).update({
      status,
      purchasing_remarks: purchasing_remarks ? String(purchasing_remarks).trim() : null,
      decided_by: req.user.id,
      updated_at: new Date(),
    });

    await AuditService.logEvent({
      userId: req.user.id,
      userRole: req.user.roles?.[0] || 'User',
      action: `PURCHASE_REQUEST_STATUS_${status.toUpperCase().replace(/\s+/g, '_')}`,
      entityType: 'PurchaseRequest',
      entityId: String(id),
      newValues: { request_number: request.request_number, status, purchasing_remarks },
    });

    return res.json({
      success: true,
      message: `Purchase request ${request.request_number} status updated to '${status}'.`,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
