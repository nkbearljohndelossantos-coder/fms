import React, { useEffect, useState } from 'react';
import { StatusBadge } from '../components/Badge';
import { Sparkles, Calculator, AlertTriangle, CheckCircle2, History, ArrowRight, ShieldAlert } from 'lucide-react';
import { apiFetch } from '../services/api';

export function PerfumeBrandPage({ setCurrentPage }) {
  const [activeTab, setActiveTab] = useState('convert'); // 'convert', 'brand-list', 'conversion-history'
  const [mixtures, setMixtures] = useState([]);
  const [brandFormulas, setBrandFormulas] = useState([]);
  const [history, setHistory] = useState([]);

  // Conversion Wizard State
  const [selectedMixtureId, setSelectedMixtureId] = useState('');
  const [selectedBrandVersionId, setSelectedBrandVersionId] = useState('');
  const [mode, setMode] = useState('FIXED_TARGET_WEIGHT');
  const [specifiedTargetWeight, setSpecifiedTargetWeight] = useState('100.000000');

  const [calcResult, setCalcResult] = useState(null);
  const [savedConversionId, setSavedConversionId] = useState(null);
  const [actualAdditionsInput, setActualAdditionsInput] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch('/api/v1/perfume-conversions/mixtures')
      .then(r => r.json())
      .then(d => d.success && setMixtures(d.data));

    apiFetch('/api/v1/formulas?category=Perfume Brand')
      .then(r => r.json())
      .then(d => d.success && setBrandFormulas(d.data));

    apiFetch('/api/v1/perfume-conversions')
      .then(r => r.json())
      .then(d => d.success && setHistory(d.data));
  }, []);

  const runCalculation = () => {
    if (!selectedMixtureId || !selectedBrandVersionId) {
      alert('Please select both a Source Mixture and Target Brand Formula.');
      return;
    }

    setLoading(true);
    fetch('/api/v1/perfume-conversions/calculate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('nkb_access_token')}`,
      },
      body: JSON.stringify({
        mixtureId: selectedMixtureId,
        targetBrandVersionId: selectedBrandVersionId,
        mode,
        specifiedTargetWeight,
      }),
    })
      .then(r => r.json())
      .then(d => {
        setLoading(false);
        if (d.success) {
          setCalcResult(d.data);
          const initialAdditions = {};
          d.data.additions.forEach(a => {
            initialAdditions[a.material_id] = a.required_addition;
          });
          setActualAdditionsInput(initialAdditions);
        } else {
          alert(`Calculation Error: ${d.message}`);
        }
      })
      .catch(err => {
        setLoading(false);
        alert(`Error: ${err.message}`);
      });
  };

  const saveConversionRecord = () => {
    if (!calcResult) return;
    fetch('/api/v1/perfume-conversions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('nkb_access_token')}`,
      },
      body: JSON.stringify({
        mixtureId: selectedMixtureId,
        targetBrandVersionId: selectedBrandVersionId,
        mode,
        specifiedTargetWeight,
      }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setSavedConversionId(d.conversionId);
          alert(`Conversion calculation record saved with ID ${d.conversionId} (${calcResult.is_feasible ? 'Feasible' : 'INFEASIBLE Analysis Record'})`);
        } else {
          alert(`Save Error: ${d.message}`);
        }
      });
  };

  const completeConversion = () => {
    if (!savedConversionId) {
      alert('Please save the conversion calculation record before marking as COMPLETED.');
      return;
    }

    const payloadAdditions = Object.entries(actualAdditionsInput).map(([matId, actualAdd]) => ({
      material_id: Number(matId),
      actual_addition: actualAdd,
    }));

    fetch(`/api/v1/perfume-conversions/${savedConversionId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('nkb_access_token')}`,
      },
      body: JSON.stringify({ actualAdditions: payloadAdditions }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          alert('Perfume conversion successfully COMPLETED!');
          setCalcResult(null);
          setSavedConversionId(null);
          setActiveTab('conversion-history');
          fetch('/api/v1/perfume-conversions')
            .then(r => r.json())
            .then(d => d.success && setHistory(d.data));
        } else {
          alert(`Completion Error: ${d.message}`);
        }
      });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header & Sub-Navigation Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-400" /> Perfume Brand Formulation & Conversion Engine
          </h1>
          <p className="text-xs text-slate-400">
            Brand formula management, mathematical conversion balance, Mode A/B calculation, & infeasibility warnings.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('convert')}
            className={`px-3.5 py-1.5 rounded-lg transition-colors ${activeTab === 'convert' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
          >
            Conversion Calculator
          </button>
          <button
            onClick={() => setActiveTab('conversion-history')}
            className={`px-3.5 py-1.5 rounded-lg transition-colors ${activeTab === 'conversion-history' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
          >
            Conversion History
          </button>
        </div>
      </div>

      {/* TAB 1: CONVERSION CALCULATOR */}
      {activeTab === 'convert' && (
        <div className="space-y-6">
          {/* Step 1 & Step 2 Selection Card */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
            <h3 className="font-bold text-white text-base border-b border-slate-800 pb-3">
              1. Select Source Mixture & Target Brand Formula
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              {/* Select Mixture */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">Source Recorded Mixture *</label>
                <select
                  value={selectedMixtureId}
                  onChange={e => setSelectedMixtureId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-bold"
                >
                  <option value="">-- Select Recorded Source Mixture --</option>
                  {mixtures.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.mixture_code} — {m.mixture_name} ({Number(m.actual_total_weight).toFixed(2)} {m.weight_uom})
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Target Brand Formula */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">Target Approved Brand Formula Version *</label>
                <select
                  value={selectedBrandVersionId}
                  onChange={e => setSelectedBrandVersionId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-amber-300 font-bold"
                >
                  <option value="">-- Select Target Approved Brand Formula --</option>
                  {brandFormulas.map(f =>
                    f.versions
                      .filter(v => v.version_status === 'APPROVED' || v.version_status === 'DRAFT')
                      .map(v => (
                        <option key={v.id} value={v.id}>
                          {f.code} — {f.name} (V{v.major_version}.{v.minor_version} {v.version_status})
                        </option>
                      ))
                  )}
                </select>
              </div>

              {/* Conversion Mode */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">Conversion Mode</label>
                <select
                  value={mode}
                  onChange={e => setMode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-bold"
                >
                  <option value="FIXED_TARGET_WEIGHT">Mode 1: Fixed Target Batch Weight</option>
                  <option value="AUTO_MINIMUM_FINAL_WEIGHT">Mode 2: Auto-Calculate Minimum Final Batch Weight</option>
                </select>
              </div>

              {/* Specified Target Weight (for Mode 1) */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">Target Batch Weight (kg)</label>
                <input
                  type="number"
                  step="0.0001"
                  value={specifiedTargetWeight}
                  onChange={e => setSpecifiedTargetWeight(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-emerald-300 font-mono font-bold"
                />
              </div>
            </div>

            <button
              onClick={runCalculation}
              disabled={loading}
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all"
            >
              <Calculator className="w-4 h-4" /> {loading ? 'Calculating Mathematical Balance...' : 'Calculate Brand Additions'}
            </button>
          </div>

          {/* CALCULATION RESULTS PANEL */}
          {calcResult && (
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
              {/* Feasibility / Infeasibility Banner */}
              {!calcResult.is_feasible ? (
                <div className="p-4 bg-rose-950/90 border-2 border-rose-600 rounded-xl text-rose-200 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-extrabold text-sm text-rose-300 uppercase tracking-wider">
                    <ShieldAlert className="w-5 h-5 text-rose-400" /> Blocking Warning: Conversion Infeasible by Addition Alone!
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-slate-200">{calcResult.blocking_warning_text}</pre>
                  <p className="text-[11px] text-rose-300 italic">
                    Note: You may still save this record under status 'INFEASIBLE' for history and audit analysis, but it CANNOT be marked COMPLETED.
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-emerald-950/80 border border-emerald-800 rounded-xl text-emerald-300 text-xs flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <p className="font-bold text-sm text-white">Mathematical Balance Feasible!</p>
                    <p className="text-slate-300">
                      Calculated final batch weight: <span className="font-mono font-bold text-emerald-300">{calcResult.final_target_weight} kg</span> (Min feasible weight: {calcResult.min_feasible_weight} kg).
                    </p>
                  </div>
                </div>
              )}

              {/* Additions Breakdown Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800 uppercase">
                    <tr>
                      <th className="p-3">Material Code</th>
                      <th className="p-3">Material Name</th>
                      <th className="p-3">Target %</th>
                      <th className="p-3">Existing (kg)</th>
                      <th className="p-3">Target Req (kg)</th>
                      <th className="p-3">Calculated Addition (kg)</th>
                      {calcResult.is_feasible && <th className="p-3">Actual Addition (kg)</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {calcResult.additions.map(a => (
                      <tr key={a.material_id} className={a.is_negative ? 'bg-rose-950/30' : 'hover:bg-slate-800/40'}>
                        <td className="p-3 font-mono font-bold text-amber-400">{a.material_code}</td>
                        <td className="p-3 font-medium text-white">{a.material_name}</td>
                        <td className="p-3 font-mono text-purple-300 font-bold">{Number(a.target_percentage).toFixed(4)}%</td>
                        <td className="p-3 font-mono">{Number(a.existing_amount).toFixed(4)}</td>
                        <td className="p-3 font-mono">{Number(a.target_amount).toFixed(4)}</td>
                        <td className={`p-3 font-mono font-bold ${a.is_negative ? 'text-rose-400' : 'text-emerald-300'}`}>
                          {Number(a.required_addition).toFixed(4)} {a.is_negative && '(EXCESS - CANNOT ADD)'}
                        </td>
                        {calcResult.is_feasible && (
                          <td className="p-3">
                            <input
                              type="number"
                              step="0.0001"
                              value={actualAdditionsInput[a.material_id] || ''}
                              onChange={e =>
                                setActualAdditionsInput({
                                  ...actualAdditionsInput,
                                  [a.material_id]: e.target.value,
                                })
                              }
                              className="w-28 bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono text-xs font-bold text-emerald-300"
                            />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Save / Complete Action Bar */}
              <div className="flex items-center justify-between border-t border-slate-800 pt-4">
                <button
                  onClick={saveConversionRecord}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2"
                >
                  Save Analysis Record ({calcResult.is_feasible ? 'CALCULATED' : 'INFEASIBLE'})
                </button>

                {calcResult.is_feasible && (
                  <button
                    onClick={completeConversion}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center gap-2"
                  >
                    Mark Conversion COMPLETED & Save Snapshot
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CONVERSION HISTORY */}
      {activeTab === 'conversion-history' && (
        <div className="glass-panel rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800 uppercase">
                <tr>
                  <th className="p-3.5">ID</th>
                  <th className="p-3.5">Source Mixture</th>
                  <th className="p-3.5">Target Brand Formula</th>
                  <th className="p-3.5">Mode</th>
                  <th className="p-3.5">Final Weight</th>
                  <th className="p-3.5">Feasible</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="p-8 text-center text-slate-500">No conversion history records found.</td>
                  </tr>
                ) : (
                  history.map(h => (
                    <tr key={h.id} className="hover:bg-slate-800/40">
                      <td className="p-3.5 font-mono text-slate-400">#{h.id}</td>
                      <td className="p-3.5 font-medium text-white">{h.mixture_code} — {h.mixture_name}</td>
                      <td className="p-3.5 font-semibold text-amber-300">{h.target_brand_formula_code} ({h.target_brand_formula_name})</td>
                      <td className="p-3.5 text-[11px] font-mono text-slate-400">{h.mode}</td>
                      <td className="p-3.5 font-mono font-bold text-emerald-300">{Number(h.final_target_weight).toFixed(2)} kg</td>
                      <td className="p-3.5 font-bold">
                        {h.is_feasible ? <span className="text-emerald-400">Yes</span> : <span className="text-rose-400">INFEASIBLE</span>}
                      </td>
                      <td className="p-3.5"><StatusBadge status={h.conversion_status} /></td>
                      <td className="p-3.5 font-mono text-slate-400">{new Date(h.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
