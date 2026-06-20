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
import { toast } from "sonner";
import { generateChapterOutlineProgressive } from "@/lib/chapterOutlineProgressive";

export default function AiChapterGeneratorDialog({ open, onClose, novel, novelId }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState("idle");
  const [chapters, setChapters] = useState([]);
  const [replaceConfirm, setReplaceConfirm] = useState(false);
  const [selectedPlotEvents, setSelectedPlotEvents] = useState([]);
  const [genProgress, setGenProgress] = useState({ done: 0, total: 0 });

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
    if (!writer) {
      setStep("error");
      return;
    }
    const targetChapters = novel.target_chapters || 10;
    setChapters([]);
    setGenProgress({ done: 0, total: targetChapters });
    setStep("generating");

    // ผูก plot_event_id กลับจากชื่อเหตุการณ์ (helper รับเฉพาะชื่อ)
    const eventByTitle = new Map(plotEvents.map((e) => [e.title, e]));

    try {
      await generateChapterOutlineProgressive(
        { novel, writer, plotEvents, totalChapters: targetChapters, batchSize: 5 },
        {
          onBatch: (batch) => {
            // ทยอยแสดงแต่ละ batch ทันทีที่เสร็จ + อัปเดต progress จริง
            setChapters((prev) => {
              const merged = [...prev];
              batch.forEach((c) => {
                const ev = c.plot_event_title ? eventByTitle.get(c.plot_event_title) : null;
                merged.push({
                  order: c.order,
                  title: c.title,
                  content: c.content,
                  act: c.act,
                  plot_event_id: ev?.id || null,
                  plot_event_title: c.plot_event_title || null,
                });
              });
              const deduped = Array.from(new Map(merged.map((c) => [c.order, c])).values())
                .sort((a, b) => a.order - b.order);
              setGenProgress({ done: deduped.length, total: targetChapters });
              return deduped;
            });
          },
          onError: (order, msg) => toast.error(`ช่วงตอนที่ ${order}+ สร้างไม่สำเร็จ: ${msg}`),
        },
        { onRetry: ({ attempt, maxAttempts }) => toast.info(`AI ไม่ตอบสนอง กำลังลองใหม่ (${attempt}/${maxAttempts - 1})...`) }
      );

      setChapters((prev) => {
        if (prev.length === 0) {
          setStep("error");
          toast.error("สร้างโครงตอนไม่สำเร็จ");
          return prev;
        }
        setStep("review");
        toast.success(`สร้างโครงตอนสำเร็จ ${prev.length} ตอน`);
        return prev;
      });
    } catch (err) {
      console.error("Generate chapters error:", err);
      setStep("error");
      toast.error(`สร้างโครงตอนไม่สำเร็จ: ${err.message}`);
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
              {!writer && novel?.writer_id ? (
                <div className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                  กำลังโหลดข้อมูลนักเขียน...
                </div>
              ) : !novel?.writer_id ? (
                <div className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                  ⚠️ นิยายนี้ยังไม่มีนักเขียน AI กรุณาแก้ไขนิยายและเลือกนักเขียนก่อน
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    AI จะสร้างโครงตอนย่อย {novel?.target_chapters || 10} ตอน จากโครงเรื่อง 3 องก์และไทม์ไลน์ที่มี
                    <br />แต่ละตอนจะมีชื่อตอน โครงย่อ และผูกกับเหตุการณ์ไทม์ไลน์ (ถ้ามี)
                  </p>
                  {writer && (
                    <div className="text-xs text-primary/70 bg-primary/5 border border-primary/15 rounded-lg px-3 py-2">
                      นักเขียน AI: <strong>{writer.name}</strong>
                    </div>
                  )}
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
                </>
              )}
            </div>
          )}

          {step === "generating" && (
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    กำลังสร้างโครงตอน...
                  </span>
                  <span className="text-muted-foreground font-medium">{genProgress.done} / {genProgress.total} ตอน</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-primary h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${genProgress.total > 0 ? Math.round((genProgress.done / genProgress.total) * 100) : 0}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">ทยอยแสดงโครงแต่ละตอนทันทีที่สร้างเสร็จ</p>
              </div>

              {chapters.length > 0 && (
                <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                  {chapters.map((ch, idx) => (
                    <div key={idx} className="border border-border/50 rounded-lg p-3 bg-muted/20 animate-in fade-in slide-in-from-bottom-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-muted-foreground w-6 shrink-0">#{ch.order}</span>
                        <span className="text-sm font-semibold flex-1">{ch.title}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{getActLabel(ch.act)}</span>
                      </div>
                      {ch.content && <p className="text-xs text-muted-foreground line-clamp-2 pl-8">{ch.content}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === "error" && (
            <div className="py-12 text-center space-y-4">
              {!novel?.writer_id ? (
                <p className="text-sm text-destructive">⚠️ นิยายนี้ยังไม่มีนักเขียน AI กรุณาแก้ไขนิยายและเลือกนักเขียนก่อน</p>
              ) : (
                <>
                  <p className="text-sm text-destructive">เกิดข้อผิดพลาดในการสร้างโครงตอน</p>
                  <Button onClick={generateChapters} variant="outline" className="gap-2">
                    <RefreshCw className="w-3.5 h-3.5" />
                    ลองใหม่
                  </Button>
                </>
              )}
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