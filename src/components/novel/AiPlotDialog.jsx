import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Sparkles, Plus, Trash2, RefreshCw } from "lucide-react";

function stripCodeFence(text) {
  if (typeof text !== "string") return text;
  // Remove ```json ... ``` or ``` ... ``` fences
  return text.replace(/^```[\w]*\n?/m, "").replace(/\n?```$/m, "").trim();
}

function parseAiResult(raw) {
  // If already an object (InvokeLLM returned parsed JSON), use directly
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const outline = raw.plot_outline || raw.plotOutline || raw.outline || raw.summary || "";
    const eventsRaw = raw.events || raw.timeline || raw.plot_events || raw.items || [];
    return { outline, eventsRaw };
  }
  // Otherwise try to parse string
  const cleaned = stripCodeFence(String(raw));
  const parsed = JSON.parse(cleaned);
  const outline = parsed.plot_outline || parsed.plotOutline || parsed.outline || parsed.summary || "";
  const eventsRaw = parsed.events || parsed.timeline || parsed.plot_events || parsed.items || [];
  return { outline, eventsRaw };
}

function buildPrompt(novel, writer, characters) {
  const charList = characters.map((c) => `- ${c.name} (${c.role || "ตัวละคร"}): ${c.personality || ""}`).join("\n") || "ยังไม่มีตัวละคร";
  const writerContext = writer?.system_prompt ? `\nสไตล์การเขียน: ${writer.system_prompt}\n` : "";
  const targetChapters = novel.target_chapters || 10;

  return `${writerContext}
คุณคือบรรณาธิการที่ช่วยวางโครงเรื่องนิยาย ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอก JSON

ข้อมูลนิยาย:
- ชื่อเรื่อง: ${novel.title}
- แนว: ${novel.genre || "ไม่ระบุ"}
- เรื่องย่อ: ${novel.synopsis || "ไม่มีเรื่องย่อ"}
- ยุคสมัย/ฉากหลัง: ${novel.era || "ไม่ระบุ"}
- จำนวนตอนที่ต้องการ: ${targetChapters} ตอน

ตัวละคร:
${charList}

จงแบ่งโครงเรื่อง 3 องก์ออกเป็น ${targetChapters} ตอนเท่าๆ กัน โดยแต่ละตอนต้องมี:
- order: เลขลำดับตอน (1-${targetChapters})
- title: ชื่อตอน
- description: สรุปเหตุการณ์สำคัญในตอน (2-3 บรรทัด)
- act: องก์ที่สังกัด (1=ต้นเรื่อง, 2=กลางเรื่อง, 3=จุด Climax และบทสรุป)

ตอบด้วย JSON โครงสร้างนี้เท่านั้น (ไม่มี markdown, ไม่มี backtick):
{"plot_outline":"สรุปโครงเรื่อง 3 องก์ แก่น/ธีม คำถามหลักของเรื่อง จุดหักเห (เขียนเป็นภาษาไทย)","events":[{"order":1,"title":"ชื่อตอน","description":"สรุปเหตุการณ์","act":1},{"order":2,"title":"...","description":"...","act":1}]}

สร้างโครงเรื่องให้ครบ ${targetChapters} ตอน ครอบคลุมทั้งสามองก์ ปรับให้เหมาะกับแนว "${novel.genre || "ทั่วไป"}" ตอบเป็นภาษาไทยทั้งหมด ตอบด้วย JSON ล้วนเท่านั้น`;
}

