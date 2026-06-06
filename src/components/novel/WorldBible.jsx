import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Globe, Trash2, Edit2, MapPin, Crown, Scroll, Package, Settings, HelpCircle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const CATEGORIES = ["สถานที่", "ขนบธรรมเนียม", "ยุคสมัย", "สิ่งของ", "ระบบ", "อื่นๆ"];

const categoryIcons = {
  "สถานที่": MapPin,
  "ขนบธรรมเนียม": Crown,
  "ยุคสมัย": Scroll,
  "สิ่งของ": Package,
  "ระบบ": Settings,
  "อื่นๆ": HelpCircle,
};

const categoryColors = {
  "สถานที่": "bg-emerald-100 text-emerald-700",
  "ขนบธรรมเนียม": "bg-purple-100 text-purple-700",
  "ยุคสมัย": "bg-amber-100 text-amber-700",
  "สิ่งของ": "bg-sky-100 text-sky-700",
  "ระบบ": "bg-indigo-100 text-indigo-700",
  "อื่นๆ": "bg-gray-100 text-gray-600",
};

export default function WorldBible({ novelId }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: "", category: "", description: "" });
  const [filterCat, setFilterCat] = useState("ทั้งหมด");
  const queryClient = useQueryClient();

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["worldEntries", novelId],
    queryFn: () => base44.entities.WorldEntry.filter({ novel_id: novelId }),
  });

  const saveMutation = useMutation({
    mutationFn: (data) =>
      editing
        ? base44.entities.WorldEntry.update(editing.id, data)
        : base44.entities.WorldEntry.create({ ...data, novel_id: novelId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["worldEntries", novelId] });
      setDialogOpen(false);
      setEditing(null);
      setForm({ title: "", category: "", description: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.WorldEntry.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["worldEntries", novelId] }),
  });

  const openEdit = (entry) => {
    setEditing(entry);
    setForm({ title: entry.title, category: entry.category || "", description: entry.description || "" });
    setDialogOpen(true);
  };

  const filtered = filterCat === "ทั้งหมด" ? entries : entries.filter((e) => e.category === filterCat);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-heading text-lg font-semibold">โลกและฉาก</h2>
          <p className="text-sm text-muted-foreground">{entries.length} รายการ</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) { setEditing(null); setForm({ title: "", category: "", description: "" }); } }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="w-3.5 h-3.5" />เพิ่มข้อมูล</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-heading">{editing ? "แก้ไข" : "เพิ่มข้อมูลโลก"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <label className="text-sm font-medium mb-1.5 block">ชื่อ</label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="เช่น พระราชวังหลวง" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">ประเภท</label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue placeholder="เลือกประเภท" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">รายละเอียด</label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={5} placeholder="อธิบายรายละเอียด..." />
              </div>
              <Button className="w-full" onClick={() => saveMutation.mutate(form)} disabled={!form.title || saveMutation.isPending}>
                {saveMutation.isPending ? "กำลังบันทึก..." : editing ? "อัปเดต" : "เพิ่ม"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {["ทั้งหมด", ...CATEGORIES].map((c) => (
          <Button
            key={c}
            variant={filterCat === c ? "default" : "outline"}
            size="sm"
            className="text-xs h-7"
            onClick={() => setFilterCat(c)}
          >
            {c}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Globe className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">ยังไม่มีข้อมูล</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <AnimatePresence>
            {filtered.map((entry, i) => {
              const Icon = categoryIcons[entry.category] || HelpCircle;
              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="border border-border/60 rounded-xl p-4 bg-card/50 hover:border-primary/20 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-4 h-4 text-primary/60" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium truncate">{entry.title}</p>
                        {entry.category && (
                          <Badge className={`${categoryColors[entry.category] || ""} text-xs shrink-0`}>{entry.category}</Badge>
                        )}
                      </div>
                      {entry.description && (
                        <p className="text-sm text-muted-foreground line-clamp-3">{entry.description}</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(entry)}>
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(entry.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}