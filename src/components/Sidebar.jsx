import React, { useState } from 'react';
import {
  LayoutDashboard,
  Boxes,
  FlaskConical,
  Calculator,
  History,
  GitCompare,
  FileSpreadsheet,
  Users,
  Settings,
  ChevronDown,
  ChevronRight,
  PlusCircle,
  ListFilter,
} from 'lucide-react';

export function Sidebar({ currentPage, setCurrentPage }) {
  const [materialsOpen, setMaterialsOpen] = useState(true);
  const [formulationsOpen, setFormulationsOpen] = useState(true);

  const isCurrent = (page) => currentPage === page;

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen select-none shrink-0 text-slate-300">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-center">
        <img src="/nkb-logo.png" alt="NKB Logo" className="w-full h-20 object-contain drop-shadow-md" />
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1 text-sm font-medium">
        {/* Dashboard */}
        <button
          onClick={() => setCurrentPage('dashboard')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
            isCurrent('dashboard')
              ? 'bg-blue-600 text-white font-semibold'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <LayoutDashboard className="w-4 h-4 text-slate-400" />
          <span>Dashboard</span>
        </button>

        {/* Materials Parent Menu */}
        <div>
          <button
            onClick={() => setMaterialsOpen(!materialsOpen)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-3">
              <Boxes className="w-4 h-4 text-slate-400" />
              <span>Materials</span>
            </div>
            {materialsOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
          </button>
          {materialsOpen && (
            <div className="ml-4 pl-3 border-l border-slate-800 mt-1 space-y-1">
              <button
                onClick={() => setCurrentPage('materials-list')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors text-xs ${
                  isCurrent('materials-list')
                    ? 'bg-slate-800 text-blue-400 font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <ListFilter className="w-3.5 h-3.5 text-slate-400" />
                <span>Material List</span>
              </button>
              <button
                onClick={() => setCurrentPage('create-material')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors text-xs ${
                  isCurrent('create-material')
                    ? 'bg-slate-800 text-blue-400 font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5 text-slate-400" />
                <span>Create Material</span>
              </button>
            </div>
          )}
        </div>

        {/* Formulations Parent Menu */}
        <div>
          <button
            onClick={() => setFormulationsOpen(!formulationsOpen)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-3">
              <FlaskConical className="w-4 h-4 text-slate-400" />
              <span>Formulations</span>
            </div>
            {formulationsOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
          </button>
          {formulationsOpen && (
            <div className="ml-4 pl-3 border-l border-slate-800 mt-1 space-y-1">
              <button
                onClick={() => setCurrentPage('create-formula')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors text-xs ${
                  isCurrent('create-formula')
                    ? 'bg-slate-800 text-blue-400 font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5 text-slate-400" />
                <span>Create Formulation</span>
              </button>
              <button
                onClick={() => setCurrentPage('formulation-cosmetic')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors text-xs ${
                  isCurrent('formulation-cosmetic')
                    ? 'bg-slate-800 text-blue-400 font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <span>Cosmetic</span>
              </button>
            </div>
          )}
        </div>

        {/* Batch Calculator */}
        <button
          onClick={() => setCurrentPage('batch-calculator')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
            isCurrent('batch-calculator')
              ? 'bg-blue-600 text-white font-semibold'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Calculator className="w-4 h-4 text-slate-400" />
          <span>Batch Calculator</span>
        </button>

        {/* Formula Versions */}
        <button
          onClick={() => setCurrentPage('formula-versions')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
            isCurrent('formula-versions')
              ? 'bg-blue-600 text-white font-semibold'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <History className="w-4 h-4 text-slate-400" />
          <span>Formula Versions</span>
        </button>

        {/* Formula Comparison */}
        <button
          onClick={() => setCurrentPage('formula-comparison')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
            isCurrent('formula-comparison')
              ? 'bg-blue-600 text-white font-semibold'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <GitCompare className="w-4 h-4 text-slate-400" />
          <span>Formula Comparison</span>
        </button>

        {/* Reports */}
        <button
          onClick={() => setCurrentPage('reports')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
            isCurrent('reports')
              ? 'bg-blue-600 text-white font-semibold'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-slate-400" />
          <span>Reports</span>
        </button>

        {/* Users & Roles */}
        <button
          onClick={() => setCurrentPage('users-roles')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
            isCurrent('users-roles')
              ? 'bg-blue-600 text-white font-semibold'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4 text-slate-400" />
          <span>Users & Roles</span>
        </button>

        {/* Settings */}
        <button
          onClick={() => setCurrentPage('settings')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
            isCurrent('settings')
              ? 'bg-blue-600 text-white font-semibold'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Settings className="w-4 h-4 text-slate-400" />
          <span>Settings</span>
        </button>
      </nav>

      {/* Scope Disclaimer Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/60 text-xs text-slate-400 space-y-1">
        <p className="font-semibold text-slate-300">Pure Formulation Manager</p>
        <p className="text-[10px] leading-tight text-slate-400">
          Strictly Master Data, Versioning, Calculations & Costing.
        </p>
      </div>
    </aside>
  );
}
