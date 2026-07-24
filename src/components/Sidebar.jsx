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
  Building2,
  ChevronDown,
  ChevronRight,
  PlusCircle,
  ListFilter,
  ShieldCheck,
  QrCode,
  Play,
  Activity,
  GitBranch,
  Menu,
  X,
  LogOut,
  MoreHorizontal,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Sidebar({ currentPage, setCurrentPage }) {
  const { user, logout } = useAuth();
  const [materialsOpen, setMaterialsOpen] = useState(true);
  const [formulationsOpen, setFormulationsOpen] = useState(true);
  const [productionOpen, setProductionOpen] = useState(true);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  const isCurrent = (page) => currentPage === page;
  const isOperator = user?.role === 'Compounding Operator';

  const handleMobileNav = (page) => {
    setCurrentPage(page);
    setMobileMoreOpen(false);
  };

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. DESKTOP VIEW SIDEBAR (Visible on lg size and larger) */}
      {/* ========================================================================= */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex-col h-screen select-none shrink-0 text-slate-300 lg:flex hidden">
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
          {isOperator ? (
            /* OPERATOR PORTAL NAVIGATION */
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
                    <button
                      onClick={() => setCurrentPage('create-vendor')}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors text-xs ${
                        isCurrent('create-vendor')
                          ? 'bg-slate-800 text-blue-400 font-semibold'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>Create Vendor</span>
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

      {/* ========================================================================= */}
      {/* 2. RESPONSIVE MOBILE NAVIGATION BAR (Fixed at bottom on mobile views) */}
      {/* ========================================================================= */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 z-50 flex lg:hidden justify-around items-center px-2 select-none shadow-xl">
        {/* Tab 1: Home / Dashboard */}
        <button
          onClick={() => handleMobileNav(isOperator ? 'operator-dashboard' : 'dashboard')}
          className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition ${
            isCurrent('dashboard') || isCurrent('operator-dashboard') ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[9px] mt-1 truncate">Dashboard</span>
        </button>

        {/* Tab 2: Materials / QR Scanner */}
        <button
          onClick={() => handleMobileNav(isOperator ? 'operator-qr-scanner' : 'materials-list')}
          className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition ${
            isCurrent('materials-list') || isCurrent('operator-qr-scanner') ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {isOperator ? <QrCode className="w-5 h-5" /> : <Boxes className="w-5 h-5" />}
          <span className="text-[9px] mt-1 truncate">{isOperator ? 'Scan QR' : 'Materials'}</span>
        </button>

        {/* Tab 3: Formulations Workspace / Compounding Screen */}
        <button
          onClick={() => handleMobileNav(isOperator ? 'operator-compounding-screen' : 'formulation-cosmetic')}
          className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition ${
            isCurrent('formulation-cosmetic') || isCurrent('operator-compounding-screen') ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {isOperator ? <Play className="w-5 h-5" /> : <FlaskConical className="w-5 h-5" />}
          <span className="text-[9px] mt-1 truncate">{isOperator ? 'Compounding' : 'Workspace'}</span>
        </button>

        {/* Tab 4: Production MES / History */}
        <button
          onClick={() => handleMobileNav(isOperator ? 'operator-history' : 'batch-calculator')}
          className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition ${
            isCurrent('batch-calculator') || isCurrent('operator-history') ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {isOperator ? <History className="w-5 h-5" /> : <Calculator className="w-5 h-5" />}
          <span className="text-[9px] mt-1 truncate">{isOperator ? 'History' : 'Batch Math'}</span>
        </button>

        {/* Tab 5: More Menu Button */}
        <button
          onClick={() => setMobileMoreOpen(true)}
          className="flex flex-col items-center justify-center w-12 h-12 rounded-xl text-slate-400 hover:text-slate-200"
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-[9px] mt-1 truncate">More</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 3. MOBILE MENU OVERLAY / BOTTOM DRAWER */}
      {/* ========================================================================= */}
      {mobileMoreOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-55 flex flex-col justify-end lg:hidden transition-all duration-300">
          {/* Backdrop Closer */}
          <div className="flex-1" onClick={() => setMobileMoreOpen(false)} />

          {/* Bottom Sheet Drawer */}
          <div className="bg-slate-900 border-t border-slate-800 rounded-t-3xl max-h-[75vh] overflow-y-auto p-6 space-y-6 shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-blue-400 border border-slate-700">
                  {user?.firstName ? user.firstName[0] : 'U'}
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">{user?.firstName} {user?.lastName}</h3>
                  <p className="text-[10px] text-slate-400">{user?.role || 'Viewer'}</p>
                </div>
              </div>
              <button
                onClick={() => setMobileMoreOpen(false)}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Links List */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {!isOperator && (
                <>
                  <button
                    onClick={() => handleMobileNav('create-formula')}
                    className="flex flex-col items-center justify-center p-4 bg-slate-850 hover:bg-slate-800 rounded-2xl text-slate-300 hover:text-white border border-slate-800 transition"
                  >
                    <PlusCircle className="w-6 h-6 text-blue-400 mb-2" />
                    <span className="text-xs font-semibold">New Formula</span>
                  </button>

                  <button
                    onClick={() => handleMobileNav('formula-versions')}
                    className="flex flex-col items-center justify-center p-4 bg-slate-850 hover:bg-slate-800 rounded-2xl text-slate-300 hover:text-white border border-slate-800 transition"
                  >
                    <History className="w-6 h-6 text-indigo-400 mb-2" />
                    <span className="text-xs font-semibold">Versions Log</span>
                  </button>

                  <button
                    onClick={() => handleMobileNav('formula-comparison')}
                    className="flex flex-col items-center justify-center p-4 bg-slate-850 hover:bg-slate-800 rounded-2xl text-slate-300 hover:text-white border border-slate-800 transition"
                  >
                    <GitCompare className="w-6 h-6 text-amber-400 mb-2" />
                    <span className="text-xs font-semibold">Comparison</span>
                  </button>

                  <button
                    onClick={() => handleMobileNav('create-material')}
                    className="flex flex-col items-center justify-center p-4 bg-slate-850 hover:bg-slate-800 rounded-2xl text-slate-300 hover:text-white border border-slate-800 transition"
                  >
                    <PlusCircle className="w-6 h-6 text-emerald-400 mb-2" />
                    <span className="text-xs font-semibold">New Material</span>
                  </button>

                  <button
                    onClick={() => handleMobileNav('qc-inspection')}
                    className="flex flex-col items-center justify-center p-4 bg-slate-850 hover:bg-slate-800 rounded-2xl text-slate-300 hover:text-white border border-slate-800 transition"
                  >
                    <ShieldCheck className="w-6 h-6 text-emerald-500 mb-2" />
                    <span className="text-xs font-semibold">QC Hub</span>
                  </button>

                  <button
                    onClick={() => handleMobileNav('reports')}
                    className="flex flex-col items-center justify-center p-4 bg-slate-850 hover:bg-slate-800 rounded-2xl text-slate-300 hover:text-white border border-slate-800 transition"
                  >
                    <FileSpreadsheet className="w-6 h-6 text-blue-500 mb-2" />
                    <span className="text-xs font-semibold">Reports</span>
                  </button>

                  <button
                    onClick={() => handleMobileNav('users-roles')}
                    className="flex flex-col items-center justify-center p-4 bg-slate-850 hover:bg-slate-800 rounded-2xl text-slate-300 hover:text-white border border-slate-800 transition"
                  >
                    <Users className="w-6 h-6 text-purple-400 mb-2" />
                    <span className="text-xs font-semibold">Users & Roles</span>
                  </button>

                  <button
                    onClick={() => handleMobileNav('settings')}
                    className="flex flex-col items-center justify-center p-4 bg-slate-850 hover:bg-slate-800 rounded-2xl text-slate-300 hover:text-white border border-slate-800 transition"
                  >
                    <Settings className="w-6 h-6 text-slate-400 mb-2" />
                    <span className="text-xs font-semibold">Settings</span>
                  </button>
                </>
              )}
            </div>

            {/* Logout Action */}
            <div className="pt-4 border-t border-slate-800">
              <button
                onClick={() => {
                  setMobileMoreOpen(false);
                  logout();
                }}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm rounded-2xl transition shadow-lg active:scale-95"
              >
                <LogOut className="w-5 h-5" />
                <span>Log Out of Session</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Sidebar;
