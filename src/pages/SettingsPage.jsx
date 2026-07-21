import React, { useEffect, useState } from 'react';
import { Settings, Save, Info } from 'lucide-react';
import { apiFetch } from '../services/api';

export function SettingsPage() {
  const [settings, setSettings] = useState({
    percentage_display_decimals: '2',
    quantity_display_decimals: '2',
    cost_display_decimals: '2',
    rounding_mode: 'ROUND_HALF_UP',
    default_currency: 'PHP',
    formula_tolerance_pct: '0.01',
  });
  const [saving, setSaving] = useState(false);
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

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 text-slate-700" /> System Settings & Calculation Tolerances
        </h1>
        <p className="text-xs text-slate-500">Configure display decimal rounding, currency defaults, and percentage tolerances.</p>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-xs font-medium border flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-rose-50 text-rose-900 border-rose-200'}`}>
          <Info className="w-4 h-4" /> {message.text}
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
        <h3 className="font-bold text-slate-900 text-sm border-b border-slate-200 pb-2">Display & Report Precision Settings</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1.5">Percentage Display Decimals</label>
            <select
              value={settings.percentage_display_decimals}
              onChange={e => setSettings({ ...settings, percentage_display_decimals: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded p-2.5 text-slate-900 font-bold focus:outline-none focus:border-blue-600"
            >
              <option value="2">2 Decimals (e.g. 15.50%)</option>
              <option value="4">4 Decimals (e.g. 15.5000%)</option>
              <option value="6">6 Decimals (e.g. 15.500000%)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1.5">Quantity Display Decimals</label>
            <select
              value={settings.quantity_display_decimals}
              onChange={e => setSettings({ ...settings, quantity_display_decimals: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded p-2.5 text-slate-900 font-bold focus:outline-none focus:border-blue-600"
            >
              <option value="2">2 Decimals (e.g. 1.25 kg)</option>
              <option value="4">4 Decimals (e.g. 1.2500 kg)</option>
              <option value="6">6 Decimals (e.g. 1.250000 kg)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1.5">Cost Display Decimals</label>
            <select
              value={settings.cost_display_decimals}
              onChange={e => setSettings({ ...settings, cost_display_decimals: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded p-2.5 text-slate-900 font-bold focus:outline-none focus:border-blue-600"
            >
              <option value="2">2 Decimals (e.g. PHP 150.25)</option>
              <option value="4">4 Decimals (e.g. PHP 150.2500)</option>
              <option value="6">6 Decimals (e.g. PHP 150.250000)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1.5">Rounding Mode</label>
            <select
              value={settings.rounding_mode}
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
              value={settings.default_currency}
              onChange={e => setSettings({ ...settings, default_currency: e.target.value.toUpperCase() })}
              className="w-full bg-white border border-slate-300 rounded p-2.5 text-slate-900 font-bold uppercase text-center focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1.5">100% Formula Tolerance (%)</label>
            <input
              type="number"
              step="0.0001"
              value={settings.formula_tolerance_pct}
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
    </div>
  );
}
