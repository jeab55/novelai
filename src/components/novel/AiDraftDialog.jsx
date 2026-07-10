import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Sparkles, RefreshCw, CheckCheck, Wand2, ChevronRight, Bot, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { saveChapterContent } from "@/lib/saveChapterContent";
import { saveVersion } from "@/lib/saveVersion";
import { invokeAIStable } from "@/lib/aiInvoke";
import { enforceWordRange, buildWordCountInstruction, getWordRange } from "@/lib/wordCountControl";
import { buildChapterContext } from "@/lib/chapterContextBuilder";
import { proseVarietyInstruction } from "@/lib/creativeVariety";
import AiProgressBar from "@/components/novel/AiProgressBar";

const LOADING_LABELS = {
  draft: "กำลังร่างตอน...",
  expanding: "กำลังขยายเนื้อหาให้ครบความยาว...",
  polish: "กำลังขัดเกลาสำนวน...",
  saving: "กำลังบันทึกร่าง...",
};

const WORD_TARGETS = [
  { label: "สั้น ~800 คำ", value: 800 },
  { label: "กลาง ~1,200 คำ", value: 1200 },
  { label: "ยาว ~2,000 คำ", value: 2000 },
  { label: "ยาวมาก ~3,000 คำ", value: 3000 },
];

const DEFAULT_WRITER_PROMPT = `คุณคือนักเขียนนิยายภาษาไทยมืออาชีพที่กำลังร่างตอนใหม่ให้ผู้เขียน
คุณต้องร่างเนื้อหาตอนที่สมบูรณ์ตามโครงที่ได้รับ รักษาสำนวนและโทนของเรื่อง ใช้ภาษาไทยที่อ่านลื่น`;

// นับคำภาษาไทย (ประมาณการ)
function countThaiWords(text) {
  if (!text) return 0;
  // ใช้ split ด้วยช่องว่างและตัวอักษรไทยที่ติดกัน
  const words = text.split(/\s+/).filter(Boolean);
  return words.length;
}

// ขยายเนื้อหาอัตโนมัติ
async function expandContentAutomatically(currentContent, targetWords, chapterTitle, form, systemPrompt, writerPrompt = "") {
  const minWords = Math.floor(targetWords * 0.9);
  const absoluteMinWords = 1000;
  let content = currentContent;
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    const wordCount = countThaiWords(content);
    if (wordCount >= minWords && wordCount >= absoluteMinWords) {
      break;
    }

    attempts += 1;
    const remainingWords = Math.max(targetWords - wordCount, 300);
    
    let expandPrompt = writerPrompt ? `[บทบาทและสไตล์การเขียน]\n${writerPrompt}\n\n` : "";
    expandPrompt += `[ขยายเนื้อหา — เขียนต่อจากเดิม]\n`;
    expandPrompt += `เนื้อหาปัจจุบันมี ${wordCount} คำ แต่ต้องการอย่างน้อย ${targetWords} คำ\n`;
    expandPrompt += `โปรดเขียนเนื้อหาต่อจากเนื้อหาด้านล่าง เพิ่มอีกอย่างน้อย ${remainingWords} คำ\n\n`;
    expandPrompt += `[คำสั่ง]\n`;
    expandPrompt += `- เขียนต่อจากเนื้อหาเดิมทันที ไม่ต้องมีคำนำ\n`;
    expandPrompt += `- เพิ่มฉากใหม่ บทสนทนา รายละเอียดการกระทำและความคิดของตัวละคร\n`;
    expandPrompt += `- ขยายความขัดแย้ง อารมณ์ และบรรยากาศให้เห็นภาพชัดเจน\n`;
    expandPrompt += `- รักษาโทนและสไตล์ของเรื่องให้สม่ำเสมอ\n\n`;
    expandPrompt += `[ตอน: "${chapterTitle}"]\n`;
    if (form.summary) expandPrompt += `สิ่งที่ต้องเกิด: ${form.summary}\n`;
    if (form.characters) expandPrompt += `ตัวละคร: ${form.characters}\n`;
    expandPrompt += `\n[เนื้อหาปัจจุบัน — เขียนต่อจากบรรทัดสุดท้าย]\n`;
    expandPrompt += `${content.substring(0, 2500)}${content.length > 2500 ? "\n...(ต่อ)" : ""}\n\n`;
    expandPrompt += `[เขียนต่อจากนี้ — อย่างน้อย ${remainingWords} คำ]:\n`;

    try {
      const expansion = await invokeAIStable({ prompt: expandPrompt, model: "claude_sonnet_4_6" });
      if (!expansion || expansion.length < 50) {
        break;
      }
      content = content + "\n\n" + expansion;
    } catch {
      break;
    }
  }

  return { content, wordCount: countThaiWords(content) };
}

