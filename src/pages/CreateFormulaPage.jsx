import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/api';
import { Beaker, ArrowLeft, Save, AlertTriangle, CheckCircle, FileText, RefreshCw } from 'lucide-react';

export function CreateFormulaPage({ setCurrentPage, onFormulaCreated }) {
  const { accessToken, user } = useAuth();
  
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    formula_type: 'COSMETIC',
    product_category: 'Cosmetic',
    product_subcategory: 'Serum',
    brand_type: 'NKB Core',
    reference_batch_size: '100.00',
    reference_batch_uom: 'kg',
    revision_reason: 'Initial formula creation',
  });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successData, setSuccessData] = useState(null);

  useEffect(() => {
    generateAutoCode();
  }, []);

  const generateAutoCode = () => {
    apiFetch('/api/v1/formulas')
      .then(res => res.json())
      .then(d => {
        const count = (d.success && Array.isArray(d.data)) ? d.data.length + 1 : 1;
        const year = new Date().getFullYear();
        const pad = String(count).padStart(3, '0');
        setFormData(prev => ({ ...prev, code: `COS-${year}-${pad}` }));
      })
      .catch(() => {
        const year = new Date().getFullYear();
        const rand = String(Math.floor(100 + Math.random() * 900));
        setFormData(prev => ({ ...prev, code: `COS-${year}-${rand}` }));
      });
  };

  const handleChange = (field, value) => {
    setErrorMessage('');
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessData(null);
    setLoading(true);

    try {
      const response = await apiFetch('/api/v1/formulas', {
        method: 'POST',
        body: JSON.stringify({
          name: formData.name,
          category: 'Cosmetic',
          formula_type: 'COSMETIC',
          product_category: 'Cosmetic',
          product_subcategory: formData.product_subcategory,
          brand_type: formData.brand_type,
          reference_batch_size: formData.reference_batch_size,
          reference_batch_uom: formData.reference_batch_uom,
          revision_reason: formData.revision_reason,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setErrorMessage(data.message || 'Database operation failed');
        setLoading(false);
        return;
      }

      setSuccessData(data.data || data);

      if (typeof onFormulaCreated === 'function') {
        onFormulaCreated(data.data || data);
      }

      setTimeout(() => {
        setCurrentPage('formulation-cosmetic');
      }, 600);

    } catch (err) {
      setErrorMessage(err.message || 'Database operation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Top Header Controls */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setCurrentPage('dashboard')}
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Beaker className="w-6 h-6 text-blue-600" />
              Create New Formulation Draft
            </h1>
            <p className="text-sm text-slate-500">Initialize a new R&D master formula code and v1.0 draft version</p>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-red-700 text-sm">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold block">Formula Creation Failed</span>
            {errorMessage}
          </div>
        </div>
      )}

      {/* Success Banner */}
      {successData && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3 text-emerald-800 text-sm">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block">Formula Draft Created Successfully!</span>
            Created Code <span className="font-mono font-bold text-emerald-900">{successData.code}</span> (Version {successData.version || '1.0'}). Redirecting...
          </div>
        </div>
      )}

      {/* Form Section */}
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Auto Formula Code */}
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Auto Sequence Code
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.code}
                  readOnly
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-700 cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={generateAutoCode}
                  className="absolute right-2 top-2 p-1 text-slate-400 hover:text-blue-600 transition"
                  title="Regenerate Sequence Code"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Generated by server sequence engine</p>
            </div>

            {/* Formula Name */}
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Formula Title / Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Ultra Hydrating Vitamin B5 Niacinamide Serum"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Product Category
              </label>
              <select
                value={formData.product_category}
                onChange={(e) => handleChange('product_category', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium text-slate-900"
              >
                <option value="Cosmetic">Cosmetic (Skincare / Personal Care)</option>
              </select>
            </div>

            {/* Subcategory */}
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Subcategory / Product Type
              </label>
              <input
                type="text"
                placeholder="e.g. Cleanser, Lotion, Toner, Serum"
                value={formData.product_subcategory}
                onChange={(e) => handleChange('product_subcategory', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Target Batch Size */}
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Default Target Batch Size
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={formData.reference_batch_size}
                  onChange={(e) => handleChange('reference_batch_size', e.target.value)}
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <select
                  value={formData.reference_batch_uom}
                  onChange={(e) => handleChange('reference_batch_uom', e.target.value)}
                  className="w-24 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-mono"
                >
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="L">L</option>
                  <option value="mL">mL</option>
                </select>
              </div>
            </div>

            {/* Brand / Department */}
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Brand / Product Line
              </label>
              <input
                type="text"
                placeholder="e.g. NKB Skin Tech"
                value={formData.brand_type}
                onChange={(e) => handleChange('brand_type', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Revision Reason */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
              Initial Release Description / Notes
            </label>
            <textarea
              rows={3}
              value={formData.revision_reason}
              onChange={(e) => handleChange('revision_reason', e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="e.g. Initial R&D formulation draft for stability testing..."
            />
          </div>
        </div>

        {/* Form Actions Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={() => setCurrentPage('dashboard')}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center gap-2 transition disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save & Create Formula Draft
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateFormulaPage;
