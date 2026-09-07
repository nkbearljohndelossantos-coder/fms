import React, { useEffect, useState } from 'react';
import {
  Boxes,
  Package,
  CheckCircle2,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  RotateCcw,
  History,
  QrCode,
  Truck,
  Paperclip,
  FileText,
  Image as ImageIcon,
  Eye,
  Download,
  Trash2,
  Search,
  Plus,
  Filter,
  ShieldCheck,
  Building2,
  X,
  PlusCircle,
  FileSpreadsheet,
  Layers,
  Sparkles,
  ArrowRightLeft,
  ChevronRight,
  Maximize2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/api';

export function InventoryPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('raw-materials'); // raw-materials, packaging, finished-products, rejected

  // Dashboard KPI Metrics State
  const [kpis, setKpis] = useState({
    totalRawMaterials: 0,
    totalPackaging: 0,
    totalFinishedProducts: 0,
    lowStock: 0,
    outOfStock: 0,
    reservedStock: 0,
    rejectedMaterials: 0,
    qcHold: 0,
  });

  // Table Data States
  const [rawMaterials, setRawMaterials] = useState([]);
  const [packaging, setPackaging] = useState([]);
  const [finishedProducts, setFinishedProducts] = useState([]);
  const [rejectedMaterials, setRejectedMaterials] = useState([]);
  const [materialsList, setMaterialsList] = useState([]);
  const [vendorsList, setVendorsList] = useState([]);

  // Search & Filter States
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dispositionFilter, setDispositionFilter] = useState('All');
  const [rejectionCategoryFilter, setRejectionCategoryFilter] = useState('All');
  const [loading, setLoading] = useState(true);

  // Modal States
  const [isStockInModalOpen, setIsStockInModalOpen] = useState(false);
  const [isOpModalOpen, setIsOpModalOpen] = useState(false);
  const [opType, setOpType] = useState('STOCK_OUT'); // STOCK_OUT, ADJUST, TRANSFER
  const [selectedItem, setSelectedItem] = useState(null);

  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [historyData, setHistoryData] = useState(null);

  const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false);
  const [isRejectionDetailModalOpen, setIsRejectionDetailModalOpen] = useState(false);
  const [selectedRejection, setSelectedRejection] = useState(null);
  const [isDispositionModalOpen, setIsDispositionModalOpen] = useState(false);

  const [isTraceabilityModalOpen, setIsTraceabilityModalOpen] = useState(false);
  const [traceabilityQuery, setTraceabilityQuery] = useState('');
  const [traceabilityData, setTraceabilityData] = useState(null);
  const [loadingTraceability, setLoadingTraceability] = useState(false);

  const [isPurchaseRequestModalOpen, setIsPurchaseRequestModalOpen] = useState(false);
  const [purchaseRequestForm, setPurchaseRequestForm] = useState({
    itemName: '',
    materialId: '',
    requestedQuantity: '',
    uom: 'kg',
    priority: 'Medium',
    neededByDate: '',
    vendorId: '',
    justification: '',
  });

  const [lightboxImage, setLightboxImage] = useState(null);

  // Form Inputs State
  const [stockInForm, setStockInForm] = useState({
    itemType: 'RAW_MATERIAL',
    materialId: '',
    lotNumber: '',
    supplierLotNumber: '',
    vendorId: '',
    quantity: '',
    uom: 'kg',
    location: 'RM-WH-A',
    storageCondition: 'Ambient 15-25°C',
    coaReference: '',
    expirationDate: '',
    minimumStock: '10',
    reorderLevel: '25',
    reason: 'Initial Warehouse Stock In / Receiving',
  });

  const [opForm, setOpForm] = useState({
    quantity: '',
    newQuantity: '',
    toLocation: 'PROD-LINE-1',
    reason: '',
  });

  const [rejectionForm, setRejectionForm] = useState({
    materialId: '',
    materialCode: '',
    materialName: '',
    materialType: 'RAW_MATERIAL',
    vendorId: '',
    supplierName: '',
    supplierLotNumber: '',
    rejectedQuantity: '',
    uom: 'kg',
    reason: '',
    location: 'Rejected Material Area',
  });

  // Attachments State for Rejection Modal
  const [attachmentFiles, setAttachmentFiles] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [dispositionNotes, setDispositionNotes] = useState('');
  const [targetDisposition, setTargetDisposition] = useState('Pending Review');

  // Fetch Dashboard KPIs
  const fetchDashboardKpis = () => {
    apiFetch('/api/v1/inventory/dashboard')
      .then(res => res.json())
      .then(d => d.success && setKpis(d.data))
      .catch(() => {});
  };

  // Fetch Active Tab Data
  const fetchData = () => {
    setLoading(true);
    let endpoint = '/api/v1/inventory/raw-materials';
    if (activeTab === 'packaging') endpoint = '/api/v1/inventory/packaging';
    if (activeTab === 'finished-products') endpoint = '/api/v1/inventory/finished-products';
    if (activeTab === 'rejected') endpoint = '/api/v1/inventory/rejected';

    let url = `${endpoint}?search=${encodeURIComponent(search)}&location=${encodeURIComponent(locationFilter)}&status=${encodeURIComponent(statusFilter)}`;
    if (activeTab === 'rejected') {
      url = `/api/v1/inventory/rejected?search=${encodeURIComponent(search)}&disposition=${encodeURIComponent(dispositionFilter)}&status=${encodeURIComponent(statusFilter)}&material_type=${encodeURIComponent(rejectionCategoryFilter)}`;
    }

    apiFetch(url)
      .then(res => res.json())
      .then(d => {
        if (d.success) {
          if (activeTab === 'raw-materials') setRawMaterials(d.data);
          if (activeTab === 'packaging') setPackaging(d.data);
          if (activeTab === 'finished-products') setFinishedProducts(d.data);
          if (activeTab === 'rejected') setRejectedMaterials(d.data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  // Fetch Master Lists for Dropdowns
  const fetchMasters = () => {
    apiFetch('/api/v1/materials')
      .then(res => res.json())
      .then(d => d.success && setMaterialsList(d.data))
      .catch(() => {});

    apiFetch('/api/v1/vendors')
      .then(res => res.json())
      .then(d => d.success && setVendorsList(d.data))
      .catch(() => {});
  };

  useEffect(() => {
    fetchDashboardKpis();
    fetchMasters();
  }, []);

  useEffect(() => {
    fetchData();
  }, [activeTab, search, locationFilter, statusFilter, dispositionFilter, rejectionCategoryFilter]);

  // Handle File Drag & Drop / Selection for Rejections
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachmentFiles(prev => [
          ...prev,
          {
            id: Date.now() + Math.random(),
            file,
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            fileSize: file.size,
            dataBase64: event.target.result,
            description: '',
          }
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachmentFile = (id) => {
    setAttachmentFiles(prev => prev.filter(f => f.id !== id));
  };

  const updateAttachmentDescription = (id, desc) => {
    setAttachmentFiles(prev => prev.map(f => f.id === id ? { ...f, description: desc } : f));
  };

  // Handle Stock In Submit
  const handleStockInSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/v1/inventory/stock-in', {
        method: 'POST',
        body: JSON.stringify(stockInForm),
      });
      const data = await res.json();
      if (data.success) {
        setIsStockInModalOpen(false);
        fetchData();
        fetchDashboardKpis();
        alert('✅ Stock In successfully logged.');
      } else {
        alert(`❌ Error: ${data.message}`);
      }
    } catch (err) {
      alert(`❌ Failed: ${err.message}`);
    }
  };

  // Handle Operation Submit (Stock Out, Adjust, Transfer)
  const handleOpSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;

    let url = '/api/v1/inventory/stock-out';
    let payload = { itemId: selectedItem.id, quantity: opForm.quantity, reason: opForm.reason };

    if (opType === 'ADJUST') {
      url = '/api/v1/inventory/adjust';
      payload = { itemId: selectedItem.id, newQuantity: opForm.newQuantity, reason: opForm.reason };
    } else if (opType === 'TRANSFER') {
      url = '/api/v1/inventory/transfer';
      payload = { itemId: selectedItem.id, toLocation: opForm.toLocation, quantity: opForm.quantity, reason: opForm.reason };
    }

    try {
      const res = await apiFetch(url, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setIsOpModalOpen(false);
        fetchData();
        fetchDashboardKpis();
        alert('✅ Operation recorded successfully.');
      } else {
        alert(`❌ Error: ${data.message}`);
      }
    } catch (err) {
      alert(`❌ Failed: ${err.message}`);
    }
  };

  // Handle Create Rejection Submit
  const handleRejectionSubmit = async (e) => {
    e.preventDefault();
    setUploadingFiles(true);

    try {
      const res = await apiFetch('/api/v1/inventory/rejected', {
        method: 'POST',
        body: JSON.stringify({
          data: rejectionForm,
          attachments: attachmentFiles.map(a => ({
            filename: a.filename,
            mimeType: a.mimeType,
            dataBase64: a.dataBase64,
            description: a.description,
          })),
        }),
      });

      const data = await res.json();
      setUploadingFiles(false);

      if (data.success) {
        setIsRejectionModalOpen(false);
        setAttachmentFiles([]);
        fetchData();
        fetchDashboardKpis();
        alert('✅ Material Rejection logged with attachments.');
      } else {
        alert(`❌ Error: ${data.message}`);
      }
    } catch (err) {
      setUploadingFiles(false);
      alert(`❌ Failed: ${err.message}`);
    }
  };

  // Handle Disposition Submit
  const handleDispositionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRejection) return;

    try {
      const res = await apiFetch(`/api/v1/inventory/rejected/${selectedRejection.id}/disposition`, {
        method: 'PUT',
        body: JSON.stringify({
          disposition: targetDisposition,
          notes: dispositionNotes,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIsDispositionModalOpen(false);
        setIsRejectionDetailModalOpen(false);
        fetchData();
        fetchDashboardKpis();
        alert('✅ Rejection disposition updated.');
      } else {
        alert(`❌ Error: ${data.message}`);
      }
    } catch (err) {
      alert(`❌ Failed: ${err.message}`);
    }
  };

  // Open Transaction History Drawer
  const openHistoryDrawer = (item) => {
    setSelectedItem(item);
    setIsHistoryDrawerOpen(true);
    apiFetch(`/api/v1/inventory/items/${item.id}/history`)
      .then(res => res.json())
      .then(d => d.success && setHistoryData(d.data))
      .catch(() => {});
  };

  // Search Traceability
  const handleTraceabilitySearch = (query) => {
    const q = query || traceabilityQuery;
    if (!q || !q.trim()) return;

    setLoadingTraceability(true);
    apiFetch(`/api/v1/inventory/traceability/${encodeURIComponent(q.trim())}`)
      .then(res => res.json())
      .then(d => {
        setLoadingTraceability(false);
        if (d.success) setTraceabilityData(d.data);
        else alert(`❌ ${d.message}`);
      })
      .catch(() => setLoadingTraceability(false));
  };

  const handlePurchaseRequestSubmit = async (e) => {
    e.preventDefault();
    if (!purchaseRequestForm.itemName || !purchaseRequestForm.requestedQuantity) {
      alert('Please enter Item Name and Requested Quantity.');
      return;
    }

    try {
      const res = await apiFetch('/api/v1/inventory/purchase-requests', {
        method: 'POST',
        body: JSON.stringify({
          item_name: purchaseRequestForm.itemName,
          material_id: purchaseRequestForm.materialId,
          requested_quantity: purchaseRequestForm.requestedQuantity,
          uom: purchaseRequestForm.uom,
          priority: purchaseRequestForm.priority,
          needed_by_date: purchaseRequestForm.neededByDate,
          vendor_id: purchaseRequestForm.vendorId,
          justification: purchaseRequestForm.justification,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsPurchaseRequestModalOpen(false);
        setPurchaseRequestForm({
          itemName: '',
          materialId: '',
          requestedQuantity: '',
          uom: 'kg',
          priority: 'Medium',
          neededByDate: '',
          vendorId: '',
          justification: '',
        });
        alert(`✅ ${data.message}`);
      } else {
        alert(`❌ Error: ${data.message}`);
      }
    } catch (err) {
      alert(`❌ Failed: ${err.message}`);
    }
  };

  // Helper Badge Color for Stock Status
  const getStatusBadge = (status) => {
    switch (status) {
      case 'NORMAL':
        return <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[11px] font-bold">NORMAL</span>;
      case 'LOW_STOCK':
        return <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-[11px] font-bold">LOW STOCK</span>;
      case 'OUT_OF_STOCK':
        return <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-full text-[11px] font-bold">OUT OF STOCK</span>;
      case 'QC_HOLD':
        return <span className="px-2.5 py-1 bg-purple-100 text-purple-800 rounded-full text-[11px] font-bold">QC HOLD</span>;
      default:
        return <span className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-full text-[11px] font-bold">{status}</span>;
    }
  };

  const getDispositionBadge = (disp) => {
    switch (disp) {
      case 'Pending Review':
        return <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-[11px] font-bold">Pending Review</span>;
      case 'Approved for Reuse':
        return <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[11px] font-bold">Approved for Reuse</span>;
      case 'Returned to Supplier':
        return <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-[11px] font-bold">Returned to Supplier</span>;
      case 'Disposed':
        return <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-full text-[11px] font-bold">Disposed</span>;
      default:
        return <span className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-full text-[11px] font-bold">{disp}</span>;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Boxes className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-black text-slate-900">Inventory Management System</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Lot-Level Stock Ledger, Receiving, Material Rejections, Traceability & MES Integration
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsPurchaseRequestModalOpen(true)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-2"
          >
            <Building2 className="w-4 h-4" />
            <span>Request Item to Purchasing</span>
          </button>

          <button
            onClick={() => {
              setStockInForm(prev => ({ ...prev, itemType: activeTab === 'packaging' ? 'PACKAGING' : 'RAW_MATERIAL' }));
              setIsStockInModalOpen(true);
            }}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Stock In Lot</span>
          </button>

          <button
            onClick={() => setIsRejectionModalOpen(true)}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Create Rejection</span>
          </button>

          <button
            onClick={() => {
              setTraceabilityData(null);
              setTraceabilityQuery('');
              setIsTraceabilityModalOpen(true);
            }}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-2"
          >
            <QrCode className="w-4 h-4" />
            <span>Traceability Inspector</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs text-center">
          <p className="text-[10px] font-bold uppercase text-slate-400">Raw Materials</p>
          <p className="text-lg font-black text-slate-900 mt-1">{kpis.totalRawMaterials}</p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs text-center">
          <p className="text-[10px] font-bold uppercase text-slate-400">Packaging</p>
          <p className="text-lg font-black text-slate-900 mt-1">{kpis.totalPackaging}</p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs text-center">
          <p className="text-[10px] font-bold uppercase text-slate-400">Finished Goods</p>
          <p className="text-lg font-black text-blue-600 mt-1">{kpis.totalFinishedProducts}</p>
        </div>

        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl shadow-xs text-center">
          <p className="text-[10px] font-bold uppercase text-amber-700">Low Stock</p>
          <p className="text-lg font-black text-amber-900 mt-1">{kpis.lowStock}</p>
        </div>

        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl shadow-xs text-center">
          <p className="text-[10px] font-bold uppercase text-rose-700">Out of Stock</p>
          <p className="text-lg font-black text-rose-900 mt-1">{kpis.outOfStock}</p>
        </div>

        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl shadow-xs text-center">
          <p className="text-[10px] font-bold uppercase text-indigo-700">Reserved</p>
          <p className="text-lg font-black text-indigo-900 mt-1">{Number(kpis.reservedStock).toFixed(1)}</p>
        </div>

        <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl shadow-xs text-center">
          <p className="text-[10px] font-bold uppercase text-purple-700">QC Hold</p>
          <p className="text-lg font-black text-purple-900 mt-1">{kpis.qcHold}</p>
        </div>

        <div className="p-4 bg-rose-100/60 border border-rose-300 rounded-xl shadow-xs text-center">
          <p className="text-[10px] font-bold uppercase text-rose-800">Rejected</p>
          <p className="text-lg font-black text-rose-950 mt-1">{kpis.rejectedMaterials}</p>
        </div>
      </div>

      {/* Main Content Area with Navigation Tabs */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {/* Navigation Tabs Header */}
        <div className="border-b border-slate-200 bg-slate-50/50 p-2 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('raw-materials')}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs transition flex items-center gap-2 ${
              activeTab === 'raw-materials'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Raw Materials</span>
          </button>

          <button
            onClick={() => setActiveTab('packaging')}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs transition flex items-center gap-2 ${
              activeTab === 'packaging'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Packaging Materials</span>
          </button>

          <button
            onClick={() => setActiveTab('finished-products')}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs transition flex items-center gap-2 ${
              activeTab === 'finished-products'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Finished Products</span>
          </button>

          <button
            onClick={() => setActiveTab('rejected')}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs transition flex items-center gap-2 ${
              activeTab === 'rejected'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Rejected Materials</span>
            {kpis.rejectedMaterials > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-rose-200 text-rose-900 rounded-full text-[10px] font-black">
                {kpis.rejectedMaterials}
              </span>
            )}
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-3 items-center justify-between bg-white">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search code, name, lot..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {activeTab !== 'rejected' && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Filter className="w-3.5 h-3.5" />
                <span>Location:</span>
                <select
                  value={locationFilter}
                  onChange={e => setLocationFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800"
                >
                  <option value="All">All Locations</option>
                  <option value="RM-WH-A">RM-WH-A (Raw Material Warehouse A)</option>
                  <option value="PKG-WH-B">PKG-WH-B (Packaging Warehouse)</option>
                  <option value="FG-WH-MAIN">FG-WH-MAIN (Finished Goods Main)</option>
                  <option value="PROD-LINE-1">PROD-LINE-1 (Shop Floor)</option>
                  <option value="Rejected Material Area">Rejected Material Area</option>
                </select>
              </div>
            )}

            {activeTab === 'rejected' ? (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Filter className="w-3.5 h-3.5" />
                  <span>Category:</span>
                  <select
                    value={rejectionCategoryFilter}
                    onChange={e => setRejectionCategoryFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800"
                  >
                    <option value="All">All Categories</option>
                    <option value="RAW_MATERIAL">🧪 Raw Materials</option>
                    <option value="PACKAGING">📦 Packaging Materials</option>
                    <option value="FINISHED_GOODS">🏭 Finished Products</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span>Disposition:</span>
                  <select
                    value={dispositionFilter}
                    onChange={e => setDispositionFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800"
                  >
                    <option value="All">All Dispositions</option>
                    <option value="Pending Review">Pending Review</option>
                    <option value="For Return">For Return</option>
                    <option value="For Disposal">For Disposal</option>
                    <option value="For Rework">For Rework</option>
                    <option value="Approved for Reuse">Approved for Reuse</option>
                    <option value="Returned to Supplier">Returned to Supplier</option>
                    <option value="Disposed">Disposed</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span>Status:</span>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800"
                >
                  <option value="All">All Statuses</option>
                  <option value="NORMAL">Normal</option>
                  <option value="LOW_STOCK">Low Stock</option>
                  <option value="OUT_OF_STOCK">Out of Stock</option>
                  <option value="QC_HOLD">QC Hold</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Tab 1: RAW MATERIALS TABLE */}
        {activeTab === 'raw-materials' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Material Name</th>
                  <th className="py-3 px-4">Group / INCI</th>
                  <th className="py-3 px-4">Lot Number</th>
                  <th className="py-3 px-4 text-right">Current Stock</th>
                  <th className="py-3 px-4 text-right">Reserved</th>
                  <th className="py-3 px-4 text-right">Available</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {loading ? (
                  <tr><td colSpan="10" className="text-center py-8 text-slate-400">Loading raw material stock...</td></tr>
                ) : rawMaterials.length === 0 ? (
                  <tr><td colSpan="10" className="text-center py-8 text-slate-400">No raw material inventory records found.</td></tr>
                ) : (
                  rawMaterials.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono font-bold text-blue-600">{item.material_code || 'MAT-0001'}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{item.material_name}</td>
                      <td className="py-3 px-4 text-slate-500">
                        <span className="font-semibold text-slate-700">{item.material_group || 'Cosmetic'}</span>
                        {item.inci_name && <span className="block text-[10px] text-slate-400 truncate max-w-[140px]">{item.inci_name}</span>}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        <span className="font-bold">{item.lot_number}</span>
                        {item.supplier_lot_number && <span className="block text-[10px] text-slate-400">Supp: {item.supplier_lot_number}</span>}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{Number(item.current_stock).toFixed(2)} {item.uom}</td>
                      <td className="py-3 px-4 text-right font-mono text-indigo-600 font-semibold">{Number(item.reserved_stock).toFixed(2)} {item.uom}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">{Number(item.available_stock).toFixed(2)} {item.uom}</td>
                      <td className="py-3 px-4 text-slate-600 font-medium">{item.location}</td>
                      <td className="py-3 px-4">{getStatusBadge(item.status)}</td>
                      <td className="py-3 px-4 text-right space-x-1">
                        <button
                          onClick={() => openHistoryDrawer(item)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition text-[11px]"
                        >
                          History
                        </button>
                        <button
                          onClick={() => {
                            setSelectedItem(item);
                            setOpType('STOCK_OUT');
                            setOpForm({ quantity: '', newQuantity: String(item.current_stock), toLocation: 'PROD-LINE-1', reason: '' });
                            setIsOpModalOpen(true);
                          }}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg transition text-[11px]"
                        >
                          Stock Out
                        </button>
                        <button
                          onClick={() => {
                            setSelectedItem(item);
                            setOpType('TRANSFER');
                            setOpForm({ quantity: '', newQuantity: String(item.current_stock), toLocation: 'PROD-LINE-1', reason: '' });
                            setIsOpModalOpen(true);
                          }}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg transition text-[11px]"
                        >
                          Transfer
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: PACKAGING MATERIALS TABLE */}
        {activeTab === 'packaging' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Material Name</th>
                  <th className="py-3 px-4">Packaging Group</th>
                  <th className="py-3 px-4">Lot Number</th>
                  <th className="py-3 px-4 text-right">Current Stock</th>
                  <th className="py-3 px-4 text-right">Available</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {loading ? (
                  <tr><td colSpan="9" className="text-center py-8 text-slate-400">Loading packaging stock...</td></tr>
                ) : packaging.length === 0 ? (
                  <tr><td colSpan="9" className="text-center py-8 text-slate-400">No packaging inventory records found.</td></tr>
                ) : (
                  packaging.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono font-bold text-purple-600">{item.material_code || 'PKG-0001'}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{item.material_name}</td>
                      <td className="py-3 px-4 text-slate-600 font-semibold">{item.packaging_group || 'Bottle'}</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">{item.lot_number}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{Number(item.current_stock).toFixed(0)} {item.uom}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">{Number(item.available_stock).toFixed(0)} {item.uom}</td>
                      <td className="py-3 px-4 text-slate-600 font-medium">{item.location}</td>
                      <td className="py-3 px-4">{getStatusBadge(item.status)}</td>
                      <td className="py-3 px-4 text-right space-x-1">
                        <button
                          onClick={() => openHistoryDrawer(item)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition text-[11px]"
                        >
                          History
                        </button>
                        <button
                          onClick={() => {
                            setSelectedItem(item);
                            setOpType('STOCK_OUT');
                            setOpForm({ quantity: '', newQuantity: String(item.current_stock), toLocation: 'PROD-LINE-1', reason: '' });
                            setIsOpModalOpen(true);
                          }}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg transition text-[11px]"
                        >
                          Stock Out
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: FINISHED PRODUCTS TABLE */}
        {activeTab === 'finished-products' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Product Code</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Batch Number / Compounding</th>
                  <th className="py-3 px-4 text-right">Current Stock</th>
                  <th className="py-3 px-4 text-right">Available</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Production Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {loading ? (
                  <tr><td colSpan="9" className="text-center py-8 text-slate-400">Loading finished products...</td></tr>
                ) : finishedProducts.length === 0 ? (
                  <tr><td colSpan="9" className="text-center py-8 text-slate-400">No released finished products in inventory yet.</td></tr>
                ) : (
                  finishedProducts.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono font-bold text-blue-600">{item.product_code || 'FORM-COS-001'}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{item.product_name || 'Hydrating Facial Cream'}</td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        <span className="font-bold text-slate-900">{item.batch_number || item.lot_number}</span>
                        {item.compounding_code && <span className="block text-[10px] text-blue-600 font-bold">{item.compounding_code}</span>}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{Number(item.current_stock).toFixed(2)} {item.uom}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">{Number(item.available_stock).toFixed(2)} {item.uom}</td>
                      <td className="py-3 px-4 text-slate-600 font-medium">{item.location}</td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {item.production_date ? new Date(item.production_date).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(item.status)}</td>
                      <td className="py-3 px-4 text-right space-x-1">
                        <button
                          onClick={() => {
                            setTraceabilityQuery(item.batch_number || item.lot_number);
                            handleTraceabilitySearch(item.batch_number || item.lot_number);
                            setIsTraceabilityModalOpen(true);
                          }}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg transition text-[11px]"
                        >
                          Traceability
                        </button>
                        <button
                          onClick={() => openHistoryDrawer(item)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition text-[11px]"
                        >
                          History
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 4: REJECTED MATERIALS TABLE */}
        {activeTab === 'rejected' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Rejection Code</th>
                  <th className="py-3 px-4">Material Code & Name</th>
                  <th className="py-3 px-4">Supplier Lot</th>
                  <th className="py-3 px-4 text-right">Qty Rejected</th>
                  <th className="py-3 px-4">Reason for Rejection</th>
                  <th className="py-3 px-4">Evidence Attachments</th>
                  <th className="py-3 px-4">Disposition</th>
                  <th className="py-3 px-4">Rejected By</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {loading ? (
                  <tr><td colSpan="9" className="text-center py-8 text-slate-400">Loading rejected materials...</td></tr>
                ) : rejectedMaterials.length === 0 ? (
                  <tr><td colSpan="9" className="text-center py-8 text-slate-400">No rejected material records found.</td></tr>
                ) : (
                  rejectedMaterials.map(rej => (
                    <tr key={rej.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono font-bold text-rose-600">{rej.rejection_code}</td>
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-slate-900">{rej.material_code}</span>
                        <span className="block font-bold text-slate-800">{rej.material_name}</span>
                        <span className="inline-block mt-0.5 px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                          {rej.material_type === 'PACKAGING' ? '📦 Packaging' : rej.material_type === 'FINISHED_GOODS' ? '🏭 Finished Product' : '🧪 Raw Material'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {rej.supplier_lot_number || 'N/A'}
                        {rej.supplier_name && <span className="block text-[10px] text-slate-400">{rej.supplier_name}</span>}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-700">{Number(rej.rejected_quantity).toFixed(2)} {rej.uom}</td>
                      <td className="py-3 px-4 text-slate-700 max-w-[200px] truncate">{rej.reason}</td>
                      <td className="py-3 px-4">
                        {rej.attachments && rej.attachments.length > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-800 rounded-full text-[11px] font-bold">
                            <Paperclip className="w-3 h-3 text-slate-500" />
                            <span>{rej.attachments.length} File(s)</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">No files</span>
                        )}
                      </td>
                      <td className="py-3 px-4">{getDispositionBadge(rej.disposition)}</td>
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {rej.rejected_by_first_name} {rej.rejected_by_last_name}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1">
                        <button
                          onClick={() => {
                            setSelectedRejection(rej);
                            setIsRejectionDetailModalOpen(true);
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg transition text-[11px]"
                        >
                          View Detail & Evidence
                        </button>
                        <button
                          onClick={() => {
                            setSelectedRejection(rej);
                            setTargetDisposition(rej.disposition || 'Pending Review');
                            setDispositionNotes(rej.disposition_notes || '');
                            setIsDispositionModalOpen(true);
                          }}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition text-[11px]"
                        >
                          Disposition
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: STOCK IN MODAL */}
      {/* ========================================================================= */}
      {isStockInModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-2xl overflow-hidden shadow-2xl space-y-4 p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-base text-slate-900">Material Stock In / Receiving Entry</h3>
              </div>
              <button onClick={() => setIsStockInModalOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStockInSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Item Category Type</label>
                  <select
                    value={stockInForm.itemType}
                    onChange={e => setStockInForm(prev => ({ ...prev, itemType: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  >
                    <option value="RAW_MATERIAL">Raw Material</option>
                    <option value="PACKAGING">Packaging Material</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Select Material Master</label>
                  <select
                    value={stockInForm.materialId}
                    onChange={e => setStockInForm(prev => ({ ...prev, materialId: e.target.value }))}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  >
                    <option value="">-- Choose Material --</option>
                    {materialsList.map(m => (
                      <option key={m.id} value={m.id}>
                        [{m.code}] {m.name} ({m.uom})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Internal Lot Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. RM-2026-001"
                    value={stockInForm.lotNumber}
                    onChange={e => setStockInForm(prev => ({ ...prev, lotNumber: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Supplier Lot / Batch No.</label>
                  <input
                    type="text"
                    placeholder="e.g. SUP-LOT-98765"
                    value={stockInForm.supplierLotNumber}
                    onChange={e => setStockInForm(prev => ({ ...prev, supplierLotNumber: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Quantity Received</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="500.00"
                    value={stockInForm.quantity}
                    onChange={e => setStockInForm(prev => ({ ...prev, quantity: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">UOM</label>
                  <input
                    type="text"
                    value={stockInForm.uom}
                    onChange={e => setStockInForm(prev => ({ ...prev, uom: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Storage Location</label>
                  <select
                    value={stockInForm.location}
                    onChange={e => setStockInForm(prev => ({ ...prev, location: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  >
                    <option value="RM-WH-A">RM-WH-A (Raw Material Warehouse A)</option>
                    <option value="PKG-WH-B">PKG-WH-B (Packaging Warehouse)</option>
                    <option value="FG-WH-MAIN">FG-WH-MAIN (Finished Goods Main)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Expiration Date</label>
                  <input
                    type="date"
                    value={stockInForm.expirationDate}
                    onChange={e => setStockInForm(prev => ({ ...prev, expirationDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">COA Reference Number</label>
                  <input
                    type="text"
                    placeholder="COA-2026-XXXX"
                    value={stockInForm.coaReference}
                    onChange={e => setStockInForm(prev => ({ ...prev, coaReference: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Receiving Remarks / Notes</label>
                <input
                  type="text"
                  value={stockInForm.reason}
                  onChange={e => setStockInForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsStockInModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm"
                >
                  Confirm Stock In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: OPERATIONS MODAL (STOCK OUT, ADJUST, TRANSFER) */}
      {/* ========================================================================= */}
      {isOpModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-md overflow-hidden shadow-2xl space-y-4 p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900">
                {opType === 'STOCK_OUT' && 'Stock Out / Material Dispatch'}
                {opType === 'ADJUST' && 'Adjust Stock Balance'}
                {opType === 'TRANSFER' && 'Relocate / Transfer Stock'}
              </h3>
              <button onClick={() => setIsOpModalOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
              <p className="font-bold text-slate-900">{selectedItem.material_name || selectedItem.product_name}</p>
              <p className="font-mono text-slate-500">Lot: <span className="font-bold text-slate-800">{selectedItem.lot_number}</span> • Current Stock: <span className="font-bold text-blue-600">{Number(selectedItem.current_stock).toFixed(2)} {selectedItem.uom}</span></p>
            </div>

            <form onSubmit={handleOpSubmit} className="space-y-4">
              {opType === 'ADJUST' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">New Adjusted Physical Stock</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={opForm.newQuantity}
                    onChange={e => setOpForm(prev => ({ ...prev, newQuantity: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Quantity ({selectedItem.uom})</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="Enter quantity"
                    value={opForm.quantity}
                    onChange={e => setOpForm(prev => ({ ...prev, quantity: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
              )}

              {opType === 'TRANSFER' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Destination Location</label>
                  <select
                    value={opForm.toLocation}
                    onChange={e => setOpForm(prev => ({ ...prev, toLocation: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  >
                    <option value="PROD-LINE-1">PROD-LINE-1 (Shop Floor Compounding)</option>
                    <option value="RM-WH-A">RM-WH-A (Raw Material Warehouse A)</option>
                    <option value="PKG-WH-B">PKG-WH-B (Packaging Warehouse)</option>
                    <option value="FG-WH-MAIN">FG-WH-MAIN (Finished Goods Main)</option>
                    <option value="Rejected Material Area">Rejected Material Area</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Reason / Reference Note</label>
                <input
                  type="text"
                  required
                  placeholder="Explain reason for transaction"
                  value={opForm.reason}
                  onChange={e => setOpForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsOpModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm"
                >
                  Submit Operation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CREATE MATERIAL REJECTION MODAL WITH ATTACHMENTS */}
      {/* ========================================================================= */}
      {isRejectionModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-base text-slate-900">Log Rejected Material & Supporting Evidence</h3>
              </div>
              <button onClick={() => setIsRejectionModalOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRejectionSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Select Material Master</label>
                  <select
                    value={rejectionForm.materialId}
                    onChange={e => {
                      const mat = materialsList.find(m => String(m.id) === e.target.value);
                      setRejectionForm(prev => ({
                        ...prev,
                        materialId: e.target.value,
                        materialCode: mat ? mat.code : '',
                        materialName: mat ? mat.name : '',
                        uom: mat ? mat.uom : 'kg',
                      }));
                    }}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  >
                    <option value="">-- Choose Material --</option>
                    {materialsList.map(m => (
                      <option key={m.id} value={m.id}>[{m.code}] {m.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Material Type / Category</label>
                  <select
                    value={rejectionForm.materialType}
                    onChange={e => setRejectionForm(prev => ({ ...prev, materialType: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  >
                    <option value="RAW_MATERIAL">🧪 Raw Material</option>
                    <option value="PACKAGING">📦 Packaging Material</option>
                    <option value="FINISHED_GOODS">🏭 Finished Product</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Supplier Lot Number</label>
                  <input
                    type="text"
                    required
                    placeholder="SUP-LOT-XXXX"
                    value={rejectionForm.supplierLotNumber}
                    onChange={e => setRejectionForm(prev => ({ ...prev, supplierLotNumber: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Rejected Quantity</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="25.00"
                    value={rejectionForm.rejectedQuantity}
                    onChange={e => setRejectionForm(prev => ({ ...prev, rejectedQuantity: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">UOM</label>
                  <input
                    type="text"
                    value={rejectionForm.uom}
                    onChange={e => setRejectionForm(prev => ({ ...prev, uom: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Reason for Rejection</label>
                <textarea
                  required
                  rows="2"
                  placeholder="e.g. Cracked container discovered during receiving, contamination, expired supplier lot..."
                  value={rejectionForm.reason}
                  onChange={e => setRejectionForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                />
              </div>

              {/* ATTACHMENT EVIDENCE UPLOAD SECTION */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-slate-900">Upload Evidence & Supporting Attachments</span>
                  </div>
                  <span className="text-[11px] text-slate-400">JPG, PNG, WEBP, PDF, DOC, XLS</span>
                </div>

                {/* Dropzone File Picker */}
                <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-4 text-center cursor-pointer bg-white transition relative">
                  <input
                    type="file"
                    multiple
                    accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx"
                    onChange={handleFileSelect}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div className="flex flex-col items-center space-y-1">
                    <Paperclip className="w-6 h-6 text-slate-400" />
                    <p className="text-xs font-bold text-slate-700">Drag & Drop photos or documents here</p>
                    <p className="text-[10px] text-slate-400">or click to browse files</p>
                  </div>
                </div>

                {/* File Previews List */}
                {attachmentFiles.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <p className="text-xs font-bold text-slate-800">{attachmentFiles.length} File(s) Selected:</p>
                    {attachmentFiles.map(file => (
                      <div key={file.id} className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl text-xs gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {file.mimeType.includes('image') ? (
                            <img src={file.dataBase64} alt={file.filename} className="w-8 h-8 rounded object-cover shrink-0" />
                          ) : (
                            <FileText className="w-6 h-6 text-blue-600 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate">{file.filename}</p>
                            <p className="text-[10px] text-slate-400">{(file.fileSize / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>

                        <input
                          type="text"
                          placeholder="Optional file description..."
                          value={file.description}
                          onChange={e => updateAttachmentDescription(file.id, e.target.value)}
                          className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] w-44"
                        />

                        <button
                          type="button"
                          onClick={() => removeAttachmentFile(file.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRejectionModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadingFiles}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-2"
                >
                  {uploadingFiles && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  <span>Save Rejection Record</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: REJECTION DETAIL & ATTACHMENTS EVIDENCE VIEWER */}
      {/* ========================================================================= */}
      {isRejectionDetailModalOpen && selectedRejection && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-base text-slate-900">Rejection Detail & Evidence Ledger ({selectedRejection.rejection_code})</h3>
              </div>
              <button onClick={() => setIsRejectionDetailModalOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs">
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold">Material Code & Name</p>
                <p className="font-mono font-bold text-blue-600">{selectedRejection.material_code}</p>
                <p className="font-bold text-slate-900">{selectedRejection.material_name}</p>
              </div>

              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold">Supplier Lot</p>
                <p className="font-mono font-bold text-slate-800">{selectedRejection.supplier_lot_number || 'N/A'}</p>
                <p className="text-slate-500">{selectedRejection.supplier_name}</p>
              </div>

              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold">Quantity Rejected</p>
                <p className="font-mono font-bold text-rose-600 text-sm">{Number(selectedRejection.rejected_quantity).toFixed(2)} {selectedRejection.uom}</p>
              </div>

              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold">Location</p>
                <p className="font-bold text-slate-800">{selectedRejection.location}</p>
              </div>

              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold">Current Disposition</p>
                {getDispositionBadge(selectedRejection.disposition)}
              </div>

              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold">Rejected By</p>
                <p className="font-bold text-slate-800">{selectedRejection.rejected_by_first_name} {selectedRejection.rejected_by_last_name}</p>
                <p className="text-[10px] text-slate-400">{new Date(selectedRejection.date_rejected).toLocaleString()}</p>
              </div>
            </div>

            <div className="p-4 bg-rose-50/50 border border-rose-200 rounded-2xl text-xs space-y-1">
              <p className="font-bold text-rose-900">Reason for Rejection:</p>
              <p className="text-slate-700 leading-relaxed">{selectedRejection.reason}</p>
            </div>

            {/* Evidence Attachments Grid */}
            <div className="space-y-3">
              <h4 className="font-bold text-xs text-slate-900 flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-blue-600" />
                <span>Supporting Attachments & Photos ({selectedRejection.attachments ? selectedRejection.attachments.length : 0})</span>
              </h4>

              {selectedRejection.attachments && selectedRejection.attachments.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedRejection.attachments.map(att => (
                    <div key={att.attachment_id} className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between text-xs gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {att.mime_type.includes('image') ? (
                          <div
                            onClick={() => setLightboxImage(`/api/v1/attachments/${att.attachment_id}/download`)}
                            className="w-12 h-12 rounded-xl bg-slate-200 shrink-0 overflow-hidden cursor-pointer hover:opacity-80 relative group"
                          >
                            <img src={`/api/v1/attachments/${att.attachment_id}/download`} alt={att.filename} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                              <Maximize2 className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold">
                            <FileText className="w-6 h-6" />
                          </div>
                        )}

                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">{att.filename}</p>
                          {att.attachment_description && <p className="text-[11px] text-slate-600 italic truncate">{att.attachment_description}</p>}
                          <p className="text-[10px] text-slate-400">By {att.uploader_first_name} • {(att.file_size / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>

                      <a
                        href={`/api/v1/attachments/${att.attachment_id}/download`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 font-bold rounded-xl text-xs flex items-center gap-1 shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Open</span>
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic bg-slate-50 p-4 rounded-xl text-center">No supporting attachments uploaded for this rejection record.</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsRejectionDetailModalOpen(false)}
                className="px-5 py-2 bg-slate-800 text-white font-bold text-xs rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: DISPOSITION MODAL */}
      {/* ========================================================================= */}
      {isDispositionModalOpen && selectedRejection && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900">Set Rejection Disposition ({selectedRejection.rejection_code})</h3>
              <button onClick={() => setIsDispositionModalOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDispositionSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Disposition Action</label>
                <select
                  value={targetDisposition}
                  onChange={e => setTargetDisposition(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                >
                  <option value="Pending Review">Pending Review</option>
                  <option value="For Return">For Return</option>
                  <option value="For Disposal">For Disposal</option>
                  <option value="For Rework">For Rework</option>
                  <option value="Approved for Reuse">Approved for Reuse</option>
                  <option value="Returned to Supplier">Returned to Supplier</option>
                  <option value="Disposed">Disposed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Disposition Notes / Instructions</label>
                <textarea
                  rows="3"
                  placeholder="Enter disposition decision notes..."
                  value={dispositionNotes}
                  onChange={e => setDispositionNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDispositionModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl shadow-sm"
                >
                  Save Disposition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: TRACEABILITY INSPECTOR MODAL */}
      {/* ========================================================================= */}
      {isTraceabilityModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-base text-slate-900">Forward & Reverse Lot Traceability Tree</h3>
              </div>
              <button onClick={() => setIsTraceabilityModalOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter Batch Number (BAT-0028) or Raw Material Lot (RM-2026-001)..."
                value={traceabilityQuery}
                onChange={e => setTraceabilityQuery(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold"
              />
              <button
                onClick={() => handleTraceabilitySearch()}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm"
              >
                Inspect Traceability
              </button>
            </div>

            {loadingTraceability ? (
              <div className="text-center py-12 text-slate-400">Tracing lot genealogy...</div>
            ) : traceabilityData ? (
              <div className="space-y-4 pt-2">
                {traceabilityData.type === 'FINISHED_PRODUCT_TRACEABILITY' ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl text-xs space-y-1">
                      <p className="font-bold text-blue-900 text-sm">Finished Product Batch: {traceabilityData.batch.batch_number}</p>
                      <p className="text-blue-700">Formula: <span className="font-bold">{traceabilityData.formula.name}</span> ({traceabilityData.formula.code}) • Version: {traceabilityData.formula.version}</p>
                      <p className="text-blue-700">Compounding Code: <span className="font-bold font-mono text-blue-800">{traceabilityData.formula.compoundingCode || 'CP-0028'}</span></p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-bold text-xs text-slate-900">Raw Material Lots Weighed in Compounding:</h4>
                      <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                        <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[11px]">
                          <tr>
                            <th className="py-2.5 px-3">Material Code</th>
                            <th className="py-2.5 px-3">Material Name</th>
                            <th className="py-2.5 px-3 text-right">Actual Weight</th>
                            <th className="py-2.5 px-3">Weighed By</th>
                            <th className="py-2.5 px-3">Weighed At</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {traceabilityData.actualWeighedMaterials.map(m => (
                            <tr key={m.id}>
                              <td className="py-2 px-3 font-mono font-bold text-blue-600">{m.material_code}</td>
                              <td className="py-2 px-3 font-bold text-slate-900">{m.material_name}</td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">{Number(m.actual_weight).toFixed(4)} kg</td>
                              <td className="py-2 px-3 text-slate-600">{m.operator_first_name} {m.operator_last_name}</td>
                              <td className="py-2 px-3 text-slate-400 text-[10px]">{new Date(m.weighed_at).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs space-y-1">
                      <p className="font-bold text-emerald-900 text-sm">Raw Material Lot: {traceabilityData.lot.lot_number}</p>
                      <p className="text-emerald-700">Material: <span className="font-bold">{traceabilityData.lot.material_name}</span> ({traceabilityData.lot.material_code})</p>
                      <p className="text-emerald-700">Supplier: {traceabilityData.lot.vendor_name || 'N/A'} • Supplier Lot: {traceabilityData.lot.supplier_lot_number || 'N/A'}</p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-bold text-xs text-slate-900">Batches & Finished Products Consuming this Lot:</h4>
                      <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                        <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[11px]">
                          <tr>
                            <th className="py-2.5 px-3">Batch Number</th>
                            <th className="py-2.5 px-3">Product / Formula</th>
                            <th className="py-2.5 px-3 text-right">Qty Consumed</th>
                            <th className="py-2.5 px-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {traceabilityData.consumedInBatches.map(b => (
                            <tr key={b.id}>
                              <td className="py-2 px-3 font-mono font-bold text-blue-600">{b.batch_number}</td>
                              <td className="py-2 px-3 font-bold text-slate-900">{b.formula_name}</td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">{Number(b.actual_weight).toFixed(4)} kg</td>
                              <td className="py-2 px-3 font-bold text-slate-700">{b.batch_status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 7: CREATE PURCHASE REQUEST TO PURCHASING DEPT */}
      {/* ========================================================================= */}
      {isPurchaseRequestModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-base text-slate-900">Create Item Purchase Request</h3>
              </div>
              <button onClick={() => setIsPurchaseRequestModalOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePurchaseRequestSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Material or Type Item Name <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  list="materials-datalist"
                  placeholder="e.g. Glycerin USP 99.7% or Glass Bottle 50ml..."
                  value={purchaseRequestForm.itemName}
                  onChange={e => {
                    const val = e.target.value;
                    const foundMat = materialsList.find(m => m.name.toLowerCase() === val.toLowerCase());
                    setPurchaseRequestForm(prev => ({
                      ...prev,
                      itemName: val,
                      materialId: foundMat ? foundMat.id : '',
                      uom: foundMat ? (foundMat.default_uom || 'kg') : prev.uom,
                    }));
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                  required
                />
                <datalist id="materials-datalist">
                  {materialsList.map(m => (
                    <option key={m.id} value={m.name}>{m.code} - {m.category || 'Material'}</option>
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Requested Quantity <span className="text-rose-500">*</span></label>
                  <input
                    type="number"
                    step="any"
                    min="0.001"
                    placeholder="e.g. 50"
                    value={purchaseRequestForm.requestedQuantity}
                    onChange={e => setPurchaseRequestForm(prev => ({ ...prev, requestedQuantity: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono text-slate-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Unit of Measure (UOM)</label>
                  <select
                    value={purchaseRequestForm.uom}
                    onChange={e => setPurchaseRequestForm(prev => ({ ...prev, uom: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="L">L</option>
                    <option value="mL">mL</option>
                    <option value="pcs">pcs</option>
                    <option value="packs">packs</option>
                    <option value="boxes">boxes</option>
                    <option value="bottles">bottles</option>
                    <option value="jars">jars</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Urgency / Priority</label>
                  <select
                    value={purchaseRequestForm.priority}
                    onChange={e => setPurchaseRequestForm(prev => ({ ...prev, priority: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  >
                    <option value="Low">Low Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="High">High Priority</option>
                    <option value="Critical">Critical / Production Halt</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Needed By Date</label>
                  <input
                    type="date"
                    value={purchaseRequestForm.neededByDate}
                    onChange={e => setPurchaseRequestForm(prev => ({ ...prev, neededByDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Preferred Supplier / Vendor (Optional)</label>
                <select
                  value={purchaseRequestForm.vendorId}
                  onChange={e => setPurchaseRequestForm(prev => ({ ...prev, vendorId: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                >
                  <option value="">No Preferred Vendor (Purchasing Chooses)</option>
                  {vendorsList.map(v => (
                    <option key={v.id} value={v.id}>{v.name} ({v.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Justification / Reason for Requisition</label>
                <textarea
                  rows="3"
                  placeholder="e.g. Stock level below safety buffer for upcoming batch compounding..."
                  value={purchaseRequestForm.justification}
                  onChange={e => setPurchaseRequestForm(prev => ({ ...prev, justification: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPurchaseRequestModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-2"
                >
                  <Building2 className="w-4 h-4" />
                  <span>Submit Requisition</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LIGHTBOX IMAGE ZOOM MODAL */}
      {lightboxImage && (
        <div className="fixed inset-0 bg-slate-950/90 z-60 flex items-center justify-center p-4" onClick={() => setLightboxImage(null)}>
          <div className="relative max-w-4xl max-h-[90vh]">
            <img src={lightboxImage} alt="Evidence Zoom" className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain" />
            <button onClick={() => setLightboxImage(null)} className="absolute -top-10 right-0 text-white font-bold text-sm bg-slate-800 p-2 rounded-full">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default InventoryPage;
