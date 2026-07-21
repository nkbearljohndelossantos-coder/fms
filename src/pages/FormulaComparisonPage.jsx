import React, { useEffect, useState } from 'react';
import Decimal from 'decimal.js';
import { GitCompare, PlusCircle, MinusCircle } from 'lucide-react';
import { apiFetch } from '../services/api';

export function FormulaComparisonPage() {
  const [formulas, setFormulas] = useState([]);
  const [versionAId, setVersionAId] = useState('');
  const [versionBId, setVersionBId] = useState('');

  const [detailA, setDetailA] = useState(null);
  const [detailB, setDetailB] = useState(null);
  const [diffResult, setDiffResult] = useState(null);

  useEffect(() => {
    apiFetch('/api/v1/formulas')
      .then(r => r.json())
      .then(d => d.success && setFormulas(d.data));
  }, []);

  const runComparison = () => {
    if (!versionAId || !versionBId) {
      alert('Please select both Formula Version A and Version B.');
      return;
    }

    Promise.all([
      apiFetch(`/api/v1/formulas/versions/${versionAId}`).then(r => r.json()),
      apiFetch(`/api/v1/formulas/versions/${versionBId}`).then(r => r.json()),
    ]).then(([resA, resB]) => {
      if (resA.success && resB.success) {
        setDetailA(resA.data);
        setDetailB(resB.data);

        const matsA = resA.data.materials;
        const matsB = resB.data.materials;

        const mapA = {};
        matsA.forEach(m => { mapA[m.material_id] = m; });

        const mapB = {};
        matsB.forEach(m => { mapB[m.material_id] = m; });

        const allMatIds = new Set([...Object.keys(mapA), ...Object.keys(mapB)]);
        const diffs = [];

        for (const matId of allMatIds) {
          const ma = mapA[matId];
          const mb = mapB[matId];

          const pctA = ma ? new Decimal(ma.percentage || '0') : new Decimal(0);
          const pctB = mb ? new Decimal(mb.percentage || '0') : new Decimal(0);
          const pctDiff = pctB.minus(pctA);

          const qtyA = ma ? new Decimal(ma.calculated_quantity || '0') : new Decimal(0);
          const qtyB = mb ? new Decimal(mb.calculated_quantity || '0') : new Decimal(0);
          const qtyDiff = qtyB.minus(qtyA);

          let status = 'UNCHANGED';
          if (!ma && mb) status = 'ADDED';
          else if (ma && !mb) status = 'REMOVED';
          else if (!pctDiff.isZero()) status = 'CHANGED';

          diffs.push({
            material_id: Number(matId),
            code: mb ? mb.material_code_snapshot : ma.material_code_snapshot,
            name: mb ? mb.material_name_snapshot : ma.material_name_snapshot,
            pctA: pctA.toFixed(2),
            pctB: pctB.toFixed(2),
            pctDiff: pctDiff.toFixed(2),
            qtyA: qtyA.toFixed(2),
            qtyB: qtyB.toFixed(2),
            qtyDiff: qtyDiff.toFixed(2),
            uom: mb ? mb.uom_snapshot : ma.uom_snapshot,
            status,
          });
        }

        setDiffResult(diffs);
      }
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <GitCompare className="w-5 h-5 text-slate-700" /> Formula Version Comparison Tool
        </h1>
        <p className="text-xs text-slate-500">
          Side-by-side version comparison showing added, removed, and percentage deltas between any two formula versions.
        </p>
      </div>

      {/* Selectors Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="font-bold text-slate-900 text-sm border-b border-slate-200 pb-2">Select Two Versions for Diff Analysis</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1.5">Baseline Version (Formula A)</label>
            <select
              value={versionAId}
              onChange={e => setVersionAId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 font-bold focus:outline-none focus:border-blue-600"
            >
              <option value="">-- Select Version A --</option>
              {formulas.map(f =>
                f.versions.map(v => (
                  <option key={v.id} value={v.id}>
                    {f.code} — {f.name} (V{v.major_version}.{v.minor_version} {v.version_status})
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1.5">Comparison Version (Formula B)</label>
            <select
              value={versionBId}
              onChange={e => setVersionBId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 font-bold focus:outline-none focus:border-blue-600"
            >
              <option value="">-- Select Version B --</option>
              {formulas.map(f =>
                f.versions.map(v => (
                  <option key={v.id} value={v.id}>
                    {f.code} — {f.name} (V{v.major_version}.{v.minor_version} {v.version_status})
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        <button
          onClick={runComparison}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2"
        >
          <GitCompare className="w-4 h-4" /> Compare Versions
        </button>
      </div>

      {/* Diff Result Table */}
      {diffResult && detailA && detailB && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex justify-between items-center border-b border-slate-200 pb-3">
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Diff Result: V{detailA.version.major_version}.{detailA.version.minor_version} vs V{detailB.version.major_version}.{detailB.version.minor_version}
              </h3>
              <p className="text-xs text-slate-500">
                Formula A: <span className="text-slate-900 font-bold">{detailA.version.formula_code}</span> | Formula B: <span className="text-slate-900 font-bold">{detailB.version.formula_code}</span>
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 uppercase">
                <tr>
                  <th className="p-3">Status</th>
                  <th className="p-3">Material Code</th>
                  <th className="p-3">Material Name</th>
                  <th className="p-3">Version A %</th>
                  <th className="p-3">Version B %</th>
                  <th className="p-3">Δ Percentage</th>
                  <th className="p-3">Δ Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {diffResult.map(d => (
                  <tr
                    key={d.material_id}
                    className={
                      d.status === 'ADDED'
                        ? 'bg-emerald-50 text-emerald-900'
                        : d.status === 'REMOVED'
                        ? 'bg-rose-50 text-rose-900 line-through'
                        : d.status === 'CHANGED'
                        ? 'bg-amber-50 text-amber-900'
                        : 'hover:bg-slate-50'
                    }
                  >
                    <td className="p-3 font-bold">
                      {d.status === 'ADDED' && <span className="text-emerald-700 flex items-center gap-1"><PlusCircle className="w-3.5 h-3.5" /> ADDED</span>}
                      {d.status === 'REMOVED' && <span className="text-rose-700 flex items-center gap-1"><MinusCircle className="w-3.5 h-3.5" /> REMOVED</span>}
                      {d.status === 'CHANGED' && <span className="text-amber-700">CHANGED</span>}
                      {d.status === 'UNCHANGED' && <span className="text-slate-400">Same</span>}
                    </td>
                    <td className="p-3 font-mono font-bold">{d.code}</td>
                    <td className="p-3 font-medium">{d.name}</td>
                    <td className="p-3 font-mono">{d.pctA}%</td>
                    <td className="p-3 font-mono">{d.pctB}%</td>
                    <td className={`p-3 font-mono font-bold ${Number(d.pctDiff) > 0 ? 'text-emerald-700' : Number(d.pctDiff) < 0 ? 'text-rose-700' : ''}`}>
                      {Number(d.pctDiff) > 0 ? `+${d.pctDiff}` : d.pctDiff}%
                    </td>
                    <td className="p-3 font-mono">{d.qtyDiff} {d.uom}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
