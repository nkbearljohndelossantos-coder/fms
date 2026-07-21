import React, { useEffect, useState } from 'react';
import { Save, ArrowLeft, Info } from 'lucide-react';
import { apiFetch } from '../services/api';

export function CreateMaterialPage({ setCurrentPage }) {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    companyId: '',
    vendorId: '',
    uom: 'kg',
    cost: '0.00',
    currencyCode: 'PHP',
    densityKgPerL: '1.00',
    specificGravity: '1.00',
    unitWeight: '',
    unitWeightUom: 'g',
    description: '',
    isInventoried: false,
  });

  const [companies, setCompanies] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    apiFetch('/api/v1/companies')
      .then(res => res.json())
      .then(d => d.success && setCompanies(d.data));

    apiFetch('/api/v1/vendors')
      .then(res => res.json())
      .then(d => d.success && setVendors(d.data));
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.code || !formData.uom) {
      setMessage({ type: 'error', text: 'Material Name, Code, and UOM are required.' });
      return;
    }

    setSaving(true);
    setMessage(null);

    apiFetch('/api/v1/materials', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
    })
      .then(res => res.json())
      .then(data => {
        setSaving(false);
        if (data.success) {
          setMessage({ type: 'success', text: 'Material created successfully in master data!' });
          setTimeout(() => setCurrentPage('materials-list'), 1200);
        } else {
          setMessage({ type: 'error', text: data.message });
        }
      })
      .catch(err => {
        setSaving(false);
        setMessage({ type: 'error', text: err.message });
      });
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Action Bar */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentPage('materials-list')}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Create Material</h1>
            <p className="text-xs text-slate-500">Master Data Entry for Formulation & Costing</p>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center gap-2 transition-all disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Material'}
        </button>
      </div>

      {/* Message Banner */}
      {message && (
        <div
          className={`p-4 rounded-xl text-xs font-medium border flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <Info className="w-4 h-4" /> {message.text}
        </div>
      )}

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl space-y-6 border border-slate-200 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Material Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Material Name <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Deionized Water / Niacinamide"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
            />
          </div>

          {/* Material Code */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Material Code <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. MAT-WTR-001"
              value={formData.code}
              onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-mono font-bold text-blue-700 focus:outline-none focus:border-blue-600"
            />
          </div>

          {/* Company Dropdown Reference */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Company (Reference)</label>
            <select
              value={formData.companyId}
              onChange={e => setFormData({ ...formData, companyId: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
            >
              <option value="">-- Select Company --</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
          </div>

          {/* Vendor Dropdown Reference */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Vendor (Reference)</label>
            <select
              value={formData.vendorId}
              onChange={e => setFormData({ ...formData, vendorId: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
            >
              <option value="">-- Select Vendor --</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>{v.name} ({v.code})</option>
              ))}
            </select>
          </div>

          {/* UOM */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Unit of Measure (UOM) <span className="text-rose-600">*</span>
            </label>
            <select
              value={formData.uom}
              onChange={e => setFormData({ ...formData, uom: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-blue-600"
            >
              <optgroup label="MASS">
                <option value="kg">kg (Kilogram)</option>
                <option value="g">g (Gram)</option>
                <option value="mg">mg (Milligram)</option>
              </optgroup>
              <optgroup label="VOLUME">
                <option value="L">L (Liter)</option>
                <option value="mL">mL (Milliliter)</option>
              </optgroup>
              <optgroup label="COUNT">
                <option value="pieces">pieces</option>
                <option value="capsules">capsules</option>
                <option value="tablets">tablets</option>
                <option value="sachets">sachets</option>
              </optgroup>
            </select>
          </div>

          {/* Cost */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Cost per UOM</label>
            <div className="flex gap-2">
              <input
                type="text"
                maxLength="3"
                value={formData.currencyCode}
                onChange={e => setFormData({ ...formData, currencyCode: e.target.value.toUpperCase() })}
                className="w-16 bg-white border border-slate-300 rounded-lg text-center text-xs font-bold text-slate-700 uppercase"
              />
              <input
                type="number"
                step="0.0001"
                placeholder="0.0000"
                value={formData.cost}
                onChange={e => setFormData({ ...formData, cost: e.target.value })}
                className="flex-1 bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-mono text-slate-900 font-bold focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* Density KG/L */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Density (KG/L) <span className="text-slate-500 font-normal">(Required for Weight ↔ Volume)</span>
            </label>
            <input
              type="number"
              step="0.000001"
              placeholder="1.000000"
              value={formData.densityKgPerL}
              onChange={e => setFormData({ ...formData, densityKgPerL: e.target.value, specificGravity: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600"
            />
          </div>

          {/* Unit Weight (For Count conversions) */}
          {['pieces', 'capsules', 'tablets', 'sachets'].includes(formData.uom) && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Unit Weight <span className="text-slate-500 font-normal">(For Count ↔ Mass Conversion)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.000001"
                  placeholder="e.g. 0.000096"
                  value={formData.unitWeight}
                  onChange={e => setFormData({ ...formData, unitWeight: e.target.value })}
                  className="flex-1 bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-mono text-slate-900"
                />
                <select
                  value={formData.unitWeightUom}
                  onChange={e => setFormData({ ...formData, unitWeightUom: e.target.value })}
                  className="w-20 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700"
                >
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="mg">mg</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Description</label>
          <textarea
            rows="3"
            placeholder="Ingredient specifications, function notes, or storage instructions..."
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
            className="w-full bg-white border border-slate-300 rounded-lg p-3 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
          ></textarea>
        </div>

        {/* Inventoried Checkbox */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3">
          <input
            type="checkbox"
            id="inventoried"
            checked={formData.isInventoried}
            onChange={e => setFormData({ ...formData, isInventoried: e.target.checked })}
            className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-0 w-4 h-4 cursor-pointer"
          />
          <div>
            <label htmlFor="inventoried" className="text-xs font-bold text-slate-900 cursor-pointer">
              Inventoried Material (Reference Only)
            </label>
            <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
              Descriptive reference flag. Does not activate stock-in, stock-out, warehouse, or purchasing functionality.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}
