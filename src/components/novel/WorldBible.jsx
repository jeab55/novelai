import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Plus, Globe, Trash2, Edit2, Loader2, History, BookOpen,
  ChevronDown, ChevronUp, CheckCircle2, Search, X, Settings2,
  ChevronRight, Clock, Sparkles,
} from "lucide-react";
import VersionHistoryDialog from "./VersionHistoryDialog";
import { saveVersion } from "@/lib/saveVersion";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { ERA_TEMPLATES } from "./EraTemplates";
import WorldCategoryManager, { getColorClasses } from "./WorldCategoryManager";
import AiWorldBuilderDialog from "./AiWorldBuilderDialog";

// Built-in fallback categories
const DEFAULT_CATEGORIES = [
  { id: "_สถานที่", name: "สถานที่", color: "เขียว" },
  { id: "_ขนบธรรมเนียม", name: "ขนบธรรมเนียม", color: "ม่วง" },
  { id: "_ยุคสมัย", name: "ยุคสมัย", color: "เหลือง" },
  { id: "_สิ่งของ", name: "สิ่งของ", color: "ฟ้า" },
  { id: "_ระบบ", name: "ระบบ", color: "น้ำเงิน" },
  { id: "_อื่นๆ", name: "อื่นๆ", color: "เทา" },
];

