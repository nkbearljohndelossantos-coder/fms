import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';

import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { MaterialsListPage } from './pages/MaterialsListPage';
import { CreateMaterialPage } from './pages/CreateMaterialPage';
import { CosmeticFormulatorPage } from './pages/CosmeticFormulatorPage';
import { PerfumeNoBrandPage } from './pages/PerfumeNoBrandPage';
import { PerfumeBrandPage } from './pages/PerfumeBrandPage';
import { FoodSupplementPage } from './pages/FoodSupplementPage';
import { BatchCalculatorPage } from './pages/BatchCalculatorPage';
import { FormulaVersionsPage } from './pages/FormulaVersionsPage';
import { FormulaComparisonPage } from './pages/FormulaComparisonPage';
import { QualityControlPage } from './pages/QualityControlPage';
import { ReportsPage } from './pages/ReportsPage';
import { UsersRolesPage } from './pages/UsersRolesPage';
import { SettingsPage } from './pages/SettingsPage';
import { CreateFormulaPage } from './pages/CreateFormulaPage';

// Compounding Operator Portal Pages
import { OperatorDashboardPage } from './pages/operator/OperatorDashboardPage';
import { OperatorQRScannerPage } from './pages/operator/OperatorQRScannerPage';
import { OperatorFormulaViewPage } from './pages/operator/OperatorFormulaViewPage';
import { OperatorCompoundingScreen } from './pages/operator/OperatorCompoundingScreen';
import { OperatorHistoryPage } from './pages/operator/OperatorHistoryPage';

import { ShieldAlert } from 'lucide-react';

