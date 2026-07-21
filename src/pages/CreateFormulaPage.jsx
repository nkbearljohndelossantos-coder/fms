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
    product_category: 'Skincare',
    product_subcategory: 'Serum',
    brand_type: 'NKB Core',
    reference_batch_size: '100.00',
    reference_batch_uom: 'g',
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
      const response = await apiFetch('/api/formulas', {
        method: 'POST',
        body: JSON.stringify({
          code: formData.code,
          name: formData.name,
          formula_type: formData.formula_type,
          product_category: formData.product_category,
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
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Beaker className="w-5 h-5 text-slate-700" />
              Create Formula
            </h1>
            <p className="text-xs text-slate-500">
              Initialize Master Formula & Version 1.0 Draft (No materials required initially)
            </p>
          </div>
        </div>
      </div>

      {/* Info Alert Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start space-x-3 text-blue-900">
        <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <span className="font-semibold text-blue-950">Draft Formulation Rule:</span>
          <p>
            Initial creation requires only basic master information. 100% composition validation is only required when submitting for review or approval.
          </p>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center space-x-3 text-rose-900">
          <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <div className="text-sm font-medium">{errorMessage}</div>
        </div>
      )}

      {/* Success Banner */}
      {successData && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center space-x-3 text-emerald-900">
          <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div className="text-sm font-medium">
            Formula created successfully! Redirecting to draft editor (Version {successData.version || '1.0'})...
          </div>
        </div>
      )}

      {/* Main Creation Form */}
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Formula Code */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Formula Code <span className="text-rose-600">*</span>
              </label>
              <span className="text-[11px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                ⚡ Auto-Generated
              </span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                required
                placeholder="e.g. COS-2026-001"
                value={formData.code}
                onChange={(e) => handleChange('code', e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600 transition"
              />
              <button
                type="button"
                onClick={generateAutoCode}
                className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-300 transition flex items-center gap-1.5 text-xs font-semibold"
                title="Refresh Auto-Generated Code"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Formula Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              Formula Name <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Hydrating Face Serum"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-600 transition"
            />
          </div>

          {/* Formula Type */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              Formula Type <span className="text-rose-600">*</span>
            </label>
            <select
              value={formData.formula_type}
              onChange={(e) => handleChange('formula_type', e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-600 transition"
            >
              <option value="COSMETIC">Cosmetic</option>
            </select>
          </div>

          {/* Product Category */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              Product Category
            </label>
            <input
              type="text"
              placeholder="e.g. Skincare, Fine Fragrance"
              value={formData.product_category}
              onChange={(e) => handleChange('product_category', e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-600 transition"
            />
          </div>

          {/* Product Subcategory */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              Product Subcategory
            </label>
            <input
              type="text"
              placeholder="e.g. Serum, Cream, Eau de Parfum"
              value={formData.product_subcategory}
              onChange={(e) => handleChange('product_subcategory', e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-600 transition"
            />
          </div>

          {/* Brand Type */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              Brand Type
            </label>
            <input
              type="text"
              placeholder="e.g. NKB Core, Brand A"
              value={formData.brand_type}
              onChange={(e) => handleChange('brand_type', e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-600 transition"
            />
          </div>

          {/* Reference Batch Size */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              Reference Batch Size <span className="text-rose-600">*</span>
            </label>
            <input
              type="number"
              step="0.0001"
              min="0.0001"
              required
              value={formData.reference_batch_size}
              onChange={(e) => handleChange('reference_batch_size', e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-600 transition"
            />
          </div>

          {/* Reference Batch UOM */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              Reference Batch UOM <span className="text-rose-600">*</span>
            </label>
            <select
              value={formData.reference_batch_uom}
              onChange={(e) => handleChange('reference_batch_uom', e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-600 transition"
            >
              <option value="g">g (Grams)</option>
            </select>
          </div>
        </div>

        {/* Revision Reason */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
            Revision Reason / Creation Note <span className="text-slate-500">(Optional)</span>
          </label>
          <textarea
            rows="2"
            placeholder="e.g. Initial draft creation for R&D formulation development"
            value={formData.revision_reason}
            onChange={(e) => handleChange('revision_reason', e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-600 transition"
          />
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end space-x-4 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={() => setCurrentPage('dashboard')}
            className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center space-x-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-xl transition shadow-xs disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? 'Creating Formula...' : 'Create Formula'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateFormulaPage;
