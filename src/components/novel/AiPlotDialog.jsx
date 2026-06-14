import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { saveChapterContent } from "@/lib/saveChapterContent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Sparkles, Plus, Trash2, RefreshCw, FileText, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Users, Globe } from "lucide-react";
import AiWorldBuilderDialog from "./AiWorldBuilderDialog";

function stripCodeFence(text) {
  if (typeof text !== "string") return text;
  // Remove ```json ... ``` or ``` ... ``` fences
  return text.replace(/^```[\w]*\n?/m, "").replace(/\n?```$/m, "").trim();
}

function parseAiResult(raw) {
  // If already an object (InvokeLLM returned parsed JSON), use directly
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const outline = raw.plot_outline || raw.plotOutline || raw.outline || raw.summary || "";
    const eventsRaw = raw.events || raw.timeline || raw.plot_events || raw.items || [];
    const charsRaw = raw.characters || raw.chars || [];
    return { outline, eventsRaw, charsRaw };
  }
  // Otherwise try to parse string
  const cleaned = stripCodeFence(String(raw));
  const parsed = JSON.parse(cleaned);
  const outline = parsed.plot_outline || parsed.plotOutline || parsed.outline || parsed.summary || "";
  const eventsRaw = parsed.events || parsed.timeline || parsed.plot_events || parsed.items || [];
  const charsRaw = parsed.characters || parsed.chars || [];
  return { outline, eventsRaw, charsRaw };
}

