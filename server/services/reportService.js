import { exceljs, puppeteer } from '../cjsRequire.js';

/**
 * Generate Excel workbook for Formula Master List
 */
export async function generateFormulaMasterListExcel(formulas) {
  const workbook = new exceljs.Workbook();
  const sheet = workbook.addWorksheet('Formula Master List');

  sheet.columns = [
    { header: 'Formula Code', key: 'code', width: 15 },
    { header: 'Formula Name', key: 'name', width: 30 },
    { header: 'Category', key: 'product_category', width: 20 },
    { header: 'Subcategory', key: 'product_subcategory', width: 20 },
    { header: 'Brand Type', key: 'brand_type', width: 15 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Latest Version', key: 'version', width: 15 },
    { header: 'Department', key: 'department', width: 20 },
  ];

  for (const f of formulas) {
    sheet.addRow({
      code: f.code,
      name: f.name,
      product_category: f.product_category,
      product_subcategory: f.product_subcategory || '-',
      brand_type: f.brand_type || '-',
      status: f.status,
      version: f.latest_version ? `${f.latest_version.major_version}.${f.latest_version.minor_version} (${f.latest_version.version_status})` : 'None',
      department: f.department || '-',
    });
  }

  // Header styling
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '0284C7' },
  };

  return await workbook.xlsx.writeBuffer();
}

/**
 * Generate Excel workbook for Formula Detail & Composition
 */
export async function generateFormulaDetailExcel(versionDetail) {
  const workbook = new exceljs.Workbook();
  const { version, materials, instructions } = versionDetail;

  const sheet = workbook.addWorksheet(`Formula ${version.formula_code}`);

  sheet.addRow(['NKB FORMULATION MANAGEMENT SYSTEM']);
  sheet.addRow(['FORMULA COMPOSITION & SPECIFICATION SHEET']);
  sheet.addRow([]);

  sheet.addRow(['Formula Code:', version.formula_code, 'Formula Name:', version.formula_name]);
  sheet.addRow(['Version:', `${version.major_version}.${version.minor_version}`, 'Status:', version.version_status]);
  sheet.addRow(['Category:', version.product_category, 'Target Batch:', `${version.target_batch_size} ${version.target_batch_uom}`]);
  sheet.addRow(['Effective Date:', version.effective_date || '-', 'Approval Timestamp:', version.approval_timestamp || '-']);
  sheet.addRow([]);

  // Materials Header
  const headerRow = sheet.addRow(['Phase', 'Material Code', 'Material Name', 'Percentage (%)', 'Quantity', 'UOM', 'Function']);
  headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0284C7' } };

  for (const m of materials) {
    sheet.addRow([
      m.phase_name || 'Main Phase',
      m.material_code_snapshot,
      m.material_name_snapshot,
      Number(m.percentage).toFixed(4),
      Number(m.calculated_quantity).toFixed(4),
      m.uom_snapshot,
      m.function_name || '-',
    ]);
  }

  return await workbook.xlsx.writeBuffer();
}

/**
 * Render PDF document using Puppeteer
 */
export async function renderHtmlToPdf(htmlContent) {
  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
    });
    return pdfBuffer;
  } catch (err) {
    console.error('Puppeteer PDF Error:', err);
    throw err;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
