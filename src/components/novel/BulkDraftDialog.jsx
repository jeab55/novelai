import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, CheckCircle2, XCircle, StopCircle } from "lucide-react";
import { toast } from "sonner";
import { saveChapterContent } from "@/lib/saveChapterContent";

const WORD_TARGETS = [
  { label: "สั้น ~800 คำ", value: 800 },
  { label: "กลาง ~1,200 คำ", value: 1200 },
  { label: "ยาว ~2,000 คำ", value: 2000 },
];

const DEFAULT_WRITER_PROMPT = `คุณคือนักเขียนนิยายภาษาไทยมืออาชีพที่กำลังร่างตอนใหม่ให้ผู้เขียน
คุณต้องร่างเนื้อหาตอนที่สมบูรณ์ตามโครงที่ได้รับ รักษาสำนวนและโทนของเรื่อง ใช้ภาษาไทยที่อ่านลื่น`;

function buildSystemPrompt(novel, characters, worldEntries, plotEvents, chapters, currentChapter, writerPrompt, linkedEvent) {
  let ctx = `[บทบาท]\n${writerPrompt || DEFAULT_WRITER_PROMPT}\n\n`;
  ctx += `[บริบทเรื่อง]\nชื่อเรื่อง: ${novel.title}\n`;
  if (novel.genre) ctx += `แนว: ${novel.genre}\n`;
  if (novel.era) ctx += `ยุคสมัย/ฉากหลัง: ${novel.era}\n`;
  if (novel.synopsis) ctx += `เรื่องย่อ: ${novel.synopsis}\n`;
  if (characters.length > 0) {
    ctx += `\n[ตัวละคร]\n`;
    characters.forEach((c) => {
      ctx += `• ${c.name} (${c.role || "ตัวประกอบ"})${c.personality ? ` — ${c.personality}` : ""}\n`;
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
      ctx += `• #${e.order} ${e.title}${e.description ? ` — ${e.description}` : ""}\n`;
    });
  }
  const prevChapters = chapters
    .filter((ch) => ch.id !== currentChapter?.id && ch.content && (ch.word_count || 0) > 0)
    .slice(-2);
  if (prevChapters.length > 0) {
    ctx += `\n[ตอนก่อนหน้า — รักษาความต่อเนื่อง]\n`;
    prevChapters.forEach((ch) => {
      const preview = ch.content.substring(0, 1200);
      ctx += `\n— ตอนที่ ${ch.order}: "${ch.title}" —\n${preview}${ch.content.length > 1200 ? "\n…(ต่อ)" : ""}\n`;
    });
  }
  if (linkedEvent) {
    ctx += `\n[เหตุการณ์หลัก]\nลำดับ ${linkedEvent.order}: ${linkedEvent.title}\n`;
    if (linkedEvent.description) ctx += `รายละเอียด: ${linkedEvent.description}\n`;
  }
  ctx += `\n[คำสั่งสำคัญ]\n`;
  ctx += `- ร่างเนื้อหาตอนนี้ให้ครบตามความยาวที่กำหนด อย่าตัดจบกลางคัน\n`;
  ctx += `- ใช้ "Show don't tell" จบตอนด้วย chapter hook\n`;
  ctx += `- ทุกบทสนทนาต้องระบุผู้พูดชัดเจน เพิ่มภาษากายและอารมณ์ประกอบ\n`;
  ctx += `- ผลลัพธ์: เฉพาะเนื้อหาตอน ไม่ต้องมีคำนำหรืออธิบาย\n`;
  return ctx;
}

