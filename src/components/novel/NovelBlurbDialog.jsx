import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Loader2, CheckCircle2, BookOpen, Star, Zap } from "lucide-react";
import { toast } from "sonner";
import CopyButton from "@/components/ui/CopyButton";
import { useSafeAction } from "@/hooks/useSafeAction";

const BLURB_TYPES = [
  {
    id: "main_conflict",
    label: "ขายปมหลัก",
    icon: BookOpen,
    desc: "2-3 ประโยค เน้นความขัดแย้งและเดิมพัน",
    color: "border-primary/30 bg-primary/5",
    activeColor: "border-primary bg-primary/10",
  },
  {
    id: "character_conflict",
    label: "ขายคู่ตัวละคร",
    icon: Star,
    desc: "เน้นความสัมพันธ์และแรงดึงดูดระหว่างตัวละครหลัก",
    color: "border-rose-200 bg-rose-50/50",
    activeColor: "border-rose-400 bg-rose-50",
  },
  {
    id: "tagline",
    label: "Tagline สั้นคม",
    icon: Zap,
    desc: "1 ประโยคสั้น คม จำง่าย ติดหู",
    color: "border-amber-200 bg-amber-50/50",
    activeColor: "border-amber-400 bg-amber-50",
  },
];

function buildBlurbPrompt(novel, chapters) {
  const sortedChapters = [...chapters].sort((a, b) => (a.order || 0) - (b.order || 0));
  const totalChapters = sortedChapters.length;

  // ใช้เนื้อหา 60% แรกเท่านั้น เพื่อไม่สปอยล์ตอนจบ
  const safeChapters = sortedChapters.slice(0, Math.ceil(totalChapters * 0.6));

  let ctx = `คุณคือนักเขียนคำโปรยนิยายมืออาชีพ\n\n`;
  ctx += `ชื่อเรื่อง: ${novel.title}\n`;
  if (novel.genre) ctx += `แนว: ${novel.genre}\n`;
  if (novel.era) ctx += `ยุคสมัย: ${novel.era}\n`;
  if (novel.synopsis) ctx += `เรื่องย่อ (จากผู้เขียน): ${novel.synopsis}\n`;

  ctx += `\n=== เนื้อหาจริงจากนิยาย (${safeChapters.length} ตอนแรกจาก ${totalChapters} ตอน เพื่อไม่สปอยล์ตอนจบ) ===\n`;
  safeChapters.forEach((ch) => {
    const preview = (ch.content || "").substring(0, 1000);
    ctx += `\n[ตอนที่ ${ch.order}: ${ch.title}]\n${preview}${(ch.content || "").length > 1000 ? "…" : ""}\n`;
  });

  ctx += `\n=== คำสั่ง ===\n`;
  ctx += `จากเนื้อหาที่อ่านมา ให้เขียนคำโปรย 3 แบบ:\n`;
  ctx += `1. แบบ "main_conflict": 2-3 ประโยค เน้นปมหลัก ความขัดแย้ง และเดิมพันของตัวละคร ห้ามสปอยล์จุดหักเหท้ายเรื่อง\n`;
  ctx += `2. แบบ "character_conflict": เน้นความสัมพันธ์ระหว่างตัวละครหลักและแรงดึงดูด/ความขัดแย้งระหว่างกัน ห้ามสปอยล์ตอนจบ\n`;
  ctx += `3. แบบ "tagline": 1 ประโยคสั้น คม จำง่าย ดึงอารมณ์ผู้อ่าน\n`;
  ctx += `\nทั้ง 3 แบบ ต้องดึงมาจากเนื้อหาจริงที่อ่านมา ไม่ใช่แค่แต่งเอง ใช้ภาษาไทยที่อ่านลื่น กระชับ\n`;

  return ctx;
}

function buildSummaryPrompt(novel, chapters) {
  const sortedChapters = [...chapters].sort((a, b) => (a.order || 0) - (b.order || 0));

  let ctx = `สรุปนิยายเรื่อง "${novel.title}" ให้เป็น 1 ย่อหน้า (4-6 ประโยค) ที่ครอบคลุมทั้งเรื่อง รวมถึงตอนจบ ใช้ภาษาไทยที่อ่านง่าย ไม่ต้องมีคำนำหรืออธิบาย\n\n`;
  ctx += `=== เนื้อหาทุกตอน ===\n`;
  sortedChapters.forEach((ch) => {
    const preview = (ch.content || "").substring(0, 800);
    ctx += `\n[ตอน ${ch.order}: ${ch.title}]\n${preview}${(ch.content || "").length > 800 ? "…" : ""}\n`;
  });

  return ctx;
}

