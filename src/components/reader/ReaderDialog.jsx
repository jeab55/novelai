import React, { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  BookMarked, Clock, Settings2, Sun, Moon, Coffee,
  Minus, Plus, X, ChevronLeft, ChevronRight
} from "lucide-react";

const FONTS = [
  { label: "Sarabun", value: "'Sarabun', sans-serif" },
  { label: "Noto Serif Thai", value: "'Noto Serif Thai', serif" },
  { label: "Lora", value: "'Lora', serif" },
  { label: "Georgia", value: "Georgia, serif" },
];

const THEMES = [
  {
    key: "day",
    label: "กลางวัน",
    icon: Sun,
    bg: "#ffffff",
    text: "#1a1a1a",
    panel: "#f5f5f5",
    border: "#e0e0e0",
  },
  {
    key: "sepia",
    label: "ซีเปีย",
    icon: Coffee,
    bg: "#f4ecd8",
    text: "#3b2a1a",
    panel: "#ede0c4",
    border: "#c9b89a",
  },
  {
    key: "night",
    label: "กลางคืน",
    icon: Moon,
    bg: "#1a1a2e",
    text: "#e0ddd5",
    panel: "#16213e",
    border: "#2a2a4a",
  },
];

function countWords(text) {
  if (!text) return 0;
  try {
    const seg = new Intl.Segmenter("th", { granularity: "word" });
    return [...seg.segment(text)].filter((s) => s.isWordLike).length;
  } catch {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }
}