function buildPrompt(novel, writer, characters) {
  const writerContext = writer?.system_prompt ? `\nสไตล์การเขียน: ${writer.system_prompt}\n` : "";
  const targetChapters = novel.target_chapters || 10;

  // Separate pre-entered chars (from novel creation) vs chars already fully saved in DB
  const preEnteredChars = characters.filter((c) => c.name && (!c.personality && !c.background && !c.appearance));
  const fullChars = characters.filter((c) => c.name && (c.personality || c.background || c.appearance));

  const preEnteredSection = preEnteredChars.length > 0
    ? `ตัวละครที่ผู้ใช้กำหนดไว้แล้ว (ต้องใช้ตามนี้ ห้ามตัดหรือเปลี่ยนชื่อ — เติมรายละเอียดที่ขาดให้ครบ):
${preEnteredChars.map((c) => {
      const fixed = [
        c.age ? `อายุ ${c.age}` : null,
        c.occupation ? `อาชีพ: ${c.occupation}` : null,
        c.personality ? `อุปนิสัย: ${c.personality}` : null,
        c.background ? `ปูมหลัง: ${c.background}` : null,
        c.wound ? `ปม/บาดแผล: ${c.wound}` : null,
        c.desire ? `สิ่งที่ต้องการ: ${c.desire}` : null,
      ].filter(Boolean);
      const missing = [
        !c.age && "อายุ", !c.occupation && "อาชีพ", !c.personality && "อุปนิสัย",
        !c.background && "ปูมหลัง", !c.wound && "ปม", !c.desire && "desire", "ลักษณะภายนอก"
      ].filter(Boolean);
      return `- ${c.name} (${c.role || "ตัวละคร"})${fixed.length ? " [คงไว้] " + fixed.join(", ") : ""} — เติมที่ขาด: ${missing.join(", ")}`;
    }).join("\n")}`
    : "";

  const fullCharSection = fullChars.length > 0
    ? `ตัวละครที่มีข้อมูลครบแล้ว (ห้ามสร้างซ้ำชื่อเหล่านี้ คงไว้ตามเดิม):
${fullChars.map((c) => `- ${c.name} (${c.role || "ตัวละคร"}): ${c.personality || ""}`).join("\n")}`
    : "";

  const allExistingNames = characters.map((c) => c.name).filter(Boolean).join(", ") || "ยังไม่มี";

  return `${writerContext}
คุณคือบรรณาธิการที่ช่วยวางโครงเรื่องนิยาย ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอก JSON

ข้อมูลนิยาย:
- ชื่อเรื่อง: ${novel.title}
- แนว: ${novel.genre || "ไม่ระบุ"}
- เรื่องย่อ: ${novel.synopsis || "ไม่มีเรื่องย่อ"}
- ยุคสมัย/ฉากหลัง: ${novel.era || "ไม่ระบุ"}
- จำนวนตอนที่ต้องการ: ${targetChapters} ตอน

${preEnteredSection}
${fullCharSection}
ชื่อทั้งหมดที่มีอยู่แล้ว (ห้ามสร้างซ้ำ): ${allExistingNames}

งานที่ต้องทำ 2 ส่วน:

[ส่วนที่ 1] จัดการตัวละครตามกฎดังนี้:
  (ก) ตัวละครที่ผู้ใช้กำหนดไว้: ต้องอยู่ใน output ทุกตัว และเติมฟิลด์ที่ขาด (อายุ ลักษณะ นิสัย ปูมหลัง want need ปม ความสัมพันธ์) ให้สมบูรณ์
  (ข) ตัวละครที่มีข้อมูลครบ: คงค่าเดิม ไม่ต้องเติม ไม่ต้องเปลี่ยน
  (ค) ถ้าตัวละครที่มีอยู่ยังไม่เพียงพอสำหรับเรื่อง ให้สร้างตัวละครเพิ่มเติมใหม่ให้เรื่องครบสมบูรณ์
แต่ละตัวต้องมีฟิลด์:
- name: ชื่อตัวละคร
- role: บทบาท (ตัวเอก / ตัวรอง / ตัวร้าย / ตัวประกอบ)
- age: อายุ (ข้อความ เช่น "25 ปี")
- appearance: ลักษณะภายนอก
- personality: นิสัยและบุคลิก
- background: ปูมหลัง
- desire: สิ่งที่ต้องการ (want — สิ่งที่ตัวละครคิดว่าตัวเองต้องการ)
- wound: สิ่งที่ต้องการจริง (need — สิ่งที่ตัวละครต้องการจริงๆ) รวมกับปมในใจ (wound)
- relationships: ความสัมพันธ์กับตัวละครอื่น

[ส่วนที่ 2] แบ่งโครงเรื่อง 3 องก์ออกเป็น ${targetChapters} ตอนเท่าๆ กัน โดยแต่ละตอนต้องมี:
- order: เลขลำดับตอน (1-${targetChapters})
- title: ชื่อตอน
- description: สรุปเหตุการณ์สำคัญในตอน (2-3 บรรทัด)
- act: องก์ที่สังกัด (1=ต้นเรื่อง, 2=กลางเรื่อง, 3=จุด Climax และบทสรุป)

ตอบด้วย JSON โครงสร้างนี้เท่านั้น (ไม่มี markdown, ไม่มี backtick):
{"plot_outline":"สรุปโครงเรื่อง 3 องก์ แก่น/ธีม คำถามหลักของเรื่อง จุดหักเห","characters":[{"name":"ชื่อ","role":"ตัวเอก","age":"25 ปี","appearance":"...","personality":"...","background":"...","desire":"...","wound":"...","relationships":"..."}],"events":[{"order":1,"title":"ชื่อตอน","description":"สรุปเหตุการณ์","act":1}]}

สร้างโครงเรื่องให้ครบ ${targetChapters} ตอน ครอบคลุมทั้งสามองก์ ปรับให้เหมาะกับแนว "${novel.genre || "ทั่วไป"}" ตอบเป็นภาษาไทยทั้งหมด ตอบด้วย JSON ล้วนเท่านั้น`;
}

const DEFAULT_WRITER_PROMPT = `คุณคือนักเขียนนิยายภาษาไทยมืออาชีพที่กำลังร่างตอนใหม่ให้ผู้เขียน
คุณต้องร่างเนื้อหาตอนที่สมบูรณ์ตามโครงที่ได้รับ รักษาสำนวนและโทนของเรื่อง ใช้ภาษาไทยที่อ่านลื่น`;

