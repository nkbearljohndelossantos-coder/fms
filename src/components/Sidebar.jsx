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
  ShieldCheck,
  QrCode,
  Play,
  Activity,
  GitBranch,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Sidebar({ currentPage, setCurrentPage }) {
  const { user } = useAuth();
  const [materialsOpen, setMaterialsOpen] = useState(true);
  const [formulationsOpen, setFormulationsOpen] = useState(true);
  const [productionOpen, setProductionOpen] = useState(true);

  const isCurrent = (page) => currentPage === page;
  const isOperator = user?.role === 'Compounding Operator';

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen select-none shrink-0 text-slate-300">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800 flex flex-col items-center justify-center space-y-1">
        <img src="/nkb-logo.png" alt="NKB Logo" className="w-full h-16 object-contain drop-shadow-md" />
        <span className="text-[10px] uppercase font-mono tracking-widest text-blue-400 font-bold">
          Manufacturing MES
        </span>
      </div>

      {/* User Role Badge */}
      <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between text-xs">
        <div>
          <p className="font-bold text-white truncate max-w-[140px]">{user?.firstName} {user?.lastName}</p>
          <p className="text-[10px] text-blue-400 font-semibold">{user?.role || 'Compounding Operator'}</p>
        </div>
        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1 text-sm font-medium">
        {/* OPERATOR PORTAL NAVIGATION */}
        {isOperator ? (
          <>
            <button
              onClick={() => setCurrentPage('operator-dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isCurrent('operator-dashboard')
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-slate-400" />
              <span>Operator Dashboard</span>
            </button>

            <button
              onClick={() => setCurrentPage('operator-qr-scanner')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isCurrent('operator-qr-scanner')
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <QrCode className="w-4 h-4 text-slate-400" />
              <span>Scan Formula QR</span>
            </button>

            <button
              onClick={() => setCurrentPage('operator-compounding-screen')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isCurrent('operator-compounding-screen')
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Play className="w-4 h-4 text-slate-400" />
              <span>Active Compounding</span>
            </button>

            <button
              onClick={() => setCurrentPage('operator-history')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isCurrent('operator-history')
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <History className="w-4 h-4 text-slate-400" />
              <span>Production History</span>
            </button>
          </>
        ) : (
          /* ADMIN & CHEMIST NAVIGATION */
          <>
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

            {/* Materials Parent */}
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

            {/* Formulations Parent */}
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
                    onClick={() => setCurrentPage('formulation-cosmetic')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors text-xs ${
                      isCurrent('formulation-cosmetic')
                        ? 'bg-slate-800 text-blue-400 font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    <FlaskConical className="w-3.5 h-3.5 text-slate-400" />
                    <span>Cosmetic Workspace</span>
                  </button>
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
                    onClick={() => setCurrentPage('formula-versions')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors text-xs ${
                      isCurrent('formula-versions')
                        ? 'bg-slate-800 text-blue-400 font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    <History className="w-3.5 h-3.5 text-slate-400" />
                    <span>Formula Versions</span>
                  </button>
                  <button
                    onClick={() => setCurrentPage('formula-comparison')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors text-xs ${
                      isCurrent('formula-comparison')
                        ? 'bg-slate-800 text-blue-400 font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    <GitCompare className="w-3.5 h-3.5 text-slate-400" />
                    <span>Formula Comparison</span>
                  </button>
                </div>
              )}
            </div>

            {/* Production Parent */}
            <div>
              <button
                onClick={() => setProductionOpen(!productionOpen)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Play className="w-4 h-4 text-slate-400" />
                  <span>Production MES</span>
                </div>
                {productionOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
              </button>
              {productionOpen && (
                <div className="ml-4 pl-3 border-l border-slate-800 mt-1 space-y-1">
                  <button
                    onClick={() => setCurrentPage('batch-calculator')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors text-xs ${
                      isCurrent('batch-calculator')
                        ? 'bg-slate-800 text-blue-400 font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    <Calculator className="w-3.5 h-3.5 text-slate-400" />
                    <span>Batch Calculator</span>
                  </button>
                  <button
                    onClick={() => setCurrentPage('operator-dashboard')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors text-xs ${
                      isCurrent('operator-dashboard')
                        ? 'bg-slate-800 text-blue-400 font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5 text-slate-400" />
                    <span>Compounding Portal</span>
                  </button>
                </div>
              )}
            </div>

            {/* Quality Hub */}
            <button
              onClick={() => setCurrentPage('qc-inspection')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isCurrent('qc-inspection')
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-slate-400" />
              <span>Quality Control Hub</span>
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
          </>
        )}
      </nav>

      {/* Scope Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/60 text-xs text-slate-400 space-y-1">
        <p className="font-semibold text-slate-300">Cosmetics Formulation MES</p>
        <p className="text-[10px] leading-tight text-slate-400">
          Strictly Formulation & Compounding MES. No ERP logic.
        </p>
      </div>
    </aside>
  );
}

export default Sidebar;
