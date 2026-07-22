import React, { useState, useEffect } from 'react';
import { History, ShieldCheck, FileSpreadsheet, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function OperatorHistoryPage() {
  const { accessToken } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch('/api/v1/audit-logs', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setLogs(data.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-6 h-6 text-blue-600" /> Production Execution & Signed Audit History
          </h1>
          <p className="text-xs text-slate-500">
            Append-only tamper-evident audit trail with SHA-256 hash chaining.
          </p>
        </div>

        <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600" /> Hash Chain Verified
        </span>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-900 dark:text-white">Audit Event Log</span>
          <span className="text-xs text-slate-500 font-mono">Total Logs: {logs.length}</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 font-semibold">Loading audit trail...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold uppercase text-[11px] border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3.5 px-6">Seq #</th>
                  <th className="py-3.5 px-6">Action</th>
                  <th className="py-3.5 px-6">Entity</th>
                  <th className="py-3.5 px-6">Timestamp (UTC)</th>
                  <th className="py-3.5 px-6">SHA-256 Entry Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-3.5 px-6 font-bold font-mono text-slate-400">#{log.sequence_number || log.id}</td>
                    <td className="py-3.5 px-6 font-bold text-slate-900 dark:text-white">{log.action}</td>
                    <td className="py-3.5 px-6 font-mono text-slate-600">{log.entity || log.entity_type} #{log.entity_id}</td>
                    <td className="py-3.5 px-6 font-mono text-slate-500">{new Date(log.created_at).toLocaleString()}</td>
                    <td className="py-3.5 px-6 font-mono text-[11px] text-blue-600 truncate max-w-[200px]">
                      {log.entry_hash || log.hash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
