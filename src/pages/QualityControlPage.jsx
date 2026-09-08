import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  FileText,
  Check,
  Boxes,
  Upload,
  Image as ImageIcon,
  PlusCircle,
  Trash2,
  Camera,
  Clock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ElectronicSignatureModal } from '../components/ElectronicSignatureModal';
import { apiFetch } from '../services/api';

export function QualityControlPage() {
  const { user, accessToken, hasPermission } = useAuth();
  const [inspections, setInspections] = useState([]);
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [inspectionDetail, setInspectionDetail] = useState(null);
  const [paramInputs, setParamInputs] = useState({});
  const [activeTab, setActiveTab] = useState('Pending QC');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isSigModalOpen, setIsSigModalOpen] = useState(false);
  const [pendingDecision, setPendingDecision] = useState(null);

  // Receiving QA Supply States
  const [receivingItems, setReceivingItems] = useState([]);
  const [rejectingItem, setRejectingItem] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionQty, setRejectionQty] = useState('');
  const [photoAttachments, setPhotoAttachments] = useState([]); // [{ dataBase64, filename, mimeType, caption }]
  const [submittingRejection, setSubmittingRejection] = useState(false);

  useEffect(() => {
    if (activeTab === 'Receiving QA Supply Confirmation') {
      fetchReceivingHoldItems();
    } else {
      fetchInspections();
    }
  }, [activeTab]);

  const fetchInspections = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/qc/inspections?status=${encodeURIComponent(activeTab)}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setInspections(data.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchReceivingHoldItems = async () => {
    setLoading(true);
    try {
      const [rawRes, packRes] = await Promise.all([
        apiFetch('/api/v1/inventory/raw-materials?status=QC_HOLD'),
        apiFetch('/api/v1/inventory/packaging?status=QC_HOLD'),
      ]);

      const [rawData, packData] = await Promise.all([rawRes.json(), packRes.json()]);

      const items = [
        ...(rawData.data || []),
        ...(packData.data || []),
      ];
      setReceivingItems(items);
    } catch (e) {
      console.error('Error fetching receiving QA hold items:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveReceivingItem = async (item) => {
    if (!confirm(`Approve and release Lot ${item.lot_number} into active inventory?`)) return;
    try {
      const res = await apiFetch(`/api/v1/inventory/items/${item.id}/qa-status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'NORMAL', notes: 'Approved by QA receiving confirmation.' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchReceivingHoldItems();
      } else {
        alert(data.message || 'Failed to update QA status.');
      }
    } catch (e) {
      console.error(e);
      alert(e.message || 'Failed to update QA status.');
    }
  };

  const handleOpenRejectionModal = (item) => {
    setRejectingItem(item);
    setRejectionReason('');
    setRejectionQty(item.current_stock || '1');
    setPhotoAttachments([]);
  };

  const handleAddPhotoAttachment = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        setPhotoAttachments(prev => [
          ...prev,
          {
            dataBase64: reader.result,
            filename: file.name,
            mimeType: file.type,
            caption: '',
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleCaptionChange = (index, text) => {
    setPhotoAttachments(prev => {
      const updated = [...prev];
      updated[index].caption = text;
      return updated;
    });
  };

  const handleRemovePhoto = (index) => {
    setPhotoAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmitRejectionReport = async (e) => {
    e.preventDefault();
    if (!rejectingItem) return;
    if (!rejectionReason.trim()) {
      alert('Please enter a rejection reason.');
      return;
    }

    setSubmittingRejection(true);
    try {
      const payload = {
        materialId: rejectingItem.material_id,
        materialCode: rejectingItem.material_code,
        materialName: rejectingItem.material_name,
        materialType: rejectingItem.item_type || 'RAW_MATERIAL',
        vendorId: rejectingItem.vendor_id,
        supplierName: rejectingItem.vendor_name,
        supplierLotNumber: rejectingItem.supplier_lot_number || rejectingItem.lot_number,
        inventoryItemId: rejectingItem.id,
        rejectedQuantity: rejectionQty,
        uom: rejectingItem.uom || 'kg',
        reason: rejectionReason,
        attachments: photoAttachments.map(p => ({
          dataBase64: p.dataBase64,
          filename: p.filename,
          mimeType: p.mimeType,
          description: p.caption,
        })),
      };

      const res = await apiFetch('/api/v1/inventory/rejected', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert(`Rejection Report filed successfully! Transmitted to Purchasing Department as Ticket.`);
        setRejectingItem(null);
        fetchReceivingHoldItems();
      } else {
        alert(data.message || 'Failed to file rejection report.');
      }
    } catch (e) {
      console.error(e);
      alert(e.message || 'Failed to file rejection report.');
    } finally {
      setSubmittingRejection(false);
    }
  };

  const fetchDetail = async (id) => {
    try {
      const res = await fetch(`/api/v1/qc/inspections/${id}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setInspectionDetail(data.data);
        setSelectedInspection(data.data.inspection);

        const initialMap = {};
        (data.data.results || []).forEach(r => {
          initialMap[r.parameter_id] = {
            numeric: r.measured_numeric !== null ? String(r.measured_numeric) : '',
            text: r.measured_text || '',
            notes: r.notes || '',
          };
        });
        setParamInputs(initialMap);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveResults = async (e) => {
    e.preventDefault();
    if (!selectedInspection) return;
    setSaving(true);
    setError(null);

    const formattedResults = Object.entries(paramInputs).map(([paramId, val]) => ({
      parameterId: Number(paramId),
      measuredNumeric: val.numeric || null,
      measuredText: val.text || null,
      notes: val.notes || null,
    }));

    try {
      const res = await fetch(`/api/v1/qc/inspections/${selectedInspection.id}/results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ results: formattedResults }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchDetail(selectedInspection.id);
      } else {
        setError(data.message || 'Failed to save results.');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const triggerDecisionModal = (decision) => {
    setPendingDecision(decision);
    setIsSigModalOpen(true);
  };

  const handleFinalDecision = async (sigData) => {
    if (!selectedInspection || !pendingDecision) return;
    try {
      const res = await fetch(`/api/v1/qc/inspections/${selectedInspection.id}/decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          status: pendingDecision,
          notes: `Decision authorized via Electronic Signature. Signature Log ID: ${sigData.logId}`,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsSigModalOpen(false);
        setInspectionDetail(null);
        setSelectedInspection(null);
        fetchInspections();
      } else {
        alert(data.message || 'Failed to record decision');
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-slate-500" />
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Quality Control Hub</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Quality Assurance Inspection, Receiving Supply Confirmation & Batch Release Sign-Off Portal.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => activeTab === 'Receiving QA Supply Confirmation' ? fetchReceivingHoldItems() : fetchInspections()}
            className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto text-xs font-bold">
        {['Pending QC', 'Receiving QA Supply Confirmation', 'Under Inspection', 'QC Passed', 'QC Failed', 'Rework Required', 'Released'].map(tab => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setSelectedInspection(null);
            }}
            className={`px-4 py-2.5 rounded-xl transition ${
              activeTab === tab
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-semibold">
          {error}
        </div>
      )}

      {/* VIEW 1: RECEIVING QA SUPPLY CONFIRMATION */}
      {activeTab === 'Receiving QA Supply Confirmation' ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Boxes className="w-5 h-5 text-purple-600" />
                Receiving Supply Lots Pending QA Confirmation ({receivingItems.length})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Supply lots delivered by vendors are placed on QC_HOLD until confirmed by QA. Approve to release into inventory or reject to file report to Purchasing.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400 font-semibold">Loading receiving lots...</div>
          ) : receivingItems.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800">
              No supply lots currently pending QA receiving confirmation.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {receivingItems.map((item) => (
                <div key={item.id} className="p-5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between space-y-4">
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-purple-600">{item.material_code || item.item_type}</span>
                      <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-md">
                        QC_HOLD
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">{item.material_name || 'Received Supply Item'}</h4>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Lot Number:</span>
                        <span className="font-mono font-bold">{item.lot_number}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Quantity:</span>
                        <span className="font-bold">{parseFloat(item.current_stock).toLocaleString()} {item.uom}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Vendor:</span>
                        <span className="font-medium">{item.vendor_name || '-'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Location:</span>
                        <span className="font-medium">{item.location}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() => handleOpenRejectionModal(item)}
                      className="flex-1 py-2 bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Reject & File to Purchasing
                    </button>
                    <button
                      onClick={() => handleApproveReceivingItem(item)}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Approve Release
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* VIEW 2: STANDARD QC INSPECTIONS QUEUE */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Inspection List */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-3 shadow-sm">
            <h3 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
              {activeTab} Queue ({inspections.length})
            </h3>

            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400 font-semibold">Loading queue...</div>
            ) : inspections.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No inspections in {activeTab}</div>
            ) : (
              <div className="space-y-2">
                {inspections.map(insp => (
                  <button
                    key={insp.id}
                    onClick={() => fetchDetail(insp.id)}
                    className={`w-full text-left p-4 rounded-2xl border transition space-y-1 ${
                      selectedInspection?.id === insp.id
                        ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-600 text-purple-900 dark:text-purple-200 font-bold shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-purple-600">{insp.batch_number}</span>
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 text-[10px] font-bold rounded">
                        {insp.batch_category}
                      </span>
                    </div>
                    <p className="text-xs font-bold truncate">{insp.template_name}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Inspection Form & Decision Panel */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-sm">
            {!inspectionDetail ? (
              <div className="p-12 text-center text-xs text-slate-400">
                Select a batch inspection from the queue to enter test results and sign off release.
              </div>
            ) : (
              <form onSubmit={handleSaveResults} className="space-y-6">
                <div className="border-b border-slate-200 dark:border-slate-800 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-purple-600 text-sm">{inspectionDetail.inspection?.batch_number}</span>
                      <span className="px-2.5 py-0.5 bg-purple-100 text-purple-800 text-xs font-bold rounded-md">
                        {inspectionDetail.inspection?.batch_category}
                      </span>
                    </div>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                      {inspectionDetail.inspection?.template_name}
                    </h2>
                  </div>

                  {/* Release Actions */}
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <button
                      type="button"
                      onClick={() => triggerDecisionModal('QC Failed')}
                      className="flex-1 md:flex-none px-4 py-2.5 bg-rose-100 text-rose-800 hover:bg-rose-200 font-bold text-xs rounded-xl transition"
                    >
                      QC Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerDecisionModal('Rework Required')}
                      className="flex-1 md:flex-none px-4 py-2.5 bg-amber-100 text-amber-800 hover:bg-amber-200 font-bold text-xs rounded-xl transition"
                    >
                      Request Rework
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerDecisionModal('Released')}
                      className="flex-1 md:flex-none px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
                    >
                      Approve Release
                    </button>
                  </div>
                </div>

                {/* Parameters Entry Table */}
                <div className="space-y-4">
                  <h3 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                    Category Parameter Inspection Matrix
                  </h3>

                  <div className="space-y-3">
                    {(inspectionDetail.parameters || []).map(param => {
                      const val = paramInputs[param.id] || { numeric: '', text: '', notes: '' };
                      return (
                        <div
                          key={param.id}
                          className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs"
                        >
                          <div className="space-y-0.5 max-w-xs">
                            <p className="font-bold text-slate-900 dark:text-white">{param.param_name}</p>
                            <p className="text-[11px] text-slate-500">
                              Unit: <span className="font-mono">{param.unit || 'N/A'}</span> • Target Range: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{param.min_value !== null ? `${param.min_value} - ${param.max_value}` : (param.target_value_str || 'Standard')}</span>
                            </p>
                          </div>

                          <div className="flex items-center gap-3 w-full md:w-auto">
                            {param.min_value !== null ? (
                              <input
                                type="number"
                                step="0.000001"
                                value={val.numeric}
                                onChange={e => setParamInputs({ ...paramInputs, [param.id]: { ...val, numeric: e.target.value } })}
                                placeholder="Measured Value"
                                className="w-36 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-purple-600"
                              />
                            ) : (
                              <input
                                type="text"
                                value={val.text}
                                onChange={e => setParamInputs({ ...paramInputs, [param.id]: { ...val, text: e.target.value } })}
                                placeholder="Pass / Match"
                                className="w-36 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-purple-600"
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
                  >
                    {saving ? 'Saving...' : 'Save Parameter Results'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* REJECTION REPORT FILING MODAL WITH CAPTIONED PHOTOS */}
      {rejectingItem && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSubmitRejectionReport} className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-black text-rose-600 flex items-center gap-2">
                  <XCircle className="w-5 h-5" />
                  File Rejection Report to Purchasing
                </h3>
                <p className="text-xs text-slate-500">Transmits report and evidence photos to Purchasing Department.</p>
              </div>
              <button
                type="button"
                onClick={() => setRejectingItem(null)}
                className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                ✕
              </button>
            </div>

            {/* Material Metadata Box */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Material</span>
                <span className="font-bold text-slate-900 dark:text-white">{rejectingItem.material_name} ({rejectingItem.material_code})</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Lot Number</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{rejectingItem.supplier_lot_number || rejectingItem.lot_number}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Vendor</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">{rejectingItem.vendor_name || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Current Stock</span>
                <span className="font-bold text-slate-900 dark:text-white">{parseFloat(rejectingItem.current_stock).toLocaleString()} {rejectingItem.uom}</span>
              </div>
            </div>

            {/* Quantity & Reason inputs */}
            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Rejected Quantity:</label>
                <input
                  type="number"
                  step="0.000001"
                  required
                  value={rejectionQty}
                  onChange={(e) => setRejectionQty(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Rejection Reason & Deficiency Detail:</label>
                <textarea
                  rows="3"
                  required
                  placeholder="Describe damage, out of spec parameters, missing COA, or contamination..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              {/* Photo Evidence with Captions Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-indigo-600" />
                    Attach Photo Evidence & Captions:
                  </label>
                  <label className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl cursor-pointer border border-indigo-200 transition flex items-center gap-1">
                    <Upload className="w-3.5 h-3.5" />
                    Upload Photo
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      multiple
                      onChange={handleAddPhotoAttachment}
                      className="hidden"
                    />
                  </label>
                </div>

                {photoAttachments.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl text-center">
                    No photo evidence attached. Click "Upload Photo" to attach picture and enter caption.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {photoAttachments.map((att, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <div className="w-16 h-16 bg-slate-200 dark:bg-slate-700 rounded-xl overflow-hidden shrink-0 border border-slate-300 dark:border-slate-600 flex items-center justify-center">
                          {att.mimeType?.startsWith('image/') ? (
                            <img src={att.dataBase64} alt={att.filename} className="w-full h-full object-cover" />
                          ) : (
                            <FileText className="w-6 h-6 text-slate-500" />
                          )}
                        </div>
                        <div className="flex-1 w-full space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-mono font-bold truncate max-w-[200px] text-slate-700 dark:text-slate-300">{att.filename}</span>
                            <button
                              type="button"
                              onClick={() => handleRemovePhoto(idx)}
                              className="text-rose-600 hover:text-rose-800 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <input
                            type="text"
                            placeholder="Enter caption for this photo (e.g., Broken seal on bottle #3)..."
                            value={att.caption}
                            onChange={(e) => handleCaptionChange(idx, e.target.value)}
                            className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setRejectingItem(null)}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingRejection}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition active:scale-95 flex items-center gap-1.5"
              >
                {submittingRejection ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Transmit Rejection to Purchasing
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Signature Modal */}
      <ElectronicSignatureModal
        isOpen={isSigModalOpen}
        onClose={() => setIsSigModalOpen(false)}
        onAuthorized={handleFinalDecision}
        actionTitle={`QC Decision: ${pendingDecision}`}
        action="QC_DECISION"
        entityType="QCInspection"
        entityId={selectedInspection?.id || 0}
      />
    </div>
  );
}

export default QualityControlPage;
