import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useBulkWrite } from "@/lib/BulkWriteContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, FileText, Loader2, Trash2, Download, Copy, MoreHorizontal, Clock, Sparkles, Users, BookOpen, Layers, GripVertical, Layers2, Wand2, CheckCircle2, Image as ImageIcon, Edit3 } from "lucide-react";
import ExportDialog from "./ExportDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import ChapterEditor from "./ChapterEditor";
import { downloadChapterTxt, downloadChapterMd, copyChapterToClipboard, downloadAllChaptersMd } from "@/utils/exportChapter";
import { toast } from "sonner";
import AiChapterGeneratorDialog from "./AiChapterGeneratorDialog";
import AiDraftDialog from "./AiDraftDialog";
import ContinuityChecker from "./ContinuityChecker";
import BulkAutoWriteDialog from "./BulkAutoWriteDialog";
import SeasonSelectorDialog from "./SeasonSelectorDialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import NovelSpellCheckSummary from "./NovelSpellCheckSummary";
import ErrorBoundary from "../ErrorBoundary";

const statusColors = {
  "ร่าง": "bg-amber-50 text-amber-700 border border-amber-200",
  "เขียนเสร็จ": "bg-emerald-50 text-emerald-700 border border-emerald-200",
  "เผยแพร่": "bg-sky-50 text-sky-700 border border-sky-200",
};

