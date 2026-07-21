import React from 'react';

export function StatusBadge({ status }) {
  const styles = {
    DRAFT: 'bg-slate-100 text-slate-700 border-slate-300',
    UNDER_REVIEW: 'bg-amber-50 text-amber-800 border-amber-300',
    FOR_APPROVAL: 'bg-indigo-50 text-indigo-800 border-indigo-300',
    APPROVED: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    REJECTED: 'bg-rose-50 text-rose-800 border-rose-300',
    SUPERSEDED: 'bg-slate-100 text-slate-500 border-slate-300 line-through',
    ACTIVE: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    ARCHIVED: 'bg-slate-100 text-slate-500 border-slate-300',
    CALCULATED: 'bg-sky-50 text-sky-800 border-sky-300',
    INFEASIBLE: 'bg-rose-50 text-rose-800 border-rose-300 font-bold',
    COMPLETED: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
        styles[status] || 'bg-slate-100 text-slate-700 border-slate-300'
      }`}
    >
      {status ? status.replace(/_/g, ' ') : 'N/A'}
    </span>
  );
}
