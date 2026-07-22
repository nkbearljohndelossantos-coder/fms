import React, { useEffect, useState } from 'react';
import { Settings, Save, Info, AlertTriangle } from 'lucide-react';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';

export function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState({
    percentage_display_decimals: '2',
    rounding_mode: 'ROUND_HALF_UP',
    default_currency: 'PHP',
    formula_tolerance_pct: '0.01',
  });
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [message, setMessage] = useState(null);

  useEffect(() => {
    apiFetch('/api/v1/settings')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data) {
          setSettings(prev => ({ ...prev, ...d.data }));
        }
      });
  }, []);

  const handleSave = (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    apiFetch('/api/v1/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings }),
    })
      .then(r => r.json())
      .then(d => {
        setSaving(false);
        if (d.success) {
          setMessage({ type: 'success', text: 'System settings saved successfully!' });
        } else {
          setMessage({ type: 'error', text: d.message });
        }
      });
  };

  const handleSystemReset = () => {
    if (resetConfirmation !== 'RESET_ALL_DATA') return;

    const conf = window.confirm(
      'WARNING: This will permanently delete all formulas, raw materials, batch records, QC parameters, compounding entries, and audit logs. This action CANNOT be undone.\n\nAre you absolutely sure you want to proceed?'
    );
    if (!conf) return;

    setResetting(true);
    setMessage(null);

    apiFetch('/api/v1/settings/reset', {
      method: 'POST',
      body: JSON.stringify({ confirmation: resetConfirmation }),
    })
      .then(r => r.json())
      .then(d => {
        setResetting(false);
        setResetConfirmation('');
        if (d.success) {
          alert('System Database Reset Completed Successfully.');
          window.location.reload(); // Refresh session/app state
        } else {
          setMessage({ type: 'error', text: d.message || 'System reset failed.' });
        }
      })
      .catch(err => {
        setResetting(false);
        setMessage({ type: 'error', text: err.message || 'Connection error during reset.' });
      });
  };

  const isSuperAdmin = user?.role === 'Super Admin' || user?.roles?.includes('Super Admin');

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 text-slate-700" /> System Settings & Tolerances
        </h1>
        <p className="text-xs text-slate-500">Configure default currency, calculation rounding models, and database parameters.</p>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-xs font-medium border flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-rose-50 text-rose-900 border-rose-200'}`}>
          <Info className="w-4 h-4" /> {message.text}
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
        <h3 className="font-bold text-slate-900 text-sm border-b border-slate-200 pb-2">Calculation & Regional Settings</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1.5">Percentage Display Decimals</label>
            <select
              value={settings.percentage_display_decimals || '2'}
              onChange={e => setSettings({ ...settings, percentage_display_decimals: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded p-2.5 text-slate-900 font-bold focus:outline-none focus:border-blue-600"
            >
              <option value="2">2 Decimals (e.g. 15.50%)</option>
              <option value="4">4 Decimals (e.g. 15.5000%)</option>
              <option value="6">6 Decimals (e.g. 15.500000%)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1.5">Rounding Mode</label>
            <select
              value={settings.rounding_mode || 'ROUND_HALF_UP'}
              onChange={e => setSettings({ ...settings, rounding_mode: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded p-2.5 text-slate-900 font-bold focus:outline-none focus:border-blue-600"
            >
              <option value="ROUND_HALF_UP">ROUND_HALF_UP (Standard Scientific)</option>
              <option value="ROUND_HALF_EVEN">ROUND_HALF_EVEN (Banker's Rounding)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1.5">Default Currency Code</label>
            <input
              type="text"
              maxLength="3"
              value={settings.default_currency || 'PHP'}
              onChange={e => setSettings({ ...settings, default_currency: e.target.value.toUpperCase() })}
              className="w-full bg-white border border-slate-300 rounded p-2.5 text-slate-900 font-bold uppercase text-center focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1.5">100% Formula Tolerance (%)</label>
            <input
              type="number"
              step="0.0001"
              value={settings.formula_tolerance_pct || '0.01'}
              onChange={e => setSettings({ ...settings, formula_tolerance_pct: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded p-2.5 text-slate-900 font-mono font-bold focus:outline-none focus:border-blue-600"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2"
        >
          <Save className="w-4 h-4" /> Save System Settings
        </button>
      </form>

      {/* Danger Zone System Reset (Super Admin Only) */}
      {isSuperAdmin && (
        <div className="bg-white p-6 rounded-2xl border border-rose-200 shadow-xs space-y-4">
          <h3 className="font-bold text-rose-600 text-sm border-b border-slate-200 pb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500" /> System Reset Danger Zone
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Perform a complete database factory reset. This will permanently clear all formulations, raw materials, cost snapshots, batch compounding requirements, QC parameters, compounding runs, and audit logs.
            <br />
            <strong className="text-rose-700">Important:</strong> Active User Accounts and Role definitions will remain completely untouched.
          </p>

          <div className="space-y-3 pt-2 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1.5">
                To confirm, type <span className="font-mono text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">RESET_ALL_DATA</span> below:
              </label>
              <input
                type="text"
                placeholder="RESET_ALL_DATA"
                value={resetConfirmation}
                onChange={e => setResetConfirmation(e.target.value)}
                className="w-full max-w-xs bg-white border border-slate-300 rounded p-2.5 text-slate-900 font-mono font-bold uppercase focus:outline-none focus:border-rose-600"
              />
            </div>

            <button
              type="button"
              disabled={resetConfirmation !== 'RESET_ALL_DATA' || resetting}
              onClick={handleSystemReset}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs disabled:opacity-50 transition"
            >
              {resetting ? 'Resetting System Database...' : 'Execute Complete Database Reset'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SettingsPage;
