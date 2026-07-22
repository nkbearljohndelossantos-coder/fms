import React, { useState, useEffect } from 'react';
import { Play, ArrowLeft, ShieldAlert, FileText, AlertTriangle, CheckCircle2, Printer } from 'lucide-react';
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
    <>
      {/* ========================================================================= */}
      {/* 1. SCREEN VIEW SECTION (Hidden during printing) */}
      {/* ========================================================================= */}
      <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6 print:hidden">
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

          <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => window.print()}
              className="w-full sm:w-auto px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 border border-slate-300 transition"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Print Lot Traveler</span>
            </button>

            <button
              onClick={() => setIsSigModalOpen(true)}
              className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-2xl shadow-lg transition flex items-center justify-center gap-2 active:scale-95"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start Compounding</span>
            </button>
          </div>
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

      {/* ========================================================================= */}
      {/* 2. PRINT-ONLY PRODUCTION AND QC LOT TRAVELER (Visible during printing) */}
      {/* ========================================================================= */}
      <div className="hidden print:block bg-white text-black p-8 font-sans w-full max-w-[8.5in] mx-auto text-sm leading-relaxed">
        {/* Header Block */}
        <div className="flex items-center justify-between border-b border-black pb-4 mb-6">
          <div className="flex items-center gap-4">
            <img src="/nkb-logo.png" alt="System Logo" className="h-14 w-auto object-contain" />
            <div>
              <h1 className="text-base font-extrabold uppercase tracking-tight text-black">
                NKB Manufacturing Corp.
              </h1>
              <p className="text-[10px] text-slate-700 font-bold uppercase tracking-wider">
                Production & Formulation MES
              </p>
            </div>
          </div>
          <div>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${batch.batch_number}`}
              alt="Batch QR Code"
              className="h-16 w-16 border border-slate-300 p-1"
            />
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-6">
          <h2 className="text-sm font-black uppercase tracking-wider border-b-2 border-black pb-1 inline-block">
            Production and QC Lot Traveler
          </h2>
        </div>

        {/* General Fields Grid */}
        <div className="grid grid-cols-1 gap-2.5 text-xs">
          <div className="flex items-end">
            <span className="font-bold uppercase text-[10px] w-48 text-black shrink-0">CUSTOMER</span>
            <span className="mr-2 font-bold shrink-0">:</span>
            <div className="flex-1 border-b border-black h-4"></div>
          </div>

          <div className="flex items-end">
            <span className="font-bold uppercase text-[10px] w-48 text-black shrink-0">DATE</span>
            <span className="mr-2 font-bold shrink-0">:</span>
            <div className="flex-1 border-b border-black h-4 font-semibold px-2">
              {new Date(batch.created_at || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>

          <div className="flex items-end">
            <span className="font-bold uppercase text-[10px] w-48 text-black shrink-0">PRODUCT NAME</span>
            <span className="mr-2 font-bold shrink-0">:</span>
            <div className="flex-1 border-b border-black h-4 font-bold px-2 text-black">
              {batch.formula_name} ({batch.formula_code})
            </div>
          </div>

          <div className="flex items-end">
            <span className="font-bold uppercase text-[10px] w-48 text-black shrink-0">BATCH NO.</span>
            <span className="mr-2 font-bold shrink-0">:</span>
            <div className="flex-1 border-b border-black h-4 font-mono font-bold px-2">
              {batch.batch_number}
            </div>
          </div>

          <div className="flex items-end">
            <span className="font-bold uppercase text-[10px] w-48 text-black shrink-0">PACKAGING</span>
            <span className="mr-2 font-bold shrink-0">:</span>
            <div className="flex-1 border-b border-black h-4"></div>
          </div>

          <div className="flex items-end">
            <span className="font-bold uppercase text-[10px] w-48 text-black shrink-0">WEIGHT RECEIVED</span>
            <span className="mr-2 font-bold shrink-0">:</span>
            <div className="flex-1 border-b border-black h-4"></div>
          </div>

          <div className="flex items-end">
            <span className="font-bold uppercase text-[10px] w-48 text-black shrink-0">REFILL DATE</span>
            <span className="mr-2 font-bold shrink-0">:</span>
            <div className="flex-1 border-b border-black h-4"></div>
          </div>

          <div className="flex items-end">
            <span className="font-bold uppercase text-[10px] w-48 text-black shrink-0">TIME START</span>
            <span className="mr-2 font-bold shrink-0">:</span>
            <div className="flex-1 border-b border-black h-4"></div>
          </div>

          <div className="flex items-end">
            <span className="font-bold uppercase text-[10px] w-48 text-black shrink-0">TIME END</span>
            <span className="mr-2 font-bold shrink-0">:</span>
            <div className="flex-1 border-b border-black h-4"></div>
          </div>

          <div className="flex items-end">
            <span className="font-bold uppercase text-[10px] w-48 text-black shrink-0">TARGET NO. OF BOTTLE QTY</span>
            <span className="mr-2 font-bold shrink-0">:</span>
            <div className="flex-1 border-b border-black h-4"></div>
          </div>

          <div className="flex items-end">
            <span className="font-bold uppercase text-[10px] w-48 text-black shrink-0">ACTUAL NO. OF BOTTLE PRODUCED</span>
            <span className="mr-2 font-bold shrink-0">:</span>
            <div className="flex-1 border-b border-black h-4"></div>
          </div>

          <div className="flex items-end">
            <span className="font-bold uppercase text-[10px] w-48 text-black shrink-0">WEIGHT LEFT</span>
            <span className="mr-2 font-bold shrink-0">:</span>
            <div className="flex-1 border-b border-black h-4"></div>
          </div>

          <div className="flex items-end">
            <span className="font-bold uppercase text-[10px] w-48 text-black shrink-0">TOTAL</span>
            <span className="mr-2 font-bold shrink-0">:</span>
            <div className="flex-1 border-b border-black h-4"></div>
          </div>
        </div>

        {/* Section divider */}
        <div className="border-t border-black my-5"></div>

        {/* Batching Requirement Section */}
        <div className="text-xs">
          <h3 className="text-[11px] font-black uppercase tracking-wider mb-4">
            Batching Requirement
          </h3>

          <div className="grid grid-cols-1 gap-3">
            <div className="flex items-end">
              <span className="font-bold text-[10px] w-64 text-black shrink-0">Compounded Date</span>
              <span className="mr-2 font-bold shrink-0">:</span>
              <div className="flex-1 border-b border-black h-4"></div>
            </div>

            <div className="flex items-end">
              <span className="font-bold text-[10px] w-64 text-black shrink-0">Compounded by</span>
              <span className="mr-2 font-bold shrink-0">:</span>
              <div className="flex-1 border-b border-black h-4"></div>
            </div>

            <div className="flex items-end">
              <span className="font-bold text-[10px] w-64 text-black shrink-0">QA checked and approved by</span>
              <span className="mr-2 font-bold shrink-0">:</span>
              <div className="flex-1 border-b border-black h-4"></div>
            </div>

            <div className="flex items-end">
              <span className="font-bold text-[10px] w-64 text-black shrink-0">Accepted by Production Supervisor</span>
              <span className="mr-2 font-bold shrink-0">:</span>
              <div className="flex-1 border-b border-black h-4"></div>
            </div>

            <div className="flex items-end">
              <span className="font-bold text-[10px] w-64 text-black shrink-0">Operators Sign-off</span>
              <span className="mr-2 font-bold shrink-0">:</span>
              <div className="flex-1 border-b border-black h-4"></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
