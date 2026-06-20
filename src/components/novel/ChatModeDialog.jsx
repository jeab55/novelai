import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessagesSquare, Loader2, Sparkles, Download, Copy } from "lucide-react";
import { toast } from "sonner";
import { invokeAIStable } from "@/lib/aiInvoke";
import { downloadFile } from "@/lib/storyboardExport";

export default function ChatModeDialog({ open, onClose, novels = [] }) {
  const [novelId, setNovelId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [lines, setLines] = useState([]);
  const [meta, setMeta] = useState(null);

  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters-for-chatmode", novelId],
    queryFn: async () => {
      const list = await base44.entities.Chapter.filter({ novel_id: novelId });
      return list.filter((c) => !c.is_deleted).sort((a, b) => (a.order || 0) - (b.order || 0));
    },
    enabled: open && !!novelId,
  });

  const selectedNovel = novels.find((n) => n.id === novelId);
  const selectedChapter = chapters.find((c) => c.id === chapterId);

  const reset = () => {
    setNovelId(""); setChapterId(""); setLines([]); setMeta(null);
  };
  const handleClose = () => {
    if (generating) return;
    reset();
    onClose();
  };

  // กำหนดตัวละครหลัก = ผู้พูดที่ปรากฏมากสุด → จัดเป็นบับเบิลขวา
  const mainSpeaker = (() => {
    const counts = {};
    lines.forEach((l) => { if (l.type !== "narration" && l.speaker) counts[l.speaker] = (counts[l.speaker] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  })();

  const handleGenerate = async () => {
    if (!novelId) { toast.error("กรุณาเลือกนิยาย"); return; }
    if (!chapterId) { toast.error("กรุณาเลือกตอน"); return; }
    const text = (selectedChapter?.content || "").replace(/<[^>]*>/g, " ").trim();
    if (!text) { toast.error("ตอนนี้ยังไม่มีเนื้อหา"); return; }

    setGenerating(true);
    setLines([]);
    try {
      const prompt = `คุณคือบรรณาธิการนิยายแชต (จอยลดา) จงแปลงเนื้อหาตอนนิยายต่อไปนี้ให้เป็น "รูปแบบบทสนทนาแชต" สำหรับลงจอยลดา

ข้อกำหนด:
- แยกเป็นรายการข้อความตามลำดับเหตุการณ์
- แต่ละรายการมี: type ("dialogue" = บทพูดของตัวละคร, "narration" = คำบรรยาย/ผู้เล่า), speaker (ชื่อผู้พูด ถ้าเป็น narration ให้ใส่ "ผู้เล่า"), text (ข้อความที่พูด/บรรยาย)
- คงเนื้อเรื่องและเหตุการณ์เดิมทั้งหมด แปลงคำบรรยายยาวให้เป็นข้อความแชตสั้นๆ อ่านลื่นแบบจอยลดา
- บทสนทนาให้ใช้ชื่อตัวละครเป็น speaker; ส่วนบรรยายฉาก/ความรู้สึกให้เป็น narration
- ภาษาไทยทั้งหมด เป็นธรรมชาติ

เนื้อหาตอน "${selectedChapter?.title || ""}":
"""
${text.slice(0, 14000)}
"""`;

      const result = await invokeAIStable({
        prompt,
        model: "claude_sonnet_4_6",
        response_json_schema: {
          type: "object",
          properties: {
            messages: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  speaker: { type: "string" },
                  text: { type: "string" },
                },
              },
            },
          },
        },
      });

      const parsed = typeof result === "string" ? JSON.parse(result) : result;
      const list = parsed?.messages || parsed?.response?.messages || parsed?.output?.messages || [];
      if (!Array.isArray(list) || list.length === 0) throw new Error("ไม่สามารถแปลงเป็นแชตได้");
      setLines(list);
      setMeta({ title: selectedChapter?.title, novel: selectedNovel?.title });
      toast.success(`แปลงเป็นแชตสำเร็จ: ${list.length} ข้อความ`);
    } catch (e) {
      toast.error("แปลงไม่สำเร็จ: " + (e.message || ""));
    } finally {
      setGenerating(false);
    }
  };

  const buildExport = () =>
    lines.map((l) => l.type === "narration" ? `(${l.text})` : `${l.speaker}: ${l.text}`).join("\n");

  const exportText = () => {
    downloadFile(buildExport(), `chat-${meta?.title || "chapter"}.txt`, "text/plain;charset=utf-8");
    toast.success("ดาวน์โหลดข้อความแชตแล้ว");
  };
  const copyAll = () => {
    navigator.clipboard.writeText(buildExport());
    toast.success("คัดลอกบทแชตทั้งหมดแล้ว");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <MessagesSquare className="w-5 h-5 text-primary" />โหมดแชต (จอยลดา)
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-4">
          <div className="bg-secondary/40 rounded-xl border border-border/50 p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">เลือกนิยาย</label>
                <Select value={novelId} onValueChange={(v) => { setNovelId(v); setChapterId(""); }}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="เลือกนิยาย" /></SelectTrigger>
                  <SelectContent>{novels.map((n) => <SelectItem key={n.id} value={n.id}>{n.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">เลือกตอน</label>
                <Select value={chapterId} onValueChange={setChapterId} disabled={!novelId}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="เลือกตอน" /></SelectTrigger>
                  <SelectContent>
                    {chapters.map((c) => <SelectItem key={c.id} value={c.id}>{c.order ? `${c.order}. ` : ""}{c.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full gap-2 h-11" onClick={handleGenerate} disabled={generating || !novelId || !chapterId}>
              {generating ? <><Loader2 className="w-4 h-4 animate-spin" />กำลังแปลงเป็นแชต...</> : <><Sparkles className="w-4 h-4" />แปลงเป็นแชต</>}
            </Button>
          </div>

          {lines.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm font-semibold">{lines.length} ข้อความ · พรีวิวแบบจอยลดา</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={copyAll}><Copy className="w-3.5 h-3.5" />คัดลอก</Button>
                  <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={exportText}><Download className="w-3.5 h-3.5" />Export</Button>
                </div>
              </div>

              <div className="rounded-2xl border border-border/60 bg-gradient-to-b from-secondary/30 to-background p-4 space-y-2.5">
                {lines.map((l, i) => {
                  if (l.type === "narration") {
                    return (
                      <div key={i} className="text-center">
                        <span className="inline-block text-xs text-muted-foreground bg-muted/60 rounded-full px-3 py-1 italic">{l.text}</span>
                      </div>
                    );
                  }
                  const isRight = l.speaker === mainSpeaker;
                  return (
                    <div key={i} className={`flex flex-col ${isRight ? "items-end" : "items-start"}`}>
                      <span className="text-[10px] text-muted-foreground mb-0.5 px-1">{l.speaker}</span>
                      <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm ${isRight ? "bg-primary text-primary-foreground rounded-br-md" : "bg-card border border-border rounded-bl-md"}`}>
                        {l.text}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}