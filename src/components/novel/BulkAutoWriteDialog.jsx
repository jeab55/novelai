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

function buildSystemPrompt(novel, characters, worldEntries, plotEvents, prevChapters, writerPrompt) {
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
  } else if (novel.writing_style === "รอมแพง") {
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
  const [overwritePrompt, setOverwritePrompt] = useState(null);
  const [confirmData, setConfirmData] = useState(null); // { chaptersToCreate, totalCredits, creditPerChapter }
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

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: () => base44.auth.me(),
    enabled: open,
  });

  const creditPerChapter = 30; // 6 seconds × 5 credits/second
  const wordTarget = novel?.word_count_target || 1500;
  const target = novel?.target_chapters || 10;
  
  const isOneShot = novel?.novel_type === "เรื่องสั้น";
  // นับตอนที่มีเนื้อหาจริง (word_count >= 500)
  const chaptersWithRealContent = chapters.filter((c) => (c.word_count || 0) >= 500).length;
  // ตอนที่ต้องสร้าง = เป้าหมาย ลบด้วย ตอนที่มีเนื้อหาจริง
  const chaptersToCreateCount = isOneShot ? (chaptersWithRealContent > 0 ? 0 : 1) : Math.max(0, target - chaptersWithRealContent);
  const totalEstimatedCredits = chaptersToCreateCount * creditPerChapter;

  const askOverwrite = (order, title) =>
    new Promise((resolve) => setOverwritePrompt({ order, title, resolve }));

  // นับคำไทยถูกต้องด้วย Intl.Segmenter
  const countThaiWords = (text) => {
    if (!text || typeof text !== "string") return 0;
    // ใช้ segmenter สำหรับภาษาไทย
    const segmenter = new Intl.Segmenter('th', { granularity: 'word' });
    const segments = segmenter.segment(text);
    let count = 0;
    for (const { segment, isWordLike } of segments) {
      if (isWordLike && segment.trim().length > 0) {
        count += 1;
      }
    }
    return count;
  };

  // เรียก LLM พร้อม timeout 90 วินาที
  const invokeLLMWithTimeout = async (prompt, timeoutMs = 90000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const result = await Promise.race([
        base44.integrations.Core.InvokeLLM({ prompt, model: "claude_sonnet_4_6" }),
        new Promise((_, reject) => {
          controller.signal.addEventListener('abort', () => reject(new Error('LLM timeout')));
        })
      ]);
      clearTimeout(timeoutId);
      return result;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  };

  const expandContent = async (currentContent, targetWords, chapterTitle, order, linkedEvent, novelContext, onProgress) => {
    let content = currentContent;
    const maxAttempts = 2; // สูงสุด 2 รอบ แล้วออกเสมอ

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const currentWordCount = countThaiWords(content);
      
      // แสดง progress
      if (onProgress) {
        onProgress({ attempt, maxAttempts, currentWordCount, targetWords });
      }

      // ถ้าถึง 90% ของเป้าแล้ว ให้หยุด
      if (currentWordCount >= Math.floor(targetWords * 0.9)) {
        break;
      }

      const remainingWords = Math.max(targetWords - currentWordCount, 300);
      
      let expandPrompt = `[ขยายเนื้อหา — เขียนต่อจากเดิม]\n`;
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
        const result = await invokeLLMWithTimeout(expandPrompt, 90000);
        let expansion = typeof result === "string" ? result : (result?.text || "");
        expansion = expansion.replace(/^```[\w]*\n?/m, "").replace(/\n?```$/m, "").trim();
        
        if (!expansion || expansion.length < 50) {
          break;
        }
        
        content = content + "\n\n" + expansion;
      } catch (err) {
        // Timeout หรือ error อื่นๆ — ออกเลย บันทึกเท่าที่มี
        break;
      }
    }

    const finalWordCount = countThaiWords(content);
    return { content, wordCount: finalWordCount };
  };

  const generateChapterTitle = async (novel, characters, plotEvents, prevChapters, order, linkedEvent, writerPrompt) => {
    let titlePrompt = `[โจทย์ตั้งชื่อตอน]\nคุณคือนักเขียนนิยายมืออาชีพ กำลังตั้งชื่อตอนที่${order} ของเรื่อง\n\n`;
    titlePrompt += `[บริบทเรื่อง]\n`;
    titlePrompt += `ชื่อเรื่อง: ${novel.title}\n`;
    if (novel.genre) titlePrompt += `แนว: ${novel.genre}\n`;
    if (novel.synopsis) titlePrompt += `เรื่องย่อ: ${novel.synopsis.substring(0, 300)}\n`;
    
    if (linkedEvent) {
      titlePrompt += `\n[เหตุการณ์หลักของตอนนี้]\n`;
      titlePrompt += `ชื่อ: ${linkedEvent.title}\n`;
      if (linkedEvent.description) titlePrompt += `รายละเอียด: ${linkedEvent.description}\n`;
      if (linkedEvent.time_period) titlePrompt += `ช่วงเวลา: ${linkedEvent.time_period}\n`;
    }

    if (prevChapters.length > 0) {
      titlePrompt += `\n[ตอนก่อนหน้า]\n`;
      const lastChapter = prevChapters[prevChapters.length - 1];
      titlePrompt += `ตอนที่ ${lastChapter.order}: "${lastChapter.title}"\n`;
      const preview = (lastChapter.content || "").substring(0, 500);
      if (preview) titlePrompt += `เนื้อหาโดยย่อ: ${preview}...\n`;
    }

    if (characters.length > 0) {
      titlePrompt += `\n[ตัวละครหลัก]\n`;
      characters.slice(0, 5).forEach((c) => {
        titlePrompt += `• ${c.name} (${c.role || "ตัวประกอบ"})\n`;
      });
    }

    titlePrompt += `\n[คำสั่ง]\n`;
    titlePrompt += `ตั้งชื่อตอนที่${order} ให้สื่อถึงเนื้อหาหลักของตอน ใช้ภาษาไทยสละสลวย น่าอ่าน\n`;
    titlePrompt += `ความยาว 3-8 คำ ไม่ต้องมีคำว่า "ตอนที่" นำหน้า\n`;
    titlePrompt += `ชื่อตอนควร:\n`;
    titlePrompt += `- สะท้อนเหตุการณ์สำคัญหรือจุดเปลี่ยนของตอน\n`;
    titlePrompt += `- ดึงดูดความสนใจผู้อ่าน\n`;
    titlePrompt += `- สอดคล้องกับโทนและแนวของเรื่อง\n\n`;
    titlePrompt += `ตอบกลับด้วยชื่อตอนเพียงชื่อเดียว ไม่ต้องมีคำอธิบาย:`;

    try {
      const result = await base44.integrations.Core.InvokeLLM({ prompt: titlePrompt, model: "claude_sonnet_4_6" });
      let title = typeof result === "string" ? result : (result?.text || "");
      title = title.replace(/^```[\w]*\n?/m, "").replace(/\n?```$/m, "").trim();
      title = title.replace(/^["']|["']$/g, "").trim(); // ลบเครื่องหมายคำ
      if (!title || title.length < 3) {
        title = `ตอนที่ ${order}`;
      }
      return title;
    } catch {
      return `ตอนที่ ${order}`;
    }
  };

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
    taskPrompt += `\n\n[โจทย์ตอนที่ต้องร่าง — เขียนเนื้อหาเต็ม]\n`;
    taskPrompt += `ชื่อตอน: "${entry.title}"\n`;
    taskPrompt += `ลำดับตอน: ${order} จาก ${target} ตอน\n`;
    const targetWords = novel?.word_count_target || 1500;
    taskPrompt += `\n[คำสั่งสำคัญ]\n`;
    taskPrompt += `- เขียนเนื้อหาเต็มตอนเป็นร้อยแก้วนิยายภาษาไทย ความยาวอย่างน้อย ${targetWords} คำ\n`;
    taskPrompt += `- ต้องมีหลายฉาก ทั้งบทบรรยายและบทสนทนาที่ยาวพอสมควร\n`;
    taskPrompt += `- เขียนเป็นเนื้อเรื่องต่อเนื่อง ไม่ใช่เค้าโครงหรือสรุปย่อ\n\n`;
    if (linkedEvent) {
      taskPrompt += `เหตุการณ์หลัก: ${linkedEvent.title}\n`;
      if (linkedEvent.description) taskPrompt += `${linkedEvent.description}\n`;
    }
    taskPrompt += `\n[เริ่มเขียนเนื้อหาตอนนี้ — อย่างน้อย ${targetWords} คำ]:\n`;
    try {
      const result = await base44.integrations.Core.InvokeLLM({ prompt: taskPrompt, model: "claude_sonnet_4_6" });
      let text = typeof result === "string" ? result : (result?.text || "");
      text = text.replace(/^```[\w]*\n?/m, "").replace(/\n?```$/m, "").trim();
      const wordCount = countThaiWords(text);
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
    const chaptersToCreate = [];
    const shortChapters = []; // ตอนที่มีอยู่แต่สั้น (<500 คำ)
    
    if (isOneShot) {
      // สำหรับเรื่องสั้น: เช็คแค่ว่ามี chapter ที่มีเนื้อหายังไม่ได้
      const existing = chapters[0]; // เรื่องสั้นมีแค่ตอนเดียว order = 1
      if (existing && (existing.word_count || 0) >= 500) {
        // มีเนื้อหาพอแล้ว — ไม่ต้องสร้าง
        setConfirmData({
          chaptersToCreate: [],
          totalCredits: 0,
          creditPerChapter,
          shortChapters: [],
        });
      } else {
        // ไม่มี หรือสั้นเกินไป — ต้องสร้าง
        setConfirmData({
          chaptersToCreate: [{ order: 1, title: existing?.title || "เรื่องสั้น", needsCreation: !existing }],
          totalCredits: creditPerChapter,
          creditPerChapter,
          shortChapters: existing && (existing.word_count || 0) < 500 ? [existing] : [],
        });
      }
    } else {
      // สำหรับนิยายยาว: ใช้ logic เดิม
      for (let i = 1; i <= target; i++) {
        const existing = chapters.find((c) => c.order === i);
        const wordCount = existing?.word_count || 0;
        
        if (!existing) {
          // ไม่มี record เลย — ต้องสร้างใหม่
          chaptersToCreate.push({ order: i, title: `ตอนที่ ${i}`, needsCreation: true });
        } else if (wordCount < 500) {
          // มี record แต่สั้นเกินไป — นับว่าต้องสร้าง (จะถามผู้ใช้ก่อนเขียนทับ)
          shortChapters.push({ order: i, title: existing.title || `ตอนที่ ${i}`, existingId: existing.id });
        }
        // ถ้า word_count >= 500 ไม่นับว่าต้องสร้าง
      }
      
      // รวมตอนที่ต้องสร้าง (ทั้งที่ไม่มี record และมีแต่สั้น)
      const allChaptersToCreate = [
        ...chaptersToCreate,
        ...shortChapters.map((ch) => ({ ...ch, needsCreation: false })),
      ];
      
      const totalCredits = allChaptersToCreate.length * creditPerChapter;
      setConfirmData({
        chaptersToCreate: allChaptersToCreate,
        totalCredits,
        creditPerChapter,
        shortChapters, // เก็บไว้แสดงให้ผู้ใช้รู้
      });
    }
    
    setStep("confirm");
  };

  const handleConfirmStart = async () => {
    const target = novel?.target_chapters || 10;
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

    // สำหรับเรื่องสั้น: ถ้ามีเนื้อหาอยู่แล้ว >= 500 คำ ให้ข้าม
    if (isOneShot && chaptersWithRealContent > 0) {
      setProgress({ current: 1, total: 1 });
      setLog([{ order: 1, title: chapters[0]?.title || "เรื่องสั้น", status: "skip", wordCount: chapters[0]?.word_count }]);
      finishJob(novelId, { doneCount: 0, errorCount: 0 });
      setStep("done");
      toast.info("เรื่องสั้นมีเนื้อหาอยู่แล้ว");
      return;
    }

    for (let i = 1; i <= (isOneShot ? 1 : target); i++) {
      if (cancelledRef.current) break;

      setProgress({ current: i, total: isOneShot ? 1 : target });
      updateJob(novelId, { current: i, total: isOneShot ? 1 : target });

      const existing = chapters.find((c) => c.order === i);
      let chapterTitle = existing?.title || (isOneShot ? "เรื่องสั้น" : `ตอนที่ ${i}`);
      const existingWordCount = existing?.word_count || 0;

      // สำหรับเรื่องสั้น: ถ้ามีเนื้อหาพอแล้ว ให้ข้าม
      if (isOneShot && existingWordCount >= 500) {
        writtenSoFar.push(existing);
        setLog((l) => [...l, { order: 1, title: chapterTitle, status: "skip", wordCount: existingWordCount }]);
        setCurrentMsg("");
        continue;
      }

      // สำหรับนิยายยาว: เช็คตามเงื่อนไขเดิม
      if (!isOneShot) {
        if (!existing) {
          // จะสร้าง record ด้านล่าง
        } else if (existingWordCount < 500 && existing.content?.trim()) {
          // มีเนื้อหาแต่สั้น — ถามก่อนเขียนทับ
          setCurrentMsg(`⚠️ ตอนที่ ${i} "${chapterTitle}" สั้นเกินไป (${existingWordCount} คำ) — จะเขียนทับ`);
          const decision = await askOverwrite(i, chapterTitle);
          setOverwritePrompt(null);

          if (cancelledRef.current) break;

          if (decision === "skip") {
            writtenSoFar.push(existing);
            setLog((l) => [...l, { order: i, title: chapterTitle, status: "skip" }]);
            setCurrentMsg("");
            continue;
          }
        } else if (existingWordCount >= 500) {
          // มีเนื้อหาพอแล้ว — ข้าม
          writtenSoFar.push(existing);
          setLog((l) => [...l, { order: i, title: chapterTitle, status: "skip" }]);
          setCurrentMsg("");
          continue;
        }
      }

      const linkedEvent = plotEvents.find((e) => e.order === i);
      
      // สร้างชื่อตอนอัตโนมัติถ้าไม่มีเนื้อหาเดิม
      if (!existing || !existing.content?.trim()) {
        setCurrentMsg(`📝 กำลังตั้งชื่อตอนที่ ${i}/${target}...`);
        const contextChaptersForTitle = [
          ...chapters.filter((c) => c.order < i && c.content && !c.is_deleted),
          ...writtenSoFar.filter((c) => c.order < i),
        ].sort((a, b) => a.order - b.order);
        
        chapterTitle = await generateChapterTitle(
          novel, 
          characters, 
          plotEvents, 
          contextChaptersForTitle, 
          i, 
          linkedEvent, 
          writerPrompt
        );
      }

      setCurrentMsg(`✍️ กำลังร่างตอนที่ ${i}/${target}: "${chapterTitle}"...`);

      const contextChapters = [
        ...chapters.filter(
          (c) => c.order < i && c.content && !writtenSoFar.find((w) => w.order === c.order)
        ),
        ...writtenSoFar.filter((c) => c.order < i),
      ].sort((a, b) => a.order - b.order);

      const sysPrompt = buildSystemPrompt(novel, characters, worldEntries, plotEvents, contextChapters, writerPrompt);

      let taskPrompt = sysPrompt;
      taskPrompt += `\n\n[โจทย์ตอนที่ต้องร่าง — เขียนเนื้อหาเต็มตอน]\n`;
      taskPrompt += `ชื่อตอน: "${chapterTitle}"\n`;
      taskPrompt += `ลำดับตอน: ${i} จาก ${target} ตอน\n`;
      taskPrompt += `ความยาวที่ต้องการ: อย่างน้อย ${wordTarget} คำ\n\n`;
      taskPrompt += `[คำสั่งสำคัญ — ต้องปฏิบัติตาม]\n`;
      taskPrompt += `1. เขียนเนื้อหาเต็มตอนเป็นร้อยแก้วนิยายภาษาไทย ความยาวอย่างน้อย ${wordTarget} คำ\n`;
      taskPrompt += `2. ประกอบด้วยหลายฉาก มีทั้งบทบรรยายและบทสนทนาที่ลื่นไหล\n`;
      taskPrompt += `3. ห้ามเขียนเป็นเค้าโครง สรุปย่อ หรือรายการสั้นๆ — ต้องเป็นนิยายเต็มรูปแบบ\n`;
      taskPrompt += `4. ใช้ภาษาไทยที่สละสลวย อ่านแล้วเห็นภาพ มีอารมณ์และจังหวะการเล่าเรื่อง\n`;
      taskPrompt += `5. รักษาความต่อเนื่องกับตอนก่อนหน้า — ตัวละคร เหตุการณ์ และโทนเรื่องต้องสอดคล้องกัน\n\n`;
      if (linkedEvent) {
        taskPrompt += `[เหตุการณ์หลักที่ตอนนี้ต้องบรรยาย]\n`;
        taskPrompt += `• ${linkedEvent.title}`;
        if (linkedEvent.description) taskPrompt += `\n  ${linkedEvent.description}`;
        if (linkedEvent.time_period) taskPrompt += `\n  ช่วงเวลา: ${linkedEvent.time_period}`;
        taskPrompt += `\n\n`;
      }
      taskPrompt += `[เริ่มเขียนตอนนี้เลย — ความยาวอย่างน้อย ${wordTarget} คำ]:\n`;

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

      // ขยายเนื้อหาถ้าจำนวนคำต่ำกว่าเป้าหมายเกิน 10%
      const minWords = Math.floor(wordTarget * 0.9);
      const initialWordCount = countThaiWords(generatedContent);
      let finalContent = generatedContent;
      let finalWordCount = initialWordCount;

      if (initialWordCount < minWords) {
        // ขยายพร้อมแสดง progress แบบ real-time
        let expandRound = 0;
        const expanded = await expandContent(
          generatedContent, 
          wordTarget, 
          chapterTitle, 
          i, 
          linkedEvent, 
          novel,
          ({ attempt, maxAttempts, currentWordCount }) => {
            expandRound = attempt;
            setCurrentMsg(`📝 ขยายรอบที่ ${attempt}/${maxAttempts} — ตอนนี้ ${currentWordCount}/${wordTarget} คำ...`);
          }
        );
        finalContent = expanded.content;
        finalWordCount = expanded.wordCount;
      }

      // บันทึกทันที ไม่ว่าจะได้กี่คำ (แสดงคำเตือนถ้าสั้น)
      if (finalWordCount < 500) {
        setCurrentMsg(`⚠️ ตอนที่ ${i} สั้น (${finalWordCount} คำ) — บันทึกไว้ก่อน`);
      }

      if (existing) {
        await base44.entities.Chapter.update(existing.id, {
          content: finalContent,
          word_count: finalWordCount,
          status: isOneShot ? "เขียนเสร็จ" : "ร่าง",
          title: chapterTitle, // อัพเดทชื่อตอนด้วย
        });
        writtenSoFar.push({ ...existing, content: finalContent, order: i, title: chapterTitle });
      } else {
        const newCh = await base44.entities.Chapter.create({
          novel_id: novelId,
          title: chapterTitle,
          order: i,
          status: isOneShot ? "เขียนเสร็จ" : "ร่าง",
          content: finalContent,
          word_count: finalWordCount,
        });
        writtenSoFar.push({ ...newCh, content: finalContent, order: i });
      }

      doneCountRef.current += 1;
      updateJob(novelId, { current: i, total: isOneShot ? 1 : target, doneCount: doneCountRef.current, errorCount: errorCountRef.current });
      setLog((l) => [...l, { order: i, title: chapterTitle, status: "done", wordCount: finalWordCount }]);
      setCurrentMsg("");
    }

    queryClient.invalidateQueries({ queryKey: ["chapters", novelId] });
    finishJob(novelId, { doneCount: doneCountRef.current, errorCount: errorCountRef.current });
    setStep("done");
    if (!cancelledRef.current) {
      toast.success(isOneShot ? "สร้างเรื่องสั้นเสร็จแล้ว!" : "สร้างตอนทั้งหมดเสร็จแล้ว!");
      if (errorCountRef.current === 0) {
        await base44.entities.Novel.update(novelId, { auto_written: true, status: isOneShot ? "เขียนเสร็จ" : "กำลังเขียน" });
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
            <span className="text-amber-600 font-medium">
              ใช้ Claude Sonnet — integration credits สูงมาก ({isOneShot ? "1" : target} ครั้ง)
            </span>
          </p>
        </DialogHeader>

        {/* Settings */}
        {step === "settings" && (
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
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
                <span className="font-semibold">{chaptersWithRealContent} ตอน</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ตอนที่ต้องสร้าง</span>
                <span className="font-semibold text-primary">{chaptersToCreateCount} ตอน</span>
              </div>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-primary mb-1">ระบบจะควบคุมจำนวนคำอัตโนมัติ</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    หลังสร้างเนื้อหาแต่ละตอน ระบบจะนับจำนวนคำ หากต่ำกว่าเป้าหมายเกิน 10% 
                    AI จะเขียนขยายเพิ่มเติม (เพิ่มฉาก บทสนทนา รายละเอียด) 
                    จนถึงจำนวนคำเป้าหมายก่อนค่อยบันทึก
                  </p>
                </div>
              </div>
            </div>

            {/* Credit estimate preview */}
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
            </div>
          </div>
        )}

        {/* Confirmation */}
        {step === "confirm" && confirmData && (
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-3">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-heading font-semibold text-foreground">ยืนยันการสร้างตอน</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    ระบบจะสร้างตอนที่ไม่มีเนื้อหาทั้งหมด {confirmData.chaptersToCreate.length} ตอน
                  </p>
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">จำนวนตอนที่จะสร้าง</span>
                  <span className="font-semibold">{confirmData.chaptersToCreate.length} ตอน</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">เครดิตต่อตอน</span>
                  <span className="font-semibold">{confirmData.creditPerChapter} เครดิต</span>
                </div>
                <div className="flex justify-between text-primary font-semibold border-t border-primary/20 pt-2">
                  <span>เครดิตทั้งหมดที่ใช้</span>
                  <span>{confirmData.totalCredits} เครดิต</span>
                </div>
                {user?.credits !== undefined && (
                  <div className="flex justify-between text-xs text-muted-foreground mt-2 pt-2 border-t border-border/30">
                    <span>เครดิตคงเหลือ</span>
                    <span className="font-medium">{user.credits.toLocaleString()} เครดิต</span>
                  </div>
                )}
              </div>

              <div className="bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground space-y-2">
                {confirmData.shortChapters && confirmData.shortChapters.length > 0 && (
                  <div>
                    <p className="font-medium text-amber-700 dark:text-amber-300 mb-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      ตอนที่มีอยู่แต่สั้น (&lt;500 คำ) — จะเขียนทับ:
                    </p>
                    <div className="max-h-24 overflow-y-auto space-y-1 pl-2 border-l-2 border-amber-300">
                      {confirmData.shortChapters.map((ch) => (
                        <div key={ch.order} className="flex justify-between">
                          <span>ตอนที่ {ch.order}: {ch.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div>
                  <p className="font-medium mb-1">ตอนที่จะสร้างใหม่:</p>
                  <div className="max-h-24 overflow-y-auto space-y-1">
                    {confirmData.chaptersToCreate.filter((ch) => ch.needsCreation).slice(0, 10).map((ch) => (
                      <div key={ch.order} className="flex justify-between">
                        <span>ตอนที่ {ch.order}: {ch.title}</span>
                      </div>
                    ))}
                    {confirmData.chaptersToCreate.filter((ch) => ch.needsCreation).length > 10 && (
                      <p className="text-xs text-muted-foreground italic">...และอีก {confirmData.chaptersToCreate.filter((ch) => ch.needsCreation).length - 10} ตอน</p>
                    )}
                  </div>
                </div>
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
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                    {isOneShot ? "สร้างเรื่องสั้นเสร็จแล้ว!" : "สร้างนิยายครบทุกตอนแล้ว!"}
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    {isOneShot 
                      ? `${log.reduce((s, e) => s + (e.wordCount || 0), 0).toLocaleString()} คำ`
                      : `${doneCount} ตอน · ${log.reduce((s, e) => s + (e.wordCount || 0), 0).toLocaleString()} คำ`
                    }
                  </p>
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
                ถัดไป
              </Button>
            </>
          )}
          {step === "confirm" && (
            <>
              <Button variant="ghost" onClick={() => setStep("settings")} size="sm">
                กลับไปแก้ไข
              </Button>
              <Button onClick={handleConfirmStart} className="gap-2 bg-primary hover:bg-primary/90">
                <Sparkles className="w-4 h-4" />
                ยืนยันสร้าง ({confirmData?.totalCredits} เครดิต)
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