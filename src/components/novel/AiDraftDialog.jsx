import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Sparkles, RefreshCw, CheckCheck, Wand2, ChevronRight, Bot, Clock } from "lucide-react";
import { toast } from "sonner";

const WORD_TARGETS = [
  { label: "สั้น ~800 คำ", value: 800 },
  { label: "กลาง ~1,200 คำ", value: 1200 },
  { label: "ยาว ~2,000 คำ", value: 2000 },
  { label: "ยาวมาก ~3,000 คำ", value: 3000 },
];

const DEFAULT_WRITER_PROMPT = `คุณคือนักเขียนนิยายภาษาไทยมืออาชีพที่กำลังร่างตอนใหม่ให้ผู้เขียน
คุณต้องร่างเนื้อหาตอนที่สมบูรณ์ตามโครงที่ได้รับ รักษาสำนวนและโทนของเรื่อง ใช้ภาษาไทยที่อ่านลื่น`;

// สร้าง system prompt สำหรับร่างตอน
function buildDraftSystemPrompt(novel, characters, worldEntries, plotEvents, chapters, currentChapter, writerPrompt, linkedEvent) {
  let ctx = `[บทบาท]\n${writerPrompt || DEFAULT_WRITER_PROMPT}\n\n`;

  ctx += `[บริบทเรื่อง]\n`;
  ctx += `ชื่อเรื่อง: ${novel.title}\n`;
  if (novel.genre) ctx += `แนว: ${novel.genre}\n`;
  if (novel.era) ctx += `ยุคสมัย/ฉากหลัง: ${novel.era}\n`;
  if (novel.synopsis) ctx += `เรื่องย่อ: ${novel.synopsis}\n`;

  if (characters.length > 0) {
    ctx += `\n[ตัวละคร]\n`;
    characters.forEach((c) => {
      ctx += `• ${c.name} (${c.role || "ตัวประกอบ"})${c.age ? ` อายุ ${c.age}` : ""}`;
      if (c.personality) ctx += ` — ${c.personality}`;
      ctx += `\n`;
      if (c.appearance)    ctx += `  ลักษณะ: ${c.appearance}\n`;
      if (c.background)    ctx += `  ปูมหลัง: ${c.background}\n`;
      if (c.desire)        ctx += `  Want: ${c.desire}\n`;
      if (c.wound)         ctx += `  Wound: ${c.wound}\n`;
      if (c.relationships) ctx += `  ความสัมพันธ์: ${c.relationships}\n`;
    });
  }

  if (worldEntries.length > 0) {
    ctx += `\n[โลกและฉาก]\n`;
    worldEntries.forEach((w) => {
      ctx += `• [${w.category || "อื่นๆ"}] ${w.title}${w.description ? `: ${w.description}` : ""}\n`;
    });
  }

  if (plotEvents.length > 0) {
    ctx += `\n[ไทม์ไลน์]\n`;
    plotEvents.forEach((e) => {
      ctx += `• #${e.order} ${e.title}${e.is_historical ? " [ประวัติศาสตร์]" : ""}${e.time_period ? ` (${e.time_period})` : ""}\n`;
      if (e.description) ctx += `  ${e.description}\n`;
    });
  }

  // ตอนก่อนหน้า (เอาล่าสุด 2 ตอน เพื่อรักษาความต่อเนื่อง)
  const prevChapters = chapters
    .filter((ch) => ch.id !== currentChapter.id && ch.content)
    .slice(-2);
  if (prevChapters.length > 0) {
    ctx += `\n[ตอนก่อนหน้า — รักษาความต่อเนื่อง]\n`;
    prevChapters.forEach((ch) => {
      const preview = ch.content.substring(0, 1500);
      ctx += `\n— ตอนที่ ${ch.order}: "${ch.title}" —\n${preview}${ch.content.length > 1500 ? "\n…(ต่อ)" : ""}\n`;
    });
  }

  if (linkedEvent) {
    ctx += `\n[เหตุการณ์หลักที่ตอนนี้ต้องบรรยาย — สำคัญมาก]\n`;
    ctx += `ลำดับ ${linkedEvent.order}: ${linkedEvent.title}\n`;
    if (linkedEvent.description) ctx += `รายละเอียด: ${linkedEvent.description}\n`;
    if (linkedEvent.time_period) ctx += `ช่วงเวลา: ${linkedEvent.time_period}\n`;
    if (linkedEvent.characters_involved) ctx += `ตัวละครที่เกี่ยวข้อง: ${linkedEvent.characters_involved}\n`;
    ctx += `→ ตอนนี้ต้องเล่าเหตุการณ์นี้ให้ครบ ใช้เป็นแกนกลางของพล็อต\n`;
  }

  ctx += `\n[คำสั่งสำคัญ]\n`;
  ctx += `- ร่างเนื้อหาตอนนี้ให้ครบตามความยาวที่กำหนด อย่าตัดจบกลางคัน\n`;
  ctx += `- ใช้ "Show don't tell" แสดงผ่านการกระทำและบทสนทนา ไม่บรรยายอารมณ์ตรงๆ\n`;
  ctx += `- จบตอนด้วย chapter hook ที่ดึงให้อยากอ่านต่อ\n`;
  ctx += `- ใช้ภาษาไทยที่อ่านลื่น เหมาะกับยุคสมัยของเรื่อง หลีกเลี่ยงคำทับศัพท์สมัยใหม่ถ้าเป็นเรื่องย้อนยุค\n`;
  ctx += `- ผลลัพธ์: เฉพาะเนื้อหาตอน ไม่ต้องมีคำนำหรืออธิบาย\n`;

  return ctx;
}

