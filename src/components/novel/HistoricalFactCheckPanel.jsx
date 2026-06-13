/**
 * HistoricalFactCheckPanel
 * ตรวจข้อเท็จจริงทางประวัติศาสตร์ในเนื้อหาตอน
 * AI สแกนหาข้ออ้างทางประวัติศาสตร์ แล้วประเมินความน่าเชื่อถือ
 */
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, X, ShieldCheck, AlertTriangle, Info, BookOpen, ChevronDown, ChevronUp } from "lucide-react";

const STATUS_CONFIG = {
  correct: {
    icon: "🟢",
    label: "น่าจะถูกต้อง",
    bg: "bg-emerald-50 border-emerald-200",
    text: "text-emerald-700",
    badge: "bg-emerald-100 text-emerald-700",
  },
  check: {
    icon: "🟡",
    label: "ควรตรวจสอบเพิ่มเติม",
    bg: "bg-amber-50 border-amber-200",
    text: "text-amber-700",
    badge: "bg-amber-100 text-amber-700",
  },
  suspicious: {
    icon: "🔴",
    label: "น่าสงสัย / อาจผิดยุค",
    bg: "bg-red-50 border-red-200",
    text: "text-red-700",
    badge: "bg-red-100 text-red-700",
  },
};

function buildPrompt(content, novelEra, novelTitle) {
  return `คุณเป็นนักประวัติศาสตร์ผู้เชี่ยวชาญ ทำหน้าที่ตรวจสอบข้อเท็จจริงทางประวัติศาสตร์ในงานเขียนสร้างสรรค์

[ข้อมูลนิยาย]
ชื่อเรื่อง: ${novelTitle || "(ไม่ระบุ)"}
ยุคสมัย/ฉากหลัง: ${novelEra || "(ไม่ระบุ)"}

[เนื้อหาตอน]
${content}

[คำสั่ง]
สแกนเนื้อหาข้างต้น หาข้ออ้างทางประวัติศาสตร์ทุกชนิด เช่น:
- ปีศักราช พ.ศ. ค.ศ. รัชกาล
- ชื่อบุคคลในประวัติศาสตร์จริง
- เหตุการณ์สำคัญทางประวัติศาสตร์
- สถานที่และดินแดนในประวัติศาสตร์
- ราชวงศ์ ยศ ตำแหน่ง ระบบการปกครอง
- สิ่งของ เทคโนโลยี อาวุธ เครื่องแต่งกาย อาหาร ที่อาจผิดยุค (anachronism)
- ประเพณี วัฒนธรรม ความเชื่อในยุคนั้น

ประเมินแต่ละข้อตามความรู้ที่มี:
- "correct" = น่าจะถูกต้องตามหลักประวัติศาสตร์
- "check" = ไม่แน่ใจ หรือความรู้ไม่เพียงพอยืนยัน ควรให้ผู้เขียนตรวจสอบเพิ่มเติม
- "suspicious" = น่าสงสัยว่าผิด หรือดูผิดยุคสมัย

ข้อสำคัญ: คุณตรวจจากความรู้ที่มีเท่านั้น ไม่สามารถค้นหาข้อมูลเพิ่มเติมได้ ถ้าไม่มั่นใจให้ตอบ "check" เสมอ ห้ามยืนยันว่าถูก/ผิดแบบมั่นใจเกินจริง

ตอบเป็น JSON object รูปแบบ:
{
  "items": [
    {
      "claim": "ข้อความที่พบในเนื้อเรื่อง (อ้างอิงจากข้อความให้ใกล้เคียง)",
      "category": "ประเภท เช่น ปีศักราช / บุคคล / เหตุการณ์ / สถานที่ / สิ่งของ / anachronism",
      "status": "correct | check | suspicious",
      "explanation": "คำอธิบายสั้นว่าทำไม (1-2 ประโยค)"
    }
  ],
  "sources_suggested": ["แหล่งข้อมูลแนะนำสำหรับตรวจสอบเพิ่มเติม เช่น ชื่อพงศาวดาร จดหมายเหตุ หรืองานวิชาการ"]
}

ถ้าไม่พบข้ออ้างทางประวัติศาสตร์ใดเลย ให้ items เป็น array ว่าง`;
}