// สร้าง system prompt สำหรับร่างตอน — ใช้ตัวประกอบ context กลาง (เต็มบริบทเท่าโหมดสร้างทั้งหมด)
function buildDraftSystemPrompt(novel, characters, worldEntries, plotEvents, chapters, currentChapter, writerPrompt, linkedEvent, wordTarget) {
  const currentOrder = currentChapter?.order;
  // รวมตอนทั้งหมด (ยกเว้นตอนปัจจุบัน) เพื่อให้ helper หาตอนก่อน/ถัดไป และสรุปย่อสะสมได้
  const allChapters = chapters.filter((ch) => ch.id !== currentChapter?.id && ch.content);
  let ctx = buildChapterContext({
    novel,
    characters,
    worldEntries,
    plotEvents,
    allChapters,
    currentOrder,
    linkedEvent,
    writerPrompt,
    wordTarget: wordTarget || 1500,
  });

  ctx += `\n[คำสั่งสำคัญ]\n`;
  ctx += `- ร่างเนื้อหาตอนนี้ให้ครบตามความยาวที่กำหนด อย่าตัดจบกลางคัน\n`;
  ctx += `- ให้เนื้อหาลึกและต่อเนื่องสอดคล้องกับโครง 3 องก์ ตัวละคร และตอนก่อนหน้า\n`;
  ctx += `- ผลลัพธ์: เฉพาะเนื้อหาตอน ไม่ต้องมีคำนำหรืออธิบาย\n`;

  return ctx;
}

function buildDraftPrompt(form, systemPrompt, wordTarget) {
  const { min, max } = getWordRange(wordTarget);
  let prompt = systemPrompt;
  prompt += `\n\n[โจทย์ตอนที่ต้องร่าง — เขียนเนื้อหาเต็มตอน]\n`;
  prompt += `ชื่อตอน: "${form.chapterTitle}"\n`;
  prompt += buildWordCountInstruction(wordTarget) + `\n`;
  prompt += `[คำสั่งสำคัญ — ต้องปฏิบัติตาม]\n`;
  prompt += `1. เขียนเนื้อหาเต็มตอนเป็นร้อยแก้วนิยายภาษาไทย ความยาว ${min.toLocaleString()}-${max.toLocaleString()} คำ\n`;
  prompt += `2. ต้องประกอบด้วยหลายฉาก มีทั้งบทบรรยายและบทสนทนาที่ยาวพอสมควร\n`;
  prompt += `3. เขียนเป็นเนื้อเรื่องต่อเนื่อง ไม่ใช่เค้าโครง ไม่ใช่สรุปย่อ ไม่ใช้ bullet points\n`;
  prompt += `4. ใช้ภาษาไทยที่สละสลวย อ่านลื่น เห็นภาพ มีอารมณ์และจังหวะการเล่าเรื่อง\n\n`;
  if (form.summary) prompt += `[สิ่งที่ต้องเกิดในตอนนี้]:\n${form.summary}\n\n`;
  if (form.characters) prompt += `[ตัวละครในตอน]: ${form.characters}\n\n`;
  if (form.tone) prompt += `[โทน/มุมมอง]: ${form.tone}\n\n`;
  prompt += `${proseVarietyInstruction()}\n\n`;
  prompt += `[เริ่มเขียนเนื้อหาตอนนี้เลย — ความยาว ${min.toLocaleString()}-${max.toLocaleString()} คำ]:\n`;
  return prompt;
}

