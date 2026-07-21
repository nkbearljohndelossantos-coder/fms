import React, { useEffect, useState } from 'react';
import { StatusBadge } from '../components/Badge';
import { Sparkles, Plus, Save, FlaskConical } from 'lucide-react';
import { apiFetch } from '../services/api';

export function PerfumeNoBrandPage({ setCurrentPage }) {
  const [formulas, setFormulas] = useState([]);
  const [selectedVersionId, setSelectedVersionId] = useState(null);
  const [activeVersion, setActiveVersion] = useState(null);
  const [perfumeDetails, setPerfumeDetails] = useState({
    concentration_tier: 'Body Mist',
    fragrance_pct: '5.000000',
    alcohol_pct: '75.000000',
    water_pct: '17.000000',
    fixative_pct: '1.000000',
    solubilizer_pct: '2.000000',
    maceration_days: 14,
    filtration_required: true,
    cooling_required_c: '4°C for 24h',
    odor_profile: 'Sweet warm vanilla base',
    packaging_recommendation: 'Amber glass bottle spray pump',
  });

  const [mixtureForm, setMixtureForm] = useState({
    mixtureCode: 'MIX-2026-002',
    mixtureName: 'Vanilla Body Mist Lot 501',
    actualTotalWeight: '100.000000',
    weightUom: 'kg',
    remarks: 'Actual recorded batch mixture for conversion testing',
  });
  const [showMixtureModal, setShowMixtureModal] = useState(false);

  useEffect(() => {
    fetchFormulas();
  }, []);

  const fetchFormulas = () => {
    apiFetch('/api/v1/formulas?category=Perfume No Brand')
      .then(res => res.json())
      .then(d => {
        if (d.success && d.data) {
          setFormulas(d.data);
          if (d.data.length > 0 && !selectedVersionId) {
            const firstVer = d.data[0].latest_version || d.data[0].versions[0];
            if (firstVer) loadVersion(firstVer.id);
          }
        }
      });
  };

  const loadVersion = (vId) => {
    setSelectedVersionId(vId);
    apiFetch(`/api/v1/formulas/versions/${vId}`)
      .then(res => res.json())
      .then(d => {
        if (d.success && d.data) {
          setActiveVersion(d.data.version);
          if (d.data.categoryDetails) {
            setPerfumeDetails(d.data.categoryDetails);
          }
        }
      });
  };

  const recordActualMixture = (e) => {
    e.preventDefault();
    if (!activeVersion) return;

    fetch('/api/v1/perfume-conversions/mixtures', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('nkb_access_token')}`,
      },
      body: JSON.stringify({
        ...mixtureForm,
        sourceFormulaVersionId: activeVersion.id,
        materials: [
          { material_id: 1, percentage: '5.000000', actual_quantity: '5.000000', uom: 'kg' },
          { material_id: 2, percentage: '75.000000', actual_quantity: '75.000000', uom: 'L' },
          { material_id: 3, percentage: '1.000000', actual_quantity: '1.000000', uom: 'kg' },
          { material_id: 4, percentage: '2.000000', actual_quantity: '2.000000', uom: 'kg' },
          { material_id: 5, percentage: '17.000000', actual_quantity: '17.000000', uom: 'kg' },
        ],
      }),
    })
      .then(res => res.json())
      .then(d => {
        if (d.success) {
          alert('Actual perfume mixture recorded for Brand Conversion target selection!');
          setShowMixtureModal(false);
        } else {
          alert(`Error: ${d.message}`);
        }
      });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Perfume – No Brand Formulation</h1>
          <p className="text-xs text-slate-400">
            Generic perfume base formulations, maceration controls, and actual compounded mixture recorder.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setShowMixtureModal(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-purple-600/30 flex items-center gap-2"
          >
            <FlaskConical className="w-4 h-4 text-amber-300" /> Record Actual Mixture
          </button>
        </div>
      </div>

      {/* Formula Selector */}
      {activeVersion && (
        <div className="glass-panel p-4 rounded-xl flex items-center justify-between border border-slate-800">
          <div className="flex items-center gap-3">
            <select
              value={selectedVersionId || ''}
              onChange={e => loadVersion(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-xs font-bold text-white rounded-lg px-3 py-1.5 focus:outline-none"
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
        </div>
      )}

      {/* Fragrance Specifications */}
      {activeVersion && (
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
          <h3 className="font-bold text-white text-base border-b border-slate-800 pb-3 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" /> Concentration Classification & Maceration Controls
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
            <div>
              <label className="block text-slate-400 mb-1.5 font-semibold">Concentration Tier</label>
              <select
                value={perfumeDetails.concentration_tier}
                onChange={e => setPerfumeDetails({ ...perfumeDetails, concentration_tier: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-bold"
              >
                <option value="Body Mist">Body Mist (3 - 5% Fragrance)</option>
                <option value="Cologne">Cologne (2 - 4% Fragrance)</option>
                <option value="Eau de Cologne">Eau de Cologne (3 - 5% Fragrance)</option>
                <option value="Eau de Toilette">Eau de Toilette (5 - 15% Fragrance)</option>
                <option value="Eau de Parfum">Eau de Parfum (15 - 20% Fragrance)</option>
                <option value="Parfum">Parfum (20 - 30% Fragrance)</option>
                <option value="Extrait de Parfum">Extrait de Parfum (30 - 40% Fragrance)</option>
                <option value="Custom">Custom Concentration</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1.5 font-semibold">Fragrance Oil %</label>
              <input
                type="number"
                step="0.0001"
                value={perfumeDetails.fragrance_pct}
                onChange={e => setPerfumeDetails({ ...perfumeDetails, fragrance_pct: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-amber-300 font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1.5 font-semibold">Alcohol %</label>
              <input
                type="number"
                step="0.0001"
                value={perfumeDetails.alcohol_pct}
                onChange={e => setPerfumeDetails({ ...perfumeDetails, alcohol_pct: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-purple-300 font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1.5 font-semibold">Maceration Period (Days)</label>
              <input
                type="number"
                value={perfumeDetails.maceration_days}
                onChange={e => setPerfumeDetails({ ...perfumeDetails, maceration_days: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1.5 font-semibold">Cooling Requirement (°C)</label>
              <input
                type="text"
                value={perfumeDetails.cooling_required_c || ''}
                onChange={e => setPerfumeDetails({ ...perfumeDetails, cooling_required_c: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1.5 font-semibold">Odor Profile</label>
              <input
                type="text"
                value={perfumeDetails.odor_profile || ''}
                onChange={e => setPerfumeDetails({ ...perfumeDetails, odor_profile: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* Record Actual Mixture Modal */}
      {showMixtureModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={recordActualMixture} className="glass-panel p-6 rounded-2xl w-full max-w-lg border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-amber-400" /> Record Actual Compounded Mixture
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Mixture Code *</label>
                <input
                  type="text"
                  required
                  value={mixtureForm.mixtureCode}
                  onChange={e => setMixtureForm({ ...mixtureForm, mixtureCode: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-amber-300 font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Mixture Name *</label>
                <input
                  type="text"
                  required
                  value={mixtureForm.mixtureName}
                  onChange={e => setMixtureForm({ ...mixtureForm, mixtureName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Actual Total Weight (kg) *</label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  value={mixtureForm.actualTotalWeight}
                  onChange={e => setMixtureForm({ ...mixtureForm, actualTotalWeight: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-emerald-300 font-mono font-bold"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button type="button" onClick={() => setShowMixtureModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold">
                Record Mixture
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
