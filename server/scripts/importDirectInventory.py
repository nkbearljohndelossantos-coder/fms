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

                                    # Determine item_type & category
                                    item_type = 'RAW_MATERIAL'
                                    category = 'Raw Material'

                                    if any(w in sheet_name.upper() for w in ['FINISH', 'TIKTOK', 'STOCK FINISH']):
                                        item_type = 'FINISHED_GOODS'
                                        category = 'Finished Product'
                                    elif any(w in item_upper for w in ['BOTTLE', 'BOX', 'JAR', 'CAP', 'POUCH', 'LABEL', 'STICKER', 'PACKAGING', 'TUBE', 'DROPPER', 'PUMP']):
                                        item_type = 'PACKAGING'
                                        category = 'Packaging Material'

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
                                        'category': category
                                    })
                        elem.clear()

            print(f"  -> Sheet '{sheet_name}': Extracted {len(sheet_items)} items.")
            sys.stdout.flush()
            all_extracted_items.extend(sheet_items)

        print(f"\nTotal Valid Items Extracted: {len(all_extracted_items)}")
        sys.stdout.flush()

        # 3. Import directly into SQLite Database
        print("Connecting to SQLite database at:", db_path)
        sys.stdout.flush()
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        inserted_materials = 0
        updated_materials = 0
        inserted_vendors = 0
        inserted_inventory = 0
        updated_inventory = 0

        code_counter = 5000

        for item in all_extracted_items:
            name = item['name']
            supplier_name = item['supplier'] or 'Default Vendor'
            storage = item['storage'] or item['sheet'].strip()
            price = item['price']
            stock = item['stock']
            uom = item['uom']
            item_type = item['item_type']
            category = item['category']

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

            # 2. Material
            cursor.execute("SELECT id FROM materials WHERE name = ?", (name,))
            m_row = cursor.fetchone()
            if m_row:
                material_id = m_row[0]
                cursor.execute("UPDATE materials SET cost = ?, category = ?, vendor_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (price, category, vendor_id, material_id))
                updated_materials += 1
            else:
                code_counter += 1
                prefix = 'RM' if item_type == 'RAW_MATERIAL' else ('PKG' if item_type == 'PACKAGING' else 'FG')
                m_code = f"{prefix}-IMP-{code_counter}"
                uom_cat = 'MASS' if uom in ['kg', 'g'] else 'COUNT'
                cursor.execute("""
                    INSERT INTO materials (code, name, category, vendor_id, uom, uom_category, cost, currency_code, is_inventoried, is_active, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'PHP', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """, (m_code, name, category, vendor_id, uom, uom_cat, price))
                material_id = cursor.lastrowid
                inserted_materials += 1

            # 3. Inventory Item (Bypassing QA receiving process -> Directly set status to NORMAL and current/available stock)
            lot_number = f"LOT-IMP-{material_id}"
            cursor.execute("SELECT id FROM inventory_items WHERE material_id = ? OR lot_number = ?", (material_id, lot_number))
            inv_row = cursor.fetchone()

            if inv_row:
                inv_id = inv_row[0]
                cursor.execute("""
                    UPDATE inventory_items
                    SET item_type = ?, current_stock = ?, available_stock = ?, uom = ?, location = ?, vendor_id = ?, status = 'NORMAL', updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                """, (item_type, stock, stock, uom, storage, vendor_id, inv_id))
                updated_inventory += 1
            else:
                cursor.execute("""
                    INSERT INTO inventory_items (item_type, material_id, lot_number, vendor_id, current_stock, reserved_stock, available_stock, minimum_stock, reorder_level, uom, location, status, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, 0, ?, 0, 0, ?, ?, 'NORMAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """, (item_type, material_id, lot_number, vendor_id, stock, stock, uom, storage))
                inserted_inventory += 1

        conn.commit()
        conn.close()

        print(f"\n==================================================")
        print(f"DIRECT INVENTORY IMPORT COMPLETE (QA BYPASSED):")
        print(f"  - Total Excel Items Imported: {len(all_extracted_items)}")
        print(f"  - Materials Created/Updated: {inserted_materials + updated_materials}")
        print(f"  - Vendors Created: {inserted_vendors}")
        print(f"  - Active Inventory Stock Lots (Status: NORMAL): {inserted_inventory + updated_inventory}")
        print(f"==================================================\n")

if __name__ == '__main__':
    parse_and_import()
