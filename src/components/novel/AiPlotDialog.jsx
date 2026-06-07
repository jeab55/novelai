import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Sparkles, Plus, Trash2, RefreshCw } from "lucide-react";

function buildPrompt(novel, writer, characters) {
  const charList = characters.map((c) => `- ${c.name} (${c.role || "ตัวละคร"}): ${c.personality || ""}`).join("\n") || "ยังไม่มีตัวละคร";

  return `คุณกำลังทำหน้าที่เป็นนักเขียน/บรรณาธิการที่ช่วยวางโครงเรื่อง

ข้อมูลนิยาย:
- ชื่อเรื่อง: ${novel.title}
- แนว: ${novel.genre || "ไม่ระบุ"}
- เรื่องย่อ: ${novel.synopsis || "ไม่มีเรื่องย่อ"}
- ยุคสมัย/ฉากหลัง: ${novel.era || "ไม่ระบุ"}

ตัวละคร:
${charList}

กรุณาวางโครงเรื่องโดยตอบในรูปแบบ JSON ดังนี้:
{
  "plot_outline": "สรุปโครงเรื่องแบบ 3 องก์ รวมถึงแก่น/ธีม คำถามหลักของเรื่อง จุดหักเหสำคัญ เขียนเป็นย่อหน้าอ่านง่าย",
  "events": [
    { "order": 1, "title": "ชื่อเหตุการณ์", "description": "คำอธิบายโดยย่อ" },
    ...
  ]
}

ไทม์ไลน์ควรมี 8-15 เหตุการณ์หลัก ครอบคลุมทั้งสามองก์ ปรับให้เหมาะกับแนวเรื่อง "${novel.genre || "ทั่วไป"}" โดยเฉพาะ
ตอบเป็นภาษาไทยทั้งหมด`;
}

export default function AiPlotDialog({ open, onClose, novel, novelId }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState("idle"); // idle | generating | review
  const [outline, setOutline] = useState("");
  const [events, setEvents] = useState([]);
  const [replaceConfirm, setReplaceConfirm] = useState(false);
  const [pendingSave, setPendingSave] = useState(null); // "append" | "replace"

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
    const systemPrompt = writer?.system_prompt || "คุณเป็นนักเขียนนิยายที่มีประสบการณ์สูง";
    const userPrompt = buildPrompt(novel, writer, characters);

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: userPrompt,
      model: "claude_sonnet_4_6",
      response_json_schema: {
        type: "object",
        properties: {
          plot_outline: { type: "string" },
          events: {
            type: "array",
            items: {
              type: "object",
              properties: {
                order: { type: "number" },
                title: { type: "string" },
                description: { type: "string" },
              },
            },
          },
        },
      },
    });

    // Override system prompt context by prepending it
    // (InvokeLLM doesn't have separate system param, so we prepend)
    setOutline(result.plot_outline || "");
    setEvents((result.events || []).map((e, i) => ({ ...e, order: e.order ?? i + 1 })));
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
                          placeholder="ชื่อเหตุการณ์"
                          className="h-7 text-sm flex-1"
                        />
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
                        placeholder="คำอธิบาย..."
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