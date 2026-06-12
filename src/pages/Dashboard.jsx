import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, BookOpen, Feather, Pencil, LogOut, Trash2, Share2, Moon, Sun, CheckCircle2 } from "lucide-react";
import DeleteNovelDialog from "@/components/novel/DeleteNovelDialog";
import CreateNovelWizard from "@/components/novel/CreateNovelWizard";
import ShareNovelDialog from "@/components/novel/ShareNovelDialog";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { useBulkWrite } from "@/lib/BulkWriteContext";

const GENRES = ["โรแมนติก", "แฟนตาซี", "อิงประวัติศาสตร์", "จีนย้อนยุค", "วาย", "สยองขวัญ", "ลึกลับ", "แอ็คชั่น", "ดราม่า", "อื่นๆ"]; // used in editForm

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

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("novelai-dark");
    return saved === "true";
  });
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("novelai-dark", dark);
  }, [dark]);
  return [dark, setDark];
}

export default function Dashboard() {
  const [dark, setDark] = useDarkMode();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, novel: null });
  const [shareDialog, setShareDialog] = useState({ open: false, novel: null });
  const queryClient = useQueryClient();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "admin";
  const { jobs } = useBulkWrite();

  const { data: writers = [] } = useQuery({
    queryKey: ["writers"],
    queryFn: () => base44.entities.Writer.list(),
    staleTime: 0,
  });
  const activeWriters = writers.filter((w) => w.is_active !== false);

  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters-all"],
    queryFn: () => base44.entities.Chapter.list(),
    staleTime: 0,
  });

  const { data: novels = [], isLoading } = useQuery({
    queryKey: ["novels", user?.id],
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

  const softDeleteMutation = useMutation({
    mutationFn: async (id) => {
      const deletedAt = new Date().toISOString();
      await base44.entities.Novel.update(id, { is_deleted: true, deleted_at: deletedAt });
      // Mark all child records as deleted too (cascade soft delete)
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
    setEditForm({ 
      title: novel.title, 
      genre: novel.genre || "", 
      synopsis: novel.synopsis || "", 
      era: novel.era || "", 
      status: novel.status || "กำลังเขียน", 
      writer_id: novel.writer_id || "",
      target_chapters: novel.target_chapters || 10,
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/60 bg-card/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shadow-sm">
              <Feather className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-heading font-bold text-foreground tracking-tight">NovelAi</h1>
              <p className="text-xs text-muted-foreground">ผู้ช่วยแต่งนิยายอัจฉริยะ</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:block">{user?.full_name || user?.email}</span>
            <Button variant="ghost" size="icon" onClick={() => setDark((v) => !v)} title={dark ? "โหมดสว่าง" : "โหมดมืด"} className="text-muted-foreground hover:text-foreground">
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Link to="/trash">
              <Button variant="ghost" size="icon" title="ถังขยะ" className="text-muted-foreground hover:text-destructive">
                <Trash2 className="w-4 h-4" />
              </Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={() => logout()} title="ออกจากระบบ" className="text-muted-foreground hover:text-foreground">
              <LogOut className="w-4 h-4" />
            </Button>
            <Button className="gap-2 font-body" onClick={() => setOpen(true)}>
                <Plus className="w-4 h-4" />
                สร้างเรื่องใหม่
              </Button>
            <CreateNovelWizard
              open={open}
              onOpenChange={setOpen}
              activeWriters={activeWriters}
              onCreated={() => queryClient.invalidateQueries({ queryKey: ["novels"] })}
            />
          </div>
        </div>
      </header>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg flex flex-col max-h-[85vh] p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/40 shrink-0">
            <DialogTitle className="font-heading text-lg">แก้ไขข้อมูลเรื่อง</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">ชื่อเรื่อง</label>
              <Input
                value={editForm.title || ""}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">แนวนิยาย</label>
              <Select value={editForm.genre || ""} onValueChange={(v) => setEditForm({ ...editForm, genre: v })}>
                <SelectTrigger><SelectValue placeholder="เลือกแนว" /></SelectTrigger>
                <SelectContent>
                  {GENRES.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">ยุคสมัยและฉากหลัง</label>
              <Input
                value={editForm.era || ""}
                onChange={(e) => setEditForm({ ...editForm, era: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">คำโปรย / เรื่องย่อ</label>
              <Textarea
                rows={4}
                value={editForm.synopsis || ""}
                onChange={(e) => setEditForm({ ...editForm, synopsis: e.target.value })}
              />
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
              disabled={!editForm.title || updateMutation.isPending}
            >
              {updateMutation.isPending ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Section heading */}
        {novels.length > 0 && (
          <div className="flex items-center justify-between mb-7">
            <div>
              <h2 className="font-heading font-bold text-2xl text-foreground tracking-tight">ชั้นวางหนังสือ</h2>
              <p className="text-sm text-muted-foreground mt-1">{novels.length} เรื่อง</p>
            </div>
          </div>
        )}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : novels.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-24"
          >
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/10 to-accent/30 flex items-center justify-center mx-auto mb-6 shadow-inner">
              <BookOpen className="w-12 h-12 text-primary/50" />
            </div>
            <h2 className="text-2xl font-heading font-semibold mb-3">ชั้นวางยังว่างเปล่า</h2>
            <p className="text-muted-foreground mb-8 max-w-sm mx-auto leading-relaxed">เริ่มต้นเขียนนิยายเรื่องแรกของคุณ ทุกมหากาพย์ต้องเริ่มจากหน้าแรก</p>
            <Button onClick={() => setOpen(true)} className="gap-2 h-11 px-6 text-base shadow-sm">
              <Plus className="w-4 h-4" />
              สร้างเรื่องใหม่
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {novels.map((novel, i) => (
              <motion.div
                key={novel.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link to={`/novel/${novel.id}`}>
                  <div className="group relative bg-card border border-border/60 rounded-2xl overflow-hidden hover:shadow-xl hover:shadow-primary/5 hover:border-primary/25 transition-all duration-300 cursor-pointer h-full flex flex-col">
                    {/* Decorative top stripe by genre */}
                    <div className={`h-1.5 w-full ${genreColors[novel.genre] ? "opacity-100" : "opacity-30"}`}
                      style={{ background: "linear-gradient(90deg, hsl(var(--primary)/0.6), hsl(var(--accent)))" }} />

                    {/* Progress overlay - always show */}
                    {(() => {
                      const novelChapters = (chapters || []).filter(c => c.novel_id === novel.id && !c.is_deleted);
                      const completed = novelChapters.filter(c => c.status === "เขียนเสร็จ").length;
                      const target = novel.target_chapters || 10;
                      const isWriting = jobs[novel.id]?.status === "running";
                      const currentJob = jobs[novel.id];
                      // ใช้จำนวนตอนที่กำลังเขียนถ้ากำลังเขียน มิฉะนั้นใช้ตอนที่เสร็จแล้ว
                      const currentCount = isWriting ? (currentJob?.current || 0) : completed;
                      const pct = target > 0 ? Math.round((currentCount / target) * 100) : 0;
                      return (
                        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-background/95 to-background/60 px-4 py-3">
                          <div className="flex items-center justify-between text-xs font-medium mb-1.5">
                            <span className={isWriting ? "text-primary" : "text-muted-foreground"}>
                              {isWriting ? `✍️ กำลังสร้างตอนที่ ${currentJob?.current || 0}/${target}` : `เขียนแล้ว ${completed}/${target} ตอน`}
                            </span>
                            <span className={isWriting ? "text-primary font-semibold" : "text-muted-foreground"}>{pct}%</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full transition-all duration-500 ${isWriting ? "bg-primary animate-pulse" : "bg-emerald-500"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })()}

                    {/* One-shot badge */}
                    {novel.novel_type === "เรื่องสั้น" && (
                      <div className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-sky-500/15 text-sky-700 dark:text-sky-300 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-sky-500/30 shadow-sm">
                        <BookOpen className="w-3 h-3 text-sky-500" />
                        เรื่องสั้น
                      </div>
                    )}

                    {/* Success badge */}
                    {(novel.auto_written || jobs[novel.id]?.status === "done") && jobs[novel.id]?.status !== "running" && (
                      <div className={`absolute z-10 flex items-center gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30 shadow-sm ${novel.novel_type === "เรื่องสั้น" ? "top-3 right-3" : "top-3 left-3"}`}>
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        สำเร็จ
                      </div>
                    )}
                    <div className="p-6 pb-12 flex flex-col flex-1">
                      {/* Action buttons */}
                      <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          onClick={(e) => openEdit(e, novel)}
                          className="w-7 h-7 rounded-lg bg-background/90 shadow-sm border border-border/60 hover:bg-primary/10 hover:text-primary flex items-center justify-center transition-all"
                          title="แก้ไขข้อมูลเรื่อง"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        {(isAdmin || String(novel.created_by_id) === String(user?.id)) && (
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShareDialog({ open: true, novel }); }}
                            className="w-7 h-7 rounded-lg bg-background/90 shadow-sm border border-border/60 hover:bg-primary/10 hover:text-primary flex items-center justify-center transition-all"
                            title="แชร์เรื่อง"
                          >
                            <Share2 className="w-3 h-3" />
                          </button>
                        )}
                        {(isAdmin || String(novel.created_by_id) === String(user?.id)) && (
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteDialog({ open: true, novel }); }}
                            className="w-7 h-7 rounded-lg bg-background/90 shadow-sm border border-border/60 hover:bg-destructive/10 hover:text-destructive flex items-center justify-center transition-all"
                            title="ย้ายไปถังขยะ"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Genre badge */}
                      {novel.genre && (
                        <Badge className={`${genreColors[novel.genre] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"} text-xs mb-3 w-fit`}>
                          {novel.genre}
                        </Badge>
                      )}

                      {/* Title */}
                      <h3 className="font-heading font-bold text-lg leading-tight group-hover:text-primary transition-colors mb-2 pr-8">
                        {novel.title}
                      </h3>

                      {novel.era && (
                        <p className="text-xs text-primary/65 mb-2 font-medium flex items-center gap-1">
                          <span>📍</span>{novel.era}
                        </p>
                      )}
                      {novel.synopsis && (
                        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed flex-1">
                          {novel.synopsis}
                        </p>
                      )}

                      {/* Footer */}
                      <div className="mt-auto pt-4 border-t border-border/40 flex items-center justify-between">
                        {novel.status === "เขียนเสร็จ" ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-500" />
                            เขียนเสร็จ
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs font-normal">
                            {novel.status || "กำลังเขียน"}
                          </Badge>
                        )}
                        <div className="flex items-center gap-2">
                          {getWriterName(novel.writer_id) && (
                            <span className="text-[11px] text-primary/60 font-medium bg-primary/6 border border-primary/15 px-2 py-0.5 rounded-full">
                              ✍️ {getWriterName(novel.writer_id)}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
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
    </div>
    </>
  );
}