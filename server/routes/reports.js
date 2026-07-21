import { express } from '../cjsRequire.js';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { generateFormulaMasterListExcel, generateFormulaDetailExcel, renderHtmlToPdf } from '../services/reportService.js';

const router = express.Router();

// GET /api/v1/reports/formulas/excel
router.get('/formulas/excel', authenticateToken, async (req, res) => {
  try {
    const formulas = await db('formulas').select('*').orderBy('code', 'asc');

    for (const f of formulas) {
      const latest = await db('formula_versions').where({ formula_id: f.id }).orderBy('created_at', 'desc').first();
      f.latest_version = latest;
    }

    const buffer = await generateFormulaMasterListExcel(formulas);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="NKB_Formula_Master_List.xlsx"');
    return res.send(buffer);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to generate Excel report.', error: err.message });
  }
});

// GET /api/v1/reports/formulas/:versionId/pdf
router.get('/formulas/:versionId/pdf', authenticateToken, async (req, res) => {
  try {
    const { versionId } = req.params;
    const version = await db('formula_versions')
      .join('formulas', 'formula_versions.formula_id', 'formulas.id')
      .where('formula_versions.id', versionId)
      .select('formula_versions.*', 'formulas.code as formula_code', 'formulas.name as formula_name', 'formulas.product_category', 'formulas.department')
      .first();

    if (!version) {
      return res.status(404).json({ success: false, message: 'Version not found.' });
    }

    const materials = await db('formula_version_materials').where({ version_id: versionId }).orderBy('addition_order', 'asc');
    const instructions = await db('formula_instructions').where({ version_id: versionId }).orderBy('step_number', 'asc');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; padding: 20px; }
          h1 { color: #0284c7; margin-bottom: 5px; font-size: 20px; }
          .header-table, .data-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .header-table td { padding: 6px; }
          .data-table th, .data-table td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
          .data-table th { background-color: #0284c7; color: white; }
          .badge { background-color: #0284c7; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; }
        </style>
      </head>
      <body>
        <h1>NKB Formulation Management System</h1>
        <h3>Formula Detail Sheet — ${version.formula_code} (${version.formula_name})</h3>
        <table class="header-table">
          <tr>
            <td><strong>Version:</strong> ${version.major_version}.${version.minor_version} <span class="badge">${version.version_status}</span></td>
            <td><strong>Category:</strong> ${version.product_category}</td>
          </tr>
          <tr>
            <td><strong>Target Batch Size:</strong> ${version.target_batch_size} ${version.target_batch_uom}</td>
            <td><strong>Expected Yield:</strong> ${version.expected_yield}%</td>
          </tr>
          <tr>
            <td><strong>Shelf Life:</strong> ${version.shelf_life || '-'}</td>
            <td><strong>Storage:</strong> ${version.storage_condition || '-'}</td>
          </tr>
        </table>

        <h4>Ingredient Composition Breakdown</h4>
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Material Code</th>
              <th>Material Name</th>
              <th>Percentage (%)</th>
              <th>Quantity</th>
              <th>UOM</th>
              <th>Function</th>
            </tr>
          </thead>
          <tbody>
            ${materials.map((m, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${m.material_code_snapshot}</td>
                <td>${m.material_name_snapshot}</td>
                <td>${Number(m.percentage).toFixed(4)}%</td>
                <td>${Number(m.calculated_quantity).toFixed(4)}</td>
                <td>${m.uom_snapshot}</td>
                <td>${m.function_name || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        ${instructions.length > 0 ? `
          <h4>Manufacturing Instructions</h4>
          <ol>
            ${instructions.map(i => `<li>${i.instruction_text}</li>`).join('')}
          </ol>
        ` : ''}
      </body>
      </html>
    `;

    const pdfBuffer = await renderHtmlToPdf(htmlContent);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Formula_${version.formula_code}_V${version.major_version}.${version.minor_version}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to generate PDF report.', error: err.message });
  }
});

export default router;
