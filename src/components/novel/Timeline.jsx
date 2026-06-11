import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Clock, Trash2, Edit2, BookOpen, Landmark, Loader2, Sparkles, History, Calendar, List, MapPin, ExternalLink, Globe } from "lucide-react";
import { useSafeAction } from "@/hooks/useSafeAction";
import CopyButton from "@/components/ui/CopyButton";
import VersionHistoryDialog from "./VersionHistoryDialog";
import { saveVersion } from "@/lib/saveVersion";
import { motion } from "framer-motion";
import AiPlotDialog from "./AiPlotDialog";
import AiWorldBuilderDialog from "./AiWorldBuilderDialog";
import CharacterRelationshipDiagram from "./CharacterRelationshipDiagram";
import TimelineCalendarView from "./TimelineCalendarView";
import HistoricalEventSearchDialog from "./HistoricalEventSearchDialog";

export default function Timeline({ novelId, novel, onOpenChapter, onNavigateToWorldBible }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [worldBuilderOpen, setWorldBuilderOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", order: 0, time_period: "", location: "", world_entry_id: "", characters_involved: "", is_historical: false });
  const [versionEvent, setVersionEvent] = useState(null);
  const [viewMode, setViewMode] = useState("list"); // list | calendar
  const [historicalSearchOpen, setHistoricalSearchOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["plotEvents", novelId],
    queryFn: async () => {
      const all = await base44.entities.PlotEvent.filter({ novel_id: novelId }, "order");
      return all.filter((e) => !e.is_deleted);
    },
  });

  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters", novelId],
    queryFn: async () => {
      const all = await base44.entities.Chapter.filter({ novel_id: novelId }, "order");
      return all.filter((c) => !c.is_deleted);
    },
  });

  // World entries for location linking (หมวดสถานที่)
  const { data: worldEntries = [] } = useQuery({
    queryKey: ["worldEntries", novelId],
    queryFn: async () => {
      const all = await base44.entities.WorldEntry.filter({ novel_id: novelId });
      return all.filter((e) => !e.is_deleted && e.category === "สถานที่");
    },
  });

  // Map world_entry_id -> entry for quick lookup
  const worldEntryMap = Object.fromEntries(worldEntries.map((e) => [e.id, e]));

  // Map plot_event_id -> chapter for calendar view
  const linkedChaptersByEvent = (() => {
    const map = {};
    for (const ch of chapters) {
      if (ch.plot_event_id) map[ch.plot_event_id] = ch;
    }
    return map;
  })();

  const { run: saveEvent, isPending: isSavingEvent } = useSafeAction({
    action: editing ? "แก้ไขเหตุการณ์" : "สร้างเหตุการณ์",
    entity: "PlotEvent",
    fn: async (data) => {
      if (editing) {
        await saveVersion({
          entityType: "plot_event",
          entityId: editing.id,
          novelId,
          data: editing,
          label: `แก้ไขเหตุการณ์: ${editing.title}`,
        });
        return base44.entities.PlotEvent.update(editing.id, data);
      } else {
        return base44.entities.PlotEvent.create({ ...data, novel_id: novelId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plotEvents", novelId] });
      closeDialog();
    },
  });

  const { run: deleteEvent, isPending: isDeletingEvent } = useSafeAction({
    action: "ลบเหตุการณ์",
    entity: "PlotEvent",
    fn: (id) => base44.entities.PlotEvent.update(id, { is_deleted: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plotEvents", novelId] }),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setForm({ title: "", description: "", order: events.length + 1, time_period: "", location: "", world_entry_id: "", characters_involved: "", is_historical: false });
  };

  const openEdit = (ev) => {
    setEditing(ev);
    setForm({
      title: ev.title,
      description: ev.description || "",
      order: ev.order || 0,
      time_period: ev.time_period || "",
      location: ev.location || "",
      world_entry_id: ev.world_entry_id || "",
      characters_involved: ev.characters_involved || "",
      is_historical: ev.is_historical || false,
    });
    setDialogOpen(true);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-heading text-lg font-semibold">พล็อตและไทม์ไลน์</h2>
          <p className="text-sm text-muted-foreground">{events.length} เหตุการณ์</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              className="h-8 rounded-none gap-1.5 px-2.5"
              onClick={() => setViewMode("list")}
              title="มุมมองรายการ"
            >
              <List className="w-3.5 h-3.5" />
              <span className="text-xs">รายการ</span>
            </Button>
            <Button
              variant={viewMode === "calendar" ? "default" : "ghost"}
              size="sm"
              className="h-8 rounded-none gap-1.5 px-2.5"
              onClick={() => setViewMode("calendar")}
              title="มุมมองปฏิทิน"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span className="text-xs">ปฏิทิน</span>
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50"
            onClick={() => setHistoricalSearchOpen(true)}
          >
            <Landmark className="w-3.5 h-3.5" />
            เหตุการณ์ประวัติศาสตร์
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-primary border-primary/30 hover:bg-primary/5"
            onClick={() => setAiDialogOpen(true)}
          >
            <Sparkles className="w-3.5 h-3.5" />
            ให้ AI ช่วยวางพล็อต
          </Button>

          <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) closeDialog(); else setDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5" onClick={() => setForm({ ...form, order: events.length + 1 })}>
              <Plus className="w-3.5 h-3.5" />
              เพิ่มเหตุการณ์
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-heading">{editing ? "แก้ไขเหตุการณ์" : "เพิ่มเหตุการณ์"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div><label className="text-sm font-medium mb-1.5 block">ชื่อเหตุการณ์</label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="เช่น การรบที่ทุ่งพระเมรุ" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm font-medium mb-1.5 block">ลำดับ</label>
                  <Input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} />
                </div>
                <div><label className="text-sm font-medium mb-1.5 block">ช่วงเวลา</label>
                  <Input value={form.time_period} onChange={(e) => setForm({ ...form, time_period: e.target.value })} placeholder="เช่น ปี พ.ศ. 2310" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">สถานที่</label>
                {worldEntries.length > 0 && (
                  <div className="mb-2">
                    <Select
                      value={form.world_entry_id || "_none"}
                      onValueChange={(v) => {
                        const entry = worldEntryMap[v];
                        setForm({ ...form, world_entry_id: v === "_none" ? "" : v, location: entry ? entry.title : form.location });
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="ผูกกับสถานที่ใน World Bible (ไม่บังคับ)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">— ไม่ผูก (พิมพ์อิสระ) —</SelectItem>
                        {worldEntries.map((e) => (
                          <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value, world_entry_id: "" })}
                  placeholder="เช่น กรุงศรีอยุธยา, ทุ่งพระเมรุ"
                />
              </div>
              <div><label className="text-sm font-medium mb-1.5 block">คำอธิบาย</label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="อธิบายเหตุการณ์..." />
              </div>
              <div><label className="text-sm font-medium mb-1.5 block">ตัวละครที่เกี่ยวข้อง</label>
                <Input value={form.characters_involved} onChange={(e) => setForm({ ...form, characters_involved: e.target.value })} placeholder="เช่น พระเจ้าตาก, แม่ทัพจีน" />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={form.is_historical} onCheckedChange={(v) => setForm({ ...form, is_historical: v })} />
                <label className="text-sm">เป็นเหตุการณ์ประวัติศาสตร์จริง</label>
              </div>
              <Button className="w-full" onClick={() => saveEvent(form)} disabled={!form.title || isSavingEvent}>
                {isSavingEvent ? <><Loader2 className="w-4 h-4 animate-spin mr-1" />กำลังบันทึก...</> : editing ? "อัปเดต" : "เพิ่ม"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <HistoricalEventSearchDialog
        open={historicalSearchOpen}
        onClose={() => setHistoricalSearchOpen(false)}
        novelId={novelId}
        onEventsAdded={() => queryClient.invalidateQueries({ queryKey: ["plotEvents", novelId] })}
      />

      <AiPlotDialog
        open={aiDialogOpen}
        onClose={() => setAiDialogOpen(false)}
        novel={novel}
        novelId={novelId}
        onOpenChapter={onOpenChapter}
      />

      <CharacterRelationshipDiagram
        novelId={novelId}
      />
      {versionEvent && (
        <VersionHistoryDialog
          open={!!versionEvent}
          onClose={() => setVersionEvent(null)}
          entityType="plot_event"
          entityId={versionEvent.id}
          novelId={novelId}
          currentData={versionEvent}
          currentLabel={versionEvent.title}
          onRestored={() => queryClient.invalidateQueries({ queryKey: ["plotEvents", novelId] })}
        />
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : events.length === 0 ? (
        <div className="text-center py-16">
          <Clock className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">ยังไม่มีเหตุการณ์ในไทม์ไลน์</p>
        </div>
      ) : viewMode === "calendar" ? (
        <TimelineCalendarView
          events={events}
          linkedChaptersByEvent={linkedChaptersByEvent}
          onEdit={openEdit}
          onDelete={(id) => deleteEvent(id)}
          onVersionHistory={(ev) => setVersionEvent(ev)}
        />
      ) : (
        <div className="relative pl-8">
          {/* Timeline line */}
          <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-border" />

          <div className="space-y-4">
            {events.map((ev, i) => (
              <motion.div
                key={ev.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="relative group"
              >
                {/* Dot */}
                <div className={`absolute -left-5 top-4 w-3 h-3 rounded-full border-2 ${ev.is_historical ? "bg-amber-400 border-amber-500" : "bg-primary/30 border-primary"}`} />

                <div className="border border-border/60 rounded-xl p-4 bg-card/50 hover:border-primary/20 transition-all">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-muted-foreground">#{ev.order}</span>
                        <h3 className="font-medium">{ev.title}</h3>
                        {ev.is_historical && (
                          <Badge className="bg-amber-100 text-amber-700 text-xs gap-1">
                            <Landmark className="w-3 h-3" />
                            ประวัติศาสตร์จริง
                          </Badge>
                        )}
                      </div>
                      {ev.time_period && <p className="text-xs text-primary/70 mb-1">{ev.time_period}</p>}
                      {ev.location && (
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3 shrink-0" />
                          {ev.world_entry_id && worldEntryMap[ev.world_entry_id] ? (
                            <button
                              className="text-primary/80 hover:text-primary underline underline-offset-2 transition-colors"
                              onClick={() => onNavigateToWorldBible?.(ev.world_entry_id)}
                              title="ดูรายละเอียดสถานที่ใน World Bible"
                            >
                              {ev.location}
                              <ExternalLink className="w-2.5 h-2.5 inline ml-0.5 mb-0.5" />
                            </button>
                          ) : ev.location}
                        </p>
                      )}
                      {ev.description && <p className="text-sm text-muted-foreground">{ev.description}</p>}
                      {ev.characters_involved && (
                        <p className="text-xs text-muted-foreground mt-2">
                          <span className="font-medium">ตัวละคร:</span> {ev.characters_involved}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity items-center">
                      <CopyButton
                        size="xs"
                        text={[
                          `#${ev.order} ${ev.title}`,
                          ev.time_period && `ช่วงเวลา: ${ev.time_period}`,
                          ev.location && `สถานที่: ${ev.location}`,
                          ev.description && `รายละเอียด: ${ev.description}`,
                          ev.characters_involved && `ตัวละคร: ${ev.characters_involved}`,
                        ].filter(Boolean).join("\n")}
                      />
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="ประวัติเวอร์ชัน" onClick={() => setVersionEvent(ev)}>
                        <History className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(ev)}>
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" disabled={isDeletingEvent} onClick={() => deleteEvent(ev.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}