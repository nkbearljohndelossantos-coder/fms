import React, { useEffect, useState } from 'react';
import { Calculator, Printer } from 'lucide-react';
import { apiFetch } from '../services/api';

export function BatchCalculatorPage({ setCurrentPage }) {
  const [formulas, setFormulas] = useState([]);
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [targetBatchQty, setTargetBatchQty] = useState('500.000000');
  const [targetUom, setTargetUom] = useState('g');
  const [processLossPct, setProcessLossPct] = useState('0.500000');

  const [batchResult, setBatchResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch('/api/v1/formulas')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data) {
          setFormulas(d.data);
        }
      });
  }, []);

  const runBatchScaling = (e) => {
    e.preventDefault();
    if (!selectedVersionId) {
      alert('Please select an approved formula version.');
      return;
    }

    setLoading(true);
    apiFetch('/api/v1/batch-calculations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        versionId: selectedVersionId,
        targetBatchQty,
        targetUom,
        processLossPct,
      }),
    })
      .then(r => r.json())
      .then(d => {
        setLoading(false);
        if (d.success) {
          setBatchResult(d.data);
        } else {
          alert(`Batch Scaling Error: ${d.message}`);
        }
      })
      .catch(err => {
        setLoading(false);
        alert(`Error: ${err.message}`);
      });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Calculator className="w-5 h-5 text-slate-700" /> Isolated Batch Scaling Calculator
        </h1>
        <p className="text-xs text-slate-500">
          Scale approved formulas to target batch quantities with density-aware conversions. Never alters stored formula versions.
        </p>
      </div>

      {/* Scaling Form */}
      <form onSubmit={runBatchScaling} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
        <h3 className="font-bold text-slate-900 text-sm border-b border-slate-200 pb-2">1. Select Approved Formula & Target Batch Parameters</h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div className="md:col-span-2">
            <label className="block text-slate-700 font-semibold mb-1.5">Approved Formula Version *</label>
            <select
              value={selectedVersionId}
              onChange={e => setSelectedVersionId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 font-bold focus:outline-none focus:border-blue-600"
            >
              <option value="">-- Select Approved Formula Version --</option>
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
            <label className="block text-slate-700 font-semibold mb-1.5">Target Batch Quantity *</label>
            <input
              type="number"
              step="0.0001"
              required
              value={targetBatchQty}
              onChange={e => setTargetBatchQty(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 font-mono font-bold focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1.5">Target UOM *</label>
            <select
              value={targetUom}
              onChange={e => setTargetUom(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 font-bold focus:outline-none focus:border-blue-600"
            >
              <option value="g">g (Grams)</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2"
        >
          <Calculator className="w-4 h-4" /> {loading ? 'Scaling Batch...' : 'Calculate Scaled Batch'}
        </button>
      </form>

      {/* Batch Calculation Result */}
      {batchResult && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex justify-between items-center border-b border-slate-200 pb-3">
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Batch Sheet: {batchResult.formula_code} ({batchResult.formula_name})
              </h3>
              <p className="text-xs text-slate-500">
                Scaled Target: <span className="font-bold text-blue-700">{batchResult.target_batch_qty} {batchResult.target_uom}</span> | Scale Factor: {batchResult.scale_factor}x
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => window.print()} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-300">
                <Printer className="w-3.5 h-3.5" /> Print Batch Sheet
              </button>
            </div>
          </div>

          {/* Scaled Material Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 uppercase">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">Material Code</th>
                  <th className="p-3">Material Name</th>
                  <th className="p-3">Percentage (%)</th>
                  <th className="p-3">Scaled Batch Quantity</th>
                  <th className="p-3">UOM</th>
                  <th className="p-3">Line Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {batchResult.items.map((item, idx) => (
                  <tr key={item.material_id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-slate-500">{idx + 1}</td>
                    <td className="p-3 font-mono font-bold text-blue-700">{item.material_code_snapshot}</td>
                    <td className="p-3 font-medium text-slate-900">{item.material_name_snapshot}</td>
                    <td className="p-3 font-mono">{Number(item.percentage).toFixed(2)}%</td>
                    <td className="p-3 font-mono font-bold text-slate-900">{Number(item.scaled_qty).toFixed(2)}</td>
                    <td className="p-3 font-mono text-slate-600">{item.scaled_uom}</td>
                    <td className="p-3 font-mono text-slate-900 font-bold">{item.currency_code} {Number(item.line_cost).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-600">Total Raw Material Batch Cost:</span>
            <span className="font-mono text-base font-extrabold text-blue-700">
              {batchResult.items[0]?.currency_code || 'PHP'} {Number(batchResult.total_batch_cost).toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