// ขัดเกลาสำนวน
function buildPolishPrompt(draft, systemPrompt) {
  return `${systemPrompt}

[งาน: ขัดเกลาสำนวน — เก็บโครงเรื่อง เหตุการณ์ บทสนทนา และน้ำเสียงเฉพาะตัวของนักเขียนไว้ครบ ห้ามเปลี่ยนเนื้อเรื่องหรือความยาวอย่างมีนัยสำคัญ]
ขัดเกลาเนื้อหาด้านล่างโดยโฟกัสที่:
- ตัดคำกรอง (filter words) เช่น "รู้สึกว่า/เห็นว่า/ได้ยินว่า/นึกว่า" แล้วเล่าสิ่งนั้นตรงๆ
- เปลี่ยนประโยคที่ "บอก" อารมณ์ตรงๆ ให้ "แสดง" ผ่านการกระทำ ท่าทาง หรือรายละเอียดที่เห็นภาพ
- เปลี่ยนกริยากลางๆ ให้มีพลังและเฉพาะเจาะจง ตัดคำวิเศษณ์ฟุ่มเฟือย
- สลับความยาวประโยคให้มีจังหวะ ตัดคำซ้ำและวลีเฝือ
- ในบทสนทนา: แทน "เขากล่าว" ซ้ำๆ ด้วย action beat และคงลายเซ็นการพูดของแต่ละตัวละคร
อย่าเพิ่มเหตุการณ์ใหม่ อย่าสรุปย่อ อย่าเปลี่ยนตอนจบ ตอบเฉพาะเนื้อเรื่องที่ขัดเกลาแล้ว:

${draft}`;
}