async function generateChapterDraft({ novel, writer, characters, worldEntries, plotEvents, chapters, event, linkedPlotEvent }) {
  const writerPrompt = writer?.system_prompt || DEFAULT_WRITER_PROMPT;
  const charList = characters.map((c) => c.name).join(", ");

  let sysPrompt = `[บทบาท]\n${writerPrompt}\n\n`;
  sysPrompt += `[บริบทเรื่อง]\nชื่อเรื่อง: ${novel.title}\n`;
  if (novel.genre) sysPrompt += `แนว: ${novel.genre}\n`;
  if (novel.era) sysPrompt += `ยุคสมัย/ฉากหลัง: ${novel.era}\n`;
  if (novel.synopsis) sysPrompt += `เรื่องย่อ: ${novel.synopsis}\n`;

  if (characters.length > 0) {
    sysPrompt += `\n[ตัวละคร]\n`;
    characters.forEach((c) => {
      sysPrompt += `• ${c.name} (${c.role || "ตัวประกอบ"})${c.personality ? ` — ${c.personality}` : ""}\n`;
    });
  }

  if (worldEntries.length > 0) {
    sysPrompt += `\n[โลกและฉาก]\n`;
    worldEntries.forEach((w) => {
      sysPrompt += `• [${w.category || "อื่นๆ"}] ${w.title}${w.description ? `: ${w.description}` : ""}\n`;
    });
  }

  if (plotEvents.length > 0) {
    sysPrompt += `\n[ไทม์ไลน์]\n`;
    plotEvents.forEach((e) => {
      sysPrompt += `• #${e.order} ${e.title}${e.description ? ` — ${e.description}` : ""}\n`;
    });
  }

  const prevChapters = chapters.filter((ch) => ch.content).slice(-2);
  if (prevChapters.length > 0) {
    sysPrompt += `\n[ตอนก่อนหน้า — รักษาความต่อเนื่อง]\n`;
    prevChapters.forEach((ch) => {
      const preview = ch.content.substring(0, 1000);
      sysPrompt += `\n— ตอนที่ ${ch.order}: "${ch.title}" —\n${preview}${ch.content.length > 1000 ? "\n…(ต่อ)" : ""}\n`;
    });
  }

  if (linkedPlotEvent) {
    sysPrompt += `\n[เหตุการณ์หลักที่ตอนนี้ต้องบรรยาย — สำคัญมาก]\n`;
    sysPrompt += `ลำดับ ${linkedPlotEvent.order}: ${linkedPlotEvent.title}\n`;
    if (linkedPlotEvent.description) sysPrompt += `รายละเอียด: ${linkedPlotEvent.description}\n`;
    sysPrompt += `→ ตอนนี้ต้องเล่าเหตุการณ์นี้ให้ครบ ใช้เป็นแกนกลางของพล็อต\n`;
  }

  sysPrompt += `\n[คำสั่งสำคัญ]\n- ร่างเนื้อหาตอนนี้ให้ครบประมาณ 1,200 คำ อย่าตัดจบกลางคัน\n`;
  sysPrompt += `- ใช้ "Show don't tell" แสดงผ่านการกระทำและบทสนทนา\n`;
  sysPrompt += `- จบตอนด้วย chapter hook ที่ดึงให้อยากอ่านต่อ\n`;
  sysPrompt += `- ใช้ภาษาไทยที่อ่านลื่น เหมาะกับยุคสมัยของเรื่อง\n`;
  if (charList) sysPrompt += `- ใช้ชื่อตัวละครตรงตามคลังตัวละครเสมอ: ${charList}\n`;
  sysPrompt += `- ผลลัพธ์: เฉพาะเนื้อหาตอน ไม่ต้องมีคำนำหรืออธิบาย\n`;

  const prompt = `${sysPrompt}\n\n[โจทย์ตอนที่ต้องร่าง]\nชื่อตอน: ${event.title}\nสิ่งที่ต้องเกิดในตอนนี้:\n${event.description || ""}\n\nร่างตอนนี้ให้ครบ 1,200 คำ:`;

  const result = await base44.integrations.Core.InvokeLLM({ prompt, model: "claude_sonnet_4_6" });
  let text = typeof result === "string" ? result : (result?.text || "");
  // Strip code fences
  text = text.replace(/^```[\w]*\n?/m, "").replace(/\n?```$/m, "").trim();
  return text;
}

