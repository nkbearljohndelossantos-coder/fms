import React, { useEffect, useState } from 'react';
import { FileSpreadsheet, FileText, Download, Printer } from 'lucide-react';
import { apiFetch } from '../services/api';

export function ReportsPage() {
  const [formulas, setFormulas] = useState([]);
  const [selectedVersionId, setSelectedVersionId] = useState('');

  useEffect(() => {
    apiFetch('/api/v1/formulas')
      .then(r => r.json())
      .then(d => d.success && setFormulas(d.data));
  }, []);

  const downloadExcelMaster = () => {
    window.open('/api/v1/reports/formulas/excel', '_blank');
  };

  const downloadPdfDetail = () => {
    if (!selectedVersionId) {
      alert('Please select a formula version to export PDF.');
      return;
    }
    window.open(`/api/v1/reports/formulas/${selectedVersionId}/pdf`, '_blank');
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-slate-700" /> Reports & Export Hub
        </h1>
        <p className="text-xs text-slate-500">
          Professional PDF and Excel reports for Formula Detail Sheets, Master Lists, Costing Snapshots, and Conversion Audits.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Excel Master Export Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-100 text-slate-700 rounded-xl">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Formula Master List (Excel)</h3>
              <p className="text-xs text-slate-500">Spreadsheet export containing all active master formulas, categories, and status.</p>
            </div>
          </div>
          <button
            onClick={downloadExcelMaster}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" /> Download Master List (.xlsx)
          </button>
        </div>

        {/* PDF Detail Sheet Export Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-100 text-slate-700 rounded-xl">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Formula Detail Sheet (PDF)</h3>
              <p className="text-xs text-slate-500">Formatted printable PDF with composition breakdown, phases, and instructions.</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Select Formula Version</label>
            <select
              value={selectedVersionId}
              onChange={e => setSelectedVersionId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-blue-600"
            >
              <option value="">-- Select Formula Version --</option>
              {formulas.map(f =>
                f.versions.map(v => (
                  <option key={v.id} value={v.id}>
                    {f.code} — {f.name} (V{v.major_version}.{v.minor_version} {v.version_status})
                  </option>
                ))
              )}
            </select>
          </div>

          <button
            onClick={downloadPdfDetail}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" /> Export / Print PDF Detail Sheet
          </button>
        </div>
      </div>
    </div>
  );
}