function buildDraftPrompt(form, systemPrompt, wordTarget) {
  let prompt = systemPrompt;
  prompt += `\n\n[โจทย์ตอนที่ต้องร่าง]\n`;
  prompt += `ชื่อตอน: ${form.chapterTitle}\n`;
  prompt += `ความยาวที่ต้องการ: ประมาณ ${wordTarget} คำ\n`;
  if (form.summary) prompt += `\nสิ่งที่ต้องเกิดในตอนนี้:\n${form.summary}\n`;
  if (form.characters) prompt += `\nตัวละครในตอน: ${form.characters}\n`;
  if (form.tone) prompt += `\nโทน/มุมมองการเขียน: ${form.tone}\n`;
  prompt += `\nร่างตอนนี้ให้ครบ ${wordTarget} คำ:\n`;
  return prompt;
}

// ขัดเกลาสำนวน
function buildPolishPrompt(draft, systemPrompt) {
  return `${systemPrompt}\n\n[งาน: ขัดเกลาสำนวน]\nนำเนื้อหาต่อไปนี้มาขัดเกลาสำนวนให้อ่านลื่นและมีพลังขึ้น รักษาโครงเรื่องและเนื้อหาเดิมทั้งหมดไว้ ปรับเฉพาะภาษาและจังหวะประโยค:\n\n${draft}`;
}