export default function AiPlotDialog({ open, onClose, novel, novelId, onOpenChapter }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState("idle"); // idle | generating | review | error
  const [outline, setOutline] = useState("");
  const [events, setEvents] = useState([]);
  const [aiCharacters, setAiCharacters] = useState([]); // { ...fields, checked, expanded, alreadyExists }
  const [replaceConfirm, setReplaceConfirm] = useState(false);
  const [parseError, setParseError] = useState("");
  // draftStatus: map of event index -> "drafting" | "done" | ""
  const [draftStatus, setDraftStatus] = useState({});
  const [worldBuilderOpen, setWorldBuilderOpen] = useState(false);
  const [savedSuccessfully, setSavedSuccessfully] = useState(false);

  const { data: writer } = useQuery({
    queryKey: ["writer", novel?.writer_id],
    queryFn: () => base44.entities.Writer.filter({ id: novel.writer_id }),
    enabled: !!novel?.writer_id,
    select: (data) => data[0],
  });

  const { data: characters = [] } = useQuery({
    queryKey: ["characters", novelId],
    queryFn: async () => {
      const all = await base44.entities.Character.filter({ novel_id: novelId });
      return all.filter((c) => !c.is_deleted);
    },
    enabled: !!novelId,
  });

  const { data: worldEntries = [] } = useQuery({
    queryKey: ["worldEntries", novelId],
    queryFn: async () => {
      const all = await base44.entities.WorldEntry.filter({ novel_id: novelId });
      return all.filter((w) => !w.is_deleted);
    },
    enabled: !!novelId,
  });

  const { data: existingChapters = [] } = useQuery({
    queryKey: ["chapters", novelId],
    queryFn: async () => {
      const all = await base44.entities.Chapter.filter({ novel_id: novelId }, "order");
      return all.filter((c) => !c.is_deleted);
    },
    enabled: !!novelId,
    staleTime: 30000,
  });

  const { data: existingEvents = [] } = useQuery({
    queryKey: ["plotEvents", novelId],
    queryFn: async () => {
      const all = await base44.entities.PlotEvent.filter({ novel_id: novelId }, "order");
      return all.filter((e) => !e.is_deleted);
    },
    enabled: !!novelId,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ eventsToSave, replace }) => {
      // Update plot_outline on novel
      await base44.entities.Novel.update(novelId, { plot_outline: outline });

      if (replace) {
        await Promise.all(existingEvents.map((e) => base44.entities.PlotEvent.delete(e.id)));
      }

      const baseOrder = replace ? 0 : (existingEvents.length > 0 ? Math.max(...existingEvents.map((e) => e.order || 0)) : 0);
      await Promise.all(
        eventsToSave.map((ev) =>
          base44.entities.PlotEvent.create({
            novel_id: novelId,
            title: ev.title,
            description: ev.description,
            order: baseOrder + ev.order,
          })
        )
      );

      // Save checked characters — skip any that already exist (by name, case-insensitive)
      const currentChars = await base44.entities.Character.filter({ novel_id: novelId });
      const existingNameSet = new Set(currentChars.map((c) => c.name.toLowerCase().trim()));
      const charsToSave = aiCharacters.filter((c) => c.checked && c.name && !existingNameSet.has(c.name.toLowerCase().trim()));
      if (charsToSave.length > 0) {
        await Promise.all(
          charsToSave.map((c) =>
            base44.entities.Character.create({
              novel_id: novelId,
              name: c.name,
              role: c.role,
              age: c.age,
              appearance: c.appearance,
              personality: c.personality,
              background: c.background,
              desire: c.desire,
              wound: c.wound,
              relationships: c.relationships,
            })
          )
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plotEvents", novelId] });
      queryClient.invalidateQueries({ queryKey: ["characters", novelId] });
      setSavedSuccessfully(true);
    },
  });

  const generate = async () => {
    if (!novel || step === "generating") return;
    setStep("generating");
    setParseError("");

    const userPrompt = buildPrompt(novel, writer, characters);

    let raw;
    try {
      raw = await base44.integrations.Core.InvokeLLM({
        prompt: userPrompt,
        model: "claude_sonnet_4_6",
      });
    } catch (err) {
      setParseError(`เรียก AI ไม่สำเร็จ: ${err.message}`);
      setStep("review");
      return;
    }

    let parsedOutline = "";
    let eventsRaw = [];
    let charsRaw = [];
    try {
      const parsed = parseAiResult(raw);
      parsedOutline = parsed.outline;
      eventsRaw = parsed.eventsRaw;
      charsRaw = parsed.charsRaw;
      if (!parsedOutline && !eventsRaw.length) throw new Error("ไม่พบข้อมูลใน response");
    } catch (err) {
      if (typeof raw === "string" && raw.length > 10) {
        parsedOutline = raw;
        eventsRaw = [];
        charsRaw = [];
        setParseError("ไม่สามารถแยก JSON ได้ แสดงข้อความดิบจาก AI ในช่องโครงเรื่อง กรุณาแก้ไขหรือลองใหม่");
      } else {
        setParseError(`แยกผลลัพธ์ไม่สำเร็จ: ${err.message} — กรุณากด "เขียนใหม่"`);
        setStep("review");
        setOutline("");
        setEvents([]);
        setAiCharacters([]);
        return;
      }
    }

    // Build character list with duplicate detection
    const existingNames = new Set(characters.map((c) => c.name.toLowerCase().trim()));
    const mappedChars = charsRaw.map((c) => {
      const alreadyExists = existingNames.has((c.name || "").toLowerCase().trim());
      return {
        name: c.name || "",
        role: c.role || "ตัวประกอบ",
        age: c.age || "",
        appearance: c.appearance || "",
        personality: c.personality || "",
        background: c.background || "",
        desire: c.desire || "",
        wound: c.wound || "",
        relationships: c.relationships || "",
        checked: !alreadyExists,
        expanded: false,
        alreadyExists,
      };
    });

    setOutline(parsedOutline);
    setEvents(eventsRaw.map((e, i) => ({
      order: e.order ?? i + 1,
      title: e.title || e.name || "",
      description: e.description || e.desc || e.content || "",
    })));
    setAiCharacters(mappedChars);
    setStep("review");
  };

  const handleSave = () => {
    if (existingEvents.length > 0) {
      setReplaceConfirm(true);
    } else {
      saveMutation.mutate({ eventsToSave: events, replace: false });
    }
  };

  const addEvent = () => {
    setEvents((prev) => [
      ...prev,
      { order: prev.length + 1, title: "", description: "" },
    ]);
  };

  const removeEvent = (idx) => {
    setEvents((prev) => prev.filter((_, i) => i !== idx).map((e, i) => ({ ...e, order: i + 1 })));
  };

  const updateEvent = (idx, field, value) => {
    setEvents((prev) => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  };

  const getActLabel = (act) => {
    if (act === 1) return "องก์ 1 (ต้นเรื่อง)";
    if (act === 2) return "องก์ 2 (กลางเรื่อง)";
    if (act === 3) return "องก์ 3 (Climax)";
    return "ไม่ระบุ";
  };

  const handleDraftChapter = async (idx) => {
    const ev = events[idx];
    if (!ev?.title) return;

    setDraftStatus((prev) => ({ ...prev, [idx]: "drafting" }));

    // Find linked plot event from existingEvents by order match
    const linkedPlotEvent = existingEvents.find((pe) => pe.order === ev.order) || null;

    let draftContent = "";
    try {
      draftContent = await generateChapterDraft({
        novel,
        writer,
        characters,
        worldEntries,
        plotEvents: existingEvents,
        chapters: existingChapters,
        event: ev,
        linkedPlotEvent,
      });
    } catch (err) {
      setDraftStatus((prev) => ({ ...prev, [idx]: `error:ร่างไม่สำเร็จ: ${err.message}` }));
      return;
    }

    if (!draftContent) {
      setDraftStatus((prev) => ({ ...prev, [idx]: "error:AI ไม่ส่งเนื้อหากลับมา กรุณาลองใหม่" }));
      return;
    }

    // Use cached existingChapters (already fetched by useQuery above) — no extra list() call
    const existingChapter = existingChapters.find(
      (ch) => ch.novel_id === novelId && ch.order === ev.order
    );

    const result = await saveChapterContent({
      novelId,
      chapterId: existingChapter?.id || null,
      title: ev.title,
      order: ev.order,
      content: draftContent,
      status: "ร่าง",
    });

    if (result.success) {
      // Invalidate and re-fetch to get the real chapter id (especially for newly created chapters)
      await queryClient.invalidateQueries({ queryKey: ["chapters", novelId] });
      const freshChapters = await base44.entities.Chapter.filter({ novel_id: novelId }, "order");
      const savedChapter = freshChapters.find((ch) => ch.order === ev.order) || existingChapter;
      const chapterToOpen = savedChapter
        ? { ...savedChapter, content: draftContent }
        : { novel_id: novelId, title: ev.title, order: ev.order, content: draftContent, status: "ร่าง" };
      setDraftStatus((prev) => ({ ...prev, [idx]: { state: "done", chapter: chapterToOpen } }));
    } else {
      setDraftStatus((prev) => ({ ...prev, [idx]: `error:${result.error}` }));
    }
  };

  const handleClose = () => {
    onClose();
    setStep("idle");
    setOutline("");
    setEvents([]);
    setAiCharacters([]);
    setDraftStatus({});
    setParseError("");
    setSavedSuccessfully(false);
  };

  const updateAiChar = (idx, field, value) => {
    setAiCharacters((prev) => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              AI ช่วยวางพล็อตและไทม์ไลน์
            </DialogTitle>
          </DialogHeader>

          {step === "idle" && (
            <div className="py-6 text-center space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                AI จะวิเคราะห์ข้อมูลนิยายและสไตล์ของนักเขียนประจำเรื่อง
                <br />แล้ววางโครงเรื่อง 3 องก์ พร้อมไทม์ไลน์เหตุการณ์หลัก
                <br /><span className="text-primary/80 font-medium">และสร้างตัวละครหลักของเรื่องให้ในครั้งเดียว</span>
              </p>
              {writer ? (
                <Button
                  onClick={generate}
                  variant="outline"
                  className="gap-2 mt-2 border-primary/30 text-primary hover:bg-primary/5"
                >
                  <Sparkles className="w-4 h-4" />
                  ใช้สไตล์ของ <strong>{writer.name}</strong>
                </Button>
              ) : (
                <Button onClick={generate} className="gap-2 mt-2">
                  <Sparkles className="w-4 h-4" />
                  เริ่มวางพล็อต
                </Button>
              )}
            </div>
          )}

          {step === "generating" && (
            <div className="py-12 flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">AI กำลังวางโครงเรื่อง...</p>
              <p className="text-xs text-muted-foreground/60">อาจใช้เวลา 15-30 วินาที</p>
            </div>
          )}

          {step === "review" && (
            <div className="space-y-5">
              {parseError && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  ⚠️ {parseError}
                </div>
              )}
              {/* Plot outline */}
              <div>
                <label className="text-sm font-semibold mb-2 block text-foreground">โครงเรื่อง (3 องก์)</label>
                <Textarea
                  value={outline}
                  onChange={(e) => setOutline(e.target.value)}
                  rows={6}
                  className="text-sm leading-relaxed"
                />
              </div>

              {/* Events list */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-foreground">ไทม์ไลน์เหตุการณ์</label>
                  <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={addEvent}>
                    <Plus className="w-3 h-3" />
                    เพิ่ม
                  </Button>
                </div>
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {events.map((ev, idx) => {
                    const status = draftStatus[idx];
                    return (
                      <div key={idx} className="border border-border/60 rounded-lg p-3 bg-muted/30 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-muted-foreground w-5 shrink-0">#{idx + 1}</span>
                          <Input
                            value={ev.title}
                            onChange={(e) => updateEvent(idx, "title", e.target.value)}
                            placeholder="ชื่อตอน"
                            className="h-7 text-sm flex-1"
                          />
                          <Select value={ev.act || 1} onValueChange={(v) => updateEvent(idx, "act", Number(v))}>
                            <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">องก์ 1</SelectItem>
                              <SelectItem value="2">องก์ 2</SelectItem>
                              <SelectItem value="3">องก์ 3</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeEvent(idx)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                        <Textarea
                          value={ev.description}
                          onChange={(e) => updateEvent(idx, "description", e.target.value)}
                          placeholder="สรุปเหตุการณ์สำคัญในตอน..."
                          rows={2}
                          className="text-xs leading-relaxed"
                        />
                        <div className="flex items-center justify-between pt-0.5 gap-2 flex-wrap">
                          {status?.state === "done" ? (
                            <div className="flex items-center gap-2">
                              <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                                <CheckCircle2 className="w-3 h-3" />
                                ร่างเสร็จแล้ว
                              </span>
                              {onOpenChapter && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs gap-1 px-2 text-primary underline underline-offset-2"
                                  onClick={() => { handleClose(); onOpenChapter(status.chapter); }}
                                >
                                  เปิด editor →
                                </Button>
                              )}
                            </div>
                          ) : status === "drafting" ? (
                            <span className="flex items-center gap-1 text-xs text-primary">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              กำลังร่าง...
                            </span>
                          ) : typeof status === "string" && status.startsWith("error:") ? (
                            <span className="flex items-center gap-1 text-xs text-destructive">
                              <AlertCircle className="w-3 h-3" />
                              {status.replace("error:", "")}
                            </span>
                          ) : (
                            <span />
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs gap-1 px-2 shrink-0"
                            disabled={status === "drafting" || !ev.title}
                            onClick={() => { setDraftStatus((p) => ({ ...p, [idx]: "" })); handleDraftChapter(idx); }}
                          >
                            {status === "drafting" ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <FileText className="w-3 h-3" />
                            )}
                            {status?.state === "done" ? "ร่างใหม่" : "สร้างร่างตอน"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Characters section */}
              {aiCharacters.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-primary" />
                    <label className="text-sm font-semibold text-foreground">ตัวละครที่ AI สร้าง</label>
                    <span className="text-xs text-muted-foreground ml-auto">
                      เลือก {aiCharacters.filter((c) => c.checked).length}/{aiCharacters.length} ตัว
                    </span>
                  </div>
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {aiCharacters.map((char, idx) => (
                      <div key={idx} className={`border rounded-lg p-3 space-y-2 ${char.alreadyExists ? "border-amber-200 bg-amber-50/40" : "border-border/60 bg-muted/30"}`}>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={char.checked}
                            onCheckedChange={(v) => updateAiChar(idx, "checked", !!v)}
                            disabled={char.alreadyExists}
                            id={`char-check-${idx}`}
                          />
                          <label htmlFor={`char-check-${idx}`} className="flex items-center gap-2 flex-1 cursor-pointer">
                            <span className="text-sm font-semibold">{char.name || "(ไม่มีชื่อ)"}</span>
                            <span className="text-xs text-muted-foreground">· {char.role}</span>
                            {char.alreadyExists && (
                              <Badge variant="outline" className="text-xs text-amber-700 border-amber-300 bg-amber-50 ml-1">มีอยู่แล้ว</Badge>
                            )}
                          </label>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground shrink-0"
                            onClick={() => updateAiChar(idx, "expanded", !char.expanded)}
                          >
                            {char.expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </Button>
                        </div>

                        {char.expanded && (
                          <div className="space-y-2 pt-1 border-t border-border/40">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-muted-foreground mb-1 block">ชื่อ</label>
                                <Input value={char.name} onChange={(e) => updateAiChar(idx, "name", e.target.value)} className="h-7 text-xs" />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground mb-1 block">บทบาท</label>
                                <Select value={char.role} onValueChange={(v) => updateAiChar(idx, "role", v)}>
                                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="ตัวเอก">ตัวเอก</SelectItem>
                                    <SelectItem value="ตัวรอง">ตัวรอง</SelectItem>
                                    <SelectItem value="ตัวร้าย">ตัวร้าย</SelectItem>
                                    <SelectItem value="ตัวประกอบ">ตัวประกอบ</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">อายุ</label>
                              <Input value={char.age} onChange={(e) => updateAiChar(idx, "age", e.target.value)} className="h-7 text-xs" placeholder="เช่น 25 ปี" />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">ลักษณะภายนอก</label>
                              <Textarea value={char.appearance} onChange={(e) => updateAiChar(idx, "appearance", e.target.value)} rows={2} className="text-xs" />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">นิสัยและบุคลิก</label>
                              <Textarea value={char.personality} onChange={(e) => updateAiChar(idx, "personality", e.target.value)} rows={2} className="text-xs" />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">ปูมหลัง</label>
                              <Textarea value={char.background} onChange={(e) => updateAiChar(idx, "background", e.target.value)} rows={2} className="text-xs" />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">สิ่งที่ต้องการ (want)</label>
                              <Input value={char.desire} onChange={(e) => updateAiChar(idx, "desire", e.target.value)} className="h-7 text-xs" />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">สิ่งที่ต้องการจริง / ปม (need / wound)</label>
                              <Textarea value={char.wound} onChange={(e) => updateAiChar(idx, "wound", e.target.value)} rows={2} className="text-xs" />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">ความสัมพันธ์</label>
                              <Textarea value={char.relationships} onChange={(e) => updateAiChar(idx, "relationships", e.target.value)} rows={2} className="text-xs" />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              {savedSuccessfully ? (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mt-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  บันทึกไทม์ไลน์และตัวละครเรียบร้อยแล้ว
                </div>
              ) : (
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="gap-2 flex-1" onClick={() => { setStep("idle"); setOutline(""); setEvents([]); setAiCharacters([]); }}>
                    <RefreshCw className="w-3.5 h-3.5" />
                    เขียนใหม่
                  </Button>
                  <Button
                    className="gap-2 flex-1"
                    onClick={handleSave}
                    disabled={saveMutation.isPending || events.every((e) => !e.title)}
                  >
                    {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    บันทึกลงไทม์ไลน์
                    {aiCharacters.filter((c) => c.checked).length > 0 && (
                      <span className="text-xs opacity-70">+ {aiCharacters.filter((c) => c.checked).length} ตัวละคร</span>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm replace/append */}
      <AlertDialog open={replaceConfirm} onOpenChange={setReplaceConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">ไทม์ไลน์มีข้อมูลอยู่แล้ว</AlertDialogTitle>
            <AlertDialogDescription>
              ปัจจุบันมี {existingEvents.length} เหตุการณ์ในไทม์ไลน์ คุณต้องการ...
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => { setReplaceConfirm(false); saveMutation.mutate({ eventsToSave: events, replace: false }); }}
            >
              เพิ่มต่อท้าย
            </Button>
            <AlertDialogAction
              onClick={() => { setReplaceConfirm(false); saveMutation.mutate({ eventsToSave: events, replace: true }); }}
            >
              แทนที่ทั้งหมด
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}