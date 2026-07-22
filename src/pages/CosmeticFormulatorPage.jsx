import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/api';
import {
  FlaskConical,
  Save,
  Send,
  Plus,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Lock,
  ChevronDown,
  Info,
  Clock,
} from 'lucide-react';

function StatusBadge({ status }) {
  const map = {
    DRAFT: { label: 'DRAFT', bg: 'bg-slate-100 text-slate-800 border-slate-300' },
    UNDER_REVIEW: { label: 'UNDER REVIEW', bg: 'bg-amber-100 text-amber-900 border-amber-300' },
    FOR_APPROVAL: { label: 'FOR APPROVAL', bg: 'bg-blue-100 text-blue-900 border-blue-300' },
    APPROVED: { label: 'APPROVED', bg: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
    REJECTED: { label: 'REJECTED', bg: 'bg-rose-100 text-rose-900 border-rose-300' },
    SUPERSEDED: { label: 'SUPERSEDED', bg: 'bg-slate-200 text-slate-600 border-slate-400' },
  };

  const conf = map[status] || map.DRAFT;
  return (
    <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${conf.bg}`}>
      {conf.label}
    </span>
  );
}

export function CosmeticFormulatorPage() {
  const { user } = useAuth();
  const [formulas, setFormulas] = useState([]);
  const [selectedVersionId, setSelectedVersionId] = useState(null);
  const [activeVersion, setActiveVersion] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [availableMaterials, setAvailableMaterials] = useState([]);
  const [cosmeticDetails, setCosmeticDetails] = useState({
    target_ph: '5.50 - 6.00',
    viscosity_cp: '4500 - 6000 cP',
    appearance: 'Clear gel liquid',
    color: 'Water clear',
    odor: 'Clean subtle characteristic',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAvailableMaterials();
    fetchFormulas();
  }, []);

  const fetchAvailableMaterials = () => {
    apiFetch('/api/v1/materials')
      .then(res => res.json())
      .then(d => {
        if (d.success) setAvailableMaterials(d.data || []);
      });
  };

  const fetchFormulas = () => {
    apiFetch('/api/v1/formulas?category=Cosmetic')
      .then(res => res.json())
      .then(d => {
        if (d.success && d.data?.length) {
          setFormulas(d.data);
          const firstVerId = d.data[0].versions[0]?.id;
          if (firstVerId && !selectedVersionId) {
            loadVersion(firstVerId);
          }
        }
      });
  };

  const loadVersion = (versionId) => {
    setSelectedVersionId(versionId);
    apiFetch(`/api/v1/formulas/versions/${versionId}`)
      .then(res => res.json())
      .then(d => {
        if (d.success && d.data) {
          const v = d.data.version;
          const f = d.data.formula;
          setActiveVersion({
            ...v,
            formula_code: f.code,
            formula_name: f.name,
            product_category: f.product_category,
            product_subcategory: f.product_subcategory,
            brand_type: f.brand_type,
          });

          const loadedMats = (d.data.materials || []).map((m, idx) => ({
            material_id: m.material_id,
            material_code_snapshot: m.material_code,
            material_name_snapshot: m.material_name,
            uom_snapshot: m.uom_snapshot || 'g',
            percentage: String(m.percentage || '0.00'),
            function_name: m.function_name || 'Active',
            phase_name: m.phase_name || 'Phase A - Water Phase',
            addition_order: idx + 1,
          }));

          setMaterials(loadedMats);
          if (d.data.categoryDetails) {
            setCosmeticDetails(d.data.categoryDetails);
          }
        }
      });
  };

  const totalPct = materials.reduce((acc, m) => acc + (parseFloat(m.percentage) || 0), 0).toFixed(2);
  const isValidPct = Math.abs(parseFloat(totalPct) - 100) < 0.05;

  const addLine = (phaseName = 'Phase A - Water Phase') => {
    const mat = availableMaterials[0] || { id: 1, code: 'MAT-001', name: 'Material', uom: 'g' };
    setMaterials([
      ...materials,
      {
        material_id: mat.id,
        material_code_snapshot: mat.code,
        material_name_snapshot: mat.name,
        uom_snapshot: mat.uom || 'g',
        percentage: '0.00',
        function_name: 'Solvent Base',
        phase_name: phaseName,
        addition_order: materials.length + 1,
      },
    ]);
  };

  const removeLine = (idx) => {
    setMaterials(materials.filter((_, i) => i !== idx));
  };

  const handleMaterialChange = (idx, field, val) => {
    const next = [...materials];
    if (field === 'material_id') {
      const mat = availableMaterials.find(m => m.id === Number(val));
      if (mat) {
        next[idx].material_id = mat.id;
        next[idx].material_code_snapshot = mat.code;
        next[idx].material_name_snapshot = mat.name;
        next[idx].uom_snapshot = mat.uom || 'g';
      }
    } else {
      next[idx][field] = val;
    }
    setMaterials(next);
  };

  const saveDraft = () => {
    if (!selectedVersionId) return;
    setSaving(true);
    apiFetch(`/api/v1/formulas/versions/${selectedVersionId}`, {
      method: 'PUT',
      body: JSON.stringify({
        lockVersion: activeVersion.lock_version,
        materials,
        categoryDetails: cosmeticDetails,
      }),
    })
      .then(res => res.json())
      .then(d => {
        setSaving(false);
        if (d.success) {
          alert('Cosmetic draft saved successfully!');
          loadVersion(selectedVersionId);
        } else {
          alert(`Save Error: ${d.message}`);
        }
      });
  };

  const handleWorkflow = async (action) => {
    if (!selectedVersionId) return;

    if (action === 'SUBMIT' || action === 'ENDORSE' || action === 'APPROVE') {
      if (!materials || materials.length === 0) {
        alert('Workflow Submission Blocked: Please add composition materials summing to 100.00% before submitting for review.');
        return;
      }
      if (!isValidPct) {
        alert(`Workflow Submission Blocked: Total formula percentage is ${totalPct}%. Total must equal 100.00% before submitting for review.`);
        return;
      }
    }

    try {
      const res = await apiFetch(`/api/v1/formulas/versions/${selectedVersionId}/workflow`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      const d = await res.json();
      if (res.ok && d.success) {
        alert(`Workflow action '${action}' completed! Formula transitioned to ${d.message.split('to ')[1] || 'new state'}.`);
        loadVersion(selectedVersionId);
        fetchFormulas();
      } else {
        alert(`Workflow Policy Warning (HTTP ${res.status}): ${d.message || 'Operation failed'}`);
      }
    } catch (err) {
      alert(`Workflow Error: ${err.message}`);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Cosmetic Formulation Workspace</h1>
          <p className="text-xs text-slate-500">
            Phase-based formulation editor (Phase A-C, Cooling, Post-Addition), pH & Viscosity specs.
          </p>
        </div>

        {/* Formula Picker & Status */}
        {activeVersion && (
          <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
            <select
              value={selectedVersionId || ''}
              onChange={e => loadVersion(e.target.value)}
              className="bg-white border border-slate-300 text-xs font-bold text-slate-900 rounded-lg px-3 py-1.5 focus:outline-none"
            >
              {formulas.map(f =>
                f.versions.map(v => (
                  <option key={v.id} value={v.id}>
                    {f.code} — V{v.major_version}.{v.minor_version} ({v.version_status})
                  </option>
                ))
              )}
            </select>
            <StatusBadge status={activeVersion.version_status} />
          </div>
        )}
      </div>

      {activeVersion && (
        <>
          {/* Selected Formula Master Details Banner */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-extrabold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                  {activeVersion.formula_code}
                </span>
                <div>
                  <h2 className="text-base font-bold text-slate-900">{activeVersion.formula_name}</h2>
                  <p className="text-xs text-slate-500">
                    {activeVersion.product_category || 'Cosmetic'} {activeVersion.product_subcategory ? `• ${activeVersion.product_subcategory}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                  V{activeVersion.major_version}.{activeVersion.minor_version}
                </span>
                <StatusBadge status={activeVersion.version_status} />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-1">
              <div>
                <span className="text-slate-500 block font-medium">Brand Type</span>
                <span className="font-semibold text-slate-900">{activeVersion.brand_type || 'NKB Core'}</span>
              </div>
              <div>
                <span className="text-slate-500 block font-medium">Ref. Batch Size</span>
                <span className="font-mono font-bold text-slate-900">{Number(activeVersion.target_batch_size || 100).toFixed(2)} {activeVersion.target_batch_uom || 'g'}</span>
              </div>
              <div>
                <span className="text-slate-500 block font-medium">Change Type</span>
                <span className="font-semibold text-slate-900">{activeVersion.change_type || 'INITIAL'}</span>
              </div>
              <div>
                <span className="text-slate-500 block font-medium">Revision Reason</span>
                <span className="text-slate-700 truncate block" title={activeVersion.revision_reason}>{activeVersion.revision_reason || 'Initial formula creation'}</span>
              </div>
            </div>
          </div>

          {/* Percentage Counter Indicator Banner */}
          <div className="bg-white p-4 rounded-xl flex items-center justify-between border border-slate-200 shadow-xs">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl font-bold font-mono text-sm ${isValidPct ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-amber-50 text-amber-900 border border-amber-200'}`}>
                Total: {totalPct}%
              </div>
              <span className="text-xs text-slate-700 font-medium">
                {isValidPct ? '✅ Formula total equals 100.00% within tolerance.' : '⚠️ Formula must sum to 100.00% before submission.'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {activeVersion.version_status === 'DRAFT' && (
                <>
                  <button onClick={saveDraft} disabled={saving} className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-300">
                    <Save className="w-3.5 h-3.5 text-slate-600" /> Save Draft
                  </button>
                  <button onClick={() => handleWorkflow('SUBMIT')} className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs">
                    <Send className="w-3.5 h-3.5" /> Submit for Review
                  </button>
                </>
              )}
              {activeVersion.version_status === 'UNDER_REVIEW' && (
                <button onClick={() => handleWorkflow('ENDORSE')} className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold">
                  Endorse for Approval
                </button>
              )}
              {activeVersion.version_status === 'FOR_APPROVAL' && (
                <button onClick={() => handleWorkflow('APPROVE')} className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold">
                  Approve Version
                </button>
              )}
            </div>
          </div>

          {/* Composition Table */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Phase-Based Composition Table</h3>
              <button onClick={() => addLine('Phase A - Water Phase')} className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg text-xs font-semibold flex items-center gap-1 border border-blue-200">
                <Plus className="w-3.5 h-3.5" /> Add Material Line
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 uppercase">
                  <tr>
                    <th className="p-3">Phase</th>
                    <th className="p-3">Material</th>
                    <th className="p-3">Percentage (%)</th>
                    <th className="p-3">Function</th>
                    <th className="p-3">UOM</th>
                    <th className="p-3 text-center">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {materials.map((m, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-3">
                        <select
                          value={m.phase_name || 'Phase A - Water Phase'}
                          onChange={e => handleMaterialChange(idx, 'phase_name', e.target.value)}
                          className="bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-900 font-semibold"
                        >
                          <option value="Phase A - Water Phase">Phase A - Water Phase</option>
                          <option value="Phase B - Surfactant Phase">Phase B - Surfactant Phase</option>
                          <option value="Phase C - Active Phase">Phase C - Active Phase</option>
                          <option value="Cooling Phase">Cooling Phase</option>
                          <option value="Post-Addition Phase">Post-Addition Phase</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <select
                          value={m.material_id}
                          onChange={e => handleMaterialChange(idx, 'material_id', e.target.value)}
                          className="bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-900 font-medium w-64"
                        >
                          {availableMaterials.map(mat => (
                            <option key={mat.id} value={mat.id}>{mat.code} — {mat.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          step="0.0001"
                          value={m.percentage}
                          onChange={e => handleMaterialChange(idx, 'percentage', e.target.value)}
                          className="w-28 bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-900 font-mono font-bold"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          value={m.function_name}
                          onChange={e => handleMaterialChange(idx, 'function_name', e.target.value)}
                          className="bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-900 w-40"
                        />
                      </td>
                      <td className="p-3 font-mono text-slate-700 font-bold">{m.uom_snapshot || 'g'}</td>
                      <td className="p-3 text-center">
                        <button onClick={() => removeLine(idx)} className="p-1 text-rose-600 hover:bg-rose-50 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cosmetic Technical Specifications */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-900 text-sm border-b border-slate-200 pb-2">
              Cosmetic Quality Parameters & Specifications
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-slate-500 font-medium mb-1">Target pH Range</label>
                <input
                  type="text"
                  value={cosmeticDetails.target_ph || ''}
                  onChange={e => setCosmeticDetails({ ...cosmeticDetails, target_ph: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-xs text-slate-900 font-mono"
                  placeholder="e.g. 5.50 - 6.00"
                />
              </div>
              <div>
                <label className="block text-slate-500 font-medium mb-1">Target Viscosity (cP)</label>
                <input
                  type="text"
                  value={cosmeticDetails.viscosity_cp || ''}
                  onChange={e => setCosmeticDetails({ ...cosmeticDetails, viscosity_cp: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-xs text-slate-900 font-mono"
                  placeholder="e.g. 4500 - 6000 cP"
                />
              </div>
              <div>
                <label className="block text-slate-500 font-medium mb-1">Appearance</label>
                <input
                  type="text"
                  value={cosmeticDetails.appearance || ''}
                  onChange={e => setCosmeticDetails({ ...cosmeticDetails, appearance: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-xs text-slate-900"
                  placeholder="e.g. Clear viscous liquid"
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default CosmeticFormulatorPage;
