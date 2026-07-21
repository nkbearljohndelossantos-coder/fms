import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, ShieldCheck } from 'lucide-react';

export function Header({ title, subtitle }) {
  const { user, logout } = useAuth();

  return (
    <header className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      <div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-3 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
            <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs">
              {user.firstName ? user.firstName[0] : 'U'}
            </div>
            <div className="text-xs text-left">
              <p className="font-semibold text-slate-900 leading-none">{user.firstName} {user.lastName}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <ShieldCheck className="w-3 h-3 text-slate-600" />
                <span className="text-[10px] text-slate-600 font-medium">
                  {user.roles && user.roles.length > 0 ? user.roles[0] : 'Viewer'}
                </span>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={logout}
          title="Logout"
          className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
