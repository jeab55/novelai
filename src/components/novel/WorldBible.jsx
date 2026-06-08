import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Globe, Trash2, Edit2, MapPin, Crown, Scroll, Package, Settings, HelpCircle, Loader2, History, BookOpen, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import VersionHistoryDialog from "./VersionHistoryDialog";
import { saveVersion } from "@/lib/saveVersion";
import { motion, AnimatePresence } from "framer-motion";
import { ERA_TEMPLATES } from "./EraTemplates";

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
  const [versionEntry, setVersionEntry] = useState(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [selectedEra, setSelectedEra] = useState(null);
  const [importingEra, setImportingEra] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const queryClient = useQueryClient();

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["worldEntries", novelId],
    queryFn: () => base44.entities.WorldEntry.filter({ novel_id: novelId }),
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (editing) {
        await saveVersion({
          entityType: "world_entry",
          entityId: editing.id,
          novelId,
          data: editing,
          label: `แก้ไขโลก/ฉาก: ${editing.title}`,
        });
        return base44.entities.WorldEntry.update(editing.id, data);
      } else {
        return base44.entities.WorldEntry.create({ ...data, novel_id: novelId });
      }
    },
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

  const handleImportEra = async () => {
    if (!selectedEra) return;
    setImportingEra(true);
    const era = ERA_TEMPLATES.find((t) => t.label === selectedEra);
    if (era) {
      await Promise.all(
        era.entries.map((entry) =>
          base44.entities.WorldEntry.create({ ...entry, novel_id: novelId })
        )
      );
      queryClient.invalidateQueries({ queryKey: ["worldEntries", novelId] });
    }
    setImportingEra(false);
    setImportDone(true);
    setTimeout(() => {
      setImportDone(false);
      setTemplatePickerOpen(false);
      setSelectedEra(null);
    }, 1500);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {versionEntry && (
        <VersionHistoryDialog
          open={!!versionEntry}
          onClose={() => setVersionEntry(null)}
          entityType="world_entry"
          entityId={versionEntry.id}
          novelId={novelId}
          currentData={versionEntry}
          currentLabel={versionEntry.title}
          onRestored={() => queryClient.invalidateQueries({ queryKey: ["worldEntries", novelId] })}
        />
      )}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-heading text-lg font-semibold">โลกและฉาก</h2>
          <p className="text-sm text-muted-foreground">{entries.length} รายการ</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50" onClick={() => { setTemplatePickerOpen((v) => !v); setImportDone(false); setSelectedEra(null); }}>
            <BookOpen className="w-3.5 h-3.5" />
            เทมเพลตยุคสมัย
            {templatePickerOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
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
      </div>

      {/* Era Template Picker */}
      {templatePickerOpen && (
        <div className="mb-5 border border-amber-200 rounded-xl p-4 bg-amber-50/60">
          <p className="text-sm font-semibold text-amber-900 mb-3">เลือกยุคสมัยที่ต้องการเติมข้อมูลพื้นหลัง</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
            {ERA_TEMPLATES.map((era) => (
              <button
                key={era.label}
                onClick={() => setSelectedEra(era.label)}
                className={`text-left px-3 py-2 rounded-lg border text-sm transition-all ${selectedEra === era.label ? "border-amber-500 bg-amber-100 text-amber-900 font-medium" : "border-amber-200 bg-white text-foreground hover:border-amber-400 hover:bg-amber-50"}`}
              >
                {era.label}
                <span className="block text-xs text-muted-foreground mt-0.5">{era.entries.length} รายการ</span>
              </button>
            ))}
          </div>
          {selectedEra && (
            <div className="mb-3 bg-white/70 rounded-lg border border-amber-200 p-3">
              <p className="text-xs font-medium text-amber-800 mb-1.5">รายการที่จะเพิ่ม:</p>
              <ul className="space-y-0.5">
                {ERA_TEMPLATES.find((t) => t.label === selectedEra)?.entries.map((e, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    <span className="font-medium">[{e.category}]</span> {e.title}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Button
            size="sm"
            className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
            disabled={!selectedEra || importingEra || importDone}
            onClick={handleImportEra}
          >
            {importingEra ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : importDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {importDone ? "เพิ่มสำเร็จแล้ว!" : importingEra ? "กำลังเพิ่ม..." : "เพิ่มข้อมูลยุคสมัยนี้"}
          </Button>
        </div>
      )}

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
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="ประวัติเวอร์ชัน" onClick={() => setVersionEntry(entry)}>
                        <History className="w-3 h-3" />
                      </Button>
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