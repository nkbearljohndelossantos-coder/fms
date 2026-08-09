import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Lock, Unlock, RotateCcw, Check, Loader2 } from 'lucide-react';
import { apiFetch } from '../services/api';

const DEFAULT_LAYOUT = {
  columnWidths: {
    quantity: 15,
    rawMaterial: 40,
    supplier: 25,
    lotNo: 20
  },
  rowHeights: {
    default: 36,
    rows: {}
  }
};

export default function ExcelProductionSheetTable({
  compoundingCode = 'CP-0001',
  batchResult,
  phaseKeys = [],
  phaseMap = {},
  onLayoutChange
}) {
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  const [isLocked, setIsLocked] = useState(false);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'editing' | 'saving'

  const saveTimerRef = useRef(null);
  const lastRequestIdRef = useRef(0);
  const tableRef = useRef(null);

  // Load layout from localStorage or Server API on compoundingCode change
  useEffect(() => {
    let isSubscribed = true;
    const localKey = `nkb_sheet_layout_${compoundingCode}`;

    // 1. Instant load from localStorage
    try {
      const cached = localStorage.getItem(localKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.columnWidths && parsed?.rowHeights) {
          setLayout(parsed);
          onLayoutChange?.(parsed);
        }
      }
    } catch (_) {}

    // 2. Fetch authoritative version from server
    (async () => {
      try {
        const res = await apiFetch(`/api/v1/settings/sheet-layout/${encodeURIComponent(compoundingCode)}`);
        const data = await res.json();
        if (isSubscribed && data.success && data.layout?.columnWidths && data.layout?.rowHeights) {
          setLayout(data.layout);
          try {
            localStorage.setItem(localKey, JSON.stringify(data.layout));
          } catch (_) {}
          onLayoutChange?.(data.layout);
        }
      } catch (_) {}
    })();

    return () => {
      isSubscribed = false;
    };
  }, [compoundingCode, onLayoutChange]);

  // Debounced auto-save function (1-second debounce, last adjustment wins)
  const triggerDebouncedSave = useCallback((newLayout) => {
    try {
      localStorage.setItem(`nkb_sheet_layout_${compoundingCode}`, JSON.stringify(newLayout));
    } catch (_) {}

    setSaveStatus('editing');

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      const currentRequestId = ++lastRequestIdRef.current;

      try {
        await apiFetch(`/api/v1/settings/sheet-layout/${encodeURIComponent(compoundingCode)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ layout: newLayout })
        });
        if (currentRequestId === lastRequestIdRef.current) {
          setSaveStatus('saved');
        }
      } catch (_) {
        if (currentRequestId === lastRequestIdRef.current) {
          setSaveStatus('saved');
        }
      }
    }, 1000);
  }, [compoundingCode]);

  // Handle Layout state updates
  const updateLayout = useCallback((updater) => {
    setLayout((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      triggerDebouncedSave(next);
      onLayoutChange?.(next);
      return next;
    });
  }, [triggerDebouncedSave, onLayoutChange]);

  // Column Width Dragging Logic
  const handleColMouseDown = (colIdx, e) => {
    if (isLocked) return;
    e.preventDefault();
    e.stopPropagation();

    const tableEl = tableRef.current;
    if (!tableEl) return;
    const tableWidth = tableEl.getBoundingClientRect().width;
    const startX = e.clientX;

    const startWidths = {
      quantity: layout.columnWidths.quantity || 15,
      rawMaterial: layout.columnWidths.rawMaterial || 40,
      supplier: layout.columnWidths.supplier || 25,
      lotNo: layout.columnWidths.lotNo || 20
    };

    const onMouseMove = (moveEvt) => {
      const deltaPx = moveEvt.clientX - startX;
      const deltaPct = (deltaPx / tableWidth) * 100;

      updateLayout((prev) => {
        let q = prev.columnWidths.quantity || 15;
        let r = prev.columnWidths.rawMaterial || 40;
        let s = prev.columnWidths.supplier || 25;
        let l = prev.columnWidths.lotNo || 20;

        if (colIdx === 0) {
          // Boundary between Quantity (0) and Raw Material (1)
          const newQ = Math.min(Math.max(10, startWidths.quantity + deltaPct), 40);
          q = Math.round(newQ * 10) / 10;
          r = Math.round((100 - q - s - l) * 10) / 10;
        } else if (colIdx === 1) {
          // Boundary between Raw Material (1) and Supplier (2)
          const newR = Math.min(Math.max(20, startWidths.rawMaterial + deltaPct), 65);
          r = Math.round(newR * 10) / 10;
          s = Math.round((100 - q - r - l) * 10) / 10;
        } else if (colIdx === 2) {
          // Boundary between Supplier (2) and Lot No (3)
          const newS = Math.min(Math.max(10, startWidths.supplier + deltaPct), 50);
          s = Math.round(newS * 10) / 10;
          l = Math.round((100 - q - r - s) * 10) / 10;
        }

        return {
          ...prev,
          columnWidths: { quantity: q, rawMaterial: r, supplier: s, lotNo: l }
        };
      });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Column AutoFit Double Click
  const handleColDoubleClick = (colIdx) => {
    if (isLocked) return;
    updateLayout((prev) => {
      let q = prev.columnWidths.quantity || 15;
      let r = prev.columnWidths.rawMaterial || 40;
      let s = prev.columnWidths.supplier || 25;
      let l = prev.columnWidths.lotNo || 20;

      if (colIdx === 0) {
        q = 15; r = 40; s = 25; l = 20;
      } else if (colIdx === 1) {
        r = 45; s = 20; l = 20; q = 15;
      } else if (colIdx === 2) {
        s = 25; l = 20; r = 40; q = 15;
      }

      return {
        ...prev,
        columnWidths: { quantity: q, rawMaterial: r, supplier: s, lotNo: l }
      };
    });
  };

  // Row Height Dragging Logic
  const handleRowMouseDown = (rowId, e) => {
    if (isLocked) return;
    e.preventDefault();
    e.stopPropagation();

    const startY = e.clientY;
    const initialHeight = layout.rowHeights.rows[rowId] || layout.rowHeights.default || 36;

    const onMouseMove = (moveEvt) => {
      const deltaY = moveEvt.clientY - startY;
      const newHeight = Math.max(28, Math.min(200, Math.round(initialHeight + deltaY)));

      updateLayout((prev) => ({
        ...prev,
        rowHeights: {
          ...prev.rowHeights,
          rows: {
            ...prev.rowHeights.rows,
            [rowId]: newHeight
          }
        }
      }));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Row Height AutoFit Double Click
  const handleRowDoubleClick = (rowId) => {
    if (isLocked) return;
    updateLayout((prev) => {
      const updatedRows = { ...prev.rowHeights.rows };
      delete updatedRows[rowId];
      return {
        ...prev,
        rowHeights: {
          ...prev.rowHeights,
          rows: updatedRows
        }
      };
    });
  };

  // Reset Table Layout
  const handleResetLayout = () => {
    updateLayout(DEFAULT_LAYOUT);
  };

  // Get current height for a specific row ID
  const getRowHeight = (rowId) => {
    return layout.rowHeights.rows[rowId] || layout.rowHeights.default || 36;
  };

  return (
    <div className="space-y-2 font-sans">
      {/* Excel Table Toolbar (Hidden in Print/PDF) */}
      <div className="flex items-center justify-between gap-2 bg-slate-100 p-2.5 rounded-lg border border-slate-300 text-xs print:hidden select-none">
        <div className="flex items-center gap-3">
          {/* Lock / Unlock Toggle */}
          <button
            type="button"
            onClick={() => setIsLocked(!isLocked)}
            className={`px-3 py-1.5 rounded-md font-bold flex items-center gap-1.5 transition shadow-2xs ${
              isLocked
                ? 'bg-slate-700 text-white hover:bg-slate-800'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
            title={isLocked ? 'Click to unlock table layout editing' : 'Click to lock table layout'}
          >
            {isLocked ? (
              <>
                <Lock className="w-3.5 h-3.5" /> 🔒 Layout Locked
              </>
            ) : (
              <>
                <Unlock className="w-3.5 h-3.5" /> 🔓 Edit Layout
              </>
            )}
          </button>

          {/* Reset Layout Button */}
          {!isLocked && (
            <button
              type="button"
              onClick={handleResetLayout}
              className="px-2.5 py-1 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-200 border border-slate-300 rounded-md font-semibold flex items-center gap-1 transition"
              title="Reset column widths (15%/40%/25%/20%) and row heights to default"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              Reset Table Layout
            </button>
          )}
        </div>

        {/* Save Status Indicator */}
        <div className="flex items-center gap-2 font-mono text-xs">
          {saveStatus === 'editing' && (
            <span className="text-amber-600 font-semibold italic flex items-center gap-1">
              Editing...
            </span>
          )}
          {saveStatus === 'saving' && (
            <span className="text-blue-600 font-semibold flex items-center gap-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-emerald-700 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              <Check className="w-3.5 h-3.5 text-emerald-600" /> ✓ Layout saved
            </span>
          )}
        </div>
      </div>

      {/* Production Sheet Excel Table */}
      <div className="overflow-x-auto border border-slate-300 rounded-lg shadow-xs bg-white relative">
        <table ref={tableRef} className="w-full text-left text-xs border-collapse table-fixed">
          {/* Column Group definition for strict percentage layout */}
          <colgroup>
            <col style={{ width: `${layout.columnWidths.quantity || 15}%` }} />
            <col style={{ width: `${layout.columnWidths.rawMaterial || 40}%` }} />
            <col style={{ width: `${layout.columnWidths.supplier || 25}%` }} />
            <col style={{ width: `${layout.columnWidths.lotNo || 20}%` }} />
          </colgroup>

          <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300 select-none">
            <tr style={{ height: `${getRowHeight('header')}px` }} className="relative group">
              <th className="p-2.5 font-bold text-slate-900 border-r border-slate-300 relative">
                Quantity ({batchResult.target_uom?.toLowerCase() || 'g'})
                {/* Column 0 Resizer Handle */}
                {!isLocked && (
                  <div
                    onMouseDown={(e) => handleColMouseDown(0, e)}
                    onDoubleClick={() => handleColDoubleClick(0)}
                    title="Drag to resize Quantity column width. Double click to AutoFit."
                    className="absolute top-0 right-0 bottom-0 w-3 cursor-col-resize hover:bg-emerald-500/50 active:bg-emerald-600 z-20 flex items-center justify-center print:hidden group-hover:bg-slate-300"
                  >
                    <div className="w-0.5 h-4 bg-slate-400 group-hover:bg-emerald-700" />
                  </div>
                )}
              </th>

              <th className="p-2.5 font-bold text-slate-900 border-r border-slate-300 relative">
                Raw Material
                {/* Column 1 Resizer Handle */}
                {!isLocked && (
                  <div
                    onMouseDown={(e) => handleColMouseDown(1, e)}
                    onDoubleClick={() => handleColDoubleClick(1)}
                    title="Drag to resize Raw Material column width. Double click to AutoFit."
                    className="absolute top-0 right-0 bottom-0 w-3 cursor-col-resize hover:bg-emerald-500/50 active:bg-emerald-600 z-20 flex items-center justify-center print:hidden group-hover:bg-slate-300"
                  >
                    <div className="w-0.5 h-4 bg-slate-400 group-hover:bg-emerald-700" />
                  </div>
                )}
              </th>

              <th className="p-2.5 font-bold text-slate-900 border-r border-slate-300 relative">
                Supplier / Vendor
                {/* Column 2 Resizer Handle */}
                {!isLocked && (
                  <div
                    onMouseDown={(e) => handleColMouseDown(2, e)}
                    onDoubleClick={() => handleColDoubleClick(2)}
                    title="Drag to resize Supplier / Vendor column width. Double click to AutoFit."
                    className="absolute top-0 right-0 bottom-0 w-3 cursor-col-resize hover:bg-emerald-500/50 active:bg-emerald-600 z-20 flex items-center justify-center print:hidden group-hover:bg-slate-300"
                  >
                    <div className="w-0.5 h-4 bg-slate-400 group-hover:bg-emerald-700" />
                  </div>
                )}
              </th>

              <th className="p-2.5 text-center font-bold text-slate-900">
                Lot No.
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200">
            {phaseKeys.length === 0 ? (
              batchResult.items.map((item, idx) => {
                const rowId = `item-${idx}`;
                const rowH = getRowHeight(rowId);
                return (
                  <tr
                    key={idx}
                    style={{ height: `${rowH}px` }}
                    className="hover:bg-slate-50 transition-colors relative group"
                  >
                    <td className="p-2.5 font-mono border-r border-slate-200 relative align-middle">
                      <span className="inline-block text-slate-400 mr-2">☐</span>
                      <span className="font-bold text-slate-900">
                        {Number(item.scaled_qty).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="p-2.5 font-bold text-slate-900 uppercase border-r border-slate-200 align-middle">
                      {((item.mat_name && String(item.mat_name).trim()) ||
                        (item.material_name && String(item.material_name).trim()) ||
                        (item.name && String(item.name).trim()) ||
                        (item.material_name_snapshot && String(item.material_name_snapshot).trim()) ||
                        (item.material_code_snapshot && String(item.material_code_snapshot).trim()) ||
                        (item.material_code && String(item.material_code).trim()) ||
                        (item.mat_code && String(item.mat_code).trim()) ||
                        (item.code && String(item.code).trim()) ||
                        'RAW MATERIAL').toUpperCase()}
                    </td>
                    <td className="p-2.5 font-semibold text-slate-700 border-r border-slate-200 align-middle truncate">
                      {item.supplier || item.supplier_name || item.vendor_name || item.vendor_code || 'NKB Approved Supplier'}
                    </td>
                    <td className="p-2.5 text-center align-middle relative">
                      {/* Row Resizer Handle (Bottom Edge) */}
                      {!isLocked && (
                        <div
                          onMouseDown={(e) => handleRowMouseDown(rowId, e)}
                          onDoubleClick={() => handleRowDoubleClick(rowId)}
                          title="Drag to resize row height. Double click to AutoFit."
                          className="absolute left-0 right-0 bottom-0 h-2 cursor-row-resize hover:bg-emerald-500/50 active:bg-emerald-600 z-20 print:hidden group-hover:bg-slate-300"
                        />
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              phaseKeys.map((pName, pIdx) => {
                const phaseRowId = `phase-${pIdx}`;
                const phaseRowH = getRowHeight(phaseRowId);
                return (
                  <React.Fragment key={pIdx}>
                    {/* Phase Header Row */}
                    <tr
                      style={{ height: `${phaseRowH}px` }}
                      className="bg-slate-200 font-extrabold text-slate-900 relative group"
                    >
                      <td colSpan="4" className="p-2 px-3 align-middle relative border-b border-slate-300">
                        {(() => {
                          const match = String(pName).trim().match(/^Phase\s+([A-Za-z0-9]+)/i);
                          if (match) return `Phase ${match[1].toUpperCase()}`;
                          const lower = String(pName).toLowerCase();
                          if (lower.includes('water')) return 'Phase A';
                          if (lower.includes('surfactant') || lower.includes('oil')) return 'Phase B';
                          if (lower.includes('active')) return 'Phase C';
                          if (lower.includes('cooling')) return 'Phase D';
                          if (lower.includes('post')) return 'Phase E';
                          return pName.startsWith('Phase') ? pName : `Phase ${String.fromCharCode(65 + pIdx)}`;
                        })()}
                        {/* Row Resizer Handle */}
                        {!isLocked && (
                          <div
                            onMouseDown={(e) => handleRowMouseDown(phaseRowId, e)}
                            onDoubleClick={() => handleRowDoubleClick(phaseRowId)}
                            title="Drag to resize Phase Header row height. Double click to AutoFit."
                            className="absolute left-0 right-0 bottom-0 h-2 cursor-row-resize hover:bg-emerald-500/50 active:bg-emerald-600 z-20 print:hidden group-hover:bg-slate-400"
                          />
                        )}
                      </td>
                    </tr>

                    {/* Material Items for this Phase */}
                    {phaseMap[pName].map((item, idx) => {
                      const itemRowId = `phase-${pIdx}-item-${idx}`;
                      const itemRowH = getRowHeight(itemRowId);
                      return (
                        <tr
                          key={idx}
                          style={{ height: `${itemRowH}px` }}
                          className="hover:bg-slate-50 transition-colors relative group"
                        >
                          <td className="p-2.5 font-mono border-r border-slate-200 relative align-middle">
                            <span className="inline-block text-slate-400 mr-2">☐</span>
                            <span className="font-bold text-slate-900">
                              {Number(item.scaled_qty).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                            </span>
                          </td>
                          <td className="p-2.5 font-bold text-slate-900 uppercase border-r border-slate-200 align-middle">
                            {((item.mat_name && String(item.mat_name).trim()) ||
                              (item.material_name && String(item.material_name).trim()) ||
                              (item.name && String(item.name).trim()) ||
                              (item.material_name_snapshot && String(item.material_name_snapshot).trim()) ||
                              (item.material_code_snapshot && String(item.material_code_snapshot).trim()) ||
                              (item.material_code && String(item.material_code).trim()) ||
                              (item.mat_code && String(item.mat_code).trim()) ||
                              (item.code && String(item.code).trim()) ||
                              'RAW MATERIAL').toUpperCase()}
                          </td>
                          <td className="p-2.5 font-semibold text-slate-700 border-r border-slate-200 align-middle truncate">
                            {item.supplier || item.supplier_name || item.vendor_name || item.vendor_code || 'NKB Approved Supplier'}
                          </td>
                          <td className="p-2.5 text-center align-middle relative">
                            {/* Row Resizer Handle */}
                            {!isLocked && (
                              <div
                                onMouseDown={(e) => handleRowMouseDown(itemRowId, e)}
                                onDoubleClick={() => handleRowDoubleClick(itemRowId)}
                                title="Drag to resize row height. Double click to AutoFit."
                                className="absolute left-0 right-0 bottom-0 h-2 cursor-row-resize hover:bg-emerald-500/50 active:bg-emerald-600 z-20 print:hidden group-hover:bg-slate-300"
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })
            )}

            {/* Total Row */}
            <tr
              style={{ height: `${getRowHeight('total')}px` }}
              className="bg-slate-200 font-extrabold text-slate-900 text-xs relative group border-t-2 border-slate-300"
            >
              <td className="p-2.5 px-3 font-mono align-middle border-r border-slate-300">
                <span className="invisible mr-2">☐</span>
                <span>
                  {Number(batchResult.target_batch_qty).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{' '}
                  {batchResult.target_uom?.toLowerCase() || 'g'}
                </span>
              </td>
              <td colSpan="3" className="p-2.5 uppercase font-extrabold text-slate-900 align-middle relative">
                Total Batch Quantity
                {!isLocked && (
                  <div
                    onMouseDown={(e) => handleRowMouseDown('total', e)}
                    onDoubleClick={() => handleRowDoubleClick('total')}
                    title="Drag to resize Total row height. Double click to AutoFit."
                    className="absolute left-0 right-0 bottom-0 h-2 cursor-row-resize hover:bg-emerald-500/50 active:bg-emerald-600 z-20 print:hidden group-hover:bg-slate-400"
                  />
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
