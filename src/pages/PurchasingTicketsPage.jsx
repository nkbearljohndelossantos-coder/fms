import React, { useState, useEffect } from 'react';
import {
  FileText,
  AlertTriangle,
  RotateCcw,
  PauseCircle,
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  Image as ImageIcon,
  MessageSquare,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { apiFetch } from '../services/api';

export function PurchasingTicketsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');

  const [activePortalTab, setActivePortalTab] = useState('rejection-tickets'); // rejection-tickets, item-requests

  // Purchase Requests State
  const [purchaseRequests, setPurchaseRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [requestActionModalOpen, setRequestActionModalOpen] = useState(false);
  const [targetRequestStatus, setTargetRequestStatus] = useState('Approved');
  const [purchasingRemarks, setPurchasingRemarks] = useState('');
  const [submittingRequestAction, setSubmittingRequestAction] = useState(false);

  const [selectedTicket, setSelectedTicket] = useState(null);
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [decisionType, setDecisionType] = useState('RETURN_TO_SUPPLIER'); // RETURN_TO_SUPPLIER, ON_HOLD, QA_BYPASSED
  const [issueCategory, setIssueCategory] = useState('Quality Deficiency / Receiving Rejection');
  const [purchasingNotes, setPurchasingNotes] = useState('');
  const [bypassJustification, setBypassJustification] = useState('');

  const fetchTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (statusFilter !== 'All') queryParams.append('status', statusFilter);
      if (search) queryParams.append('search', search);

      const res = await apiFetch(`/api/v1/inventory/purchasing-tickets?${queryParams.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setTickets(data.data || []);
      } else {
        setError(data.message || 'Failed to fetch purchasing tickets.');
      }
    } catch (err) {
      console.error('Error fetching purchasing tickets:', err);
      setError(err.message || 'Failed to fetch purchasing tickets.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPurchaseRequests = async () => {
    setLoadingRequests(true);
    try {
      const res = await apiFetch('/api/v1/inventory/purchase-requests');
      const data = await res.json();
      if (res.ok && data.success) {
        setPurchaseRequests(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch purchase requests:', err);
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    fetchTickets();
    fetchPurchaseRequests();
  }, [statusFilter]);

  useEffect(() => {
    if (activePortalTab === 'item-requests') {
      fetchPurchaseRequests();
    }
  }, [activePortalTab]);

  const handleOpenRequestActionModal = (reqItem) => {
    setSelectedRequest(reqItem);
    setTargetRequestStatus(reqItem.status === 'Pending Review' ? 'Approved' : reqItem.status);
    setPurchasingRemarks(reqItem.purchasing_remarks || '');
    setRequestActionModalOpen(true);
  };

  const handleUpdateRequestStatus = async (e) => {
    e.preventDefault();
    if (!selectedRequest) return;

    setSubmittingRequestAction(true);
    try {
      const res = await apiFetch(`/api/v1/inventory/purchase-requests/${selectedRequest.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          status: targetRequestStatus,
          purchasing_remarks: purchasingRemarks,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRequestActionModalOpen(false);
        setSelectedRequest(null);
        fetchPurchaseRequests();
        alert(`✅ ${data.message}`);
      } else {
        alert(data.message || 'Failed to update request status.');
      }
    } catch (err) {
      alert(err.message || 'Failed to update request status.');
    } finally {
      setSubmittingRequestAction(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchTickets();
  };

  const handleOpenDecisionModal = (ticket, defaultDecision = 'RETURN_TO_SUPPLIER') => {
    setSelectedTicket(ticket);
    setDecisionType(defaultDecision);
    setIssueCategory(ticket.issue_category || 'Quality Deficiency / Receiving Rejection');
    setPurchasingNotes(ticket.purchasing_notes || '');
    setBypassJustification(ticket.bypass_justification || '');
    setDecisionModalOpen(true);
  };

  const handleSubmitDecision = async (e) => {
    e.preventDefault();
    if (!selectedTicket) return;

    if (decisionType === 'QA_BYPASSED' && !bypassJustification.trim()) {
      alert('QA Bypass requires a mandatory justification note.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/v1/inventory/purchasing-tickets/${selectedTicket.id}/decision`, {
        method: 'POST',
        body: JSON.stringify({
          decision: decisionType,
          issue_category: issueCategory,
          purchasing_notes: purchasingNotes,
          bypass_justification: bypassJustification,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setDecisionModalOpen(false);
        setSelectedTicket(null);
        fetchTickets();
      } else {
        alert(data.message || 'Failed to record purchasing decision.');
      }
    } catch (err) {
      console.error('Error submitting purchasing decision:', err);
      alert(err.message || 'Failed to record purchasing decision.');
    } finally {
      setSubmitting(false);
    }
  };

  // KPI Calculations
  const totalCount = tickets.length;
  const pendingCount = tickets.filter(t => t.status === 'PENDING_PURCHASING_REVIEW').length;
  const rtvCount = tickets.filter(t => t.status === 'RETURN_TO_SUPPLIER').length;
  const holdCount = tickets.filter(t => t.status === 'ON_HOLD').length;
  const bypassCount = tickets.filter(t => t.status === 'QA_BYPASSED').length;

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'PENDING_PURCHASING_REVIEW':
        return (
          <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1 w-max">
            <Clock className="w-3 h-3" /> Pending Purchasing Review
          </span>
        );
      case 'RETURN_TO_SUPPLIER':
        return (
          <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1 w-max">
            <RotateCcw className="w-3 h-3" /> Return to Supplier (RTV)
          </span>
        );
      case 'ON_HOLD':
        return (
          <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1 w-max">
            <PauseCircle className="w-3 h-3" /> On Hold / Investigation
          </span>
        );
      case 'QA_BYPASSED':
        return (
          <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1 w-max">
            <ShieldCheck className="w-3 h-3" /> QA Bypassed / Released
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 w-max">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2.5">
            <Building2 className="w-7 h-7 text-indigo-600" />
            Purchasing Rejection Tickets & Vendor Portal
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Receiving supply rejection reports transmitted from Quality Assurance. Review captioned photos, determine issue cause, and issue Return to Supplier, Hold, or QA Bypass decisions.
          </p>
        </div>

        <button
          onClick={fetchTickets}
          disabled={loading}
          className="p-2 text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition active:scale-95 self-start md:self-auto"
          title="Refresh Tickets"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Portal Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-sm font-bold bg-white px-5 pt-3 rounded-2xl border">
        <button
          onClick={() => setActivePortalTab('rejection-tickets')}
          className={`pb-3 transition flex items-center gap-2 border-b-2 ${
            activePortalTab === 'rejection-tickets'
              ? 'border-slate-800 text-slate-900 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-slate-500" />
          <span>QA Rejection Tickets ({tickets.length})</span>
        </button>

        <button
          onClick={() => setActivePortalTab('item-requests')}
          className={`pb-3 transition flex items-center gap-2 border-b-2 ${
            activePortalTab === 'item-requests'
              ? 'border-slate-800 text-slate-900 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4 text-slate-500" />
          <span>Item Purchase Requisitions ({purchaseRequests.length})</span>
        </button>
      </div>

      {activePortalTab === 'rejection-tickets' && (
        <div className="space-y-6">
          {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Pending Review */}
        <div
          onClick={() => setStatusFilter('PENDING_PURCHASING_REVIEW')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
            statusFilter === 'PENDING_PURCHASING_REVIEW'
              ? 'bg-amber-900 border-amber-900 text-white ring-2 ring-amber-900'
              : 'bg-amber-50/60 border-amber-200 hover:border-amber-300 text-amber-950'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Pending Review</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2">
            <h2 className="text-2xl font-black">{pendingCount}</h2>
            <p className="text-[10px] text-amber-700 mt-0.5 font-medium">Awaiting Purchasing Action</p>
          </div>
        </div>

        {/* Return to Supplier */}
        <div
          onClick={() => setStatusFilter('RETURN_TO_SUPPLIER')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
            statusFilter === 'RETURN_TO_SUPPLIER'
              ? 'bg-rose-900 border-rose-900 text-white ring-2 ring-rose-900'
              : 'bg-rose-50/60 border-rose-200 hover:border-rose-300 text-rose-950'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Return to Supplier</span>
            <RotateCcw className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2">
            <h2 className="text-2xl font-black">{rtvCount}</h2>
            <p className="text-[10px] text-rose-700 mt-0.5 font-medium">Vendor RTV Filed</p>
          </div>
        </div>

        {/* On Hold */}
        <div
          onClick={() => setStatusFilter('ON_HOLD')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
            statusFilter === 'ON_HOLD'
              ? 'bg-blue-900 border-blue-900 text-white ring-2 ring-blue-900'
              : 'bg-blue-50/60 border-blue-200 hover:border-blue-300 text-blue-950'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">On Hold</span>
            <PauseCircle className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2">
            <h2 className="text-2xl font-black">{holdCount}</h2>
            <p className="text-[10px] text-blue-700 mt-0.5 font-medium">Under Investigation</p>
          </div>
        </div>

        {/* QA Bypassed */}
        <div
          onClick={() => setStatusFilter('QA_BYPASSED')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
            statusFilter === 'QA_BYPASSED'
              ? 'bg-purple-900 border-purple-900 text-white ring-2 ring-purple-900'
              : 'bg-purple-50/60 border-purple-200 hover:border-purple-300 text-purple-950'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">QA Bypassed</span>
            <ShieldCheck className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-2">
            <h2 className="text-2xl font-black">{bypassCount}</h2>
            <p className="text-[10px] text-purple-700 mt-0.5 font-medium">Released to Active Stock</p>
          </div>
        </div>

        {/* Total Tickets */}
        <div
          onClick={() => setStatusFilter('All')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
            statusFilter === 'All'
              ? 'bg-slate-900 border-slate-900 text-white ring-2 ring-slate-900'
              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${statusFilter === 'All' ? 'text-slate-400' : 'text-slate-500'}`}>Total Tickets</span>
            <FileText className={`w-4 h-4 ${statusFilter === 'All' ? 'text-slate-300' : 'text-slate-600'}`} />
          </div>
          <div className="mt-2">
            <h2 className="text-2xl font-black">{totalCount}</h2>
            <p className={`text-[10px] mt-0.5 ${statusFilter === 'All' ? 'text-slate-400' : 'text-slate-500'}`}>All Rejection Tickets</p>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search ticket #, material, vendor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </form>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="font-semibold">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="PENDING_PURCHASING_REVIEW">Pending Purchasing Review</option>
              <option value="RETURN_TO_SUPPLIER">Return to Supplier</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="QA_BYPASSED">QA Bypassed</option>
            </select>
          </div>

          <button
            onClick={fetchTickets}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-95"
          >
            Apply Filter
          </button>
        </div>
      </div>

      {/* Tickets List Table */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-medium">Loading purchasing rejection tickets...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-semibold">
          {error}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-3">Ticket #</th>
                  <th className="p-3">Date Filed</th>
                  <th className="p-3">Material Code & Name</th>
                  <th className="p-3">Vendor / Supplier</th>
                  <th className="p-3">Supplier Lot</th>
                  <th className="p-3 text-right">Rejected Qty</th>
                  <th className="p-3">Captioned Photos</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {tickets.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="p-8 text-center text-slate-400 font-semibold">
                      No purchasing rejection tickets found.
                    </td>
                  </tr>
                ) : (
                  tickets.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-indigo-700">{t.ticket_number}</td>
                      <td className="p-3 text-slate-500">
                        {t.created_at ? new Date(t.created_at).toLocaleDateString() : '-'}
                      </td>
                      <td className="p-3">
                        <span className="font-mono text-blue-700 block text-[11px]">{t.material_code}</span>
                        <span className="font-bold text-slate-900">{t.material_name}</span>
                      </td>
                      <td className="p-3 text-slate-700 font-medium">{t.vendor_name || '-'}</td>
                      <td className="p-3 font-mono text-slate-600">{t.supplier_lot_number || '-'}</td>
                      <td className="p-3 text-right font-bold text-rose-700">
                        {parseFloat(t.rejected_quantity || 0).toLocaleString()} {t.uom}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 flex items-center gap-1 w-max">
                          <ImageIcon className="w-3 h-3 text-indigo-600" />
                          {t.attachments.length} Evidence Photo(s)
                        </span>
                      </td>
                      <td className="p-3">{renderStatusBadge(t.status)}</td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => setSelectedTicket(t)}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition active:scale-95 flex items-center gap-1.5 mx-auto"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Review Ticket
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ticket Details & Decision Drawer / Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white rounded-t-3xl">
              <div>
                <span className="text-[10px] font-mono tracking-widest text-indigo-400 font-bold uppercase">
                  Purchasing Ticket
                </span>
                <h2 className="text-xl font-black mt-0.5">{selectedTicket.ticket_number}</h2>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              {/* Ticket Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Material</span>
                  <span className="font-bold text-slate-900">{selectedTicket.material_name} ({selectedTicket.material_code})</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Supplier / Vendor</span>
                  <span className="font-bold text-slate-900">{selectedTicket.vendor_name || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Supplier Lot</span>
                  <span className="font-mono font-bold text-slate-900">{selectedTicket.supplier_lot_number || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Rejected Quantity</span>
                  <span className="font-bold text-rose-700 text-sm">{parseFloat(selectedTicket.rejected_quantity).toLocaleString()} {selectedTicket.uom}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Filed By QA</span>
                  <span className="font-medium text-slate-800">{selectedTicket.rejected_by_first_name} {selectedTicket.rejected_by_last_name}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Current Ticket Status</span>
                  <span className="mt-0.5 block">{renderStatusBadge(selectedTicket.status)}</span>
                </div>
              </div>

              {/* QC Deficiency Reason Box */}
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-1">
                <h4 className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  QC Rejection Reason & Deficiency Detail
                </h4>
                <p className="text-xs text-rose-950 font-medium leading-relaxed">
                  {selectedTicket.qc_rejection_reason}
                </p>
              </div>

              {/* Evidence Pictures & Captions Gallery */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-indigo-600" />
                  Supporting Evidence Photos & Captions ({selectedTicket.attachments.length})
                </h4>

                {selectedTicket.attachments.length === 0 ? (
                  <p className="text-xs text-slate-400 italic bg-slate-50 p-4 rounded-xl text-center">
                    No photo evidence attached to this rejection report.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {selectedTicket.attachments.map((att) => (
                      <div key={att.attachment_id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col space-y-2">
                        <div className="w-full h-40 bg-slate-200 rounded-xl overflow-hidden flex items-center justify-center border border-slate-300">
                          {att.mime_type?.startsWith('image/') ? (
                            <img
                              src={`/api/v1/documents/${att.attachment_id}`}
                              alt={att.filename}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = '';
                                e.target.parentElement.innerHTML = '<span class="text-xs text-slate-400">Photo Preview</span>';
                              }}
                            />
                          ) : (
                            <div className="text-center p-4">
                              <FileText className="w-8 h-8 text-slate-400 mx-auto mb-1" />
                              <span className="text-[10px] text-slate-500 block truncate">{att.filename}</span>
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase">Caption / Evidence Note:</p>
                          <p className="text-xs font-semibold text-slate-900 mt-0.5 bg-white p-2 rounded-lg border border-slate-200">
                            {att.caption || 'No caption provided.'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Existing Purchasing Decision Info if already decided */}
              {selectedTicket.status !== 'PENDING_PURCHASING_REVIEW' && (
                <div className="p-4 bg-slate-100 rounded-2xl border border-slate-200 space-y-2 text-xs">
                  <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Purchasing Department Decision Record
                  </h4>
                  <p className="text-slate-700">
                    <span className="font-bold">Decided By:</span> {selectedTicket.decided_by_first_name} {selectedTicket.decided_by_last_name} on {new Date(selectedTicket.decided_at).toLocaleString()}
                  </p>
                  {selectedTicket.purchasing_notes && (
                    <p className="text-slate-700"><span className="font-bold">Purchasing Notes:</span> {selectedTicket.purchasing_notes}</p>
                  )}
                  {selectedTicket.bypass_justification && (
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-purple-950 font-medium">
                      <span className="font-bold text-purple-800 block">QA Bypass Justification:</span>
                      {selectedTicket.bypass_justification}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="p-6 bg-slate-50 border-t border-slate-200 rounded-b-3xl flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                onClick={() => setSelectedTicket(null)}
                className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold bg-white border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-100 transition"
              >
                Close View
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => handleOpenDecisionModal(selectedTicket, 'RETURN_TO_SUPPLIER')}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-95 flex items-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  Return to Supplier
                </button>

                <button
                  onClick={() => handleOpenDecisionModal(selectedTicket, 'ON_HOLD')}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-95 flex items-center gap-1.5"
                >
                  <PauseCircle className="w-4 h-4" />
                  Hold
                </button>

                <button
                  onClick={() => handleOpenDecisionModal(selectedTicket, 'QA_BYPASSED')}
                  className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-95 flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Bypass QA
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
        </div>
      )}

      {/* ITEM PURCHASE REQUESTS VIEW */}
      {activePortalTab === 'item-requests' && (
        <div className="space-y-6">
          {/* KPI Cards for Purchase Requests */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Requisitions</span>
              <h2 className="text-2xl font-black text-slate-900 mt-1">{purchaseRequests.length}</h2>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Pending Review</span>
              <h2 className="text-2xl font-black text-amber-900 mt-1">
                {purchaseRequests.filter(r => r.status === 'Pending Review').length}
              </h2>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Approved / Order Placed</span>
              <h2 className="text-2xl font-black text-blue-900 mt-1">
                {purchaseRequests.filter(r => ['Approved', 'Order Placed'].includes(r.status)).length}
              </h2>
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Fulfilled</span>
              <h2 className="text-2xl font-black text-emerald-900 mt-1">
                {purchaseRequests.filter(r => r.status === 'Fulfilled').length}
              </h2>
            </div>
          </div>

          {/* Table of Requisitions */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-500" />
                Incoming Item Purchase Requests from Inventory Department
              </h3>
              <button
                onClick={fetchPurchaseRequests}
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-200/50"
              >
                <RefreshCw className={`w-4 h-4 ${loadingRequests ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Request #</th>
                    <th className="py-3 px-4">Item Name</th>
                    <th className="py-3 px-4 text-right">Qty Requested</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Date Needed</th>
                    <th className="py-3 px-4">Requested By</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {purchaseRequests.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center py-8 text-slate-400">
                        No item purchase requests submitted yet.
                      </td>
                    </tr>
                  ) : (
                    purchaseRequests.map(req => (
                      <tr key={req.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-mono font-bold text-indigo-600">{req.request_number}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {req.item_name}
                          {req.justification && (
                            <p className="text-[11px] text-slate-400 font-normal italic truncate max-w-xs">{req.justification}</p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                          {Number(req.requested_quantity).toFixed(2)} {req.uom}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            req.priority === 'Critical' ? 'bg-rose-100 text-rose-800' :
                            req.priority === 'High' ? 'bg-amber-100 text-amber-800' :
                            req.priority === 'Medium' ? 'bg-blue-100 text-blue-800' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {req.priority}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">{req.needed_by_date || 'N/A'}</td>
                        <td className="py-3 px-4 text-slate-700">
                          {req.requested_by_first_name} {req.requested_by_last_name}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            req.status === 'Fulfilled' ? 'bg-emerald-100 text-emerald-800' :
                            req.status === 'Order Placed' ? 'bg-blue-100 text-blue-800' :
                            req.status === 'Approved' ? 'bg-indigo-100 text-indigo-800' :
                            req.status === 'Rejected' ? 'bg-rose-100 text-rose-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleOpenRequestActionModal(req)}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs transition border border-indigo-200"
                          >
                            Update Status
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Decision Executive Form Modal */}
      {decisionModalOpen && selectedTicket && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-55 flex items-center justify-center p-4">
          <form onSubmit={handleSubmitDecision} className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-900">Execute Purchasing Decision</h3>
                <p className="text-xs text-slate-500">Ticket #{selectedTicket.ticket_number}</p>
              </div>
              <button
                type="button"
                onClick={() => setDecisionModalOpen(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400"
              >
                ✕
              </button>
            </div>

            {/* Decision Selection Radio Buttons */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block uppercase tracking-wider">Select Decision Action:</label>

              <div className="space-y-2">
                <label className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition ${decisionType === 'RETURN_TO_SUPPLIER' ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-500' : 'bg-slate-50 border-slate-200'}`}>
                  <input
                    type="radio"
                    name="decisionType"
                    value="RETURN_TO_SUPPLIER"
                    checked={decisionType === 'RETURN_TO_SUPPLIER'}
                    onChange={(e) => setDecisionType(e.target.value)}
                    className="mt-0.5 text-rose-600 focus:ring-rose-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-rose-900 block">1. Return to Supplier (RTV)</span>
                    <span className="text-[11px] text-rose-700 leading-tight block">Issue formal vendor Return-to-Vendor ticket for credit or replacement.</span>
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition ${decisionType === 'ON_HOLD' ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-500' : 'bg-slate-50 border-slate-200'}`}>
                  <input
                    type="radio"
                    name="decisionType"
                    value="ON_HOLD"
                    checked={decisionType === 'ON_HOLD'}
                    onChange={(e) => setDecisionType(e.target.value)}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-blue-900 block">2. Hold Material</span>
                    <span className="text-[11px] text-blue-700 leading-tight block">Keep stock on hold for further vendor investigation or laboratory re-testing.</span>
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition ${decisionType === 'QA_BYPASSED' ? 'bg-purple-50 border-purple-300 ring-2 ring-purple-500' : 'bg-slate-50 border-slate-200'}`}>
                  <input
                    type="radio"
                    name="decisionType"
                    value="QA_BYPASSED"
                    checked={decisionType === 'QA_BYPASSED'}
                    onChange={(e) => setDecisionType(e.target.value)}
                    className="mt-0.5 text-purple-600 focus:ring-purple-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-purple-900 block">3. Bypass Quality Assurance (Override Release)</span>
                    <span className="text-[11px] text-purple-700 leading-tight block">Force release supply lot into active inventory for immediate production use.</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Issue Category */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Deficiency Category:</label>
              <select
                value={issueCategory}
                onChange={(e) => setIssueCategory(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="Damaged Packaging">Damaged Packaging</option>
                <option value="Expired / Retest Failed">Expired / Retest Failed</option>
                <option value="Specification Mismatch">Specification Mismatch</option>
                <option value="Contamination / Impurity">Contamination / Impurity</option>
                <option value="COA / Documentation Missing">COA / Documentation Missing</option>
                <option value="Quality Deficiency / Receiving Rejection">Quality Deficiency / Receiving Rejection</option>
                <option value="Other Vendor Issue">Other Vendor Issue</option>
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Purchasing Officer Notes:</label>
              <textarea
                rows="2"
                placeholder="Enter remarks for supplier or internal warehouse..."
                value={purchasingNotes}
                onChange={(e) => setPurchasingNotes(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Mandatory Justification Note if QA Bypass */}
            {decisionType === 'QA_BYPASSED' && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-2xl space-y-1">
                <label className="text-xs font-bold text-purple-900 block">QA Bypass Justification (Mandatory):</label>
                <textarea
                  rows="2"
                  required
                  placeholder="State technical rationale or urgent business justification for overriding QA rejection..."
                  value={bypassJustification}
                  onChange={(e) => setBypassJustification(e.target.value)}
                  className="w-full p-2.5 bg-white border border-purple-300 rounded-xl text-xs text-purple-950 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>
            )}

            {/* Form Footer */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDecisionModalOpen(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition active:scale-95 flex items-center gap-1.5"
              >
                {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Confirm Decision
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: UPDATE PURCHASE REQUEST STATUS BY PURCHASING DEPT */}
      {requestActionModalOpen && selectedRequest && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900">Update Requisition Status ({selectedRequest.request_number})</h3>
              <button onClick={() => setRequestActionModalOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl text-xs space-y-1">
              <p className="font-bold text-slate-900">{selectedRequest.item_name}</p>
              <p className="text-slate-600">Requested Qty: <span className="font-bold font-mono text-emerald-700">{selectedRequest.requested_quantity} {selectedRequest.uom}</span></p>
              <p className="text-slate-500 text-[11px]">Justification: {selectedRequest.justification || 'N/A'}</p>
            </div>

            <form onSubmit={handleUpdateRequestStatus} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target Status</label>
                <select
                  value={targetRequestStatus}
                  onChange={e => setTargetRequestStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                >
                  <option value="Approved">Approved (Approved for Procurement)</option>
                  <option value="Order Placed">Order Placed (PO Issued to Vendor)</option>
                  <option value="Fulfilled">Fulfilled (Received & Added to Inventory)</option>
                  <option value="Rejected">Rejected (Declined / Duplicate Request)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Purchasing Remarks / PO Tracking Notes</label>
                <textarea
                  rows="3"
                  placeholder="e.g. PO #9921 issued to Chemical Vendor Inc, estimated delivery on Sep 12..."
                  value={purchasingRemarks}
                  onChange={e => setPurchasingRemarks(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRequestActionModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRequestAction}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5"
                >
                  {submittingRequestAction ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Save Status Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PurchasingTicketsPage;
