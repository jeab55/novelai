import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Layers, ChevronDown, ChevronUp, MoreVertical, ImagePlus, FolderOpen, BookMarked, FolderPlus, ArrowRightLeft, ArrowUp, ArrowDown, BookPlus, Plus } from "lucide-react";
import ImportNovelDialog from "@/components/novel/ImportNovelDialog";
import SeriesFormDialog from "@/components/series/SeriesFormDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/lib/AuthContext";
import ReaderDialog from "@/components/reader/ReaderDialog";
import { toast } from "sonner";

const genreColors = {
  "โรแมนติก": "from-pink-400 to-rose-500",
  "แฟนตาซี": "from-purple-400 to-indigo-500",
  "อิงประวัติศาสตร์": "from-amber-400 to-orange-500",
  "จีนย้อนยุค": "from-red-400 to-rose-600",
  "วาย": "from-sky-400 to-blue-500",
  "สยองขวัญ": "from-slate-500 to-gray-700",
  "ลึกลับ": "from-indigo-400 to-violet-600",
  "แอ็คชั่น": "from-orange-400 to-red-500",
  "ดราม่า": "from-teal-400 to-cyan-600",
  "อื่นๆ": "from-gray-400 to-slate-500",
};



function NovelCard({ novel, chapters, uploadingFor, onUploadClick, seriesList, onMoveToSeries, onMoveChapter, onReorderChapter }) {
  const [isOpen, setIsOpen] = useState(false);
  const [readerStartIdx, setReaderStartIdx] = useState(null);
  const gradient = genreColors[novel.genre] || "from-gray-400 to-slate-500";
  const novelChapters = chapters
    .filter((c) => String(c.novel_id) === String(novel.id) && !c.is_deleted)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const totalWords = novelChapters.reduce((sum, c) => sum + (c.word_count || 0), 0);

  return (
    <>
      <div
        className={`bg-card border rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer flex flex-col ${
          isOpen ? "border-primary/50 ring-2 ring-primary/20 shadow-lg" : "border-border/60 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/25"
        }`}
        onClick={() => setIsOpen((v) => !v)}
      >
        {/* Cover */}
        <div className="relative h-52 overflow-hidden">
          {novel.cover_url ? (
            <img src={novel.cover_url} alt={novel.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
              <BookOpen className="w-14 h-14 text-white/50" />
            </div>
          )}

          {/* overlay gradient for readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          {/* 3-dot menu */}
          <div className="absolute top-2 left-2" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-7 h-7 rounded-lg bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors">
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => onUploadClick(novel.id)}>
                  <ImagePlus className="w-4 h-4" />
                  {uploadingFor === novel.id ? "กำลังอัปโหลด..." : "เปลี่ยนรูปปก"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => onMoveToSeries(novel)}>
                  <FolderPlus className="w-4 h-4" />
                  ใส่ในซีรีย์ / ตอนที่
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Bottom info on cover */}
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
            <h3 className="font-heading font-bold text-white text-base leading-tight line-clamp-2 drop-shadow">{novel.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              {novel.genre && (
                <span className="text-xs text-white/80">{novel.genre}</span>
              )}
              <span className="text-white/40 text-xs">·</span>
              <span className="text-xs text-white/80">{novelChapters.length} ตอน</span>
            </div>
          </div>
        </div>

        {/* Synopsis + stats */}
        <div className="px-4 py-3 flex flex-col flex-1">
          {novel.synopsis && !isOpen && (
            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{novel.synopsis}</p>
          )}
          <div className="mt-auto pt-3 flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <BookMarked className="w-3 h-3" />
              <span>{totalWords > 0 ? `${totalWords.toLocaleString()} คำ` : "ยังไม่มีเนื้อหา"}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-xs font-normal h-5 px-1.5">{novel.status || "กำลังเขียน"}</Badge>
              {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </div>
          </div>
        </div>

        {/* Chapter list for reading */}
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              key="chaps"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeInOut" }}
              className="overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-t border-border/40 px-4 pb-4 pt-2 space-y-1 bg-muted/20">
                {novelChapters.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">ยังไม่มีตอน</p>
                ) : (
                  novelChapters.map((ch, chIdx) => (
                    <div key={ch.id} className="flex items-center gap-1 group/row">
                      <button
                        onClick={() => setReaderStartIdx(chIdx)}
                        className="flex-1 flex items-center gap-2.5 px-2 py-2.5 rounded-lg hover:bg-accent/70 transition-colors text-left group min-w-0"
                      >
                        <span className="w-6 h-6 rounded-md bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                          {ch.order || chIdx + 1}
                        </span>
                        <span className="flex-1 text-sm truncate group-hover:text-primary transition-colors">{ch.title}</span>
                        {ch.word_count > 0 && (
                          <span className="text-xs text-muted-foreground shrink-0">{ch.word_count.toLocaleString()} คำ</span>
                        )}
                        <BookOpen className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                      </button>
                      <div className="opacity-0 group-hover/row:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={() => onReorderChapter(ch, novelChapters, "up")}
                          disabled={chIdx === 0}
                          title="เลื่อนขึ้น"
                          className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary disabled:opacity-30 disabled:pointer-events-none"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => onReorderChapter(ch, novelChapters, "down")}
                          disabled={chIdx === novelChapters.length - 1}
                          title="เลื่อนลง"
                          className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary disabled:opacity-30 disabled:pointer-events-none"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => onMoveChapter(ch)}
                          title="ย้ายตอนนี้ไปนิยายเรื่องอื่น"
                          className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {readerStartIdx !== null && (
        <ReaderDialog chapters={novelChapters} initialIndex={readerStartIdx} onClose={() => setReaderStartIdx(null)} />
      )}
    </>
  );
}

export default function SeriesDashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const queryClient = useQueryClient();
  const coverInputRef = useRef(null);
  const [uploadingFor, setUploadingFor] = useState(null);
  const [seriesDialog, setSeriesDialog] = useState({ open: false, novel: null, selectedSeries: "", episodeNumber: "" });
  const [moveChapterDialog, setMoveChapterDialog] = useState({ open: false, chapter: null, targetNovelId: "" });
  const [importOpen, setImportOpen] = useState(false);
  const [createSeriesOpen, setCreateSeriesOpen] = useState(false);

  const updateNovelMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Novel.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["novels-for-series"] });
    },
  });

  const { data: novels = [], isLoading } = useQuery({
    queryKey: ["novels-for-series", user?.id],
    queryFn: async () => {
      const all = await base44.entities.Novel.list("-created_date");
      return all.filter((n) => {
        if (n.is_deleted) return false;
        if (isAdmin) return true;
        if (String(n.created_by_id) === String(user?.id)) return true;
        if (Array.isArray(n.shared_with) && n.shared_with.includes(user?.email)) return true;
        return false;
      });
    },
    enabled: !!user,
  });

  const { data: seriesList = [] } = useQuery({
    queryKey: ["series-list"],
    queryFn: () => base44.entities.Series.list(),
  });

  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters-all"],
    queryFn: () => base44.entities.Chapter.list(),
  });

  const handleCoverUpload = async (novelId, file) => {
    if (!file) return;
    setUploadingFor(novelId);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.Novel.update(novelId, { cover_url: file_url });
    queryClient.invalidateQueries({ queryKey: ["novels-for-series"] });
    setUploadingFor(null);
  };

  const handleUploadClick = (novelId) => {
    coverInputRef.current.dataset.novelid = novelId;
    coverInputRef.current.click();
  };

  const handleMoveToSeries = (novel) => {
    setSeriesDialog({ open: true, novel, selectedSeries: novel.series_id || "__none__", episodeNumber: novel.episode_number?.toString() || "" });
  };

  const updateChapterMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Chapter.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chapters-all"] });
    },
  });

  const handleReorderChapter = async (chapter, novelChapters, direction) => {
    const sorted = [...novelChapters].sort((a, b) => (a.order || 0) - (b.order || 0));
    const idx = sorted.findIndex((c) => c.id === chapter.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const swapWith = sorted[swapIdx];
    const orderA = chapter.order || idx + 1;
    const orderB = swapWith.order || swapIdx + 1;
    await Promise.all([
      updateChapterMutation.mutateAsync({ id: chapter.id, data: { order: orderB } }),
      updateChapterMutation.mutateAsync({ id: swapWith.id, data: { order: orderA } }),
    ]);
  };

  const handleMoveChapter = (chapter) => {
    setMoveChapterDialog({ open: true, chapter, targetNovelId: "" });
  };

  const confirmMoveChapter = async () => {
    if (!moveChapterDialog.targetNovelId) return;
    const targetChapters = chapters.filter(
      (c) => String(c.novel_id) === String(moveChapterDialog.targetNovelId) && !c.is_deleted
    );
    const maxOrder = targetChapters.reduce((max, c) => Math.max(max, c.order || 0), 0);
    await updateChapterMutation.mutateAsync({
      id: moveChapterDialog.chapter.id,
      data: { novel_id: moveChapterDialog.targetNovelId, order: maxOrder + 1 },
    });
    toast.success(`ย้ายตอน "${moveChapterDialog.chapter.title}" เรียบร้อยแล้ว`);
    setMoveChapterDialog({ open: false, chapter: null, targetNovelId: "" });
  };

  const confirmMoveSeries = async () => {
    const seriesId = seriesDialog.selectedSeries === "__none__" ? "" : seriesDialog.selectedSeries;
    const epNum = seriesDialog.episodeNumber ? Number(seriesDialog.episodeNumber) : undefined;
    const data = { series_id: seriesId };
    if (epNum) data.episode_number = epNum;
    await updateNovelMutation.mutateAsync({ id: seriesDialog.novel.id, data });
    toast.success("อัปเดตซีรีย์เรียบร้อยแล้ว");
    setSeriesDialog({ open: false, novel: null, selectedSeries: "", episodeNumber: "" });
  };

  const novelsInSeries = novels.filter((n) => n.series_id);
  const novelsWithoutSeries = novels.filter((n) => !n.series_id);

  const novelsBySeries = seriesList
    .map((s) => ({
      series: s,
      novels: novelsInSeries.filter((n) => String(n.series_id) === String(s.id)),
    }))
    .filter((g) => g.novels.length > 0);

  return (
    <>
    {/* Move to Series Dialog */}
    <Dialog open={seriesDialog.open} onOpenChange={(v) => !v && setSeriesDialog({ open: false, novel: null, selectedSeries: "", episodeNumber: "" })}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading">ใส่ในซีรีย์</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mb-3">กำหนดตำแหน่งของ <span className="font-medium text-foreground">"{seriesDialog.novel?.title}"</span></p>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1.5 block">ซีรีย์</label>
            <Select value={seriesDialog.selectedSeries} onValueChange={(v) => setSeriesDialog((d) => ({ ...d, selectedSeries: v }))}>
              <SelectTrigger><SelectValue placeholder="เลือกซีรีย์" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— ไม่ระบุซีรีย์ —</SelectItem>
                {seriesList.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">ตอนที่ <span className="text-muted-foreground font-normal">(เช่น 1, 2, 3...)</span></label>
            <input
              type="number"
              min="1"
              placeholder="ระบุตอนที่ในซีรีย์"
              value={seriesDialog.episodeNumber}
              onChange={(e) => setSeriesDialog((d) => ({ ...d, episodeNumber: e.target.value }))}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" className="flex-1" onClick={() => setSeriesDialog({ open: false, novel: null, selectedSeries: "", episodeNumber: "" })}>ยกเลิก</Button>
          <Button className="flex-1" onClick={confirmMoveSeries} disabled={updateNovelMutation.isPending}>บันทึก</Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Move Chapter Dialog */}
    <Dialog open={moveChapterDialog.open} onOpenChange={(v) => !v && setMoveChapterDialog({ open: false, chapter: null, targetNovelId: "" })}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading">ย้ายตอนไปนิยายเรื่องอื่น</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mb-3">
          ย้าย <span className="font-medium text-foreground">"{moveChapterDialog.chapter?.title}"</span> ไปไว้ในนิยาย:
        </p>
        <Select value={moveChapterDialog.targetNovelId} onValueChange={(v) => setMoveChapterDialog((d) => ({ ...d, targetNovelId: v }))}>
          <SelectTrigger><SelectValue placeholder="เลือกนิยายปลายทาง" /></SelectTrigger>
          <SelectContent>
            {novels
              .filter((n) => String(n.id) !== String(moveChapterDialog.chapter?.novel_id))
              .map((n) => (
                <SelectItem key={n.id} value={n.id}>{n.title}</SelectItem>
              ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" className="flex-1" onClick={() => setMoveChapterDialog({ open: false, chapter: null, targetNovelId: "" })}>ยกเลิก</Button>
          <Button className="flex-1" onClick={confirmMoveChapter} disabled={!moveChapterDialog.targetNovelId || updateChapterMutation.isPending}>ย้าย</Button>
        </div>
      </DialogContent>
    </Dialog>

    <AppLayout>
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-heading font-bold text-2xl text-foreground tracking-tight">ห้องสมุดของฉัน</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {novels.length > 0 ? `${novels.length} เรื่อง · คลิกที่การ์ดเพื่อดูตอน` : "ยังไม่มีนิยาย"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button className="gap-2" variant="outline" onClick={() => setCreateSeriesOpen(true)}>
              <Plus className="w-4 h-4" />
              สร้างซีรีส์ใหม่
            </Button>
            <Button className="gap-2 bg-primary hover:bg-primary/90" onClick={() => setImportOpen(true)}>
              <BookPlus className="w-4 h-4" />
              นำเข้านิยายจากไฟล์
            </Button>
            <Link to="/">
              <Button variant="outline" className="gap-2">
                <BookOpen className="w-4 h-4" />
                จัดการนิยาย
              </Button>
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : novels.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-24">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/10 to-accent/30 flex items-center justify-center mx-auto mb-6 shadow-inner">
              <Layers className="w-12 h-12 text-primary/50" />
            </div>
            <h2 className="text-2xl font-heading font-semibold mb-3">ยังไม่มีนิยาย</h2>
            <p className="text-muted-foreground mb-8 max-w-sm mx-auto leading-relaxed">
              สร้างนิยายในหน้าหลักก่อน แล้วกลับมาอ่านที่นี่ได้เลย
            </p>
            <Link to="/">
              <Button className="gap-2 h-11 px-6 text-base shadow-sm">
                <BookOpen className="w-4 h-4" />
                ไปหน้านิยาย
              </Button>
            </Link>
          </motion.div>
        ) : (
          <div className="space-y-10">
            {novelsBySeries.map(({ series, novels: sNovels }, si) => (
              <motion.div key={series.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: si * 0.06 }}>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FolderOpen className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-lg text-foreground">{series.title}</h3>
                    {series.description && <p className="text-xs text-muted-foreground">{series.description}</p>}
                  </div>
                  <Badge variant="outline" className="ml-auto text-xs">{sNovels.length} เรื่อง</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {sNovels.map((novel) => (
                    <NovelCard key={novel.id} novel={novel} chapters={chapters} uploadingFor={uploadingFor} onUploadClick={handleUploadClick} seriesList={seriesList} onMoveToSeries={handleMoveToSeries} onMoveChapter={handleMoveChapter} onReorderChapter={handleReorderChapter} />
                  ))}
                </div>
              </motion.div>
            ))}

            {novelsWithoutSeries.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: novelsBySeries.length * 0.06 }}>
                {novelsBySeries.length > 0 && (
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                      <BookOpen className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <h3 className="font-heading font-bold text-lg text-foreground">ไม่ระบุซีรีย์</h3>
                    <Badge variant="outline" className="ml-auto text-xs">{novelsWithoutSeries.length} เรื่อง</Badge>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {novelsWithoutSeries.map((novel) => (
                    <NovelCard key={novel.id} novel={novel} chapters={chapters} uploadingFor={uploadingFor} onUploadClick={handleUploadClick} seriesList={seriesList} onMoveToSeries={handleMoveToSeries} onMoveChapter={handleMoveChapter} onReorderChapter={handleReorderChapter} />
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>

      <ImportNovelDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        novels={novels || []}
        seriesList={seriesList || []}
      />

      <SeriesFormDialog
        open={createSeriesOpen}
        onClose={() => setCreateSeriesOpen(false)}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["series-list"] });
          setCreateSeriesOpen(false);
        }}
      />

      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const novelId = e.target.dataset.novelid;
          if (file && novelId) handleCoverUpload(novelId, file);
          e.target.value = "";
        }}
      />
    </AppLayout>
    </>
  );
}