export default function WritingRoom({ novelId, novel, pendingOpenChapter, onPendingOpenChapterConsumed }) {
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [newChapterOpen, setNewChapterOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [selectedPlotEventId, setSelectedPlotEventId] = useState("");
  const [aiGenerateOpen, setAiGenerateOpen] = useState(false);
  const [aiChapterGeneratorOpen, setAiChapterGeneratorOpen] = useState(false);
  const [aiDraftOpen, setAiDraftOpen] = useState(false);
  const [draftChapter, setDraftChapter] = useState(null);
  const [bulkAutoWriteOpen, setBulkAutoWriteOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [seasonSelectorOpen, setSeasonSelectorOpen] = useState(false);
  const [spellCheckSummaryOpen, setSpellCheckSummaryOpen] = useState(false);
  const [deleteSeasonDialogOpen, setDeleteSeasonDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  // Handle chapter navigation from other tabs (e.g. AiPlotDialog draft)
  useEffect(() => {
    if (pendingOpenChapter) {
      setSelectedChapter(pendingOpenChapter);
      onPendingOpenChapterConsumed?.();
    }
  }, [pendingOpenChapter]);

  // selectedSeasonTab คือ novelId ที่เลือก (default = novelId)
  const [selectedSeasonTab, setSelectedSeasonTab] = useState(novelId);

  const { jobs } = useBulkWrite();
  const isBulkWriting = jobs[selectedSeasonTab]?.status === "running";

  // Reset selectedSeasonTab เมื่อ novelId เปลี่ยน (เช่น เมื่อสลับ Season จาก parent component)
  useEffect(() => {
    setSelectedSeasonTab(novelId);
  }, [novelId]);

  // โหลดทุก Season (Novel หลัก + novels ที่มี parent_novel_id = novelId)
  const { data: seasons = [] } = useQuery({
    queryKey: ["seasons", novelId],
    queryFn: async () => {
      const all = await base44.entities.Novel.list();
      // Season 1 คือนิยายหลัก, Season 2+ คือ novels ที่มี parent_novel_id = novelId
      const season1 = novel;
      const season2Plus = all.filter(
        (n) => String(n.parent_novel_id) === String(novelId) && !n.is_deleted
      );
      return [season1, ...season2Plus].filter(Boolean);
    },
    enabled: !!novel,
    staleTime: 30000, // 30 วินาที
    gcTime: 120000, // 2 นาที
  });

  // โหลดข้อมูล novel ของ Season ที่เลือก — เพื่อให้ได้ข้อมูลที่ถูกต้องของแต่ละ Season
  const { data: selectedSeasonNovel } = useQuery({
    queryKey: ["novel", selectedSeasonTab],
    queryFn: async () => {
      const all = await base44.entities.Novel.list();
      return all.find((n) => String(n.id) === String(selectedSeasonTab));
    },
    enabled: !!selectedSeasonTab,
    staleTime: 30000,
    gcTime: 120000,
  });

  // โหลด chapters ของ Season ที่เลือก — cache นานขึ้น
  const { data: chapters = [], isLoading } = useQuery({
    queryKey: ["chapters", selectedSeasonTab],
    queryFn: async () => {
      if (!selectedSeasonTab) return [];
      try {
        const all = await base44.entities.Chapter.filter({ novel_id: selectedSeasonTab }, "order");
        return all.filter((c) => !c.is_deleted).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      } catch (error) {
        console.error("Failed to load chapters:", error);
        return [];
      }
    },
    staleTime: 60000,
    gcTime: 300000,
  });

  const { data: plotEvents = [] } = useQuery({
    queryKey: ["plotEvents", selectedSeasonTab],
    queryFn: async () => {
      const all = await base44.entities.PlotEvent.filter({ novel_id: selectedSeasonTab }, "order");
      return all.filter((e) => !e.is_deleted);
    },
    staleTime: 60000,
    gcTime: 300000,
  });

  // รีวิวทั้งหมด — เพื่อแสดงสัญลักษณ์ในรายการตอน
  const { data: allReviews = [] } = useQuery({
    queryKey: ["reviews-all", novelId],
    queryFn: async () => {
      if (chapters.length === 0) return [];
      const chapterIds = chapters.map((c) => c.id);
      const reviewsList = await Promise.all(
        chapterIds.map((id) => base44.entities.Review.filter({ chapter_id: id }))
      );
      return reviewsList.flat();
    },
    enabled: chapters.length > 0,
  });

  // sets ของ chapter id แยกตามประเภทรีวิว
  const chaptersWithReaderReviews = new Set(
    allReviews.filter((r) => r.reviewer_type === "นักอ่าน").map((r) => r.chapter_id)
  );
  const chaptersWithEditorReviews = new Set(
    allReviews.filter((r) => r.reviewer_type === "บรรณาธิการ AI").map((r) => r.chapter_id)
  );

  const createChapter = useMutation({
    mutationFn: (data) => base44.entities.Chapter.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chapters", selectedSeasonTab] });
      setNewChapterOpen(false);
      setNewTitle("");
      setSelectedPlotEventId("");
    },
  });

  const deleteChapter = useMutation({
    mutationFn: (id) => base44.entities.Chapter.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chapters", selectedSeasonTab] });
      setSelectedChapter(null);
    },
  });

  const deleteSeason = useMutation({
    mutationFn: async () => {
      // ตรวจสอบว่าเป็น Season 1 (novel หลัก) หรือไม่
      const isSeason1 = String(selectedSeasonTab) === String(novelId);
      
      if (isSeason1) {
        // ไม่อนุญาตให้ลบ Season 1
        toast.error("ไม่สามารถลบ Season หลักได้");
        return;
      }
      
      // Soft delete Season
      await base44.entities.Novel.update(selectedSeasonTab, { is_deleted: true, deleted_at: new Date().toISOString() });
      // Soft delete chapters ทั้งหมดใน Season นี้
      const chapters = await base44.entities.Chapter.filter({ novel_id: selectedSeasonTab });
      await Promise.all(
        chapters.map((ch) => base44.entities.Chapter.update(ch.id, { is_deleted: true }))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seasons", novelId] });
      queryClient.invalidateQueries({ queryKey: ["chapters", selectedSeasonTab] });
      toast.success("ลบ Season แล้ว (สามารถกู้คืนจากถังขยะได้)");
      setDeleteSeasonDialogOpen(false);
      // กลับไป Season 1
      const remainingSeasons = seasons.filter((s) => String(s.id) !== String(selectedSeasonTab));
      if (remainingSeasons.length > 0) {
        window.location.href = `/novel/${remainingSeasons[0].id}`;
      }
    },
  });

  const updateChapterStatus = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Chapter.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chapters", selectedSeasonTab] });
    },
  });

  const statuses = ["ร่าง", "เขียนเสร็จ", "เผยแพร่"];

  const handleDragEnd = async (result) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    const reordered = Array.from(chapters);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    // อัปเดต order ใหม่ทุกตอนที่เปลี่ยน
    const updates = reordered
      .map((ch, idx) => ({ ch, newOrder: idx + 1 }))
      .filter(({ ch, newOrder }) => ch.order !== newOrder);
    await Promise.all(
      updates.map(({ ch, newOrder }) =>
        base44.entities.Chapter.update(ch.id, { order: newOrder })
      )
    );
    queryClient.invalidateQueries({ queryKey: ["chapters", selectedSeasonTab] });
  };

  if (selectedChapter) {
    return (
      <ErrorBoundary onRetry={() => setSelectedChapter(null)}>
        <ChapterEditor
          chapter={selectedChapter}
          novelId={selectedSeasonTab}
          novel={selectedSeasonNovel || novel}
          onBack={() => setSelectedChapter(null)}
        />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary onRetry={() => window.location.reload()}>
    <>
    <ExportDialog open={exportOpen} onOpenChange={setExportOpen} novel={selectedSeasonNovel || novel} chapters={chapters} />
    <AiChapterGeneratorDialog
      open={aiChapterGeneratorOpen}
      onClose={() => {
        setAiChapterGeneratorOpen(false);
        queryClient.invalidateQueries({ queryKey: ["chapters", selectedSeasonTab] });
      }}
      novel={selectedSeasonNovel || novel}
      novelId={selectedSeasonTab}
    />
    <BulkAutoWriteDialog
      open={bulkAutoWriteOpen}
      onClose={() => {
        setBulkAutoWriteOpen(false);
        queryClient.invalidateQueries({ queryKey: ["chapters", selectedSeasonTab] });
      }}
      novel={selectedSeasonNovel || novel}
      novelId={selectedSeasonTab}
    />
    {draftChapter && (
    <AiDraftDialog
      open={aiDraftOpen}
      onClose={() => { setAiDraftOpen(false); setDraftChapter(null); }}
      chapter={draftChapter}
      novel={selectedSeasonNovel || novel}
      novelId={selectedSeasonTab}
      onInsert={(content) => {
        const chapterToOpen = { ...draftChapter, content };
        setAiDraftOpen(false);
        setTimeout(() => {
          setDraftChapter(null);
          setSelectedChapter(chapterToOpen);
        }, 0);
        toast.success("เปิด editor พร้อมร่างที่ AI สร้างแล้ว");
      }}
    />
    )}
    <SeasonSelectorDialog
      open={seasonSelectorOpen}
      onClose={() => {
        setSeasonSelectorOpen(false);
        queryClient.invalidateQueries({ queryKey: ["seasons", novelId] });
      }}
      novel={selectedSeasonNovel || novel}
      onSeasonChange={(season) => {
        window.location.href = `/novel/${season.id}`;
      }}
      step={0}
    />
    <NovelSpellCheckSummary
      open={spellCheckSummaryOpen}
      onClose={() => setSpellCheckSummaryOpen(false)}
      novelId={selectedSeasonTab}
      novel={selectedSeasonNovel || novel}
    />
    
    {/* Delete Season Confirmation Dialog */}
    <AlertDialog open={deleteSeasonDialogOpen} onOpenChange={setDeleteSeasonDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading flex items-center gap-2">
            <Layers2 className="w-5 h-5 text-destructive" />
            ยืนยันการลบ Season
          </AlertDialogTitle>
          <AlertDialogDescription>
            {String(selectedSeasonTab) === String(novelId) ? (
              <>
                <strong className="text-destructive">ไม่สามารถลบ Season หลักได้</strong>
                <br />
                Season 1 เป็น Season หลักของนิยาย ไม่สามารถลบได้
              </>
            ) : (
              <>
                คุณต้องการลบ Season นี้และตอนทั้งหมดใน Season นี้ใช่หรือไม่?
                <br /><br />
                การลบจะ<strong>ซ่อน</strong> Season นี้และตอนทั้งหมด (สามารถกู้คืนจากถังขยะได้)
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
          {String(selectedSeasonTab) !== String(novelId) && (
            <AlertDialogAction
              onClick={() => deleteSeason.mutate()}
              disabled={deleteSeason.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSeason.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />กำลังลบ...</> : "ลบ Season"}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header Card */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-6 shadow-sm">
        {/* Season Tabs & Management */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="flex items-center gap-1.5 bg-secondary/50 p-1 rounded-xl flex-1">
              {seasons.length > 1 ? (
                seasons.map((season, idx) => (
                  <div key={season.id} className="flex items-center gap-1">
                    <button
                      onClick={() => setSelectedSeasonTab(season.id)}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-all font-medium ${
                        String(selectedSeasonTab) === String(season.id)
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      <span className="text-primary/70 mr-1.5">#{idx + 1}</span>
                      {season.title}
                    </button>
                    {String(season.id) !== String(novelId) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSeasonTab(season.id);
                          setDeleteSeasonDialogOpen(true);
                        }}
                        className="w-6 h-6 rounded-md hover:bg-destructive/10 text-destructive flex items-center justify-center transition-all"
                        title="ลบ Season นี้"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="px-3 py-1.5 text-sm text-muted-foreground">
                  <span className="text-primary/70 mr-1.5">#1</span>
                  {novel?.title}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Title, Stats & Main Actions */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-xl font-bold text-foreground mb-1">ห้องเขียน</h2>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-primary">{chapters.length}</span> ตอน · 
              <span className="font-semibold text-primary ml-1">{chapters.reduce((acc, c) => acc + (c.word_count || 0), 0).toLocaleString()}</span> คำ
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="gap-1.5 h-9" onClick={() => setNewChapterOpen(true)}>
              <Plus className="w-4 h-4" />
              ตอนใหม่
            </Button>
            <div className="flex items-center gap-1.5 border-l border-border pl-3 ml-1">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-9 text-purple-700 border-purple-300 hover:bg-purple-50 dark:text-purple-400 dark:border-purple-800/40 dark:hover:bg-purple-950/20"
                onClick={() => setSeasonSelectorOpen(true)}
              >
                <Layers className="w-4 h-4" />
                เพิ่ม Season
              </Button>
              {seasons.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-9 text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => setDeleteSeasonDialogOpen(true)}
                  title="ลบ Season นี้"
                >
                  <Trash2 className="w-4 h-4" />
                  ลบ Season
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar - AI Tools & Actions */}
      <div className="bg-gradient-to-r from-secondary/50 to-secondary/30 border border-border rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            {/* AI Writing Group */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 mr-1 px-2 py-1.5 bg-primary/10 rounded-lg">
                <Wand2 className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary">AI เขียน</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-9 text-primary/70 border-primary/20 hover:bg-primary/5"
                onClick={() => setAiChapterGeneratorOpen(true)}
              >
                <Sparkles className="w-4 h-4" />
                สร้างตอน
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={`gap-1.5 h-9 text-violet-600 border-violet-200 hover:bg-violet-50 dark:text-violet-400 dark:border-violet-800/40 dark:hover:bg-violet-950/20 ${isBulkWriting ? "opacity-50 cursor-not-allowed" : ""}`}
                onClick={() => setBulkAutoWriteOpen(true)}
                disabled={isBulkWriting}
                title={isBulkWriting ? "กำลังสร้างตอน... กรุณารอจนเสร็จ" : "สร้างตอนทั้งหมดอัตโนมัติ"}
              >
                <Sparkles className="w-4 h-4" />
                สร้างตอนทั้งหมด
              </Button>
            </div>

            {/* Divider */}
            <div className="w-px h-6 bg-border" />

            {/* AI Tools Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-9 text-blue-700 border-blue-300 hover:bg-blue-50"
                >
                  <Wand2 className="w-4 h-4" />
                  เครื่องมือ AI
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem
                  onClick={() => setSpellCheckSummaryOpen(true)}
                  className="gap-2"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  ตรวจคำผิด
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setAiChapterGeneratorOpen(true)}
                  className="gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  สร้างตอนด้วย AI
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setBulkAutoWriteOpen(true)}
                  disabled={isBulkWriting}
                  className="gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  สร้างตอนทั้งหมด
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setExportOpen(true)}
                  className="gap-2"
                >
                  <Download className="w-3.5 h-3.5" />
                  ส่งออกไฟล์
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Quick Export */}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-9 text-muted-foreground"
              onClick={() => setExportOpen(true)}
            >
              <Download className="w-4 h-4" />
              ส่งออก
            </Button>
          </div>
        </div>

      <Dialog open={newChapterOpen} onOpenChange={setNewChapterOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">สร้างตอนใหม่</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <Input
              placeholder="ชื่อตอน"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            {plotEvents.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-1.5 block flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  อิงเหตุการณ์จากไทม์ไลน์ (ไม่บังคับ)
                </label>
                <Select value={selectedPlotEventId} onValueChange={setSelectedPlotEventId}>
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
                {selectedPlotEventId && (() => {
                  const ev = plotEvents.find((e) => e.id === selectedPlotEventId);
                  return ev?.description ? (
                    <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 bg-muted/40 rounded-lg px-3 py-2">{ev.description}</p>
                  ) : null;
                })()}
              </div>
            )}
            <Button
              className="w-full"
              onClick={() => {
                const ev = plotEvents.find((e) => e.id === selectedPlotEventId);
                createChapter.mutate({
                  novel_id: selectedSeasonTab,
                  title: newTitle,
                  order: chapters.length + 1,
                  status: "ร่าง",
                  content: "",
                  word_count: 0,
                  plot_event_id: ev?.id || "",
                  plot_event_title: ev?.title || "",
                  plot_event_description: ev?.description || "",
                  plot_event_order: ev?.order || null,
                });
              }}
              disabled={!newTitle.trim() || createChapter.isPending}
              title={!newTitle.trim() ? "กรุณากรอกชื่อตอน" : ""}
            >
              {createChapter.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />กำลังสร้าง...</> : "สร้างตอน"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : chapters.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">ยังไม่มีตอน เริ่มเขียนตอนแรกเลย!</p>
          <Button onClick={() => setNewChapterOpen(true)} size="sm" className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            สร้างตอนแรก
          </Button>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="chapters">
          {(provided) => (
          <div className="space-y-2" ref={provided.innerRef} {...provided.droppableProps}>
            {chapters.map((ch, i) => (
              <Draggable key={ch.id} draggableId={ch.id} index={i}>
                {(drag, snapshot) => (
              <div
                ref={drag.innerRef}
                {...drag.draggableProps}
                className={`group flex items-center gap-4 px-5 py-4 rounded-2xl border bg-card/60 hover:border-primary/30 hover:bg-card hover:shadow-sm cursor-pointer transition-all duration-200 ${snapshot.isDragging ? "border-primary/50 shadow-lg ring-2 ring-primary/20 bg-card" : "border-border/50"}`}
                onClick={() => setSelectedChapter(ch)}
              >
                {/* Drag Handle */}
                <div
                  {...drag.dragHandleProps}
                  onClick={(e) => e.stopPropagation()}
                  className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0 -ml-1"
                  title="ลากเพื่อจัดลำดับ"
                >
                  <GripVertical className="w-4 h-4" />
                </div>
                
                {/* Chapter Number Badge */}
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center text-sm font-bold text-primary shrink-0 border border-primary/15">
                  {ch.order || i + 1}
                </div>
                
                {/* Title & Stats */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[15px] truncate text-foreground">{ch.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <span className="font-medium text-primary/70">{(ch.word_count || 0).toLocaleString()}</span> คำ
                    </span>
                    {(selectedSeasonNovel || novel)?.word_count_target && (
                      <span className={`flex items-center gap-1 ${
                        (ch.word_count || 0) >= (selectedSeasonNovel || novel).word_count_target * 0.9
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-amber-600 dark:text-amber-400"
                      }`}>
                        <span className="text-xs">({Math.round(((ch.word_count || 0) / (selectedSeasonNovel || novel).word_count_target) * 100)}% ของเป้าหมาย)</span>
                      </span>
                    )}
                  </p>
                </div>

                {/* ปุ่มร่างด้วย AI — แสดงตลอดเวลา */}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-8 text-primary/70 border-primary/20 hover:bg-primary/5 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDraftChapter(ch);
                    setAiDraftOpen(true);
                  }}
                  title="ร่างด้วย AI"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  ร่างด้วย AI
                </Button>
                {/* Action Buttons - Show on Hover */}
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                  {chaptersWithReaderReviews.has(ch.id) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 h-8 text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-800/40 dark:hover:bg-green-950/20"
                      onClick={(e) => { e.stopPropagation(); setSelectedChapter(ch); }}
                      title="แก้ตามรีวิวนักอ่าน"
                    >
                      <Users className="w-3.5 h-3.5" />
                      แก้ตามนักอ่าน
                    </Button>
                  )}
                  {chaptersWithEditorReviews.has(ch.id) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 h-8 text-red-700 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-800/40 dark:hover:bg-red-950/20"
                      onClick={(e) => { e.stopPropagation(); setSelectedChapter(ch); }}
                      title="แก้ตามรีวิวบรรณาธิการ"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      แก้ตามบรรณาธิการ
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-secondary/60"
                        onClick={(e) => e.stopPropagation()}
                        title="เพิ่มเติม"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onClick={() => downloadChapterTxt(ch.title, ch.content)}>
                        <Download className="w-3.5 h-3.5 mr-2" />
                        ดาวน์โหลด .txt
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => downloadChapterMd(ch.title, ch.content)}>
                        <Download className="w-3.5 h-3.5 mr-2" />
                        ดาวน์โหลด .md
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={async () => {
                          await copyChapterToClipboard(ch.title, ch.content);
                          toast.success("คัดลอกแล้ว");
                        }}
                      >
                        <Copy className="w-3.5 h-3.5 mr-2" />
                        คัดลอกทั้งตอน
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => deleteChapter.mutate(ch.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-2" />
                        ลบตอนนี้
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
          )}
        </Droppable>
        </DragDropContext>
      )}
    </div>
    <div className="fixed bottom-4 right-4 z-50">
      {selectedChapter && (
        <ContinuityChecker
          novelId={selectedSeasonTab}
          chapter={selectedChapter}
        />
      )}
    </div>
    </>
    </ErrorBoundary>
  );
}