import React, { useEffect, useState, useRef } from 'react';
import { Calculator, Printer, DollarSign, Search, ChevronDown, Check, X, Play } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/api';
import { printProductionSheet } from '../utils/printProductionSheet';

export function BatchCalculatorPage({ setCurrentPage, setSelectedBatchId }) {
  const { user } = useAuth();
  const [formulas, setFormulas] = useState([]);
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [targetBatchQty, setTargetBatchQty] = useState('500.00');
  const [targetUom, setTargetUom] = useState('g');
  const [processLossPct, setProcessLossPct] = useState('0.00');

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);

  const [batchResult, setBatchResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [autoSendEnabled, setAutoSendEnabled] = useState(false);
  const [togglingSetting, setTogglingSetting] = useState(false);

  useEffect(() => {
    apiFetch('/api/v1/formulas')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data) {
          setFormulas(d.data);
        }
      });
    fetchSettings();
  }, []);

  const fetchSettings = () => {
    apiFetch('/api/v1/settings')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data) {
          setAutoSendEnabled(d.data.auto_send_to_operator_mes === 'true' || d.data.auto_send_to_operator_mes === '1');
        }
      })
      .catch(() => {});
  };

  const handleToggleAutoSend = (newVal) => {
    setTogglingSetting(true);
    apiFetch('/api/v1/settings', {
      method: 'PUT',
      body: JSON.stringify({
        settings: { auto_send_to_operator_mes: newVal ? 'true' : 'false' }
      })
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setAutoSendEnabled(newVal);
        } else {
          alert(d.message || 'Failed to update setting.');
        }
      })
      .catch(e => alert(e.message || 'Error updating setting.'))
      .finally(() => setTogglingSetting(false));
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter approved options for searchable selection dropdown
  const approvedOptions = [];
  formulas.forEach(f => {
    (f.versions || []).forEach(v => {
      if ((v.version_status || '').toUpperCase() === 'APPROVED') {
        approvedOptions.push({
          id: v.id,
          formulaCode: f.code,
          formulaName: f.name,
          versionStr: `V${v.major_version}.${v.minor_version}`,
          displayText: `${f.name} (V${v.major_version}.${v.minor_version} APPROVED)`,
        });
      }
    });
  });

  const filteredOptions = approvedOptions.filter(opt => {
    const q = searchQuery.toLowerCase();
    return (
      opt.formulaCode.toLowerCase().includes(q) ||
      opt.formulaName.toLowerCase().includes(q) ||
      opt.versionStr.toLowerCase().includes(q) ||
      opt.displayText.toLowerCase().includes(q)
    );
  });

  const selectedOption = approvedOptions.find(opt => String(opt.id) === String(selectedVersionId));

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

  const handlePrintPdf = () => {
    if (!batchResult) return;
    printProductionSheet({
      version: {
        compounding_code: batchResult.compounding_code,
        formula_code: batchResult.formula_code,
        formula_name: batchResult.formula_name,
        major_version: batchResult.version?.split('.')[0] || 1,
        minor_version: batchResult.version?.split('.')[1] || 0,
        target_batch_size: batchResult.target_batch_qty,
        overrideBatchSize: batchResult.target_batch_qty,
        target_batch_uom: batchResult.target_uom || 'g',
        version_status: 'APPROVED',
      },
      formula: {
        code: batchResult.formula_code,
        name: batchResult.formula_name,
      },
      materials: batchResult.items || [],
      categoryDetails: batchResult.categoryDetails,
      user,
    });
  };

  // Group items by phase for Production Sheet layout
  const phaseMap = {};
  if (batchResult && Array.isArray(batchResult.items)) {
    batchResult.items.forEach(item => {
      const pName = item.phase_name || 'Phase 1';
      if (!phaseMap[pName]) phaseMap[pName] = [];
      phaseMap[pName].push(item);
    });
  }

  const phaseKeys = Object.keys(phaseMap);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Calculator className="w-5 h-5 text-blue-700" /> Production Batch Sheet Calculator
        </h1>
        <p className="text-xs text-slate-500">
          Scale approved formulas to target batch quantities matching the official Production Sheet standard.
        </p>
      </div>

      {/* Admin Dispatch Control Banner for Auto-Send to Operator Toggle */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-xs uppercase tracking-wider text-blue-400">Admin Dispatch Control</span>
            <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full ${autoSendEnabled ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-slate-900'}`}>
              {autoSendEnabled ? '🟢 ON: Auto-Send Enabled' : '🔴 OFF: Print Only (No Auto-Send)'}
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            {autoSendEnabled
              ? 'AUTOMATIC: Pag nag-calc / generate, AWTOMATIKONG MABABATO sa Operator Station ang active batch.'
              : 'PRINT ONLY: Pag nag-calc / generate, MAG-PRIPRINT AT MAG-LO-LOG LAMANG at HINDI MABABATO sa Operator Station.'}
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-800 p-1.5 rounded-xl border border-slate-700">
          <button
            type="button"
            onClick={() => handleToggleAutoSend(false)}
            disabled={togglingSetting}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              !autoSendEnabled ? 'bg-amber-500 text-slate-900 shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            OFF (Print Only)
          </button>
          <button
            type="button"
            onClick={() => handleToggleAutoSend(true)}
            disabled={togglingSetting}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              autoSendEnabled ? 'bg-emerald-500 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            ON (Auto-Send)
          </button>
        </div>
      </div>

      {/* Scaling Form */}
      <form onSubmit={runBatchScaling} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
        <h3 className="font-bold text-slate-900 text-sm border-b border-slate-200 pb-2">Select Approved Formula & Target Batch Parameters</h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div className="md:col-span-2 relative" ref={dropdownRef}>
            <label className="block text-slate-700 font-semibold mb-1.5">Approved Formula Version *</label>
            
            {/* Dropdown Control Button */}
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-left text-slate-900 font-bold focus:outline-none focus:border-blue-600 flex justify-between items-center shadow-xs"
            >
              <span className={selectedOption ? 'text-slate-900 font-extrabold' : 'text-slate-400 font-medium'}>
                {selectedOption ? selectedOption.displayText : '-- Select Approved Formula Version --'}
              </span>
              <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Interactive Search Panel */}
            {dropdownOpen && (
              <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-slate-300 rounded-xl shadow-xl overflow-hidden p-2 space-y-2">
                {/* Search Box */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="🔍 Search formula code, name, or version..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filtered Options List */}
                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-100">
                  {filteredOptions.length === 0 ? (
                    <div className="p-3.5 text-center text-xs text-slate-400 font-medium">
                      No matching approved formulas found
                    </div>
                  ) : (
                    filteredOptions.map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setSelectedVersionId(opt.id);
                          setDropdownOpen(false);
                          setSearchQuery('');
                        }}
                        className={`w-full text-left p-2.5 text-xs flex justify-between items-center transition ${
                          String(selectedVersionId) === String(opt.id)
                            ? 'bg-blue-50 text-blue-900 font-bold'
                            : 'hover:bg-slate-50 text-slate-800 font-medium'
                        }`}
                      >
                        <div>
                          <span className="font-semibold text-slate-900">{opt.formulaName}</span>
                          <span className="ml-2 px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                            {opt.versionStr} APPROVED
                          </span>
                        </div>
                        {String(selectedVersionId) === String(opt.id) && (
                          <Check className="w-4 h-4 text-blue-600 shrink-0 ml-2" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1.5">Target Batch Quantity *</label>
            <input
              type="number"
              step="0.01"
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
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 transition"
        >
          <Calculator className="w-4 h-4" /> {loading ? 'Scaling Batch...' : 'Generate Batch Sheet'}
        </button>
      </form>

      {/* Scaled Batch Costing Breakdown & Document Preview */}
      {batchResult && (
        <div className="space-y-6">
          {/* Scaled Batch Financial & Costing Breakdown Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" /> Scaled Batch Financial & Costing Summary
                </h3>
                <p className="text-xs text-slate-500">
                  Costing calculation for <span className="font-bold text-blue-700">{Number(batchResult.target_batch_qty).toLocaleString('en-US')} {batchResult.target_uom}</span> target batch
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-xl text-right">
                  <span className="text-[10px] text-emerald-800 uppercase font-bold block">Total Batch Cost</span>
                  <span className="font-mono text-base font-extrabold text-emerald-900">
                    PHP {Number(batchResult.total_batch_cost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Financial KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 block font-medium">Batch Weight</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {Number(batchResult.target_batch_qty).toLocaleString('en-US')} {batchResult.target_uom}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 block font-medium">Unit Cost (PHP / Gram)</span>
                <span className="font-mono font-bold text-blue-700 text-sm">
                  PHP {(Number(batchResult.total_batch_cost) / (Number(batchResult.target_batch_qty) || 1)).toFixed(4)} / g
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 block font-medium">Unit Cost (PHP / Kilogram)</span>
                <span className="font-mono font-bold text-indigo-700 text-sm">
                  PHP {((Number(batchResult.total_batch_cost) / (Number(batchResult.target_batch_qty) || 1)) * 1000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / kg
                </span>
              </div>
            </div>

            {/* Material Line Costing Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 uppercase">
                  <tr>
                    <th className="p-2.5">Phase</th>
                    <th className="p-2.5">Raw Material</th>
                    <th className="p-2.5 text-right">Unit Cost (PHP/g)</th>
                    <th className="p-2.5">Percentage (%)</th>
                    <th className="p-2.5 text-right">Scaled Weight (g)</th>
                    <th className="p-2.5 text-right">Scaled Line Cost (PHP)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {batchResult.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2.5 font-semibold text-slate-800">{item.phase_name || 'Phase A'}</td>
                      <td className="p-2.5 font-medium text-slate-900">{item.material_name_snapshot}</td>
                      <td className="p-2.5 text-right font-mono text-slate-600">PHP {Number(item.unit_cost_g || 0).toFixed(1)}</td>
                      <td className="p-2.5 font-mono font-bold text-indigo-700">{Number(item.percentage || 0).toFixed(2)}%</td>
                      <td className="p-2.5 text-right font-mono text-emerald-800 font-bold">{Number(item.scaled_qty).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} g</td>
                      <td className="p-2.5 text-right font-mono text-blue-800 font-bold">PHP {Number(item.line_cost).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                    </tr>
                  ))}
                  {/* Total Costing Summary Row */}
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900 text-xs">
                    <td colSpan="3" className="p-2.5">Total Scaled Batch Costing Summary</td>
                    <td className="p-2.5 font-mono text-indigo-700">
                      {(Math.round((batchResult.items.reduce((acc, i) => acc + (parseFloat(i.percentage) || 0), 0) + Number.EPSILON) * 100) / 100).toFixed(2)}%
                    </td>
                    <td className="p-2.5 text-right font-mono text-emerald-900 font-extrabold">
                      {Number(batchResult.target_batch_qty).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} g
                    </td>
                    <td className="p-2.5 text-right font-mono text-blue-900 font-extrabold text-sm">
                      PHP {Number(batchResult.total_batch_cost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Production Sheet Document Preview Box */}
          <div className="bg-white p-8 rounded-2xl border border-slate-300 shadow-md space-y-6 text-slate-900">
          {/* Header Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 uppercase">
                Official Production Sheet Standard
              </span>
              <h2 className="text-base font-extrabold text-slate-900 mt-1">{batchResult.formula_code} — {batchResult.formula_name}</h2>
            </div>
            <div className="flex items-center gap-2">
              {batchResult.production_batch_id && (
                <button
                  type="button"
                  onClick={() => {
                    if (typeof setSelectedBatchId === 'function') {
                      setSelectedBatchId(batchResult.production_batch_id);
                    }
                    if (typeof setCurrentPage === 'function') {
                      setCurrentPage('operator-compounding-screen');
                    }
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs transition"
                  title="Open batch directly in Operator Compounding Station"
                >
                  <Play className="w-4 h-4" /> Start Compounding Execution
                </button>
              )}
              <button
                onClick={handlePrintPdf}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs transition"
              >
                <Printer className="w-4 h-4" /> Save / Export PDF
              </button>
            </div>
          </div>

          {/* PDF Document Box */}
          <div className="border border-slate-300 p-8 rounded-xl bg-white space-y-6 font-sans">
            {/* Document Header */}
            <div className="text-center space-y-1">
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900">NKB Manufacturing Corporation</h1>
              <h2 className="text-sm font-extrabold tracking-widest text-slate-900 uppercase">PRODUCTION SHEET</h2>
            </div>

            {/* Meta Section */}
            <div className="flex justify-between items-start text-xs border-b border-slate-200 pb-4">
              <div className="space-y-1">
                <div>
                  <span className="font-bold text-slate-900">Compounding Number:</span>{' '}
                  <span className="font-mono font-extrabold text-blue-700">
                    {batchResult.compounding_code || (batchResult.formula_code ? `CP-${batchResult.formula_code.replace(/[^0-9]/g, '')}` : 'CP-0001')}
                  </span>
                </div>
                <div><span className="font-bold text-slate-900">Target Quantity:</span> <span className="font-mono font-bold text-blue-700">{Number(batchResult.target_batch_qty).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {batchResult.target_uom?.toUpperCase() || 'G'}</span></div>
                <div><span className="font-bold text-slate-900">Formulation:</span> {batchResult.formula_name?.toUpperCase()}</div>
                <div><span className="font-bold text-slate-900">Version:</span> V{batchResult.version || '1.0'}</div>
              </div>
              <div className="space-y-1 text-right">
                <div><span className="font-bold text-slate-900">Date:</span> {new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</div>
                <div><span className="font-bold text-slate-900">Prepared By:</span> {user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : (user?.username || 'Norvin Bella')}</div>
              </div>
            </div>

            {/* Production Sheet Table */}
            <div className="overflow-x-auto border border-slate-300 rounded">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                  <tr>
                    <th className="p-2.5 w-1/4">Quantity ({batchResult.target_uom?.toLowerCase() || 'g'})</th>
                    <th className="p-2.5">Raw Material</th>
                    <th className="p-2.5 text-center w-1/4 border-l border-slate-300">Lot No.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {phaseKeys.length === 0 ? (
                    batchResult.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2.5 font-mono">
                          <span className="inline-block text-slate-400 mr-2">☐</span>
                          <span className="font-bold text-slate-900">{Number(item.scaled_qty).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </td>
                        <td className="p-2.5 font-bold text-slate-900 uppercase">{item.material_name_snapshot}</td>
                        <td className="p-2.5 text-center border-l border-slate-200"></td>
                      </tr>
                    ))
                  ) : (
                    phaseKeys.map((pName, pIdx) => (
                      <React.Fragment key={pIdx}>
                        <tr className="bg-slate-200 font-extrabold text-slate-900">
                          <td colSpan="3" className="p-2 px-3">
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
                          </td>
                        </tr>
                        {phaseMap[pName].map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2.5 font-mono">
                              <span className="inline-block text-slate-400 mr-2">☐</span>
                              <span className="font-bold text-slate-900">{Number(item.scaled_qty).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
                            </td>
                            <td className="p-2.5 font-bold text-slate-900 uppercase">{item.material_name_snapshot}</td>
                            <td className="p-2.5 text-center border-l border-slate-200"></td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))
                  )}

                  {/* Total Row */}
                  <tr className="bg-slate-200 font-extrabold text-slate-900 text-xs">
                    <td className="p-2.5 px-3 font-mono">
                      <span className="invisible mr-2">☐</span>
                      <span>{Number(batchResult.target_batch_qty).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} {batchResult.target_uom?.toLowerCase() || 'g'}</span>
                    </td>
                    <td colSpan="2" className="p-2.5 uppercase font-extrabold text-slate-900">Total Batch Quantity</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Quality Parameters & Specifications Table */}
            <div className="space-y-1.5 pt-1">
              <div className="font-extrabold text-slate-900 text-xs tracking-wider uppercase">QUALITY PARAMETERS & SPECIFICATIONS:</div>
              <div className="overflow-x-auto border border-slate-300 rounded">
                <table className="w-full text-left text-xs">
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="p-2 bg-slate-50 font-bold text-slate-900 w-1/4">Target pH Range:</td>
                      <td className="p-2 font-mono font-semibold text-slate-900 w-1/4">{batchResult.categoryDetails?.target_ph || ''}</td>
                      <td className="p-2 bg-slate-50 font-bold text-slate-900 w-1/4">Actual pH:</td>
                      <td className="p-2 font-mono font-semibold text-slate-900 w-1/4">{batchResult.categoryDetails?.actual_ph || '[ ________ ]'}</td>
                    </tr>
                    <tr>
                      <td className="p-2 bg-slate-50 font-bold text-slate-900 w-1/4">Viscosity (cP):</td>
                      <td className="p-2 font-mono font-semibold text-slate-900 w-1/4">{batchResult.categoryDetails?.viscosity_cp || ''}</td>
                      <td className="p-2 bg-slate-50 font-bold text-slate-900 w-1/4">Appearance:</td>
                      <td className="p-2 text-slate-900 w-1/4">{batchResult.categoryDetails?.appearance || ''}</td>
                    </tr>
                    <tr>
                      <td className="p-2 bg-slate-50 font-bold text-slate-900">Remarks:</td>
                      <td className="p-2 text-slate-900" colSpan="3">{batchResult.categoryDetails?.remarks || ''}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Notes Section */}
            <div className="text-xs space-y-1 pt-2">
              <div className="font-extrabold text-slate-900 uppercase">NOTES / INSTRUCTIONS:</div>
              <div className="text-slate-700 flex items-center gap-1.5"><span className="text-[10px]">◆</span> Follow the step order as indicated</div>
              <div className="text-slate-700 flex items-center gap-1.5"><span className="text-[10px]">◆</span> Verify all quantities before processing</div>
              <div className="text-slate-700 flex items-center gap-1.5"><span className="text-[10px]">◆</span> Record actual quantities used</div>
            </div>

            {/* Signatures Section */}
            <div className="grid grid-cols-3 gap-6 pt-8 text-xs text-center">
              <div>
                <div className="text-left text-slate-600 mb-6">Prepared by:</div>
                <div className="font-bold text-slate-900 text-xs mb-1">{user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : (user?.username || 'Norvin Bella')}</div>
                <div className="border-b-2 border-slate-900 w-full mb-1"></div>
                <div className="text-[11px] text-slate-500">Name & Signature</div>
              </div>
              <div>
                <div className="text-left text-slate-600 mb-6">Checked by:</div>
                <div className="font-bold text-slate-900 text-xs mb-1">&nbsp;</div>
                <div className="border-b-2 border-slate-900 w-full mb-1"></div>
                <div className="text-[11px] text-slate-500">QC Name & Signature</div>
              </div>
              <div>
                <div className="text-left text-slate-600 mb-6">Completed by:</div>
                <div className="font-bold text-slate-900 text-xs mb-1">&nbsp;</div>
                <div className="border-b-2 border-slate-900 w-full mb-1"></div>
                <div className="text-[11px] text-slate-500">Production Team & Date</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