export default function ReaderDialog({ chapters, initialIndex = 0, onClose }) {
  const [idx, setIdx] = useState(initialIndex);
  const [showSettings, setShowSettings] = useState(false);
  const [fontSize, setFontSize] = useState(18);
  const [lineHeight, setLineHeight] = useState(2.0);
  const [fontIdx, setFontIdx] = useState(0);
  const [themeKey, setThemeKey] = useState("day");
  const [brightness, setBrightness] = useState(100);

  const theme = THEMES.find((t) => t.key === themeKey) || THEMES[0];
  const chapter = chapters[idx];
  const words = countWords(chapter?.content);
  const minutes = Math.max(1, Math.round(words / 250));

  const goNext = () => setIdx((i) => Math.min(i + 1, chapters.length - 1));
  const goPrev = () => setIdx((i) => Math.max(i - 1, 0));

  if (!chapter) return null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden border-0 shadow-2xl"
        style={{
          maxWidth: "100vw",
          width: "100vw",
          height: "100vh",
          maxHeight: "100vh",
          borderRadius: 0,
          backgroundColor: theme.bg,
          filter: `brightness(${brightness}%)`,
        }}
      >
        {/* Top bar */}
        <div
          className="flex items-center justify-between px-5 py-3 shrink-0 border-b"
          style={{ backgroundColor: theme.panel, borderColor: theme.border }}
        >
          {/* Prev / chapter info */}
          <div className="flex items-center gap-3">
            <button
              onClick={goPrev}
              disabled={idx === 0}
              className="p-1.5 rounded-lg transition-opacity disabled:opacity-30"
              style={{ color: theme.text }}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div>
              <p className="text-xs font-semibold leading-tight" style={{ color: theme.text }}>
                ตอนที่ {chapter.order || idx + 1} / {chapters.length}
              </p>
              <p className="text-xs opacity-60 truncate max-w-[180px]" style={{ color: theme.text }}>
                {chapter.title}
              </p>
            </div>
            <button
              onClick={goNext}
              disabled={idx === chapters.length - 1}
              className="p-1.5 rounded-lg transition-opacity disabled:opacity-30"
              style={{ color: theme.text }}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Stats + controls */}
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs opacity-60" style={{ color: theme.text }}>
              <BookMarked className="w-3 h-3" />
              {words.toLocaleString()} คำ
            </span>
            <span className="flex items-center gap-1 text-xs opacity-60" style={{ color: theme.text }}>
              <Clock className="w-3 h-3" />
              ~{minutes} นาที
            </span>
            <button
              onClick={() => setShowSettings((v) => !v)}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: theme.text, backgroundColor: showSettings ? theme.border : "transparent" }}
            >
              <Settings2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: theme.text }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div
            className="shrink-0 border-b px-6 py-4 flex flex-wrap gap-6 items-start"
            style={{ backgroundColor: theme.panel, borderColor: theme.border }}
          >
            {/* Font size */}
            <div className="flex flex-col gap-2 min-w-[140px]">
              <span className="text-xs font-semibold opacity-70" style={{ color: theme.text }}>ขนาดตัวอักษร</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setFontSize((f) => Math.max(12, f - 2))} style={{ color: theme.text }}>
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="text-sm w-8 text-center font-mono" style={{ color: theme.text }}>{fontSize}</span>
                <button onClick={() => setFontSize((f) => Math.min(32, f + 2))} style={{ color: theme.text }}>
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Line height */}
            <div className="flex flex-col gap-2 min-w-[160px]">
              <span className="text-xs font-semibold opacity-70" style={{ color: theme.text }}>ระยะบรรทัด</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setLineHeight((l) => Math.max(1.2, parseFloat((l - 0.2).toFixed(1))))} style={{ color: theme.text }}>
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="text-sm w-8 text-center font-mono" style={{ color: theme.text }}>{lineHeight.toFixed(1)}</span>
                <button onClick={() => setLineHeight((l) => Math.min(3.0, parseFloat((l + 0.2).toFixed(1))))} style={{ color: theme.text }}>
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Font */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold opacity-70" style={{ color: theme.text }}>ฟอนต์</span>
              <div className="flex flex-wrap gap-1.5">
                {FONTS.map((f, fi) => (
                  <button
                    key={f.label}
                    onClick={() => setFontIdx(fi)}
                    className="text-xs px-2.5 py-1 rounded-md border transition-colors"
                    style={{
                      fontFamily: f.value,
                      color: theme.text,
                      borderColor: fontIdx === fi ? theme.text : theme.border,
                      backgroundColor: fontIdx === fi ? theme.border : "transparent",
                      opacity: fontIdx === fi ? 1 : 0.65,
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Theme */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold opacity-70" style={{ color: theme.text }}>ธีม</span>
              <div className="flex gap-1.5">
                {THEMES.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setThemeKey(t.key)}
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border transition-colors"
                      style={{
                        backgroundColor: t.bg,
                        color: t.text,
                        borderColor: themeKey === t.key ? t.text : t.border,
                        fontWeight: themeKey === t.key ? 700 : 400,
                      }}
                    >
                      <Icon className="w-3 h-3" />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Brightness */}
            <div className="flex flex-col gap-2 min-w-[180px]">
              <span className="text-xs font-semibold opacity-70" style={{ color: theme.text }}>
                <Sun className="w-3 h-3 inline mr-1" />ความสว่าง {brightness}%
              </span>
              <Slider
                min={30}
                max={100}
                step={5}
                value={[brightness]}
                onValueChange={([v]) => setBrightness(v)}
                className="w-40"
              />
            </div>
          </div>
        )}

        {/* Content */}
        <ScrollArea className="flex-1 min-h-0 h-full">
          <div
            className="mx-auto py-10 px-6"
            style={{ maxWidth: 680 }}
          >
            <h2
              className="font-heading font-bold mb-6 text-center"
              style={{ color: theme.text, fontSize: fontSize + 4, fontFamily: FONTS[fontIdx].value }}
            >
              {chapter.title}
            </h2>
            {chapter.content ? (
              <div
                style={{
                  color: theme.text,
                  fontSize,
                  fontFamily: FONTS[fontIdx].value,
                  lineHeight,
                  whiteSpace: "pre-wrap",
                }}
              >
                {chapter.content}
              </div>
            ) : (
              <p className="text-center opacity-50" style={{ color: theme.text }}>ยังไม่มีเนื้อหา</p>
            )}

            {/* Next/Prev nav at bottom */}
            <div className="flex justify-between mt-16 pt-8 border-t" style={{ borderColor: theme.border }}>
              <button
                onClick={goPrev}
                disabled={idx === 0}
                className="flex items-center gap-2 text-sm disabled:opacity-30 transition-opacity"
                style={{ color: theme.text }}
              >
                <ChevronLeft className="w-4 h-4" />
                ตอนก่อนหน้า
              </button>
              <button
                onClick={goNext}
                disabled={idx === chapters.length - 1}
                className="flex items-center gap-2 text-sm disabled:opacity-30 transition-opacity"
                style={{ color: theme.text }}
              >
                ตอนถัดไป
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}