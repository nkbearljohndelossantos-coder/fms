import { apiFetch } from '../services/api';

/**
 * Production Sheet PDF Generator & Native Print Utility
 * Matches the official NKB Manufacturing Corporation Production Sheet document standard.
 */
function showCopySelectorModal(onConfirm) {
  if (typeof document === 'undefined') {
    onConfirm(1);
    return;
  }

  let modal = document.getElementById('nkb_copy_selector_modal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'nkb_copy_selector_modal';
  modal.style.position = 'fixed';
  modal.style.inset = '0';
  modal.style.zIndex = '999999';
  modal.style.backgroundColor = 'rgba(15, 23, 42, 0.65)';
  modal.style.backdropFilter = 'blur(4px)';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.padding = '16px';

  modal.innerHTML = `
    <div style="background: #ffffff; width: 100%; max-width: 420px; border-radius: 20px; padding: 24px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); border: 1px solid #e2e8f0; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 14px; margin-bottom: 16px;">
        <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 8px;">
          🖨️ Set Production Sheet Copies
        </h3>
        <button id="nkb_modal_close_btn" style="background: #f1f5f9; border: none; font-size: 14px; color: #64748b; cursor: pointer; font-weight: bold; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">✕</button>
      </div>

      <p style="font-size: 12.5px; color: #475569; margin: 0 0 16px 0; line-height: 1.45;">
        How many production sheet copies do you want to print? If printing multiple copies, each copy will be assigned a <strong>UNIQUE Compounding Code (CP-YYYY-XXXX)</strong>.
      </p>

      <div style="margin-bottom: 20px;">
        <label style="display: block; font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 6px;">Number of Copies to Print *</label>
        <input type="number" id="nkb_copy_count_input" min="1" max="50" value="1" style="width: 100%; padding: 10px 14px; border: 2px solid #cbd5e1; border-radius: 10px; font-size: 15px; font-weight: 800; color: #0f172a; box-sizing: border-box; outline: none; transition: border-color 0.2s;" />
      </div>

      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button id="nkb_modal_cancel_btn" style="padding: 9px 18px; background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 12.5px; font-weight: 700; cursor: pointer;">
          Cancel
        </button>
        <button id="nkb_modal_confirm_btn" style="padding: 9px 22px; background: #059669; color: #ffffff; border: none; border-radius: 10px; font-size: 12.5px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 6px -1px rgba(5, 150, 105, 0.25);">
          🖨️ Generate PDF / Print
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const inputEl = document.getElementById('nkb_copy_count_input');
  if (inputEl) {
    inputEl.focus();
    inputEl.select();
  }

  const closeModal = () => modal.remove();

  document.getElementById('nkb_modal_close_btn').onclick = closeModal;
  document.getElementById('nkb_modal_cancel_btn').onclick = closeModal;

  document.getElementById('nkb_modal_confirm_btn').onclick = () => {
    const val = parseInt(inputEl.value, 10) || 1;
    closeModal();
    onConfirm(val);
  };

  inputEl.onkeydown = (e) => {
    if (e.key === 'Enter') {
      const val = parseInt(inputEl.value, 10) || 1;
      closeModal();
      onConfirm(val);
    } else if (e.key === 'Escape') {
      closeModal();
    }
  };
}

export async function printProductionSheet({ version, formula, materials, categoryDetails, user, copies: requestedCopies, layoutConfig }) {
  if (!version) {
    alert('Invalid formula version selected.');
    return;
  }

  // If copy count hasn't been set by user, show the in-app copy selector modal first!
  if (typeof requestedCopies !== 'number' || requestedCopies < 1) {
    showCopySelectorModal((selectedCopies) => {
      printProductionSheet({ version, formula, materials, categoryDetails, user, copies: selectedCopies, layoutConfig });
    });
    return;
  }

  const copiesCount = requestedCopies;

  // Attempt to open new window for print preview
  let printWindow = null;
  try {
    printWindow = window.open('', '_blank', 'width=950,height=1100');
  } catch (e) {
    printWindow = null;
  }

  const details = categoryDetails || version?.categoryDetails || version?.cosmeticDetails || {};
  const targetPh = details.target_ph || details.target_ph_range || '';
  const actualPh = details.actual_ph || '';
  const viscosity = details.viscosity_cp || details.target_viscosity || '';
  const appearance = details.appearance || '';
  const remarks = details.remarks || '';

  const formulaCode = formula?.code || version?.formula_code || '';
  const formulaName = (formula?.name || version?.formula_name || 'Cosmetic Formulation').toUpperCase();
  let versionNum = version?.version || `${version?.major_version || 1}.${version?.minor_version || 0}`;
  if (!String(versionNum).toLowerCase().startsWith('v')) {
    versionNum = `V${versionNum}`;
  }
  const defaultPdfFilename = `${formulaName} ${versionNum}`.trim();

  // Base Compounding Control Number (Strict CP-xxxx format with exactly 4 digits)
  const formatBaseCompoundingNo = () => {
    let raw = version?.compounding_code || version?.compounding_number || version?.compoundingNo;
    if (!raw && version?.batch_number) {
      raw = version.batch_number;
    }

    if (raw) {
      const str = String(raw).trim().toUpperCase().replace(/^(BAT|CP)-?/, '');
      const digits = str.replace(/[^0-9]/g, '');
      if (digits) {
        const last4 = digits.length > 4 ? digits.slice(-4) : digits;
        return parseInt(last4, 10) || 1;
      }
    }

    const codeDigits = (formulaCode || '').replace(/[^0-9]/g, '');
    if (codeDigits) {
      const last4 = codeDigits.length > 4 ? codeDigits.slice(-4) : codeDigits;
      return parseInt(last4, 10) || 1;
    }

    const vId = version?.formula_id || version?.id || formula?.id;
    const idDigits = String(vId || 1).replace(/[^0-9]/g, '');
    const last4 = idDigits.length > 4 ? idDigits.slice(-4) : idDigits;
    return parseInt(last4, 10) || 1;
  };

  const baseNum = formatBaseCompoundingNo();

  const targetBatchSizeNum = parseFloat(version?.overrideBatchSize || version?.target_batch_size || 100);
  const formattedTargetQty = targetBatchSizeNum.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const batchUom = (version?.target_batch_uom || 'G').toUpperCase();

  const preparedByName = user?.first_name || user?.firstName
    ? `${user.first_name || user.firstName} ${user.last_name || user.lastName || ''}`.trim()
    : 'Norvin Bella';

  const dateStr = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

  const formatPhaseTitle = (rawName, idx) => {
    if (!rawName) return `Phase ${String.fromCharCode(65 + idx)}`;
    const match = String(rawName).trim().match(/^Phase\s+([A-Za-z0-9]+)/i);
    if (match) return `Phase ${match[1].toUpperCase()}`;
    const lower = String(rawName).toLowerCase();
    if (lower.includes('water')) return 'Phase A';
    if (lower.includes('surfactant') || lower.includes('oil')) return 'Phase B';
    if (lower.includes('active')) return 'Phase C';
    if (lower.includes('cooling')) return 'Phase D';
    if (lower.includes('post')) return 'Phase E';
    return rawName.startsWith('Phase') ? rawName : `Phase ${rawName}`;
  };

  // Group materials by Phase with strict deduplication
  const phaseMap = {};
  if (Array.isArray(materials)) {
    const seenItems = new Set();
    materials.forEach((m, idx) => {
      const pName = formatPhaseTitle(m.phase_name, idx);
      const matId = m.material_id || m.id || m.material_code_snapshot || m.material_name_snapshot || idx;
      const uniqueKey = `${pName}_${matId}`;
      if (seenItems.has(uniqueKey)) return;
      seenItems.add(uniqueKey);

      if (!phaseMap[pName]) {
        phaseMap[pName] = [];
      }
      phaseMap[pName].push(m);
    });
  }

  let activeLayout = layoutConfig;
  const sheetCompoundingCode = version?.compounding_code || version?.compounding_number || (formula?.code ? `CP-${formula.code.replace(/[^0-9]/g, '')}` : 'CP-0001');
  if (!activeLayout && typeof localStorage !== 'undefined') {
    try {
      const cached = localStorage.getItem(`nkb_sheet_layout_${sheetCompoundingCode}`);
      if (cached) activeLayout = JSON.parse(cached);
    } catch (_) {}
  }

  const qWidth = activeLayout?.columnWidths?.quantity || 15;
  const rWidth = activeLayout?.columnWidths?.rawMaterial || 40;
  const sWidth = activeLayout?.columnWidths?.supplier || 25;
  const lWidth = activeLayout?.columnWidths?.lotNo || 20;
  const customRowHeights = activeLayout?.rowHeights?.rows || {};

  const getRowHeightStyle = (rowId) => {
    const h = customRowHeights[rowId];
    return h ? `style="height: ${h}px;"` : '';
  };

  let tableRowsHtml = '';

  const phaseKeys = Object.keys(phaseMap);
  if (phaseKeys.length === 0) {
    tableRowsHtml = `
      <tr class="phase-header-row" ${getRowHeightStyle('phase-0')}><td colspan="4">Phase A</td></tr>
      <tr class="ingredient-row" ${getRowHeightStyle('item-0')}>
        <td class="qty-col"><span class="checkbox-box">☐</span> ${formattedTargetQty} ${batchUom}</td>
        <td class="mat-col">RAW MATERIAL BASE COMPOSITION</td>
        <td class="sup-col"></td>
        <td class="lot-col"></td>
      </tr>
    `;
  } else {
    phaseKeys.forEach((pName, pIdx) => {
      const phaseTitle = formatPhaseTitle(pName, pIdx);

      tableRowsHtml += `
        <tr class="phase-header-row" ${getRowHeightStyle(`phase-${pIdx}`)}>
          <td colspan="4">${phaseTitle}</td>
        </tr>
      `;

      phaseMap[pName].forEach((m, mIdx) => {
        const pct = parseFloat(m.percentage || 0);
        const calcWeight = (pct / 100) * targetBatchSizeNum;
        const formattedQty = calcWeight.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        const matName = (
          (m.mat_name && String(m.mat_name).trim()) ||
          (m.material_name && String(m.material_name).trim()) ||
          (m.name && String(m.name).trim()) ||
          (m.material_name_snapshot && String(m.material_name_snapshot).trim()) ||
          (m.material_code_snapshot && String(m.material_code_snapshot).trim()) ||
          (m.material_code && String(m.material_code).trim()) ||
          (m.mat_code && String(m.mat_code).trim()) ||
          (m.code && String(m.code).trim()) ||
          'RAW MATERIAL'
        ).toUpperCase();
        const supName = m.supplier || m.supplier_name || m.vendor_name || m.vendor_code || 'NKB Approved Supplier';

        tableRowsHtml += `
          <tr class="ingredient-row" ${getRowHeightStyle(`phase-${pIdx}-item-${mIdx}`)}>
            <td class="qty-col">
              <span class="checkbox-box">☐</span>
              <span>${formattedQty}</span>
            </td>
            <td class="mat-col">${matName}</td>
            <td class="sup-col">${supName}</td>
            <td class="lot-col"></td>
          </tr>
        `;
      });
    });
  }
  const totalItemCount = (materials || []).length;
  let pageMargin = '6mm 10mm';
  let bodyPadding = '10px';
  let headerMarginBottom = '10px';
  let metaMarginBottom = '10px';
  let tableMarginBottom = '10px';
  let rowPadding = '4px 8px';
  let rowFontSize = '11.5px';
  let phasePadding = '3px 8px';
  let notesMarginTop = '10px';
  let notesMarginBottom = '10px';
  let sigMarginTop = '12px';

  if (totalItemCount > 30) {
    pageMargin = '3mm 5mm';
    bodyPadding = '2px';
    headerMarginBottom = '3px';
    metaMarginBottom = '3px';
    tableMarginBottom = '3px';
    rowPadding = '1.5px 3px';
    rowFontSize = '8px';
    phasePadding = '1.5px 3px';
    notesMarginTop = '3px';
    notesMarginBottom = '3px';
    sigMarginTop = '4px';
  } else if (totalItemCount > 22) {
    pageMargin = '4mm 6mm';
    bodyPadding = '4px';
    headerMarginBottom = '4px';
    metaMarginBottom = '4px';
    tableMarginBottom = '4px';
    rowPadding = '2px 4px';
    rowFontSize = '9px';
    phasePadding = '2px 4px';
    notesMarginTop = '4px';
    notesMarginBottom = '4px';
    sigMarginTop = '6px';
  } else if (totalItemCount > 16) {
    pageMargin = '4mm 8mm';
    bodyPadding = '5px';
    headerMarginBottom = '5px';
    metaMarginBottom = '5px';
    tableMarginBottom = '5px';
    rowPadding = '2px 5px';
    rowFontSize = '9.5px';
    phasePadding = '2px 5px';
    notesMarginTop = '5px';
    notesMarginBottom = '5px';
    sigMarginTop = '6px';
  } else if (totalItemCount > 12) {
    pageMargin = '5mm 8mm';
    bodyPadding = '6px';
    headerMarginBottom = '6px';
    metaMarginBottom = '6px';
    tableMarginBottom = '6px';
    rowPadding = '2.5px 6px';
    rowFontSize = '10.5px';
    phasePadding = '2px 6px';
    notesMarginTop = '6px';
    notesMarginBottom = '6px';
    sigMarginTop = '8px';
  } else if (totalItemCount > 8) {
    pageMargin = '5.5mm 10mm';
    bodyPadding = '8px';
    headerMarginBottom = '8px';
    metaMarginBottom = '8px';
    tableMarginBottom = '8px';
    rowPadding = '3px 8px';
    rowFontSize = '11px';
    phasePadding = '3px 8px';
    notesMarginTop = '8px';
    notesMarginBottom = '8px';
    sigMarginTop = '10px';
  }

  const selectedFontName = localStorage.getItem('nkb_document_font') || version?.document_font || 'Inter';
  let googleFontUrl = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap';
  let fontFamilyCss = "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  if (selectedFontName === 'Roboto') {
    googleFontUrl = 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap';
    fontFamilyCss = "'Roboto', system-ui, -apple-system, sans-serif";
  } else if (selectedFontName === 'Outfit') {
    googleFontUrl = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap';
    fontFamilyCss = "'Outfit', system-ui, -apple-system, sans-serif";
  } else if (selectedFontName === 'Segoe UI') {
    googleFontUrl = '';
    fontFamilyCss = '"Segoe UI", Arial, Helvetica, sans-serif';
  } else if (selectedFontName === 'Georgia') {
    googleFontUrl = '';
    fontFamilyCss = 'Georgia, "Times New Roman", Times, serif';
  }

  // Request atomic unique compounding codes from backend database to guarantee zero duplicates & store audit logs
  let generatedLogEntries = [];
  try {
    const res = await apiFetch('/api/v1/compounding-codes/generate', {
      method: 'POST',
      body: JSON.stringify({
        count: copiesCount,
        formulaCode,
        formulaName,
        formulaVersion: versionNum,
        targetBatchSize: targetBatchSizeNum,
        targetBatchUom: batchUom,
      }),
    });
    const resData = await res.json();
    if (resData.success && Array.isArray(resData.data)) {
      generatedLogEntries = resData.data;
    }
  } catch (err) {
    console.warn('Backend compounding code generation failed, using fallback code:', err);
  }

  // Generate HTML Pages for requested copies (Each page gets its UNIQUE CP-YYYY-XXXX Code)
  let pagesHtml = '';
  for (let i = 0; i < copiesCount; i++) {
    const logItem = generatedLogEntries[i];
    const copyCompoundingNo = logItem?.compounding_code || `CP-${String((baseNum + i) % 10000 || 1).padStart(4, '0')}`;
    const copyBatchNo = logItem?.batch_number || copyCompoundingNo.replace('CP-', 'BAT-');
    const copyBadgeLabel = copiesCount > 1 ? `<span style="font-size: 11px; color: #475569; font-weight: 600;">(Copy ${i + 1} of ${copiesCount})</span>` : '';
    const copyFooterLabel = copiesCount > 1 ? `<div>Copy ${i + 1} of ${copiesCount}</div>` : '<div></div>';

    pagesHtml += `
      <div class="container sheet-page">
        <!-- Header -->
        <div class="doc-header">
          <h1>NKB Manufacturing Corporation</h1>
          <h2>PRODUCTION SHEET ${copyBadgeLabel}</h2>
        </div>

        <!-- Meta Info -->
        <div class="meta-section">
          <div class="meta-col-left">
            <div class="meta-line"><span class="meta-bold">Compounding Code:</span> <span class="num-font" style="color: #0369a1; font-weight: 800;">${copyCompoundingNo}</span></div>
            <div class="meta-line"><span class="meta-bold">Batch Number:</span> <span class="num-font" style="color: #0f172a;">${copyBatchNo}</span></div>
            <div class="meta-line"><span class="meta-bold">Target Quantity:</span> ${formattedTargetQty} ${batchUom}</div>
            <div class="meta-line"><span class="meta-bold">Formulation:</span> ${formulaName}</div>
          </div>
          <div class="meta-col-right">
            <div class="meta-line"><span class="meta-bold">Version:</span> ${versionNum}</div>
            <div class="meta-line"><span class="meta-bold">Date:</span> ${dateStr}</div>
            <div class="meta-line"><span class="meta-bold">Prepared By:</span> ${preparedByName}</div>
          </div>
        </div>

        <!-- Sheet Table -->
        <table class="sheet-table">
          <colgroup>
            <col style="width: ${qWidth}%;" />
            <col style="width: ${rWidth}%;" />
            <col style="width: ${sWidth}%;" />
            <col style="width: ${lWidth}%;" />
          </colgroup>
          <thead>
            <tr ${getRowHeightStyle('header')}>
              <th class="qty-header">Quantity (${batchUom})</th>
              <th class="mat-header">Raw Material</th>
              <th class="sup-header">Supplier / Vendor</th>
              <th class="lot-header" style="text-align: center;">Lot No.</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
            <tr class="total-row" ${getRowHeightStyle('total')}>
              <td class="qty-col">
                <span class="checkbox-box" style="visibility: hidden;">☐</span>
                <span>${formattedTargetQty} ${batchUom}</span>
              </td>
              <td colspan="3"><strong>TOTAL BATCH QUANTITY</strong></td>
            </tr>
          </tbody>
        </table>

        <!-- Quality Parameters & Specifications Table -->
        <div style="margin-top: 15px; margin-bottom: 20px;">
          <div style="font-weight: 800; font-size: 12px; margin-bottom: 6px; letter-spacing: 0.3px; color: #000;">
            QUALITY PARAMETERS & SPECIFICATIONS:
          </div>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #d1d5db; font-size: 12px;">
            <tbody>
              <tr>
                <td style="padding: 6px 10px; border: 1px solid #d1d5db; background-color: #f9fafb; font-weight: 700; width: 25%;">Target pH Range:</td>
                <td style="padding: 6px 10px; border: 1px solid #d1d5db; font-weight: 700; font-variant-numeric: tabular-nums; width: 25%;">${targetPh}</td>
                <td style="padding: 6px 10px; border: 1px solid #d1d5db; background-color: #f9fafb; font-weight: 700; width: 25%;">Actual pH:</td>
                <td style="padding: 6px 10px; border: 1px solid #d1d5db; font-weight: 700; font-variant-numeric: tabular-nums; width: 25%;">${actualPh || '[ ________ ]'}</td>
              </tr>
              <tr>
                <td style="padding: 6px 10px; border: 1px solid #d1d5db; background-color: #f9fafb; font-weight: 700; width: 25%;">Viscosity (cP):</td>
                <td style="padding: 6px 10px; border: 1px solid #d1d5db; font-weight: 700; font-variant-numeric: tabular-nums; width: 25%;">${viscosity}</td>
                <td style="padding: 6px 10px; border: 1px solid #d1d5db; background-color: #f9fafb; font-weight: 700; width: 25%;">Appearance:</td>
                <td style="padding: 6px 10px; border: 1px solid #d1d5db; width: 25%;">${appearance}</td>
              </tr>
              <tr>
                <td style="padding: 6px 10px; border: 1px solid #d1d5db; background-color: #f9fafb; font-weight: 700;">Remarks:</td>
                <td style="padding: 6px 10px; border: 1px solid #d1d5db;" colspan="3">${remarks}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Notes / Instructions -->
        <div class="notes-container">
          <div class="notes-heading">NOTES / INSTRUCTIONS:</div>
          <div class="notes-bullet"><span class="bullet-icon">◆</span> Follow the step order as indicated</div>
          <div class="notes-bullet"><span class="bullet-icon">◆</span> Verify all quantities before processing</div>
          <div class="notes-bullet"><span class="bullet-icon">◆</span> Record actual quantities used</div>
        </div>

        <!-- Signatures Row -->
        <div class="signatures-row">
          <div class="sig-box">
            <div class="sig-title">Prepared by:</div>
            <div class="sig-name">${preparedByName}</div>
            <div class="sig-line"></div>
            <div class="sig-subtext">Name & Signature</div>
          </div>

          <div class="sig-box">
            <div class="sig-title">Checked by:</div>
            <div class="sig-name">&nbsp;</div>
            <div class="sig-line"></div>
            <div class="sig-subtext">QC Name & Signature</div>
          </div>

          <div class="sig-box">
            <div class="sig-title">Completed by:</div>
            <div class="sig-name">&nbsp;</div>
            <div class="sig-line"></div>
            <div class="sig-subtext">Production Team & Date</div>
          </div>
        </div>

        <!-- Page Printable Footer -->
        <div class="print-page-footer">
          <div>NKB Manufacturing Corporation • Production Sheet (${copyCompoundingNo}) — Batch: ${copyBatchNo}</div>
          ${copyFooterLabel}
        </div>
      </div>
    `;
  }

  const htmlDocument = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${defaultPdfFilename} (${copiesCount} Copies)</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      ${googleFontUrl ? `<link href="${googleFontUrl}" rel="stylesheet">` : ''}
      <style>
        @page {
          size: A4 portrait;
          margin: ${pageMargin};
        }
        * {
          box-sizing: border-box;
        }
        body {
          font-family: ${fontFamilyCss};
          color: #0f172a;
          background-color: #ffffff;
          margin: 0;
          padding: ${bodyPadding};
          font-size: ${rowFontSize};
          line-height: 1.35;
          -webkit-font-smoothing: antialiased;
        }
        .num-font {
          font-family: ${fontFamilyCss};
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }
        .container {
          max-width: 780px;
          margin: 0 auto;
        }
        .sheet-page {
          page-break-after: always;
          break-after: page;
          padding-bottom: 12px;
        }
        .sheet-page:last-child {
          page-break-after: avoid;
          break-after: avoid;
        }

        /* Top Header */
        .doc-header {
          text-align: center;
          margin-bottom: ${headerMarginBottom};
        }
        .doc-header h1 {
          font-size: ${totalItemCount > 16 ? '17px' : '20px'};
          font-weight: 800;
          margin: 0 0 2px 0;
          letter-spacing: 0.2px;
          color: #000;
        }
        .doc-header h2 {
          font-size: ${totalItemCount > 16 ? '13px' : '14px'};
          font-weight: 800;
          margin: 0;
          letter-spacing: 1px;
          color: #000;
        }
        /* Meta Grid */
        .meta-section {
          display: flex;
          justify-content: space-between;
          margin-bottom: ${metaMarginBottom};
          font-size: ${totalItemCount > 16 ? '11px' : '12.5px'};
        }
        .meta-col-left {
          text-align: left;
        }
        .meta-col-right {
          text-align: right;
        }
        .meta-line {
          margin-bottom: 2px;
        }
        .meta-bold {
          font-weight: 700;
        }
        /* Main Production Table */
        .sheet-table {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid #d1d5db;
          margin-bottom: ${tableMarginBottom};
          table-layout: fixed;
        }
        .sheet-table th {
          background-color: #ffffff;
          color: #000;
          font-weight: 700;
          font-size: ${rowFontSize};
          padding: ${rowPadding};
          border-bottom: 1px solid #d1d5db;
          text-align: left;
        }
        .sheet-table th.qty-header {
          white-space: nowrap;
        }
        .sheet-table th.mat-header {
          padding-left: 10px;
        }
        .sheet-table th.lot-header {
          text-align: center;
          border-left: 1px solid #d1d5db;
        }
        .lot-col {
          border-left: 1px solid #e5e7eb;
          text-align: center;
        }
        .phase-header-row td {
          background-color: #e5e7eb;
          font-weight: 800;
          font-size: ${rowFontSize};
          padding: ${phasePadding};
          border-top: 1px solid #d1d5db;
          border-bottom: 1px solid #d1d5db;
          color: #000;
        }
        .ingredient-row td {
          padding: ${rowPadding};
          border-bottom: 1px solid #f3f4f6;
          font-size: ${rowFontSize};
        }
        .ingredient-row:nth-child(even) td {
          background-color: #f9fafb;
        }
        .checkbox-box {
          display: inline-block;
          font-size: ${totalItemCount > 16 ? '12px' : '14px'};
          margin-right: 5px;
          line-height: 1;
          vertical-align: middle;
        }
        .qty-col {
          width: 125px;
          font-weight: 700;
          font-family: ${fontFamilyCss};
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
          padding-right: 10px;
        }
        .mat-col {
          font-weight: 600;
          color: #000;
          padding-left: 10px;
        }
        .total-row td {
          background-color: #e5e7eb;
          font-weight: 800;
          padding: ${rowPadding};
          font-size: ${rowFontSize};
          border-top: 1px solid #9ca3af;
        }

        /* Notes & Instructions */
        .notes-container {
          margin-top: ${notesMarginTop};
          margin-bottom: ${notesMarginBottom};
        }
        .notes-heading {
          font-weight: 800;
          font-size: 11px;
          margin-bottom: 4px;
          letter-spacing: 0.3px;
        }
        .notes-bullet {
          font-size: 10.5px;
          margin-bottom: 2px;
          line-height: 1.3;
        }
        .bullet-icon {
          display: inline-block;
          margin-right: 4px;
          font-size: 9px;
        }

        /* Signatures Footer */
        .signatures-row {
          display: flex;
          justify-content: space-between;
          margin-top: ${sigMarginTop};
        }
        .sig-box {
          width: 30%;
          text-align: center;
        }
        .sig-title {
          text-align: left;
          font-size: 11px;
          font-weight: 500;
          margin-bottom: ${totalItemCount > 16 ? '12px' : '18px'};
        }
        .sig-name {
          font-size: 11px;
          font-weight: 700;
          color: #000000;
          margin-bottom: 2px;
          min-height: 15px;
          text-align: center;
        }
        .sig-line {
          border-bottom: 1.5px solid #000000;
          width: 100%;
          margin-bottom: 3px;
        }
        .sig-subtext {
          font-size: 10px;
          color: #4b5563;
          text-align: center;
        }

        /* Printable Footer & Page Numbers */
        .print-page-footer {
          margin-top: 15px;
          padding-top: 6px;
          border-top: 1px dashed #cbd5e1;
          display: flex;
          justify-content: space-between;
          font-size: 9.5px;
          color: #475569;
          font-family: ${fontFamilyCss};
        }

        /* Screen Print Bar Controls */
        .no-print-bar {
          background-color: #1e293b;
          color: #ffffff;
          padding: 12px 20px;
          border-radius: 10px;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .print-btn {
          background-color: #2563eb;
          color: #ffffff;
          border: none;
          padding: 8px 18px;
          border-radius: 6px;
          font-weight: bold;
          font-size: 12px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .print-btn:hover {
          background-color: #1d4ed8;
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: ${pageMargin};
          }
          html, body {
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print-bar {
            display: none !important;
          }
          .container {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .sheet-page {
            padding-bottom: 0 !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .sheet-page:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="no-print-bar">
        <div>
          <strong style="font-size: 13px; display: block; margin-bottom: 2px;">📄 Production Sheet Batch Copies — ${formulaCode}</strong>
          <div style="font-size: 11px; opacity: 0.9;">💡 <strong>Unique Compounding Codes:</strong> ${copiesCount} copy/ies generated with unique sequential <strong>CP-xxxx</strong> control codes.</div>
        </div>
        <div style="display: flex; gap: 10px; align-items: center;">
          <div style="display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.1); padding: 4px 10px; border-radius: 6px;">
            <label style="font-size: 11px; font-weight: bold; color: #cbd5e1;">Copies:</label>
            <input type="number" id="copyCountInput" min="1" max="50" value="${copiesCount}" style="width: 45px; padding: 4px; border-radius: 4px; border: 1px solid #475569; font-weight: bold; text-align: center; color: #000;" />
            <button class="print-btn" style="background-color: #3b82f6; padding: 5px 10px; font-size: 11px;" onclick="promptUpdateCopies()">
              🔄 Change Copies
            </button>
          </div>
          <button class="print-btn" style="background-color: #059669;" onclick="window.print()">
            💾 Save as PDF / Print
          </button>
          <button class="print-btn" style="background-color: #475569;" onclick="window.close()">
            ✖ Close
          </button>
        </div>
      </div>

      ${pagesHtml}

      <script>
        function promptUpdateCopies() {
          const val = parseInt(document.getElementById('copyCountInput').value, 10);
          if (!isNaN(val) && val >= 1) {
            if (window.opener && typeof window.opener.__PRINT_WITH_COPIES__ === 'function') {
              window.opener.__PRINT_WITH_COPIES__(val);
              window.close();
            } else {
              alert('To change copy quantity, please re-click Print from the main application.');
            }
          }
        }
        document.addEventListener('DOMContentLoaded', function() {
          setTimeout(function() {
            window.focus();
            window.print();
          }, 300);
        });
      </script>
    </body>
    </html>
  `;

  // Attach global helper to opener for copy count re-generation
  if (typeof window !== 'undefined') {
    window.__PRINT_WITH_COPIES__ = function(newCopies) {
      printProductionSheet({ version, formula, materials, categoryDetails, user, copies: newCopies });
    };
  }

  if (printWindow && !printWindow.closed) {
    try {
      printWindow.document.open();
      printWindow.document.write(htmlDocument);
      printWindow.document.close();
      return;
    } catch (err) {
      console.warn('Pop-up window writing failed, using iframe print fallback:', err);
    }
  }

  // FALLBACK FOR POPUP BLOCKERS: Print directly in-page using hidden iframe
  let iframe = document.getElementById('nkb_production_sheet_print_iframe');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'nkb_production_sheet_print_iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);
  }

  try {
    const iframeDoc = iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(htmlDocument);
    iframeDoc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        console.error('Iframe print error:', e);
      }
    }, 400);
  } catch (e) {
    alert('Print Error: Unable to open print preview. Please check browser print permissions.');
  }
}
