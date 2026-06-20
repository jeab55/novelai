import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Wand2, Loader2, Sparkles, Copy, ArrowLeftRight, X, Check } from "lucide-react";
import { toast } from "sonner";
import { invokeAIStable } from "@/lib/aiInvoke";

const MODES = [
  { value: "concise", label: "กระชับขึ้น", hint: "ตัดส่วนเยิ่นเย้อ ให้อ่านลื่นและได้ใจความ" },
  { value: "vivid", label: "บรรยายละเอียดขึ้น", hint: "เติมรายละเอียดทางประสาทสัมผัสและอารมณ์" },
  { value: "dedup", label: "แก้คำซ้ำให้ลื่นขึ้น", hint: "ลดคำซ้ำ/ประโยคซ้ำ ปรับให้ไหลลื่น" },
  { value: "tone", label: "เปลี่ยนโทน", hint: "ปรับอารมณ์/น้ำเสียงของการเล่า" },
];
const TONES = ["ดราม่าเข้มข้น", "ตลกเบาสมอง", "โรแมนติกหวานซึ้ง", "ลึกลับชวนติดตาม", "เศร้าสะเทือนใจ", "ตื่นเต้นเร้าใจ"];

export default function RewritePolishPanel({ content, novel, onApply, onClose }) {
  const [mode, setMode] = useState("concise");
  const [tone, setTone] = useState(TONES[0]);
  const [source, setSource] = useState((content || "").replace(/<[^>]*>/g, " "));
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const handlePolish = async () => {
    const text = (source || "").trim();
    if (text.length < 20) {
      toast.error("ข้อความสั้นเกินไป กรุณาวางข้อความที่ต้องการขัดเกลา");
      return;
    }
    setLoading(true);
    setResult("");
    try {
      const modeObj = MODES.find((m) => m.value === mode);
      const instruction = mode === "tone"
        ? `ปรับโทน/น้ำเสียงของการเล่าให้เป็นแนว "${tone}" โดยคงเนื้อเรื่องและเหตุการณ์เดิมทั้งหมด`
        : modeObj.hint;
      const prompt = `คุณคือบรรณาธิการนิยายไทยมืออาชีพ${novel?.genre ? ` แนว${novel.genre}` : ""} จงขัดเกลาข้อความต่อไปนี้: ${instruction}

ข้อกำหนด:
- คงเนื้อเรื่อง เหตุการณ์ บทสนทนา และความหมายเดิมไว้ ห้ามเพิ่มเหตุการณ์ใหม่หรือตัดเนื้อหาสำคัญ
- รักษาภาษาไทยที่สวยงาม เป็นธรรมชาติ และการเว้นวรรคที่ถูกต้อง
- ตอบกลับเฉพาะข้อความที่ขัดเกลาแล้วเท่านั้น ไม่ต้องมีคำอธิบาย หัวข้อ หรือเครื่องหมายคำพูดครอบ

ข้อความต้นฉบับ:
"""
${text.slice(0, 14000)}
"""`;

      const res = await invokeAIStable({ prompt, model: "claude_sonnet_4_6" });
      const out = typeof res === "string" ? res : res?.response ?? res?.output ?? "";
      const clean = (typeof out === "string" ? out : JSON.stringify(out)).trim();
      if (!clean) throw new Error("ไม่ได้รับผลลัพธ์");
      setResult(clean);
      toast.success("ขัดเกลาเสร็จแล้ว");
    } catch (e) {
      toast.error("ขัดเกลาไม่สำเร็จ: " + (e.message || ""));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-t border-border/60 bg-card/30 p-4">
      <div className="max-w-5xl mx-auto space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-heading font-semibold flex items-center gap-2 text-sm">
            <Wand2 className="w-4 h-4 text-fuchsia-600" />ขัดเกลาสำนวน (Rewrite / Polish)
          </h3>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={mode} onValueChange={setMode}>
            <SelectTrigger className="h-9 w-48 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
          {mode === "tone" && (
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger className="h-9 w-44 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{TONES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Button onClick={handlePolish} disabled={loading} className="h-9 gap-2">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" />กำลังขัดเกลา...</> : <><Sparkles className="w-4 h-4" />ขัดเกลา</>}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">เคล็ดลับ: วางเฉพาะย่อหน้าที่ต้องการขัดเกลาในช่องซ้าย หรือทั้งตอนก็ได้</p>

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-medium mb-1 text-muted-foreground">ต้นฉบับ (แก้ไขได้)</p>
            <Textarea value={source} onChange={(e) => setSource(e.target.value)} className="min-h-[260px] text-sm leading-relaxed resize-none" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><ArrowLeftRight className="w-3 h-3" />ผลลัพธ์</p>
              {result && <Badge variant="outline" className="text-[10px]">{result.length.toLocaleString()} ตัวอักษร</Badge>}
            </div>
            <div className="min-h-[260px] rounded-md border border-border bg-background p-3 text-sm leading-relaxed whitespace-pre-wrap overflow-auto max-h-[260px]">
              {result || <span className="text-muted-foreground/50">ผลลัพธ์จะแสดงที่นี่หลังกดขัดเกลา</span>}
            </div>
          </div>
        </div>

        {result && (
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { navigator.clipboard.writeText(result); toast.success("คัดลอกแล้ว"); }}>
              <Copy className="w-3.5 h-3.5" />คัดลอก
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => { onApply(result); toast.success("นำไปแทนที่เนื้อหาแล้ว"); onClose(); }}>
              <Check className="w-3.5 h-3.5" />นำไปแทนที่
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}