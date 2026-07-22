import React, { useEffect, useState } from 'react';
import { StatusBadge } from '../components/Badge';
import { History, GitBranch, ArrowLeft, RefreshCw } from 'lucide-react';
import { apiFetch } from '../services/api';

export function FormulaVersionsPage({ setCurrentPage }) {
  const [formulas, setFormulas] = useState([]);
  const [selectedVersionId, setSelectedVersionId] = useState(null);
  const [versionDetail, setVersionDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchFormulas();
  }, []);

  const fetchFormulas = () => {
    setLoading(true);
    apiFetch('/api/v1/formulas')
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.data)) {
          setFormulas(d.data);
          if (d.data.length > 0 && !selectedVersionId) {
            const firstVerId = d.data[0].active_version_id || (d.data[0].versions && d.data[0].versions[0]?.id);
            if (firstVerId) {
              viewVersion(firstVerId);
            }
          }
        }
      })
      .finally(() => setLoading(false));
  };

  const viewVersion = (vId) => {
    if (!vId) return;
    setSelectedVersionId(vId);
    apiFetch(`/api/v1/formulas/versions/${vId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data) {
          setVersionDetail(d.data);
        }
      });
  };

  const createRevisionDraft = (formulaId, parentVersionId) => {
    apiFetch(`/api/v1/formulas/${formulaId}/revisions`, {
      method: 'POST',
      body: JSON.stringify({ parentVersionId }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          const newVId = d.data?.version_id || d.versionId;
          alert(`Created new draft revision version ${d.data?.version || 'V2.0'}!`);
          viewVersion(newVId);
          fetchFormulas();
        } else {
          alert(`Error: ${d.message}`);
        }
      });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setCurrentPage('dashboard')}
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <History className="w-5 h-5 text-slate-700" /> Formula Revision & Version History
            </h1>
            <p className="text-xs text-slate-500">
              Complete major/minor version lineage, parent version references, approval timestamps, and immutable read-only records.
            </p>
          </div>
        </div>
        <button
          onClick={fetchFormulas}
          className="p-2 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition"
          title="Refresh List"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Formulas Master List with Version Badges */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-sm border-b border-slate-200 pb-2">Formulas Master</h3>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            {formulas.map(f => (
              <div key={f.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-mono text-xs font-bold text-blue-700">{f.code}</span>
                    <p className="font-semibold text-slate-900 text-xs">{f.name}</p>
                  </div>
                  <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono font-medium">{f.product_category}</span>
                </div>

                <div className="space-y-1 text-xs pt-1 border-t border-slate-200">
                  {Array.isArray(f.versions) && f.versions.map(v => {
                    const displayVer = v.version || (v.major_version != null ? `V${v.major_version}.${v.minor_version}` : 'V1.0');
                    return (
                      <div
                        key={v.id}
                        onClick={() => viewVersion(v.id)}
                        className={`p-2 rounded-lg cursor-pointer flex justify-between items-center transition-colors ${
                          selectedVersionId === v.id ? 'bg-blue-50 border border-blue-300' : 'hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-mono">
                          <GitBranch className="w-3.5 h-3.5 text-slate-500" />
                          <span className="font-bold text-slate-900">{displayVer}</span>
                        </div>
                        <StatusBadge status={v.version_status} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Detailed Version Viewer & Timeline */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          {!versionDetail || !versionDetail.version ? (
            <div className="p-12 text-center text-slate-500 text-xs">Select a formula version from the left panel to inspect lineage.</div>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {(versionDetail.formula?.code || 'FORM')} — {versionDetail.version.version_code || `V${versionDetail.version.major_version}.${versionDetail.version.minor_version}`}
                  </h2>
                  <p className="text-xs text-slate-500">{versionDetail.formula?.name || 'Formula Details'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={versionDetail.version.version_status} />
                  {(versionDetail.version.version_status === 'APPROVED' || versionDetail.version.version_status === 'REJECTED') && (
                    <button
                      onClick={() => createRevisionDraft(versionDetail.formula?.id || versionDetail.version.formula_id, versionDetail.version.id)}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
                    >
                      Create New Revision Draft
                    </button>
                  )}
                </div>
              </div>

              {/* Version Specs Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block">Lock Version</span>
                  <span className="font-mono text-slate-900 font-bold">{versionDetail.version.lock_version ?? 0}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block">Change Type</span>
                  <span className="font-semibold text-slate-900">{versionDetail.version.change_type || 'INITIAL'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block">Target Batch</span>
                  <span className="font-mono text-slate-900 font-bold">{versionDetail.version.target_batch_size || '100.00'} {versionDetail.version.target_batch_uom || 'kg'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block">Effective Date</span>
                  <span className="font-mono text-slate-700">{versionDetail.version.effective_date ? new Date(versionDetail.version.effective_date).toLocaleDateString() : '-'}</span>
                </div>
              </div>

              {/* Materials Table */}
              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2">
                  Version Composition ({Array.isArray(versionDetail.materials) ? versionDetail.materials.length : 0} lines)
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-100 text-slate-600 border-b border-slate-200 uppercase font-semibold">
                      <tr>
                        <th className="p-2.5">Code</th>
                        <th className="p-2.5">Material Name</th>
                        <th className="p-2.5">Percentage (%)</th>
                        <th className="p-2.5">Quantity</th>
                        <th className="p-2.5">UOM</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {Array.isArray(versionDetail.materials) && versionDetail.materials.map(m => (
                        <tr key={m.id}>
                          <td className="p-2.5 font-mono text-blue-700 font-bold">{m.material_code_snapshot || m.material_code || '-'}</td>
                          <td className="p-2.5 font-medium text-slate-900">{m.material_name_snapshot || m.material_name || '-'}</td>
                          <td className="p-2.5 font-mono">{Number(m.percentage || 0).toFixed(2)}%</td>
                          <td className="p-2.5 font-mono">{Number(m.calculated_quantity || 0).toFixed(2)}</td>
                          <td className="p-2.5 font-mono text-slate-600">{m.uom_snapshot || 'kg'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FormulaVersionsPage;
