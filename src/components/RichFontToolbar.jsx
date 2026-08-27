import React, { useState, useEffect, useRef } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Subscript,
  Superscript,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Highlighter,
  Type,
  Check,
  Target,
} from 'lucide-react';

const FONT_FAMILIES = [
  { name: 'Aptos (Body)', value: 'Aptos, sans-serif' },
  { name: 'Inter', value: "'Inter', sans-serif" },
  { name: 'Roboto', value: "'Roboto', sans-serif" },
  { name: 'Outfit', value: "'Outfit', sans-serif" },
  { name: 'Segoe UI', value: '"Segoe UI", sans-serif' },
  { name: 'Georgia', value: 'Georgia, serif' },
  { name: 'Arial', value: 'Arial, sans-serif' },
  { name: 'Times New Roman', value: '"Times New Roman", serif' },
];

const FONT_SIZES = ['10', '11', '12', '14', '16', '18', '20', '24', '28', '36'];

const TEXT_COLORS = [
  '#000000', '#1e293b', '#2563eb', '#059669',
  '#dc2626', '#d97706', '#7c3aed', '#475569',
  '#0284c7', '#0891b2', '#0d9488', '#16a34a',
  '#ca8a04', '#ea580c', '#e11d48', '#9333ea',
];

const HILITE_COLORS = [
  '#ffffff', '#fef08a', '#bbf7d0', '#bfdbfe',
  '#fbcfe8', '#fed7aa', '#e2e8f0', '#ddd6fe',
  '#fef3c7', '#dcfce7', '#e0f2fe', '#f3e8ff',
];

