import React, { useState } from 'react';
import {
  FileText,
  Printer,
  Send,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Calendar,
  Sparkles,
} from 'lucide-react';
import RichFontToolbar from '../components/RichFontToolbar';
import { printSampleRequestForm } from '../utils/printSampleRequestForm';
import { useAuth } from '../context/AuthContext';

const FIELD_LABELS = {
  revisionNo: 'Revision No',
  requestDate: 'Request Date',
  companyName: 'Company Name',
  address: 'Address',
  contactPerson: 'Contact Person',
  productName: '1. Name / Description',
  productClassification: '2. Classification of Product',
  benchmark: '3. Benchmark If Any',
  specificRawMaterials: '4.1 Specific RAW MATERIALS',
  texture: '4.2 Texture',
  form: '4.3 Form',
  scentAromaDirection: '4.4 Scent/Aroma Direction',
  colorDescription: '4.5 Color Description',
  flavor: '4.6 Flavor',
  functionClaims: '4.7 Function / Claims',
  directionOfUse: '4.8 Direction of Products',
  netContent: '4.9 Net Content',
  targetPrice: '4.10 Target Price',
  specialInstructions: '4.11 Special Instructions',
  quantity: '4.12 Quantity',
  primaryPackaging: '5.1 Primary Packaging',
  remarks: '6. Remarks',
  requestedByName: 'Requested By Signature',
  notedByName: 'Noted By Signature',
  receivedByName: 'Received By Signature',
};

const DEFAULT_STYLE = {
  fontFamily: 'Aptos, sans-serif',
  fontSize: '14',
  isBold: false,
  isItalic: false,
  isUnderline: false,
  isStrikethrough: false,
  textColor: '#000000',
  highlightColor: '#ffffff',
  textAlign: 'left',
};

