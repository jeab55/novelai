import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronUp, BookOpen, Loader2, Wand2, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

function buildReviewPrompt(novel, characters, worldEntries, plotEvents, currentChapter, writerSystemPrompt) {
  let ctx = `[บทบาท]\n${writerSystemPrompt || "คุณคือนักเขียนนิยายภาษาไทยมืออาชีพ"}\n\n`;
  ctx += `[บริบทเรื่อง]\nชื่อเรื่อง: ${novel.title}\n`;
  if (novel.genre) ctx += `แนว: ${novel.genre}\n`;
  if (novel.era) ctx += `ยุคสมัย: ${novel.era}\n`;
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

  if (currentChapter.plot_event_id && currentChapter.plot_event_title) {
    ctx += `\n[เหตุการณ์ไทม์ไลน์ที่ตอนนี้ผูกอยู่]\n`;
    ctx += `ลำดับ ${currentChapter.plot_event_order}: ${currentChapter.plot_event_title}\n`;
    if (currentChapter.plot_event_description) ctx += `รายละเอียด: ${currentChapter.plot_event_description}\n`;
  }

  ctx += `\n[งาน: ปรับปรุงเนื้อหาตามบันทึกบรรณาธิการ]\n`;
  ctx += `ชื่อตอน: ${currentChapter.title}\n\n`;
  ctx += `[บันทึกบรรณาธิการ — คำแนะนำที่ต้องนำไปปรับ]\n${currentChapter.editor_review}\n\n`;
  ctx += `[เนื้อหาตอนปัจจุบันที่ต้องปรับปรุง]\n${currentChapter.content}\n\n`;
  ctx += `[คำสั่ง]\n`;
  ctx += `- นำคำแนะนำบรรณาธิการไปปรับปรุงเนื้อหาตอนนี้ให้ดีขึ้น\n`;
  ctx += `- รักษาโครงเรื่องและตัวละครเดิม เพียงปรับตามที่บรรณาธิการแนะนำ\n`;
  ctx += `- ผลลัพธ์: เฉพาะเนื้อหาตอนที่ปรับปรุงแล้ว ไม่ต้องมีคำอธิบายหรือหัวข้อ\n`;

  return ctx;
}

export default function EditorReviewPanel({ chapter, novel, novelId, onContentUpdate, onPreviousContentRestore }) {
  const [open, setOpen] = useState(false);
  const [review, setReview] = useState(chapter.editor_review || "");
  const [savingReview, setSavingReview] = useState(false);
  const [improving, setImproving] = useState(false);
  const [selectedWriterId, setSelectedWriterId] = useState("");

  const { data: writers = [] } = useQuery({
    queryKey: ["writers"],
    queryFn: () => base44.entities.Writer.list(),
    enabled: open,
  });
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

  const activeWriters = writers.filter((w) => w.is_active !== false);
  const selectedWriter = activeWriters.find((w) => w.id === selectedWriterId) || activeWriters[0];

  const handleSaveReview = async () => {
    setSavingReview(true);
    await base44.entities.Chapter.update(chapter.id, { editor_review: review });
    setSavingReview(false);
    toast.success("บันทึกรีวิวแล้ว");
  };

  const handleImprove = async () => {
    if (!review.trim()) {
      toast.error("กรุณากรอกบันทึกบรรณาธิการก่อน");
      return;
    }
    if (!chapter.content?.trim()) {
      toast.error("ไม่มีเนื้อหาตอนให้ปรับปรุง");
      return;
    }
    setImproving(true);
    // สำรองเนื้อหาเดิมก่อน
    await base44.entities.Chapter.update(chapter.id, {
      editor_review: review,
      previous_content: chapter.content,
    });

    const chapterWithReview = { ...chapter, editor_review: review };
    const prompt = buildReviewPrompt(novel, characters, worldEntries, [], chapterWithReview, selectedWriter?.system_prompt);
    const result = await base44.integrations.Core.InvokeLLM({ prompt, model: "claude_sonnet_4_6" });
    const improved = typeof result === "string" ? result : result?.text || "";

    await base44.entities.Chapter.update(chapter.id, { content: improved, word_count: 0 });
    onContentUpdate(improved, chapter.content);
    setImproving(false);
    toast.success("ปรับปรุงเนื้อหาตามรีวิวแล้ว — กด 'คืนค่าเดิม' ถ้าไม่ถูกใจ");
  };

  const handleRestore = async () => {
    if (!chapter.previous_content) {
      toast.error("ไม่มีเนื้อหาสำรองให้คืนค่า");
      return;
    }
    await base44.entities.Chapter.update(chapter.id, {
      content: chapter.previous_content,
      previous_content: "",
    });
    onPreviousContentRestore(chapter.previous_content);
    toast.success("คืนค่าเนื้อหาเดิมแล้ว");
  };

  return (
    <div className="border-b border-border/50 bg-card/20">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
      >
        <BookOpen className="w-3.5 h-3.5 text-primary/60" />
        <span className="font-medium text-foreground/70">บันทึกบรรณาธิการ</span>
        {chapter.editor_review && (
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary/70 text-[10px] font-medium">มีรีวิว</span>
        )}
        {chapter.previous_content && (
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-medium">มีฉบับสำรอง</span>
        )}
        <span className="ml-auto">{open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</span>
      </button>

      {/* Panel body */}
      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Writer selector */}
          {activeWriters.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0">นักเขียน AI:</span>
              <Select value={selectedWriterId || (activeWriters[0]?.id ?? "")} onValueChange={setSelectedWriterId}>
                <SelectTrigger className="h-7 text-xs flex-1">
                  <SelectValue placeholder="เลือกนักเขียน" />
                </SelectTrigger>
                <SelectContent>
                  {activeWriters.map((w) => (
                    <SelectItem key={w.id} value={w.id} className="text-xs">
                      {w.name}{w.description ? ` — ${w.description}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Review textarea */}
          <Textarea
            rows={4}
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder="เขียนคำแนะนำบรรณาธิการที่นี่ เช่น: บทสนทนาช่วงกลางควรตึงเครียดกว่านี้ ให้พระเอกแสดงความลังเลใจออกมาชัดขึ้น / ฉากเปิดตอนยาวเกินไป ตัดรายละเอียดฉากออกบางส่วน…"
            className="text-xs resize-none bg-background/60"
          />

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={handleSaveReview}
              disabled={savingReview}
            >
              {savingReview ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              บันทึกรีวิว
            </Button>

            <Button
              size="sm"
              className="h-7 text-xs gap-1.5 bg-primary/90 hover:bg-primary"
              onClick={handleImprove}
              disabled={improving || !review.trim()}
            >
              {improving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
              {improving ? "กำลังปรับปรุง..." : "ปรับปรุงตามรีวิว"}
            </Button>

            {chapter.previous_content && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1.5 text-amber-700 hover:text-amber-800 hover:bg-amber-50"
                onClick={handleRestore}
              >
                <RotateCcw className="w-3 h-3" />
                คืนค่าเนื้อหาเดิม
              </Button>
            )}
          </div>

          {improving && (
            <p className="text-[11px] text-muted-foreground/70 italic">
              AI กำลังปรับปรุงเนื้อหา... อาจใช้เวลา 30-60 วินาที (ใช้ Claude Sonnet)
            </p>
          )}
        </div>
      )}
    </div>
  );
}