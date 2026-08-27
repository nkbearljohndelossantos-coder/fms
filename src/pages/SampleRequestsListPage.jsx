import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Eye,
  Printer,
  Clock,
  Building,
  User,
  Plus,
  RefreshCw,
  AlertCircle,
  X,
} from 'lucide-react';
import { printSampleRequestForm } from '../utils/printSampleRequestForm';
import { useAuth } from '../context/AuthContext';

export default function SampleRequestsListPage({ setCurrentPage }) {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [declineTargetId, setDeclineTargetId] = useState(null);

  const fetchRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('nkb_access_token');
      const res = await fetch(`/api/v1/sample-requests?status=${statusFilter}&search=${encodeURIComponent(search)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch sample requests.');
      }
      setRequests(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [statusFilter, search]);

  const handleApprove = async (id) => {
    if (!window.confirm('Are you sure you want to APPROVE this Sample Request?')) return;
    try {
      const token = localStorage.getItem('nkb_access_token');
      const res = await fetch(`/api/v1/sample-requests/${id}/approve`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to approve sample request.');
      }
      fetchRequests();
    } catch (err) {
      alert(`Approval Error: ${err.message}`);
    }
  };

  const handleOpenDeclineModal = (id) => {
    setDeclineTargetId(id);
    setDeclineReason('');
    setDeclineModalOpen(true);
  };

  const handleConfirmDecline = async () => {
    if (!declineTargetId) return;
    try {
      const token = localStorage.getItem('nkb_access_token');
      const res = await fetch(`/api/v1/sample-requests/${declineTargetId}/decline`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ declineReason }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to decline sample request.');
      }
      setDeclineModalOpen(false);
      fetchRequests();
    } catch (err) {
      alert(`Decline Error: ${err.message}`);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full font-bold text-[10px] flex items-center gap-1 w-max">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            APPROVED
          </span>
        );
      case 'DECLINED':
        return (
          <span className="px-2.5 py-1 bg-rose-100 text-rose-800 border border-rose-300 rounded-full font-bold text-[10px] flex items-center gap-1 w-max">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            DECLINED
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 bg-amber-100 text-amber-800 border border-amber-300 rounded-full font-bold text-[10px] flex items-center gap-1 w-max">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            PENDING
          </span>
        );
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <FileText className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Sample Requests Repository</h1>
              <p className="text-xs text-slate-500">Client Product Sample Request Specifications & Approval Workflow</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchRequests()}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
            title="Refresh List"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {setCurrentPage && (
            <button
              type="button"
              onClick={() => setCurrentPage('sample-request-form')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              New Sample Request
            </button>
          )}
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search code, company, product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
          {['ALL', 'PENDING', 'APPROVED', 'DECLINED'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-md transition ${
                statusFilter === st ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Requests Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs font-medium">Loading sample requests...</div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs font-medium space-y-2">
            <FileText className="w-8 h-8 mx-auto text-slate-300" />
            <p>No sample requests found matching filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Code / Date</th>
                  <th className="py-3 px-4">Client Company</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Classification</th>
                  <th className="py-3 px-4">Requested By</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-900">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-blue-700">{r.request_code}</div>
                      <div className="text-[10px] text-slate-400">{r.request_date}</div>
                    </td>
                    <td className="py-3 px-4 font-bold">{r.company_name || '—'}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{r.product_name || '—'}</td>
                    <td className="py-3 px-4">{r.product_classification}</td>
                    <td className="py-3 px-4 text-slate-600">{r.requested_by_name || 'MSM'}</td>
                    <td className="py-3 px-4">{getStatusBadge(r.status)}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* View Request Modal */}
                        <button
                          type="button"
                          onClick={() => setSelectedRequest(r)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                          title="View Request Specifications"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Print PDF */}
                        <button
                          type="button"
                          onClick={() => printSampleRequestForm(r)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                          title="Print / Save PDF"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        {/* Approve Button */}
                        {r.status === 'PENDING' && (
                          <button
                            type="button"
                            onClick={() => handleApprove(r.id)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] shadow-2xs transition flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Approve
                          </button>
                        )}

                        {/* Decline Button */}
                        {r.status === 'PENDING' && (
                          <button
                            type="button"
                            onClick={() => handleOpenDeclineModal(r.id)}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[11px] shadow-2xs transition flex items-center gap-1"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Decline
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* VIEW REQUEST DETAILS MODAL */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm">Sample Request Details — {selectedRequest.request_code}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h4 className="text-base font-extrabold text-slate-900">{selectedRequest.product_name}</h4>
                  <p className="text-slate-500 font-semibold">{selectedRequest.company_name} • {selectedRequest.product_classification}</p>
                </div>
                <div>{getStatusBadge(selectedRequest.status)}</div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl">
                <div>
                  <span className="text-slate-400 block font-bold text-[10px]">CONTACT PERSON</span>
                  <span className="font-bold text-slate-900">{selectedRequest.contact_person || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold text-[10px]">BENCHMARK</span>
                  <span className="font-bold text-slate-900">{selectedRequest.benchmark || '—'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 block font-bold text-[10px]">ADDRESS</span>
                  <span className="text-slate-800">{selectedRequest.address || '—'}</span>
                </div>
              </div>

              <div className="space-y-2">
                <h5 className="font-extrabold text-slate-900 uppercase">Product Specifications</h5>
                <div className="grid grid-cols-2 gap-2 text-slate-800 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div><strong>Raw Materials:</strong> {selectedRequest.specific_raw_materials || '—'}</div>
                  <div><strong>Texture:</strong> {selectedRequest.texture || '—'}</div>
                  <div><strong>Form:</strong> {selectedRequest.form || '—'}</div>
                  <div><strong>Scent:</strong> {selectedRequest.scent_aroma_direction || '—'}</div>
                  <div><strong>Color:</strong> {selectedRequest.color_description || '—'}</div>
                  <div><strong>Flavor:</strong> {selectedRequest.flavor || '—'}</div>
                  <div><strong>Claims:</strong> {selectedRequest.function_claims || '—'}</div>
                  <div><strong>Direction:</strong> {selectedRequest.direction_of_use || '—'}</div>
                  <div><strong>Net Content:</strong> {selectedRequest.net_content || '—'}</div>
                  <div><strong>Target Price:</strong> {selectedRequest.target_price || '—'}</div>
                  <div><strong>Special Instructions:</strong> {selectedRequest.special_instructions || '—'}</div>
                  <div><strong>Quantity:</strong> {selectedRequest.quantity || '—'}</div>
                  <div className="col-span-2"><strong>Packaging:</strong> {selectedRequest.primary_packaging || '—'}</div>
                </div>
              </div>

              {selectedRequest.remarks && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
                  <strong>Remarks:</strong> {selectedRequest.remarks}
                </div>
              )}

              {selectedRequest.decline_reason && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900">
                  <strong>Decline Reason:</strong> {selectedRequest.decline_reason}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t flex items-center justify-between">
              <button
                type="button"
                onClick={() => printSampleRequestForm(selectedRequest)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs transition flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                Print Form
              </button>

              <div className="flex items-center gap-2">
                {selectedRequest.status === 'PENDING' && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRequest(null);
                      handleApprove(selectedRequest.id);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition"
                  >
                    Approve Request
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedRequest(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-xs transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DECLINE REASON MODAL */}
      {declineModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2 text-rose-600">
              <XCircle className="w-5 h-5" />
              Decline Sample Request
            </h3>
            <p className="text-xs text-slate-500">Please enter a reason for declining this product sample request:</p>
            <textarea
              rows={3}
              placeholder="Specify reason for decline (e.g., benchmark unavailable, incompatible raw material)..."
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-rose-500"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeclineModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDecline}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-md"
              >
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
