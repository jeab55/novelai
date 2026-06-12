import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, FileText, Loader2, Trash2, Download, Copy, MoreHorizontal, Clock, Sparkles } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";
import ChapterEditor from "./ChapterEditor";
import { downloadChapterTxt, downloadChapterMd, copyChapterToClipboard, downloadAllChaptersMd } from "@/utils/exportChapter";
import { toast } from "sonner";
import AiChapterGeneratorDialog from "./AiChapterGeneratorDialog";
import AiDraftDialog from "./AiDraftDialog";
import ContinuityChecker from "./ContinuityChecker";
import BulkAutoWriteDialog from "./BulkAutoWriteDialog";

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
  const queryClient = useQueryClient();

  // Handle chapter navigation from other tabs (e.g. AiPlotDialog draft)
  useEffect(() => {
    if (pendingOpenChapter) {
      setSelectedChapter(pendingOpenChapter);
      onPendingOpenChapterConsumed?.();
    }
  }, [pendingOpenChapter]);

  const { data: chapters = [], isLoading } = useQuery({
    queryKey: ["chapters", novelId],
    queryFn: async () => {
      const all = await base44.entities.Chapter.filter({ novel_id: novelId }, "order");
      return all.filter((c) => !c.is_deleted);
    },
    staleTime: 10000,
  });

  const { data: plotEvents = [] } = useQuery({
    queryKey: ["plotEvents", novelId],
    queryFn: async () => {
      const all = await base44.entities.PlotEvent.filter({ novel_id: novelId }, "order");
      return all.filter((e) => !e.is_deleted);
    },
  });

  const createChapter = useMutation({
    mutationFn: (data) => base44.entities.Chapter.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chapters", novelId] });
      setNewChapterOpen(false);
      setNewTitle("");
      setSelectedPlotEventId("");
    },
  });

  const deleteChapter = useMutation({
    mutationFn: (id) => base44.entities.Chapter.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chapters", novelId] });
      setSelectedChapter(null);
    },
  });

  if (selectedChapter) {
    return (
      <ChapterEditor
        chapter={selectedChapter}
        novelId={novelId}
        novel={novel}
        onBack={() => setSelectedChapter(null)}
      />
    );
  }

  return (
    <>
    <AiChapterGeneratorDialog
      open={aiChapterGeneratorOpen}
      onClose={() => setAiChapterGeneratorOpen(false)}
      novel={novel}
      novelId={novelId}
    />
    <BulkAutoWriteDialog
      open={bulkAutoWriteOpen}
      onClose={() => setBulkAutoWriteOpen(false)}
      novel={novel}
      novelId={novelId}
    />
    {draftChapter && (
      <AiDraftDialog
        open={aiDraftOpen}
        onClose={() => { setAiDraftOpen(false); setDraftChapter(null); }}
        chapter={draftChapter}
        novel={novel}
        novelId={novelId}
        onInsert={(content) => {
          const chapterToOpen = { ...draftChapter, content };
          // Close dialog first, then navigate — prevents state updates on unmounted component
          setAiDraftOpen(false);
          setTimeout(() => {
            setDraftChapter(null);
            setSelectedChapter(chapterToOpen);
          }, 0);
          toast.success("เปิด editor พร้อมร่างที่ AI สร้างแล้ว");
        }}
      />
    )}
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-heading text-lg font-semibold">ห้องเขียน</h2>
          <p className="text-sm text-muted-foreground">
            {chapters.length} ตอน · {chapters.reduce((acc, c) => acc + (c.word_count || 0), 0).toLocaleString()} คำ
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-primary/70 border-primary/20"
            onClick={() => setAiChapterGeneratorOpen(true)}
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI สร้างตอน
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-violet-600 border-violet-200 hover:bg-violet-50 dark:text-violet-400 dark:border-violet-800/40 dark:hover:bg-violet-950/20"
            onClick={() => setBulkAutoWriteOpen(true)}
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI สร้างตอนทั้งหมด
          </Button>
          {chapters.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              onClick={() => downloadAllChaptersMd(novel?.title || "novel", chapters)}
            >
              <Download className="w-3.5 h-3.5" />
              ส่งออกทั้งเรื่อง
            </Button>
          )}
          <Dialog open={newChapterOpen} onOpenChange={setNewChapterOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              ตอนใหม่
            </Button>
          </DialogTrigger>
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
                    novel_id: novelId,
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
                disabled={!newTitle || createChapter.isPending}
              >
                สร้างตอน
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

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
        <div className="space-y-2">
          <AnimatePresence>
            {chapters.map((ch, i) => (
              <motion.div
                key={ch.id}
                layout
                className="group flex items-center gap-4 px-5 py-4 rounded-2xl border border-border/50 bg-card/60 hover:border-primary/30 hover:bg-card hover:shadow-sm cursor-pointer transition-all duration-200"
                onClick={() => setSelectedChapter(ch)}
              >
                {/* ลำดับตอน */}
                <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
                  {ch.order || i + 1}
                </div>
                {/* ชื่อ + คำ */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[15px] truncate text-foreground">{ch.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                    <span className="font-medium text-primary/70">{(ch.word_count || 0).toLocaleString()}</span> คำ
                    {novel?.word_count_target && (
                      <span className={`text-xs ${
                        (ch.word_count || 0) >= novel.word_count_target * 0.9
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-amber-600 dark:text-amber-400"
                      }`}>
                        ({Math.round(((ch.word_count || 0) / novel.word_count_target) * 100)}% ของ {novel.word_count_target.toLocaleString()} คำ)
                      </span>
                    )}
                  </p>
                </div>
                <Badge className={`${statusColors[ch.status] || statusColors["ร่าง"]} text-xs font-medium px-2.5 py-0.5 rounded-full`}>
                  {ch.status || "ร่าง"}
                </Badge>
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-8 text-primary/70 border-primary/20 hover:bg-primary/5"
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-secondary/60"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onClick={() => downloadChapterTxt(ch.title, ch.content)}>
                        <Download className="w-3.5 h-3.5 mr-2" />
                        ดาวน์โหลดเป็น .txt
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => downloadChapterMd(ch.title, ch.content)}>
                        <Download className="w-3.5 h-3.5 mr-2" />
                        ดาวน์โหลดเป็น .md
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
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
    <div className="fixed bottom-4 right-4 z-50">
      {selectedChapter && (
        <ContinuityChecker
          novelId={novelId}
          chapter={selectedChapter}
        />
      )}
    </div>
    </>
  );
}