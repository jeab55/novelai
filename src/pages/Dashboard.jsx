import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, BookOpen, Pencil, Trash2, Share2, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import DeleteNovelDialog from "@/components/novel/DeleteNovelDialog";
import CreateNovelWizard from "@/components/novel/CreateNovelWizard";
import ShortStoryCreatorDialog from "@/components/novel/ShortStoryCreatorDialog";
import ShareNovelDialog from "@/components/novel/ShareNovelDialog";
import BlurbPicker from "@/components/novel/BlurbPicker";
import { useBlurbDrafter } from "@/hooks/useBlurbDrafter";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { useBulkWrite } from "@/lib/BulkWriteContext";
import AppLayout from "@/components/AppLayout";

const GENRES = ["โรแมนติก", "แฟนตาซี", "อิงประวัติศาสตร์", "จีนย้อนยุค", "วาย", "สยองขวัญ", "ลึกลับ", "แอ็คชั่น", "ดราม่า", "อื่นๆ"];

const genreColors = {
  "โรแมนติก": "bg-pink-100 text-pink-700",
  "แฟนตาซี": "bg-purple-100 text-purple-700",
  "อิงประวัติศาสตร์": "bg-amber-100 text-amber-700",
  "จีนย้อนยุค": "bg-red-100 text-red-700",
  "วาย": "bg-sky-100 text-sky-700",
  "สยองขวัญ": "bg-slate-100 text-slate-700",
  "ลึกลับ": "bg-indigo-100 text-indigo-700",
  "แอ็คชั่น": "bg-orange-100 text-orange-700",
  "ดราม่า": "bg-teal-100 text-teal-700",
  "อื่นๆ": "bg-gray-100 text-gray-700",
};