export default function AiPlotDialog({ open, onClose, novel, novelId }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState("idle"); // idle | generating | review | error
  const [outline, setOutline] = useState("");
  const [events, setEvents] = useState([]);
  const [replaceConfirm, setReplaceConfirm] = useState(false);
  const [parseError, setParseError] = useState("");

  const { data: writer } = useQuery({
    queryKey: ["writer", novel?.writer_id],
    queryFn: () => base44.entities.Writer.filter({ id: novel.writer_id }),
    enabled: !!novel?.writer_id,
    select: (data) => data[0],
  });

  const { data: characters = [] } = useQuery({
    queryKey: ["characters", novelId],
    queryFn: () => base44.entities.Character.filter({ novel_id: novelId }),
    enabled: !!novelId,
  });

  const { data: existingEvents = [] } = useQuery({
    queryKey: ["plotEvents", novelId],
    queryFn: () => base44.entities.PlotEvent.filter({ novel_id: novelId }, "order"),
    enabled: !!novelId,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ eventsToSave, replace }) => {
      // Update plot_outline on novel
      await base44.entities.Novel.update(novelId, { plot_outline: outline });

      if (replace) {
        // Delete existing events
        await Promise.all(existingEvents.map((e) => base44.entities.PlotEvent.delete(e.id)));
      }

      const baseOrder = replace ? 0 : (existingEvents.length > 0 ? Math.max(...existingEvents.map((e) => e.order || 0)) : 0);
      await Promise.all(
        eventsToSave.map((ev) =>
          base44.entities.PlotEvent.create({
            novel_id: novelId,
            title: ev.title,
            description: ev.description,
            order: baseOrder + ev.order,
          })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plotEvents", novelId] });
      onClose();
      setStep("idle");
      setOutline("");
      setEvents([]);
    },
  });

  const generate = async () => {
    if (!novel) return;
    setStep("generating");
    setParseError("");

    const userPrompt = buildPrompt(novel, writer, characters);

    // Request as plain string so we can handle parsing ourselves robustly
    const raw = await base44.integrations.Core.InvokeLLM({
      prompt: userPrompt,
      model: "claude_sonnet_4_6",
    });

    let outline = "";
    let eventsRaw = [];
    try {
      const parsed = parseAiResult(raw);
      outline = parsed.outline;
      eventsRaw = parsed.eventsRaw;
      if (!outline && !eventsRaw.length) throw new Error("ไม่พบข้อมูลใน response");
    } catch (err) {
      // Last resort: raw is a string, show it in outline box
      if (typeof raw === "string" && raw.length > 10) {
        outline = raw;
        eventsRaw = [];
        setParseError("ไม่สามารถแยก JSON ได้ แสดงข้อความดิบจาก AI ในช่องโครงเรื่อง กรุณาแก้ไขหรือลองใหม่");
      } else {
        setParseError(`แยกผลลัพธ์ไม่สำเร็จ: ${err.message} — กรุณากด "เขียนใหม่"`);
        setStep("review");
        setOutline("");
        setEvents([]);
        return;
      }
    }

    setOutline(outline);
    setEvents(eventsRaw.map((e, i) => ({
      order: e.order ?? i + 1,
      title: e.title || e.name || "",
      description: e.description || e.desc || e.content || "",
    })));
    setStep("review");
  };

  const handleSave = () => {
    if (existingEvents.length > 0) {
      setReplaceConfirm(true);
    } else {
      saveMutation.mutate({ eventsToSave: events, replace: false });
    }
  };

  const addEvent = () => {
    setEvents((prev) => [
      ...prev,
      { order: prev.length + 1, title: "", description: "" },
    ]);
  };

  const removeEvent = (idx) => {
    setEvents((prev) => prev.filter((_, i) => i !== idx).map((e, i) => ({ ...e, order: i + 1 })));
  };

  const updateEvent = (idx, field, value) => {
    setEvents((prev) => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  };

  const getActLabel = (act) => {
    if (act === 1) return "องก์ 1 (ต้นเรื่อง)";
    if (act === 2) return "องก์ 2 (กลางเรื่อง)";
    if (act === 3) return "องก์ 3 (Climax)";
    return "ไม่ระบุ";
  };

  const handleClose = () => {
    onClose();
    setStep("idle");
    setOutline("");
    setEvents([]);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              AI ช่วยวางพล็อตและไทม์ไลน์
            </DialogTitle>
          </DialogHeader>

          {step === "idle" && (
            <div className="py-6 text-center space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                AI จะวิเคราะห์ข้อมูลนิยาย ตัวละคร และสไตล์ของนักเขียนประจำเรื่อง
                <br />แล้ววางโครงเรื่อง 3 องก์ พร้อมไทม์ไลน์เหตุการณ์หลัก
              </p>
              {writer && (
                <p className="text-xs text-primary/80 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 inline-block">
                  ✍️ ใช้สไตล์ของ <strong>{writer.name}</strong>
                </p>
              )}
              <Button onClick={generate} className="gap-2 mt-2">
                <Sparkles className="w-4 h-4" />
                เริ่มวางพล็อต
              </Button>
            </div>
          )}

          {step === "generating" && (
            <div className="py-12 flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">AI กำลังวางโครงเรื่อง...</p>
              <p className="text-xs text-muted-foreground/60">อาจใช้เวลา 15-30 วินาที</p>
            </div>
          )}

          {step === "review" && (
            <div className="space-y-5">
              {parseError && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  ⚠️ {parseError}
                </div>
              )}
              {/* Plot outline */}
              <div>
                <label className="text-sm font-semibold mb-2 block text-foreground">โครงเรื่อง (3 องก์)</label>
                <Textarea
                  value={outline}
                  onChange={(e) => setOutline(e.target.value)}
                  rows={6}
                  className="text-sm leading-relaxed"
                />
              </div>

              {/* Events list */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-foreground">ไทม์ไลน์เหตุการณ์</label>
                  <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={addEvent}>
                    <Plus className="w-3 h-3" />
                    เพิ่ม
                  </Button>
                </div>
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {events.map((ev, idx) => (
                    <div key={idx} className="border border-border/60 rounded-lg p-3 bg-muted/30 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground w-5 shrink-0">#{idx + 1}</span>
                        <Input
                          value={ev.title}
                          onChange={(e) => updateEvent(idx, "title", e.target.value)}
                          placeholder="ชื่อตอน"
                          className="h-7 text-sm flex-1"
                        />
                        <Select value={ev.act || 1} onValueChange={(v) => updateEvent(idx, "act", Number(v))}>
                          <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">องก์ 1</SelectItem>
                            <SelectItem value="2">องก์ 2</SelectItem>
                            <SelectItem value="3">องก์ 3</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeEvent(idx)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                      <Textarea
                        value={ev.description}
                        onChange={(e) => updateEvent(idx, "description", e.target.value)}
                        placeholder="สรุปเหตุการณ์สำคัญในตอน..."
                        rows={2}
                        className="text-xs leading-relaxed"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="gap-2 flex-1" onClick={() => { setStep("idle"); setOutline(""); setEvents([]); }}>
                  <RefreshCw className="w-3.5 h-3.5" />
                  เขียนใหม่
                </Button>
                <Button
                  className="gap-2 flex-1"
                  onClick={handleSave}
                  disabled={saveMutation.isPending || events.every((e) => !e.title)}
                >
                  {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  บันทึกลงไทม์ไลน์
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm replace/append */}
      <AlertDialog open={replaceConfirm} onOpenChange={setReplaceConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">ไทม์ไลน์มีข้อมูลอยู่แล้ว</AlertDialogTitle>
            <AlertDialogDescription>
              ปัจจุบันมี {existingEvents.length} เหตุการณ์ในไทม์ไลน์ คุณต้องการ...
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => { setReplaceConfirm(false); saveMutation.mutate({ eventsToSave: events, replace: false }); }}
            >
              เพิ่มต่อท้าย
            </Button>
            <AlertDialogAction
              onClick={() => { setReplaceConfirm(false); saveMutation.mutate({ eventsToSave: events, replace: true }); }}
            >
              แทนที่ทั้งหมด
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}