/**
 * InlineDiffViewer
 * แสดงเนื้อหาที่ AI แก้แบบ inline ในพื้นที่เดียวกับ textarea
 * - ข้อความเดิมที่ไม่เปลี่ยน → สีปกติ
 * - ข้อความที่ AI เพิ่ม/แก้ใหม่ → highlight ตามสีที่กำหนด
 * รับ props:
 *   segments: Array<{ type: "same"|"added", text: string }>
 *   highlightColor: string (CSS color)
 *   fontSize: number
 *   contentWidth: number
 *   onSave: () => void
 *   onCancel: () => void
 *   saving?: boolean
 */
import { Button } from "@/components/ui/button";
import { Save, X } from "lucide-react";

export default function InlineDiffViewer({
  segments,
  highlightColor,
  fontSize,
  contentWidth,
  onSave,
  onCancel,
  saving = false,
}) {
  if (!segments) return null;

  return (
    <div className="flex-1 overflow-auto bg-background relative">
      {/* Banner แจ้งเตือน */}
      <div
        className="sticky top-0 z-10 flex items-center gap-3 px-6 py-2 text-xs font-medium border-b"
        style={{ background: highlightColor + "18", borderColor: highlightColor + "40" }}
      >
        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: highlightColor }} />
        <span style={{ color: highlightColor }}>
          AI แก้เนื้อหาแล้ว — ตรวจสอบข้อความที่ไฮไลต์ด้านล่าง
        </span>
        <span className="text-muted-foreground/60 ml-1">
          (สีไฮไลต์ = ส่วนที่แก้ไข/เพิ่มใหม่ · สีปกติ = ไม่เปลี่ยน)
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

      {/* เนื้อหา inline diff */}
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
          {segments.map((seg, i) => {
            if (seg.text === "") return <br key={i} />;
            if (seg.type === "added") {
              return (
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
              );
            }
            return <span key={i}>{seg.text}</span>;
          })}
        </div>
      </div>
    </div>
  );
}