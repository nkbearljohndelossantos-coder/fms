import ExcelJS from 'exceljs';

async function previewImport() {
  const filePath = 'C:/Users/earlj/Downloads/FINAL RAW MATS FOR RE-INVENTORY.xlsx';
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  let totalItemsFound = 0;
  const itemsBySheet = {};

  workbook.worksheets.forEach((sheet) => {
    const sheetItems = [];
    sheet.eachRow((row, rowNumber) => {
      // Skip header rows (typically first 4 rows)
      if (rowNumber < 4) return;

      const itemCell = row.getCell(2).value; // Col B: Item Name
      let itemName = '';
      if (itemCell && typeof itemCell === 'object') {
        itemName = itemCell.result || itemCell.text || '';
      } else if (itemCell) {
        itemName = String(itemCell).trim();
      }

      // Ignore headers or empty names
      if (!itemName || itemName.toUpperCase().includes('ITEM') || itemName.toUpperCase().includes('CATEGORY') || itemName.toUpperCase().includes('TOTAL')) {
        return;
      }

      // Extract Vendor (Col 4 / D)
      let supplier = row.getCell(4).value;
      if (supplier && typeof supplier === 'object') supplier = supplier.result || supplier.text || '';
      supplier = supplier ? String(supplier).trim() : 'Default Vendor';

      // Extract Storage Location (Col 6 / F)
      let storage = row.getCell(6).value;
      if (storage && typeof storage === 'object') storage = storage.result || storage.text || '';
      storage = storage ? String(storage).trim() : 'Warehouse Main';

      // Extract Price / Cost (Col 7 / G)
      let price = row.getCell(7).value;
      if (price && typeof price === 'object') price = price.result || 0;
      price = parseFloat(price || 0);

      // Extract Stock Quantity: check Col 11 (K: Actual Stock) or Col 9 (I: Initial Stock)
      let stockCell = row.getCell(11).value;
      if (stockCell === null || stockCell === undefined || stockCell === '') {
        stockCell = row.getCell(9).value;
      }
      if (stockCell && typeof stockCell === 'object') stockCell = stockCell.result || 0;
      let stock = parseFloat(stockCell || 0);

      if (isNaN(stock)) stock = 0;
      if (isNaN(price)) price = 0;

      // Determine UOM from header or context (defaults to kg or g)
      let uom = 'kg';
      if (sheet.name.toUpperCase().includes('FOOD') || sheet.name.toUpperCase().includes('SAMPLE')) {
        uom = 'g';
      }

      sheetItems.push({
        rowNumber,
        itemName,
        supplier,
        storage,
        price,
        stock,
        uom,
      });
    });

    itemsBySheet[sheet.name] = sheetItems;
    totalItemsFound += sheetItems.length;
  });

  console.log(`\n==================================================`);
  console.log(`TOTAL RAW MATERIAL ITEMS FOUND: ${totalItemsFound}`);
  console.log(`==================================================`);

  for (const [sheetName, items] of Object.entries(itemsBySheet)) {
    console.log(`Sheet "${sheetName}": ${items.length} items`);
    if (items.length > 0) {
      console.log('  Sample Item 1:', items[0]);
      if (items.length > 1) console.log('  Sample Item 2:', items[1]);
    }
  }
}

previewImport().catch(console.error);
