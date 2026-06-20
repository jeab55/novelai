import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users2, Loader2, Sparkles, ArrowLeftRight, X, Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { invokeAIStable } from "@/lib/aiInvoke";

const TARGETS = [
  { value: "first", label: "บุรุษที่ 1 (ฉัน/ผม/ดิฉัน)" },
  { value: "third", label: "บุรุษที่ 3 (เขา/เธอ/ชื่อตัวละคร)" },
];

export default function PovSwitchPanel({ content, novel, onApply, onClose }) {
  const [target, setTarget] = useState("third");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const source = (content || "").replace(/<[^>]*>/g, " ");

  const handleSwitch = async () => {
    const text = (source || "").trim();
    if (text.length < 20) {
      toast.error("เนื้อหาตอนนี้สั้นเกินไป");
      return;
    }
    setLoading(true);
    setResult("");
    try {
      const targetLabel = target === "first"
        ? "มุมมองบุรุษที่ 1 (ผู้เล่าคือตัวละคร ใช้สรรพนาม ฉัน/ผม/ดิฉัน)"
        : "มุมมองบุรุษที่ 3 (ผู้เล่าอยู่นอกเรื่อง ใช้ชื่อตัวละครหรือ เขา/เธอ)";
      const prompt = `คุณคือบรรณาธิการนิยายไทยมืออาชีพ จงแปลงมุมมองการเล่า (POV) ของเนื้อหาทั้งตอนต่อไปนี้ให้เป็น "${targetLabel}"

ข้อกำหนดสำคัญ:
- คงเนื้อเรื่อง เหตุการณ์ ลำดับ บทสนทนา และความหมายเดิมไว้ทั้งหมด ห้ามเพิ่มหรือตัดเนื้อหา
- เปลี่ยนเฉพาะสรรพนามและน้ำเสียงการเล่าให้ถูกต้องและสม่ำเสมอตลอดทั้งตอน
- บทสนทนาในเครื่องหมายคำพูดให้คงไว้ตามเดิม (เปลี่ยนเฉพาะส่วนบรรยาย)
- รักษาการเว้นวรรคและความเป็นธรรมชาติของภาษาไทย
- ตอบกลับเฉพาะเนื้อหาที่แปลงมุมมองแล้วเท่านั้น ไม่ต้องมีคำอธิบายหรือหัวข้อ

เนื้อหาต้นฉบับ:
"""
${text.slice(0, 16000)}
"""`;

      const res = await invokeAIStable({ prompt, model: "claude_sonnet_4_6" });
      const out = typeof res === "string" ? res : res?.response ?? res?.output ?? "";
      const clean = (typeof out === "string" ? out : JSON.stringify(out)).trim();
      if (!clean) throw new Error("ไม่ได้รับผลลัพธ์");
      setResult(clean);
      toast.success("แปลงมุมมองเสร็จแล้ว");
    } catch (e) {
      toast.error("แปลงมุมมองไม่สำเร็จ: " + (e.message || ""));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-t border-border/60 bg-card/30 p-4">
      <div className="max-w-5xl mx-auto space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-heading font-semibold flex items-center gap-2 text-sm">
            <Users2 className="w-4 h-4 text-teal-600" />ปรับมุมมองการเล่า (POV Switch)
          </h3>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">แปลงเป็น:</span>
          {TARGETS.map((t) => (
            <Button key={t.value} variant={target === t.value ? "default" : "outline"} size="sm" className="h-8 text-xs" onClick={() => setTarget(t.value)}>
              {t.label}
            </Button>
          ))}
          <Button onClick={handleSwitch} disabled={loading} className="h-8 gap-2 ml-auto">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" />กำลังแปลง...</> : <><Sparkles className="w-4 h-4" />แปลงมุมมอง</>}
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-medium mb-1 text-muted-foreground">ต้นฉบับ</p>
            <div className="min-h-[260px] max-h-[260px] rounded-md border border-border bg-background p-3 text-sm leading-relaxed whitespace-pre-wrap overflow-auto">
              {source || <span className="text-muted-foreground/50">ไม่มีเนื้อหา</span>}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><ArrowLeftRight className="w-3 h-3" />ผลลัพธ์</p>
              {result && <Badge variant="outline" className="text-[10px]">{result.length.toLocaleString()} ตัวอักษร</Badge>}
            </div>
            <div className="min-h-[260px] max-h-[260px] rounded-md border border-border bg-background p-3 text-sm leading-relaxed whitespace-pre-wrap overflow-auto">
              {result || <span className="text-muted-foreground/50">ผลลัพธ์จะแสดงที่นี่หลังกดแปลงมุมมอง</span>}
            </div>
          </div>
        </div>

        {result && (
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { navigator.clipboard.writeText(result); toast.success("คัดลอกแล้ว"); }}>
              <Copy className="w-3.5 h-3.5" />คัดลอก
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => { onApply(result); toast.success("นำไปแทนที่เนื้อหาแล้ว"); onClose(); }}>
              <Check className="w-3.5 h-3.5" />นำไปแทนที่ทั้งตอน
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}