export default function SampleRequestPage({ setCurrentPage }) {
  const { user } = useAuth();

  // Active focused field
  const [activeField, setActiveField] = useState('companyName');

  // Per-field styling map
  const [fieldStyles, setFieldStyles] = useState({});

  const [formData, setFormData] = useState({
    revisionNo: '',
    requestDate: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
    companyName: '',
    address: '',
    contactPerson: '',
    productName: '',
    productClassification: 'Cosmetics',
    benchmark: '',
    specificRawMaterials: '',
    texture: '',
    form: '',
    scentAromaDirection: '',
    colorDescription: '',
    flavor: '',
    functionClaims: '',
    directionOfUse: '',
    netContent: '',
    targetPrice: '',
    specialInstructions: '',
    quantity: '',
    primaryPackaging: '',
    remarks: '',
    requestedByName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.username || 'MSM',
    notedByName: '',
    receivedByName: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(null);
  const [submitError, setSubmitError] = useState(null);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Set Request Date to Today
  const handleSetTodayDate = () => {
    const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    setFormData((prev) => ({ ...prev, requestDate: todayStr }));
  };

  // Helper to update specific style property for active focused field
  const handleStyleChange = (key, value) => {
    if (!activeField) return;
    setFieldStyles((prev) => ({
      ...prev,
      [activeField]: {
        ...(prev[activeField] || DEFAULT_STYLE),
        [key]: value,
      },
    }));
  };

  // Helper to get active style of focused field for toolbar controls
  const activeStyle = fieldStyles[activeField] || DEFAULT_STYLE;

  // Helper to compute inline HTML input style for a given field
  const getFieldInputStyle = (fieldName) => {
    const s = fieldStyles[fieldName] || DEFAULT_STYLE;
    return {
      fontFamily: s.fontFamily || DEFAULT_STYLE.fontFamily,
      fontSize: `${s.fontSize || DEFAULT_STYLE.fontSize}px`,
      fontWeight: s.isBold ? 'bold' : 'normal',
      fontStyle: s.isItalic ? 'italic' : 'normal',
      textDecoration: [s.isUnderline && 'underline', s.isStrikethrough && 'line-through'].filter(Boolean).join(' ') || 'none',
      color: s.textColor || '#000000',
      backgroundColor: s.highlightColor || '#ffffff',
      textAlign: s.textAlign || 'left',
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitSuccess(null);
    setSubmitError(null);

    const payload = {
      ...formData,
      formattedContentJson: fieldStyles,
    };

    try {
      const token = localStorage.getItem('nkb_access_token');
      const res = await fetch('/api/v1/sample-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to submit sample request.');
      }

      setSubmitSuccess(`Sample Request submitted successfully! Code: ${data.requestCode}`);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    printSampleRequestForm({
      request_code: 'SRF-2026-DRAFT',
      revision_no: formData.revisionNo,
      request_date: formData.requestDate,
      company_name: formData.companyName,
      address: formData.address,
      contact_person: formData.contactPerson,
      product_name: formData.productName,
      product_classification: formData.productClassification,
      benchmark: formData.benchmark,
      specific_raw_materials: formData.specificRawMaterials,
      texture: formData.texture,
      form: formData.form,
      scent_aroma_direction: formData.scentAromaDirection,
      color_description: formData.colorDescription,
      flavor: formData.flavor,
      function_claims: formData.functionClaims,
      direction_of_use: formData.directionOfUse,
      net_content: formData.netContent,
      target_price: formData.targetPrice,
      special_instructions: formData.specialInstructions,
      quantity: formData.quantity,
      primary_packaging: formData.primaryPackaging,
      remarks: formData.remarks,
      requested_by_name: formData.requestedByName,
      noted_by_name: formData.notedByName,
      received_by_name: formData.receivedByName,
      status: 'PENDING',
      field_styles: fieldStyles,
    });
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <FileText className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-900">SAMPLE REQUEST FORM</h1>
              <p className="text-xs text-slate-500">Client Product Sample Request Specification & Intake Form</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {setCurrentPage && (
            <button
              type="button"
              onClick={() => setCurrentPage('sample-requests-list')}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs transition flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              View All Requests
            </button>
          )}
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-semibold text-xs shadow-xs transition flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4 text-slate-300" />
            Save as PDF / Print
          </button>
        </div>
      </div>

      {/* Floating Word-Style Rich Font Toolbar targeting ONLY the focused field */}
      <div className="sticky top-2 z-30 shadow-md">
        <RichFontToolbar
          activeFieldLabel={FIELD_LABELS[activeField] || activeField}
          activeFont={activeStyle.fontFamily}
          activeFontSize={activeStyle.fontSize}
          isBold={activeStyle.isBold}
          isItalic={activeStyle.isItalic}
          isUnderline={activeStyle.isUnderline}
          isStrikethrough={activeStyle.isStrikethrough}
          textColor={activeStyle.textColor}
          highlightColor={activeStyle.highlightColor}
          textAlign={activeStyle.textAlign}
          onStyleChange={handleStyleChange}
        />
      </div>

      {/* Form Submission Alerts */}
      {submitSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{submitSuccess}</span>
        </div>
      )}
      {submitError && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* FORM CONTAINER — Exact Replica of Uploaded PDF */}
        <div className="bg-white border-2 border-slate-900 rounded-xl shadow-md overflow-hidden">
          {/* Header Metadata Table */}
          <div className="grid grid-cols-12 border-b-2 border-slate-900 divide-x-2 divide-slate-900">
            <div className="col-span-3 p-3 flex items-center justify-center bg-slate-50">
              <img src="/nkb-logo.png" alt="NKB Logo" className="max-h-12 object-contain" onError={(e) => (e.target.style.display = 'none')} />
            </div>
            <div className="col-span-6 p-4 text-center font-extrabold text-lg sm:text-xl tracking-wide flex items-center justify-center bg-white text-slate-900">
              SAMPLE REQUEST FORM
            </div>
            <div className="col-span-3 p-3 bg-slate-50 text-xs font-bold space-y-2 flex flex-col justify-center">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 uppercase shrink-0">REVISION NO:</span>
                <input
                  type="text"
                  value={formData.revisionNo}
                  onFocus={() => setActiveField('revisionNo')}
                  onChange={(e) => handleChange('revisionNo', e.target.value)}
                  className="w-full px-2 py-0.5 border border-slate-300 rounded font-bold text-slate-900 focus:bg-amber-50"
                  style={getFieldInputStyle('revisionNo')}
                />
              </div>

              {/* DATE PICKER WITH MMM DD, YYYY FORMAT AND TODAY BUTTON */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 uppercase shrink-0">DATE:</span>
                  <div className="relative w-full flex items-center gap-1">
                    <input
                      type="text"
                      value={formData.requestDate}
                      onFocus={() => setActiveField('requestDate')}
                      onChange={(e) => handleChange('requestDate', e.target.value)}
                      placeholder="e.g. Aug 28, 2026"
                      className="w-full px-2 py-0.5 border border-slate-300 rounded font-bold text-slate-900 focus:bg-amber-50"
                      style={getFieldInputStyle('requestDate')}
                    />
                    <label className="p-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded cursor-pointer shrink-0 transition" title="Pick Date from Calendar">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      <input
                        type="date"
                        className="sr-only"
                        onChange={(e) => {
                          if (!e.target.value) return;
                          const d = new Date(e.target.value);
                          const formatted = isNaN(d.getTime()) ? e.target.value : d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
                          handleChange('requestDate', formatted);
                        }}
                      />
                    </label>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-mono text-blue-600 font-bold truncate">Format: (MMM DD, YYYY)</span>
                  <button
                    type="button"
                    onClick={handleSetTodayDate}
                    className="px-2 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded font-bold text-[10px] flex items-center gap-1 shrink-0 transition"
                  >
                    <Calendar className="w-3 h-3 text-blue-600" />
                    Today
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* PART I: CLIENT PROFILE */}
          <div className="bg-slate-400 text-slate-950 font-extrabold text-xs text-center py-2 border-b border-slate-900 tracking-wider">
            PART I: CLIENT PROFILE
          </div>
          <div className="divide-y divide-slate-300 text-xs">
            <div className="grid grid-cols-12 p-2.5 items-center">
              <div className="col-span-4 sm:col-span-3 font-bold text-slate-900 uppercase">COMPANY NAME:</div>
              <div className="col-span-8 sm:col-span-9">
                <input
                  type="text"
                  required
                  placeholder="Enter client company name"
                  value={formData.companyName}
                  onFocus={() => setActiveField('companyName')}
                  onChange={(e) => handleChange('companyName', e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  style={getFieldInputStyle('companyName')}
                />
              </div>
            </div>
            <div className="grid grid-cols-12 p-2.5 items-center">
              <div className="col-span-4 sm:col-span-3 font-bold text-slate-900 uppercase">ADDRESS:</div>
              <div className="col-span-8 sm:col-span-9">
                <input
                  type="text"
                  placeholder="Enter client address"
                  value={formData.address}
                  onFocus={() => setActiveField('address')}
                  onChange={(e) => handleChange('address', e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  style={getFieldInputStyle('address')}
                />
              </div>
            </div>
            <div className="grid grid-cols-12 p-2.5 items-center">
              <div className="col-span-4 sm:col-span-3 font-bold text-slate-900 uppercase">CONTACT PERSON:</div>
              <div className="col-span-8 sm:col-span-9">
                <input
                  type="text"
                  placeholder="Enter contact person name & phone/email"
                  value={formData.contactPerson}
                  onFocus={() => setActiveField('contactPerson')}
                  onChange={(e) => handleChange('contactPerson', e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  style={getFieldInputStyle('contactPerson')}
                />
              </div>
            </div>
          </div>

          {/* PART II: PRODUCT SAMPLE REQUEST SPECIFICATION */}
          <div className="bg-slate-400 text-slate-950 font-extrabold text-xs text-center py-2 border-t-2 border-b border-slate-900 tracking-wider">
            PART II: PRODUCT SAMPLE REQUEST SPECIFICATION
          </div>
          <div className="divide-y divide-slate-300 text-xs">
            {/* 1. Name / Description */}
            <div className="grid grid-cols-12 p-2.5 items-center">
              <div className="col-span-4 sm:col-span-4 font-bold text-slate-900 uppercase">1. NAME / DESCRIPTION:</div>
              <div className="col-span-8 sm:col-span-8">
                <input
                  type="text"
                  required
                  placeholder="Target product name or description"
                  value={formData.productName}
                  onFocus={() => setActiveField('productName')}
                  onChange={(e) => handleChange('productName', e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  style={getFieldInputStyle('productName')}
                />
              </div>
            </div>

            {/* 2. Classification of Product */}
            <div className="grid grid-cols-12 p-2.5 items-center">
              <div className="col-span-4 sm:col-span-4 font-bold text-slate-900 uppercase">2. CLASSIFICATION OF PRODUCT:</div>
              <div className="col-span-8 sm:col-span-8">
                <select
                  value={formData.productClassification}
                  onFocus={() => setActiveField('productClassification')}
                  onChange={(e) => handleChange('productClassification', e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  style={getFieldInputStyle('productClassification')}
                >
                  <option value="Cosmetics">Cosmetics</option>
                  <option value="Personal Care">Personal Care</option>
                  <option value="Perfume Concentrate">Perfume Concentrate</option>
                  <option value="Fine Fragrance">Fine Fragrance</option>
                  <option value="Food Supplement">Food Supplement</option>
                  <option value="Household Product">Household Product</option>
                </select>
              </div>
            </div>

            {/* 3. Benchmark If Any */}
            <div className="grid grid-cols-12 p-2.5 items-center">
              <div className="col-span-4 sm:col-span-4 font-bold text-slate-900 uppercase">3. BENCHMARK IF ANY:</div>
              <div className="col-span-8 sm:col-span-8">
                <input
                  type="text"
                  placeholder="Target benchmark brand or sample reference"
                  value={formData.benchmark}
                  onFocus={() => setActiveField('benchmark')}
                  onChange={(e) => handleChange('benchmark', e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  style={getFieldInputStyle('benchmark')}
                />
              </div>
            </div>

            {/* 4. Detailed Description Header */}
            <div className="bg-slate-100 p-2.5 font-bold text-slate-900 uppercase tracking-wide">
              4. DETAILED DESCRIPTION OF PRODUCT
            </div>

            {/* 4.1 to 4.12 Sub-fields */}
            <div className="pl-4 sm:pl-6 divide-y divide-slate-200">
              <div className="grid grid-cols-12 p-2 items-center">
                <div className="col-span-5 sm:col-span-4 font-semibold text-slate-800">4.1 Specific RAW MATERIALS:</div>
                <div className="col-span-7 sm:col-span-8">
                  <input
                    type="text"
                    placeholder="Key actives, oils, or target ingredients"
                    value={formData.specificRawMaterials}
                    onFocus={() => setActiveField('specificRawMaterials')}
                    onChange={(e) => handleChange('specificRawMaterials', e.target.value)}
                    className="w-full px-2.5 py-1 border border-slate-300 rounded"
                    style={getFieldInputStyle('specificRawMaterials')}
                  />
                </div>
              </div>
              <div className="grid grid-cols-12 p-2 items-center">
                <div className="col-span-5 sm:col-span-4 font-semibold text-slate-800">4.2 Texture:</div>
                <div className="col-span-7 sm:col-span-8">
                  <input
                    type="text"
                    placeholder="Creamy, liquid, gel, serum, powder"
                    value={formData.texture}
                    onFocus={() => setActiveField('texture')}
                    onChange={(e) => handleChange('texture', e.target.value)}
                    className="w-full px-2.5 py-1 border border-slate-300 rounded"
                    style={getFieldInputStyle('texture')}
                  />
                </div>
              </div>
              <div className="grid grid-cols-12 p-2 items-center">
                <div className="col-span-5 sm:col-span-4 font-semibold text-slate-800">4.3 Form:</div>
                <div className="col-span-7 sm:col-span-8">
                  <input
                    type="text"
                    placeholder="Emulsion, solution, lotion, stick"
                    value={formData.form}
                    onFocus={() => setActiveField('form')}
                    onChange={(e) => handleChange('form', e.target.value)}
                    className="w-full px-2.5 py-1 border border-slate-300 rounded"
                    style={getFieldInputStyle('form')}
                  />
                </div>
              </div>
              <div className="grid grid-cols-12 p-2 items-center">
                <div className="col-span-5 sm:col-span-4 font-semibold text-slate-800">4.4 Scent/Aroma Direction:</div>
                <div className="col-span-7 sm:col-span-8">
                  <input
                    type="text"
                    placeholder="Floral, citrus, woody, unscented, fruity"
                    value={formData.scentAromaDirection}
                    onFocus={() => setActiveField('scentAromaDirection')}
                    onChange={(e) => handleChange('scentAromaDirection', e.target.value)}
                    className="w-full px-2.5 py-1 border border-slate-300 rounded"
                    style={getFieldInputStyle('scentAromaDirection')}
                  />
                </div>
              </div>
              <div className="grid grid-cols-12 p-2 items-center">
                <div className="col-span-5 sm:col-span-4 font-semibold text-slate-800">4.5 Color Description:</div>
                <div className="col-span-7 sm:col-span-8">
                  <input
                    type="text"
                    placeholder="White, translucent, pink, pale yellow"
                    value={formData.colorDescription}
                    onFocus={() => setActiveField('colorDescription')}
                    onChange={(e) => handleChange('colorDescription', e.target.value)}
                    className="w-full px-2.5 py-1 border border-slate-300 rounded"
                    style={getFieldInputStyle('colorDescription')}
                  />
                </div>
              </div>
              <div className="grid grid-cols-12 p-2 items-center">
                <div className="col-span-5 sm:col-span-4 font-semibold text-slate-800">4.6 Flavor:</div>
                <div className="col-span-7 sm:col-span-8">
                  <input
                    type="text"
                    placeholder="N/A or flavor details for lip care/supplements"
                    value={formData.flavor}
                    onFocus={() => setActiveField('flavor')}
                    onChange={(e) => handleChange('flavor', e.target.value)}
                    className="w-full px-2.5 py-1 border border-slate-300 rounded"
                    style={getFieldInputStyle('flavor')}
                  />
                </div>
              </div>
              <div className="grid grid-cols-12 p-2 items-center">
                <div className="col-span-5 sm:col-span-4 font-semibold text-slate-800">4.7 Function/ Claims of Products:</div>
                <div className="col-span-7 sm:col-span-8">
                  <input
                    type="text"
                    placeholder="Whitening, moisturizing, anti-aging, SPF"
                    value={formData.functionClaims}
                    onFocus={() => setActiveField('functionClaims')}
                    onChange={(e) => handleChange('functionClaims', e.target.value)}
                    className="w-full px-2.5 py-1 border border-slate-300 rounded"
                    style={getFieldInputStyle('functionClaims')}
                  />
                </div>
              </div>
              <div className="grid grid-cols-12 p-2 items-center">
                <div className="col-span-5 sm:col-span-4 font-semibold text-slate-800">4.8 Direction of Products:</div>
                <div className="col-span-7 sm:col-span-8">
                  <input
                    type="text"
                    placeholder="Apply to clean face twice daily"
                    value={formData.directionOfUse}
                    onFocus={() => setActiveField('directionOfUse')}
                    onChange={(e) => handleChange('directionOfUse', e.target.value)}
                    className="w-full px-2.5 py-1 border border-slate-300 rounded"
                    style={getFieldInputStyle('directionOfUse')}
                  />
                </div>
              </div>
              <div className="grid grid-cols-12 p-2 items-center">
                <div className="col-span-5 sm:col-span-4 font-semibold text-slate-800">4.9 Net Content:</div>
                <div className="col-span-7 sm:col-span-8">
                  <input
                    type="text"
                    placeholder="50 mL, 100 g, 250 mL"
                    value={formData.netContent}
                    onFocus={() => setActiveField('netContent')}
                    onChange={(e) => handleChange('netContent', e.target.value)}
                    className="w-full px-2.5 py-1 border border-slate-300 rounded"
                    style={getFieldInputStyle('netContent')}
                  />
                </div>
              </div>
              <div className="grid grid-cols-12 p-2 items-center">
                <div className="col-span-5 sm:col-span-4 font-semibold text-slate-800">4.10 Target Price:</div>
                <div className="col-span-7 sm:col-span-8">
                  <input
                    type="text"
                    placeholder="PHP 150.00 / unit or USD 3.00"
                    value={formData.targetPrice}
                    onFocus={() => setActiveField('targetPrice')}
                    onChange={(e) => handleChange('targetPrice', e.target.value)}
                    className="w-full px-2.5 py-1 border border-slate-300 rounded"
                    style={getFieldInputStyle('targetPrice')}
                  />
                </div>
              </div>
              <div className="grid grid-cols-12 p-2 items-center">
                <div className="col-span-5 sm:col-span-4 font-semibold text-slate-800">4.11 Special Instruction / Others Specify:</div>
                <div className="col-span-7 sm:col-span-8">
                  <input
                    type="text"
                    placeholder="Paraben-free, sulfate-free, vegan"
                    value={formData.specialInstructions}
                    onFocus={() => setActiveField('specialInstructions')}
                    onChange={(e) => handleChange('specialInstructions', e.target.value)}
                    className="w-full px-2.5 py-1 border border-slate-300 rounded"
                    style={getFieldInputStyle('specialInstructions')}
                  />
                </div>
              </div>
              <div className="grid grid-cols-12 p-2 items-center">
                <div className="col-span-5 sm:col-span-4 font-semibold text-slate-800">4.12 Quantity:</div>
                <div className="col-span-7 sm:col-span-8">
                  <input
                    type="text"
                    placeholder="e.g., 3 sample jars (100g each)"
                    value={formData.quantity}
                    onFocus={() => setActiveField('quantity')}
                    onChange={(e) => handleChange('quantity', e.target.value)}
                    className="w-full px-2.5 py-1 border border-slate-300 rounded"
                    style={getFieldInputStyle('quantity')}
                  />
                </div>
              </div>
            </div>

            {/* 5. Detailed Description of Packaging */}
            <div className="bg-slate-100 p-2.5 font-bold text-slate-900 uppercase tracking-wide">
              5. DETAILED DESCRIPTION OF PACKAGING
            </div>
            <div className="pl-4 sm:pl-6">
              <div className="grid grid-cols-12 p-2 items-center">
                <div className="col-span-5 sm:col-span-4 font-semibold text-slate-800">5.1 Primary Packaging:</div>
                <div className="col-span-7 sm:col-span-8">
                  <input
                    type="text"
                    placeholder="Airless pump bottle, glass jar, tube"
                    value={formData.primaryPackaging}
                    onFocus={() => setActiveField('primaryPackaging')}
                    onChange={(e) => handleChange('primaryPackaging', e.target.value)}
                    className="w-full px-2.5 py-1 border border-slate-300 rounded"
                    style={getFieldInputStyle('primaryPackaging')}
                  />
                </div>
              </div>
            </div>

            {/* 6. Remarks */}
            <div className="grid grid-cols-12 p-2.5 items-center">
              <div className="col-span-4 sm:col-span-4 font-bold text-slate-900 uppercase">6. REMARKS:</div>
              <div className="col-span-8 sm:col-span-8">
                <textarea
                  rows={2}
                  placeholder="Additional notes for formulator"
                  value={formData.remarks}
                  onFocus={() => setActiveField('remarks')}
                  onChange={(e) => handleChange('remarks', e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  style={getFieldInputStyle('remarks')}
                />
              </div>
            </div>
          </div>

          {/* SIGNATURES ROW */}
          <div className="grid grid-cols-3 border-t-2 border-slate-900 divide-x-2 divide-slate-900 bg-slate-50 p-4 text-xs font-bold">
            <div>
              <div className="text-slate-600 mb-6">Requested by:</div>
              <input
                type="text"
                value={formData.requestedByName}
                onFocus={() => setActiveField('requestedByName')}
                onChange={(e) => handleChange('requestedByName', e.target.value)}
                className="w-full px-2 py-1 border-b border-slate-900 bg-transparent font-bold text-slate-900 text-center"
                style={getFieldInputStyle('requestedByName')}
              />
            </div>

            <div>
              <div className="text-slate-600 mb-6">Noted by:</div>
              <input
                type="text"
                value={formData.notedByName}
                onFocus={() => setActiveField('notedByName')}
                onChange={(e) => handleChange('notedByName', e.target.value)}
                className="w-full px-2 py-1 border-b border-slate-900 bg-transparent font-bold text-slate-900 text-center"
                style={getFieldInputStyle('notedByName')}
              />
            </div>

            <div>
              <div className="text-slate-600 mb-6">Received by:</div>
              <input
                type="text"
                value={formData.receivedByName}
                onFocus={() => setActiveField('receivedByName')}
                onChange={(e) => handleChange('receivedByName', e.target.value)}
                className="w-full px-2 py-1 border-b border-slate-900 bg-transparent font-bold text-slate-900 text-center"
                style={getFieldInputStyle('receivedByName')}
              />
            </div>
          </div>
        </div>

        {/* Submit Actions Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Print / Save as PDF
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            {isSubmitting ? 'Submitting...' : 'Submit Sample Request'}
          </button>
        </div>
      </form>
    </div>
  );
}
