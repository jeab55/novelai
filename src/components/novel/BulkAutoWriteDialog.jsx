import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Sparkles, X, CheckCircle2, SkipForward, AlertTriangle, Bot, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useBulkWrite } from "@/lib/BulkWriteContext";

const DEFAULT_WRITER_PROMPT = `คุณคือนักเขียนนิยายภาษาไทยมืออาชีพที่กำลังร่างตอนใหม่ให้ผู้เขียน
คุณต้องร่างเนื้อหาตอนที่สมบูรณ์ตามโครงที่ได้รับ รักษาสำนวนและโทนของเรื่อง ใช้ภาษาไทยที่อ่านลื่น`;

const WORD_TARGETS = [
  { label: "สั้น ~800 คำ", value: 800 },
  { label: "กลาง ~1,200 คำ", value: 1200 },
  { label: "ยาว ~2,000 คำ", value: 2000 },
  { label: "ยาวมาก ~3,000 คำ", value: 3000 },
];

function buildSystemPrompt(novel, characters, worldEntries, plotEvents, prevChapters, writerPrompt) {
  let ctx = `[บทบาท]\n${writerPrompt || DEFAULT_WRITER_PROMPT}\n\n`;

  if (novel.writing_style === "รอมแพง") {
    ctx += `[สไตล์การเขียน: รอมแพง — โรแมนติกคอมเมดี้อิงประวัติศาสตร์]\n`;
    ctx += `1. จบสุข (HEA) เสมอ ความรักต้องชนะทุกอุปสรรค\n`;
    ctx += `2. ตัวเอกคือ "คนยุคปัจจุบัน" ในโลกย้อนยุค มองโลกเป็น "คนนอก" — ฉลาด ขำ ดี ไม่ถือชนชั้น\n`;
    ctx += `3. ความขัดแย้งหลักมาจากช่องว่างวัฒนธรรมระหว่างยุค\n`;
    ctx += `4. สอดแทรกข้อมูลประวัติศาสตร์ผ่านการกระทำ (อาหาร ของใช้ วิถีชีวิต) ไม่บรรยายแบบตำรา\n`;
    ctx += `5. ภาษาบรรยายร่วมสมัย บทสนทนาโรยคำโบราณพอได้กลิ่นอาย อย่าใช้มากจนอ่านยาก\n`;
    ctx += `6. บุคคลจริงในประวัติศาสตร์เป็นฉากหลัง ตัวเอกอยู่ "ขอบ" เหตุการณ์\n`;
    ctx += `7. โทนอบอุ่น ขำ เสียดสีเบาๆ บทเกี้ยวพาราสีละเมียดละไม\n\n`;
  }

  ctx += `[บริบทเรื่อง]\n`;
  ctx += `ชื่อเรื่อง: ${novel.title}\n`;
  if (novel.genre) ctx += `แนว: ${novel.genre}\n`;
  if (novel.writing_style && novel.writing_style !== "ทั่วไป") ctx += `สไตล์: ${novel.writing_style}\n`;
  if (novel.era) ctx += `ยุคสมัย/ฉากหลัง: ${novel.era}\n`;
  if (novel.synopsis) ctx += `เรื่องย่อ: ${novel.synopsis}\n`;
  if (novel.plot_outline) ctx += `\nโครงเรื่อง:\n${novel.plot_outline}\n`;

  if (characters.length > 0) {
    ctx += `\n[ตัวละคร]\n`;
    characters.forEach((c) => {
      ctx += `• ${c.name} (${c.role || "ตัวประกอบ"})`;
      if (c.personality) ctx += ` — ${c.personality}`;
      ctx += `\n`;
      if (c.appearance) ctx += `  ลักษณะ: ${c.appearance}\n`;
      if (c.background) ctx += `  ปูมหลัง: ${c.background}\n`;
      if (c.desire) ctx += `  Want: ${c.desire}\n`;
      if (c.wound) ctx += `  Wound: ${c.wound}\n`;
    });
  }

  if (worldEntries.length > 0) {
    ctx += `\n[โลกและฉาก]\n`;
    worldEntries.forEach((w) => {
      ctx += `• [${w.category || "อื่นๆ"}] ${w.title}${w.description ? `: ${w.description}` : ""}\n`;
    });
  }

  if (plotEvents.length > 0) {
    ctx += `\n[ไทม์ไลน์เหตุการณ์]\n`;
    plotEvents.forEach((e) => {
      ctx += `• #${e.order} ${e.title}${e.is_historical ? " [ประวัติศาสตร์]" : ""}`;
      if (e.time_period) ctx += ` (${e.time_period})`;
      ctx += `\n`;
      if (e.description) ctx += `  ${e.description}\n`;
    });
  }

  if (prevChapters.length > 0) {
    ctx += `\n[ตอนก่อนหน้า — รักษาความต่อเนื่อง]\n`;
    const recent = prevChapters.slice(-2);
    recent.forEach((ch) => {
      const preview = (ch.content || "").substring(0, 1500);
      ctx += `\n— ตอนที่ ${ch.order}: "${ch.title}" —\n${preview}${(ch.content || "").length > 1500 ? "\n…(ต่อ)" : ""}\n`;
    });
  }

  ctx += `\n[คำสั่งสำคัญ]\n`;
  ctx += `- ร่างเนื้อหาตอนนี้ให้ครบตามความยาวที่กำหนด อย่าตัดจบกลางคัน\n`;
  ctx += `- ผลลัพธ์: เฉพาะเนื้อหาตอน ไม่ต้องมีคำนำหรืออธิบาย\n`;
  return ctx;
}

