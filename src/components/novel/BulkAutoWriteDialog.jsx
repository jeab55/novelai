import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Sparkles, X, CheckCircle2, SkipForward, AlertTriangle, Bot, RefreshCw, PlayCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useBulkWrite } from "@/lib/BulkWriteContext";
import { invokeAIStable } from "@/lib/aiInvoke";

const DEFAULT_WRITER_PROMPT = `คุณคือนักเขียนนิยายภาษาไทยมืออาชีพที่กำลังร่างตอนใหม่ให้ผู้เขียน
คุณต้องร่างเนื้อหาตอนที่สมบูรณ์ตามโครงที่ได้รับ รักษาสำนวนและโทนของเรื่อง ใช้ภาษาไทยที่อ่านลื่น`;

function buildSystemPrompt(novel, characters, worldEntries, plotEvents, prevChapters, writerPrompt, previousSeasonLastChapter) {
  const isOneShot = novel.novel_type === "เรื่องสั้น";
  let ctx = `[บทบาท]\n${writerPrompt || DEFAULT_WRITER_PROMPT}\n\n`;

  if (isOneShot) {
    ctx += `[รูปแบบ: เรื่องสั้นจบในตอนเดียว (One-shot)]\n`;
    ctx += `1. เขียนเรื่องสั้นสมบูรณ์ในตัวเอง — มีเปิดเรื่อง ปมกลางเรื่อง และจุดพีคตอนจบ\n`;
    ctx += `2. แก่นเดียว อารมณ์เดียว — ทุกฉากต้องรับใช้แก่นหลักของเรื่อง\n`;
    ctx += `3. ตัวละครหลักไม่เกิน 3 คน — โฟกัสที่ความสัมพันธ์และปมหลัก\n`;
    ctx += `4. เปิดเรื่องกลางสถานการณ์ทันที (in media res) — ไม่ต้องเกริ่นนำยาว\n`;
    ctx += `5. โครง 3 องก์บีบอัด: เปิดปม 20% / บีบให้ตึง 60% / คลายด้วยจุดพีคเดียว 20%\n`;
    if (novel.ending_type === "จบหักมุม (Twist)") {
      ctx += `6. จบหักมุม — โปรยเบาะแสแฟร์ๆ ไว้ก่อนแล้วพลิกตอนท้าย ให้ผู้อ่านคาดไม่ถึงแต่สมเหตุสมผล\n`;
    } else if (novel.ending_type === "จบสุข (HEA)") {
      ctx += `6. จบสุข — ตัวละครได้สิ่งที่ต้องการหรือค้นพบสิ่งที่จำเป็นต่อหัวใจ\n`;
    } else if (novel.ending_type === "จบเศร้า (HFE)") {
      ctx += `6. จบเศร้า — ตัวละครสูญเสียหรือพ่ายแพ้ ทิ้งความรู้สึกสะเทือนใจ\n`;
    } else if (novel.ending_type === "จบเปิด (Open Ending)") {
      ctx += `6. จบเปิด — ไม่ฟันธงผลลัพธ์ ทิ้งให้ผู้อ่านตีความต่อ\n`;
    }
    ctx += `7. ประโยคสุดท้ายต้องคมและค้างใจ — ให้ผู้อ่านนึกถึงต่อหลังอ่านจบ\n`;
    ctx += `8. ใช้ภาษากระชับ แต่ยังคงความสละสลวยและเห็นภาพ\n\n`;
  }

  ctx += `[บริบทเรื่อง]\n`;
  ctx += `ชื่อเรื่อง: ${novel.title}\n`;
  if (novel.genre) ctx += `แนว: ${novel.genre}\n`;
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

  // ★ สำคัญ: ถ้าเป็น Season ใหม่ (มี parent_novel_id) และเป็นตอนที่ 1 — ให้ใส่ตอนท้ายของ Season ก่อนหน้า
  if (previousSeasonLastChapter && novel.parent_novel_id) {
    ctx += `\n\n[ตอนสุดท้ายของ Season ก่อนหน้า — เชื่อมต่อเนื้อเรื่อง]\n`;
    ctx += `— ${previousSeasonLastChapter.title} —\n`;
    const preview = (previousSeasonLastChapter.content || "").substring(0, 2000);
    ctx += `${preview}${(previousSeasonLastChapter.content || "").length > 2000 ? "\n…(ต่อ)" : ""}\n\n`;
    ctx += `[คำสั่ง]\n`;
    ctx += `- เขียนตอนที่ 1 ของ Season นี้โดยเชื่อมต่อจากตอนท้ายด้านบนทันที — ไม่ต้องเล่าเรื่องใหม่หรือสรุปย่อ\n`;
    ctx += `- เริ่มจากฉากหรือเหตุการณ์ที่ต่อเนื่องกันเลย ให้ผู้อ่านรู้สึกว่าอ่านต่อจากตอนจบล่าสุด\n`;
    ctx += `- รักษาโทน สไตล์ และตัวละครให้สอดคล้องกับ Season ก่อนหน้า\n\n`;
  } else if (prevChapters.length > 0) {
    ctx += `\n[ตอนก่อนหน้า — รักษาความต่อเนื่อง]\n`;
    const recent = prevChapters.slice(-2);
    recent.forEach((ch) => {
      const preview = (ch.content || "").substring(0, 1500);
      ctx += `\n— ตอนที่ ${ch.order}: "${ch.title}" —\n${preview}${(ch.content || "").length > 1500 ? "\n…(ต่อ)" : ""}\n`;
    });
  }

  if (isOneShot) {
    ctx += `\n[คำสั่งสำคัญ]\n`;
    ctx += `- เขียนเรื่องสั้นสมบูรณ์จบในตอนเดียว ความยาวประมาณ ${novel.word_count_target || 3000} คำ\n`;
    ctx += `- ต้องมีจุดพีคและตอนจบที่สมบูรณ์ในตัวเอง\n`;
    ctx += `- ผลลัพธ์: เฉพาะเนื้อหาเรื่องสั้น ไม่ต้องมีคำนำหรืออธิบาย\n`;
  } else {
    ctx += `\n[คำสั่งสำคัญ]\n`;
    ctx += `- ร่างเนื้อหาตอนนี้ให้ครบตามความยาวที่กำหนด อย่าตัดจบกลางคัน\n`;
    ctx += `- ผลลัพธ์: เฉพาะเนื้อหาตอน ไม่ต้องมีคำนำหรืออธิบาย\n`;
  }
  return ctx;
}

