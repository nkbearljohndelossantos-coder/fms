export function printSampleRequestForm(data = {}) {
  const {
    request_code = 'SRF-2026-0001',
    revision_no = '',
    request_date = 'Aug 10, 2026',
    company_name = '',
    address = '',
    contact_person = '',
    product_name = '',
    product_classification = 'Cosmetics',
    benchmark = '',
    specific_raw_materials = '',
    texture = '',
    form = '',
    scent_aroma_direction = '',
    color_description = '',
    flavor = '',
    function_claims = '',
    direction_of_use = '',
    net_content = '',
    target_price = '',
    special_instructions = '',
    quantity = '',
    primary_packaging = '',
    remarks = '',
    requested_by_name = 'MSM',
    noted_by_name = '',
    received_by_name = '',
    status = 'PENDING',
    field_styles = {},
  } = data;

  const printWindow = window.open('', '_blank', 'width=950,height=1100');
  if (!printWindow) {
    alert('Pop-up blocker is preventing print view. Please allow pop-ups for this site.');
    return;
  }

  const getStyleForField = (fieldName) => {
    const s = field_styles[fieldName] || {};
    const fontFamily = s.fontFamily || 'Aptos, sans-serif';
    const fontSize = s.fontSize || '14';
    const isBold = s.isBold || false;
    const isItalic = s.isItalic || false;
    const isUnderline = s.isUnderline || false;
    const isStrikethrough = s.isStrikethrough || false;
    const textColor = s.textColor || '#000000';
    const highlightColor = s.highlightColor || 'transparent';
    const textAlign = s.textAlign || 'left';

    return `
      font-family: ${fontFamily};
      font-size: ${fontSize}px;
      font-weight: ${isBold ? 'bold' : 'normal'};
      font-style: ${isItalic ? 'italic' : 'normal'};
      text-decoration: ${[isUnderline && 'underline', isStrikethrough && 'line-through'].filter(Boolean).join(' ') || 'none'};
      color: ${textColor};
      background-color: ${highlightColor};
      text-align: ${textAlign};
    `;
  };

  const statusBadgeBg = status === 'APPROVED' ? '#d1fae5' : status === 'DECLINED' ? '#fee2e2' : '#fef3c7';
  const statusBadgeText = status === 'APPROVED' ? '#065f46' : status === 'DECLINED' ? '#991b1b' : '#92400e';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>SAMPLE REQUEST FORM — ${request_code}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 10mm 12mm;
        }
        * {
          box-sizing: border-box;
        }
        body {
          font-family: 'Aptos', 'Inter', system-ui, -apple-system, sans-serif;
          color: #000000;
          background: #ffffff;
          margin: 0;
          padding: 10px;
          font-size: 12px;
          line-height: 1.35;
        }
        .form-container {
          width: 100%;
          max-width: 780px;
          margin: 0 auto;
          border: 2px solid #000000;
          background: #ffffff;
        }
        .header-table {
          width: 100%;
          border-collapse: collapse;
          border-bottom: 2px solid #000000;
        }
        .header-table td {
          border: 1px solid #000000;
          padding: 8px 12px;
          vertical-align: middle;
        }
        .title-cell {
          text-align: center;
          font-size: 22px;
          font-weight: 800;
          letter-spacing: 1px;
          width: 60%;
        }
        .meta-cell {
          width: 40%;
          font-size: 12px;
          font-weight: 700;
        }
        .section-header {
          background-color: #94a3b8;
          color: #000000;
          font-weight: 800;
          text-align: center;
          font-size: 13px;
          padding: 6px;
          border-top: 1px solid #000000;
          border-bottom: 1px solid #000000;
          letter-spacing: 0.5px;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
        }
        .data-table td, .data-table th {
          border: 1px solid #000000;
          padding: 6px 8px;
          vertical-align: top;
        }
        .label-col {
          font-weight: 700;
          background-color: #f1f5f9;
          white-space: nowrap;
        }
        .sub-num {
          font-weight: 700;
          width: 35px;
        }
        .sig-table {
          width: 100%;
          border-collapse: collapse;
          border-top: 2px solid #000000;
        }
        .sig-table td {
          border: 1px solid #000000;
          padding: 10px 12px;
          width: 33.33%;
          vertical-align: top;
          height: 75px;
        }
        .status-badge {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 4px;
          font-weight: 800;
          font-size: 11px;
          margin-top: 4px;
          background-color: ${statusBadgeBg};
          color: ${statusBadgeText};
          border: 1px solid ${statusBadgeText};
        }
        .no-print-bar {
          background-color: #1e293b;
          color: #ffffff;
          padding: 10px 16px;
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-radius: 8px;
        }
        .print-btn {
          background-color: #059669;
          color: #ffffff;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-weight: bold;
          cursor: pointer;
        }
        @media print {
          .no-print-bar { display: none !important; }
          body { padding: 0 !important; margin: 0 !important; }
          @page { size: A4 portrait; margin: 8mm 10mm; }
        }
      </style>
    </head>
    <body>
      <div class="no-print-bar">
        <div>
          <strong>📄 SAMPLE REQUEST FORM — ${request_code}</strong>
          <span style="font-size: 11px; opacity: 0.8; margin-left: 10px;">Status: ${status}</span>
        </div>
        <div>
          <button class="print-btn" onclick="window.print()">💾 Save as PDF / Print</button>
          <button class="print-btn" style="background-color: #475569; margin-left: 8px;" onclick="window.close()">✖ Close</button>
        </div>
      </div>

      <div class="form-container">
        <!-- HEADER -->
        <table class="header-table">
          <tr>
            <td rowspan="2" style="width: 20%; text-align: center;">
              <img src="/nkb-logo.png" alt="NKB Logo" style="max-height: 45px; width: auto;" onError="this.style.display='none'" />
            </td>
            <td class="title-cell" rowspan="2">SAMPLE REQUEST FORM</td>
            <td class="meta-cell">REVISION NO: ${revision_no}</td>
          </tr>
          <tr>
            <td class="meta-cell">DATE: ${request_date}</td>
          </tr>
        </table>

        <!-- PART I: CLIENT PROFILE -->
        <div class="section-header">PART I: CLIENT PROFILE</div>
        <table class="data-table">
          <tr>
            <td class="label-col" style="width: 25%;">COMPANY NAME:</td>
            <td style="width: 75%; ${getStyleForField('companyName')}">${company_name || '—'}</td>
          </tr>
          <tr>
            <td class="label-col">ADDRESS:</td>
            <td style="${getStyleForField('address')}">${address || '—'}</td>
          </tr>
          <tr>
            <td class="label-col">CONTACT PERSON:</td>
            <td style="${getStyleForField('contactPerson')}">${contact_person || '—'}</td>
          </tr>
        </table>

        <!-- PART II: PRODUCT SAMPLE REQUEST SPECIFICATION -->
        <div class="section-header">PART II: PRODUCT SAMPLE REQUEST SPECIFICATION</div>
        <table class="data-table">
          <tr>
            <td class="label-col" style="width: 32%;">1. NAME / DESCRIPTION:</td>
            <td style="${getStyleForField('productName')}">${product_name || '—'}</td>
          </tr>
          <tr>
            <td class="label-col">2. CLASSIFICATION OF PRODUCT:</td>
            <td style="${getStyleForField('productClassification')}">${product_classification || 'Cosmetics'}</td>
          </tr>
          <tr>
            <td class="label-col">3. BENCHMARK IF ANY:</td>
            <td style="${getStyleForField('benchmark')}">${benchmark || '—'}</td>
          </tr>
          <tr>
            <td class="label-col" colspan="2">4. DETAILED DESCRIPTION OF PRODUCT:</td>
          </tr>
          <tr>
            <td style="padding-left: 20px;" colspan="2">
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td class="sub-num">4.1</td><td style="width: 35%; font-weight: 600;">Specific RAW MATERIALS:</td><td style="${getStyleForField('specificRawMaterials')}">${specific_raw_materials || '—'}</td></tr>
                <tr><td class="sub-num">4.2</td><td style="font-weight: 600;">Texture:</td><td style="${getStyleForField('texture')}">${texture || '—'}</td></tr>
                <tr><td class="sub-num">4.3</td><td style="font-weight: 600;">Form:</td><td style="${getStyleForField('form')}">${form || '—'}</td></tr>
                <tr><td class="sub-num">4.4</td><td style="font-weight: 600;">Scent/Aroma Direction:</td><td style="${getStyleForField('scentAromaDirection')}">${scent_aroma_direction || '—'}</td></tr>
                <tr><td class="sub-num">4.5</td><td style="font-weight: 600;">Color Description:</td><td style="${getStyleForField('colorDescription')}">${color_description || '—'}</td></tr>
                <tr><td class="sub-num">4.6</td><td style="font-weight: 600;">Flavor:</td><td style="${getStyleForField('flavor')}">${flavor || '—'}</td></tr>
                <tr><td class="sub-num">4.7</td><td style="font-weight: 600;">Function / Claims of Products:</td><td style="${getStyleForField('functionClaims')}">${function_claims || '—'}</td></tr>
                <tr><td class="sub-num">4.8</td><td style="font-weight: 600;">Direction of Products:</td><td style="${getStyleForField('directionOfUse')}">${direction_of_use || '—'}</td></tr>
                <tr><td class="sub-num">4.9</td><td style="font-weight: 600;">Net Content:</td><td style="${getStyleForField('netContent')}">${net_content || '—'}</td></tr>
                <tr><td class="sub-num">4.10</td><td style="font-weight: 600;">Target Price:</td><td style="${getStyleForField('targetPrice')}">${target_price || '—'}</td></tr>
                <tr><td class="sub-num">4.11</td><td style="font-weight: 600;">Special Instruction / Others Specify:</td><td style="${getStyleForField('specialInstructions')}">${special_instructions || '—'}</td></tr>
                <tr><td class="sub-num">4.12</td><td style="font-weight: 600;">Quantity:</td><td style="${getStyleForField('quantity')}">${quantity || '—'}</td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="label-col" colspan="2">5. DETAILED DESCRIPTION OF PACKAGING:</td>
          </tr>
          <tr>
            <td style="padding-left: 20px;" colspan="2">
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td class="sub-num">5.1</td><td style="width: 35%; font-weight: 600;">Primary Packaging:</td><td style="${getStyleForField('primaryPackaging')}">${primary_packaging || '—'}</td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="label-col">6. REMARKS:</td>
            <td style="${getStyleForField('remarks')}">${remarks || '—'}</td>
          </tr>
        </table>

        <!-- SIGNATURES & STATUS -->
        <table class="sig-table">
          <tr>
            <td>
              <div style="font-weight: 700; margin-bottom: 25px;">Requested by:</div>
              <div style="font-weight: 800; border-bottom: 1px solid #000000; padding-bottom: 2px;">${requested_by_name || 'MSM'}</div>
              <div style="font-size: 10px; color: #475569; text-align: center; margin-top: 2px;">Requestor Signature</div>
            </td>
            <td>
              <div style="font-weight: 700; margin-bottom: 25px;">Noted by:</div>
              <div style="font-weight: 800; border-bottom: 1px solid #000000; padding-bottom: 2px;">${noted_by_name || '&nbsp;'}</div>
              <div style="font-size: 10px; color: #475569; text-align: center; margin-top: 2px;">Supervisor / Chemist</div>
            </td>
            <td>
              <div style="font-weight: 700; margin-bottom: 25px;">Received by:</div>
              <div style="font-weight: 800; border-bottom: 1px solid #000000; padding-bottom: 2px;">${received_by_name || '&nbsp;'}</div>
              <div style="font-size: 10px; color: #475569; text-align: center; margin-top: 2px;">Formulator / Receiver</div>
              <div class="status-badge">${status}</div>
            </td>
          </tr>
        </table>
      </div>

      <script>
        document.addEventListener('DOMContentLoaded', function() {
          setTimeout(function() {
            window.focus();
          }, 300);
        });
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
