import React, { useEffect, useState } from 'react';
import { Building2, Save, ArrowLeft, Trash2, Search, PlusCircle, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { apiFetch } from '../services/api';

export function CreateVendorPage({ setCurrentPage }) {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState(null);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
  });

  const fetchVendors = () => {
    setLoading(true);
    apiFetch('/api/v1/vendors')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setVendors(data.data || []);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchVendors();
    generateSuggestedCode();
  }, []);

  const generateSuggestedCode = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    setFormData(prev => ({ ...prev, code: `VEND-${randomNum}` }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.code.trim() || !formData.name.trim()) {
      setMessage({ type: 'error', text: 'Vendor Code and Vendor Name are required.' });
      return;
    }

    setSaving(true);
    setMessage(null);

    apiFetch('/api/v1/vendors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })
      .then(res => res.json())
      .then(data => {
        setSaving(false);
        if (data.success) {
          setMessage({ type: 'success', text: `Vendor '${formData.name}' created successfully!` });
          setFormData({ code: '', name: '', contactPerson: '', email: '', phone: '' });
          generateSuggestedCode();
          fetchVendors();
        } else {
          setMessage({ type: 'error', text: data.message || 'Failed to create vendor.' });
        }
      })
      .catch(err => {
        setSaving(false);
        setMessage({ type: 'error', text: err.message });
      });
  };

  const handleDelete = (id, vendorName) => {
    if (!window.confirm(`Are you sure you want to delete vendor '${vendorName}'?`)) return;

    apiFetch(`/api/v1/vendors/${id}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setMessage({ type: 'success', text: data.message });
          fetchVendors();
        } else {
          setMessage({ type: 'error', text: data.message });
        }
      })
      .catch(err => setMessage({ type: 'error', text: err.message }));
  };

  const filteredVendors = vendors.filter(v =>
    (v.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (v.code || '').toLowerCase().includes(search.toLowerCase()) ||
    (v.contact_person || '').toLowerCase().includes(search.toLowerCase()) ||
    (v.email || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header Action Bar */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentPage('materials-list')}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            title="Back to Materials List"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" /> Vendor Management & Registration
            </h1>
            <p className="text-xs text-slate-500">Register new raw material vendors, suppliers, and distributors</p>
          </div>
        </div>

        <button
          onClick={() => setCurrentPage('create-material')}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center gap-1.5 transition"
        >
          <PlusCircle className="w-4 h-4" /> Go to Create Material
        </button>
      </div>

      {/* Alert Banner */}
      {message && (
        <div
          className={`p-4 rounded-xl text-xs font-medium border flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Registration Form Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
          <PlusCircle className="w-4 h-4 text-blue-600" /> Register New Vendor
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Vendor Code */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Vendor Code <span className="text-rose-600">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="e.g. VEND-1001"
                  value={formData.code}
                  onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-blue-700 focus:outline-none focus:border-blue-600"
                />
                <button
                  type="button"
                  onClick={generateSuggestedCode}
                  className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-medium border border-slate-300 flex items-center gap-1 transition"
                  title="Generate new code"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Vendor Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Vendor Name / Company <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Aroma Ingredients Corp"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            {/* Contact Person */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Person</label>
              <input
                type="text"
                placeholder="e.g. Juan dela Cruz"
                value={formData.contactPerson}
                onChange={e => setFormData({ ...formData, contactPerson: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                placeholder="e.g. sales@vendor.com"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
              <input
                type="text"
                placeholder="e.g. +63 917 123 4567"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            {/* Submit Button */}
            <div className="flex items-end">
              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving Vendor...' : 'Save Vendor'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Vendors Directory List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Registered Vendors Directory</h3>
            <p className="text-[11px] text-slate-500">List of verified raw material vendors linked to formulation items</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search vendor code or name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="p-3">Vendor Code</th>
                <th className="p-3">Vendor Name</th>
                <th className="p-3">Contact Person</th>
                <th className="p-3">Email</th>
                <th className="p-3">Phone</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-slate-500">Loading vendor records...</td>
                </tr>
              ) : filteredVendors.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-slate-500">
                    No registered vendors found. Fill out the form above to add your first vendor.
                  </td>
                </tr>
              ) : (
                filteredVendors.map(v => (
                  <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-mono font-bold text-blue-700">{v.code}</td>
                    <td className="p-3 font-medium text-slate-900">{v.name}</td>
                    <td className="p-3 text-slate-600">{v.contact_person || '—'}</td>
                    <td className="p-3 text-slate-600">{v.email || '—'}</td>
                    <td className="p-3 text-slate-600">{v.phone || '—'}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleDelete(v.id, v.name)}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                        title="Delete Vendor"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default CreateVendorPage;
