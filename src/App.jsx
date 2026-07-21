import React, { useState } from 'react';
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
import { ReportsPage } from './pages/ReportsPage';
import { UsersRolesPage } from './pages/UsersRolesPage';
import { SettingsPage } from './pages/SettingsPage';

import { CreateFormulaPage } from './pages/CreateFormulaPage';

export function App() {
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');

  if (!user) {
    return <LoginPage />;
  }

  const getPageTitle = () => {
    switch (currentPage) {
      case 'dashboard': return { title: 'Dashboard', subtitle: 'Formulation Metrics & Activity Overview' };
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
      case 'reports': return { title: 'Reports', subtitle: 'PDF & Excel export hub' };
      case 'users-roles': return { title: 'Users & Roles', subtitle: 'Role-Based Access Control' };
      case 'settings': return { title: 'Settings', subtitle: 'Tolerances & Precision Settings' };
      default: return { title: 'NKB Formulation Management System', subtitle: '' };
    }
  };

  const { title, subtitle } = getPageTitle();

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900 font-sans">
      <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header title={title} subtitle={subtitle} />
        <main className="flex-1 overflow-y-auto">
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
          {currentPage === 'reports' && <ReportsPage />}
          {currentPage === 'users-roles' && <UsersRolesPage />}
          {currentPage === 'settings' && <SettingsPage />}
        </main>
      </div>
    </div>
  );
}

export default App;
