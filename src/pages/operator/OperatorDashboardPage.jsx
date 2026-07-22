import React, { useState, useEffect } from 'react';
import { Play, QrCode, CheckCircle2, Clock, AlertTriangle, Layers, Activity, Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function OperatorDashboardPage({ setCurrentPage, setSelectedBatchId }) {
  const { user, accessToken } = useAuth();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBatches();
  }, []);

  const fetchBatches = async () => {
    try {
      const res = await fetch('/api/v1/batches', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBatches(data.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const assignedBatches = batches.filter(b => b.status === 'Assigned' || b.status === 'Ready');
  const runningBatches = batches.filter(b => b.status === 'In Progress' || b.status === 'Paused');
  const completedToday = batches.filter(b => b.status === 'Completed' || b.status === 'Pending QC');
  const pendingQc = batches.filter(b => b.status === 'Pending QC' || b.status === 'Under Inspection');

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Industrial Touch Header */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-bold rounded-full uppercase tracking-wider">
              Compounding MES Station #01
            </span>
            <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Online
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold mt-1 tracking-tight">
            Welcome, Operator {user?.firstName || user?.username}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Production Line A • High-Shear Compounding Suite
          </p>
        </div>

        {/* Quick Action Touch Buttons */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => setCurrentPage('operator-qr-scanner')}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-3.5 rounded-2xl font-bold text-sm shadow-lg transition-all active:scale-95"
          >
            <QrCode className="w-5 h-5" />
            <span>Scan Formula QR</span>
          </button>
        </div>
      </div>

      {/* Touch KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/60 text-blue-600 rounded-xl">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase">Assigned Batches</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{assignedBatches.length}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/60 text-amber-600 rounded-xl">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase">Running Batches</p>
            <p className="text-2xl font-black text-amber-600">{runningBatches.length}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase">Completed Today</p>
            <p className="text-2xl font-black text-emerald-600">{completedToday.length}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50 dark:bg-purple-950/60 text-purple-600 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase">Pending QC</p>
            <p className="text-2xl font-black text-purple-600">{pendingQc.length}</p>
          </div>
        </div>
      </div>

      {/* Active & Assigned Production Batches List */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Play className="w-4 h-4 text-blue-600" /> Active & Assigned Compounding Batches
          </h2>
          <span className="text-xs text-slate-500 font-medium">Ready for Execution</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs font-semibold">Loading manufacturing queue...</div>
        ) : batches.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Layers className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-600">No active compounding batches in queue.</p>

          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {batches.map((b) => (
              <div
                key={b.id}
                className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-blue-600 text-sm">{b.batch_number}</span>
                    <span className="px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold rounded-md">
                      {b.category}
                    </span>
                    <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-md ${
                      b.status === 'In Progress' ? 'bg-amber-100 text-amber-800' :
                      b.status === 'Assigned' ? 'bg-blue-100 text-blue-800' :
                      b.status === 'Pending QC' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-800'
                    }`}>
                      {b.status}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">{b.formula_name || 'Formula'} ({b.formula_code})</h3>
                  <p className="text-xs text-slate-500">
                    Target Batch Size: <span className="font-bold text-slate-700 dark:text-slate-300">{Number(b.target_batch_size).toFixed(2)} kg</span> • Machine: <span className="font-bold text-slate-700 dark:text-slate-300">{b.machine_name || 'Mixer MX-01'}</span>
                  </p>
                </div>

                <button
                  onClick={() => {
                    setSelectedBatchId(b.id);
                    if (b.status === 'In Progress' || b.status === 'Paused') {
                      setCurrentPage('operator-compounding-screen');
                    } else {
                      setCurrentPage('operator-formula-view');
                    }
                  }}
                  className="w-full md:w-auto px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2 active:scale-95"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>{b.status === 'In Progress' ? 'Resume MES Execution' : 'View Formula & Start'}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
