import React, { useState } from 'react';
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
  Palette,
  Highlighter,
  Type,
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

const TEXT_COLORS = ['#000000', '#1e293b', '#2563eb', '#059669', '#dc2626', '#d97706', '#7c3aed', '#475569'];
const HILITE_COLORS = ['#ffffff', '#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa', '#e2e8f0'];

export default function RichFontToolbar({ activeFont, onChangeFont, activeFontSize, onChangeFontSize }) {
  const [selectedColor, setSelectedColor] = useState('#000000');
  const [selectedHighlight, setSelectedHighlight] = useState('#fef08a');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);

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
    execCommand('fontSize', '4'); // intermediate
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

  const handleTextColor = (color) => {
    setSelectedColor(color);
    execCommand('foreColor', color);
    setShowColorPicker(false);
  };

  const handleHighlightColor = (color) => {
    setSelectedHighlight(color);
    execCommand('hiliteColor', color);
    setShowHighlightPicker(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-100 border border-slate-300 rounded-xl text-xs font-sans shadow-sm select-none print:hidden">
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
        title="Font Size"
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

      {/* Basic Formatting Buttons (B, I, U, ab, x2, x^2) */}
      <div className="flex items-center bg-white border border-slate-300 rounded-lg overflow-hidden shadow-2xs">
        <button
          type="button"
          onClick={() => execCommand('bold')}
          className="p-1.5 hover:bg-slate-100 text-slate-800 transition font-extrabold"
          title="Bold (Ctrl+B)"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => execCommand('italic')}
          className="p-1.5 hover:bg-slate-100 text-slate-800 transition"
          title="Italic (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => execCommand('underline')}
          className="p-1.5 hover:bg-slate-100 text-slate-800 transition"
          title="Underline (Ctrl+U)"
        >
          <Underline className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => execCommand('strikeThrough')}
          className="p-1.5 hover:bg-slate-100 text-slate-800 transition"
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

      {/* Text & Highlight Color Pickers */}
      <div className="flex items-center gap-1 relative">
        {/* Text Color Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="p-1.5 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-800 flex items-center gap-1 shadow-2xs"
            title="Text Color"
          >
            <Type className="w-4 h-4" />
            <span className="w-3 h-1 rounded-full" style={{ backgroundColor: selectedColor }} />
          </button>
          {showColorPicker && (
            <div className="absolute top-full left-0 mt-1 p-2 bg-white border border-slate-300 rounded-lg shadow-lg z-30 grid grid-cols-4 gap-1">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleTextColor(c)}
                  className="w-5 h-5 rounded border border-slate-300 hover:scale-110 transition"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Highlight Color Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowHighlightPicker(!showHighlightPicker)}
            className="p-1.5 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-800 flex items-center gap-1 shadow-2xs"
            title="Highlight Color"
          >
            <Highlighter className="w-4 h-4 text-amber-600" />
            <span className="w-3 h-1 rounded-full" style={{ backgroundColor: selectedHighlight }} />
          </button>
          {showHighlightPicker && (
            <div className="absolute top-full left-0 mt-1 p-2 bg-white border border-slate-300 rounded-lg shadow-lg z-30 grid grid-cols-4 gap-1">
              {HILITE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleHighlightColor(c)}
                  className="w-5 h-5 rounded border border-slate-300 hover:scale-110 transition"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="w-px h-5 bg-slate-300 mx-0.5" />

      {/* Alignment Buttons */}
      <div className="flex items-center bg-white border border-slate-300 rounded-lg overflow-hidden shadow-2xs">
        <button
          type="button"
          onClick={() => execCommand('justifyLeft')}
          className="p-1.5 hover:bg-slate-100 text-slate-800 transition"
          title="Align Left"
        >
          <AlignLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => execCommand('justifyCenter')}
          className="p-1.5 hover:bg-slate-100 text-slate-800 transition"
          title="Align Center"
        >
          <AlignCenter className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => execCommand('justifyRight')}
          className="p-1.5 hover:bg-slate-100 text-slate-800 transition"
          title="Align Right"
        >
          <AlignRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => execCommand('justifyFull')}
          className="p-1.5 hover:bg-slate-100 text-slate-800 transition"
          title="Justify"
        >
          <AlignJustify className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