// Step 1: form, Step 2: review draft
export default function AiDraftDialog({ open, onClose, chapter, novel, novelId, onInsert, prefillSummary }) {
  const [step, setStep] = useState(1); // 1=form, 2=review
  const [loading, setLoading] = useState(false);
  const [loadingType, setLoadingType] = useState(""); // "draft" | "polish" | "saving"
  const [draft, setDraft] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  const queryClient = useQueryClient();
  const [linkedPlotEventId, setLinkedPlotEventId] = useState(chapter?.plot_event_id || "");
  const [form, setForm] = useState({
    chapterTitle: chapter?.title || "",
    summary: prefillSummary || chapter?.plot_event_description || "",
    characters: "",
    tone: "",
    wordTarget: 1200,
  });

  // ดึงนักเขียนประจำเรื่องจาก novel.writer_id
  const { data: novelWriter } = useQuery({
    queryKey: ["writers-all"],
    queryFn: () => base44.entities.Writer.list(),
    enabled: open && !!novel?.writer_id,
    select: (data) => data.find((w) => String(w.id) === String(novel?.writer_id)),
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
  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters", novelId],
    queryFn: async () => {
      const all = await base44.entities.Chapter.filter({ novel_id: novelId }, "order");
      return all.filter((c) => !c.is_deleted);
    },
    enabled: open,
  });

  const selectedWriter = novelWriter;

  // Sync plot event and auto-fill summary when dialog opens
  useEffect(() => {
    if (open && chapter) {
      const plotEventId = chapter?.plot_event_id || "";
      setLinkedPlotEventId(plotEventId);
      
      // Priority 1: prefillSummary prop (from WritingRoom quick button)
      // Priority 2: linked plot event description
      // Priority 3: chapter's stored plot_event_description
      let autoSummary = prefillSummary || "";
      
      if (!autoSummary && plotEventId && plotEvents && plotEvents.length > 0) {
        const linkedEv = plotEvents.find((e) => e.id === plotEventId);
        if (linkedEv?.description) {
          autoSummary = linkedEv.description;
        }
      }
      
      if (!autoSummary && chapter?.plot_event_description) {
        autoSummary = chapter.plot_event_description;
      }
      
      setForm((f) => ({
        ...f,
        chapterTitle: chapter?.title || "",
        summary: autoSummary || f.summary || "",
      }));
    }
  }, [open, chapter, plotEvents, prefillSummary]);

  const getSystemPrompt = () =>
    buildDraftSystemPrompt(novel, characters, worldEntries, plotEvents, chapters, chapter, selectedWriter?.system_prompt, linkedEvent, form.wordTarget);

  // บันทึกร่างเข้าตอนโดยอัตโนมัติ — เก็บ snapshot เวอร์ชันเดิมไว้ก่อนทับ
  const autoSaveDraft = async (content) => {
    setSaveError("");
    setSaved(false);
    // 1) snapshot เวอร์ชันเดิม (กู้คืนได้) — ทำเฉพาะตอนที่มีอยู่แล้วและมีเนื้อหาเดิม
    if (chapter?.id && chapter?.content) {
      try {
        await saveVersion({
          entityType: "chapter",
          entityId: chapter.id,
          novelId,
          data: {
            title: chapter.title,
            content: chapter.content,
            order: chapter.order,
            status: chapter.status,
          },
          label: "ก่อน AI ร่างทับ",
        });
      } catch {
        // ถ้า snapshot ล้มเหลว ไม่บล็อกการบันทึก แต่แจ้งเตือนเบาๆ
        toast.warning("บันทึกเวอร์ชันสำรองไม่สำเร็จ แต่จะบันทึกร่างต่อ");
      }
    }
    // 2) บันทึกเนื้อหาร่าง
    const result = await saveChapterContent({
      novelId,
      chapterId: chapter?.id,
      title: form.chapterTitle || chapter?.title,
      order: chapter?.order,
      content,
      status: "ร่าง",
    });
    if (result.success) {
      queryClient.invalidateQueries({ queryKey: ["chapters", novelId] });
      setSaved(true);
      toast.success("บันทึกร่างแล้ว");
    } else {
      setSaveError(result.error || "บันทึกไม่สำเร็จ กรุณาลองใหม่");
      toast.error(`บันทึกร่างไม่สำเร็จ: ${result.error || "กรุณาลองใหม่"}`);
    }
    return result;
  };

  const handleDraft = async () => {
    if (!selectedWriter) {
      toast.error("กรุณาตั้งค่านักเขียน AI ให้กับนิยายนี้ก่อน (ไปที่หน้าแก้ไขนิยาย)");
      return;
    }
    setLoading(true);
    setLoadingType("draft");
    setSaveError("");
    const sysPrompt = getSystemPrompt();

    try {
      let text;
      // กรณีคำเยอะ (3000+) แบ่งสร้าง 2 ช่วงต่อเนื่องเพื่อลด timeout
      if (form.wordTarget >= 3000) {
        const half = Math.round(form.wordTarget / 2);
        const firstPrompt = `${buildDraftPrompt(form, sysPrompt, half)}\n\n[หมายเหตุ] เขียน "ครึ่งแรก" ของตอนนี้ ประมาณ ${half} คำ — เปิดเรื่องและดำเนินไปจนถึงกลางตอน อย่าเพิ่งจบ`;
        const firstHalf = await invokeAIStable(
          { prompt: firstPrompt, model: "claude_sonnet_4_6" },
          { onRetry: ({ attempt, maxAttempts }) => toast.info(`AI ไม่ตอบสนอง กำลังลองใหม่ (${attempt}/${maxAttempts - 1})...`) }
        );
        const secondPrompt = `${sysPrompt}\n\n[โจทย์ — เขียนครึ่งหลังต่อจากครึ่งแรก]\nชื่อตอน: "${form.chapterTitle}"\n\n[ครึ่งแรกที่เขียนไปแล้ว]\n${firstHalf.substring(0, 3000)}${firstHalf.length > 3000 ? "\n…(ต่อ)" : ""}\n\nเขียน "ครึ่งหลัง" ต่อจากครึ่งแรกให้ลื่นไหล ประมาณ ${half} คำ พาเรื่องไปสู่จุดพีคและจบตอน อย่าเขียนซ้ำครึ่งแรก:`;
        const secondHalf = await invokeAIStable({ prompt: secondPrompt, model: "claude_sonnet_4_6" });
        text = `${firstHalf}\n\n${secondHalf}`.trim();
      } else {
        const prompt = buildDraftPrompt(form, sysPrompt, form.wordTarget);
        text = await invokeAIStable(
          { prompt, model: "claude_sonnet_4_6" },
          { onRetry: ({ attempt, maxAttempts }) => toast.info(`AI ไม่ตอบสนอง กำลังลองใหม่ (${attempt}/${maxAttempts - 1})...`) }
        );
      }

      // ตรวจนับจำนวนคำ แล้วขยาย/ย่อให้อยู่ในช่วงเป้าหมาย ±500 คำ
      const { min: rangeMin, max: rangeMax } = getWordRange(form.wordTarget);
      const initialWordCount = countThaiWords(text);
      if (initialWordCount < rangeMin || initialWordCount > rangeMax) {
        setLoadingType("expanding");
        const ctx = `[ตอน: "${form.chapterTitle}"]${form.summary ? `\nสิ่งที่ต้องเกิด: ${form.summary}` : ""}`;
        const adjusted = await enforceWordRange(text, form.wordTarget, {
          context: ctx,
          writerPrompt: selectedWriter?.system_prompt || "",
        });
        text = adjusted.content;
        // ถ้า AI ไม่ตอบในขั้นเกลาจำนวนคำ — ใช้ร่างเดิม (ไม่ทิ้งงาน) แล้วแจ้งผู้ใช้
        if (adjusted.skipped) {
          toast.warning("ข้ามการเกลาจำนวนคำ เพราะ AI ไม่ตอบสนอง — ใช้ร่างที่ได้มาก่อนหน้าแทน");
        }
      }

      setDraft(text);
      setStep(2);
      toast.success("ร่างตอนสำเร็จแล้ว");
      // บันทึกร่างเข้าตอนทันทีโดยอัตโนมัติ
      setLoadingType("saving");
      await autoSaveDraft(text);
    } catch (err) {
      setSaveError(err.message || "ร่างไม่สำเร็จ กรุณาลองใหม่");
      toast.error(`ร่างไม่สำเร็จ: ${err.message || "กรุณาลองใหม่"}`);
    } finally {
      setLoading(false);
      setLoadingType("");
    }
  };

  const handlePolish = async () => {
    setLoading(true);
    setLoadingType("polish");
    const sysPrompt = getSystemPrompt();
    const prompt = buildPolishPrompt(draft, sysPrompt);
    try {
      const text = await invokeAIStable(
        { prompt, model: "claude_sonnet_4_6" },
        { onRetry: ({ attempt, maxAttempts }) => toast.info(`AI ไม่ตอบสนอง กำลังลองใหม่ (${attempt}/${maxAttempts - 1})...`) }
      );
      setDraft(text);
      toast.success("ขัดเกลาสำนวนเสร็จแล้ว");
      // บันทึกร่างที่ขัดเกลาแล้วโดยอัตโนมัติ
      setLoadingType("saving");
      await autoSaveDraft(text);
    } catch (err) {
      toast.error(`ขัดเกลาไม่สำเร็จ: ${err.message || "กรุณาลองใหม่"}`);
    } finally {
      setLoading(false);
      setLoadingType("");
    }
  };

  // เปิด editor เพื่อแก้ไขต่อ (ร่างถูกบันทึกไปแล้วโดยอัตโนมัติ)
  const handleOpenEditor = async () => {
    // เผื่อกรณีบันทึกอัตโนมัติยังไม่สำเร็จ ให้บันทึกอีกครั้งก่อนเปิด
    if (!saved) {
      setLoading(true);
      setLoadingType("saving");
      const result = await autoSaveDraft(draft);
      setLoading(false);
      setLoadingType("");
      if (!result.success) return;
    }
    onInsert(draft);
  };

  const handleRetrySave = async () => {
    setLoading(true);
    setLoadingType("saving");
    await autoSaveDraft(draft);
    setLoading(false);
    setLoadingType("");
  };

  const handleClose = () => {
    setStep(1);
    setDraft("");
    setSaved(false);
    setSaveError("");
    setLinkedPlotEventId("");
    setForm({ chapterTitle: chapter?.title || "", summary: "", characters: "", tone: "", wordTarget: 1200 });
    onClose();
  };

  const linkedEvent = plotEvents.find((e) => e.id === linkedPlotEventId);

  const handleSelectPlotEvent = (evId) => {
    setLinkedPlotEventId(evId);
    const ev = plotEvents.find((e) => e.id === evId);
    if (ev?.description) {
      setForm((f) => ({ ...f, summary: ev.description }));
    } else if (evId === null || evId === "") {
      // Clear summary when deselecting
      setForm((f) => ({ ...f, summary: "" }));
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
            {/* นักเขียนประจำเรื่อง (ล็อกไว้) */}
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-primary/5 border border-primary/15">
              <Bot className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-xs text-muted-foreground">นักเขียน AI ประจำเรื่อง</span>
                {selectedWriter ? (
                  <div>
                    <span className="text-sm font-semibold text-primary block">{selectedWriter.name}</span>
                    {selectedWriter.style && <span className="text-xs text-muted-foreground">{selectedWriter.style}</span>}
                  </div>
                ) : (
                  <div>
                    <span className="text-sm text-destructive font-medium block">ยังไม่ได้ตั้งนักเขียนประจำเรื่อง</span>
                    <span className="text-xs text-destructive/70">กรุณาแก้ไขนิยายและเลือกนักเขียน AI ก่อนร่างตอน</span>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-primary/50 bg-primary/8 border border-primary/15 px-2 py-0.5 rounded-full shrink-0">ประจำเรื่อง</span>
            </div>

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
            <div className={`px-6 py-3 border-b shrink-0 ${saved ? "bg-emerald-50/60 border-emerald-200/60" : "bg-amber-50/50 border-amber-200/60"}`}>
              <p className={`text-xs font-medium flex items-center gap-1.5 ${saved ? "text-emerald-700" : "text-amber-700"}`}>
                {saved ? (
                  <><CheckCheck className="w-3.5 h-3.5" /> บันทึกร่างเข้าตอนแล้วโดยอัตโนมัติ — แก้ไขต่อได้ทันที</>
                ) : (
                  "ร่างโดย AI"
                )}
              </p>
            </div>
            <ScrollArea className="flex-1 px-6 py-5">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4 px-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <div className="w-full max-w-sm">
                    <AiProgressBar
                      active={loading}
                      label={LOADING_LABELS[loadingType] || "กำลังประมวลผลด้วย AI..."}
                      expectedMs={loadingType === "saving" ? 8000 : loadingType === "expanding" ? 70000 : 50000}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">อาจใช้เวลา 30-60 วินาที โปรดอย่าปิดหน้าต่างนี้</p>
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

        {/* Progress bar while generating from Step 1 form */}
        {step === 1 && loading && (
          <div className="px-6 pt-3 pb-1 shrink-0">
            <AiProgressBar
              active={loading}
              label={LOADING_LABELS[loadingType] || "กำลังประมวลผลด้วย AI..."}
              expectedMs={loadingType === "saving" ? 8000 : loadingType === "expanding" ? 70000 : 50000}
            />
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
                disabled={!form.summary.trim() || loading || !selectedWriter}
                title={!selectedWriter ? "กรุณาตั้งค่านักเขียน AI ให้กับนิยายนี้ก่อน" : ""}
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
              <div className="flex flex-col items-end gap-2">
                {saveError && (
                  <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-1.5 max-w-xs text-right">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{saveError}</span>
                    <Button size="sm" variant="destructive" className="h-6 text-xs px-2 ml-1" onClick={handleRetrySave} disabled={loading}>
                      ลองใหม่
                    </Button>
                  </div>
                )}
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
                    onClick={handleOpenEditor}
                    disabled={loading || !draft}
                  >
                    {loading && loadingType === "saving" ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCheck className="w-3.5 h-3.5" />
                    )}
                    {loading && loadingType === "saving" ? "กำลังบันทึก..." : "แก้ไขต่อใน editor"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}