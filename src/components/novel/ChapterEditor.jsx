import React, { useState, useCallback, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Loader2, Download, Copy, MoreHorizontal, Maximize2, Minimize2, Sparkles, Clock, X, RefreshCw, History, PieChart, FileText, CheckCircle2, Type, AlignJustify, ShieldCheck, Image, Wand2, Users2, Lightbulb } from "lucide-react";
import AiDraftDialog from "./AiDraftDialog";
import EditorReviewPanel from "./EditorReviewPanel";
import VersionHistoryDialog from "./VersionHistoryDialog";
import ChapterBalanceMeter from "./ChapterBalanceMeter";
import SceneTemplateDialog from "./SceneTemplateDialog";
import AiEditorReviewPanel from "./AiEditorReviewPanel";
import ReaderReviewRevisionPanel from "./ReaderReviewRevisionPanel";
import InlineDiffViewer from "./InlineDiffViewer";
import HistoricalFactCheckPanel from "./HistoricalFactCheckPanel";
import ChapterIllustrationPanel from "./ChapterIllustrationPanel";
import ThaiProofreaderPanel from "./ThaiProofreaderPanel";
import ThaiSpellCheckerDialog from "./ThaiSpellCheckerDialog";
import DialectTranslationPanel from "./DialectTranslationPanel";
import RewritePolishPanel from "./RewritePolishPanel";
import PovSwitchPanel from "./PovSwitchPanel";
import WritersBlockPanel from "./WritersBlockPanel";
import { saveVersion } from "@/lib/saveVersion";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { debounce } from "lodash";
import { downloadChapterTxt, downloadChapterMd, copyChapterToClipboard } from "@/utils/exportChapter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

function countWords(text) {
  if (!text) return 0;
  const cleaned = text.replace(/<[^>]*>/g, " ").replace(/&[a-z]+;/g, " ");
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter("th", { granularity: "word" });
    let count = 0;
    for (const seg of segmenter.segment(cleaned)) {
      if (seg.isWordLike) count++;
    }
    return count;
  }
  const thaiChars = (cleaned.match(/[\u0E00-\u0E7F]/g) || []).length;
  const eng = (cleaned.match(/[a-zA-Z]+/g) || []).length;
  return Math.round(thaiChars / 3.5) + eng;
}