export default function BulkDraftDialog({ open, onClose, novel, novelId }) {
  const [wordTarget, setWordTarget] = useState(1200);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState([]); // [{chapterId, title, status: 'pending'|'running'|'done'|'error', error}]
  const [current, setCurrent] = useState(0); // index currently drafting
  const cancelRef = useRef(false);
  const queryClient = useQueryClient();

  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters", novelId],
    queryFn: async () => {
      const all = await base44.entities.Chapter.filter({ novel_id: novelId }, "order");
      return all.filter((c) => !c.is_deleted);
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
  const { data: plotEvents = [] } = useQuery({
    queryKey: ["plotEvents", novelId],
    queryFn: async () => {
      const all = await base44.entities.PlotEvent.filter({ novel_id: novelId }, "order");
      return all.filter((e) => !e.is_deleted);
    },
    enabled: open,
  });
  const { data: writers = [] } = useQuery({
    queryKey: ["writers-all"],
    queryFn: () => base44.entities.Writer.list(),
    enabled: open,
  });

  const emptyChapters = chapters.filter((ch) => !ch.word_count || ch.word_count === 0);
  const novelWriter = writers.find((w) => String(w.id) === String(novel?.writer_id));

  const handleStart = async () => {
    if (emptyChapters.length === 0) return;
    cancelRef.current = false;
    setRunning(true);

    const initialLogs = emptyChapters.map((ch) => ({
      chapterId: ch.id,
      title: ch.title,
      status: "pending",
      error: null,
    }));
    setLogs(initialLogs);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < emptyChapters.length; i++) {
      if (cancelRef.current) break;

      const ch = emptyChapters[i];
      setCurrent(i);
      setLogs((prev) => prev.map((l, idx) => idx === i ? { ...l, status: "running" } : l));

      try {
        const linkedEvent = plotEvents.find((e) => e.id === ch.plot_event_id);
        const sysPrompt = buildSystemPrompt(novel, characters, worldEntries, plotEvents, chapters, ch, novelWriter?.system_prompt, linkedEvent);
        const prompt = `${sysPrompt}\n\n[โจทย์ตอนที่ต้องร่าง]\nชื่อตอน: ${ch.title}\nความยาวที่ต้องการ: ประมาณ ${wordTarget} คำ${ch.plot_event_description ? `\nสิ่งที่ต้องเกิดในตอนนี้: ${ch.plot_event_description}` : ""}\nร่างตอนนี้ให้ครบ ${wordTarget} คำ:\n`;

        const result = await base44.integrations.Core.InvokeLLM({ prompt, model: "claude_sonnet_4_6" });
        let text = typeof result === "string" ? result : (result?.text || "");
        text = text.replace(/^```[\w]*\n?/m, "").replace(/\n?```$/m, "").trim();

        const saveResult = await saveChapterContent({
          novelId,
          chapterId: ch.id,
          title: ch.title,
          order: ch.order,
          content: text,
          status: "ร่าง",
        });

        if (saveResult.success) {
          successCount++;
          setLogs((prev) => prev.map((l, idx) => idx === i ? { ...l, status: "done" } : l));
          queryClient.invalidateQueries({ queryKey: ["chapters", novelId] });
        } else {
          failCount++;
          setLogs((prev) => prev.map((l, idx) => idx === i ? { ...l, status: "error", error: saveResult.error || "บันทึกไม่สำเร็จ" } : l));
        }
      } catch (err) {
        failCount++;
        setLogs((prev) => prev.map((l, idx) => idx === i ? { ...l, status: "error", error: err.message || "เกิดข้อผิดพลาด" } : l));
      }
    }

    const wasCancelled = cancelRef.current;
    setRunning(false);
    setCurrent(-1);

    if (wasCancelled) {
      toast.success(`ยกเลิกแล้ว — บันทึกสำเร็จ ${successCount} ตอน`);
    } else {
      if (failCount === 0) {
        toast.success(`ร่างครบ ${successCount} ตอน สำเร็จทั้งหมด! 🎉`);
      } else {
        toast.warning(`ร่างเสร็จ: สำเร็จ ${successCount} ตอน, ล้มเหลว ${failCount} ตอน`);
      }
    }
  };

  const handleCancel = () => {
    cancelRef.current = true;
  };

  const handleClose = () => {
    if (running) {
      if (!window.confirm("AI กำลังร่างอยู่ ถ้าปิดตอนนี้การร่างจะหยุด (ตอนที่เสร็จแล้วจะถูกบันทึกไว้) ต้องการหยุดจริงหรือไม่?")) return;
      cancelRef.current = true;
    }
    setRunning(false);
    setLogs([]);
    setCurrent(0);
    onClose();
  };

  const doneCount = logs.filter((l) => l.status === "done").length;
  const progress = logs.length > 0 ? (doneCount / logs.length) * 100 : 0;
  const isDone = !running && logs.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/60 shrink-0">
          <DialogTitle className="font-heading flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            ร่างทุกตอนด้วย AI
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            ร่างเฉพาะตอนที่ยังว่าง (0 คำ) ต่อเนื่องทีละตอนตามลำดับ บันทึกอัตโนมัติหลังร่างแต่ละตอน
            <br />
            <span className="text-amber-600 font-medium">ใช้ Claude Sonnet — ใช้ credits สูง</span>
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* สรุปตอนที่จะร่าง */}
          {!running && logs.length === 0 && (
            <>
              <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm">
                <p className="font-medium mb-1">ตอนที่จะถูกร่าง ({emptyChapters.length} ตอน)</p>
                {emptyChapters.length === 0 ? (
                  <p className="text-muted-foreground">ทุกตอนมีเนื้อหาแล้ว ไม่มีตอนว่างที่ต้องร่าง</p>
                ) : (
                  <ul className="space-y-0.5 text-muted-foreground max-h-36 overflow-y-auto">
                    {emptyChapters.map((ch) => (
                      <li key={ch.id} className="flex items-center gap-2">
                        <span className="w-5 text-primary/60 font-medium text-xs">{ch.order}.</span>
                        {ch.title}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {emptyChapters.length > 0 && (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">ความยาวต่อตอน</label>
                  <Select value={String(wordTarget)} onValueChange={(v) => setWordTarget(Number(v))}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WORD_TARGETS.map((wt) => (
                        <SelectItem key={wt.value} value={String(wt.value)}>{wt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          {/* แสดงความคืบหน้า */}
          {logs.length > 0 && (
            <div className="space-y-3">
              {running && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>กำลังร่างตอนที่ {current + 1} / {emptyChapters.length}</span>
                    <span>{doneCount} สำเร็จ</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}

              {isDone && (
                <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm">
                  <p className="font-semibold mb-1">สรุปผลการร่าง</p>
                  <p className="text-emerald-700">✓ สำเร็จ {logs.filter(l => l.status === "done").length} ตอน</p>
                  {logs.filter(l => l.status === "error").length > 0 && (
                    <p className="text-destructive">✗ ล้มเหลว {logs.filter(l => l.status === "error").length} ตอน</p>
                  )}
                  {logs.filter(l => l.status === "pending").length > 0 && (
                    <p className="text-muted-foreground">— ยังไม่ได้ร่าง (ยกเลิกกลางทาง) {logs.filter(l => l.status === "pending").length} ตอน</p>
                  )}
                </div>
              )}

              <ScrollArea className="max-h-52">
                <div className="space-y-1.5">
                  {logs.map((log, i) => (
                    <div key={log.chapterId} className={`flex items-start gap-2.5 px-3 py-2 rounded-lg text-sm ${
                      log.status === "running" ? "bg-primary/5 border border-primary/20" :
                      log.status === "done" ? "bg-emerald-50/60" :
                      log.status === "error" ? "bg-destructive/5" :
                      "bg-muted/20"
                    }`}>
                      <span className="text-xs text-muted-foreground w-5 shrink-0 pt-0.5">{emptyChapters[i]?.order}.</span>
                      {log.status === "running" && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0 mt-0.5" />}
                      {log.status === "done" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />}
                      {log.status === "error" && <XCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />}
                      {log.status === "pending" && <span className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                      <div className="flex-1 min-w-0">
                        <p className={`truncate ${log.status === "running" ? "text-primary font-medium" : ""}`}>{log.title}</p>
                        {log.status === "running" && <p className="text-xs text-primary/60 mt-0.5">กำลังร่าง...</p>}
                        {log.error && <p className="text-xs text-destructive mt-0.5">{log.error}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border/60 shrink-0 flex items-center justify-between gap-2">
          {running ? (
            <>
              <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5" onClick={handleCancel}>
                <StopCircle className="w-3.5 h-3.5" />
                หยุดกลางทาง
              </Button>
              <p className="text-xs text-muted-foreground">ตอนที่ร่างเสร็จแล้วถูกบันทึกแล้ว</p>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={handleClose}>
                {isDone ? "ปิด" : "ยกเลิก"}
              </Button>
              {emptyChapters.length > 0 && !isDone && (
                <Button onClick={handleStart} className="gap-2" disabled={emptyChapters.length === 0}>
                  <Sparkles className="w-4 h-4" />
                  ร่างทุกตอน ({emptyChapters.length} ตอน)
                </Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}