export function App() {
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [selectedBatchId, setSelectedBatchId] = useState(1);

  useEffect(() => {
    if (user) {
      if (user.role === 'Compounding Operator') {
        setCurrentPage('operator-dashboard');
      } else if (user.role === 'QC Specialist') {
        setCurrentPage('qc-inspection');
      } else if (user.role === 'Formulation Chemist') {
        setCurrentPage('create-formula');
      } else {
        setCurrentPage('dashboard');
      }
    }
  }, [user]);

  if (!user) {
    return <LoginPage />;
  }

  const isOperator = user.role === 'Compounding Operator';
  const operatorAllowedPages = [
    'operator-dashboard',
    'operator-qr-scanner',
    'operator-formula-view',
    'operator-compounding-screen',
    'operator-history',
  ];

  const isDenied = isOperator && !operatorAllowedPages.includes(currentPage);

  const getPageTitle = () => {
    switch (currentPage) {
      case 'dashboard': return { title: 'Dashboard', subtitle: 'Manufacturing KPIs & Formulation Overview' };
      case 'materials-list': return { title: 'Material Master List', subtitle: 'Raw Material Ingredients' };
      case 'create-material': return { title: 'Create Material', subtitle: 'New Master Ingredient Entry' };
      case 'create-formula': return { title: 'Create Formula', subtitle: 'New Master Formulation Entry' };
      case 'formulation-cosmetic': return { title: 'Cosmetic Formulation', subtitle: 'Phase A-C, pH & Viscosity Specs' };
      case 'formulation-perfume-no-brand': return { title: 'Perfume – No Brand', subtitle: 'Generic Base & Maceration Controls' };
      case 'formulation-perfume-brand': return { title: 'Perfume – Brand', subtitle: 'Brand Formula & Conversion Engine' };
      case 'formulation-supplement': return { title: 'Food Supplement', subtitle: 'Capsules, Tablets & q.s. Math' };
      case 'batch-calculator': return { title: 'Batch Calculator', subtitle: 'Density-Aware Target Batch Scaling' };
      case 'formula-versions': return { title: 'Formula Versions', subtitle: 'Version Lineage & Read-Only Locks' };
      case 'formula-comparison': return { title: 'Formula Comparison', subtitle: 'Side-by-Side Version Diff Tool' };
      case 'qc-inspection': return { title: 'Quality Control Hub', subtitle: 'QC Inspection & Batch Release Sign-Off' };
      case 'operator-dashboard': return { title: 'Compounding Portal', subtitle: 'Shop-Floor Production Execution Station' };
      case 'operator-qr-scanner': return { title: 'QR Scanner', subtitle: 'Formula & Batch QR Code Verification' };
      case 'operator-formula-view': return { title: 'Formula View', subtitle: 'Approved Formulation Specs & Safety Protocols' };
      case 'operator-compounding-screen': return { title: 'MES Step Execution', subtitle: 'Live Scale Weighing & Step Confirmation' };
      case 'operator-history': return { title: 'Production History', subtitle: 'Signed Audit Logs & Execution History' };
      case 'reports': return { title: 'Reports', subtitle: 'PDF & Excel export hub' };
      case 'users-roles': return { title: 'Users & Roles', subtitle: 'Role-Based Access Control' };
      case 'settings': return { title: 'Settings', subtitle: 'Tolerances & Precision Settings' };
      default: return { title: 'Enterprise Formulation Management System', subtitle: '' };
    }
  };

  const { title, subtitle } = getPageTitle();

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-slate-50 text-slate-900 font-sans">
      {/* Dark Sidebar Only */}
      <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />

      {/* Light Theme Main Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        <Header title={title} subtitle={subtitle} />
        <main className="flex-1 overflow-y-auto bg-slate-50 text-slate-900 pb-20 lg:pb-0">
          {isDenied ? (
            <div className="p-8 max-w-xl mx-auto mt-12 text-center space-y-4">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center mx-auto">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Access Denied (HTTP 403 Forbidden)</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Compounding Operators are barred from accessing R&D Formulation Master Data, Material Master, Costing, Settings, or User Management.
              </p>
              <button
                onClick={() => setCurrentPage('operator-dashboard')}
                className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition"
              >
                Return to Compounding Dashboard
              </button>
            </div>
          ) : (
            <>
              {currentPage === 'dashboard' && <DashboardPage setCurrentPage={setCurrentPage} />}
              {currentPage === 'materials-list' && <MaterialsListPage setCurrentPage={setCurrentPage} />}
              {currentPage === 'create-material' && <CreateMaterialPage setCurrentPage={setCurrentPage} />}
              {currentPage === 'create-formula' && <CreateFormulaPage setCurrentPage={setCurrentPage} />}
              {currentPage === 'formulation-cosmetic' && <CosmeticFormulatorPage setCurrentPage={setCurrentPage} />}
              {currentPage === 'formulation-perfume-no-brand' && <PerfumeNoBrandPage setCurrentPage={setCurrentPage} />}
              {currentPage === 'formulation-perfume-brand' && <PerfumeBrandPage setCurrentPage={setCurrentPage} />}
              {currentPage === 'formulation-supplement' && <FoodSupplementPage setCurrentPage={setCurrentPage} />}
              {currentPage === 'batch-calculator' && <BatchCalculatorPage setCurrentPage={setCurrentPage} />}
              {currentPage === 'formula-versions' && <FormulaVersionsPage setCurrentPage={setCurrentPage} />}
              {currentPage === 'formula-comparison' && <FormulaComparisonPage setCurrentPage={setCurrentPage} />}
              {currentPage === 'qc-inspection' && <QualityControlPage />}

              {/* Operator Portal Views */}
              {currentPage === 'operator-dashboard' && (
                <OperatorDashboardPage setCurrentPage={setCurrentPage} setSelectedBatchId={setSelectedBatchId} />
              )}
              {currentPage === 'operator-qr-scanner' && (
                <OperatorQRScannerPage setCurrentPage={setCurrentPage} setSelectedBatchId={setSelectedBatchId} />
              )}
              {currentPage === 'operator-formula-view' && (
                <OperatorFormulaViewPage setCurrentPage={setCurrentPage} batchId={selectedBatchId} setSelectedBatchId={setSelectedBatchId} />
              )}
              {currentPage === 'operator-compounding-screen' && (
                <OperatorCompoundingScreen setCurrentPage={setCurrentPage} batchId={selectedBatchId} />
              )}
              {currentPage === 'operator-history' && (
                <OperatorHistoryPage />
              )}

              {currentPage === 'reports' && <ReportsPage />}
              {currentPage === 'users-roles' && <UsersRolesPage />}
              {currentPage === 'settings' && <SettingsPage />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
