import React, { useState } from 'react';
import { QrCode, Scan, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function OperatorQRScannerPage({ setCurrentPage, setSelectedBatchId }) {
  const { accessToken } = useAuth();
  const [tokenInput, setTokenInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [validatedData, setValidatedData] = useState(null);

  const handleValidate = async (e) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;

    setLoading(true);
    setError(null);
    setValidatedData(null);

    try {
      const res = await fetch('/api/v1/qr/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ qrToken: tokenInput.trim() }),
      });

      const data = await res.json();
      setLoading(false);

      if (res.ok && data.success && data.data?.batch) {
        setValidatedData(data.data.batch);
        setSelectedBatchId(data.data.batch.id);
      } else {
        setError(data.message || 'Invalid or revoked QR token.');
      }
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Connection error');
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto space-y-6">
      <button
        onClick={() => setCurrentPage('operator-dashboard')}
        className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </button>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <QrCode className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Scan Production Formula QR</h2>
          <p className="text-xs text-slate-500">
            Scan physical batch barcode or enter tokenized QR reference code.
          </p>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {validatedData ? (
          <div className="p-5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl space-y-4">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5" /> Formula QR Validated Successfully
            </div>
            <div className="text-xs space-y-1 text-slate-700 dark:text-slate-300 font-mono">
              <p>Batch #: <span className="font-bold text-slate-900 dark:text-white">{validatedData.batch_number}</span></p>
              <p>Formula: <span className="font-bold text-slate-900 dark:text-white">{validatedData.formula_name} ({validatedData.formula_code})</span></p>
              <p>Category: <span className="font-bold text-slate-900 dark:text-white">{validatedData.category}</span></p>
              <p>Batch Size: <span className="font-bold text-slate-900 dark:text-white">{Number(validatedData.target_batch_size).toFixed(2)} kg</span></p>
            </div>
            <button
              onClick={() => setCurrentPage('operator-formula-view')}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition"
            >
              Open Formula Sheet & Start Compounding
            </button>
          </div>
        ) : (
          <form onSubmit={handleValidate} className="space-y-4">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1.5">
                Scan or Enter QR Reference Token / Batch Number
              </label>
              <div className="relative">
                <Scan className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  value={tokenInput}
                  onChange={e => setTokenInput(e.target.value)}
                  placeholder="e.g. BAT-2026-0101 or token hash"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl pl-10 pr-4 py-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-600 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md transition"
            >
              {loading ? 'Validating Token...' : 'Validate & Inspect Batch'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
