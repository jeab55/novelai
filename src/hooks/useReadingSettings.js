import { useState, useEffect } from "react";

const STORAGE_KEY = "novel_reading_settings";

const DEFAULTS = {
  fontSize: "md",    // sm | md | lg
  lineHeight: "1.8", // 1.6 | 1.8 | 2.0
  fontFamily: "sarabun", // sarabun | lora | system
};

const FONT_SIZES = {
  sm: { label: "เล็ก", px: 16 },
  md: { label: "กลาง", px: 18 },
  lg: { label: "ใหญ่", px: 21 },
};

const LINE_HEIGHTS = [
  { value: "1.6", label: "แน่น" },
  { value: "1.8", label: "ปกติ" },
  { value: "2.0", label: "โปร่ง" },
];

const FONT_FAMILIES = {
  sarabun: { label: "Sarabun", css: "'Sarabun', 'Noto Sans Thai', sans-serif" },
  lora: { label: "Noto Serif", css: "'Noto Serif Thai', 'Lora', serif" },
  system: { label: "System", css: "system-ui, -apple-system, sans-serif" },
};

export function useReadingSettings() {
  const [settings, setSettings] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...DEFAULTS, ...JSON.parse(stored) } : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const update = (key, value) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  const fontSizePx = FONT_SIZES[settings.fontSize]?.px || 18;
  const fontCss = FONT_FAMILIES[settings.fontFamily]?.css || FONT_FAMILIES.sarabun.css;

  return {
    settings,
    update,
    fontSizePx,
    fontCss,
    FONT_SIZES,
    LINE_HEIGHTS,
    FONT_FAMILIES,
  };
}