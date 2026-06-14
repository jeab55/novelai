import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Sparkles, Plus, Trash2, FileText, RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AiChapterGeneratorDialog({ open, onClose, novel, novelId }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState("idle");
  const [chapters, setChapters] = useState([]);
  const [replaceConfirm, setReplaceConfirm] = useState(false);
  const [selectedPlotEvents, setSelectedPlotEvents] = useState([]);

  const { data: writer } = useQuery({
    queryKey: ["writers-all"],
    queryFn: () => base44.entities.Writer.list(),
    enabled: !!novel?.writer_id,
    select: (d) => d.find((w) => String(w.id) === String(novel?.writer_id)),
  });

  const { data: plotEvents = [] } = useQuery({
    queryKey: ["plotEvents", novelId],
    queryFn: async () => {
      const all = await base44.entities.PlotEvent.filter({ novel_id: novelId }, "order");
      return all.filter((e) => !e.is_deleted);
    },
    enabled: !!novelId && step !== "idle",
  });

  const { data: existingChapters = [] } = useQuery({
    queryKey: ["chapters", novelId],
    queryFn: async () => {
      const all = await base44.entities.Chapter.filter({ novel_id: novelId }, "order");
      return all.filter((c) => !c.is_deleted);
    },
    enabled: !!novelId && step !== "idle",
  });

  const generateChapters = async () => {
    if (!novel) return;
    setStep("generating");

    const targetChapters = novel.target_chapters || 10;
    const plotOutline = novel.plot_outline || "";
    
    const eventsContext = plotEvents.length > 0 
      ? `เหตุการณ์ไทม์ไลน์ที่มี:\n${plotEvents.map((e, i) => `${i + 1}. ${e.title} - ${e.description || ""}`).join("\n")}`
      : "ยังไม่มีเหตุการณ์ไทม์ไลน์";

    const writerCtx = writer?.system_prompt ? `[สไตล์การเขียน]\n${writer.system_prompt}\n\n` : "";

    const prompt = `${writerCtx}คุณคือผู้ช่วยแต่งนิยาย ช่วยสร้างโครงตอนย่อยจากโครงเรื่องหลัก

ข้อมูลนิยาย:
- ชื่อ: ${novel.title}
- แนว: ${novel.genre}
- เรื่องย่อ: ${novel.synopsis || "ไม่มี"}
- จำนวนตอนที่ต้องการ: ${targetChapters} ตอน
- โครงเรื่อง 3 องก์: ${plotOutline || "ไม่มี"}

${eventsContext}

จงสร้างโครงตอนย่อย ${targetChapters} ตอน โดยแต่ละตอนต้องมี:
- order: ลำดับตอน (1-${targetChapters})
- title: ชื่อตอน
- content: โครงย่อของตอน (3-5 บรรทัด) ระบุว่าเกิดอะไรขึ้น ใครทำอะไร มีปมอะไร
- plot_event_id: (ถ้ามี) ID ของเหตุการณ์ไทม์ไลน์ที่ตอนนี้อ้างอิง
- plot_event_title: (ถ้ามี) ชื่อเหตุการณ์ไทม์ไลน์
- act: องก์ที่สังกัด (1, 2, หรือ 3)

ตอบด้วย JSON โครงสร้างนี้เท่านั้น:
{"chapters":[{"order":1,"title":"ชื่อตอน","content":"โครงย่อ","act":1,"plot_event_id":"...","plot_event_title":"..."}]}

ตอบเป็นภาษาไทย JSON ล้วนเท่านั้น`;

    try {
      const raw = await base44.integrations.Core.InvokeLLM({
        prompt,
        model: "claude_sonnet_4_6",
      });

      let parsed;
      if (typeof raw === "string") {
        const cleaned = raw.replace(/^```[\w]*\n?/m, "").replace(/\n?```$/m, "").trim();
        parsed = JSON.parse(cleaned);
      } else {
        parsed = raw;
      }

      const chaptersRaw = parsed.chapters || parsed.items || [];
      setChapters(chaptersRaw.map((c, i) => ({
        order: c.order ?? i + 1,
        title: c.title || `ตอนที่ ${i + 1}`,
        content: c.content || c.description || "",
        act: c.act || 1,
        plot_event_id: c.plot_event_id || null,
        plot_event_title: c.plot_event_title || null,
      })));
      setStep("review");
    } catch (err) {
      console.error("Generate chapters error:", err);
      setStep("error");
    }
  };

  const saveMutation = useMutation({
    mutationFn: async ({ chaptersToSave, replace }) => {
      if (replace) {
        await Promise.all(existingChapters.map((c) => base44.entities.Chapter.delete(c.id)));
      }

      const baseOrder = replace ? 1 : (existingChapters.length > 0 ? Math.max(...existingChapters.map((c) => c.order || 0)) + 1 : 1);

      await Promise.all(
        chaptersToSave.map((ch) =>
          base44.entities.Chapter.create({
            novel_id: novelId,
            title: ch.title,
            content: ch.content || "",
            previous_content: "",
            order: baseOrder + ch.order - 1,
            status: "ร่าง",
            plot_event_id: ch.plot_event_id || null,
            plot_event_title: ch.plot_event_title || null,
            plot_event_description: plotEvents.find((e) => e.id === ch.plot_event_id)?.description || "",
            plot_event_order: ch.order,
          })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chapters", novelId] });
      onClose();
      setStep("idle");
      setChapters([]);
    },
  });

  const handleSave = () => {
    if (existingChapters.length > 0) {
      setReplaceConfirm(true);
    } else {
      saveMutation.mutate({ chaptersToSave: chapters, replace: false });
    }
  };

  const updateChapter = (idx, field, value) => {
    setChapters((prev) => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };

  const removeChapter = (idx) => {
    setChapters((prev) => prev.filter((_, i) => i !== idx).map((c, i) => ({ ...c, order: i + 1 })));
  };

  const addChapter = () => {
    setChapters((prev) => [
      ...prev,
      { order: prev.length + 1, title: "", content: "", act: 1 },
    ]);
  };

  const handleClose = () => {
    onClose();
    setStep("idle");
    setChapters([]);
  };

  const getActLabel = (act) => {
    if (act === 1) return "องก์ 1";
    if (act === 2) return "องก์ 2";
    if (act === 3) return "องก์ 3";
    return "ไม่ระบุ";
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              AI สร้างโครงตอนจากพล็อต
            </DialogTitle>
          </DialogHeader>

          {step === "idle" && (
            <div className="py-6 text-center space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                AI จะสร้างโครงตอนย่อย {novel?.target_chapters || 10} ตอน จากโครงเรื่อง 3 องก์และไทม์ไลน์ที่มี
                <br />แต่ละตอนจะมีชื่อตอน โครงย่อ และผูกกับเหตุการณ์ไทม์ไลน์ (ถ้ามี)
              </p>
              {novel?.plot_outline && (
                <div className="text-xs text-left bg-muted/50 border border-border/60 rounded-lg p-3 max-h-32 overflow-y-auto">
                  <p className="font-semibold mb-1">โครงเรื่อง:</p>
                  <p className="text-muted-foreground whitespace-pre-wrap">{novel.plot_outline}</p>
                </div>
              )}
              <Button onClick={generateChapters} className="gap-2 mt-2">
                <Sparkles className="w-4 h-4" />
                สร้างโครงตอน
              </Button>
            </div>
          )}

          {step === "generating" && (
            <div className="py-12 flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">AI กำลังสร้างโครงตอน...</p>
              <p className="text-xs text-muted-foreground/60">อาจใช้เวลา 20-40 วินาที</p>
            </div>
          )}

          {step === "error" && (
            <div className="py-12 text-center space-y-4">
              <p className="text-sm text-destructive">เกิดข้อผิดพลาดในการสร้างโครงตอน</p>
              <Button onClick={generateChapters} variant="outline" className="gap-2">
                <RefreshCw className="w-3.5 h-3.5" />
                ลองใหม่
              </Button>
            </div>
          )}

          {step === "review" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold">โครงตอนทั้งหมด {chapters.length} ตอน</label>
                <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={addChapter}>
                  <Plus className="w-3 h-3" />
                  เพิ่ม
                </Button>
              </div>
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {chapters.map((ch, idx) => (
                  <div key={idx} className="border border-border/60 rounded-lg p-3 bg-muted/30 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground w-6 shrink-0">#{ch.order}</span>
                      <Input
                        value={ch.title}
                        onChange={(e) => updateChapter(idx, "title", e.target.value)}
                        placeholder="ชื่อตอน"
                        className="h-8 text-sm flex-1"
                      />
                      <Select value={ch.act || 1} onValueChange={(v) => updateChapter(idx, "act", Number(v))}>
                        <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">องก์ 1</SelectItem>
                          <SelectItem value="2">องก์ 2</SelectItem>
                          <SelectItem value="3">องก์ 3</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeChapter(idx)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <Textarea
                      value={ch.content}
                      onChange={(e) => updateChapter(idx, "content", e.target.value)}
                      placeholder="โครงย่อของตอน..."
                      rows={3}
                      className="text-xs leading-relaxed"
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="gap-2 flex-1" onClick={() => { setStep("idle"); setChapters([]); }}>
                  ยกเลิก
                </Button>
                <Button
                  className="gap-2 flex-1"
                  onClick={handleSave}
                  disabled={saveMutation.isPending || chapters.every((c) => !c.title)}
                >
                  {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  สร้างตอนร่าง
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={replaceConfirm} onOpenChange={setReplaceConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">มีตอนอยู่แล้ว {existingChapters.length} ตอน</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการ...
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => { setReplaceConfirm(false); saveMutation.mutate({ chaptersToSave: chapters, replace: false }); }}
            >
              เพิ่มต่อท้าย
            </Button>
            <AlertDialogAction
              onClick={() => { setReplaceConfirm(false); saveMutation.mutate({ chaptersToSave: chapters, replace: true }); }}
            >
              แทนที่ทั้งหมด
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}