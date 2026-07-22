import React, { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle2, XCircle, AlertTriangle, RefreshCw, FileText, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ElectronicSignatureModal } from '../components/ElectronicSignatureModal';

export function QualityControlPage() {
  const { user, accessToken, hasPermission } = useAuth();
  const [inspections, setInspections] = useState([]);
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [inspectionDetail, setInspectionDetail] = useState(null);
  const [paramInputs, setParamInputs] = useState({});
  const [activeTab, setActiveTab] = useState('Pending QC');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isSigModalOpen, setIsSigModalOpen] = useState(false);
  const [pendingDecision, setPendingDecision] = useState(null);

  useEffect(() => {
    fetchInspections();
  }, [activeTab]);

  const fetchInspections = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/qc/inspections?status=${encodeURIComponent(activeTab)}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setInspections(data.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchDetail = async (id) => {
    try {
      const res = await fetch(`/api/v1/qc/inspections/${id}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setInspectionDetail(data.data);
        setSelectedInspection(data.data.inspection);

        // Pre-fill result inputs
        const initialMap = {};
        (data.data.results || []).forEach(r => {
          initialMap[r.parameter_id] = {
            numeric: r.measured_numeric !== null ? String(r.measured_numeric) : '',
            text: r.measured_text || '',
            notes: r.notes || '',
          };
        });
        setParamInputs(initialMap);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveResults = async (e) => {
    e.preventDefault();
    if (!selectedInspection) return;
    setSaving(true);
    setError(null);

    const formattedResults = Object.entries(paramInputs).map(([paramId, val]) => ({
      parameterId: Number(paramId),
      measuredNumeric: val.numeric || null,
      measuredText: val.text || null,
      notes: val.notes || null,
    }));

    try {
      const res = await fetch(`/api/v1/qc/inspections/${selectedInspection.id}/results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ results: formattedResults }),
      });
      const data = await res.json();
      setSaving(false);

      if (res.ok && data.success) {
        await fetchDetail(selectedInspection.id);
        await fetchInspections();
      } else {
        setError(data.message || 'Failed to save QC results.');
      }
    } catch (err) {
      setSaving(false);
      setError(err.message || 'Connection error');
    }
  };

  const triggerDecisionModal = (decision) => {
    setPendingDecision(decision);
    setIsSigModalOpen(true);
  };

  const handleFinalDecision = async (signatureToken, reason) => {
    if (!selectedInspection || !pendingDecision) return;

    setError(null);
    try {
      const res = await fetch(`/api/v1/qc/inspections/${selectedInspection.id}/decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          decision: pendingDecision,
          reason,
          signatureToken,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSelectedInspection(null);
        setInspectionDetail(null);
        await fetchInspections();
      } else {
        setError(data.message || 'QC decision failed.');
      }
    } catch (err) {
      setError(err.message || 'Connection error');
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-purple-600" /> Quality Control & Batch Release Hub
          </h1>
          <p className="text-xs text-slate-500">
            Category-specific QC matrix inspection & Maker-Checker release sign-off.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto text-xs font-bold">
        {['Pending QC', 'Under Inspection', 'QC Passed', 'QC Failed', 'Rework Required', 'Released'].map(tab => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setSelectedInspection(null);
            }}
            className={`px-4 py-2.5 rounded-xl transition ${
              activeTab === tab
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Inspection List */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-3 shadow-sm">
          <h3 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
            {activeTab} Queue ({inspections.length})
          </h3>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400 font-semibold">Loading queue...</div>
          ) : inspections.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">No inspections in {activeTab}</div>
          ) : (
            <div className="space-y-2">
              {inspections.map(insp => (
                <button
                  key={insp.id}
                  onClick={() => fetchDetail(insp.id)}
                  className={`w-full text-left p-4 rounded-2xl border transition space-y-1 ${
                    selectedInspection?.id === insp.id
                      ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-600 text-purple-900 dark:text-purple-200 font-bold shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-purple-600">{insp.batch_number}</span>
                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 text-[10px] font-bold rounded">
                      {insp.batch_category}
                    </span>
                  </div>
                  <p className="text-xs font-bold truncate">{insp.template_name}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Inspection Form & Decision Panel */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-sm">
          {!inspectionDetail ? (
            <div className="p-12 text-center text-xs text-slate-400">
              Select a batch inspection from the queue to enter test results and sign off release.
            </div>
          ) : (
            <form onSubmit={handleSaveResults} className="space-y-6">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-purple-600 text-sm">{inspectionDetail.inspection?.batch_number}</span>
                    <span className="px-2.5 py-0.5 bg-purple-100 text-purple-800 text-xs font-bold rounded-md">
                      {inspectionDetail.inspection?.batch_category}
                    </span>
                  </div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                    {inspectionDetail.inspection?.template_name}
                  </h2>
                </div>

                {/* Release Actions */}
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <button
                    type="button"
                    onClick={() => triggerDecisionModal('QC Failed')}
                    className="flex-1 md:flex-none px-4 py-2.5 bg-rose-100 text-rose-800 hover:bg-rose-200 font-bold text-xs rounded-xl transition"
                  >
                    QC Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerDecisionModal('Rework Required')}
                    className="flex-1 md:flex-none px-4 py-2.5 bg-amber-100 text-amber-800 hover:bg-amber-200 font-bold text-xs rounded-xl transition"
                  >
                    Request Rework
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerDecisionModal('Released')}
                    className="flex-1 md:flex-none px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
                  >
                    Approve Release
                  </button>
                </div>
              </div>

              {/* Parameters Entry Table */}
              <div className="space-y-4">
                <h3 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                  Category Parameter Inspection Matrix
                </h3>

                <div className="space-y-3">
                  {(inspectionDetail.parameters || []).map(param => {
                    const val = paramInputs[param.id] || { numeric: '', text: '', notes: '' };
                    return (
                      <div
                        key={param.id}
                        className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs"
                      >
                        <div className="space-y-0.5 max-w-xs">
                          <p className="font-bold text-slate-900 dark:text-white">{param.param_name}</p>
                          <p className="text-[11px] text-slate-500">
                            Unit: <span className="font-mono">{param.unit || 'N/A'}</span> • Target Range: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{param.min_value !== null ? `${param.min_value} - ${param.max_value}` : (param.target_value_str || 'Standard')}</span>
                          </p>
                        </div>

                        <div className="flex items-center gap-3 w-full md:w-auto">
                          {param.min_value !== null ? (
                            <input
                              type="number"
                              step="0.000001"
                              value={val.numeric}
                              onChange={e => setParamInputs({ ...paramInputs, [param.id]: { ...val, numeric: e.target.value } })}
                              placeholder="Measured Value"
                              className="w-36 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-purple-600"
                            />
                          ) : (
                            <input
                              type="text"
                              value={val.text}
                              onChange={e => setParamInputs({ ...paramInputs, [param.id]: { ...val, text: e.target.value } })}
                              placeholder="Pass / Match"
                              className="w-36 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-purple-600"
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
                >
                  {saving ? 'Saving...' : 'Save Parameter Results'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Signature Modal */}
      <ElectronicSignatureModal
        isOpen={isSigModalOpen}
        onClose={() => setIsSigModalOpen(false)}
        onAuthorized={handleFinalDecision}
        actionTitle={`QC Decision: ${pendingDecision}`}
        action="QC_DECISION"
        entityType="QCInspection"
        entityId={selectedInspection?.id || 0}
      />
    </div>
  );
}