export default function Dashboard() {
  const [open, setOpen] = useState(false);
  const [shortStoryOpen, setShortStoryOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editingNovel, setEditingNovel] = useState(null);
  const { drafting, blurbs, pickerOpen, draftFromPlot, closePicker } = useBlurbDrafter();
  const [deleteDialog, setDeleteDialog] = useState({ open: false, novel: null });
  const [shareDialog, setShareDialog] = useState({ open: false, novel: null });
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { jobs } = useBulkWrite();

  const { data: writers = [] } = useQuery({
    queryKey: ["writers"],
    queryFn: () => base44.entities.Writer.list(),
    staleTime: 0,
  });
  const activeWriters = writers.filter((w) => w.is_active !== false);

  const { data: seriesList = [] } = useQuery({
    queryKey: ["series-list"],
    queryFn: () => base44.entities.Series.list(),
  });

  const { data: allNovels = [] } = useQuery({
    queryKey: ["novels-all", user?.id],
    queryFn: async () => {
      const all = await base44.entities.Novel.list("-created_date");
      return all.filter((n) => {
        if (n.is_deleted) return false;
        // ซ่อนนิยายที่เป็น Season ภาคต่อ (มี parent_novel_id)
        if (n.parent_novel_id) return false;
        if (isAdmin) return true;
        if (String(n.created_by_id) === String(user?.id)) return true;
        if (Array.isArray(n.shared_with) && n.shared_with.includes(user?.email)) return true;
        return false;
      });
    },
    enabled: !!user,
  });

  // โหลด chapters ทั้งหมดเพื่อตรวจสอบว่ามีอย่างน้อย 1 ตอน
  const { data: allChapters = [] } = useQuery({
    queryKey: ["chapters-all"],
    queryFn: () => base44.entities.Chapter.list(),
  });

  // กรองนิยาย: แสดงนิยายทั้งหมด (ทุกสถานะ ไม่ว่าจะมีตอนหรือไม่)
  const novels = allNovels || [];

  const isLoading = !allNovels || !allChapters;

  const softDeleteMutation = useMutation({
    mutationFn: async (id) => {
      const deletedAt = new Date().toISOString();
      await base44.entities.Novel.update(id, { is_deleted: true, deleted_at: deletedAt });
      const [chapters, characters, plotEvents, worldEntries] = await Promise.all([
        base44.entities.Chapter.filter({ novel_id: id }),
        base44.entities.Character.filter({ novel_id: id }),
        base44.entities.PlotEvent.filter({ novel_id: id }),
        base44.entities.WorldEntry.filter({ novel_id: id }),
      ]);
      await Promise.all([
        ...chapters.map((c) => base44.entities.Chapter.update(c.id, { is_deleted: true })),
        ...characters.map((c) => base44.entities.Character.update(c.id, { is_deleted: true })),
        ...plotEvents.map((e) => base44.entities.PlotEvent.update(e.id, { is_deleted: true })),
        ...worldEntries.map((w) => base44.entities.WorldEntry.update(w.id, { is_deleted: true })),
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["novels"] });
      toast.success("ย้ายไปถังขยะแล้ว");
      setDeleteDialog({ open: false, novel: null });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Novel.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["novels"] });
      setEditOpen(false);
      setEditingId(null);
    },
  });

  const openEdit = (e, novel) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(novel.id);
    setEditingNovel(novel);
    setEditForm({
      title: novel.title,
      genre: novel.genre || "",
      synopsis: novel.synopsis || "",
      era: novel.era || "",
      status: novel.status || "กำลังเขียน",
      writer_id: novel.writer_id || "",
      target_chapters: novel.target_chapters || 10,
      series_id: novel.series_id || "",
    });
    setEditOpen(true);
  };

  const getWriterName = (writerId) => {
    if (!writerId) return null;
    return activeWriters.find((w) => w.id === writerId)?.name || null;
  };

  return (
    <>
      <DeleteNovelDialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, novel: null })}
        onConfirm={() => softDeleteMutation.mutate(deleteDialog.novel?.id)}
        novel={deleteDialog.novel}
        mode="delete"
        isPending={softDeleteMutation.isPending}
      />
      <ShareNovelDialog
        open={shareDialog.open}
        onClose={() => setShareDialog({ open: false, novel: null })}
        novel={shareDialog.novel}
      />
      <BlurbPicker
        open={pickerOpen}
        onClose={closePicker}
        blurbs={blurbs}
        onSelect={(b) => { setEditForm((f) => ({ ...f, synopsis: b })); closePicker(); }}
      />
      <ShortStoryCreatorDialog open={shortStoryOpen} onOpenChange={setShortStoryOpen} />
      <CreateNovelWizard
        open={open}
        onOpenChange={setOpen}
        activeWriters={activeWriters}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ["novels"] })}
      />

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg flex flex-col max-h-[85vh] p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/40 shrink-0">
            <DialogTitle className="font-heading text-lg">แก้ไขข้อมูลเรื่อง</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">ชื่อเรื่อง</label>
              <Input value={editForm.title || ""} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">แนวนิยาย</label>
              <Select value={editForm.genre || ""} onValueChange={(v) => setEditForm({ ...editForm, genre: v })}>
                <SelectTrigger><SelectValue placeholder="เลือกแนว" /></SelectTrigger>
                <SelectContent>
                  {GENRES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">ยุคสมัยและฉากหลัง</label>
              <Input value={editForm.era || ""} onChange={(e) => setEditForm({ ...editForm, era: e.target.value })} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium block">คำโปรย / เรื่องย่อ</label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 px-2"
                  onClick={() => draftFromPlot(editingNovel, { title: editForm.title, genre: editForm.genre, synopsis: editForm.synopsis, era: editForm.era })}
                  disabled={drafting}
                >
                  {drafting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  {drafting ? "กำลังร่าง..." : "✨ ร่างคำโปรยจากพล็อต"}
                </Button>
              </div>
              <Textarea rows={4} value={editForm.synopsis || ""} onChange={(e) => setEditForm({ ...editForm, synopsis: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">สถานะ</label>
              <Select value={editForm.status || "กำลังเขียน"} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="กำลังเขียน">กำลังเขียน</SelectItem>
                  <SelectItem value="เขียนเสร็จ">เขียนเสร็จ</SelectItem>
                  <SelectItem value="พักไว้ก่อน">พักไว้ก่อน</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">นักเขียน AI ประจำเรื่อง</label>
              <Select value={editForm.writer_id || ""} onValueChange={(v) => setEditForm({ ...editForm, writer_id: v })}>
                <SelectTrigger><SelectValue placeholder="เลือกนักเขียน AI" /></SelectTrigger>
                <SelectContent>
                  {activeWriters.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      <span className="font-medium">{w.name}</span>
                      {w.description && <span className="text-muted-foreground ml-1.5 text-xs">— {w.description}</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editForm.writer_id && (
                <p className="text-xs text-primary/60 mt-1">
                  โทน: {activeWriters.find((w) => w.id === editForm.writer_id)?.style || "-"}
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">ซีรีย์ (ถ้ามี)</label>
              <Select value={editForm.series_id || "__none__"} onValueChange={(v) => setEditForm({ ...editForm, series_id: v === "__none__" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="ไม่ระบุซีรีย์" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— ไม่ระบุซีรีย์ —</SelectItem>
                  {seriesList.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">จำนวนตอนที่ต้องการ</label>
              <Select value={(editForm.target_chapters || 10).toString()} onValueChange={(v) => setEditForm({ ...editForm, target_chapters: v })}>
                <SelectTrigger><SelectValue placeholder="เลือกจำนวนตอน" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 ตอน</SelectItem>
                  <SelectItem value="20">20 ตอน</SelectItem>
                  <SelectItem value="30">30 ตอน</SelectItem>
                  <SelectItem value="40">40 ตอน</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-border/40 shrink-0 bg-background">
            <Button
              className="w-full"
              onClick={() => updateMutation.mutate({ id: editingId, data: editForm })}
              disabled={!editForm.title?.trim() || updateMutation.isPending}
              title={!editForm.title?.trim() ? "กรุณากรอกชื่อเรื่อง" : ""}
            >
              {updateMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />กำลังบันทึก...</> : "บันทึกการเปลี่ยนแปลง"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AppLayout>
        <main className="max-w-6xl mx-auto px-6 py-10">
          {/* Header Section */}
          <div className="relative overflow-hidden bg-gradient-to-br from-amber-100/70 via-secondary/40 to-orange-100/50 border border-amber-200/50 rounded-3xl p-6 mb-8 shadow-sm">
            <div className="absolute -right-2 -top-3 text-6xl opacity-15 select-none pointer-events-none">🐱</div>
            <div className="absolute right-20 bottom-2 text-2xl opacity-20 select-none pointer-events-none">🐾</div>
            <div className="flex items-center justify-between relative">
              <div>
                <h2 className="font-heading font-bold text-2xl text-foreground tracking-tight mb-1 flex items-center gap-2">
                  <span className="text-2xl">🐾</span> ชั้นวางหนังสือ
                </h2>
                {novels.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-primary">{novels.length}</span> เรื่อง
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  className="gap-2 font-body border-sky-300 text-sky-700 hover:bg-sky-50 dark:text-sky-400 dark:border-sky-800/40 dark:hover:bg-sky-950/20" 
                  onClick={() => setShortStoryOpen(true)}
                >
                  <BookOpen className="w-4 h-4" />
                  เรื่องสั้น AI
                </Button>

                <Button className="gap-2 font-body shadow-md shadow-amber-500/20 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white border-0 rounded-full" onClick={() => setOpen(true)}>
                  <Plus className="w-4 h-4" />
                  สร้างเรื่องใหม่
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              แสดงนิยายทั้งหมดของคุณ
            </p>
          </div>

          {novels.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-24">
              <div className="w-28 h-28 rounded-[2rem] bg-gradient-to-br from-amber-200/70 to-orange-200/50 flex items-center justify-center mx-auto mb-6 shadow-inner text-6xl">
                🐱
              </div>
              <h2 className="text-2xl font-heading font-semibold mb-3">ชั้นวางยังว่างเปล่า</h2>
              <p className="text-muted-foreground mb-8 max-w-sm mx-auto leading-relaxed">เริ่มต้นเขียนนิยายเรื่องแรกของคุณ ทุกมหากาพย์ต้องเริ่มจากหน้าแรก 🐾</p>
              <Button onClick={() => setOpen(true)} className="gap-2 h-11 px-6 text-base shadow-md shadow-amber-500/20 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white border-0 rounded-full">
                <Plus className="w-4 h-4" />
                สร้างเรื่องใหม่
              </Button>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {novels.map((novel, i) => (
                <motion.div
                  key={novel.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="h-full"
                >
                  <Link to={`/novel/${novel.id}`} className="block h-full">
                    <div className="group relative bg-card border border-border/60 rounded-3xl overflow-hidden hover:shadow-xl hover:shadow-amber-500/10 hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer h-full flex flex-col">
                      {/* Top Gradient Bar */}
                      <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 to-orange-500" />

                      {/* Badges */}
                      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
                        {novel.novel_type === "เรื่องสั้น" && (
                          <div className="flex items-center gap-1 bg-sky-500/15 text-sky-700 dark:text-sky-300 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-sky-500/30 shadow-sm">
                            <BookOpen className="w-3 h-3 text-sky-500" />
                            เรื่องสั้น
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="p-5 flex flex-col flex-1">
                        {/* Quick Actions (hover) */}
                        <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                          <button 
                            onClick={(e) => openEdit(e, novel)} 
                            className="w-7 h-7 rounded-lg bg-background/95 shadow-sm border border-border/60 hover:bg-primary/10 hover:text-primary flex items-center justify-center transition-all" 
                            title="แก้ไขข้อมูลเรื่อง"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {(isAdmin || String(novel.created_by_id) === String(user?.id)) && (
                            <>
                              <button 
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShareDialog({ open: true, novel }); }} 
                                className="w-7 h-7 rounded-lg bg-background/95 shadow-sm border border-border/60 hover:bg-primary/10 hover:text-primary flex items-center justify-center transition-all" 
                                title="แชร์เรื่อง"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteDialog({ open: true, novel }); }} 
                                className="w-7 h-7 rounded-lg bg-background/95 shadow-sm border border-border/60 hover:bg-destructive/10 hover:text-destructive flex items-center justify-center transition-all" 
                                title="ย้ายไปถังขยะ"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>

                        {/* Genre Badge */}
                        {novel.genre && (
                          <Badge className={`${genreColors[novel.genre] || "bg-gray-100 text-gray-700"} text-xs font-semibold mb-3 w-fit shadow-sm`}>
                            {novel.genre}
                          </Badge>
                        )}

                        {/* Title */}
                        <h3 className="font-heading font-bold text-lg leading-tight group-hover:text-primary transition-colors mb-2 pr-20">
                          {novel.title}
                        </h3>

                        {/* Era */}
                        {novel.era && (
                          <p className="text-xs text-primary/65 mb-2.5 font-medium flex items-center gap-1.5">
                            <span className="text-sm">📍</span>{novel.era}
                          </p>
                        )}

                        {/* Synopsis */}
                        {novel.synopsis && (
                          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed flex-1 mb-4">
                            {novel.synopsis}
                          </p>
                        )}

                        {/* Footer */}
                        <div className="mt-auto pt-4 border-t border-border/40 flex items-center justify-between gap-3">
                          {novel.status === "เขียนเสร็จ" ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-500/30 shadow-sm">
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                              เขียนเสร็จ
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs font-normal">
                              {novel.status || "กำลังเขียน"}
                            </Badge>
                          )}
                          <div className="flex items-center gap-2 text-xs">
                            {getWriterName(novel.writer_id) && (
                              <span className="text-[11px] text-primary/60 font-medium bg-primary/6 border border-primary/15 px-2 py-1 rounded-full">
                                ✍️ {getWriterName(novel.writer_id)}
                              </span>
                            )}
                            <span className="text-muted-foreground">
                              {new Date(novel.created_date).toLocaleDateString("th-TH")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </main>
      </AppLayout>
    </>
  );
}