import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Clock, Trash2, Edit2, BookOpen, Landmark, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Timeline({ novelId }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", order: 0, time_period: "", characters_involved: "", is_historical: false });
  const queryClient = useQueryClient();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["plotEvents", novelId],
    queryFn: () => base44.entities.PlotEvent.filter({ novel_id: novelId }, "order"),
  });

  const saveMutation = useMutation({
    mutationFn: (data) =>
      editing
        ? base44.entities.PlotEvent.update(editing.id, data)
        : base44.entities.PlotEvent.create({ ...data, novel_id: novelId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plotEvents", novelId] });
      closeDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PlotEvent.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plotEvents", novelId] }),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setForm({ title: "", description: "", order: events.length + 1, time_period: "", characters_involved: "", is_historical: false });
  };

  const openEdit = (ev) => {
    setEditing(ev);
    setForm({
      title: ev.title,
      description: ev.description || "",
      order: ev.order || 0,
      time_period: ev.time_period || "",
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
              <Button className="w-full" onClick={() => saveMutation.mutate(form)} disabled={!form.title || saveMutation.isPending}>
                {saveMutation.isPending ? "กำลังบันทึก..." : editing ? "อัปเดต" : "เพิ่ม"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : events.length === 0 ? (
        <div className="text-center py-16">
          <Clock className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">ยังไม่มีเหตุการณ์ในไทม์ไลน์</p>
        </div>
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
                      {ev.description && <p className="text-sm text-muted-foreground">{ev.description}</p>}
                      {ev.characters_involved && (
                        <p className="text-xs text-muted-foreground mt-2">
                          <span className="font-medium">ตัวละคร:</span> {ev.characters_involved}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(ev)}>
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(ev.id)}>
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