export default function ChapterEditor({ chapter, novelId, novel, onBack }) {
  // Defensive: ensure chapter has required fields with defaults
  const safeChapter = {
    ...chapter,
    id: chapter?.id || "",
    title: chapter?.title || "ไม่มีชื่อ",
    content: chapter?.content || "",
    status: chapter?.status || "ร่าง",
    word_count: chapter?.word_count || 0,
    order: chapter?.order || 0,
    illustration_urls: chapter?.illustration_urls || [],
    plot_event_id: chapter?.plot_event_id || "",
    plot_event_title: chapter?.plot_event_title || "",
    plot_event_description: chapter?.plot_event_description || "",
    plot_event_order: chapter?.plot_event_order || null,
    previous_content: chapter?.previous_content || "",
    editor_review: chapter?.editor_review || "",
  };

  const [title, setTitle] = useState(safeChapter.title);
  const [content, setContent] = useState(safeChapter.content);
  const [status, setStatus] = useState(safeChapter.status);
  const [saving, setSaving] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const [changeEventOpen, setChangeEventOpen] = useState(false);
  const [selectedPlotEventId, setSelectedPlotEventId] = useState("");
  // local state for plot event binding (synced from chapter prop)
  const [plotEventId, setPlotEventId] = useState(chapter.plot_event_id || "");
  const [plotEventTitle, setPlotEventTitle] = useState(chapter.plot_event_title || "");
  const [plotEventDescription, setPlotEventDescription] = useState(chapter.plot_event_description || "");
  const [plotEventOrder, setPlotEventOrder] = useState(chapter.plot_event_order || null);
  const [previousContent, setPreviousContent] = useState(safeChapter.previous_content);
  const [editorReview, setEditorReview] = useState(safeChapter.editorReview);
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState("saved"); // "saving" | "saved"
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [fontSize, setFontSize] = useState(19);
  const [contentWidth, setContentWidth] = useState(720);
  // inline diff state — set เมื่อ ReaderReviewRevisionPanel ได้รับผลจาก AI
  const [inlineDiff, setInlineDiff] = useState(null); // { rawText, color, cleanText, originalText } | null
  const [factCheckOpen, setFactCheckOpen] = useState(false);
  const [illustrationOpen, setIllustrationOpen] = useState(false);
  const [proofreaderOpen, setProofreaderOpen] = useState(false);
  const [spellCheckerOpen, setSpellCheckerOpen] = useState(false);
  const [polishOpen, setPolishOpen] = useState(false);
  const [povOpen, setPovOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [titleSuggesting, setTitleSuggesting] = useState(false);
  const queryClient = useQueryClient();

  // ให้ AI คิดชื่อตอนจากเนื้อเรื่อง
  const handleSuggestTitle = async () => {
    const text = (content || "").replace(/<[^>]*>/g, " ").trim();
    if (text.length < 30) {
      toast.error("เนื้อเรื่องสั้นเกินไป กรุณาเขียนเนื้อหาก่อนให้ AI ตั้งชื่อตอน");
      return;
    }
    setTitleSuggesting(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `คุณคือนักเขียนนิยายไทยมืออาชีพ ช่วยตั้งชื่อตอนจากเนื้อเรื่องด้านล่างนี้ ให้น่าสนใจ ดึงดูดให้อยากอ่าน กระชับ (ไม่เกิน 8 คำ) สื่อถึงแก่นหรือจุดสำคัญของตอน${novel?.genre ? ` เหมาะกับแนว${novel.genre}` : ""} โดยไม่สปอยล์ปมสำคัญ\n\n[เนื้อเรื่อง]\n${text.substring(0, 4000)}\n\nตอบเฉพาะชื่อตอนเดียว ไม่ต้องมีเครื่องหมายคำพูด หัวข้อ หรือคำอธิบายใดๆ`,
      });
      const cleaned = (typeof result === "string" ? result : "").replace(/^["'「」]+|["'「」]+$/g, "").replace(/^ชื่อตอน[:：]\s*/i, "").trim().split("\n")[0];
      if (cleaned) {
        setTitle(cleaned);
        triggerAutoSave();
        toast.success("ตั้งชื่อตอนด้วย AI สำเร็จ! ✨");
      } else {
        toast.error("AI ไม่สามารถตั้งชื่อตอนได้ กรุณาลองใหม่");
      }
    } catch {
      toast.error("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    }
    setTitleSuggesting(false);
  };

  const { data: plotEvents = [] } = useQuery({
    queryKey: ["plotEvents", novelId],
    queryFn: async () => {
      const all = await base44.entities.PlotEvent.filter({ novel_id: novelId }, "order");
      return all.filter((e) => !e.is_deleted);
    },
  });

  const wordCount = countWords(content);

  // ออกโหมดโฟกัสด้วย Esc
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape" && focusMode) setFocusMode(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [focusMode]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      // snapshot ก่อนบันทึก
      await saveVersion({
        entityType: "chapter",
        entityId: safeChapter.id,
        novelId,
        data: { ...safeChapter, title, content, status, word_count: wordCount },
        label: `บันทึกตอน: ${title || safeChapter.title}`,
      });
      return base44.entities.Chapter.update(safeChapter.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chapters", novelId] });
      toast.success("บันทึกแล้ว");
      setSaving(false);
      setAutoSaveStatus("saved");
      setLastSavedAt(new Date());
    },
    onError: () => setSaving(false),
  });

  const handleSave = () => {
    if (!safeChapter.id) {
      toast.error("ไม่พบข้อมูลตอน - กรุณาลองใหม่อีกครั้ง");
      return;
    }
    setSaving(true);
    setInlineDiff(null);
    saveMutation.mutate({ title, content, status, word_count: wordCount, plot_event_id: plotEventId, plot_event_title: plotEventTitle, plot_event_description: plotEventDescription, plot_event_order: plotEventOrder });
  };

  // รับผลจาก ReaderReviewRevisionPanel:
  //   rawText = เนื้อหาที่ AI ส่งกลับ (มี [[EDIT]] tags, ใช้แสดง highlight)
  //   color = สีไฮไลต์
  //   cleanText = เนื้อหาสุทธิไม่มี tags (ใช้บันทึก)
  //   originalText = เนื้อหาก่อนแก้ (สำรองไว้)
  const handleReviseReady = (rawText, color, cleanText, originalText) => {
    setInlineDiff({ rawText, color, cleanText, originalText });
    // อัปเดต content เป็น cleanText เพื่อให้ wordCount ถูกต้อง แต่ยังไม่บันทึก DB
    setContent(cleanText);
  };

  // บันทึกเนื้อหาที่ AI แก้ (cleanText ไม่มี tags) พร้อมล้างไฮไลต์
  const handleInlineDiffSave = async () => {
    if (!inlineDiff || !safeChapter.id) return;
    setSaving(true);
    try {
      await base44.entities.Chapter.update(safeChapter.id, {
        previous_content: inlineDiff.originalText,
        content: inlineDiff.cleanText,
        word_count: countWords(inlineDiff.cleanText),
      });
      queryClient.invalidateQueries({ queryKey: ["chapters", novelId] });
      setPreviousContent(inlineDiff.originalText);
      setInlineDiff(null);
      setSaving(false);
      toast.success("บันทึกแล้ว — เนื้อหาเดิมถูกเก็บไว้ใน 'ฉบับสำรอง'");
    } catch (error) {
      console.error("Failed to save inline diff:", error);
      toast.error("ไม่สามารถบันทึกได้ กรุณาลองใหม่อีกครั้ง");
      setSaving(false);
    }
  };

  // ยกเลิก diff — คืนเนื้อหาเดิม
  const handleInlineDiffCancel = () => {
    if (inlineDiff) setContent(inlineDiff.originalText);
    setInlineDiff(null);
  };

  const handleBindEvent = () => {
    if (!safeChapter.id) return;
    const ev = plotEvents.find((e) => e.id === selectedPlotEventId);
    if (!ev) return;
    setPlotEventId(ev.id);
    setPlotEventTitle(ev.title);
    setPlotEventDescription(ev.description || "");
    setPlotEventOrder(ev.order || null);
    base44.entities.Chapter.update(safeChapter.id, {
      plot_event_id: ev.id,
      plot_event_title: ev.title,
      plot_event_description: ev.description || "",
      plot_event_order: ev.order || null,
    });
    queryClient.invalidateQueries({ queryKey: ["chapters", novelId] });
    setChangeEventOpen(false);
    setSelectedPlotEventId("");
    toast.success("ผูกเหตุการณ์แล้ว");
  };

  const handleUnbindEvent = () => {
    if (!safeChapter.id) return;
    setPlotEventId("");
    setPlotEventTitle("");
    setPlotEventDescription("");
    setPlotEventOrder(null);
    base44.entities.Chapter.update(safeChapter.id, {
      plot_event_id: "",
      plot_event_title: "",
      plot_event_description: "",
      plot_event_order: null,
    });
    queryClient.invalidateQueries({ queryKey: ["chapters", novelId] });
    toast.success("ปลดการผูกแล้ว");
  };

  // เก็บค่าล่าสุดไว้ใน ref เพื่อให้ debounce บันทึกค่าปัจจุบันเสมอ (กัน stale closure)
  const latestRef = useRef({ title, content });
  useEffect(() => {
    latestRef.current = { title, content };
  }, [title, content]);

  // debounce สร้างครั้งเดียว (ref-based) — กันการ recreate ทุก render และกันบันทึกซ้ำซ้อน
  const debouncedAutoSave = useRef(
    debounce(() => {
      const id = latestRef.current.id;
      if (!id) return;
      const { title: t, content: c } = latestRef.current;
      base44.entities.Chapter.update(id, {
        title: t,
        content: c,
        word_count: countWords(c),
      }).then(() => {
        setAutoSaveStatus("saved");
        setLastSavedAt(new Date());
      }).catch((err) => {
        console.error("Auto-save failed:", err);
        setAutoSaveStatus("saved");
      });
    }, 2500)
  ).current;

  // sync id เข้า ref ด้วย
  useEffect(() => {
    latestRef.current.id = safeChapter.id;
  }, [safeChapter.id]);

  // ยกเลิก debounce ที่ค้างเมื่อ unmount
  useEffect(() => () => debouncedAutoSave.cancel(), [debouncedAutoSave]);

  // เรียกเมื่อมีการแก้ไข — อัปเดตสถานะเป็น "กำลังบันทึก" แล้วหน่วงบันทึก
  const triggerAutoSave = useCallback(() => {
    if (!safeChapter.id) return;
    setAutoSaveStatus("saving");
    debouncedAutoSave();
  }, [safeChapter.id, debouncedAutoSave]);

  const toolbar = (
    <div className={`border-b border-border/60 px-4 py-2.5 flex items-center gap-3 transition-all ${focusMode ? "bg-background/95 backdrop-blur-sm" : "bg-card/30"}`}>
      {!focusMode && (
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
      )}
      <Input
        value={title}
        onChange={(e) => { setTitle(e.target.value); triggerAutoSave(); }}
        className="max-w-xs font-heading font-semibold border-none bg-transparent shadow-none focus-visible:ring-0 px-0 text-base"
      />
      <Button
        variant="ghost"
        size="sm"
        className="gap-1 h-8 text-xs text-primary/70 hover:text-primary hover:bg-primary/8 shrink-0 px-2"
        onClick={handleSuggestTitle}
        disabled={titleSuggesting}
        title="ให้ AI คิดชื่อตอนจากเนื้อเรื่อง"
      >
        {titleSuggesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
        <span className="hidden lg:inline">{titleSuggesting ? "กำลังคิด..." : "AI ตั้งชื่อตอน"}</span>
      </Button>
      <div className="flex items-center gap-2 ml-auto">
        {/* Autosave indicator */}
        <span className={`text-xs flex items-center gap-1 tabular-nums transition-colors ${autoSaveStatus === "saving" ? "text-amber-500" : "text-emerald-600"}`}>
          {autoSaveStatus === "saving"
            ? <><Loader2 className="w-3 h-3 animate-spin" />กำลังบันทึก...</>
            : <>
                <CheckCircle2 className="w-3 h-3" />
                บันทึกแล้ว
                {lastSavedAt && (
                  <span className="text-muted-foreground/70 ml-0.5">
                    {lastSavedAt.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.
                  </span>
                )}
              </>
          }
        </span>
        <span className="text-xs text-muted-foreground tabular-nums border-l border-border/50 pl-2">
          {wordCount.toLocaleString()} คำ
        </span>
        {/* Font size control */}
        <div className="flex items-center gap-1 border border-border/50 rounded-lg px-2 h-8">
          <Type className="w-3 h-3 text-muted-foreground" />
          <button onClick={() => setFontSize(v => Math.max(14, v - 1))} className="text-muted-foreground hover:text-foreground text-xs px-0.5">−</button>
          <span className="text-xs tabular-nums w-5 text-center">{fontSize}</span>
          <button onClick={() => setFontSize(v => Math.min(28, v + 1))} className="text-muted-foreground hover:text-foreground text-xs px-0.5">+</button>
        </div>
        {/* Content width control */}
        <div className="flex items-center gap-1 border border-border/50 rounded-lg px-2 h-8">
          <AlignJustify className="w-3 h-3 text-muted-foreground" />
          {[600, 720, 900].map(w => (
            <button key={w} onClick={() => setContentWidth(w)}
              className={`text-[10px] px-1 rounded transition-colors ${contentWidth === w ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"}`}>
              {w === 600 ? "S" : w === 720 ? "M" : "L"}
            </button>
          ))}
        </div>

        {/* Version History button */}
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 h-8 text-xs border-border text-muted-foreground hover:text-foreground"
          onClick={() => setVersionOpen(true)}
          title="ประวัติเวอร์ชัน"
        >
          <History className="w-3.5 h-3.5" />
          ประวัติ
        </Button>

        {/* Balance Meter button */}
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 h-8 text-xs border-primary/30 text-primary hover:bg-primary/5"
          onClick={() => setBalanceOpen(true)}
          title="วัดสมดุลเนื้อหา"
        >
          <PieChart className="w-3.5 h-3.5" />
          สมดุล
        </Button>

        {/* Scene Template button */}
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 h-8 text-xs border-primary/30 text-primary hover:bg-primary/5"
          onClick={() => setTemplateOpen(true)}
          title="เขียนฉากใหม่ด้วยเทมเพลต"
        >
          <FileText className="w-3.5 h-3.5" />
          เทมเพลต
        </Button>

        {/* Illustration button */}
        <Button
          variant="outline"
          size="sm"
          className={`gap-1.5 h-8 text-xs border-violet-300 hover:bg-violet-50 ${illustrationOpen ? "bg-violet-100 text-violet-800" : "text-violet-700"}`}
          onClick={() => setIllustrationOpen((v) => !v)}
          title="สร้างภาพประกอบ AI"
        >
          <Image className="w-3.5 h-3.5" />
          ภาพประกอบ
        </Button>

        {/* Historical Fact Check button */}
        <Button
          variant="outline"
          size="sm"
          className={`gap-1.5 h-8 text-xs border-indigo-300 hover:bg-indigo-50 ${factCheckOpen ? "bg-indigo-100 text-indigo-800" : "text-indigo-700"}`}
          onClick={() => setFactCheckOpen((v) => !v)}
          title="ตรวจข้อเท็จจริงทางประวัติศาสตร์"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          ตรวจข้อเท็จจริง
        </Button>

        {/* Thai Proofreader button */}
        <Button
          variant="outline"
          size="sm"
          className={`gap-1.5 h-8 text-xs border-emerald-300 hover:bg-emerald-50 ${proofreaderOpen ? "bg-emerald-100 text-emerald-800" : "text-emerald-700"}`}
          onClick={() => setProofreaderOpen((v) => !v)}
          title="ตรวจคำผิดและการเว้นวรรค"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          ตรวจวรรค
        </Button>

        {/* Spell Checker button */}
        <Button
          variant="outline"
          size="sm"
          className={`gap-1.5 h-8 text-xs border-blue-300 hover:bg-blue-50 ${spellCheckerOpen ? "bg-blue-100 text-blue-800" : "text-blue-700"}`}
          onClick={() => setSpellCheckerOpen(true)}
          title="ตรวจคำสะกดผิด คำพิมพ์ตก คำที่ใช้ผิดบริบท"
        >
          <Sparkles className="w-3.5 h-3.5" />
          ตรวจคำผิด
        </Button>

        {/* Rewrite / Polish button */}
        <Button
          variant="outline"
          size="sm"
          className={`gap-1.5 h-8 text-xs border-fuchsia-300 hover:bg-fuchsia-50 ${polishOpen ? "bg-fuchsia-100 text-fuchsia-800" : "text-fuchsia-700"}`}
          onClick={() => setPolishOpen((v) => !v)}
          title="ขัดเกลาสำนวน: กระชับ/ละเอียด/เปลี่ยนโทน/แก้คำซ้ำ"
        >
          <Wand2 className="w-3.5 h-3.5" />
          ขัดเกลา
        </Button>

        {/* POV Switch button */}
        <Button
          variant="outline"
          size="sm"
          className={`gap-1.5 h-8 text-xs border-teal-300 hover:bg-teal-50 ${povOpen ? "bg-teal-100 text-teal-800" : "text-teal-700"}`}
          onClick={() => setPovOpen((v) => !v)}
          title="ปรับมุมมองการเล่า บุรุษที่ 1 ↔ บุรุษที่ 3"
        >
          <Users2 className="w-3.5 h-3.5" />
          มุมมอง
        </Button>

        {/* Writer's Block Helper button */}
        <Button
          variant="outline"
          size="sm"
          className={`gap-1.5 h-8 text-xs border-amber-300 hover:bg-amber-50 ${blockOpen ? "bg-amber-100 text-amber-800" : "text-amber-700"}`}
          onClick={() => setBlockOpen((v) => !v)}
          title="แก้ตัน: เสนอทางเดินเรื่องต่อหลายแบบ"
        >
          <Lightbulb className="w-3.5 h-3.5" />
          แก้ตัน
        </Button>

        {/* Dialect Translation button */}
        <DialectTranslationPanel
          content={content}
          novel={novel}
          onApplyTranslation={(translatedContent) => {
            setContent(translatedContent);
            latestRef.current.content = translatedContent;
            triggerAutoSave();
          }}
        />

        {/* AI Draft button */}
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 h-8 text-xs border-primary/30 text-primary hover:bg-primary/5"
          onClick={() => setDraftOpen(true)}
        >
          <Sparkles className="w-3.5 h-3.5" />
          ให้ AI ร่าง
        </Button>

        {/* Focus mode toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => setFocusMode((v) => !v)}
          title={focusMode ? "ออกโหมดโฟกัส (Esc)" : "โหมดโฟกัส"}
        >
          {focusMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </Button>

        {/* Export menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => downloadChapterTxt(title, content)}>
              <Download className="w-3.5 h-3.5 mr-2" />
              ดาวน์โหลดเป็น .txt
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => downloadChapterMd(title, content)}>
              <Download className="w-3.5 h-3.5 mr-2" />
              ดาวน์โหลดเป็น .md
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                await copyChapterToClipboard(title, content);
                toast.success("คัดลอกแล้ว");
              }}
            >
              <Copy className="w-3.5 h-3.5 mr-2" />
              คัดลอกทั้งตอน
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {!focusMode && (
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ร่าง">ร่าง</SelectItem>
              <SelectItem value="เขียนเสร็จ">เขียนเสร็จ</SelectItem>
              <SelectItem value="เผยแพร่">เผยแพร่</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving || !title.trim()}>
          {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span className="hidden sm:inline">กำลังบันทึก...</span></> : <><Save className="w-3.5 h-3.5" /><span className="hidden sm:inline">บันทึก</span></>}
        </Button>
      </div>
    </div>
  );

  // แถบแสดงเหตุการณ์ไทม์ไลน์
  const timelineBanner = plotEventId ? (
    <div className="flex items-center gap-2 px-4 py-2 bg-amber-50/70 border-b border-amber-200/60 text-xs">
      <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
      <span className="text-amber-700 font-medium">อิงไทม์ไลน์:</span>
      <span className="text-amber-800">
        ลำดับ {plotEventOrder} — {plotEventTitle}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <button
          onClick={() => { setSelectedPlotEventId(plotEventId); setChangeEventOpen(true); }}
          className="flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-amber-200/60 text-amber-700 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          เปลี่ยน
        </button>
        <button
          onClick={handleUnbindEvent}
          className="flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-amber-200/60 text-amber-700 transition-colors"
        >
          <X className="w-3 h-3" />
          ปลด
        </button>
      </div>
    </div>
  ) : plotEvents.length > 0 ? (
    <div className="flex items-center gap-2 px-4 py-1.5 bg-muted/30 border-b border-border/40 text-xs">
      <Clock className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
      <span className="text-muted-foreground/70">ยังไม่ผูกกับเหตุการณ์ไทม์ไลน์</span>
      <button
        onClick={() => setChangeEventOpen(true)}
        className="ml-auto px-2 py-0.5 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
      >
        + ผูกเหตุการณ์
      </button>
    </div>
  ) : null;

  // โหมดโฟกัส: fullscreen overlay
  if (focusMode) {
    return (
      <div className="fixed inset-0 z-50 bg-[hsl(35,30%,97%)] flex flex-col">
        {toolbar}
        <div className="flex-1 overflow-auto">
          <div className="mx-auto px-8 py-12" style={{ maxWidth: `${contentWidth}px` }}>
            <textarea
              autoFocus
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                triggerAutoSave();
              }}
              placeholder="เริ่มเขียนเรื่องราวของคุณที่นี่..."
              className="w-full min-h-[80vh] bg-transparent border-none outline-none resize-none placeholder:text-muted-foreground/40"
              style={{
                fontFamily: "'Sarabun', 'Noto Sans Thai', sans-serif",
                fontSize: `${fontSize}px`,
                lineHeight: "1.95",
                color: "hsl(var(--foreground))",
              }}
            />
          </div>
        </div>
        <div className="text-center pb-4">
          <span className="text-xs text-muted-foreground/50">กด Esc เพื่อออกจากโหมดโฟกัส</span>
        </div>
      </div>
    );
  }

  // chapter object ที่ส่งไป AiDraftDialog พร้อม plot event ปัจจุบัน
  const chapterWithEvent = {
    ...safeChapter,
    title,
    plot_event_id: plotEventId,
    plot_event_title: plotEventTitle,
    plot_event_description: plotEventDescription,
    plot_event_order: plotEventOrder,
  };

  return (
    <>
    <VersionHistoryDialog
      open={versionOpen}
      onClose={() => setVersionOpen(false)}
      entityType="chapter"
      entityId={safeChapter.id}
      novelId={novelId}
      currentData={{ ...safeChapter, title, content, status, word_count: wordCount }}
      currentLabel={title || safeChapter.title}
      onRestored={(type, id, data) => {
        if (data.title) setTitle(data.title);
        if (data.content !== undefined) setContent(data.content);
        if (data.status) setStatus(data.status);
        queryClient.invalidateQueries({ queryKey: ["chapters", novelId] });
      }}
    />
    <AiDraftDialog
      open={draftOpen}
      onClose={() => setDraftOpen(false)}
      chapter={chapterWithEvent}
      novel={novel || { title: "" }}
      novelId={novelId}
      onInsert={(draft) => {
        const newContent = content ? content + "\n\n" + draft : draft;
        setContent(newContent);
        latestRef.current.content = newContent;
        triggerAutoSave();
      }}
    />

    {/* Dialog เปลี่ยน/ผูกเหตุการณ์ */}
    <Dialog open={changeEventOpen} onOpenChange={setChangeEventOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            ผูกเหตุการณ์ไทม์ไลน์
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-1">
          <Select value={selectedPlotEventId} onValueChange={setSelectedPlotEventId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="เลือกเหตุการณ์" />
            </SelectTrigger>
            <SelectContent>
              {plotEvents.map((ev) => (
                <SelectItem key={ev.id} value={ev.id}>
                  <span className="font-medium text-primary/70 mr-1.5">#{ev.order}</span>
                  {ev.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedPlotEventId && (() => {
            const ev = plotEvents.find((e) => e.id === selectedPlotEventId);
            return ev?.description ? (
              <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 leading-relaxed">{ev.description}</p>
            ) : null;
          })()}
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setChangeEventOpen(false)}>ยกเลิก</Button>
            <Button className="flex-1" onClick={handleBindEvent} disabled={!selectedPlotEventId} title={!selectedPlotEventId ? "กรุณาเลือกเหตุการณ์" : ""}>บันทึก</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <div className="flex flex-col h-[calc(100vh-7rem)]">
      {toolbar}
      {timelineBanner}
      {balanceOpen && (
        <ChapterBalanceMeter
          content={content}
          onClose={() => setBalanceOpen(false)}
        />
      )}

      {templateOpen && (
        <SceneTemplateDialog
          novelId={novelId}
          chapter={safeChapter}
          onTemplateComplete={(generatedContent, templateData) => {
            setContent(generatedContent);
            setTemplateOpen(false);
            toast.success("สร้างฉากสำเร็จแล้ว");
          }}
          onClose={() => setTemplateOpen(false)}
        />
      )}
      
      <EditorReviewPanel
        chapter={{ ...safeChapter, content, editor_review: editorReview, previous_content: previousContent, plot_event_id: plotEventId, plot_event_title: plotEventTitle, plot_event_description: plotEventDescription, plot_event_order: plotEventOrder }}
        novel={novel || { title: "" }}
        novelId={novelId}
        onContentUpdate={(improved, oldContent) => {
          setContent(improved);
          setPreviousContent(oldContent);
          queryClient.invalidateQueries({ queryKey: ["chapters", novelId] });
        }}
        onPreviousContentRestore={(restored) => {
          setContent(restored);
          setPreviousContent("");
          queryClient.invalidateQueries({ queryKey: ["chapters", novelId] });
        }}
      />
      <AiEditorReviewPanel
        chapter={{ ...safeChapter, title, content, plot_event_id: plotEventId, plot_event_title: plotEventTitle, plot_event_description: plotEventDescription, plot_event_order: plotEventOrder }}
        novel={novel || { title: "" }}
        novelId={novelId}
        onContentUpdate={(revised) => {
          setContent(revised);
          queryClient.invalidateQueries({ queryKey: ["chapters", novelId] });
        }}
      />
      <ReaderReviewRevisionPanel
        chapter={{ ...safeChapter, title, content, plot_event_id: plotEventId, plot_event_title: plotEventTitle, plot_event_description: plotEventDescription, plot_event_order: plotEventOrder }}
        novel={novel || { title: "" }}
        novelId={novelId}
        onReviseReady={handleReviseReady}
      />
      {factCheckOpen && (
        <HistoricalFactCheckPanel
          content={content}
          novel={novel || { title: "" }}
          onClose={() => setFactCheckOpen(false)}
        />
      )}
      {illustrationOpen && (
        <ChapterIllustrationPanel
          chapter={safeChapter}
          novel={novel || { title: "" }}
          novelId={novelId}
          onClose={() => setIllustrationOpen(false)}
        />
      )}
      {proofreaderOpen && (
        <div className="border-t border-border/60 bg-card/30 p-4">
          <ThaiProofreaderPanel
            content={content}
            novel={novel}
            onApplySuggestions={(updatedContent) => setContent(updatedContent)}
          />
        </div>
      )}
      {polishOpen && (
        <RewritePolishPanel
          content={content}
          novel={novel}
          onApply={(updated) => { setContent(updated); latestRef.current.content = updated; triggerAutoSave(); }}
          onClose={() => setPolishOpen(false)}
        />
      )}
      {povOpen && (
        <PovSwitchPanel
          content={content}
          novel={novel}
          onApply={(updated) => { setContent(updated); latestRef.current.content = updated; triggerAutoSave(); }}
          onClose={() => setPovOpen(false)}
        />
      )}
      {blockOpen && (
        <WritersBlockPanel
          content={content}
          novel={novel}
          onClose={() => setBlockOpen(false)}
        />
      )}
      
      <ThaiSpellCheckerDialog
        open={spellCheckerOpen}
        onClose={() => setSpellCheckerOpen(false)}
        content={content}
        novel={novel}
        onApplyChanges={(updatedContent) => {
          setContent(updatedContent);
          latestRef.current.content = updatedContent;
          triggerAutoSave();
        }}
      />
      <div className="flex flex-1 overflow-hidden">
        {/* inline diff view — แทน textarea เมื่อมี diff */}
        {inlineDiff ? (
          <>
            <InlineDiffViewer
              rawText={inlineDiff.rawText}
              highlightColor={inlineDiff.color}
              fontSize={fontSize}
              contentWidth={contentWidth}
              onSave={handleInlineDiffSave}
              onCancel={handleInlineDiffCancel}
              saving={saving}
            />
          </>
        ) : (
          <>
            <div className="flex-1 overflow-auto bg-background">
              <div className="mx-auto px-8 py-10" style={{ maxWidth: `${contentWidth}px` }}>
                <textarea
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value);
                    triggerAutoSave();
                  }}
                  placeholder="เริ่มเขียนเรื่องราวของคุณที่นี่..."
                  className="w-full min-h-[65vh] bg-transparent border-none outline-none resize-none placeholder:text-muted-foreground/40"
                  style={{
                    fontFamily: "'Sarabun', 'Noto Sans Thai', sans-serif",
                    fontSize: `${fontSize}px`,
                    lineHeight: "1.95",
                    color: "hsl(var(--foreground))",
                  }}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
    </>
  );
}