// Step 1: form, Step 2: review draft
export default function AiDraftDialog({ open, onClose, chapter, novel, novelId, onInsert }) {
  const [step, setStep] = useState(1); // 1=form, 2=review
  const [loading, setLoading] = useState(false);
  const [loadingType, setLoadingType] = useState(""); // "draft" | "polish"
  const [draft, setDraft] = useState("");
  const [selectedWriterId, setSelectedWriterId] = useState(null);
  const [linkedPlotEventId, setLinkedPlotEventId] = useState(chapter?.plot_event_id || "");
  const [form, setForm] = useState({
    chapterTitle: chapter?.title || "",
    summary: chapter?.plot_event_description || "",
    characters: "",
    tone: "",
    wordTarget: 1200,
  });

  const { data: writers = [] } = useQuery({
    queryKey: ["writers"],
    queryFn: () => base44.entities.Writer.list(),
    enabled: open,
    staleTime: 0,
  });
  const activeWriters = writers.filter((w) => w.is_active !== false);

  // Auto-select first active writer
  useEffect(() => {
    if (activeWriters.length > 0 && !selectedWriterId) {
      setSelectedWriterId(activeWriters[0].id);
    }
  }, [activeWriters.length]);

  // Sync plot event when chapter changes (e.g. when dialog opens)
  useEffect(() => {
    if (open) {
      setLinkedPlotEventId(chapter?.plot_event_id || "");
      setForm((f) => ({
        ...f,
        chapterTitle: chapter?.title || "",
        summary: chapter?.plot_event_description || f.summary || "",
      }));
    }
  }, [open]);

  const selectedWriter = activeWriters.find((w) => w.id === selectedWriterId) || activeWriters[0];

  const { data: characters = [] } = useQuery({
    queryKey: ["characters", novelId],
    queryFn: () => base44.entities.Character.filter({ novel_id: novelId }),
    enabled: open,
  });
  const { data: worldEntries = [] } = useQuery({
    queryKey: ["worldEntries", novelId],
    queryFn: () => base44.entities.WorldEntry.filter({ novel_id: novelId }),
    enabled: open,
  });
  const { data: plotEvents = [] } = useQuery({
    queryKey: ["plotEvents", novelId],
    queryFn: () => base44.entities.PlotEvent.filter({ novel_id: novelId }, "order"),
    enabled: open,
  });
  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters", novelId],
    queryFn: () => base44.entities.Chapter.filter({ novel_id: novelId }, "order"),
    enabled: open,
  });

  const getSystemPrompt = () =>
    buildDraftSystemPrompt(novel, characters, worldEntries, plotEvents, chapters, chapter, selectedWriter?.system_prompt, linkedEvent);

  const handleDraft = async () => {
    setLoading(true);
    setLoadingType("draft");
    const sysPrompt = getSystemPrompt();
    const prompt = buildDraftPrompt(form, sysPrompt, form.wordTarget);
    const result = await base44.integrations.Core.InvokeLLM({ prompt, model: "claude_sonnet_4_6" });
    setDraft(typeof result === "string" ? result : result?.text || "");
    setStep(2);
    setLoading(false);
    setLoadingType("");
  };

  const handlePolish = async () => {
    setLoading(true);
    setLoadingType("polish");
    const sysPrompt = getSystemPrompt();
    const prompt = buildPolishPrompt(draft, sysPrompt);
    const result = await base44.integrations.Core.InvokeLLM({ prompt, model: "claude_sonnet_4_6" });
    setDraft(typeof result === "string" ? result : result?.text || "");
    setLoading(false);
    setLoadingType("");
  };

  const handleInsert = () => {
    onInsert(draft);
    toast.success("ใส่ร่างลง editor แล้ว");
    handleClose();
  };

  const handleClose = () => {
    setStep(1);
    setDraft("");
    setLinkedPlotEventId("");
    setForm({ chapterTitle: chapter?.title || "", summary: "", characters: "", tone: "", wordTarget: 1200 });
    setSelectedWriterId(null);
    onClose();
  };

  const linkedEvent = plotEvents.find((e) => e.id === linkedPlotEventId);

  const handleSelectPlotEvent = (evId) => {
    setLinkedPlotEventId(evId);
    const ev = plotEvents.find((e) => e.id === evId);
    if (ev?.description) {
      setForm((f) => ({ ...f, summary: ev.description }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/60 shrink-0">
          <DialogTitle className="font-heading flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            ให้ AI ร่างตอนนี้
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            AI จะร่างตอนเต็มโดยอ้างอิงบริบทเรื่อง ตัวละคร และตอนก่อนหน้า
            <br />
            <span className="text-amber-600 font-medium">ใช้ Claude Sonnet (สูงกว่าค่าเฉลี่ย integration credits)</span>
          </p>
        </DialogHeader>

        {step === 1 ? (
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
            {/* เลือกนักเขียน */}
            {activeWriters.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-1.5 block flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                  เลือกนักเขียน AI
                </label>
                <Select value={selectedWriterId || ""} onValueChange={setSelectedWriterId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="เลือกนักเขียน" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeWriters.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        <div>
                          <span className="font-medium">{w.name}</span>
                          {w.description && <span className="text-muted-foreground ml-1.5 text-xs">— {w.description}</span>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedWriter?.style && (
                  <p className="text-xs text-primary/60 mt-1">โทน: {selectedWriter.style}</p>
                )}
              </div>
            )}

            {/* เลือกเหตุการณ์ไทม์ไลน์ */}
            {plotEvents.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-1.5 block flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  อิงเหตุการณ์ไทม์ไลน์
                </label>
                <Select value={linkedPlotEventId || ""} onValueChange={handleSelectPlotEvent}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="— ไม่ผูกกับเหตุการณ์ —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>— ไม่ผูกกับเหตุการณ์ —</SelectItem>
                    {plotEvents.map((ev) => (
                      <SelectItem key={ev.id} value={ev.id}>
                        <span className="font-medium text-primary/70 mr-1.5">#{ev.order}</span>
                        {ev.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {linkedEvent && (
                  <p className="text-xs text-amber-700/80 bg-amber-50/60 rounded-lg px-3 py-1.5 mt-1.5 leading-relaxed">
                    <span className="font-medium">ลำดับ {linkedEvent.order} — {linkedEvent.title}</span>
                    {linkedEvent.description && <><br />{linkedEvent.description}</>}
                  </p>
                )}
              </div>
            )}

            {/* ชื่อตอน */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">ชื่อตอน</label>
              <Input
                value={form.chapterTitle}
                onChange={(e) => setForm((f) => ({ ...f, chapterTitle: e.target.value }))}
                placeholder="ชื่อตอนนี้"
              />
            </div>

            {/* สรุปเหตุการณ์ */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                สิ่งที่อยากให้เกิดในตอนนี้ <span className="text-destructive">*</span>
              </label>
              <Textarea
                rows={4}
                value={form.summary}
                onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                placeholder="เช่น: พระเอกและนางเอกพบกันครั้งแรกที่ตลาด นางเอกทำกระบุงหกใส่พระเอก เกิดความเข้าใจผิด พระเอกโกรธแต่ถูกตัดสินใจช่วยเหลือเพราะมองเห็นเครื่องหมายตระกูลของเธอ จบตอนด้วยทั้งคู่แยกทางโดยไม่รู้ชื่อกัน"
                className="resize-none"
              />
            </div>

            {/* ตัวละครในตอน */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">ตัวละครที่อยู่ในตอนนี้</label>
              <Input
                value={form.characters}
                onChange={(e) => setForm((f) => ({ ...f, characters: e.target.value }))}
                placeholder="เช่น: พระเอก, นางเอก, แม่ค้าตลาด"
              />
              {characters.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {characters.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          characters: f.characters
                            ? f.characters.includes(c.name)
                              ? f.characters
                              : `${f.characters}, ${c.name}`
                            : c.name,
                        }))
                      }
                      className="text-xs px-2 py-0.5 rounded-full border border-border/60 bg-muted/40 hover:bg-primary/10 hover:border-primary/30 transition-colors"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* โทน/มุมมอง */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">โทนและมุมมองการเขียน (ถ้ามี)</label>
              <Input
                value={form.tone}
                onChange={(e) => setForm((f) => ({ ...f, tone: e.target.value }))}
                placeholder="เช่น: มุมมองพระเอก, โทนอบอุ่นสดใส, บรรยากาศตึงเครียด"
              />
            </div>

            {/* ความยาว */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">ความยาวที่ต้องการ</label>
              <div className="grid grid-cols-2 gap-2">
                {WORD_TARGETS.map((wt) => (
                  <button
                    key={wt.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, wordTarget: wt.value }))}
                    className={`py-2.5 px-3 rounded-xl border text-sm font-medium transition-all ${
                      form.wordTarget === wt.value
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border/60 hover:border-primary/30 hover:bg-muted/40"
                    }`}
                  >
                    {wt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Step 2: Review */
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="px-6 py-3 bg-amber-50/50 border-b border-amber-200/60 shrink-0">
              <p className="text-xs text-amber-700 font-medium">
                ร่างโดย AI — อ่านทบทวนและแก้ไขก่อนใส่ลง editor
              </p>
            </div>
            <ScrollArea className="flex-1 px-6 py-5">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    {loadingType === "polish" ? "กำลังขัดเกลาสำนวน..." : "กำลังร่างตอน... อาจใช้เวลา 30-60 วินาที"}
                  </p>
                </div>
              ) : (
                <pre
                  className="whitespace-pre-wrap text-sm leading-[1.85] text-foreground/90"
                  style={{ fontFamily: "'Sarabun', 'Noto Sans Thai', sans-serif", fontSize: "15px" }}
                >
                  {draft}
                </pre>
              )}
            </ScrollArea>
          </div>
        )}

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-border/60 shrink-0 flex items-center justify-between gap-2">
          {step === 1 ? (
            <>
              <Button variant="ghost" onClick={handleClose} size="sm">
                ยกเลิก
              </Button>
              <Button
                onClick={handleDraft}
                disabled={!form.summary.trim() || loading}
                className="gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                สร้างร่าง
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep(1)}
                disabled={loading}
              >
                ← ปรับโจทย์
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleDraft}
                  disabled={loading}
                >
                  {loading && loadingType === "draft" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  ร่างใหม่
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handlePolish}
                  disabled={loading || !draft}
                >
                  {loading && loadingType === "polish" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="w-3.5 h-3.5" />
                  )}
                  ขัดเกลาสำนวน
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={handleInsert}
                  disabled={loading || !draft}
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  ใส่ลง editor
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}