export default function HistoricalFactCheckPanel({ content, novel, onClose }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { items, sources_suggested }
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [ran, setRan] = useState(false);

  const handleCheck = async () => {
    if (!content?.trim()) return;
    setLoading(true);
    setResult(null);
    setRan(true);

    const prompt = buildPrompt(content, novel?.era, novel?.title);
    const raw = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                claim: { type: "string" },
                category: { type: "string" },
                status: { type: "string" },
                explanation: { type: "string" },
              },
            },
          },
          sources_suggested: { type: "array", items: { type: "string" } },
        },
      },
    });

    setLoading(false);
    setResult(raw || { items: [], sources_suggested: [] });
  };

  const items = result?.items || [];
  const sources = result?.sources_suggested || [];

  const counts = {
    correct: items.filter((i) => i.status === "correct").length,
    check: items.filter((i) => i.status === "check").length,
    suspicious: items.filter((i) => i.status === "suspicious").length,
  };

  return (
    <div className="border-b border-border/60 bg-card/30">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40">
        <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
        <span className="text-xs font-semibold text-indigo-700">ตรวจข้อเท็จจริงทางประวัติศาสตร์</span>

        {!ran && !loading && (
          <Button
            size="sm"
            className="ml-2 h-7 text-xs gap-1 bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={handleCheck}
          >
            <ShieldCheck className="w-3 h-3" />
            เริ่มตรวจ
          </Button>
        )}

        {loading && (
          <span className="ml-2 flex items-center gap-1.5 text-xs text-indigo-600">
            <Loader2 className="w-3 h-3 animate-spin" />
            AI กำลังวิเคราะห์...
          </span>
        )}

        {ran && !loading && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-2 h-7 text-xs gap-1 text-muted-foreground"
            onClick={handleCheck}
          >
            ตรวจใหม่
          </Button>
        )}

        {/* summary badges */}
        {result && items.length > 0 && (
          <div className="flex items-center gap-1.5 ml-2">
            {counts.suspicious > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">🔴 {counts.suspicious}</span>
            )}
            {counts.check > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">🟡 {counts.check}</span>
            )}
            {counts.correct > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">🟢 {counts.correct}</span>
            )}
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="ml-auto h-6 w-6 text-muted-foreground"
          onClick={onClose}
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Result area */}
      {result && (
        <ScrollArea className="max-h-72">
          <div className="px-4 py-3 space-y-2">
            {/* disclaimer */}
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-indigo-50/70 border border-indigo-100 text-[11px] text-indigo-700">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                <strong>หมายเหตุ:</strong> ผลตรวจนี้เป็นตัวช่วยกรองเบื้องต้นจาก AI เท่านั้น ไม่ใช่คำตัดสินสุดท้าย
                ควรตรวจสอบกับแหล่งข้อมูลที่เชื่อถือได้อีกครั้ง
              </span>
            </div>

            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                ไม่พบข้ออ้างทางประวัติศาสตร์ในเนื้อหาตอนนี้
              </p>
            ) : (
              items.map((item, idx) => {
                const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.check;
                const isOpen = expandedIdx === idx;
                return (
                  <div
                    key={idx}
                    className={`rounded-lg border ${cfg.bg} overflow-hidden`}
                  >
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-left"
                      onClick={() => setExpandedIdx(isOpen ? null : idx)}
                    >
                      <span className="text-sm">{cfg.icon}</span>
                      <span className="text-xs font-medium flex-1 line-clamp-1">{item.claim}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${cfg.badge}`}>
                        {item.category}
                      </span>
                      {isOpen ? (
                        <ChevronUp className={`w-3.5 h-3.5 shrink-0 ${cfg.text}`} />
                      ) : (
                        <ChevronDown className={`w-3.5 h-3.5 shrink-0 ${cfg.text}`} />
                      )}
                    </button>
                    {isOpen && (
                      <div className={`px-3 pb-2.5 text-[11px] ${cfg.text} border-t ${cfg.bg}`}>
                        <p className="font-semibold mb-1">{cfg.label}</p>
                        <p className="leading-relaxed opacity-90">{item.explanation}</p>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* แหล่งอ้างอิงแนะนำ */}
            {sources.length > 0 && (
              <div className="mt-2 px-3 py-2 rounded-lg bg-muted/50 border border-border/50">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground/70 mb-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  แหล่งข้อมูลแนะนำสำหรับตรวจสอบเพิ่มเติม
                </div>
                <ul className="space-y-0.5">
                  {sources.map((s, i) => (
                    <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                      <span className="mt-0.5 shrink-0">•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}