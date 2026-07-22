import React, { useEffect, useState } from 'react';
import { StatusBadge } from '../components/Badge';
import {
  FlaskConical,
  Clock,
  Layers,
  Sparkles,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';
import { apiFetch } from '../services/api';

export function DashboardPage({ setCurrentPage }) {
  const [stats, setStats] = useState({
    total: 2,
    cosmetic: 2,
    drafts: 0,
    underReview: 0,
    forApproval: 0,
    approved: 2,
    rejected: 0,
  });

  const [recentFormulas, setRecentFormulas] = useState([
    { id: 1, code: 'F-COS-001', name: 'Gentle Hydrating Facial Cleanser', category: 'Cosmetic', version: '1.0', status: 'APPROVED', updated_at: '2026-07-21' },
    { id: 2, code: 'F-COS-002', name: 'Niacinamide 10% Soothing Serum', category: 'Cosmetic', version: '1.0', status: 'APPROVED', updated_at: '2026-07-21' },
  ]);

  useEffect(() => {
    apiFetch('/api/v1/formulas')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          const list = data.data.filter(f => f.product_category === 'Cosmetic' || f.category === 'Cosmetic');
          let cosmetic = 0;
          let drafts = 0, underReview = 0, forApproval = 0, approved = 0, rejected = 0;

          list.forEach(f => {
            cosmetic++;
            const st = f.latest_version ? f.latest_version.version_status : 'DRAFT';
            if (st === 'DRAFT') drafts++;
            else if (st === 'UNDER_REVIEW') underReview++;
            else if (st === 'FOR_APPROVAL') forApproval++;
            else if (st === 'APPROVED') approved++;
            else if (st === 'REJECTED') rejected++;
          });

          setStats({
            total: list.length,
            cosmetic,
            drafts,
            underReview,
            forApproval,
            approved,
            rejected,
          });
          setRecentFormulas(list.slice(0, 5));
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Hero Welcome */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Formulation Command Center</h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time management for Cosmetic Formulations and Production Compounding MES.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setCurrentPage('create-formula')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs transition-all flex items-center gap-2 shadow-xs"
          >
            <FlaskConical className="w-4 h-4" /> Create New Formula
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Total Formulas */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Active Formulas</span>
            <p className="text-3xl font-extrabold text-slate-900 mt-2">{stats.total}</p>
            <p className="text-xs text-slate-500 mt-1">Active in Master Database</p>
          </div>
          <div className="p-4 bg-blue-50 text-blue-700 rounded-2xl">
            <FlaskConical className="w-6 h-6" />
          </div>
        </div>

        {/* Cosmetic */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Cosmetics Formulations</span>
            <p className="text-3xl font-extrabold text-slate-900 mt-2">{stats.cosmetic}</p>
            <p className="text-xs text-slate-500 mt-1">Phase-Based Skincare & Personal Care</p>
          </div>
          <div className="p-4 bg-emerald-50 text-emerald-700 rounded-2xl">
            <Layers className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Workflow Status Counter Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 text-center shadow-xs">
          <p className="text-xs text-slate-500 font-medium">Drafts</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{stats.drafts}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-amber-200 text-center shadow-xs">
          <p className="text-xs text-amber-700 font-medium">Under Review</p>
          <p className="text-xl font-bold text-amber-900 mt-1">{stats.underReview}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-indigo-200 text-center shadow-xs">
          <p className="text-xs text-indigo-700 font-medium">For Approval</p>
          <p className="text-xl font-bold text-indigo-900 mt-1">{stats.forApproval}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-emerald-200 text-center shadow-xs">
          <p className="text-xs text-emerald-700 font-semibold">Approved</p>
          <p className="text-xl font-bold text-emerald-900 mt-1">{stats.approved}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-rose-200 text-center shadow-xs">
          <p className="text-xs text-rose-700 font-medium">Rejected</p>
          <p className="text-xl font-bold text-rose-900 mt-1">{stats.rejected}</p>
        </div>
      </div>

      {/* Recent Formulas Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-600" /> Recently Modified Cosmetics Formulas
          </h3>
          <button
            onClick={() => setCurrentPage('formula-versions')}
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
          >
            View All Versions <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-100 text-xs uppercase text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Code</th>
                <th className="p-3">Formula Name</th>
                <th className="p-3">Category</th>
                <th className="p-3">Version</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {recentFormulas.map(f => (
                <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-mono text-xs font-bold text-blue-700">{f.code}</td>
                  <td className="p-3 font-medium text-slate-900">{f.name}</td>
                  <td className="p-3 text-xs text-slate-600">{f.product_category || f.category}</td>
                  <td className="p-3 font-mono text-xs text-slate-700">
                    {f.latest_version ? `${f.latest_version.major_version}.${f.latest_version.minor_version}` : f.version || '1.0'}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={f.latest_version ? f.latest_version.version_status : f.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
