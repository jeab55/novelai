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
import { Plus, BookOpen, Feather, Sparkles, Pencil } from "lucide-react";
import { motion } from "framer-motion";

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
  const [form, setForm] = useState({ title: "", genre: "", synopsis: "", era: "" });
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editingId, setEditingId] = useState(null);
  const queryClient = useQueryClient();

  const { data: novels = [], isLoading } = useQuery({
    queryKey: ["novels"],
    queryFn: () => base44.entities.Novel.list("-created_date"),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Novel.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["novels"] });
      setOpen(false);
      setForm({ title: "", genre: "", synopsis: "", era: "" });
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
    setEditForm({ title: novel.title, genre: novel.genre || "", synopsis: novel.synopsis || "", era: novel.era || "", status: novel.status || "กำลังเขียน" });
    setEditOpen(true);
  };

  return (
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
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 font-body">
                <Plus className="w-4 h-4" />
                สร้างเรื่องใหม่
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-heading text-lg">สร้างนิยายเรื่องใหม่</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
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
                  <label className="text-sm font-medium mb-1.5 block">เรื่องย่อ</label>
                  <Textarea
                    placeholder="เล่าเรื่องย่อของนิยาย..."
                    rows={4}
                    value={form.synopsis}
                    onChange={(e) => setForm({ ...form, synopsis: e.target.value })}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => createMutation.mutate(form)}
                  disabled={!form.title || createMutation.isPending}
                >
                  {createMutation.isPending ? "กำลังสร้าง..." : "สร้างนิยาย"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg">แก้ไขข้อมูลเรื่อง</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
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
              <Sparkles className="w-4 h-4" />
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
                      <button
                        onClick={(e) => openEdit(e, novel)}
                        className="absolute top-4 right-4 w-7 h-7 rounded-lg bg-secondary/60 hover:bg-primary/10 hover:text-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                        title="แก้ไขข้อมูลเรื่อง"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
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
                      <span className="text-xs text-muted-foreground">
                        {new Date(novel.created_date).toLocaleDateString("th-TH")}
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}