export default function BulkAutoWriteDialog({ open, onClose, novel, novelId }) {
  const queryClient = useQueryClient();
  const { startJob, updateJob, finishJob } = useBulkWrite();
  const [step, setStep] = useState("settings"); // "settings" | "running" | "done"
  const [wordTarget, setWordTarget] = useState(1200);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [log, setLog] = useState([]);
  const [currentMsg, setCurrentMsg] = useState("");
  const [overwritePrompt, setOverwritePrompt] = useState(null);
  const cancelledRef = useRef(false);
  const doneCountRef = useRef(0);
  const errorCountRef = useRef(0);

  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters", novelId],
    queryFn: async () => {
      const all = await base44.entities.Chapter.filter({ novel_id: novelId }, "order");
      return all.filter((c) => !c.is_deleted);
    },
    enabled: open,
  });

  const { data: plotEvents = [] } = useQuery({
    queryKey: ["plotEvents", novelId],
    queryFn: async () => {
      const all = await base44.entities.PlotEvent.filter({ novel_id: novelId }, "order");
      return all.filter((e) => !e.is_deleted);
    },
    enabled: open,
  });

  const { data: characters = [] } = useQuery({
    queryKey: ["characters", novelId],
    queryFn: async () => {
      const all = await base44.entities.Character.filter({ novel_id: novelId });
      return all.filter((c) => !c.is_deleted);
    },
    enabled: open,
  });

  const { data: worldEntries = [] } = useQuery({
    queryKey: ["worldEntries", novelId],
    queryFn: async () => {
      const all = await base44.entities.WorldEntry.filter({ novel_id: novelId });
      return all.filter((w) => !w.is_deleted);
    },
    enabled: open,
  });

  const { data: novelWriter } = useQuery({
    queryKey: ["writers-all"],
    queryFn: () => base44.entities.Writer.list(),
    enabled: open && !!novel?.writer_id,
    select: (data) => data.find((w) => String(w.id) === String(novel?.writer_id)),
  });

  const askOverwrite = (order, title) =>
    new Promise((resolve) => setOverwritePrompt({ order, title, resolve }));

  const retryChapter = async (order) => {
    const entry = log.find((l) => l.order === order);
    if (!entry) return;
    setLog((l) => l.map((e) => e.order === order ? { ...e, status: "retrying" } : e));
    const target = novel?.target_chapters || 10;
    const writerPrompt = novelWriter?.system_prompt || "";
    const allChapters = await base44.entities.Chapter.filter({ novel_id: novelId }, "order");
    const contextChapters = allChapters
      .filter((c) => !c.is_deleted && c.order < order && c.content)
      .sort((a, b) => a.order - b.order);
    const plotEvents = await base44.entities.PlotEvent.filter({ novel_id: novelId }, "order");
    const chars = await base44.entities.Character.filter({ novel_id: novelId });
    const world = await base44.entities.WorldEntry.filter({ novel_id: novelId });
    const linkedEvent = plotEvents.find((e) => e.order === order);
    const sysPrompt = buildSystemPrompt(novel, chars, world, plotEvents, contextChapters, writerPrompt);
    let taskPrompt = sysPrompt;
    taskPrompt += `\n\n[โจทย์ตอนที่ต้องร่าง]\n`;
    taskPrompt += `ชื่อตอน: ${entry.title}\n`;
    taskPrompt += `ลำดับตอน: ${order} จาก ${target} ตอน\n`;
    taskPrompt += `ความยาวที่ต้องการ: ประมาณ ${wordTarget} คำ\n`;
    if (linkedEvent) {
      taskPrompt += `\nเหตุการณ์หลัก:\n• ${linkedEvent.title}`;
      if (linkedEvent.description) taskPrompt += `\n  ${linkedEvent.description}`;
      taskPrompt += `\n`;
    }
    taskPrompt += `\nร่างตอนนี้ให้ครบ ${wordTarget} คำ:\n`;
    try {
      const result = await base44.integrations.Core.InvokeLLM({ prompt: taskPrompt, model: "claude_sonnet_4_6" });
      let text = typeof result === "string" ? result : (result?.text || "");
      text = text.replace(/^```[\w]*\n?/m, "").replace(/\n?```$/m, "").trim();
      const wordCount = text.split(/\s+/).filter(Boolean).length;
      const existing = allChapters.find((c) => !c.is_deleted && c.order === order);
      if (existing) {
        await base44.entities.Chapter.update(existing.id, { content: text, word_count: wordCount, status: "ร่าง" });
      } else {
        await base44.entities.Chapter.create({ novel_id: novelId, title: entry.title, order, status: "ร่าง", content: text, word_count: wordCount });
      }
      setLog((l) => l.map((e) => e.order === order ? { ...e, status: "done", wordCount } : e));
      queryClient.invalidateQueries({ queryKey: ["chapters", novelId] });
      toast.success(`ตอนที่ ${order} สร้างสำเร็จ`);
    } catch {
      setLog((l) => l.map((e) => e.order === order ? { ...e, status: "error" } : e));
      toast.error(`ตอนที่ ${order} ล้มเหลวอีกครั้ง`);
    }
  };

  const handleStart = async () => {
    const target = novel?.target_chapters || 10;
    cancelledRef.current = false;
    doneCountRef.current = 0;
    errorCountRef.current = 0;
    setProgress({ current: 0, total: target });
    setLog([]);
    setCurrentMsg("");
    setStep("running");
    startJob(novelId, target);

    const writerPrompt = novelWriter?.system_prompt || "";
    const writtenSoFar = [];

    for (let i = 1; i <= target; i++) {
      if (cancelledRef.current) break;

      setProgress({ current: i, total: target });
      updateJob(novelId, { current: i, total: target });

      const existing = chapters.find((c) => c.order === i);
      const chapterTitle = existing?.title || `ตอนที่ ${i}`;

      if (existing?.content?.trim()) {
        setCurrentMsg(`⚠️ ตอนที่ ${i} "${chapterTitle}" มีเนื้อหาอยู่แล้ว — รอการตัดสินใจ`);
        const decision = await askOverwrite(i, chapterTitle);
        setOverwritePrompt(null);

        if (cancelledRef.current) break;

        if (decision === "skip") {
          writtenSoFar.push(existing);
          setLog((l) => [...l, { order: i, title: chapterTitle, status: "skip" }]);
          setCurrentMsg("");
          continue;
        }
      }

      const linkedEvent = plotEvents.find((e) => e.order === i);
      setCurrentMsg(`✍️ กำลังร่างตอนที่ ${i}/${target}: "${chapterTitle}"...`);

      const contextChapters = [
        ...chapters.filter(
          (c) => c.order < i && c.content && !writtenSoFar.find((w) => w.order === c.order)
        ),
        ...writtenSoFar.filter((c) => c.order < i),
      ].sort((a, b) => a.order - b.order);

      const sysPrompt = buildSystemPrompt(novel, characters, worldEntries, plotEvents, contextChapters, writerPrompt);

      let taskPrompt = sysPrompt;
      taskPrompt += `\n\n[โจทย์ตอนที่ต้องร่าง]\n`;
      taskPrompt += `ชื่อตอน: ${chapterTitle}\n`;
      taskPrompt += `ลำดับตอน: ${i} จาก ${target} ตอน\n`;
      taskPrompt += `ความยาวที่ต้องการ: ประมาณ ${wordTarget} คำ\n`;
      if (linkedEvent) {
        taskPrompt += `\nเหตุการณ์หลักที่ตอนนี้ต้องบรรยาย:\n• ${linkedEvent.title}`;
        if (linkedEvent.description) taskPrompt += `\n  ${linkedEvent.description}`;
        if (linkedEvent.time_period) taskPrompt += `\n  ช่วงเวลา: ${linkedEvent.time_period}`;
        taskPrompt += `\n`;
      }
      taskPrompt += `\nร่างตอนนี้ให้ครบ ${wordTarget} คำ:\n`;

      let generatedContent = "";
      try {
        const result = await base44.integrations.Core.InvokeLLM({ prompt: taskPrompt, model: "claude_sonnet_4_6" });
        let text = typeof result === "string" ? result : (result?.text || "");
        text = text.replace(/^```[\w]*\n?/m, "").replace(/\n?```$/m, "").trim();
        generatedContent = text;
      } catch (err) {
        errorCountRef.current += 1;
        setLog((l) => [...l, { order: i, title: chapterTitle, status: "error" }]);
        setCurrentMsg("");
        continue;
      }

      if (cancelledRef.current) break;

      const wordCount = generatedContent.split(/\s+/).filter(Boolean).length;

      if (existing) {
        await base44.entities.Chapter.update(existing.id, {
          content: generatedContent,
          word_count: wordCount,
          status: "ร่าง",
        });
        writtenSoFar.push({ ...existing, content: generatedContent, order: i });
      } else {
        const newCh = await base44.entities.Chapter.create({
          novel_id: novelId,
          title: chapterTitle,
          order: i,
          status: "ร่าง",
          content: generatedContent,
          word_count: wordCount,
        });
        writtenSoFar.push({ ...newCh, content: generatedContent, order: i });
      }

      doneCountRef.current += 1;
      updateJob(novelId, { current: i, total: target, doneCount: doneCountRef.current, errorCount: errorCountRef.current });
      setLog((l) => [...l, { order: i, title: chapterTitle, status: "done", wordCount }]);
      setCurrentMsg("");
    }

    queryClient.invalidateQueries({ queryKey: ["chapters", novelId] });
    finishJob(novelId, { doneCount: doneCountRef.current, errorCount: errorCountRef.current });
    setStep("done");
    if (!cancelledRef.current) {
      toast.success("สร้างตอนทั้งหมดเสร็จแล้ว!");
      if (errorCountRef.current === 0) {
        await base44.entities.Novel.update(novelId, { auto_written: true });
        queryClient.invalidateQueries({ queryKey: ["novels"] });
      }
    } else {
      toast.info("หยุดการสร้างตอนกลางคัน");
    }
    setCurrentMsg("");
  };

  const handleCancel = () => {
    cancelledRef.current = true;
    if (overwritePrompt) {
      overwritePrompt.resolve("skip");
      setOverwritePrompt(null);
    }
  };

  const handleClose = () => {
    cancelledRef.current = true;
    if (overwritePrompt) {
      overwritePrompt.resolve("skip");
      setOverwritePrompt(null);
    }
    setStep("settings");
    setLog([]);
    setCurrentMsg("");
    onClose();
  };

  const target = novel?.target_chapters || 10;
  const progressPct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  const doneCount = log.filter((l) => l.status === "done").length;
  const skipCount = log.filter((l) => l.status === "skip").length;
  const errorCount = log.filter((l) => l.status === "error").length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/60 shrink-0">
          <DialogTitle className="font-heading flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI สร้างตอนทั้งหมด
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            สร้างทีละตอนตามลำดับจนครบ{" "}
            <span className="font-semibold text-foreground">{target} ตอน</span>{" "}
            อิงโครงเรื่อง ไทม์ไลน์ และตัวละคร
            <br />
            <span className="text-amber-600 font-medium">
              ใช้ Claude Sonnet — integration credits สูงมาก ({target} ครั้ง)
            </span>
          </p>
        </DialogHeader>

        {/* Settings */}
        {step === "settings" && (
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
            <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">จำนวนตอนเป้าหมาย</span>
                <span className="font-semibold">{target} ตอน</span>
              </div>
              {novelWriter && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">นักเขียน AI</span>
                  <span className="flex items-center gap-1.5 font-semibold text-primary">
                    <Bot className="w-3.5 h-3.5" />
                    {novelWriter.name}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">ตอนที่มีเนื้อหาแล้ว</span>
                <span className="font-semibold">
                  {chapters.filter((c) => c.content?.trim()).length} ตอน
                </span>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">ความยาวต่อตอน</label>
              <div className="grid grid-cols-2 gap-2">
                {WORD_TARGETS.map((wt) => (
                  <button
                    key={wt.value}
                    type="button"
                    onClick={() => setWordTarget(wt.value)}
                    className={`py-2.5 px-3 rounded-xl border text-sm font-medium transition-all ${
                      wordTarget === wt.value
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
        )}

        {/* Running / Done */}
        {(step === "running" || step === "done") && (
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Progress */}
            <div className="px-6 py-4 border-b border-border/40 shrink-0 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {progress.current} / {progress.total} ตอน
                </span>
                <span className="text-muted-foreground">{progressPct}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              {currentMsg && (
                <p className="text-xs text-muted-foreground leading-relaxed">{currentMsg}</p>
              )}
            </div>

            {/* Overwrite prompt */}
            {overwritePrompt && (
              <div className="px-6 py-4 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-800/40 shrink-0">
                <div className="flex items-start gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      ตอนที่ {overwritePrompt.order} มีเนื้อหาอยู่แล้ว
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                      "{overwritePrompt.title}"
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-amber-300 text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:border-amber-700"
                    onClick={() => overwritePrompt.resolve("skip")}
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                    ข้ามตอนนี้
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
                    onClick={() => overwritePrompt.resolve("overwrite")}
                  >
                    เขียนทับ
                  </Button>
                </div>
              </div>
            )}

            {/* Success banner */}
            {step === "done" && errorCount === 0 && !cancelledRef.current && (
              <div className="mx-6 mb-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 px-4 py-3 flex items-center gap-3 shrink-0">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">สร้างนิยายครบทุกตอนแล้ว!</p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">{doneCount} ตอน · {log.reduce((s, e) => s + (e.wordCount || 0), 0).toLocaleString()} คำ</p>
                </div>
              </div>
            )}

            {/* Log */}
            <ScrollArea className="flex-1 px-6 py-4">
              <div className="space-y-2">
                {log.map((entry, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 text-sm">
                    {(entry.status === "done") && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    )}
                    {entry.status === "skip" && (
                      <SkipForward className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    {(entry.status === "error" || entry.status === "retrying") && (
                      entry.status === "retrying"
                        ? <Loader2 className="w-4 h-4 animate-spin text-amber-500 shrink-0" />
                        : <X className="w-4 h-4 text-destructive shrink-0" />
                    )}
                    <span className={entry.status === "skip" ? "text-muted-foreground" : entry.status === "error" ? "text-destructive" : ""}>
                      ตอนที่ {entry.order}: {entry.title}
                    </span>
                    <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                      {entry.status === "done" && entry.wordCount
                        ? `${entry.wordCount.toLocaleString()} คำ`
                        : entry.status === "skip"
                        ? "ข้ามแล้ว"
                        : entry.status === "error"
                        ? (
                          <button
                            onClick={() => retryChapter(entry.order)}
                            className="flex items-center gap-1 text-xs text-destructive hover:text-destructive/80 border border-destructive/30 rounded px-1.5 py-0.5 hover:bg-destructive/5 transition-colors"
                          >
                            <RefreshCw className="w-3 h-3" />
                            ลองใหม่
                          </button>
                        )
                        : entry.status === "retrying" ? "กำลังลองใหม่..." : ""}
                    </span>
                  </div>
                ))}
                {step === "running" && !overwritePrompt && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>กำลังทำงาน...</span>
                  </div>
                )}
                {step === "done" && log.length === 0 && (
                  <p className="text-sm text-muted-foreground">ไม่มีตอนที่สร้าง</p>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/60 shrink-0 flex items-center justify-between gap-2">
          {step === "settings" && (
            <>
              <Button variant="ghost" onClick={handleClose} size="sm">
                ยกเลิก
              </Button>
              <Button onClick={handleStart} className="gap-2">
                <Sparkles className="w-4 h-4" />
                เริ่มสร้างทั้งหมด {target} ตอน
              </Button>
            </>
          )}
          {step === "running" && (
            <>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleCancel}
                className="gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                หยุดกลางคัน
              </Button>
              <span className="text-xs text-muted-foreground">
                เขียนแล้ว {doneCount} · ข้าม {skipCount}
                {errorCount > 0 ? ` · ผิดพลาด ${errorCount}` : ""}
              </span>
            </>
          )}
          {step === "done" && (
            <>
              <span className="text-xs text-muted-foreground">
                เขียนแล้ว {doneCount} · ข้าม {skipCount}
                {errorCount > 0 ? ` · ผิดพลาด ${errorCount}` : ""}
              </span>
              <Button onClick={handleClose} size="sm">
                ปิด
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}