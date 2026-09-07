import ExcelJS from 'exceljs';
import path from 'path';

async function inspectWorkbook() {
  const filePath = 'C:/Users/earlj/Downloads/FINAL RAW MATS FOR RE-INVENTORY.xlsx';
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  console.log(`\n==================================================`);
  console.log(`WORKBOOK INSPECTION: ${filePath}`);
  console.log(`Worksheets (${workbook.worksheets.length}): ${workbook.worksheets.map(w => w.name).join(', ')}`);
  console.log(`==================================================\n`);

  for (const sheet of workbook.worksheets) {
    console.log(`\n--- Sheet: "${sheet.name}" | Total Rows: ${sheet.rowCount} ---`);

    // Print non-empty header rows (first 10 rows)
    for (let r = 1; r <= Math.min(10, sheet.rowCount); r++) {
      const row = sheet.getRow(r);
      const cells = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        let val = cell.value;
        if (val && typeof val === 'object') {
          val = val.result !== undefined ? val.result : (val.text !== undefined ? val.text : (val.richText ? val.richText.map(t=>t.text).join('') : JSON.stringify(val)));
        }
        if (val !== null && val !== undefined && String(val).trim() !== '') {
          cells.push(`Col ${colNumber}: "${String(val).trim()}"`);
        }
      });
      if (cells.length > 0) {
        console.log(`Row ${r}: ${cells.join(' | ')}`);
      }
    }
  }
}

inspectWorkbook().catch(console.error);
