import React, { useState, useEffect } from 'react';
import { Play, ArrowLeft, ShieldAlert, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ElectronicSignatureModal } from '../../components/ElectronicSignatureModal';

export function OperatorFormulaViewPage({ setCurrentPage, batchId, setSelectedBatchId }) {
  const { accessToken } = useAuth();
  const [batchData, setBatchData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSigModalOpen, setIsSigModalOpen] = useState(false);
  const [startError, setStartError] = useState(null);

  useEffect(() => {
    if (batchId) fetchBatchDetail();
  }, [batchId]);

  const fetchBatchDetail = async () => {
    try {
      const res = await fetch(`/api/v1/batches/${batchId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBatchData(data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleStartCompounding = async (signatureToken, reason) => {
    setStartError(null);
    try {
      const res = await fetch(`/api/v1/batches/${batchId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ signatureToken, machineId: batchData?.batch?.assigned_machine_id }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCurrentPage('operator-compounding-screen');
      } else {
        setStartError(data.message || 'Failed to start compounding session.');
      }
    } catch (err) {
      setStartError(err.message || 'Connection error');
    }
  };

  if (loading) return <div className="p-12 text-center text-xs text-slate-400 font-semibold">Loading formula specs...</div>;
  if (!batchData?.batch) return <div className="p-12 text-center text-xs text-slate-400">Select a batch from dashboard.</div>;

  const { batch, phases, steps, requirements } = batchData;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <button
        onClick={() => setCurrentPage('operator-dashboard')}
        className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </button>

      {/* Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-md font-mono">{batch.batch_number}</span>
            <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-md">Approved Formula</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">{batch.formula_name} ({batch.formula_code})</h1>
          <p className="text-xs text-slate-500">
            Category: <span className="font-bold text-slate-700 dark:text-slate-300">{batch.category}</span> • Target Batch Size: <span className="font-bold text-blue-600">{Number(batch.target_batch_size).toFixed(2)} kg</span> • Machine: <span className="font-bold text-slate-700 dark:text-slate-300">{batch.machine_name || 'Mixer MX-01'}</span>
          </p>
        </div>

        <button
          onClick={() => setIsSigModalOpen(true)}
          className="w-full md:w-auto px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-2xl shadow-lg transition flex items-center justify-center gap-2 active:scale-95"
        >
          <Play className="w-5 h-5 fill-current" />
          <span>Start Compounding Session</span>
        </button>
      </div>

      {startError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-semibold">
          {startError}
        </div>
      )}

      {/* Safety & Hazards Banner */}
      <div className="p-5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-start gap-4 text-xs text-amber-900 dark:text-amber-300">
        <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold">Required Safety PPE & Handling Protocols:</p>
          <p className="text-[11px] leading-relaxed">
            Wear Safety Goggles, Nitrile Gloves, and Anti-Static Dust Mask. Check emergency stop button on compounding vessel prior to charging materials.
          </p>
        </div>
      </div>

      {/* Material Requirements Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">Required Batch Materials & Target Weights</h3>
          <span className="text-xs text-slate-500 font-mono">Snapshot Hash: {batch.snapshot_hash?.substring(0, 12)}...</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold uppercase text-[11px] border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-3.5 px-6">Step</th>
                <th className="py-3.5 px-6">Material Code</th>
                <th className="py-3.5 px-6">Material Name</th>
                <th className="py-3.5 px-6 text-right">Composition %</th>
                <th className="py-3.5 px-6 text-right">Target Weight (kg)</th>
                <th className="py-3.5 px-6 text-right">Tolerance Range</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {requirements.map((req, idx) => (
                <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="py-3.5 px-6 font-bold text-slate-400">{idx + 1}</td>
                  <td className="py-3.5 px-6 font-mono font-bold text-blue-600">{req.material_code}</td>
                  <td className="py-3.5 px-6 font-bold text-slate-900 dark:text-white">{req.material_name}</td>
                  <td className="py-3.5 px-6 text-right font-mono">{Number(req.percentage).toFixed(4)} %</td>
                  <td className="py-3.5 px-6 text-right font-mono font-bold text-blue-600">{Number(req.target_weight).toFixed(4)} kg</td>
                  <td className="py-3.5 px-6 text-right font-mono text-slate-500">
                    {Number(req.min_weight).toFixed(4)} - {Number(req.max_weight).toFixed(4)} kg
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Signature Modal */}
      <ElectronicSignatureModal
        isOpen={isSigModalOpen}
        onClose={() => setIsSigModalOpen(false)}
        onAuthorized={handleStartCompounding}
        actionTitle={`Start Batch ${batch.batch_number}`}
        action="START_BATCH"
        entityType="ProductionBatch"
        entityId={batch.id}
      />
    </div>
  );
}
