/**
 * InlineDiffViewer
 * แสดงเนื้อหาที่ AI แก้แบบ inline โดย parse [[EDIT]]...[[/EDIT]] tags
 * - ข้อความนอก tag → สีปกติ
 * - ข้อความใน [[EDIT]]...[[/EDIT]] → highlight ตามสีที่กำหนด
 *
 * Props:
 *   rawText: string — เนื้อหาที่ AI ส่งกลับมา (มี [[EDIT]] tags)
 *   highlightColor: string — CSS hex color
 *   fontSize: number
 *   contentWidth: number
 *   onSave: () => void
 *   onCancel: () => void
 *   saving?: boolean
 */
import { Button } from "@/components/ui/button";
import { Save, X } from "lucide-react";

// parse rawText → array of { type: "normal"|"edit", text: string }
function parseEditTags(rawText) {
  if (!rawText) return [];
  const segments = [];
  const regex = /\[\[EDIT\]\]([\s\S]*?)\[\[\/EDIT\]\]/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(rawText)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "normal", text: rawText.slice(lastIndex, match.index) });
    }
    segments.push({ type: "edit", text: match[1] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < rawText.length) {
    segments.push({ type: "normal", text: rawText.slice(lastIndex) });
  }
  return segments;
}

export default function InlineDiffViewer({
  rawText,
  highlightColor,
  fontSize,
  contentWidth,
  onSave,
  onCancel,
  saving = false,
}) {
  if (!rawText) return null;

  const segments = parseEditTags(rawText);
  const hasEdits = segments.some((s) => s.type === "edit");

  return (
    <div className="flex-1 overflow-auto bg-background relative">
      {/* Banner */}
      <div
        className="sticky top-0 z-10 flex items-center gap-3 px-6 py-2 text-xs font-medium border-b"
        style={{ background: highlightColor + "18", borderColor: highlightColor + "40" }}
      >
        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: highlightColor }} />
        <span style={{ color: highlightColor }}>
          AI แก้เนื้อหาแล้ว — {hasEdits ? "ข้อความไฮไลต์คือส่วนที่แก้ไข" : "ไม่พบส่วนที่ถูกทำเครื่องหมาย"}
        </span>
        <span className="text-muted-foreground/60 ml-1">
          (ไฮไลต์ = แก้ใหม่ · สีปกติ = ไม่เปลี่ยน)
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            className="h-7 text-[11px] gap-1 text-white"
            style={{ background: highlightColor }}
            onClick={onSave}
            disabled={saving}
          >
            <Save className="w-3 h-3" />
            บันทึก (ลบไฮไลต์)
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] gap-1 text-muted-foreground"
            onClick={onCancel}
          >
            <X className="w-3 h-3" />
            ยกเลิก
          </Button>
        </div>
      </div>

      {/* เนื้อหา */}
      <div className="mx-auto px-8 py-10" style={{ maxWidth: `${contentWidth}px` }}>
        <div
          style={{
            fontFamily: "'Sarabun', 'Noto Sans Thai', sans-serif",
            fontSize: `${fontSize}px`,
            lineHeight: "1.95",
            color: "hsl(var(--foreground))",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {segments.map((seg, i) =>
            seg.type === "edit" ? (
              <mark
                key={i}
                style={{
                  background: highlightColor + "28",
                  color: highlightColor,
                  fontWeight: 500,
                  borderRadius: "2px",
                  padding: "0 1px",
                }}
              >
                {seg.text}
              </mark>
            ) : (
              <span key={i}>{seg.text}</span>
            )
          )}
        </div>
      </div>
    </div>
  );
}