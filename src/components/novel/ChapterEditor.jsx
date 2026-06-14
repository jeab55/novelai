import React, { useState, useCallback, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Loader2, Download, Copy, MoreHorizontal, Maximize2, Minimize2, Sparkles, Clock, X, RefreshCw, Volume2, History, PieChart, FileText, StickyNote, CheckCircle2, Type, AlignJustify, ShieldCheck, Image } from "lucide-react";
import AiDraftDialog from "./AiDraftDialog";
import EditorReviewPanel from "./EditorReviewPanel";
import TextToSpeechPanel from "./TextToSpeechPanel";
import VersionHistoryDialog from "./VersionHistoryDialog";
import ChapterBalanceMeter from "./ChapterBalanceMeter";
import SceneTemplateDialog from "./SceneTemplateDialog";
import QuickNotesPanel from "./QuickNotesPanel";
import AiEditorReviewPanel from "./AiEditorReviewPanel";
import ReaderReviewRevisionPanel from "./ReaderReviewRevisionPanel";
import InlineDiffViewer from "./InlineDiffViewer";
import HistoricalFactCheckPanel from "./HistoricalFactCheckPanel";
import ChapterIllustrationPanel from "./ChapterIllustrationPanel";
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
  const [title, setTitle] = useState(chapter.title);
  const [content, setContent] = useState(chapter.content || "");
  const [status, setStatus] = useState(chapter.status || "ร่าง");
  const [saving, setSaving] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [ttsOpen, setTtsOpen] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const [changeEventOpen, setChangeEventOpen] = useState(false);
  const [selectedPlotEventId, setSelectedPlotEventId] = useState("");
  // local state for plot event binding (synced from chapter prop)
  const [plotEventId, setPlotEventId] = useState(chapter.plot_event_id || "");
  const [plotEventTitle, setPlotEventTitle] = useState(chapter.plot_event_title || "");
  const [plotEventDescription, setPlotEventDescription] = useState(chapter.plot_event_description || "");
  const [plotEventOrder, setPlotEventOrder] = useState(chapter.plot_event_order || null);
  const [previousContent, setPreviousContent] = useState(chapter.previous_content || "");
  const [editorReview, setEditorReview] = useState(chapter.editor_review || "");
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState("saved"); // "saving" | "saved"
  const [fontSize, setFontSize] = useState(19);
  const [contentWidth, setContentWidth] = useState(720);
  // inline diff state — set เมื่อ ReaderReviewRevisionPanel ได้รับผลจาก AI
  const [inlineDiff, setInlineDiff] = useState(null); // { rawText, color, cleanText, originalText } | null
  const [factCheckOpen, setFactCheckOpen] = useState(false);
  const [illustrationOpen, setIllustrationOpen] = useState(false);
  const queryClient = useQueryClient();

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
        entityId: chapter.id,
        novelId,
        data: { ...chapter, title, content, status, word_count: wordCount },
        label: `บันทึกตอน: ${title || chapter.title}`,
      });
      return base44.entities.Chapter.update(chapter.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chapters", novelId] });
      toast.success("บันทึกแล้ว");
      setSaving(false);
    },
    onError: () => setSaving(false),
  });

  const handleSave = () => {
    setSaving(true);
    setInlineDiff(null); // ลบไฮไลต์เมื่อบันทึก
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
    if (!inlineDiff) return;
    setSaving(true);
    await base44.entities.Chapter.update(chapter.id, {
      previous_content: inlineDiff.originalText,
      content: inlineDiff.cleanText,
      word_count: countWords(inlineDiff.cleanText),
    });
    queryClient.invalidateQueries({ queryKey: ["chapters", novelId] });
    setPreviousContent(inlineDiff.originalText);
    setInlineDiff(null);
    setSaving(false);
    toast.success("บันทึกแล้ว — เนื้อหาเดิมถูกเก็บไว้ใน 'ฉบับสำรอง'");
  };

  // ยกเลิก diff — คืนเนื้อหาเดิม
  const handleInlineDiffCancel = () => {
    if (inlineDiff) setContent(inlineDiff.originalText);
    setInlineDiff(null);
  };

  const handleBindEvent = () => {
    const ev = plotEvents.find((e) => e.id === selectedPlotEventId);
    if (!ev) return;
    setPlotEventId(ev.id);
    setPlotEventTitle(ev.title);
    setPlotEventDescription(ev.description || "");
    setPlotEventOrder(ev.order || null);
    base44.entities.Chapter.update(chapter.id, {
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
    setPlotEventId("");
    setPlotEventTitle("");
    setPlotEventDescription("");
    setPlotEventOrder(null);
    base44.entities.Chapter.update(chapter.id, {
      plot_event_id: "",
      plot_event_title: "",
      plot_event_description: "",
      plot_event_order: null,
    });
    queryClient.invalidateQueries({ queryKey: ["chapters", novelId] });
    toast.success("ปลดการผูกแล้ว");
  };

  const debouncedAutoSave = useCallback(
    debounce((newContent) => {
      setAutoSaveStatus("saving");
      base44.entities.Chapter.update(chapter.id, {
        content: newContent,
        word_count: countWords(newContent),
      }).then(() => setAutoSaveStatus("saved"));
    }, 2000),
    [chapter.id]
  );

  const toolbar = (
    <div className={`border-b border-border/60 px-4 py-2.5 flex items-center gap-3 transition-all ${focusMode ? "bg-background/95 backdrop-blur-sm" : "bg-card/30"}`}>
      {!focusMode && (
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
      )}
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="max-w-sm font-heading font-semibold border-none bg-transparent shadow-none focus-visible:ring-0 px-0 text-base"
      />
      <div className="flex items-center gap-2 ml-auto">
        {/* Autosave indicator */}
        <span className={`text-xs flex items-center gap-1 tabular-nums transition-colors ${autoSaveStatus === "saving" ? "text-amber-500" : "text-emerald-600"}`}>
          {autoSaveStatus === "saving"
            ? <><Loader2 className="w-3 h-3 animate-spin" />กำลังบันทึก...</>
            : <><CheckCircle2 className="w-3 h-3" />บันทึกแล้ว</>
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

        {/* TTS button */}
        <Button
          variant="outline"
          size="sm"
          className={`gap-1.5 h-8 text-xs border-amber-300 hover:bg-amber-50 ${ttsOpen ? "bg-amber-100 text-amber-800" : "text-amber-700"}`}
          onClick={() => setTtsOpen((v) => !v)}
          title="อ่านด้วยเสียง"
        >
          <Volume2 className="w-3.5 h-3.5" />
          ฟังเสียง
        </Button>

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

        {/* Quick Notes button */}
        <Button
          variant="outline"
          size="sm"
          className={`gap-1.5 h-8 text-xs border-amber-300 hover:bg-amber-50 ${notesOpen ? "bg-amber-100 text-amber-800" : "text-amber-700"}`}
          onClick={() => setNotesOpen((v) => !v)}
          title="บันทึกย่อ"
        >
          <StickyNote className="w-3.5 h-3.5" />
          โน้ต
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
        <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          บันทึก
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
                setAutoSaveStatus("saving");
                debouncedAutoSave(e.target.value);
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
    ...chapter,
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
      entityId={chapter.id}
      novelId={novelId}
      currentData={{ ...chapter, title, content, status, word_count: wordCount }}
      currentLabel={title || chapter.title}
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
        setContent((prev) => (prev ? prev + "\n\n" + draft : draft));
        debouncedAutoSave(content + "\n\n" + draft);
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
            <Button className="flex-1" onClick={handleBindEvent} disabled={!selectedPlotEventId}>บันทึก</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <div className="flex flex-col h-[calc(100vh-7rem)]">
      {toolbar}
      {timelineBanner}
      {ttsOpen && (
        <TextToSpeechPanel
          content={content}
          onClose={() => setTtsOpen(false)}
        />
      )}
      {balanceOpen && (
        <ChapterBalanceMeter
          content={content}
          onClose={() => setBalanceOpen(false)}
        />
      )}

      {templateOpen && (
        <SceneTemplateDialog
          novelId={novelId}
          chapter={chapter}
          onTemplateComplete={(generatedContent, templateData) => {
            setContent(generatedContent);
            setTemplateOpen(false);
            toast.success("สร้างฉากสำเร็จแล้ว");
          }}
          onClose={() => setTemplateOpen(false)}
        />
      )}
      
      <EditorReviewPanel
        chapter={{ ...chapter, content, editor_review: editorReview, previous_content: previousContent, plot_event_id: plotEventId, plot_event_title: plotEventTitle, plot_event_description: plotEventDescription, plot_event_order: plotEventOrder }}
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
        chapter={{ ...chapter, title, content, plot_event_id: plotEventId, plot_event_title: plotEventTitle, plot_event_description: plotEventDescription, plot_event_order: plotEventOrder }}
        novel={novel || { title: "" }}
        novelId={novelId}
        onContentUpdate={(revised) => {
          setContent(revised);
          queryClient.invalidateQueries({ queryKey: ["chapters", novelId] });
        }}
      />
      <ReaderReviewRevisionPanel
        chapter={{ ...chapter, title, content, plot_event_id: plotEventId, plot_event_title: plotEventTitle, plot_event_description: plotEventDescription, plot_event_order: plotEventOrder }}
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
          chapter={chapter}
          novel={novel || { title: "" }}
          novelId={novelId}
          onClose={() => setIllustrationOpen(false)}
        />
      )}
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
            {notesOpen && (
              <QuickNotesPanel novelId={novelId} onClose={() => setNotesOpen(false)} />
            )}
          </>
        ) : (
          <>
            <div className="flex-1 overflow-auto bg-background">
              <div className="mx-auto px-8 py-10" style={{ maxWidth: `${contentWidth}px` }}>
                <textarea
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value);
                    setAutoSaveStatus("saving");
                    debouncedAutoSave(e.target.value);
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
            {notesOpen && (
              <QuickNotesPanel novelId={novelId} onClose={() => setNotesOpen(false)} />
            )}
          </>
        )}
      </div>
    </div>
    </>
  );
}