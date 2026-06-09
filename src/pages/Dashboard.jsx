import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, BookOpen, Feather, Pencil, LogOut, Trash2, Share2, X } from "lucide-react";

const CHAR_ROLES = ["ตัวเอก", "ตัวรอง", "ตัวร้าย", "ตัวประกอบ"];
const emptyChar = () => ({ name: "", role: "ตัวเอก", age: "", occupation: "", personality: "", background: "", wound: "", desire: "" });

function CharacterCard({ c, i, onUpdate, onRemove }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-border/60 rounded-xl bg-muted/20 overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-2 p-2.5">
        <Input
          placeholder="ชื่อตัวละคร"
          value={c.name}
          onChange={(e) => onUpdate("name", e.target.value)}
          className="flex-1 h-8 text-sm font-medium"
        />
        <Select value={c.role} onValueChange={(v) => onUpdate("role", v)}>
          <SelectTrigger className="w-26 h-8 text-xs shrink-0"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CHAR_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input
          placeholder="อายุ"
          value={c.age}
          onChange={(e) => onUpdate("age", e.target.value)}
          className="w-14 h-8 text-xs shrink-0"
        />
        <Input
          placeholder="อาชีพ"
          value={c.occupation}
          onChange={(e) => onUpdate("occupation", e.target.value)}
          className="w-20 h-8 text-xs shrink-0"
        />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="h-8 w-8 shrink-0 rounded-md flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors text-xs"
          title={expanded ? "ย่อ" : "กรอกรายละเอียด"}
        >
          {expanded ? "▲" : "▼"}
        </button>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={onRemove}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
      {/* Detail rows (collapsible) */}
      {expanded && (
        <div className="px-2.5 pb-2.5 space-y-2 border-t border-border/40 pt-2">
          <Input
            placeholder="อุปนิสัย/บุคลิก"
            value={c.personality}
            onChange={(e) => onUpdate("personality", e.target.value)}
            className="h-8 text-xs w-full"
          />
          <Input
            placeholder="ปูมหลัง"
            value={c.background}
            onChange={(e) => onUpdate("background", e.target.value)}
            className="h-8 text-xs w-full"
          />
          <div className="flex gap-2">
            <Input
              placeholder="ปม/บาดแผล"
              value={c.wound}
              onChange={(e) => onUpdate("wound", e.target.value)}
              className="flex-1 h-8 text-xs"
            />
            <Input
              placeholder="สิ่งที่ต้องการ"
              value={c.desire}
              onChange={(e) => onUpdate("desire", e.target.value)}
              className="flex-1 h-8 text-xs"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CharacterInputList({ chars, onChange }) {
  const addRow = () => onChange([...chars, emptyChar()]);
  const removeRow = (i) => onChange(chars.filter((_, idx) => idx !== i));
  const updateRow = (i, field, value) => onChange(chars.map((c, idx) => idx === i ? { ...c, [field]: value } : c));
  return (
    <div className="space-y-2">
      {chars.map((c, i) => (
        <CharacterCard
          key={i}
          c={c}
          i={i}
          onUpdate={(field, value) => updateRow(i, field, value)}
          onRemove={() => removeRow(i)}
        />
      ))}
      <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7 mt-1" onClick={addRow}>
        <Plus className="w-3 h-3" />
        เพิ่มตัวละคร
      </Button>
    </div>
  );
}
import DeleteNovelDialog from "@/components/novel/DeleteNovelDialog";
import ShareNovelDialog from "@/components/novel/ShareNovelDialog";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";

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
  const [form, setForm] = useState({ title: "", genre: "", synopsis: "", era: "", writer_id: "", target_chapters: "10" });
  const [formChars, setFormChars] = useState([emptyChar()]);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, novel: null });
  const [shareDialog, setShareDialog] = useState({ open: false, novel: null });
  const queryClient = useQueryClient();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data: writers = [] } = useQuery({
    queryKey: ["writers"],
    queryFn: () => base44.entities.Writer.list(),
    staleTime: 0,
  });
  const activeWriters = writers.filter((w) => w.is_active !== false);

  const { data: novels = [], isLoading } = useQuery({
    queryKey: ["novels", user?.id],
    queryFn: async () => {
      const all = await base44.entities.Novel.list("-created_date");
      return all.filter((n) => {
        if (n.is_deleted) return false;
        if (isAdmin) return true;
        if (n.created_by_id === user?.id) return true;
        if (Array.isArray(n.shared_with) && n.shared_with.includes(user?.email)) return true;
        return false;
      });
    },
    enabled: !!user,
  });

  const softDeleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Novel.update(id, { is_deleted: true, deleted_at: new Date().toISOString() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["novels"] });
      toast.success("ย้ายไปถังขยะแล้ว");
      setDeleteDialog({ open: false, novel: null });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const novel = await base44.entities.Novel.create(data);
      const charsToSave = formChars.filter((c) => c.name.trim());
      if (charsToSave.length > 0) {
        await Promise.all(
          charsToSave.map((c) =>
            base44.entities.Character.create({ novel_id: novel.id, name: c.name.trim(), role: c.role, age: c.age || undefined, occupation: c.occupation || undefined, personality: c.personality || undefined, background: c.background || undefined, wound: c.wound || undefined, desire: c.desire || undefined })
          )
        );
      }
      return novel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["novels"] });
      setOpen(false);
      setForm({ title: "", genre: "", synopsis: "", era: "", writer_id: "", target_chapters: "10" });
      setFormChars([emptyChar()]);
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
      <header className="border-b border-border/60 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Feather className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-heading font-bold text-foreground">NovelAi</h1>
              <p className="text-xs text-muted-foreground">ผู้ช่วยแต่งนิยายอัจฉริยะ</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:block">{user?.full_name || user?.email}</span>
            <Link to="/trash">
              <Button variant="ghost" size="icon" title="ถังขยะ" className="text-muted-foreground hover:text-destructive">
                <Trash2 className="w-4 h-4" />
              </Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={() => logout()} title="ออกจากระบบ" className="text-muted-foreground hover:text-foreground">
              <LogOut className="w-4 h-4" />
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 font-body">
                <Plus className="w-4 h-4" />
                สร้างเรื่องใหม่
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg flex flex-col max-h-[85vh] p-0 gap-0 overflow-hidden">
              <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/40 shrink-0">
                <DialogTitle className="font-heading text-lg">สร้างนิยายเรื่องใหม่</DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto px-6 pt-4 pb-8 space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">ชื่อเรื่อง</label>
                  <Input
                    placeholder="เช่น ลับแลลายเมฆ"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">แนวนิยาย</label>
                  <Select value={form.genre} onValueChange={(v) => setForm({ ...form, genre: v })}>
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
                    placeholder="เช่น กรุงศรีอยุธยาตอนปลาย พ.ศ. 2310"
                    value={form.era}
                    onChange={(e) => setForm({ ...form, era: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">จำนวนตอนที่ต้องการ</label>
                  <Select value={form.target_chapters.toString()} onValueChange={(v) => setForm({ ...form, target_chapters: v })}>
                    <SelectTrigger><SelectValue placeholder="เลือกจำนวนตอน" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 ตอน</SelectItem>
                      <SelectItem value="20">20 ตอน</SelectItem>
                      <SelectItem value="30">30 ตอน</SelectItem>
                      <SelectItem value="40">40 ตอน</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">ตัวละครหลัก <span className="text-muted-foreground font-normal text-xs">(ไม่บังคับ — ปล่อยให้ AI เติมทีหลังได้)</span></label>
                  <CharacterInputList chars={formChars} onChange={setFormChars} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">เรื่องย่อ</label>
                  <Textarea
                    placeholder="เล่าเรื่องย่อของนิยาย..."
                    rows={4}
                    value={form.synopsis}
                    onChange={(e) => setForm({ ...form, synopsis: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    นักเขียน AI ประจำเรื่อง <span className="text-destructive">*</span>
                  </label>
                  <Select value={form.writer_id} onValueChange={(v) => setForm({ ...form, writer_id: v })}>
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
                  {form.writer_id && (
                    <p className="text-xs text-primary/60 mt-1">
                      โทน: {activeWriters.find((w) => w.id === form.writer_id)?.style || "-"}
                    </p>
                  )}
                </div>
              </div>
              <div className="px-6 py-4 border-t border-border/40 shrink-0 bg-background relative z-10">
                <Button
                  className="w-full"
                  onClick={() => createMutation.mutate(form)}
                  disabled={!form.title || !form.writer_id || createMutation.isPending}
                >
                  {createMutation.isPending ? "กำลังสร้าง..." : "สร้างนิยาย"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
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
      <main className="max-w-6xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : novels.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="w-20 h-20 rounded-2xl bg-primary/5 flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-10 h-10 text-primary/40" />
            </div>
            <h2 className="text-xl font-heading font-semibold mb-2">ยังไม่มีนิยาย</h2>
            <p className="text-muted-foreground mb-6">เริ่มต้นเขียนนิยายเรื่องแรกของคุณเลย!</p>
            <Button onClick={() => setOpen(true)} className="gap-2">
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
                  <div className="group relative bg-card border border-border/60 rounded-2xl p-6 hover:shadow-lg hover:border-primary/20 transition-all duration-300 cursor-pointer h-full">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-heading font-semibold text-lg leading-tight group-hover:text-primary transition-colors pr-8">
                        {novel.title}
                      </h3>
                      <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          onClick={(e) => openEdit(e, novel)}
                          className="w-7 h-7 rounded-lg bg-secondary/60 hover:bg-primary/10 hover:text-primary flex items-center justify-center transition-all"
                          title="แก้ไขข้อมูลเรื่อง"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {(isAdmin || novel.created_by_id === user?.id) && (
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShareDialog({ open: true, novel }); }}
                            className="w-7 h-7 rounded-lg bg-secondary/60 hover:bg-primary/10 hover:text-primary flex items-center justify-center transition-all"
                            title="แชร์เรื่อง"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {(isAdmin || novel.created_by_id === user?.id) && (
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteDialog({ open: true, novel }); }}
                            className="w-7 h-7 rounded-lg bg-secondary/60 hover:bg-destructive/10 hover:text-destructive flex items-center justify-center transition-all"
                            title="ย้ายไปถังขยะ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    {novel.genre && (
                      <Badge className={`${genreColors[novel.genre] || "bg-gray-100 text-gray-700"} text-xs mb-2`}>
                        {novel.genre}
                      </Badge>
                    )}
                    {novel.era && (
                      <p className="text-xs text-primary/70 mb-2 font-medium">{novel.era}</p>
                    )}
                    {novel.synopsis && (
                      <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                        {novel.synopsis}
                      </p>
                    )}
                    <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {novel.status || "กำลังเขียน"}
                      </Badge>
                      <div className="flex items-center gap-2">
                        {getWriterName(novel.writer_id) && (
                          <span className="text-[11px] text-primary/60 font-medium bg-primary/5 px-2 py-0.5 rounded-full">
                            ✍️ {getWriterName(novel.writer_id)}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(novel.created_date).toLocaleDateString("th-TH")}
                        </span>
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