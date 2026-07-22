import React, { useState, useEffect } from 'react';
import { Play, Pause, CheckCircle2, AlertOctagon, ArrowLeft, ArrowRight, ShieldCheck, Scale, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ElectronicSignatureModal } from '../../components/ElectronicSignatureModal';

export function OperatorCompoundingScreen({ setCurrentPage, batchId }) {
  const { user, accessToken } = useAuth();
  const [batchData, setBatchData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [actualWeightInput, setActualWeightInput] = useState('');
  const [operatorNotes, setOperatorNotes] = useState('');
  const [error, setError] = useState(null);
  const [deviationModalData, setDeviationModalData] = useState(null);
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
  const [isSigModalOpen, setIsSigModalOpen] = useState(false);

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

        // Find first incomplete step
        const steps = data.data.steps || [];
        const incompleteIdx = steps.findIndex(s => s.status !== 'Completed');
        if (incompleteIdx !== -1) {
          setCurrentStepIdx(incompleteIdx);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-12 text-center text-xs text-slate-400 font-semibold">Loading MES Compounding Station...</div>;
  if (!batchData?.batch) return <div className="p-12 text-center text-xs text-slate-400">Select a batch from dashboard.</div>;

  const { batch, phases, steps, requirements, entries } = batchData;
  const currentStep = steps[currentStepIdx] || steps[0];
  const currentReq = requirements.find(r => r.step_id === currentStep?.id) || requirements[currentStepIdx];
  const currentEntry = entries.find(e => e.step_id === currentStep?.id);

  // Fill scale simulation
  const handleSimulateScale = () => {
    if (currentReq) {
      setActualWeightInput(Number(currentReq.target_weight).toFixed(4));
    }
  };

  const handleConfirmStep = async (e) => {
    e.preventDefault();
    if (!actualWeightInput || isNaN(Number(actualWeightInput))) return;

    setError(null);

    try {
      const res = await fetch(`/api/v1/batches/${batchId}/weigh-step`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          stepId: currentStep.id,
          actualWeight: actualWeightInput,
          scaleMode: 'Simulator',
          operatorNotes,
          lockVersion: currentStep.lock_version,
        }),
      });

      const data = await res.json();

      if (res.status === 422 && data.data && !data.data.isWithinTolerance) {
        // Out of tolerance deviation flagged -> block step
        setDeviationModalData(data.data);
        fetchBatchDetail();
      } else if (res.ok && data.success) {
        setActualWeightInput('');
        setOperatorNotes('');
        await fetchBatchDetail();

        if (currentStepIdx < steps.length - 1) {
          setCurrentStepIdx(currentStepIdx + 1);
        } else {
          setIsCompletionModalOpen(true);
        }
      } else {
        setError(data.message || 'Weighing step failed.');
      }
    } catch (err) {
      setError(err.message || 'Connection error');
    }
  };

  const handleFinalSubmitQc = async (signatureToken, reason) => {
    try {
      const res = await fetch(`/api/v1/batches/${batchId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ signatureToken, remarks: reason }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCurrentPage('operator-dashboard');
      } else {
        setError(data.message || 'Submit to QC failed.');
      }
    } catch (err) {
      setError(err.message || 'Connection error');
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* Top Controls */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentPage('operator-dashboard')}
          className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>

        <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-600 text-xs font-bold rounded-full flex items-center gap-1.5">
          <Scale className="w-3.5 h-3.5" /> Scale Adapter: SIMULATOR MODE ACTIVE
        </span>
      </div>

      {/* MES Header Bar */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 border border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-blue-400 text-sm">{batch.batch_number}</span>
            <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 text-xs font-bold rounded-md">In Progress</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black">{batch.formula_name}</h1>
          <p className="text-xs text-slate-400">
            Operator: <span className="text-white font-bold">{user?.firstName} {user?.lastName}</span> • Machine: <span className="text-white font-bold">{batch.machine_name || 'Mixer MX-01'}</span>
          </p>
        </div>

        {/* Circular Overall Progress */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[11px] text-slate-400 font-semibold uppercase">Overall Progress</p>
            <p className="text-2xl font-black text-blue-400">{Number(batch.overall_progress_percent).toFixed(0)}%</p>
          </div>
          <div className="w-14 h-14 rounded-full border-4 border-slate-800 border-t-blue-500 flex items-center justify-center font-black text-xs">
            {Number(batch.overall_progress_percent).toFixed(0)}%
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Main Single Step Execution Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Phase Tracker & Step Selection */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-4 shadow-sm">
          <h3 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">Manufacturing Phases</h3>

          <div className="space-y-2">
            {steps.map((st, idx) => (
              <button
                key={st.id}
                onClick={() => {
                  setCurrentStepIdx(idx);
                  setActualWeightInput('');
                }}
                className={`w-full text-left p-3.5 rounded-2xl border transition flex items-center justify-between ${
                  idx === currentStepIdx
                    ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-600 text-blue-900 dark:text-blue-200 font-bold shadow-xs'
                    : st.status === 'Completed'
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-slate-700 dark:text-slate-300'
                    : st.status === 'Deviation'
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 text-amber-900 dark:text-amber-300 font-semibold'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-bold font-mono">Step {st.step_number}</span>
                  <span className="truncate max-w-[140px]">{st.instructions || `Weigh Material #${st.step_number}`}</span>
                </div>
                {st.status === 'Completed' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : st.status === 'Deviation' ? (
                  <AlertOctagon className="w-4 h-4 text-amber-600" />
                ) : null}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Active Single-Material Weighing Execution Card */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-sm">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-blue-600 font-bold font-mono uppercase">Step #{currentStep?.step_number} Execution</span>
              <h2 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                {currentReq?.material_name || currentStep?.instructions}
              </h2>
            </div>
            <span className="font-mono text-xs font-bold text-slate-500">{currentReq?.material_code}</span>
          </div>

          {currentReq && (
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                <p className="text-[11px] text-slate-500 font-semibold uppercase">Target Weight</p>
                <p className="text-2xl font-black text-blue-600 font-mono mt-0.5">
                  {Number(currentReq.target_weight).toFixed(4)} <span className="text-xs">kg</span>
                </p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                <p className="text-[11px] text-slate-500 font-semibold uppercase">Tolerance Range (±{Number(currentReq.tolerance_percent).toFixed(1)}%)</p>
                <p className="text-sm font-bold font-mono text-slate-700 dark:text-slate-300 mt-1">
                  {Number(currentReq.min_weight).toFixed(4)} - {Number(currentReq.max_weight).toFixed(4)} kg
                </p>
              </div>
            </div>
          )}

          {/* Weighing Entry Form */}
          <form onSubmit={handleConfirmStep} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-slate-700 dark:text-slate-300 font-bold text-xs">
                  Actual Scale Reading Weight (kg)
                </label>
                <button
                  type="button"
                  onClick={handleSimulateScale}
                  className="text-xs text-blue-600 font-bold flex items-center gap-1 hover:underline"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Simulate Scale Reading
                </button>
              </div>
              <input
                type="number"
                step="0.000001"
                required
                value={actualWeightInput}
                onChange={e => setActualWeightInput(e.target.value)}
                placeholder="0.000000"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl px-5 py-4 text-xl font-mono font-black text-slate-900 dark:text-white focus:outline-none focus:border-blue-600 transition"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1">
                Operator Notes / Observations
              </label>
              <input
                type="text"
                value={operatorNotes}
                onChange={e => setOperatorNotes(e.target.value)}
                placeholder="e.g. Visual dissolution clear, no clumping"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-600 transition"
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                disabled={currentStepIdx === 0}
                onClick={() => setCurrentStepIdx(currentStepIdx - 1)}
                className="px-4 py-3 rounded-xl border border-slate-300 text-slate-700 dark:text-slate-300 font-semibold text-xs disabled:opacity-50 flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Previous Step
              </button>

              <button
                type="submit"
                className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-2 active:scale-95"
              >
                <span>Confirm Material & Weighing</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Out of Tolerance Deviation Modal */}
      {deviationModalData && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-amber-300 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertOctagon className="w-7 h-7" />
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Out of Tolerance Step Block</h3>
                <p className="text-xs text-amber-700 dark:text-amber-400 font-mono">{deviationModalData.devCode}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Weighed value has a <span className="font-bold text-amber-600">{deviationModalData.variancePercent}% variance</span>, exceeding allowable tolerance. Step is BLOCKED until a Production Supervisor reviews the deviation.
            </p>

            <button
              onClick={() => setDeviationModalData(null)}
              className="w-full py-3 bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs"
            >
              Acknowledge & Return to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Final Completion Modal */}
      {isCompletionModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-emerald-600">
              <CheckCircle2 className="w-7 h-7" />
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">All Steps Completed</h3>
                <p className="text-xs text-slate-500 font-mono">{batch.batch_number}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              All material weighing steps have been confirmed. Proceed to submit batch to Quality Control for inspection.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setIsCompletionModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold"
              >
                Review Steps
              </button>
              <button
                onClick={() => {
                  setIsCompletionModalOpen(false);
                  setIsSigModalOpen(true);
                }}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs"
              >
                Submit Batch to QC
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Signature Modal */}
      <ElectronicSignatureModal
        isOpen={isSigModalOpen}
        onClose={() => setIsSigModalOpen(false)}
        onAuthorized={handleFinalSubmitQc}
        actionTitle={`Submit Batch ${batch.batch_number} to QC`}
        action="COMPLETE_BATCH"
        entityType="ProductionBatch"
        entityId={batch.id}
      />
    </div>
  );
}
