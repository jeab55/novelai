import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessagesSquare, Loader2, Sparkles, Download, Copy, Save } from "lucide-react";
import { toast } from "sonner";
import { invokeAIStable } from "@/lib/aiInvoke";
import { downloadFile } from "@/lib/storyboardExport";
import ChatModeSettings, { BUBBLE_COLORS } from "@/components/novel/ChatModeSettings";

const colorCls = (key) => BUBBLE_COLORS.find((c) => c.key === key)?.cls || BUBBLE_COLORS[0].cls;

export default function ChatModeDialog({ open, onClose, novels = [] }) {
  const [novelId, setNovelId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lines, setLines] = useState([]);
  const [meta, setMeta] = useState(null);
  const queryClient = useQueryClient();

  // settings
  const [rightSpeaker, setRightSpeaker] = useState("");
  const [showNarration, setShowNarration] = useState(true);
  const [rightColor, setRightColor] = useState("primary");
  const [leftColor, setLeftColor] = useState("card");
  const [nameMap, setNameMap] = useState({});

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

  // โหลดเวอร์ชันแชตที่บันทึกไว้ของตอนนี้ (ถ้ามี)
  useEffect(() => {
    if (!selectedChapter) { setLines([]); setMeta(null); return; }
    if (selectedChapter.chat_version) {
      try {
        const saved = JSON.parse(selectedChapter.chat_version);
        const list = Array.isArray(saved?.lines) ? saved.lines : [];
        if (list.length > 0) {
          setLines(list);
          setMeta({ title: selectedChapter.title, novel: selectedNovel?.title });
          if (saved.settings) {
            setRightSpeaker(saved.settings.rightSpeaker || "");
            setShowNarration(saved.settings.showNarration ?? true);
            setRightColor(saved.settings.rightColor || "primary");
            setLeftColor(saved.settings.leftColor || "card");
            setNameMap(saved.settings.nameMap || {});
          }
          return;
        }
      } catch { /* ignore parse error */ }
    }
    setLines([]); setMeta(null);
  }, [chapterId]); // eslint-disable-line react-hooks/exhaustive-deps

  // รายชื่อตัวละคร (ผู้พูดที่ไม่ใช่บรรยาย) เรียงตามความถี่
  const speakers = useMemo(() => {
    const counts = {};
    lines.forEach((l) => { if (l.type !== "narration" && l.speaker) counts[l.speaker] = (counts[l.speaker] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([s]) => s);
  }, [lines]);

  // ตั้งค่าเริ่มต้นเมื่อได้ผลลัพธ์ใหม่: ฝั่งขวา = ตัวละครที่พูดมากสุด (เฉพาะเมื่อยังไม่ได้ตั้งค่า)
  useEffect(() => {
    if (speakers.length > 0 && !rightSpeaker) {
      setRightSpeaker(speakers[0]);
      setNameMap((m) => Object.keys(m).length ? m : Object.fromEntries(speakers.map((s) => [s, s])));
    }
  }, [speakers]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayName = (s) => nameMap[s] || s;

  const reset = () => {
    setNovelId(""); setChapterId(""); setLines([]); setMeta(null);
    setRightSpeaker(""); setShowNarration(true); setRightColor("primary"); setLeftColor("card"); setNameMap({});
  };
  const handleClose = () => {
    if (generating) return;
    reset();
    onClose();
  };

  const handleGenerate = async () => {
    if (!novelId) { toast.error("กรุณาเลือกนิยาย"); return; }
    if (!chapterId) { toast.error("กรุณาเลือกตอน"); return; }
    const text = (selectedChapter?.content || "").replace(/<[^>]*>/g, " ").trim();
    if (!text) { toast.error("ตอนนี้ยังไม่มีเนื้อหา"); return; }

    setGenerating(true);
    setLines([]); setRightSpeaker(""); setNameMap({});
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

  const handleSave = async () => {
    if (!chapterId || lines.length === 0) return;
    setSaving(true);
    try {
      const payload = {
        lines,
        settings: { rightSpeaker, showNarration, rightColor, leftColor, nameMap },
        saved_at: new Date().toISOString(),
      };
      await base44.entities.Chapter.update(chapterId, { chat_version: JSON.stringify(payload) });
      await queryClient.invalidateQueries({ queryKey: ["chapters-for-chatmode", novelId] });
      toast.success("บันทึกเวอร์ชันแชตลงตอนแล้ว");
    } catch (e) {
      toast.error("บันทึกไม่สำเร็จ: " + (e.message || ""));
    } finally {
      setSaving(false);
    }
  };

  const visibleLines = lines.filter((l) => showNarration || l.type !== "narration");

  // Export แบบจอยลดา: "ชื่อตัวละคร: ข้อความ" ทีละบรรทัด (บรรยายอยู่ในวงเล็บ ถ้าเปิดแสดง)
  const buildExport = () =>
    visibleLines.map((l) =>
      l.type === "narration" ? `(${l.text})` : `${displayName(l.speaker)}: ${l.text}`
    ).join("\n");

  const exportText = () => {
    downloadFile(buildExport(), `joylada-${meta?.title || "chapter"}.txt`, "text/plain;charset=utf-8");
    toast.success("ดาวน์โหลดบทแชตสำหรับจอยลดาแล้ว");
  };
  const copyAll = () => {
    navigator.clipboard.writeText(buildExport());
    toast.success("คัดลอกบทแชต (รูปแบบจอยลดา) แล้ว");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-xl max-h-[90vh] flex flex-col">
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
              {generating ? <><Loader2 className="w-4 h-4 animate-spin" />กำลังแปลงเป็นแชต...</> : <><Sparkles className="w-4 h-4" />{lines.length > 0 ? "แปลงใหม่อีกครั้ง" : "แปลงเป็นแชต"}</>}
            </Button>
          </div>

          {lines.length > 0 && (
            <>
              <ChatModeSettings
                speakers={speakers}
                rightSpeaker={rightSpeaker} setRightSpeaker={setRightSpeaker}
                showNarration={showNarration} setShowNarration={setShowNarration}
                rightColor={rightColor} setRightColor={setRightColor}
                leftColor={leftColor} setLeftColor={setLeftColor}
                nameMap={nameMap} setName={(s, v) => setNameMap((m) => ({ ...m, [s]: v }))}
              />

              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-sm font-semibold">{visibleLines.length} ข้อความ · พรีวิวแบบจอยลดา</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={copyAll}><Copy className="w-3.5 h-3.5" />คัดลอก</Button>
                    <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={exportText}><Download className="w-3.5 h-3.5" />Export จอยลดา</Button>
                    <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={handleSave} disabled={saving}>
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}บันทึกลงตอน
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/60 bg-gradient-to-b from-secondary/30 to-background p-4 space-y-2.5">
                  {visibleLines.map((l, i) => {
                    if (l.type === "narration") {
                      return (
                        <div key={i} className="text-center">
                          <span className="inline-block text-xs text-muted-foreground bg-muted/60 rounded-full px-3 py-1 italic">{l.text}</span>
                        </div>
                      );
                    }
                    const isRight = l.speaker === rightSpeaker;
                    return (
                      <div key={i} className={`flex flex-col ${isRight ? "items-end" : "items-start"}`}>
                        <span className="text-[10px] text-muted-foreground mb-0.5 px-1">{displayName(l.speaker)}</span>
                        <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm ${colorCls(isRight ? rightColor : leftColor)} ${isRight ? "rounded-br-md" : "rounded-bl-md"}`}>
                          {l.text}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}