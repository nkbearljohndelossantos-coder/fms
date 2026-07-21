import React, { useEffect, useState } from 'react';
import { Users, UserPlus, Check, X } from 'lucide-react';
import { apiFetch } from '../services/api';

export function UsersRolesPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    roleIds: [2],
  });

  useEffect(() => {
    fetchUsers();
    apiFetch('/api/v1/users/roles')
      .then(r => r.json())
      .then(d => d.success && setRoles(d.data));
  }, []);

  const fetchUsers = () => {
    apiFetch('/api/v1/users')
      .then(r => r.json())
      .then(d => d.success && setUsers(d.data));
  };

  const handleCreateUser = (e) => {
    e.preventDefault();
    apiFetch('/api/v1/users', {
      method: 'POST',
      body: JSON.stringify(formData),
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          alert('User created successfully!');
          setShowCreateModal(false);
          fetchUsers();
        } else {
          alert(`Error: ${d.message}`);
        }
      });
  };

  const toggleStatus = (userId, currentActive) => {
    apiFetch(`/api/v1/users/${userId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ isActive: !currentActive }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          fetchUsers();
        } else {
          alert(`Error: ${d.message}`);
        }
      });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-700" /> Users & Role-Based Access Control (RBAC)
          </h1>
          <p className="text-xs text-slate-500">Manage user accounts and assign roles: Super Admin, Formulator, Reviewer, Approver, Viewer.</p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" /> Create User
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 uppercase">
              <tr>
                <th className="p-3.5">User</th>
                <th className="p-3.5">Email</th>
                <th className="p-3.5">Assigned Roles</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-center">Toggle Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="p-3.5">
                    <p className="font-bold text-slate-900">{u.first_name} {u.last_name}</p>
                    <p className="text-[11px] text-slate-500 font-mono">@{u.username}</p>
                  </td>
                  <td className="p-3.5 font-mono text-slate-700">{u.email}</td>
                  <td className="p-3.5">
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map(r => (
                        <span key={r.id} className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300 font-semibold text-[10px]">
                          {r.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-3.5">
                    {u.is_active ? (
                      <span className="text-emerald-700 font-bold flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Active</span>
                    ) : (
                      <span className="text-rose-700 font-bold flex items-center gap-1"><X className="w-3.5 h-3.5" /> Inactive</span>
                    )}
                  </td>
                  <td className="p-3.5 text-center">
                    <button
                      onClick={() => toggleStatus(u.id, u.is_active)}
                      className={`px-3 py-1 rounded text-[11px] font-semibold border ${u.is_active ? 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'}`}
                    >
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateUser} className="bg-white p-6 rounded-2xl w-full max-w-md border border-slate-200 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-3">Create User Account</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 mb-1">Username *</label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={e => setFormData({ ...formData, username: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded p-2 text-slate-900"
                />
              </div>
              <div>
                <label className="block text-slate-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded p-2 text-slate-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded p-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded p-2 text-slate-900"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-700 mb-1">Password *</label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded p-2 text-slate-900"
                />
              </div>
              <div>
                <label className="block text-slate-700 mb-1">Assign Role *</label>
                <select
                  value={formData.roleIds[0]}
                  onChange={e => setFormData({ ...formData, roleIds: [Number(e.target.value)] })}
                  className="w-full bg-white border border-slate-300 rounded p-2 text-slate-900 font-bold"
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.description})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold">
                Create User
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
