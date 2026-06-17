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

const CATEGORIES = ["สถานที่", "ขนบธรรมเนียม", "ยุคสมัย", "สิ่งของ", "ระบบ", "อื่นๆ"];

function stripCodeFence(text) {
  if (typeof text !== "string") return text;
  return text.replace(/^```[\w]*\n?/m, "").replace(/\n?```$/m, "").trim();
}

function buildWorldPrompt(novel, writer, characters, plotEvents) {
  const writerCtx = writer?.system_prompt ? `สไตล์การเขียน: ${writer.system_prompt}\n\n` : "";
  const charList = characters.map((c) => `${c.name} (${c.role || "ตัวละคร"})${c.background ? ` — ${c.background}` : ""}`).join("\n");
  const eventList = plotEvents.map((e) => `#${e.order} ${e.title}${e.location ? ` @ ${e.location}` : ""}${e.description ? ` — ${e.description}` : ""}`).join("\n");

  // Extract all mentioned locations from events
  const locations = [...new Set(
    plotEvents
      .map((e) => e.location)
      .filter(Boolean)
      .map((l) => l.trim())
  )];

  return `${writerCtx}คุณคือผู้ช่วยสร้างโลกนิยายภาษาไทย ตอบเป็น JSON เท่านั้น ห้ามมีข้อความนอก JSON

ข้อมูลนิยาย:
- ชื่อเรื่อง: ${novel.title}
- แนว: ${novel.genre || "ไม่ระบุ"}
- ยุคสมัย/ฉากหลัง: ${novel.era || "ไม่ระบุ"}
- เรื่องย่อ: ${novel.synopsis || "ไม่มี"}
- โครงเรื่อง: ${novel.plot_outline || "ไม่มี"}

ตัวละครหลัก:
${charList || "(ยังไม่มี)"}

ไทม์ไลน์เหตุการณ์:
${eventList || "(ยังไม่มี)"}

สถานที่ที่ปรากฏในไทม์ไลน์ (ต้องมีใน output ทุกแห่ง):
${locations.length > 0 ? locations.map((l) => `- ${l}`).join("\n") : "(ไม่มี)"}

สร้างรายการโลก/ฉากให้ครอบคลุม 6 หมวด:
1. สถานที่ (สถานที่สำคัญในเรื่อง — ต้องรวมทุกสถานที่จากไทม์ไลน์ข้างต้น + เพิ่มที่น่าจะมี)
2. ขนบธรรมเนียม (ประเพณี วัฒนธรรม ความเชื่อ)
3. ยุคสมัย (บรรยากาศยุค เหตุการณ์ทางประวัติศาสตร์พื้นหลัง)
4. สิ่งของ (อาวุธ สิ่งประดิษฐ์ สิ่งของสำคัญ)
5. ระบบ (การปกครอง กฎหมาย ระบบสังคม เศรษฐกิจ)
6. อื่นๆ (สิ่งที่ไม่เข้าหมวดอื่น)

แต่ละรายการต้องมี:
- title: ชื่อ
- description: คำอธิบาย 2-4 ประโยค เชื่อมโยงกับเรื่อง
- category: หมวดหมู่ (ต้องเป็นหนึ่งใน: สถานที่ ขนบธรรมเนียม ยุคสมัย สิ่งของ ระบบ อื่นๆ)

ตอบด้วย JSON โครงสร้างนี้เท่านั้น:
{"world_entries":[{"title":"ชื่อ","description":"คำอธิบาย","category":"หมวด"}]}

สร้างอย่างน้อย 12-18 รายการ ให้สอดคล้องกับยุคสมัยและเนื้อเรื่อง ตอบเป็นภาษาไทย`;
}