export default function BulkAutoWriteDialog({ open, onClose, novel, novelId }) {
  const queryClient = useQueryClient();
  const { startJob, updateJob, finishJob } = useBulkWrite();
  const [step, setStep] = useState("settings"); // "settings" | "confirm" | "running" | "done"
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [log, setLog] = useState([]);
  const [currentMsg, setCurrentMsg] = useState("");
  const [confirmData, setConfirmData] = useState(null);
  const cancelledRef = useRef(false);
  const doneCountRef = useRef(0);
  const errorCountRef = useRef(0);
  // รอบสร้างต่อ: เริ่มจากตอนที่เท่าไร
  const resumeFromRef = useRef(1);

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

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: () => base44.auth.me(),
    enabled: open,
  });

  const creditPerChapter = 30;
  const wordTarget = novel?.word_count_target || 1500;
  const target = novel?.target_chapters || 10;
  const isOneShot = novel?.novel_type === "เรื่องสั้น";

  // ตรวจสอบสถานะปัจจุบัน
  const chaptersWithRealContent = chapters.filter((c) => (c.word_count || 0) >= 500);
  const chaptersWithRealContentCount = chaptersWithRealContent.length;
  const chaptersToCreateCount = isOneShot
    ? chaptersWithRealContentCount > 0 ? 0 : 1
    : Math.max(0, target - chaptersWithRealContentCount);
  const totalEstimatedCredits = chaptersToCreateCount * creditPerChapter;

  // สถานะ "ค้างกลางคัน" — มีบางตอนเสร็จแล้ว แต่ยังไม่ครบ
  const isPartiallyDone = !isOneShot && chaptersWithRealContentCount > 0 && chaptersToCreateCount > 0;
  // ตอนที่ยังต้องสร้าง (order ที่ยังไม่มีหรือ < 500 คำ)
  const missingOrders = Array.from({ length: target }, (_, i) => i + 1).filter((i) => {
    const ch = chapters.find((c) => c.order === i);
    return !ch || (ch.word_count || 0) < 500;
  });
  const nextMissingOrder = missingOrders[0] || null;
  const lastDoneOrder = chaptersWithRealContent.length > 0
    ? Math.max(...chaptersWithRealContent.map((c) => c.order))
    : 0;

  // นับคำไทยถูกต้องด้วย Intl.Segmenter
  const countThaiWords = (text) => {
    if (!text || typeof text !== "string") return 0;
    const segmenter = new Intl.Segmenter('th', { granularity: 'word' });
    const segments = segmenter.segment(text);
    let count = 0;
    for (const { isWordLike, segment } of segments) {
      if (isWordLike && segment.trim().length > 0) count += 1;
    }
    return count;
  };

  // เรียก LLM แบบเสถียร: timeout 180 วิ + retry อัตโนมัติ 2 ครั้ง (exponential backoff)
  const invokeLLMWithTimeout = async (prompt) => {
    return await invokeAIStable(
      { prompt, model: "claude_sonnet_4_6" },
      { onRetry: ({ attempt, maxAttempts }) => setCurrentMsg(`🔄 AI ไม่ตอบสนอง กำลังลองใหม่ (${attempt}/${maxAttempts - 1})...`) }
    );
  };

  const expandContent = async (currentContent, targetWords, chapterTitle, order, linkedEvent, onProgress, writerPrompt = "") => {
    let content = currentContent;
    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const currentWordCount = countThaiWords(content);
      if (onProgress) onProgress({ attempt, maxAttempts, currentWordCount, targetWords });
      if (currentWordCount >= Math.floor(targetWords * 0.9)) break;

      const remainingWords = Math.max(targetWords - currentWordCount, 300);
      let expandPrompt = writerPrompt ? `[บทบาทและสไตล์การเขียน]\n${writerPrompt}\n\n` : "";
      expandPrompt += `[ขยายเนื้อหา — เขียนต่อจากเดิม]\n`;
      expandPrompt += `เนื้อหาปัจจุบันมี ${currentWordCount} คำ แต่ต้องการอย่างน้อย ${targetWords} คำ\n`;
      expandPrompt += `โปรดเขียนเนื้อหาต่อจากเนื้อหาด้านล่าง เพิ่มอีกอย่างน้อย ${remainingWords} คำ\n\n`;
      expandPrompt += `[คำสั่ง]\n`;
      expandPrompt += `- เขียนต่อจากเนื้อหาเดิมทันที ไม่ต้องมีคำนำ\n`;
      expandPrompt += `- เพิ่มฉากใหม่ บทสนทนา รายละเอียดการกระทำและความคิดของตัวละคร\n`;
      expandPrompt += `- ขยายความขัดแย้ง อารมณ์ และบรรยากาศให้เห็นภาพชัดเจน\n`;
      expandPrompt += `- รักษาโทนและสไตล์ของเรื่องให้สม่ำเสมอ\n\n`;
      expandPrompt += `[ตอน: "${chapterTitle}" ลำดับที่ ${order}]\n`;
      if (linkedEvent) {
        expandPrompt += `เหตุการณ์หลัก: ${linkedEvent.title}\n`;
        if (linkedEvent.description) expandPrompt += `${linkedEvent.description}\n`;
      }
      expandPrompt += `\n[เนื้อหาปัจจุบัน — เขียนต่อจากบรรทัดสุดท้าย]\n`;
      expandPrompt += `${content.substring(0, 2500)}${content.length > 2500 ? "\n...(ต่อ)" : ""}\n\n`;
      expandPrompt += `[เขียนต่อจากนี้ — อย่างน้อย ${remainingWords} คำ]:\n`;

      try {
        const expansion = await invokeLLMWithTimeout(expandPrompt);
        if (!expansion || expansion.length < 50) break;
        content = content + "\n\n" + expansion;
      } catch {
        break;
      }
    }

    return { content, wordCount: countThaiWords(content) };
  };

  const generateChapterTitle = async (novel, characters, plotEvents, prevChapters, order, linkedEvent, writerPrompt) => {
    let titlePrompt = `[โจทย์ตั้งชื่อตอน]\nคุณคือนักเขียนนิยายมืออาชีพ กำลังตั้งชื่อตอนที่${order} ของเรื่อง\n\n`;
    titlePrompt += `ชื่อเรื่อง: ${novel.title}\n`;
    if (novel.genre) titlePrompt += `แนว: ${novel.genre}\n`;
    if (novel.synopsis) titlePrompt += `เรื่องย่อ: ${novel.synopsis.substring(0, 300)}\n`;
    if (linkedEvent) {
      titlePrompt += `\nเหตุการณ์หลัก: ${linkedEvent.title}\n`;
      if (linkedEvent.description) titlePrompt += `รายละเอียด: ${linkedEvent.description}\n`;
    }
    if (prevChapters.length > 0) {
      const lastChapter = prevChapters[prevChapters.length - 1];
      titlePrompt += `\nตอนก่อนหน้า: "${lastChapter.title}"\n`;
    }
    titlePrompt += `\nตั้งชื่อตอนที่${order} ภาษาไทยสละสลวย น่าอ่าน ความยาว 3-8 คำ ไม่ต้องมีคำว่า "ตอนที่"\n`;
    titlePrompt += `ตอบกลับด้วยชื่อตอนเพียงชื่อเดียว:`;
    try {
      let title = await invokeLLMWithTimeout(titlePrompt);
      title = title.replace(/^["']|["']$/g, "").trim();
      return title && title.length >= 3 ? title : `ตอนที่ ${order}`;
    } catch {
      return `ตอนที่ ${order}`;
    }
  };

  // สร้างตอนเดียวพร้อม auto-retry (1-2 ครั้ง)
  const generateSingleChapter = async ({ i, chapterTitle, linkedEvent, contextChapters, writerPrompt, existingChapter, allCharacters, allWorldEntries, allPlotEvents, previousSeasonLastChapter }) => {
    const sysPrompt = buildSystemPrompt(novel, allCharacters, allWorldEntries, allPlotEvents, contextChapters, writerPrompt, previousSeasonLastChapter);
    let taskPrompt = sysPrompt;
    taskPrompt += `\n\n[โจทย์ตอนที่ต้องร่าง — เขียนเนื้อหาเต็มตอน]\n`;
    taskPrompt += `ชื่อตอน: "${chapterTitle}"\n`;
    taskPrompt += `ลำดับตอน: ${i} จาก ${target} ตอน\n`;
    taskPrompt += `ความยาวที่ต้องการ: อย่างน้อย ${wordTarget} คำ\n\n`;
    taskPrompt += `[คำสั่งสำคัญ]\n`;
    taskPrompt += `1. เขียนเนื้อหาเต็มตอนเป็นร้อยแก้วนิยายภาษาไทย ความยาวอย่างน้อย ${wordTarget} คำ\n`;
    taskPrompt += `2. ประกอบด้วยหลายฉาก มีทั้งบทบรรยายและบทสนทนาที่ลื่นไหล\n`;
    taskPrompt += `3. ห้ามเขียนเป็นเค้าโครง สรุปย่อ หรือรายการสั้นๆ\n`;
    taskPrompt += `4. รักษาความต่อเนื่องกับตอนก่อนหน้า\n\n`;
    if (linkedEvent) {
      taskPrompt += `[เหตุการณ์หลัก]\n• ${linkedEvent.title}`;
      if (linkedEvent.description) taskPrompt += `\n  ${linkedEvent.description}`;
      if (linkedEvent.time_period) taskPrompt += `\n  ช่วงเวลา: ${linkedEvent.time_period}`;
      taskPrompt += `\n\n`;
    }
    taskPrompt += `[เริ่มเขียนตอนนี้เลย — ความยาวอย่างน้อย ${wordTarget} คำ]:\n`;

    // invokeAIStable retry 2 ครั้งเองแล้ว — ที่นี่ลองเพิ่มอีก 1 รอบใหญ่ถ้าเนื้อหาสั้นผิดปกติ
    const MAX_RETRIES = 2;
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 1) {
        setCurrentMsg(`🔄 ลองสร้างตอนที่ ${i} ใหม่ (ครั้งที่ ${attempt}/${MAX_RETRIES})...`);
        await new Promise((r) => setTimeout(r, 1500)); // รอเล็กน้อยก่อน retry
      }

      try {
        let text;
        // กรณีคำเยอะ (3000+) แบ่งสร้าง 2 ช่วงต่อเนื่องเพื่อลด timeout
        if (wordTarget >= 3000) {
          const half = Math.round(wordTarget / 2);
          setCurrentMsg(`✍️ ร่างครึ่งแรกของตอนที่ ${i} (~${half} คำ)...`);
          const firstHalf = await invokeLLMWithTimeout(`${taskPrompt}\n\n[หมายเหตุ] เขียน "ครึ่งแรก" ประมาณ ${half} คำ เปิดเรื่องและดำเนินไปจนถึงกลางตอน อย่าเพิ่งจบ`);
          setCurrentMsg(`✍️ ร่างครึ่งหลังของตอนที่ ${i} (~${half} คำ)...`);
          const secondPrompt = `${sysPrompt}\n\n[โจทย์ — เขียนครึ่งหลังต่อจากครึ่งแรก]\nชื่อตอน: "${chapterTitle}"\n\n[ครึ่งแรกที่เขียนไปแล้ว]\n${(firstHalf || "").substring(0, 3000)}${(firstHalf || "").length > 3000 ? "\n…(ต่อ)" : ""}\n\nเขียน "ครึ่งหลัง" ต่อจากครึ่งแรกให้ลื่นไหล ประมาณ ${half} คำ พาเรื่องไปสู่จุดพีคและจบตอน อย่าเขียนซ้ำครึ่งแรก:`;
          const secondHalf = await invokeLLMWithTimeout(secondPrompt);
          text = `${firstHalf || ""}\n\n${secondHalf || ""}`.trim();
        } else {
          text = await invokeLLMWithTimeout(taskPrompt);
        }

        if (!text || text.length < 100) throw new Error("เนื้อหาสั้นเกินไป");

        // ขยายถ้าจำนวนคำยังไม่ถึงเป้า
        const minWords = Math.floor(wordTarget * 0.9);
        const initialWordCount = countThaiWords(text);
        let finalContent = text;
        let finalWordCount = initialWordCount;

        if (initialWordCount < minWords) {
          const expanded = await expandContent(
            text,
            wordTarget,
            chapterTitle,
            i,
            linkedEvent,
            ({ attempt: exp, maxAttempts, currentWordCount }) => {
              setCurrentMsg(`📝 ขยายรอบที่ ${exp}/${maxAttempts} — ${currentWordCount}/${wordTarget} คำ...`);
            },
            writerPrompt
          );
          finalContent = expanded.content;
          finalWordCount = expanded.wordCount;
        }

        // บันทึกทันทีหลัง generate เสร็จแต่ละตอน
        if (existingChapter) {
          await base44.entities.Chapter.update(existingChapter.id, {
            content: finalContent,
            word_count: finalWordCount,
            status: isOneShot ? "เขียนเสร็จ" : "ร่าง",
            title: chapterTitle,
          });
        } else {
          await base44.entities.Chapter.create({
            novel_id: novelId,
            title: chapterTitle,
            order: i,
            status: isOneShot ? "เขียนเสร็จ" : "ร่าง",
            content: finalContent,
            word_count: finalWordCount,
          });
        }

        // invalidate ทันทีหลังบันทึกแต่ละตอน — กันงานหายถ้าหลุดกลางคัน
        queryClient.invalidateQueries({ queryKey: ["chapters", novelId] });

        return { content: finalContent, wordCount: finalWordCount, success: true };
      } catch (err) {
        lastError = err;
      }
    }

    return { success: false, error: lastError?.message || "ไม่ทราบสาเหตุ" };
  };

  const handleStart = async () => {
    if (!novelWriter) {
      toast.error("นิยายนี้ยังไม่มีนักเขียน AI ที่ล็อกไว้ กรุณาแก้ไขนิยายและเลือกนักเขียน AI ก่อน");
      return;
    }
    if (isOneShot) {
      const existing = chapters[0];
      if (existing && (existing.word_count || 0) >= 500) {
        setConfirmData({ chaptersToCreate: [], totalCredits: 0, creditPerChapter, shortChapters: [] });
      } else {
        setConfirmData({
          chaptersToCreate: [{ order: 1, title: existing?.title || "เรื่องสั้น", needsCreation: !existing }],
          totalCredits: creditPerChapter,
          creditPerChapter,
          shortChapters: existing && (existing.word_count || 0) < 500 ? [existing] : [],
        });
      }
      setStep("confirm");
      return;
    }

    // นับเฉพาะตอนที่ยังไม่มีเนื้อหาจริง (>= 500 คำ) — ข้ามตอนที่ทำเสร็จแล้ว
    const chaptersToCreate = [];
    const shortChapters = [];
    for (let i = 1; i <= target; i++) {
      const existing = chapters.find((c) => c.order === i);
      const wordCount = existing?.word_count || 0;
      if (!existing) {
        chaptersToCreate.push({ order: i, title: `ตอนที่ ${i}`, needsCreation: true });
      } else if (wordCount < 500) {
        shortChapters.push({ order: i, title: existing.title || `ตอนที่ ${i}`, existingId: existing.id });
      }
    }
    const allChaptersToCreate = [
      ...chaptersToCreate,
      ...shortChapters.map((ch) => ({ ...ch, needsCreation: false })),
    ];
    setConfirmData({
      chaptersToCreate: allChaptersToCreate,
      totalCredits: allChaptersToCreate.length * creditPerChapter,
      creditPerChapter,
      shortChapters,
    });
    setStep("confirm");
  };

  // ฟังก์ชันหลักสร้างตอน — ใช้ทั้ง handleConfirmStart และ handleResume
  const runGeneration = async (startFromOrder = 1) => {
    cancelledRef.current = false;
    doneCountRef.current = 0;
    errorCountRef.current = 0;
    setProgress({ current: 0, total: isOneShot ? 1 : target });
    setLog([]);
    setCurrentMsg("");
    setStep("running");
    startJob(novelId, isOneShot ? 1 : target);

    const writerPrompt = novelWriter?.system_prompt || "";
    const writtenSoFar = [];

    // ดึงข้อมูลทั้งหมดครั้งเดียว — ลด query ซ้ำ
    const [freshChapters, freshPlotEvents, freshCharacters, freshWorldEntries] = await Promise.all([
      base44.entities.Chapter.filter({ novel_id: novelId }, "order").then((all) => all.filter((c) => !c.is_deleted)),
      base44.entities.PlotEvent.filter({ novel_id: novelId }, "order").then((all) => all.filter((e) => !e.is_deleted)),
      base44.entities.Character.filter({ novel_id: novelId }).then((all) => all.filter((c) => !c.is_deleted)),
      base44.entities.WorldEntry.filter({ novel_id: novelId }).then((all) => all.filter((w) => !w.is_deleted)),
    ]);

    // ดึงตอนสุดท้ายของ Season ก่อนหน้า — สำหรับ Season 2+ (มี parent_novel_id)
    let previousSeasonLastChapter = null;
    if (novel?.parent_novel_id && startFromOrder === 1) {
      try {
        const parentChapters = await base44.entities.Chapter.filter({ novel_id: novel.parent_novel_id }, "order");
        const validChapters = parentChapters.filter((c) => !c.is_deleted && (c.word_count || 0) >= 500);
        if (validChapters.length > 0) {
          previousSeasonLastChapter = validChapters[validChapters.length - 1];
        }
      } catch (err) {
        console.error("Failed to load previous season chapters:", err);
      }
    }

    // ตอนที่มีเนื้อหาแล้ว — นำมาใส่ใน log ทันทีเพื่อแสดงสถานะ
    for (let i = 1; i < startFromOrder; i++) {
      const ch = freshChapters.find((c) => c.order === i);
      if (ch && (ch.word_count || 0) >= 500) {
        writtenSoFar.push(ch);
        setLog((l) => [...l, { order: i, title: ch.title || `ตอนที่ ${i}`, status: "skip", wordCount: ch.word_count }]);
      }
    }

    for (let i = startFromOrder; i <= (isOneShot ? 1 : target); i++) {
      if (cancelledRef.current) break;

      const displayIdx = i;
      setProgress({ current: displayIdx, total: isOneShot ? 1 : target });
      updateJob(novelId, { current: displayIdx, total: isOneShot ? 1 : target });

      const existing = freshChapters.find((c) => c.order === i);
      const existingWordCount = existing?.word_count || 0;

      // ข้ามตอนที่มีเนื้อหาพอแล้ว — ไม่เขียนทับของเดิม
      if (existingWordCount >= 500) {
        writtenSoFar.push(existing);
        setLog((l) => [...l, { order: i, title: existing.title || `ตอนที่ ${i}`, status: "skip", wordCount: existingWordCount }]);
        continue;
      }

      const linkedEvent = freshPlotEvents.find((e) => e.order === i);

      // สร้างชื่อตอนถ้าไม่มีเนื้อหาเดิม — ข้ามถ้ามีแล้ว (ลด LLM call)
      let chapterTitle = existing?.title || (isOneShot ? "เรื่องสั้น" : `ตอนที่ ${i}`);
      if (!existing || !existing.content?.trim()) {
        setCurrentMsg(`📝 กำลังตั้งชื่อตอนที่ ${i}/${target}...`);
        chapterTitle = await generateChapterTitle(
          novel, freshCharacters, freshPlotEvents,
          [...freshChapters.filter((c) => c.order < i && c.content && !c.is_deleted), ...writtenSoFar].sort((a, b) => a.order - b.order),
          i, linkedEvent, writerPrompt
        );
      }

      setLog((l) => [...l, { order: i, title: chapterTitle, status: "generating" }]);
      setCurrentMsg(`✍️ กำลังร่างตอนที่ ${i}/${target}: "${chapterTitle}"...`);

      // รวม freshChapters + writtenSoFar (ที่เพิ่งสร้างในรอบนี้) โดย de-duplicate ด้วย order
      const contextMap = new Map();
      freshChapters.filter((c) => c.order < i && c.content && !c.is_deleted).forEach((c) => contextMap.set(c.order, c));
      writtenSoFar.filter((c) => c.order < i && c.content).forEach((c) => contextMap.set(c.order, c));
      const contextChapters = Array.from(contextMap.values()).sort((a, b) => a.order - b.order);

      const result = await generateSingleChapter({
        i, chapterTitle, linkedEvent, contextChapters, writerPrompt, existingChapter: existing,
        allCharacters: freshCharacters, allWorldEntries: freshWorldEntries, allPlotEvents: freshPlotEvents,
        previousSeasonLastChapter,
      });

      if (cancelledRef.current) break;

      if (result.success) {
        doneCountRef.current += 1;
        writtenSoFar.push({ ...existing, content: result.content, order: i, title: chapterTitle, word_count: result.wordCount });
        setLog((l) => l.map((e) => e.order === i ? { ...e, status: "done", wordCount: result.wordCount, title: chapterTitle } : e));
        updateJob(novelId, { current: displayIdx, total: isOneShot ? 1 : target, doneCount: doneCountRef.current, errorCount: errorCountRef.current });
      } else {
        errorCountRef.current += 1;
        setLog((l) => l.map((e) => e.order === i ? { ...e, status: "error", errorMsg: result.error, title: chapterTitle } : e));
        setCurrentMsg(`❌ ตอนที่ ${i} ล้มเหลวหลัง retry — ${result.error}`);
        toast.error(`ตอนที่ ${i}: ${result.error}`);
        // ไม่ break — สร้างตอนถัดไปต่อ
      }

      setCurrentMsg("");
    }

    // Refresh ครั้งสุดท้าย
    queryClient.invalidateQueries({ queryKey: ["chapters", novelId] });
    finishJob(novelId, { doneCount: doneCountRef.current, errorCount: errorCountRef.current });
    setStep("done");

    if (!cancelledRef.current) {
      toast.success(isOneShot ? "สร้างเรื่องสั้นเสร็จแล้ว!" : "สร้างตอนทั้งหมดเสร็จแล้ว!");
      // ตั้ง auto_written = true เมื่อเขียนครบทุกตอน (หรือเรื่องสั้น) โดยไม่มี error
      const totalToCreate = isOneShot ? 1 : target;
      const allSuccess = doneCountRef.current >= totalToCreate && errorCountRef.current === 0;
      if (allSuccess) {
        await base44.entities.Novel.update(novelId, { auto_written: true, status: isOneShot ? "เขียนเสร็จ" : "กำลังเขียน" });
        queryClient.invalidateQueries({ queryKey: ["novels"] });
      }
    } else {
      toast.info("หยุดการสร้างตอนกลางคัน — บันทึกตอนที่เสร็จแล้วไว้ทั้งหมด");
    }
    setCurrentMsg("");
  };

  const handleConfirmStart = () => runGeneration(1);

  const handleResume = () => {
    // เริ่มจากตอนแรกที่ยังขาดอยู่
    const startFrom = nextMissingOrder || 1;
    resumeFromRef.current = startFrom;
    runGeneration(startFrom);
  };

  const handleCancel = () => {
    cancelledRef.current = true;
    // รอให้ loop ตรวจสอบ cancelled แล้วจะ setStep("done") เอง
    // แต่เราต้อง force update UI ทันที
    setTimeout(() => {
      setStep("done");
    }, 500);
  };

  const handleClose = () => {
    cancelledRef.current = true;
    setStep("settings");
    setLog([]);
    setCurrentMsg("");
    onClose();
  };

  // Retry ทุกตอนที่ล้มเหลว
  const retryAllFailed = async () => {
    const failedChaptersList = log.filter((l) => l.status === "error");
    if (failedChaptersList.length === 0) return;
    setStep("running");
    setCurrentMsg(`🔄 กำลังลองสร้าง ${failedChaptersList.length} ตอนที่ล้มเหลวอีกครั้ง...`);
    
    const writerPrompt = novelWriter?.system_prompt || "";
    
    const [freshChapters, freshPlotEvents, freshCharacters, freshWorldEntries] = await Promise.all([
      base44.entities.Chapter.filter({ novel_id: novelId }, "order").then((all) => all.filter((c) => !c.is_deleted)),
      base44.entities.PlotEvent.filter({ novel_id: novelId }, "order").then((all) => all.filter((e) => !e.is_deleted)),
      base44.entities.Character.filter({ novel_id: novelId }).then((all) => all.filter((c) => !c.is_deleted)),
      base44.entities.WorldEntry.filter({ novel_id: novelId }).then((all) => all.filter((w) => !w.is_deleted)),
    ]);

    // ดึงตอนสุดท้ายของ Season ก่อนหน้า — สำหรับ retry ด้วย
    let previousSeasonLastChapter = null;
    if (novel?.parent_novel_id) {
      try {
        const parentChapters = await base44.entities.Chapter.filter({ novel_id: novel.parent_novel_id }, "order");
        const validChapters = parentChapters.filter((c) => !c.is_deleted && (c.word_count || 0) >= 500);
        if (validChapters.length > 0) {
          previousSeasonLastChapter = validChapters[validChapters.length - 1];
        }
      } catch (err) {
        console.error("Failed to load previous season chapters:", err);
      }
    }

    for (const failed of failedChaptersList) {
      const existing = freshChapters.find((c) => c.order === failed.order);
      const linkedEvent = freshPlotEvents.find((e) => e.order === failed.order);
      
      setLog((l) => l.map((e) => e.order === failed.order ? { ...e, status: "generating" } : e));
      setCurrentMsg(`🔄 กำลังลองสร้างตอนที่ ${failed.order} "${failed.title}"...`);
      
      const contextChapters = freshChapters.filter((c) => c.order < failed.order && c.content && !c.is_deleted);
      const result = await generateSingleChapter({
        i: failed.order,
        chapterTitle: failed.title,
        linkedEvent,
        contextChapters,
        writerPrompt,
        existingChapter: existing,
        allCharacters: freshCharacters,
        allWorldEntries: freshWorldEntries,
        allPlotEvents: freshPlotEvents,
        previousSeasonLastChapter,
      });

      if (result.success) {
        setLog((l) => l.map((e) => e.order === failed.order ? { ...e, status: "done", wordCount: result.wordCount } : e));
        toast.success(`ตอนที่ ${failed.order}: สร้างสำเร็จ!`);
      } else {
        setLog((l) => l.map((e) => e.order === failed.order ? { ...e, status: "error", errorMsg: result.error } : e));
        toast.error(`ตอนที่ ${failed.order}: ${result.error}`);
      }
      
      setCurrentMsg("");
    }
    
    queryClient.invalidateQueries({ queryKey: ["chapters", novelId] });
    setStep("done");
  };

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
            AI {isOneShot ? "สร้างเรื่องสั้น" : "สร้างตอนทั้งหมด"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isOneShot
              ? "สร้างเรื่องสั้นจบในตอนเดียวแบบเต็มรูปแบบ"
              : `สร้างทีละตอนตามลำดับจนครบ ${target} ตอน อิงโครงเรื่อง ไทม์ไลน์ และตัวละคร`
            }
            <br />
            <span className="text-emerald-600 font-medium">
              ✓ หักเครดิตทีละตอน — เสียเฉพาะตอนที่สร้างสำเร็จ
            </span>
          </p>
        </DialogHeader>

        {/* Settings */}
        {step === "settings" && (
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
            {!novelWriter && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-destructive">ไม่มีนักเขียน AI ประจำเรื่อง</p>
                  <p className="text-xs text-destructive/80 mt-0.5">กรุณาแก้ไขข้อมูลนิยายและเลือกนักเขียน AI ก่อนใช้งานฟีเจอร์นี้</p>
                </div>
              </div>
            )}
            <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-2 text-sm">
              {isOneShot ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ประเภท</span>
                    <span className="font-semibold text-primary">เรื่องสั้นจบในตอนเดียว</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ความยาวเป้าหมาย</span>
                    <span className="font-semibold">{wordTarget.toLocaleString()} คำ</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">รูปแบบตอนจบ</span>
                    <span className="font-semibold">{novel?.ending_type || "-"}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">จำนวนตอนเป้าหมาย</span>
                    <span className="font-semibold">{target} ตอน</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">จำนวนคำเป้าหมายต่อตอน</span>
                    <span className="font-semibold">{wordTarget.toLocaleString()} คำ</span>
                  </div>
                </>
              )}
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
                <span className="text-muted-foreground">ตอนที่มีเนื้อหาแล้ว (≥500 คำ)</span>
                <span className="font-semibold text-emerald-600">{chaptersWithRealContentCount} / {isOneShot ? 1 : target} ตอน</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ตอนที่ต้องสร้าง</span>
                <span className={`font-semibold ${chaptersToCreateCount > 0 ? "text-primary" : "text-emerald-600"}`}>{chaptersToCreateCount} ตอน</span>
              </div>
            </div>

            {/* แสดงสถานะค้างกลางคัน */}
            {isPartiallyDone && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                  <RotateCcw className="w-4 h-4" />
                  <span className="font-semibold text-sm">มีงานค้างอยู่</span>
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  เขียนไปแล้ว <strong>{chaptersWithRealContentCount}/{target}</strong> ตอน — 
                  ยังขาดอีก <strong>{chaptersToCreateCount}</strong> ตอน
                </p>
                {lastDoneOrder > 0 && (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    ตอนล่าสุดที่เสร็จ: <strong>ตอนที่ {lastDoneOrder}</strong>
                    {nextMissingOrder ? ` · จะเริ่มต่อจาก ตอนที่ ${nextMissingOrder}` : ""}
                  </p>
                )}
              </div>
            )}

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-primary mb-1">บันทึกทันทีหลังสร้างแต่ละตอน</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    ระบบจะบันทึกทุกตอนทันทีหลังสร้างเสร็จ — ถ้าหลุดกลางคัน งานที่ทำไปแล้วจะไม่หาย
                    และสามารถกดปุ่ม "สร้างตอนที่เหลือต่อ" เพื่อเริ่มต่อได้
                  </p>
                </div>
              </div>
            </div>

            {/* Credit estimate */}
            <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-semibold">ประมาณการเครดิต</span>
              </div>
              <div className="flex justify-between text-amber-700 dark:text-amber-300">
                <span>ตอนที่ต้องสร้าง</span>
                <span className="font-medium">{chaptersToCreateCount} ตอน</span>
              </div>
              <div className="flex justify-between text-amber-700 dark:text-amber-300">
                <span>เครดิตต่อตอน</span>
                <span className="font-medium">{creditPerChapter} เครดิต</span>
              </div>
              <div className="flex justify-between text-amber-800 dark:text-amber-200 font-semibold border-t border-amber-200 dark:border-amber-800/50 pt-2">
                <span>รวมประมาณการ</span>
                <span>{totalEstimatedCredits} เครดิต</span>
              </div>
              {user?.credits !== undefined && (
                <div className="flex justify-between text-xs text-muted-foreground pt-1">
                  <span>เครดิตคงเหลือ</span>
                  <span className="font-medium">{user.credits.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Confirmation */}
        {step === "confirm" && confirmData && (
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-5 space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-heading font-semibold text-emerald-800 dark:text-emerald-200">หักเครดิตทีละตอน</h3>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                    ระบบจะหักเครดิต<strong>เฉพาะตอนที่สร้างสำเร็จ</strong>ทีละตอน — ถ้ามีปัญหาหลุดกลางคัน จะไม่เสียเครดิตตอนที่ล้มเหลว
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-2">
                    ✓ กดสร้างใหม่ได้ — จะสร้าง<strong>เฉพาะตอนที่ยังไม่มีเนื้อหา</strong> ไม่ต้องเสียเครดิตซ้ำ
                  </p>
                </div>
              </div>
              <div className="space-y-2 text-sm border-t border-emerald-200 dark:border-emerald-800/50 pt-3">
                <div className="flex justify-between text-emerald-700 dark:text-emerald-300">
                  <span>ตอนที่ต้องสร้าง</span>
                  <span className="font-semibold">{confirmData.chaptersToCreate.length} ตอน</span>
                </div>
                <div className="flex justify-between text-emerald-700 dark:text-emerald-300">
                  <span>เครดิตต่อตอน</span>
                  <span className="font-semibold">{confirmData.creditPerChapter} เครดิต / ตอน</span>
                </div>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 pt-1">
                  ⚡ เครดิตจะถูกหักทันทีเมื่อแต่ละตอนสร้างสำเร็จ ไม่หักล่วงหน้าทั้งหมด
                </p>
              </div>
            </div>
            {confirmData.shortChapters?.length > 0 && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span className="font-medium">ตอนสั้นเกินไป (จะเขียนเพิ่ม)</span>
                </div>
                <div className="space-y-1 pl-2 border-l-2 border-amber-300">
                  {confirmData.shortChapters.map((ch) => (
                    <div key={ch.order} className="text-amber-700 dark:text-amber-300">ตอนที่ {ch.order}: {ch.title}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Running / Done */}
        {(step === "running" || step === "done") && (
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Progress bar */}
            <div className="px-6 py-4 border-b border-border/40 shrink-0 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {step === "running" ? "กำลังสร้าง..." : "เสร็จแล้ว"}
                </span>
                <span className="text-muted-foreground font-medium">
                  {doneCount + skipCount} / {progress.total} ตอน
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-primary h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  ✅ เสร็จ {doneCount} · ⏩ ข้าม {skipCount}
                  {errorCount > 0 ? ` · ❌ ผิดพลาด ${errorCount}` : ""}
                </span>
                <span>{progressPct}%</span>
              </div>
              {currentMsg && (
                <p className="text-xs text-muted-foreground leading-relaxed animate-pulse">{currentMsg}</p>
              )}
            </div>

            {/* Success banner */}
            {step === "done" && errorCount === 0 && !cancelledRef.current && (
              <div className="mx-6 mt-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 px-4 py-3 flex items-center gap-3 shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                    {isOneShot ? "สร้างเรื่องสั้นเสร็จแล้ว!" : "สร้างนิยายครบทุกตอนแล้ว!"}
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    {doneCount} ตอน · {log.filter(e => e.status === "done").reduce((s, e) => s + (e.wordCount || 0), 0).toLocaleString()} คำ
                  </p>
                </div>
              </div>
            )}

            {/* Cancelled banner */}
            {step === "done" && cancelledRef.current && (
              <div className="mx-6 mt-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 px-4 py-3 flex items-center gap-3 shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">หยุดกลางคัน</p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    บันทึก {doneCount} ตอนไว้แล้ว — ปิดหน้าต่างนี้แล้วกด "สร้างตอนที่เหลือต่อ" เพื่อเริ่มต่อ
                  </p>
                </div>
              </div>
            )}

            {/* Log */}
            <ScrollArea className="flex-1 px-6 py-4">
              <div className="space-y-2">
                {log.map((entry, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 text-sm">
                    {entry.status === "done" && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                    {entry.status === "skip" && <SkipForward className="w-4 h-4 text-muted-foreground shrink-0" />}
                    {entry.status === "generating" && <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />}
                    {entry.status === "error" && <X className="w-4 h-4 text-destructive shrink-0" />}
                    <span className={
                      entry.status === "skip" ? "text-muted-foreground" :
                      entry.status === "error" ? "text-destructive" :
                      entry.status === "generating" ? "text-primary" : ""
                    }>
                      ตอนที่ {entry.order}: {entry.title}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground shrink-0 flex items-center gap-2">
                      {entry.status === "done" && entry.wordCount ? (
                        <>
                          <span>{entry.wordCount.toLocaleString()} คำ</span>
                          <span className="text-amber-600 dark:text-amber-400 font-medium">-{creditPerChapter} เครดิต</span>
                        </>
                      ) : entry.status === "skip" ? "มีแล้ว"
                        : entry.status === "generating" ? "กำลังสร้าง..."
                        : entry.status === "error" ? (
                          <span className="text-destructive">{entry.errorMsg || "ล้มเหลว"}</span>
                        ) : ""}
                    </span>
                  </div>
                ))}
                {step === "running" && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground pt-1">
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>กำลังสร้างตอนถัดไป...</span>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/60 shrink-0 flex items-center justify-between gap-2">
          {step === "settings" && (
            <>
              <Button variant="ghost" onClick={handleClose} size="sm">ยกเลิก</Button>
              <div className="flex gap-2">
                {isPartiallyDone && (
                  <Button
                    variant="outline"
                    onClick={handleResume}
                    className="gap-2 border-primary/50 text-primary hover:bg-primary/5"
                    size="sm"
                  >
                    <PlayCircle className="w-4 h-4" />
                    สร้างตอนที่เหลือต่อ ({chaptersToCreateCount} ตอน)
                  </Button>
                )}
                <Button onClick={handleStart} className="gap-2" disabled={(chaptersToCreateCount === 0 && !isPartiallyDone) || !novelWriter}>
                  <Sparkles className="w-4 h-4" />
                  {chaptersToCreateCount === 0 ? "ครบแล้ว" : "เริ่มสร้างใหม่"}
                </Button>
              </div>
            </>
          )}
          {step === "confirm" && (
            <>
              <Button variant="ghost" onClick={() => setStep("settings")} size="sm">กลับ</Button>
              <Button onClick={handleConfirmStart} className="gap-2 bg-primary hover:bg-primary/90">
                <Sparkles className="w-4 h-4" />
                ยืนยันสร้าง ({confirmData?.chaptersToCreate?.length} ตอน · {confirmData?.creditPerChapter} เครดิต/ตอน)
              </Button>
            </>
          )}
          {step === "running" && (
            <>
              <div className="flex items-center gap-2">
                <Button variant="destructive" size="sm" onClick={handleCancel} className="gap-1.5">
                  <X className="w-3.5 h-3.5" />
                  หยุดกลางคัน
                </Button>
                {errorCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={retryAllFailed}
                    className="gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    ลองใหม่ ({errorCount})
                  </Button>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                ✅ {doneCount} เสร็จ · ⏩ {skipCount} ข้าม{errorCount > 0 ? ` · ❌ ${errorCount} ผิดพลาด` : ""}
              </span>
            </>
          )}
          {step === "done" && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {doneCount} ตอนเสร็จ{errorCount > 0 ? ` · ${errorCount} ผิดพลาด` : ""}
                </span>
                {errorCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={retryAllFailed}
                    className="gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    ลองใหม่ ({errorCount})
                  </Button>
                )}
              </div>
              <Button onClick={handleClose} size="sm">ปิด</Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}