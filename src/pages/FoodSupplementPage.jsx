import React, { useEffect, useState } from 'react';
import { StatusBadge } from '../components/Badge';
import { Pill, Plus, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../services/api';

export function FoodSupplementPage({ setCurrentPage }) {
  const [formulas, setFormulas] = useState([]);
  const [selectedVersionId, setSelectedVersionId] = useState(null);
  const [activeVersion, setActiveVersion] = useState(null);
  const [availableMaterials, setAvailableMaterials] = useState([]);

  const [supplementDetails, setSupplementDetails] = useState({
    dosage_form: 'Capsules',
    composition_mode: 'AMOUNT_PER_SERVING',
    serving_size: '1.000000',
    serving_uom: 'capsule',
    servings_per_container: 60,
    capsule_size: 'Size 0',
    tablet_weight: '500.000000',
    tablet_weight_uom: 'mg',
    daily_recommended_intake: 'Take 1 capsule daily after meals',
    warning_statement: 'Consult physician if pregnant',
    storage_instruction: 'Store below 25°C in dry place',
  });

  const [materials, setMaterials] = useState([]);
  const [calcResult, setCalcResult] = useState(null);

  useEffect(() => {
    apiFetch('/api/v1/materials')
      .then(r => r.json())
      .then(d => d.success && setAvailableMaterials(d.data));

    apiFetch('/api/v1/formulas?category=Food Supplement')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data) {
          setFormulas(d.data);
          if (d.data.length > 0) {
            const firstVer = d.data[0].latest_version || d.data[0].versions[0];
            if (firstVer) loadVersion(firstVer.id);
          }
        }
      });
  }, []);

  const loadVersion = (vId) => {
    setSelectedVersionId(vId);
    fetch(`/api/v1/formulas/versions/${vId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data) {
          setActiveVersion(d.data.version);
          setMaterials(d.data.materials || []);
          if (d.data.categoryDetails) {
            setSupplementDetails(d.data.categoryDetails);
          }
        }
      });
  };

  // Recalculate excipient q.s. and serving totals when materials or target unit weight change
  useEffect(() => {
    if (supplementDetails.composition_mode === 'AMOUNT_PER_SERVING') {
      const targetWt = Number(supplementDetails.tablet_weight || 500);
      let totalActiveWithOverage = 0;
      let qsMaterial = null;

      materials.forEach(m => {
        const active = Number(m.active_amount_per_serving || m.serving_amount || 0);
        const overage = Number(m.overage_pct || 0);
        const withOverage = active * (1 + overage / 100);

        if (m.is_qs_balancing_material) {
          qsMaterial = m;
        } else {
          totalActiveWithOverage += withOverage;
        }
      });

      const requiredExcipient = targetWt - totalActiveWithOverage;
      const isValid = requiredExcipient >= 0;

      setCalcResult({
        targetWt,
        totalActiveWithOverage: totalActiveWithOverage.toFixed(4),
        requiredExcipient: requiredExcipient.toFixed(4),
        isValid,
      });
    }
  }, [materials, supplementDetails]);

  return (
    <div className="p-6 space-y-6">
      {/* Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Pill className="w-6 h-6 text-emerald-400" /> Food Supplement Formulator Workspace
          </h1>
          <p className="text-xs text-slate-400">
            Capsules, Tablets, Sachets, Powders, Syrups — Dual Percentage & Amount-Per-Serving Modes.
          </p>
        </div>

        {activeVersion && (
          <div className="flex items-center gap-3 bg-slate-900 p-2 rounded-xl border border-slate-800">
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
        )}
      </div>

      {activeVersion && (
        <>
          {/* Excipient Calculation Indicator Banner */}
          {supplementDetails.composition_mode === 'AMOUNT_PER_SERVING' && calcResult && (
            <div className={`glass-panel p-4 rounded-xl border flex items-center justify-between ${calcResult.isValid ? 'border-emerald-800 bg-emerald-950/20' : 'border-rose-800 bg-rose-950/40'}`}>
              <div className="flex items-center gap-4 text-xs">
                <div>
                  <span className="text-slate-400">Target Unit Weight:</span>{' '}
                  <span className="font-mono font-bold text-white">{calcResult.targetWt} mg</span>
                </div>
                <div>
                  <span className="text-slate-400">Active + Overage Total:</span>{' '}
                  <span className="font-mono font-bold text-amber-300">{calcResult.totalActiveWithOverage} mg</span>
                </div>
                <div>
                  <span className="text-slate-400">Required Excipient (q.s.):</span>{' '}
                  <span className={`font-mono font-bold ${calcResult.isValid ? 'text-emerald-300' : 'text-rose-400'}`}>
                    {calcResult.requiredExcipient} mg
                  </span>
                </div>
              </div>

              {!calcResult.isValid && (
                <span className="text-xs text-rose-300 font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" /> Active ingredients exceed target unit weight!
                </span>
              )}
            </div>
          )}

          {/* Dosage Specs Panel */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="font-bold text-white text-sm border-b border-slate-800 pb-2">Dosage & Composition Mode</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Dosage Form</label>
                <select
                  value={supplementDetails.dosage_form}
                  onChange={e => setSupplementDetails({ ...supplementDetails, dosage_form: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white font-bold"
                >
                  <option value="Capsules">Capsules</option>
                  <option value="Tablets">Tablets</option>
                  <option value="Powders">Powders</option>
                  <option value="Sachets">Sachets</option>
                  <option value="Syrups">Syrups</option>
                  <option value="Oral liquids">Oral liquids</option>
                  <option value="Gummies">Gummies</option>
                  <option value="Softgels">Softgels</option>
                  <option value="Drink mixes">Drink mixes</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Composition Mode</label>
                <select
                  value={supplementDetails.composition_mode}
                  onChange={e => setSupplementDetails({ ...supplementDetails, composition_mode: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-emerald-300 font-bold"
                >
                  <option value="AMOUNT_PER_SERVING">AMOUNT_PER_SERVING (mg per unit)</option>
                  <option value="PERCENTAGE">PERCENTAGE (100% Total)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Target Tablet/Capsule Weight (mg)</label>
                <input
                  type="number"
                  value={supplementDetails.tablet_weight || ''}
                  onChange={e => setSupplementDetails({ ...supplementDetails, tablet_weight: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 font-mono text-emerald-300 font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Capsule Size</label>
                <input
                  type="text"
                  value={supplementDetails.capsule_size || ''}
                  onChange={e => setSupplementDetails({ ...supplementDetails, capsule_size: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white"
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
