import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Loader2, Bot, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

const EMPTY_FORM = { name: "", description: "", style: "", system_prompt: "", is_active: true };

export default function WriterManager() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null = create
  const [form, setForm] = useState(EMPTY_FORM);
  const [expandedId, setExpandedId] = useState(null);

  const { data: writers = [], isLoading } = useQuery({
    queryKey: ["writers"],
    queryFn: () => base44.entities.Writer.list(),
    staleTime: 0,
  });

  const upsert = useMutation({
    mutationFn: (data) =>
      editing ? base44.entities.Writer.update(editing.id, data) : base44.entities.Writer.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["writers"] });
      setDialogOpen(false);
      toast.success(editing ? "แก้ไขแล้ว" : "เพิ่มนักเขียนแล้ว");
    },
  });

  const remove = useMutation({
    mutationFn: (id) => base44.entities.Writer.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["writers"] }),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.Writer.update(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["writers"] }),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (w) => {
    setEditing(w);
    setForm({ name: w.name, description: w.description || "", style: w.style || "", system_prompt: w.system_prompt || "", is_active: w.is_active !== false });
    setDialogOpen(true);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-heading text-lg font-semibold">นักเขียน AI</h2>
          <p className="text-sm text-muted-foreground">{writers.length} นักเขียน</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="w-3.5 h-3.5" />
          เพิ่มนักเขียน
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : writers.length === 0 ? (
        <div className="text-center py-16">
          <Bot className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">ยังไม่มีนักเขียน AI</p>
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            เพิ่มนักเขียนคนแรก
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {writers.map((w) => (
            <div
              key={w.id}
              className="rounded-2xl border border-border/50 bg-card/60 overflow-hidden"
            >
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-[15px]">{w.name}</p>
                    <Badge variant="outline" className={`text-xs ${w.is_active !== false ? "border-emerald-200 text-emerald-700 bg-emerald-50" : "border-border text-muted-foreground"}`}>
                      {w.is_active !== false ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                    </Badge>
                  </div>
                  {w.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{w.description}</p>}
                  {w.style && <p className="text-xs text-primary/60 mt-0.5 truncate">โทน: {w.style}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => setExpandedId(expandedId === w.id ? null : w.id)}
                  >
                    {expandedId === w.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => openEdit(w)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Switch
                    checked={w.is_active !== false}
                    onCheckedChange={(v) => toggleActive.mutate({ id: w.id, is_active: v })}
                    className="scale-75"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => { if (confirm(`ลบ "${w.name}" ?`)) remove.mutate(w.id); }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Expanded: system prompt preview */}
              {expandedId === w.id && (
                <div className="px-5 pb-5 border-t border-border/40 pt-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2">System Prompt (สกิลการเขียน)</p>
                  <pre className="text-xs bg-muted/30 rounded-xl p-4 whitespace-pre-wrap leading-relaxed text-foreground/80 max-h-64 overflow-y-auto font-body">
                    {w.system_prompt || "(ยังไม่มี system prompt)"}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/60 shrink-0">
            <DialogTitle className="font-heading">{editing ? `แก้ไข: ${editing.name}` : "เพิ่มนักเขียน AI"}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">ชื่อนักเขียน <span className="text-destructive">*</span></label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="เช่น เม็ดถั่วเขียว" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">สไตล์/โทน</label>
                <Input value={form.style} onChange={(e) => setForm((f) => ({ ...f, style: e.target.value }))} placeholder="เช่น อิงประวัติศาสตร์ ภาษาไทยโบราณ" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">ความเชี่ยวชาญ / คำอธิบาย</label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="เช่น นิยายไทยและอิงประวัติศาสตร์" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">System Prompt (สกิลและแนวทางการเขียน)</label>
              <Textarea
                value={form.system_prompt}
                onChange={(e) => setForm((f) => ({ ...f, system_prompt: e.target.value }))}
                rows={14}
                className="resize-none font-mono text-xs leading-relaxed"
                placeholder="กรอก system prompt ที่กำหนดบุคลิก สไตล์ และความสามารถของนักเขียน AI คนนี้..."
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
              <label className="text-sm">เปิดใช้งาน</label>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-border/60 shrink-0 flex justify-between gap-2">
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>ยกเลิก</Button>
            <Button onClick={() => upsert.mutate(form)} disabled={!form.name || upsert.isPending}>
              {upsert.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />}
              {editing ? "บันทึกการเปลี่ยนแปลง" : "เพิ่มนักเขียน"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}