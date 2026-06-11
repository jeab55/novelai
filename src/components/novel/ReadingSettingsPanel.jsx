import React from "react";
import { Type } from "lucide-react";

export default function ReadingSettingsPanel({ settings, update, FONT_SIZES, LINE_HEIGHTS, FONT_FAMILIES }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-muted/30 border-b border-border/40 text-xs flex-wrap">
      <span className="flex items-center gap-1 text-muted-foreground shrink-0">
        <Type className="w-3.5 h-3.5" />
        ตั้งค่าการอ่าน:
      </span>

      {/* Font size */}
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground mr-1">ขนาด</span>
        {Object.entries(FONT_SIZES).map(([key, val]) => (
          <button
            key={key}
            onClick={() => update("fontSize", key)}
            className={`px-2 py-0.5 rounded-md border transition-colors ${
              settings.fontSize === key
                ? "border-primary bg-primary/10 text-primary font-semibold"
                : "border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {val.label}
          </button>
        ))}
      </div>

      <span className="text-border/60">|</span>

      {/* Line height */}
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground mr-1">ระยะบรรทัด</span>
        {LINE_HEIGHTS.map((lh) => (
          <button
            key={lh.value}
            onClick={() => update("lineHeight", lh.value)}
            className={`px-2 py-0.5 rounded-md border transition-colors ${
              settings.lineHeight === lh.value
                ? "border-primary bg-primary/10 text-primary font-semibold"
                : "border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {lh.label}
          </button>
        ))}
      </div>

      <span className="text-border/60">|</span>

      {/* Font family */}
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground mr-1">ฟอนต์</span>
        {Object.entries(FONT_FAMILIES).map(([key, val]) => (
          <button
            key={key}
            onClick={() => update("fontFamily", key)}
            className={`px-2 py-0.5 rounded-md border transition-colors ${
              settings.fontFamily === key
                ? "border-primary bg-primary/10 text-primary font-semibold"
                : "border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {val.label}
          </button>
        ))}
      </div>
    </div>
  );
}