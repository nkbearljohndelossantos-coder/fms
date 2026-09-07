import zipfile
import xml.etree.ElementTree as ET
import re
import sqlite3
import sys
import os

def parse_and_import():
    excel_path = 'C:/Users/earlj/Downloads/FINAL RAW MATS FOR RE-INVENTORY.xlsx'
    db_path = 'E:/Formulation Manager Pro/database/nkb_formulation.sqlite'

    if not os.path.exists(excel_path):
        print(f"Error: File not found at {excel_path}")
        return

    print("Opening Excel archive:", excel_path)
    sys.stdout.flush()

    with zipfile.ZipFile(excel_path, 'r') as z:
        # 1. Parse sharedStrings.xml
        shared_strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            print("Parsing shared strings...")
            sys.stdout.flush()
            with z.open('xl/sharedStrings.xml') as f:
                for event, elem in ET.iterparse(f, events=('end',)):
                    if elem.tag.endswith('si'):
                        text_parts = []
                        for child in elem.iter():
                            if child.tag.endswith('t') and child.text:
                                text_parts.append(child.text)
                        shared_strings.append("".join(text_parts))
                        elem.clear()
        print(f"Loaded {len(shared_strings)} shared strings.")
        sys.stdout.flush()

        # 2. Get sheet names and targets
        wb_tree = ET.fromstring(z.read('xl/workbook.xml'))
        rels_tree = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))

        rel_map = {}
        for rel in rels_tree.findall('{http://schemas.openxmlformats.org/package/2006/relationships}Relationship'):
            rel_map[rel.attrib['Id']] = rel.attrib['Target']

        sheet_files = []
        for s in wb_tree.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheet'):
            name = s.attrib.get('name')
            r_id = s.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
            target = rel_map.get(r_id, '')
            path_in_zip = 'xl/' + target if not target.startswith('xl/') else target
            sheet_files.append((name, path_in_zip))

        def col2num(col_str):
            num = 0
            for c in col_str:
                num = num * 26 + (ord(c.upper()) - ord('A')) + 1
            return num

        all_extracted_items = []

        for sheet_name, sheet_path in sheet_files:
            if sheet_path not in z.namelist():
                continue

            print(f"Parsing sheet '{sheet_name}'...")
            sys.stdout.flush()

            sheet_items = []
            with z.open(sheet_path) as f:
                for event, elem in ET.iterparse(f, events=('end',)):
                    if elem.tag.endswith('row'):
                        row_num = int(elem.attrib.get('r', 0))
                        if row_num >= 4:
                            cells = {}
                            for c in elem.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
                                r_ref = c.attrib.get('r', '')
                                col_letter = re.sub(r'[0-9]', '', r_ref)
                                col_num = col2num(col_letter)
                                c_type = c.attrib.get('t', '')

                                v_elem = c.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
                                val = v_elem.text if v_elem is not None else None

                                if val is not None:
                                    if c_type == 's':
                                        try:
                                            val = shared_strings[int(val)]
                                        except:
                                            pass
                                    cells[col_num] = str(val).strip()

                            item_name = cells.get(2, '')
                            if item_name:
                                item_upper = item_name.upper()
                                if not any(w in item_upper for w in ['ITEM /CATEGORY', 'ITEM/CATEGORY', 'PRODUCT STICKER', 'TOTAL ESTIMATED COST', 'INITIAL STOCK', 'ACTUAL STOCK']):
                                    supplier = cells.get(4, cells.get(3, 'Default Vendor'))
                                    if supplier.upper() in ['BRAND', 'SUPPLIER', 'APPLICATION', 'STORAGE']:
                                        supplier = 'Default Vendor'

                                    storage = cells.get(6, cells.get(5, sheet_name.strip()))
                                    if storage.upper() in ['STORAGE', 'APPLICATION']:
                                        storage = sheet_name.strip()

                                    try:
                                        price = float(cells.get(7, 0))
                                    except:
                                        price = 0.0

                                    try:
                                        stock_str = cells.get(11, cells.get(9, 0))
                                        stock = float(stock_str)
                                    except:
                                        stock = 0.0

                                    uom = 'kg'
                                    if 'FOOD' in sheet_name.upper() or 'SAMPLE' in sheet_name.upper():
                                        uom = 'g'

                                    # Determine item_type
                                    item_type = 'RAW_MATERIAL'
                                    if any(w in sheet_name.upper() for w in ['FINISH', 'TIKTOK', 'STOCK FINISH']):
                                        item_type = 'FINISHED_GOODS'
                                    elif any(w in item_upper for w in ['BOTTLE', 'BOX', 'JAR', 'CAP', 'POUCH', 'LABEL', 'STICKER', 'PACKAGING', 'TUBE', 'DROPPER', 'PUMP']):
                                        item_type = 'PACKAGING'

                                    sheet_items.append({
                                        'sheet': sheet_name,
                                        'row': row_num,
                                        'name': item_name,
                                        'supplier': supplier,
                                        'storage': storage,
                                        'price': price,
                                        'stock': stock,
                                        'uom': uom,
                                        'item_type': item_type,
                                    })
                        elem.clear()

            print(f"  -> Sheet '{sheet_name}': Extracted {len(sheet_items)} items.")
            sys.stdout.flush()
            all_extracted_items.extend(sheet_items)

        print(f"\nTotal Valid Items Extracted: {len(all_extracted_items)}")
        sys.stdout.flush()

        # 3. Connect to SQLite and update inventory_items ONLY (Keeping materials table clean!)
        print("Connecting to SQLite database at:", db_path)
        sys.stdout.flush()
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Clean up imported items from materials table (keep seed materials intact)
        cursor.execute("DELETE FROM materials WHERE code LIKE 'RM-IMP-%' OR code LIKE 'PKG-IMP-%' OR code LIKE 'FG-IMP-%' OR code LIKE 'RM-EXP-%'")
        conn.commit()

        # Clear existing inventory_items
        cursor.execute("DELETE FROM inventory_items")
        conn.commit()

        inserted_vendors = 0
        inserted_inventory = 0
        code_counter = 7000

        for item in all_extracted_items:
            name = item['name']
            supplier_name = item['supplier'] or 'Default Vendor'
            storage = item['storage'] or item['sheet'].strip()
            price = item['price']
            stock = item['stock']
            uom = item['uom']
            item_type = item['item_type']

            # 1. Vendor
            cursor.execute("SELECT id FROM vendors WHERE name = ?", (supplier_name,))
            v_row = cursor.fetchone()
            if v_row:
                vendor_id = v_row[0]
            else:
                code_counter += 1
                v_code = f"VEN-IMP-{code_counter}"
                cursor.execute("INSERT INTO vendors (code, name, is_active, created_at, updated_at) VALUES (?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)", (v_code, supplier_name))
                vendor_id = cursor.lastrowid
                inserted_vendors += 1

            # 2. Insert into inventory_items ONLY (material_id = NULL)
            code_counter += 1
            lot_number = f"LOT-INV-{code_counter}"

            cursor.execute("""
                INSERT INTO inventory_items (
                    item_type, item_name, material_id, lot_number, vendor_id,
                    current_stock, reserved_stock, available_stock, minimum_stock, reorder_level,
                    uom, location, cost, status, created_at, updated_at
                )
                VALUES (?, ?, NULL, ?, ?, ?, 0, ?, 0, 0, ?, ?, ?, 'NORMAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """, (item_type, name, lot_number, vendor_id, stock, stock, uom, storage, price))
            inserted_inventory += 1

        conn.commit()

        # Count remaining materials & inventory items
        cursor.execute("SELECT COUNT(*) FROM materials")
        mat_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM inventory_items")
        inv_count = cursor.fetchone()[0]

        conn.close()

        print(f"\n==================================================")
        print(f"INVENTORY-ONLY IMPORT COMPLETE:")
        print(f"  - Materials Table Count (Kept Clean): {mat_count}")
        print(f"  - Total Inventory Items Imported: {inv_count}")
        print(f"  - Vendors Registered: {inserted_vendors}")
        print(f"==================================================\n")

if __name__ == '__main__':
    parse_and_import()
