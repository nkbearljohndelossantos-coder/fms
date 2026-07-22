import React, { useState } from 'react';
import { ShieldCheck, Lock, AlertCircle, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function ElectronicSignatureModal({ isOpen, onClose, onAuthorized, actionTitle, action, entityType, entityId }) {
  const { accessToken } = useAuth();
  const [passwordOrPin, setPasswordOrPin] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/signatures/challenge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          passwordOrPin,
          action: action || 'DEFAULT_ACTION',
          entityType: entityType || 'System',
          entityId: String(entityId || '0'),
          reason: reason || 'Electronic signature authorization',
        }),
      });

      const data = await res.json();
      setLoading(false);

      if (res.ok && data.success && data.signatureToken) {
        onAuthorized(data.signatureToken, reason);
        setPasswordOrPin('');
        setReason('');
        onClose();
      } else {
        setError(data.message || 'Signature authorization failed.');
      }
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Connection error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-blue-200" />
            <div>
              <h3 className="font-bold text-sm">Electronic Signature Required</h3>
              <p className="text-[11px] text-blue-100 font-mono">{actionTitle || action}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-blue-100 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 space-y-1">
            <p className="font-bold flex items-center gap-1.5 text-xs">
              <Lock className="w-3.5 h-3.5 text-amber-600" /> 21 CFR Part 11 / Annex 11 Compliance
            </p>
            <p className="text-[11px] leading-relaxed">
              Re-enter your password or PIN to generate a single-use electronic signature challenge token.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Password or Signature PIN
            </label>
            <input
              type="password"
              required
              autoFocus
              value={passwordOrPin}
              onChange={e => setPasswordOrPin(e.target.value)}
              placeholder="Enter your security password or PIN"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Reason for Action (Optional)
            </label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Approved production start / QC release sign-off"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs transition"
            >
              {loading ? 'Authenticating...' : 'Sign & Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
