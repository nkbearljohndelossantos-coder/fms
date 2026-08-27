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
  activeFont,
  onChangeFont,
  activeFontSize,
  onChangeFontSize,
  isBold,
  onToggleBold,
  isItalic,
  onToggleItalic,
  isUnderline,
  onToggleUnderline,
  isStrikethrough,
  onToggleStrikethrough,
  textColor,
  onChangeTextColor,
  highlightColor,
  onChangeHighlightColor,
  textAlign,
  onChangeTextAlign,
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

  const execCommand = (cmd, val = null) => {
    try {
      document.execCommand(cmd, false, val);
    } catch (_) {}
  };

  const handleFontChange = (fontValue) => {
    onChangeFont?.(fontValue);
    execCommand('fontName', fontValue);
  };

  const handleFontSizeChange = (sizePx) => {
    onChangeFontSize?.(sizePx);
    execCommand('fontSize', '4');
  };

  const handleIncreaseFontSize = () => {
    const current = parseInt(activeFontSize || '14', 10);
    const next = Math.min(36, current + 2);
    onChangeFontSize?.(String(next));
  };

  const handleDecreaseFontSize = () => {
    const current = parseInt(activeFontSize || '14', 10);
    const next = Math.max(10, current - 2);
    onChangeFontSize?.(String(next));
  };

  const handleTextColorSelect = (color) => {
    onChangeTextColor?.(color);
    execCommand('foreColor', color);
    setShowColorPicker(false);
  };

  const handleHighlightColorSelect = (color) => {
    onChangeHighlightColor?.(color);
    execCommand('hiliteColor', color);
    setShowHighlightPicker(false);
  };

  return (
    <div className="relative z-30 flex flex-wrap items-center gap-1.5 p-2 bg-slate-100/95 backdrop-blur-md border border-slate-300 rounded-xl text-xs font-sans shadow-md select-none print:hidden">
      {/* Font Family Selector */}
      <select
        value={activeFont || FONT_FAMILIES[0].value}
        onChange={(e) => handleFontChange(e.target.value)}
        className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs cursor-pointer"
        title="Font Family"
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
        title="Font Size (pt/px)"
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
          onClick={() => {
            onToggleBold?.();
            execCommand('bold');
          }}
          className={`p-1.5 transition font-extrabold ${
            isBold ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 text-slate-800'
          }`}
          title="Bold (Ctrl+B)"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            onToggleItalic?.();
            execCommand('italic');
          }}
          className={`p-1.5 transition ${
            isItalic ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 text-slate-800'
          }`}
          title="Italic (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            onToggleUnderline?.();
            execCommand('underline');
          }}
          className={`p-1.5 transition ${
            isUnderline ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 text-slate-800'
          }`}
          title="Underline (Ctrl+U)"
        >
          <Underline className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            onToggleStrikethrough?.();
            execCommand('strikeThrough');
          }}
          className={`p-1.5 transition ${
            isStrikethrough ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 text-slate-800'
          }`}
          title="Strikethrough"
        >
          <Strikethrough className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center bg-white border border-slate-300 rounded-lg overflow-hidden shadow-2xs">
        <button
          type="button"
          onClick={() => execCommand('subscript')}
          className="p-1.5 hover:bg-slate-100 text-slate-800 transition"
          title="Subscript (x₂)"
        >
          <Subscript className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => execCommand('superscript')}
          className="p-1.5 hover:bg-slate-100 text-slate-800 transition"
          title="Superscript (x²)"
        >
          <Superscript className="w-4 h-4" />
        </button>
      </div>

      <div className="w-px h-5 bg-slate-300 mx-0.5" />

      {/* Text & Highlight Color Pickers with Clean Popovers */}
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
            title="Text Color"
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
            title="Highlight Color"
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
          onClick={() => {
            onChangeTextAlign?.('left');
            execCommand('justifyLeft');
          }}
          className={`p-1.5 transition ${
            textAlign === 'left' ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 text-slate-800'
          }`}
          title="Align Left"
        >
          <AlignLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            onChangeTextAlign?.('center');
            execCommand('justifyCenter');
          }}
          className={`p-1.5 transition ${
            textAlign === 'center' ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 text-slate-800'
          }`}
          title="Align Center"
        >
          <AlignCenter className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            onChangeTextAlign?.('right');
            execCommand('justifyRight');
          }}
          className={`p-1.5 transition ${
            textAlign === 'right' ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 text-slate-800'
          }`}
          title="Align Right"
        >
          <AlignRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            onChangeTextAlign?.('justify');
            execCommand('justifyFull');
          }}
          className={`p-1.5 transition ${
            textAlign === 'justify' ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 text-slate-800'
          }`}
          title="Justify"
        >
          <AlignJustify className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
