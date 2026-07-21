import React, { useEffect, useState } from 'react';
import { Search, Plus, Filter, History, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../services/api';

export function MaterialsListPage({ setCurrentPage }) {
  const [materials, setMaterials] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const [selectedCostHistory, setSelectedCostHistory] = useState(null);

  const fetchMaterials = () => {
    setLoading(true);
    let url = `/api/v1/materials?search=${encodeURIComponent(search)}`;
    if (categoryFilter) url += `&category=${categoryFilter}`;

    apiFetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.success) setMaterials(data.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchMaterials();
  }, [search, categoryFilter]);

  const openCostHistory = (materialId, materialName) => {
    apiFetch(`/api/v1/materials/${materialId}/cost-history`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setSelectedCostHistory({ materialName, history: data.data });
        }
      });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Material Master List</h1>
          <p className="text-xs text-slate-500">
            Formulation reference raw materials, default UOMs, densities, and costing data.
          </p>
        </div>
        <button
          onClick={() => setCurrentPage('create-material')}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center gap-2 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" /> Create Material
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by code, name, or description..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
          >
            <option value="">All Categories (MASS / VOLUME / COUNT)</option>
            <option value="MASS">MASS (mg, g, kg)</option>
            <option value="VOLUME">VOLUME (mL, L)</option>
            <option value="COUNT">COUNT (pieces, capsules, tablets)</option>
          </select>
        </div>
      </div>

      {/* Materials Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="p-3">Code</th>
                <th className="p-3">Material Name</th>
                <th className="p-3">Company</th>
                <th className="p-3">Vendor</th>
                <th className="p-3">UOM</th>
                <th className="p-3">Cost / Unit</th>
                <th className="p-3">Density (KG/L)</th>
                <th className="p-3">Inventoried</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan="9" className="p-8 text-center text-slate-500">Loading material master records...</td>
                </tr>
              ) : materials.length === 0 ? (
                <tr>
                  <td colSpan="9" className="p-8 text-center text-slate-500">No materials found matching criteria.</td>
                </tr>
              ) : (
                materials.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-mono font-bold text-blue-700">{m.code}</td>
                    <td className="p-3 font-medium text-slate-900">{m.name}</td>
                    <td className="p-3 text-slate-600">{m.company_name || '-'}</td>
                    <td className="p-3 text-slate-600">{m.vendor_name || '-'}</td>
                    <td className="p-3 font-mono">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold border border-slate-200">{m.uom}</span>
                    </td>
                    <td className="p-3 font-mono text-slate-900 font-bold">
                      {m.currency_code} {Number(m.cost).toFixed(2)}
                    </td>
                    <td className="p-3 font-mono text-slate-700">{Number(m.density_kg_per_l).toFixed(2)}</td>
                    <td className="p-3">
                      {m.is_inventoried ? (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-medium">
                          <CheckCircle2 className="w-3 h-3 text-slate-500" /> Reference Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-slate-50 text-slate-400 px-2 py-0.5 rounded border border-slate-200">
                          No
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => openCostHistory(m.id, m.name)}
                        className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                        title="View Price History Log"
                      >
                        <History className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cost History Modal */}
      {selectedCostHistory && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-lg border border-slate-200 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-slate-700" /> Price History — {selectedCostHistory.materialName}
              </h3>
              <button onClick={() => setSelectedCostHistory(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2 text-xs">
              {selectedCostHistory.history.length === 0 ? (
                <p className="text-slate-500">No historical price changes recorded.</p>
              ) : (
                selectedCostHistory.history.map(h => (
                  <div key={h.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center">
                    <div>
                      <p className="text-slate-700 font-medium">
                        {h.old_currency_code} {Number(h.old_cost).toFixed(2)} → <span className="text-blue-700 font-bold">{h.new_currency_code} {Number(h.new_cost).toFixed(2)}</span>
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1">Changed by: {h.changed_by_username || 'System'}</p>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">{new Date(h.created_at).toLocaleString()}</span>
                  </div>
                ))
              )}
            </div>
            <button
              onClick={() => setSelectedCostHistory(null)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
