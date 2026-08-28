import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, ShieldCheck, Bell, FileText, ChevronRight, CheckCircle2, Clock } from 'lucide-react';

export function Header({ title, subtitle, setCurrentPage }) {
  const { user, logout } = useAuth();

  const [pendingCount, setPendingCount] = useState(0);
  const [recentPending, setRecentPending] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('nkb_access_token');
      if (!token) return;

      const res = await fetch('/api/v1/sample-requests/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPendingCount(data.pendingCount || 0);
        setRecentPending(data.recentPending || []);
      }
    } catch (err) {
      console.error('Error polling notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(() => {
      fetchNotifications();
    }, 12000); // Poll every 12 seconds for live real-time notifications

    return () => clearInterval(interval);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenRequestList = () => {
    setDropdownOpen(false);
    if (setCurrentPage) {
      setCurrentPage('sample-requests-list');
    }
  };

  return (
    <header className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      <div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* NOTIFICATION BELL WITH PENDING SAMPLE REQUEST BADGE */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className={`relative p-2 rounded-xl border transition flex items-center justify-center ${
              dropdownOpen
                ? 'bg-blue-50 border-blue-300 text-blue-600'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
            title="Sample Request Notifications"
          >
            <Bell className="w-5 h-5" />

            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-md animate-pulse">
                {pendingCount > 99 ? '99+' : pendingCount}
              </span>
            )}
          </button>

          {/* NOTIFICATIONS DROPDOWN MENU */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-slate-200 shadow-2xl z-50 overflow-hidden font-sans">
              {/* Header */}
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider">Sample Request Alerts</h3>
                </div>
                {pendingCount > 0 ? (
                  <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-full text-[10px] font-bold">
                    {pendingCount} Pending
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-[10px] font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> All Clear
                  </span>
                )}
              </div>

              {/* Notification Items List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {recentPending.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                    <p className="font-semibold text-slate-800">No Pending Sample Requests</p>
                    <p className="text-[11px] text-slate-400">All submitted sample requests have been reviewed.</p>
                  </div>
                ) : (
                  recentPending.map((item) => (
                    <div
                      key={item.id}
                      onClick={handleOpenRequestList}
                      className="p-3.5 hover:bg-blue-50/70 transition cursor-pointer flex items-start gap-3 group"
                    >
                      <div className="p-2 bg-blue-100 text-blue-700 rounded-xl shrink-0 group-hover:bg-blue-600 group-hover:text-white transition">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="text-xs font-extrabold text-blue-700 group-hover:text-blue-900 truncate">
                            {item.request_code}
                          </span>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1 shrink-0 font-medium">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {item.request_date || new Date(item.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {item.company_name || 'Client Request'}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          Product: {item.product_name || 'Unspecified'} • By: {item.requested_by_name || 'MSM'}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 self-center shrink-0" />
                    </div>
                  ))
                )}
              </div>

              {/* Dropdown Footer Action */}
              <div className="p-3 bg-slate-50 border-t border-slate-200 text-center">
                <button
                  type="button"
                  onClick={handleOpenRequestList}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-400" />
                  View All Sample Requests
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Info Badge */}
        {user && (
          <div className="flex items-center gap-3 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
            <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs">
              {user.firstName ? user.firstName[0] : 'U'}
            </div>
            <div className="text-xs text-left hidden sm:block">
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

        {/* Logout Button */}
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