export default function RichFontToolbar({
  activeFieldLabel,
  activeFont,
  activeFontSize,
  isBold,
  isItalic,
  isUnderline,
  isStrikethrough,
  textColor,
  highlightColor,
  textAlign,
  onStyleChange,
}) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);

  const colorPickerRef = useRef(null);
  const highlightPickerRef = useRef(null);

  // Close color pickers when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target)) {
        setShowColorPicker(false);
      }
      if (highlightPickerRef.current && !highlightPickerRef.current.contains(event.target)) {
        setShowHighlightPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFontChange = (fontValue) => {
    onStyleChange?.('fontFamily', fontValue);
  };

  const handleFontSizeChange = (sizePx) => {
    onStyleChange?.('fontSize', sizePx);
  };

  const handleIncreaseFontSize = () => {
    const current = parseInt(activeFontSize || '14', 10);
    const next = Math.min(36, current + 2);
    onStyleChange?.('fontSize', String(next));
  };

  const handleDecreaseFontSize = () => {
    const current = parseInt(activeFontSize || '14', 10);
    const next = Math.max(10, current - 2);
    onStyleChange?.('fontSize', String(next));
  };

  const handleTextColorSelect = (color) => {
    onStyleChange?.('textColor', color);
    setShowColorPicker(false);
  };

  const handleHighlightColorSelect = (color) => {
    onStyleChange?.('highlightColor', color);
    setShowHighlightPicker(false);
  };

  return (
    <div className="relative z-30 flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-100/95 backdrop-blur-md border border-slate-300 rounded-xl text-xs font-sans shadow-md select-none print:hidden">
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Active Field Focus Indicator */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-[11px] font-bold">
          <Target className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span className="truncate max-w-[150px]">
            {activeFieldLabel ? `Field: ${activeFieldLabel}` : 'Click any field to format'}
          </span>
        </div>

        <div className="w-px h-5 bg-slate-300 mx-0.5" />

        {/* Font Family Selector */}
        <select
          value={activeFont || FONT_FAMILIES[0].value}
          onChange={(e) => handleFontChange(e.target.value)}
          className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs cursor-pointer"
          title="Font Family for Focused Field"
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
              {f.name}
            </option>
          ))}
        </select>

        {/* Font Size Selector */}
        <select
          value={activeFontSize || '14'}
          onChange={(e) => handleFontSizeChange(e.target.value)}
          className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs cursor-pointer"
          title="Font Size for Focused Field"
        >
          {FONT_SIZES.map((sz) => (
            <option key={sz} value={sz}>
              {sz}
            </option>
          ))}
        </select>

        {/* Increase / Decrease Font Size Buttons (A^ A v) */}
        <div className="flex items-center bg-white border border-slate-300 rounded-lg overflow-hidden shadow-2xs">
          <button
            type="button"
            onClick={handleIncreaseFontSize}
            className="px-2 py-1 hover:bg-slate-100 text-slate-700 font-bold border-r border-slate-200 transition"
            title="Increase Font Size (A^)"
          >
            A<sup>▲</sup>
          </button>
          <button
            type="button"
            onClick={handleDecreaseFontSize}
            className="px-2 py-1 hover:bg-slate-100 text-slate-700 font-bold transition"
            title="Decrease Font Size (Av)"
          >
            A<sub>▼</sub>
          </button>
        </div>

        <div className="w-px h-5 bg-slate-300 mx-0.5" />

        {/* Basic Formatting Buttons (B, I, U, ab) */}
        <div className="flex items-center bg-white border border-slate-300 rounded-lg overflow-hidden shadow-2xs">
          <button
            type="button"
            onClick={() => onStyleChange?.('isBold', !isBold)}
            className={`p-1.5 transition font-extrabold ${
              isBold ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 text-slate-800'
            }`}
            title="Bold Focused Field Text"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onStyleChange?.('isItalic', !isItalic)}
            className={`p-1.5 transition ${
              isItalic ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 text-slate-800'
            }`}
            title="Italic Focused Field Text"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onStyleChange?.('isUnderline', !isUnderline)}
            className={`p-1.5 transition ${
              isUnderline ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 text-slate-800'
            }`}
            title="Underline Focused Field Text"
          >
            <Underline className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onStyleChange?.('isStrikethrough', !isStrikethrough)}
            className={`p-1.5 transition ${
              isStrikethrough ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 text-slate-800'
            }`}
            title="Strikethrough Focused Field Text"
          >
            <Strikethrough className="w-4 h-4" />
          </button>
        </div>

        <div className="w-px h-5 bg-slate-300 mx-0.5" />

        {/* Text & Highlight Color Pickers */}
        <div className="flex items-center gap-1.5">
          {/* Text Color Button */}
          <div className="relative" ref={colorPickerRef}>
            <button
              type="button"
              onClick={() => {
                setShowColorPicker(!showColorPicker);
                setShowHighlightPicker(false);
              }}
              className="p-1.5 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-800 flex items-center gap-1.5 shadow-2xs"
              title="Text Color for Focused Field"
            >
              <Type className="w-4 h-4" />
              <span className="w-3.5 h-1.5 rounded-full border border-slate-300" style={{ backgroundColor: textColor || '#000000' }} />
            </button>
            {showColorPicker && (
              <div className="absolute top-full left-0 mt-2 p-2.5 bg-white border border-slate-300 rounded-xl shadow-2xl z-50 min-w-[170px]">
                <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Text Color</span>
                <div className="grid grid-cols-4 gap-1.5">
                  {TEXT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => handleTextColorSelect(c)}
                      className="w-6 h-6 rounded-md border border-slate-300 flex items-center justify-center hover:scale-110 transition shadow-2xs"
                      style={{ backgroundColor: c }}
                    >
                      {textColor === c && <Check className="w-3 h-3 text-white drop-shadow-md" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Highlight Color Button */}
          <div className="relative" ref={highlightPickerRef}>
            <button
              type="button"
              onClick={() => {
                setShowHighlightPicker(!showHighlightPicker);
                setShowColorPicker(false);
              }}
              className="p-1.5 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-800 flex items-center gap-1.5 shadow-2xs"
              title="Highlight Color for Focused Field"
            >
              <Highlighter className="w-4 h-4 text-amber-600" />
              <span className="w-3.5 h-1.5 rounded-full border border-slate-300" style={{ backgroundColor: highlightColor || '#ffffff' }} />
            </button>
            {showHighlightPicker && (
              <div className="absolute top-full left-0 mt-2 p-2.5 bg-white border border-slate-300 rounded-xl shadow-2xl z-50 min-w-[170px]">
                <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Highlight Color</span>
                <div className="grid grid-cols-4 gap-1.5">
                  {HILITE_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => handleHighlightColorSelect(c)}
                      className="w-6 h-6 rounded-md border border-slate-300 flex items-center justify-center hover:scale-110 transition shadow-2xs"
                      style={{ backgroundColor: c }}
                    >
                      {highlightColor === c && <Check className="w-3 h-3 text-slate-800" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="w-px h-5 bg-slate-300 mx-0.5" />

        {/* Alignment Buttons */}
        <div className="flex items-center bg-white border border-slate-300 rounded-lg overflow-hidden shadow-2xs">
          <button
            type="button"
            onClick={() => onStyleChange?.('textAlign', 'left')}
            className={`p-1.5 transition ${
              textAlign === 'left' ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 text-slate-800'
            }`}
            title="Align Left"
          >
            <AlignLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onStyleChange?.('textAlign', 'center')}
            className={`p-1.5 transition ${
              textAlign === 'center' ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 text-slate-800'
            }`}
            title="Align Center"
          >
            <AlignCenter className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onStyleChange?.('textAlign', 'right')}
            className={`p-1.5 transition ${
              textAlign === 'right' ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 text-slate-800'
            }`}
            title="Align Right"
          >
            <AlignRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onStyleChange?.('textAlign', 'justify')}
            className={`p-1.5 transition ${
              textAlign === 'justify' ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 text-slate-800'
            }`}
            title="Justify"
          >
            <AlignJustify className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
