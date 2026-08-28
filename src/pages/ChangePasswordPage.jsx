import React, { useState } from 'react';
import { Lock, KeyRound, CheckCircle, AlertCircle, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ChangePasswordPage() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    if (!currentPassword) {
      setErrorMsg('Current password is required.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('New password and confirm password do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('nkb_access_token');
      const res = await fetch('/api/v1/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to change password.');
      }

      setSuccessMsg('Your password has been changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-xl mx-auto space-y-6">
      {/* Header Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
        <div className="p-3 bg-blue-100 text-blue-700 rounded-2xl shrink-0">
          <KeyRound className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Change Password</h1>
          <p className="text-xs text-slate-500">
            Update your login credentials for account <span className="font-semibold text-slate-700">{user?.username}</span>
          </p>
        </div>
      </div>

      {/* Status Alerts */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Change Password Form */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
        {/* Current Password */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Current Password</label>
          <div className="relative">
            <input
              type={showCurrent ? 'text' : 'password'}
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter your existing password"
              className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            />
            <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
            >
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* New Password */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">New Password</label>
          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password (min 6 characters)"
              className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            />
            <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
            >
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Confirm New Password */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Confirm New Password</label>
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password to confirm"
              className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            />
            <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
            >
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
          >
            <KeyRound className="w-4 h-4" />
            {isSubmitting ? 'Updating Password...' : 'Update Password'}
          </button>
        </div>
      </form>
    </div>
  );
}