export default function WorldBible({ novelId, onNavigateToTimeline, novel }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: "", category: "", description: "" });
  const [filterCat, setFilterCat] = useState("ทั้งหมด");
  const [versionEntry, setVersionEntry] = useState(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [selectedEra, setSelectedEra] = useState(null);
  const [importingEra, setImportingEra] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [search, setSearch] = useState("");
  const [catManagerOpen, setCatManagerOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [worldBuilderOpen, setWorldBuilderOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["worldEntries", novelId],
    queryFn: async () => {
      const all = await base44.entities.WorldEntry.filter({ novel_id: novelId });
      return all.filter((e) => !e.is_deleted);
    },
  });

  const { data: customCategories = [] } = useQuery({
    queryKey: ["worldCategories", novelId],
    queryFn: () =>
      base44.entities.WorldCategory.filter({ novel_id: novelId }),
  });

  // PlotEvents for linking (กรองเฉพาะที่ไม่ถูกลบ)
  const { data: plotEvents = [] } = useQuery({
    queryKey: ["plotEvents", novelId],
    queryFn: async () => {
      const all = await base44.entities.PlotEvent.filter({ novel_id: novelId }, "order");
      return all.filter((e) => !e.is_deleted);
    },
  });

  // Map world_entry_id -> plotEvents[]
  const eventsByWorldEntry = plotEvents.reduce((acc, ev) => {
    if (ev.world_entry_id) {
      if (!acc[ev.world_entry_id]) acc[ev.world_entry_id] = [];
      acc[ev.world_entry_id].push(ev);
    }
    return acc;
  }, {});

  // Merge: use custom if any, else fallback to defaults
  const allCategories = customCategories.length > 0 ? customCategories : DEFAULT_CATEGORIES;
  const categoryNames = allCategories.map((c) => c.name);

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
      toast.success("บันทึกแล้ว");
      setDialogOpen(false);
      setEditing(null);
      setForm({ title: "", category: "", description: "" });
    },
    onError: (err) => {
      toast.error(`บันทึกไม่สำเร็จ: ${err?.message || "กรุณาลองใหม่"}`, {
        action: { label: "ลองใหม่", onClick: () => saveMutation.mutate(form) },
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.WorldEntry.update(id, { is_deleted: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["worldEntries", novelId] });
      toast.success("ลบแล้ว");
    },
    onError: (err) => toast.error(`ลบไม่สำเร็จ: ${err?.message || "กรุณาลองใหม่"}`),
  });

  const openEdit = (entry) => {
    setEditing(entry);
    setForm({ title: entry.title, category: entry.category || "", description: entry.description || "" });
    setDialogOpen(true);
  };

  const filtered = entries
    .filter((e) => filterCat === "ทั้งหมด" || e.category === filterCat)
    .filter((e) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return e.title?.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q) || e.category?.toLowerCase().includes(q);
    });

  const handleImportEra = async () => {
    if (!selectedEra) return;
    setImportingEra(true);
    const era = ERA_TEMPLATES.find((t) => t.label === selectedEra);
    try {
      if (era) {
        await Promise.all(era.entries.map((entry) =>
          base44.entities.WorldEntry.create({ ...entry, novel_id: novelId })
        ));
        queryClient.invalidateQueries({ queryKey: ["worldEntries", novelId] });
        toast.success(`บันทึกแล้ว ${era.entries.length} รายการ`);
      }
      setImportingEra(false);
      setImportDone(true);
      setTimeout(() => {
        setImportDone(false);
        setTemplatePickerOpen(false);
        setSelectedEra(null);
      }, 1500);
    } catch (err) {
      setImportingEra(false);
      toast.error(`บันทึกไม่สำเร็จ: ${err?.message || "กรุณาลองใหม่"}`, {
        action: { label: "ลองใหม่", onClick: handleImportEra },
      });
    }
  };

  // Group by category for grouped view
  const grouped = categoryNames
    .map((name) => ({ name, items: filtered.filter((e) => e.category === name) }))
    .filter((g) => g.items.length > 0);
  const uncategorized = filtered.filter((e) => !e.category || !categoryNames.includes(e.category));
  if (uncategorized.length > 0) grouped.push({ name: "ไม่มีหมวดหมู่", items: uncategorized });

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <AiWorldBuilderDialog
        open={worldBuilderOpen}
        onClose={() => setWorldBuilderOpen(false)}
        novel={novel}
        novelId={novelId}
      />

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

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-heading text-lg font-semibold">โลกและฉาก</h2>
          <p className="text-sm text-muted-foreground">{entries.length} รายการ</p>
        </div>
        <div className="flex gap-2">
           <Button size="sm" variant="outline" className="gap-1.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
             onClick={() => setWorldBuilderOpen(true)}>
             <Sparkles className="w-3.5 h-3.5" />
             ✨ สร้างโลก/ฉาก
           </Button>
           <Button size="sm" variant="outline" className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50"
             onClick={() => { setTemplatePickerOpen((v) => !v); setImportDone(false); setSelectedEra(null); }}>
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
                <DialogTitle className="font-heading">{editing ? "แก้ไขข้อมูล" : "เพิ่มข้อมูลโลก"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">ชื่อ</label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="เช่น พระราชวังหลวง" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">หมวดหมู่</label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue placeholder="เลือกหมวดหมู่" /></SelectTrigger>
                    <SelectContent>
                      {categoryNames.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
              <button key={era.label} onClick={() => setSelectedEra(era.label)}
                className={`text-left px-3 py-2 rounded-lg border text-sm transition-all ${selectedEra === era.label ? "border-amber-500 bg-amber-100 text-amber-900 font-medium" : "border-amber-200 bg-white text-foreground hover:border-amber-400 hover:bg-amber-50"}`}>
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
          <Button size="sm" className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
            disabled={!selectedEra || importingEra || importDone} onClick={handleImportEra}>
            {importingEra ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : importDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {importDone ? "เพิ่มสำเร็จแล้ว!" : importingEra ? "กำลังเพิ่ม..." : "เพิ่มข้อมูลยุคสมัยนี้"}
          </Button>
        </div>
      )}

      {/* Search + Category Manager toggle */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="ค้นหาข้อมูลโลก..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setSearch("")}>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <Button
          size="sm"
          variant={catManagerOpen ? "default" : "outline"}
          className="gap-1.5 shrink-0"
          onClick={() => setCatManagerOpen((v) => !v)}
        >
          <Settings2 className="w-3.5 h-3.5" />
          หมวดหมู่
        </Button>
      </div>

      {/* Category Manager Panel */}
      <AnimatePresence>
        {catManagerOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-4"
          >
            <div className="border border-border/60 rounded-xl p-4 bg-card/60">
              <WorldCategoryManager
                novelId={novelId}
                categories={customCategories}
                onClose={() => setCatManagerOpen(false)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <Button
          key="all"
          variant={filterCat === "ทั้งหมด" ? "default" : "outline"}
          size="sm"
          className="text-xs h-7 rounded-full"
          onClick={() => setFilterCat("ทั้งหมด")}
        >
          ทั้งหมด <span className="ml-1 opacity-60">{entries.length}</span>
        </Button>
        {allCategories.map((cat) => {
          const colors = getColorClasses(cat.color);
          const count = entries.filter((e) => e.category === cat.name).length;
          if (count === 0) return null;
          return (
            <button
              key={cat.id}
              onClick={() => setFilterCat(filterCat === cat.name ? "ทั้งหมด" : cat.name)}
              className={`px-3 h-7 rounded-full text-xs font-medium border-2 transition-all ${
                filterCat === cat.name
                  ? `${colors.bg} ${colors.text} border-current`
                  : `bg-transparent border-border/50 text-muted-foreground hover:${colors.bg} hover:${colors.text}`
              }`}
            >
              {cat.name} <span className="ml-1 opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Globe className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">{search ? `ไม่พบผลลัพธ์สำหรับ "${search}"` : "ยังไม่มีข้อมูล"}</p>
        </div>
      ) : filterCat === "ทั้งหมด" && !search ? (
        /* Grouped view */
        <div className="space-y-6">
          {grouped.map(({ name, items }) => {
            const cat = allCategories.find((c) => c.name === name);
            const colors = cat ? getColorClasses(cat.color) : getColorClasses("เทา");
            return (
              <div key={name}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${colors.bg} ${colors.text}`}>{name}</span>
                  <span className="text-xs text-muted-foreground">{items.length} รายการ</span>
                  <div className="flex-1 h-px bg-border/40 ml-1" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <AnimatePresence>
                    {items.map((entry, i) => (
                      <WorldEntryCard
                       key={entry.id}
                       entry={entry}
                       index={i}
                       colors={colors}
                       expanded={expandedId === entry.id}
                       onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                       onEdit={() => openEdit(entry)}
                       onDelete={() => deleteMutation.mutate(entry.id)}
                       onHistory={() => setVersionEntry(entry)}
                       linkedEvents={eventsByWorldEntry[entry.id] || []}
                       onNavigateToTimeline={onNavigateToTimeline}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Flat view for filtered/searched */
        <div className="grid gap-3 sm:grid-cols-2">
          <AnimatePresence>
            {filtered.map((entry, i) => {
              const cat = allCategories.find((c) => c.name === entry.category);
              const colors = cat ? getColorClasses(cat.color) : getColorClasses("เทา");
              return (
                <WorldEntryCard
                  key={entry.id}
                  entry={entry}
                  index={i}
                  colors={colors}
                  expanded={expandedId === entry.id}
                  onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  onEdit={() => openEdit(entry)}
                  onDelete={() => deleteMutation.mutate(entry.id)}
                  onHistory={() => setVersionEntry(entry)}
                  search={search}
                  linkedEvents={eventsByWorldEntry[entry.id] || []}
                  onNavigateToTimeline={onNavigateToTimeline}
                />
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function highlightText(text, query) {
  if (!query || !text) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? <mark key={i} className="bg-yellow-200 text-yellow-900 rounded-sm px-0.5">{part}</mark> : part
  );
}

function WorldEntryCard({ entry, index, colors, expanded, onToggle, onEdit, onDelete, onHistory, search, linkedEvents = [], onNavigateToTimeline }) {
  const isLong = entry.description && entry.description.length > 120;
  const isLocation = entry.category === "สถานที่";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ delay: index * 0.03 }}
      className={`border rounded-xl bg-card/60 hover:shadow-md transition-all overflow-hidden ${expanded ? "border-primary/30 shadow-sm" : "border-border/60"}`}
    >
      {/* Card header */}
      <div className="flex items-start gap-3 p-4">
        <div className={`w-1 self-stretch rounded-full ${colors.bg} shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold text-sm leading-snug flex-1">
              {search ? highlightText(entry.title, search) : entry.title}
            </p>
            {entry.category && (
              <Badge className={`${colors.bg} ${colors.text} border-0 text-xs shrink-0`}>{entry.category}</Badge>
            )}
          </div>
          {entry.description && (
            <div className="text-sm text-muted-foreground">
              {expanded ? (
                <p className="leading-relaxed whitespace-pre-wrap">
                  {search ? highlightText(entry.description, search) : entry.description}
                </p>
              ) : (
                <p className="line-clamp-2">
                  {search ? highlightText(entry.description, search) : entry.description}
                </p>
              )}
              {isLong && (
                <button
                  className="mt-1 text-xs text-primary/70 hover:text-primary flex items-center gap-0.5 transition-colors"
                  onClick={onToggle}
                >
                  {expanded ? <><ChevronUp className="w-3 h-3" />ย่อ</> : <><ChevronRight className="w-3 h-3" />อ่านเพิ่มเติม</>}
                </button>
              )}
            </div>
          )}
        </div>
        {/* Actions */}
        <div className="flex flex-col gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" title="ประวัติ" onClick={onHistory}>
            <History className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={onEdit}>
            <Edit2 className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={onDelete}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Linked timeline events — shown for สถานที่ category */}
      {isLocation && linkedEvents.length > 0 && (
        <div className="mx-4 mb-4 rounded-lg border border-primary/15 bg-primary/4 overflow-hidden">
          <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-primary/10">
            <Clock className="w-3 h-3 text-primary/60" />
            <span className="text-[11px] font-semibold text-primary/70">เหตุการณ์ไทม์ไลน์ที่เกิดที่นี่ ({linkedEvents.length})</span>
          </div>
          <ul className="divide-y divide-primary/10">
            {linkedEvents.map((ev) => (
              <li key={ev.id}>
                <button
                  className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-primary/8 transition-colors"
                  onClick={() => onNavigateToTimeline?.(ev.id)}
                >
                  <span className="text-[10px] font-mono text-muted-foreground w-5 shrink-0">#{ev.order}</span>
                  <span className="text-xs font-medium flex-1 text-foreground/90 leading-snug">{ev.title}</span>
                  {ev.time_period && <span className="text-[10px] text-muted-foreground shrink-0">{ev.time_period}</span>}
                  <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}