export default function AiWorldBuilderDialog({ open, onClose, novel, novelId }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState("idle"); // idle | generating | saving | done | review | error
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState("");
  const [savedCount, setSavedCount] = useState(0);

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

  const saveMutation = useMutation({
    mutationFn: async (toSave) => {
      setStep("saving");
      // Create selected entries
      const created = await Promise.all(
        toSave.map((e) =>
          base44.entities.WorldEntry.create({
            novel_id: novelId,
            title: e.title,
            description: e.description,
            category: e.category,
          })
        )
      );

      // Auto-link PlotEvents whose location matches a new สถานที่ entry
      const locationEntries = created.filter((_, i) => toSave[i].category === "สถานที่");
      if (locationEntries.length > 0) {
        const eventsToLink = plotEvents.filter(
          (ev) => !ev.world_entry_id && ev.location
        );
        await Promise.all(
          eventsToLink.map((ev) => {
            const match = locationEntries.find(
              (le) => le.title.trim().toLowerCase() === (ev.location || "").trim().toLowerCase()
            );
            if (match) {
              return base44.entities.PlotEvent.update(ev.id, { world_entry_id: match.id });
            }
            return null;
          }).filter(Boolean)
        );
      }
      return created.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["worldEntries", novelId] });
      queryClient.invalidateQueries({ queryKey: ["plotEvents", novelId] });
      setSavedCount(count);
      setStep("done");
      toast.success(`บันทึกแล้ว ${count} รายการ`);
      setTimeout(() => handleClose(), 1500);
    },
    onError: (err) => {
      setStep("review");
      setError("");
      toast.error(`บันทึกไม่สำเร็จ: ${err?.message || "กรุณาลองใหม่"}`, {
        action: { label: "ลองใหม่", onClick: handleSave },
      });
    },
  });

  const generate = async () => {
    if (step === "generating") return;
    setStep("generating");
    setError("");

    let raw;
    try {
      raw = await base44.integrations.Core.InvokeLLM({
        prompt: buildWorldPrompt(novel, writer, characters, plotEvents),
        model: "claude_sonnet_4_6",
      });
    } catch (err) {
      setError(`เรียก AI ไม่สำเร็จ: ${err.message}`);
      setStep("review");
      return;
    }

    let parsed;
    try {
      const cleaned = typeof raw === "object" ? raw : JSON.parse(stripCodeFence(String(raw)));
      const arr = cleaned.world_entries || cleaned.entries || cleaned.items || [];
      if (!arr.length) throw new Error("ไม่พบรายการใน response");
      parsed = arr;
    } catch (err) {
      setError(`แยกผลลัพธ์ไม่สำเร็จ: ${err.message} — กรุณากด "สร้างใหม่"`);
      setStep("review");
      setEntries([]);
      return;
    }

    // Mark duplicates
    const existingKeys = new Set(
      existingEntries.map((e) => `${(e.title || "").toLowerCase().trim()}|${e.category}`)
    );
    const mapped = parsed.map((e) => {
      const key = `${(e.title || "").toLowerCase().trim()}|${e.category}`;
      const alreadyExists = existingKeys.has(key);
      return {
        title: e.title || "",
        description: e.description || "",
        category: CATEGORIES.includes(e.category) ? e.category : "อื่นๆ",
        checked: !alreadyExists,
        expanded: false,
        alreadyExists,
      };
    });

    setEntries(mapped);

    // บันทึกอัตโนมัติทันที — เฉพาะรายการใหม่ที่ไม่ซ้ำ
    const toSave = mapped.filter((e) => e.checked && e.title && !e.alreadyExists);
    if (toSave.length > 0) {
      saveMutation.mutate(toSave);
    } else {
      setStep("review");
      toast.info("ไม่มีรายการใหม่ให้บันทึก (ทั้งหมดมีอยู่แล้ว)");
    }
  };

  const updateEntry = (idx, field, value) => {
    setEntries((prev) => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  };

  const handleSave = () => {
    const toSave = entries.filter((e) => e.checked && e.title);
    if (toSave.length === 0) return;
    saveMutation.mutate(toSave);
  };

  const handleClose = () => {
    onClose();
    setStep("idle");
    setEntries([]);
    setError("");
    setSavedCount(0);
  };

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
            <div className="py-12 flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">กำลังสร้างโลก/ฉาก...</p>
              <p className="text-xs text-muted-foreground/60">อาจใช้เวลา 15-30 วินาที</p>
            </div>
          )}

          {step === "saving" && (
            <div className="py-12 flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">กำลังบันทึกลงฐานข้อมูล...</p>
            </div>
          )}

          {step === "done" && (
            <div className="py-12 flex flex-col items-center gap-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              <p className="text-sm font-medium">บันทึกแล้ว {savedCount} รายการ</p>
              <p className="text-xs text-muted-foreground/60">แก้ไขเพิ่มเติมได้ในรายการโลก/ฉาก</p>
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
                    <p className="text-sm text-muted-foreground">เลือก {selectedCount}/{entries.length} รายการ</p>
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
        {step === "review" && (
          <div className="flex gap-2 pt-3 border-t shrink-0">
            <Button variant="outline" className="gap-2 flex-1" onClick={() => { setStep("idle"); setEntries([]); setError(""); }}>
              <RefreshCw className="w-3.5 h-3.5" />
              สร้างใหม่
            </Button>
            <Button
              className="gap-2 flex-1"
              onClick={handleSave}
              disabled={saveMutation.isPending || selectedCount === 0}
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
              บันทึก {selectedCount} รายการ
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}