export default function NovelBlurbDialog({ open, onClose, novel, novelId, chapters }) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState("");
  const [blurbs, setBlurbs] = useState(null);
  const [selectedBlurb, setSelectedBlurb] = useState(null);
  const queryClient = useQueryClient();

  const contentChapters = chapters.filter((c) => c.content && (c.word_count || 0) > 0);

  const { run: saveBlurb, isPending: saving } = useSafeAction({
    action: "บันทึกคำโปรย",
    entity: "Novel",
    fn: async (text) => {
      await base44.entities.Novel.update(novelId, { blurb: text });
      // verify by re-fetching
      const all = await base44.entities.Novel.list();
      const updated = all.find((n) => String(n.id) === String(novelId));
      if (!updated?.blurb) throw new Error("blurb ยังว่างหลังบันทึก");
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["novels"] });
      queryClient.invalidateQueries({ queryKey: ["novel", novelId] });
    },
  });

  const handleSaveBlurb = async () => {
    if (!selectedBlurb || !blurbs) return;
    const text = blurbs[selectedBlurb];
    if (!text) return;
    await saveBlurb(text);
  };

  const handleGenerate = async () => {
    setLoading(true);
    setSummary("");
    setBlurbs(null);
    setSelectedBlurb(null);

    const [blurbResult, summaryResult] = await Promise.all([
      base44.integrations.Core.InvokeLLM({
        prompt: buildBlurbPrompt(novel, contentChapters),
        model: "claude_sonnet_4_6",
        response_json_schema: {
          type: "object",
          properties: {
            main_conflict: { type: "string" },
            character_conflict: { type: "string" },
            tagline: { type: "string" },
          },
          required: ["main_conflict", "character_conflict", "tagline"],
        },
      }),
      base44.integrations.Core.InvokeLLM({
        prompt: buildSummaryPrompt(novel, contentChapters),
        model: "claude_sonnet_4_6",
      }),
    ]);

    setBlurbs(blurbResult);
    let summaryText = typeof summaryResult === "string" ? summaryResult : (summaryResult?.text || "");
    summaryText = summaryText.replace(/^```[\w]*\n?/m, "").replace(/\n?```$/m, "").trim();
    setSummary(summaryText);
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/60 shrink-0">
          <DialogTitle className="font-heading flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            สรุปเรื่อง + สร้างคำโปรย
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            AI อ่านเนื้อหาจริง {contentChapters.length} ตอน สร้างสรุปทั้งเรื่องและคำโปรย 3 แบบ โดยไม่สปอยล์ตอนจบ
            <br />
            <span className="text-amber-600 font-medium">ใช้ Claude Sonnet — ใช้ credits สูง</span>
          </p>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-5">
          {!blurbs && !loading && (
            <div className="text-center py-14">
              <BookOpen className="w-14 h-14 text-muted-foreground/25 mx-auto mb-4" />
              <p className="font-semibold mb-1">พร้อมสร้างคำโปรย</p>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-2">
                AI จะอ่านเนื้อหา {contentChapters.length} ตอน แล้วสร้างสรุปทั้งเรื่อง 1 ย่อหน้า และคำโปรย 3 แบบให้เลือก
              </p>
              {novel?.blurb && (
                <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 max-w-sm mx-auto text-left">
                  <p className="text-xs font-medium text-primary mb-1">คำโปรยที่บันทึกไว้แล้ว</p>
                  <p className="text-sm text-foreground/80 leading-relaxed">{novel.blurb}</p>
                </div>
              )}
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-semibold mb-1">กำลังอ่านและสร้างคำโปรย...</p>
                <p className="text-sm text-muted-foreground">AI กำลังอ่าน {contentChapters.length} ตอน อาจใช้เวลา 30-60 วินาที</p>
              </div>
            </div>
          )}

          {blurbs && !loading && (
            <div className="space-y-6">
              {/* Summary */}
              {summary && (
                <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold">สรุปเรื่องทั้งหมด</p>
                    <CopyButton text={summary} label="คัดลอก" size="sm" />
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed">{summary}</p>
                </div>
              )}

              {/* Blurb options */}
              <div>
                <p className="text-sm font-semibold mb-3">เลือกคำโปรยที่ถูกใจ</p>
                <div className="space-y-3">
                  {BLURB_TYPES.map((type) => {
                    const Icon = type.icon;
                    const text = blurbs[type.id] || "";
                    const isSelected = selectedBlurb === type.id;
                    return (
                      <div
                        key={type.id}
                        onClick={() => setSelectedBlurb(type.id)}
                        className={`rounded-xl border-2 px-4 py-3.5 cursor-pointer transition-all ${
                          isSelected ? type.activeColor + " ring-1 ring-primary/30" : type.color + " hover:opacity-90"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 mb-1.5">
                            <Icon className="w-4 h-4 text-primary shrink-0" />
                            <span className="text-sm font-semibold">{type.label}</span>
                            <span className="text-xs text-muted-foreground">— {type.desc}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <CopyButton text={text} label="คัดลอก" size="sm" />
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-primary" />}
                          </div>
                        </div>
                        <p className="text-sm leading-relaxed text-foreground/85">{text}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedBlurb && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-emerald-800">
                      เลือก: {BLURB_TYPES.find((t) => t.id === selectedBlurb)?.label}
                    </p>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      บันทึกเป็นคำโปรยของเรื่อง — หน้าส่งออกจะดึงไปใช้โดยอัตโนมัติ
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="gap-1.5 shrink-0"
                    onClick={handleSaveBlurb}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    {saving ? "กำลังบันทึก..." : "ใช้เป็นคำโปรยของเรื่อง"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <div className="px-6 py-4 border-t border-border/60 shrink-0 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>ปิด</Button>
          <Button onClick={handleGenerate} disabled={loading || contentChapters.length === 0} className="gap-2">
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" />กำลังสร้าง...</>
              : <><Sparkles className="w-4 h-4" />{blurbs ? "สร้างใหม่" : "สร้างสรุป + คำโปรย"}</>
            }
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}