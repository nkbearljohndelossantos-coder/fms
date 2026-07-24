import React, { useEffect, useState } from 'react';
import { Save, ArrowLeft, Info, Plus, Building2, Building, X, RefreshCw } from 'lucide-react';
import { apiFetch } from '../services/api';

export function CreateMaterialPage({ setCurrentPage }) {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    companyId: '',
    vendorId: '',
    uom: 'g',
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

  // Quick Create Vendor Modal state
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [vendorSaving, setVendorSaving] = useState(false);
  const [vendorError, setVendorError] = useState('');
  const [newVendor, setNewVendor] = useState({ code: '', name: '', contactPerson: '', email: '', phone: '' });

  // Quick Create Company Modal state
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [companySaving, setCompanySaving] = useState(false);
  const [companyError, setCompanyError] = useState('');
  const [newCompany, setNewCompany] = useState({ code: '', name: '', contactPerson: '', email: '', phone: '' });

  const fetchCompanies = () => {
    apiFetch('/api/v1/companies')
      .then(res => res.json())
      .then(d => d.success && setCompanies(d.data));
  };

  const fetchVendors = () => {
    apiFetch('/api/v1/vendors')
      .then(res => res.json())
      .then(d => d.success && setVendors(d.data));
  };

  useEffect(() => {
    fetchCompanies();
    fetchVendors();
  }, []);

  const openQuickCompanyModal = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    setNewCompany({ code: `COMP-${randomNum}`, name: '', contactPerson: '', email: '', phone: '' });
    setCompanyError('');
    setShowCompanyModal(true);
  };

  const handleQuickCreateCompany = (e) => {
    e.preventDefault();
    if (!newCompany.code.trim() || !newCompany.name.trim()) {
      setCompanyError('Company Code and Name are required.');
      return;
    }

    setCompanySaving(true);
    setCompanyError('');

    apiFetch('/api/v1/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCompany),
    })
      .then(res => res.json())
      .then(data => {
        setCompanySaving(false);
        if (data.success) {
          setShowCompanyModal(false);
          fetchCompanies();
          if (data.companyId || data.company?.id) {
            setFormData(prev => ({ ...prev, companyId: String(data.companyId || data.company.id) }));
          }
        } else {
          setCompanyError(data.message || 'Failed to create company.');
        }
      })
      .catch(err => {
        setCompanySaving(false);
        setCompanyError(err.message);
      });
  };

  const openQuickVendorModal = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    setNewVendor({ code: `VEND-${randomNum}`, name: '', contactPerson: '', email: '', phone: '' });
    setVendorError('');
    setShowVendorModal(true);
  };

  const handleQuickCreateVendor = (e) => {
    e.preventDefault();
    if (!newVendor.code.trim() || !newVendor.name.trim()) {
      setVendorError('Vendor Code and Name are required.');
      return;
    }

    setVendorSaving(true);
    setVendorError('');

    apiFetch('/api/v1/vendors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newVendor),
    })
      .then(res => res.json())
      .then(data => {
        setVendorSaving(false);
        if (data.success) {
          setShowVendorModal(false);
          fetchVendors();
          if (data.vendorId || data.vendor?.id) {
            setFormData(prev => ({ ...prev, vendorId: String(data.vendorId || data.vendor.id) }));
          }
        } else {
          setVendorError(data.message || 'Failed to create vendor.');
        }
      })
      .catch(err => {
        setVendorSaving(false);
        setVendorError(err.message);
      });
  };

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
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">Company (Reference)</label>
              <button
                type="button"
                onClick={openQuickCompanyModal}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition"
              >
                <Plus className="w-3 h-3" /> Quick Add Company
              </button>
            </div>
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">Vendor (Reference)</label>
              <button
                type="button"
                onClick={openQuickVendorModal}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition"
              >
                <Plus className="w-3 h-3" /> Quick Add Vendor
              </button>
            </div>
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
              <option value="g">g (Gram)</option>
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

      {/* Quick Create Vendor Modal */}
      {showVendorModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md border border-slate-200 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" /> Quick Add New Vendor
              </h3>
              <button
                type="button"
                onClick={() => setShowVendorModal(false)}
                className="text-slate-400 hover:text-slate-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {vendorError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 font-medium">
                {vendorError}
              </div>
            )}

            <form onSubmit={handleQuickCreateVendor} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Vendor Code <span className="text-rose-600">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="e.g. VEND-1001"
                    value={newVendor.code}
                    onChange={e => setNewVendor({ ...newVendor, code: e.target.value.toUpperCase() })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-blue-700 focus:outline-none focus:border-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setNewVendor({ ...newVendor, code: `VEND-${Math.floor(1000 + Math.random() * 9000)}` })}
                    className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-medium border border-slate-300 flex items-center gap-1 transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Vendor Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Fine Chem Corp"
                  value={newVendor.name}
                  onChange={e => setNewVendor({ ...newVendor, name: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contact Person</label>
                <input
                  type="text"
                  placeholder="e.g. Juan dela Cruz"
                  value={newVendor.contactPerson}
                  onChange={e => setNewVendor({ ...newVendor, contactPerson: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  placeholder="e.g. contact@vendor.com"
                  value={newVendor.email}
                  onChange={e => setNewVendor({ ...newVendor, email: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowVendorModal(false)}
                  className="w-1/2 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={vendorSaving}
                  className="w-1/2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center justify-center gap-1 transition disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" /> {vendorSaving ? 'Saving...' : 'Save Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Create Company Modal */}
      {showCompanyModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md border border-slate-200 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building className="w-4 h-4 text-blue-600" /> Quick Add New Company
              </h3>
              <button
                type="button"
                onClick={() => setShowCompanyModal(false)}
                className="text-slate-400 hover:text-slate-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {companyError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 font-medium">
                {companyError}
              </div>
            )}

            <form onSubmit={handleQuickCreateCompany} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Company Code <span className="text-rose-600">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="e.g. NKB-MC"
                    value={newCompany.code}
                    onChange={e => setNewCompany({ ...newCompany, code: e.target.value.toUpperCase() })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-blue-700 focus:outline-none focus:border-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setNewCompany({ ...newCompany, code: `COMP-${Math.floor(1000 + Math.random() * 9000)}` })}
                    className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-medium border border-slate-300 flex items-center gap-1 transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Company Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. NKB Manufacturing Corp."
                  value={newCompany.name}
                  onChange={e => setNewCompany({ ...newCompany, name: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contact Person</label>
                <input
                  type="text"
                  placeholder="e.g. Juan dela Cruz"
                  value={newCompany.contactPerson}
                  onChange={e => setNewCompany({ ...newCompany, contactPerson: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  placeholder="e.g. info@company.com"
                  value={newCompany.email}
                  onChange={e => setNewCompany({ ...newCompany, email: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCompanyModal(false)}
                  className="w-1/2 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={companySaving}
                  className="w-1/2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center justify-center gap-1 transition disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" /> {companySaving ? 'Saving...' : 'Save Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
