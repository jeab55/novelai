import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Sparkles, Globe, RefreshCw, ChevronDown, ChevronUp, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { generateWorldCategory } from "@/lib/worldProgressive";

const CATEGORIES = ["สถานที่", "ขนบธรรมเนียม", "ยุคสมัย", "สิ่งของ", "ระบบ", "อื่นๆ"];

export default function AiWorldBuilderDialog({ open, onClose, novel, novelId }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState("idle"); // idle | generating | done | review
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState("");
  const [savedCount, setSavedCount] = useState(0);
  // ความคืบหน้าจริงต่อหมวด: pending | running | done | error
  const [progress, setProgress] = useState({});

  const { data: writer } = useQuery({
    queryKey: ["writer", novel?.writer_id],
    queryFn: () => base44.entities.Writer.filter({ id: novel.writer_id }),
    enabled: !!novel?.writer_id,
    select: (d) => d[0],
  });

  const { data: characters = [] } = useQuery({
    queryKey: ["characters", novelId],
    queryFn: async () => {
      const all = await base44.entities.Character.filter({ novel_id: novelId });
      return all.filter((c) => !c.is_deleted);
    },
    enabled: !!novelId,
  });

  const { data: plotEvents = [] } = useQuery({
    queryKey: ["plotEvents", novelId],
    queryFn: async () => {
      const all = await base44.entities.PlotEvent.filter({ novel_id: novelId }, "order");
      return all.filter((e) => !e.is_deleted);
    },
    enabled: !!novelId,
  });

  const { data: existingEntries = [] } = useQuery({
    queryKey: ["worldEntries", novelId],
    queryFn: async () => {
      const all = await base44.entities.WorldEntry.filter({ novel_id: novelId });
      return all.filter((e) => !e.is_deleted);
    },
    enabled: !!novelId,
  });

  // บันทึกรายการ 1 ชิ้นลงฐานข้อมูล + ผูกสถานที่กับไทม์ไลน์ทันที (ใช้ตอน auto-save ทยอย)
  const persistEntry = async (entry) => {
    const created = await base44.entities.WorldEntry.create({
      novel_id: novelId,
      title: entry.title,
      description: entry.description,
      category: entry.category,
    });
    if (entry.category === "สถานที่") {
      const match = plotEvents.find(
        (ev) => !ev.world_entry_id && ev.location &&
          ev.location.trim().toLowerCase() === entry.title.trim().toLowerCase()
      );
      if (match) {
        await base44.entities.PlotEvent.update(match.id, { world_entry_id: created.id });
      }
    }
    return created;
  };

  // บันทึกรายการที่เลือก (ใช้ตอนกดปุ่ม "บันทึก" ในโหมด review)
  const saveMutation = useMutation({
    mutationFn: async (toSave) => {
      let count = 0;
      for (const e of toSave) {
        await persistEntry(e);
        count++;
      }
      return count;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["worldEntries", novelId] });
      queryClient.invalidateQueries({ queryKey: ["plotEvents", novelId] });
      setSavedCount((c) => c + count);
      toast.success(`บันทึกแล้ว ${count} รายการ`);
    },
    onError: (err) => {
      toast.error(`บันทึกไม่สำเร็จ: ${err?.message || "กรุณาลองใหม่"}`, {
        action: { label: "ลองใหม่", onClick: handleSave },
      });
    },
  });

  const generate = async () => {
    if (step === "generating") return;
    setStep("generating");
    setError("");
    setEntries([]);
    setSavedCount(0);
    setProgress(CATEGORIES.reduce((acc, c) => ({ ...acc, [c]: "pending" }), {}));

    const existingKeys = new Set(
      existingEntries.map((e) => `${(e.title || "").toLowerCase().trim()}|${e.category}`)
    );
    const seen = new Set();
    let totalSaved = 0;
    let anyError = false;

    // ยิงทุกหมวดขนานกัน — แต่ละหมวดเสร็จก็ทยอยแสดง + auto-save ทันที
    await Promise.all(
      CATEGORIES.map(async (category) => {
        setProgress((p) => ({ ...p, [category]: "running" }));
        try {
          const items = await generateWorldCategory({ novel, writer, characters, plotEvents, category });
          const mapped = [];
          for (const e of items) {
            const key = `${(e.title || "").toLowerCase().trim()}|${category}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const alreadyExists = existingKeys.has(key);
            mapped.push({
              title: e.title || "",
              description: e.description || "",
              category,
              checked: !alreadyExists,
              expanded: false,
              alreadyExists,
              saved: false,
            });
          }
          // ทยอยแสดงทันทีที่หมวดนี้เสร็จ
          setEntries((prev) => [...prev, ...mapped]);

          // auto-save เฉพาะรายการใหม่ของหมวดนี้
          const toSave = mapped.filter((e) => !e.alreadyExists && e.title);
          for (const e of toSave) {
            await persistEntry(e);
            totalSaved++;
            setEntries((prev) => prev.map((x) =>
              x.category === e.category && x.title === e.title ? { ...x, saved: true } : x
            ));
          }
          setProgress((p) => ({ ...p, [category]: "done" }));
        } catch (err) {
          anyError = true;
          setProgress((p) => ({ ...p, [category]: "error" }));
        }
      })
    );

    queryClient.invalidateQueries({ queryKey: ["worldEntries", novelId] });
    queryClient.invalidateQueries({ queryKey: ["plotEvents", novelId] });
    setSavedCount(totalSaved);
    setStep("review");
    if (totalSaved > 0) toast.success(`สร้างและบันทึกแล้ว ${totalSaved} รายการ`);
    else if (anyError) setError("บางหมวดสร้างไม่สำเร็จ — กด \"สร้างใหม่\" เพื่อลองอีกครั้ง");
    else toast.info("ไม่มีรายการใหม่ให้บันทึก (ทั้งหมดมีอยู่แล้ว)");
  };

  const updateEntry = (idx, field, value) => {
    setEntries((prev) => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  };

  const handleSave = () => {
    const toSave = entries.filter((e) => e.checked && e.title && !e.saved && !e.alreadyExists);
    if (toSave.length === 0) return;
    saveMutation.mutate(toSave, {
      onSuccess: () => {
        setEntries((prev) => prev.map((e) =>
          toSave.includes(e) ? { ...e, saved: true } : e
        ));
      },
    });
  };

  const handleClose = () => {
    onClose();
    setStep("idle");
    setEntries([]);
    setError("");
    setSavedCount(0);
    setProgress({});
  };

  const doneCount = Object.values(progress).filter((s) => s === "done").length;

  const selectedCount = entries.filter((e) => e.checked).length;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="font-heading text-lg flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            AI สร้างโลก/ฉาก
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {step === "idle" && (
            <div className="py-8 text-center space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                AI จะวิเคราะห์เรื่องย่อ โครงเรื่อง ไทม์ไลน์ และตัวละคร
                <br />แล้วสร้างฐานข้อมูลโลก/ฉาก ครอบคลุมทุกหมวด
                <br /><span className="text-primary/80 font-medium">พร้อมผูกสถานที่กับไทม์ไลน์อัตโนมัติ</span>
              </p>
              {existingEntries.length > 0 && (
                <p className="text-xs text-muted-foreground">มีข้อมูลโลก/ฉากอยู่แล้ว {existingEntries.length} รายการ — รายการซ้ำจะติดป้าย "มีอยู่แล้ว" และไม่ถูกบันทึกซ้ำ</p>
              )}
              {writer ? (
                <Button onClick={generate} variant="outline" className="gap-2 mt-2 border-primary/30 text-primary hover:bg-primary/5">
                  <Sparkles className="w-4 h-4" />
                  ใช้สไตล์ของ <strong>{writer.name}</strong>
                </Button>
              ) : (
                <Button onClick={generate} className="gap-2 mt-2">
                  <Sparkles className="w-4 h-4" />
                  เริ่มสร้างโลก/ฉาก
                </Button>
              )}
            </div>
          )}

          {step === "generating" && (
            <div className="py-4 space-y-4">
              {/* checklist ความคืบหน้าจริงต่อหมวด */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <p className="text-sm font-medium">กำลังสร้างทีละหมวด (ขนานกัน)</p>
                  <span className="text-xs text-muted-foreground">{doneCount}/{CATEGORIES.length} เสร็จ</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {CATEGORIES.map((c) => {
                    const s = progress[c] || "pending";
                    return (
                      <div key={c} className="flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-md bg-muted/40 border border-border/40">
                        {s === "done" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          : s === "running" ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
                          : s === "error" ? <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                          : <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30 shrink-0" />}
                        <span className={s === "pending" ? "text-muted-foreground/60" : ""}>{c}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* รายการที่ทยอยสร้างเสร็จแล้ว */}
              {entries.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-xs text-muted-foreground px-1">สร้างแล้ว {entries.length} รายการ (กำลังเพิ่มต่อ...)</p>
                  {entries.map((entry, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs border border-border/50 bg-muted/20 rounded-lg px-3 py-2">
                      {entry.saved ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        : <Loader2 className="w-3 h-3 animate-spin text-muted-foreground shrink-0" />}
                      <span className="font-medium truncate">{entry.title}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0 ml-auto">{entry.category}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === "review" && (
            <div className="space-y-4 py-2">
              {error && (
                <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              {entries.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      บันทึกอัตโนมัติแล้ว {savedCount} รายการ · เลือก {selectedCount}/{entries.length}
                    </p>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEntries((p) => p.map((e) => ({ ...e, checked: !e.alreadyExists })))}>
                        เลือกทั้งหมด
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEntries((p) => p.map((e) => ({ ...e, checked: false })))}>
                        ยกเลิกทั้งหมด
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {entries.map((entry, idx) => (
                      <div
                        key={idx}
                        className={`border rounded-lg p-3 space-y-2 ${entry.alreadyExists ? "border-amber-200 bg-amber-50/40" : "border-border/60 bg-muted/30"}`}
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={entry.checked}
                            onCheckedChange={(v) => updateEntry(idx, "checked", !!v)}
                            disabled={entry.alreadyExists}
                            id={`we-${idx}`}
                          />
                          <label htmlFor={`we-${idx}`} className="flex items-center gap-2 flex-1 cursor-pointer min-w-0">
                            <span className="text-sm font-semibold truncate">{entry.title || "(ไม่มีชื่อ)"}</span>
                            <Badge variant="outline" className="text-xs shrink-0">{entry.category}</Badge>
                            {entry.alreadyExists && (
                              <Badge variant="outline" className="text-xs text-amber-700 border-amber-300 bg-amber-50 shrink-0">มีอยู่แล้ว</Badge>
                            )}
                            {entry.saved && (
                              <Badge variant="outline" className="text-xs text-emerald-700 border-emerald-300 bg-emerald-50 shrink-0">บันทึกแล้ว</Badge>
                            )}
                          </label>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 text-muted-foreground"
                            onClick={() => updateEntry(idx, "expanded", !entry.expanded)}
                          >
                            {entry.expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </Button>
                        </div>

                        {!entry.expanded && entry.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 pl-6">{entry.description}</p>
                        )}

                        {entry.expanded && (
                          <div className="space-y-2 pt-1 border-t border-border/40">
                            <div className="grid grid-cols-3 gap-2">
                              <div className="col-span-2">
                                <label className="text-xs text-muted-foreground mb-1 block">ชื่อ</label>
                                <Input value={entry.title} onChange={(e) => updateEntry(idx, "title", e.target.value)} className="h-7 text-xs" />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground mb-1 block">หมวด</label>
                                <Select value={entry.category} onValueChange={(v) => updateEntry(idx, "category", v)}>
                                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">คำอธิบาย</label>
                              <Textarea value={entry.description} onChange={(e) => updateEntry(idx, "description", e.target.value)} rows={3} className="text-xs" />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        {step === "review" && (() => {
          const unsavedSelected = entries.filter((e) => e.checked && e.title && !e.saved && !e.alreadyExists).length;
          return (
            <div className="flex gap-2 pt-3 border-t shrink-0">
              <Button variant="outline" className="gap-2 flex-1" onClick={() => { setStep("idle"); setEntries([]); setError(""); setSavedCount(0); }}>
                <RefreshCw className="w-3.5 h-3.5" />
                สร้างใหม่
              </Button>
              <Button
                className="gap-2 flex-1"
                onClick={handleSave}
                disabled={saveMutation.isPending || unsavedSelected === 0}
              >
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                {unsavedSelected > 0 ? `บันทึกเพิ่ม ${unsavedSelected} รายการ` : "บันทึกครบแล้ว"}
              </Button>
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>
  );
}