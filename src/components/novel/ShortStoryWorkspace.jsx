import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Save, Users, ChevronDown, ChevronUp, Scissors, ArrowRight, Expand, CheckCircle2, Bot, Download } from "lucide-react";
import { toast } from "sonner";
import { saveVersion } from "@/lib/saveVersion";
import { useAuth } from "@/lib/AuthContext";
import ExportDialog from "./ExportDialog";

const countThaiWords = (text) => {
  if (!text) return 0;
  const clean = text.replace(/<[^>]*>/g, " ");
  const segmenter = new Intl.Segmenter('th', { granularity: 'word' });
  let count = 0;
  for (const { isWordLike } of segmenter.segment(clean)) {
    if (isWordLike) count++;
  }
  return count;
};

const AI_ACTIONS = [
  { id: "expand", label: "ขยายความ", icon: Expand, color: "text-violet-600", desc: "เพิ่มรายละเอียด ฉาก และบทสนทนา" },
  { id: "polish", label: "ขัดเกลาสำนวน", icon: Sparkles, color: "text-amber-600", desc: "ปรับภาษาให้สละสลวยและไหลลื่น" },
  { id: "trim", label: "ตัดให้กระชับ", icon: Scissors, color: "text-rose-600", desc: "ตัดส่วนเยิ่นเย้อ รักษาใจความ" },
  { id: "continue", label: "เขียนต่อ", icon: ArrowRight, color: "text-emerald-600", desc: "เขียนเนื้อหาต่อจากท้ายเรื่อง" },
];

export default function ShortStoryWorkspace({ novelId, novel }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const textareaRef = useRef(null);

  // โหลดข้อมูล
  const { data: chapters = [], isLoading: loadingChapters } = useQuery({
    queryKey: ["chapters", novelId],
    queryFn: async () => {
      const all = await base44.entities.Chapter.filter({ novel_id: novelId });
      return all.filter((c) => !c.is_deleted).sort((a, b) => a.order - b.order);
    },
  });

  const { data: characters = [] } = useQuery({
    queryKey: ["characters", novelId],
    queryFn: async () => {
      const all = await base44.entities.Character.filter({ novel_id: novelId });
      return all.filter((c) => !c.is_deleted);
    },
  });

  const { data: writerRecord } = useQuery({
    queryKey: ["writers-all"],
    queryFn: () => base44.entities.Writer.list(),
    enabled: !!novel?.writer_id,
    select: (d) => d.find((w) => String(w.id) === String(novel?.writer_id)),
  });

  const chapter = chapters[0];
  const wordTarget = novel?.word_count_target || 2000;

  // Local state
  const [content, setContent] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showChars, setShowChars] = useState(false);
  const [aiAction, setAiAction] = useState(null); // null | action id
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null); // {text, action}
  const [exportOpen, setExportOpen] = useState(false);

  // Sync chapter content → local state
  useEffect(() => {
    if (chapter && content === "") {
      setContent(chapter.content || "");
      setWordCount(countThaiWords(chapter.content || ""));
    }
  }, [chapter]);

  const handleContentChange = (e) => {
    const val = e.target.value;
    setContent(val);
    setWordCount(countThaiWords(val));
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!content.trim()) { toast.error("ยังไม่มีเนื้อหา กรุณาเขียนก่อน"); return; }
    setSaving(true);
    try {
      const wc = countThaiWords(content);
      let targetChapter = chapter;
      if (!targetChapter) {
        // สร้าง chapter ใหม่ถ้ายังไม่มี
        targetChapter = await base44.entities.Chapter.create({
          novel_id: novelId,
          title: novel?.title || "เรื่องสั้น",
          content,
          word_count: wc,
          order: 1,
          status: wc >= 500 ? "เขียนเสร็จ" : "ร่าง",
        });
      } else {
        await saveVersion({ entityType: "chapter", entityId: targetChapter.id, novelId, data: { ...targetChapter, content }, label: "บันทึกด้วยตนเอง", createdByName: user?.full_name || "" });
        await base44.entities.Chapter.update(targetChapter.id, { content, word_count: wc, status: wc >= 500 ? "เขียนเสร็จ" : "ร่าง" });
      }
      setWordCount(wc);
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ["chapters", novelId] });
      toast.success("บันทึกแล้ว");
    } catch (err) {
      toast.error("บันทึกไม่สำเร็จ: " + (err?.message || "เกิดข้อผิดพลาด"));
    } finally {
      setSaving(false);
    }
  };

  // Auto-save debounce
  const autoSaveTimer = useRef(null);
  useEffect(() => {
    if (!isDirty || !chapter) return;
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      const wc = countThaiWords(content);
      await base44.entities.Chapter.update(chapter.id, { content, word_count: wc });
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ["chapters", novelId] });
    }, 3000);
    return () => clearTimeout(autoSaveTimer.current);
  }, [content, isDirty]);

  const handleAiAction = async (actionId) => {
    if (!content.trim()) { toast.error("ยังไม่มีเนื้อหา กรุณาเขียนก่อน"); return; }
    setAiAction(actionId);
    setAiLoading(true);
    setAiResult(null);

    const writerStyle = writerRecord?.system_prompt || "คุณคือนักเขียนนิยายภาษาไทยมืออาชีพ";
    const charDesc = characters.slice(0, 3).map((c) => `${c.name} (${c.role}): ${c.personality || ""}`).join(", ");
    const contentSnippet = content.substring(0, 4000);

    let prompt = `${writerStyle}\n\nเรื่อง: "${novel?.title || ""}" (${novel?.genre || ""})\n`;
    if (charDesc) prompt += `ตัวละคร: ${charDesc}\n`;
    prompt += `\n`;

    if (actionId === "expand") {
      prompt += `[คำสั่ง: ขยายความ]\nรับข้อความด้านล่าง แล้วขยายให้ยาวขึ้นประมาณ 50% โดย:\n- เพิ่มรายละเอียดฉาก อารมณ์ ความรู้สึก\n- เพิ่มบทสนทนาที่เป็นธรรมชาติ\n- รักษาโทน สไตล์ และเส้นเรื่องเดิม\nส่งกลับเฉพาะเนื้อหาที่ขยายแล้ว ไม่มีคำอธิบาย:\n\n${contentSnippet}`;
    } else if (actionId === "polish") {
      prompt += `[คำสั่ง: ขัดเกลาสำนวน]\nรับข้อความด้านล่าง แล้วขัดเกลาให้:\n- ภาษาสละสลวย ไหลลื่น อ่านง่าย\n- ลบคำซ้ำซ้อน ปรับประโยคที่อ่านยาก\n- รักษาเนื้อความและความยาวใกล้เคียงเดิม\nส่งกลับเฉพาะเนื้อหาที่แก้ไขแล้ว ไม่มีคำอธิบาย:\n\n${contentSnippet}`;
    } else if (actionId === "trim") {
      prompt += `[คำสั่ง: ตัดให้กระชับ]\nรับข้อความด้านล่าง แล้วตัดทอนให้สั้นลงประมาณ 30% โดย:\n- ลบส่วนที่เยิ่นเย้อหรือซ้ำซ้อน\n- รักษาจุดพีค อารมณ์สำคัญ และเส้นเรื่อง\n- ทุกประโยคที่เหลือต้องมีความหมาย\nส่งกลับเฉพาะเนื้อหาที่ตัดแล้ว ไม่มีคำอธิบาย:\n\n${contentSnippet}`;
    } else if (actionId === "continue") {
      const tail = content.substring(Math.max(0, content.length - 800));
      prompt += `[คำสั่ง: เขียนต่อ]\nเนื้อเรื่องปัจจุบันจบที่:\n\n${tail}\n\n---\nเขียนต่อจากนี้อีกประมาณ 300-500 คำ รักษาโทนและสไตล์ของเรื่อง ส่งกลับเฉพาะเนื้อหาที่เขียนต่อ ไม่มีคำอธิบาย:`;
    }

    const res = await base44.integrations.Core.InvokeLLM({ prompt, model: "claude_sonnet_4_6" });
    let text = typeof res === "string" ? res : (res?.text || "");
    text = text.replace(/^```[\w]*\n?/m, "").replace(/\n?```$/m, "").trim();

    setAiLoading(false);
    if (text) {
      setAiResult({ text, action: actionId });
    } else {
      toast.error("AI ไม่ได้ส่งผลลัพธ์กลับมา");
      setAiAction(null);
    }
  };

  const applyAiResult = () => {
    if (!aiResult) return;
    const newContent = aiResult.action === "continue"
      ? content + "\n\n" + aiResult.text
      : aiResult.text;
    setContent(newContent);
    setWordCount(countThaiWords(newContent));
    setIsDirty(true);
    setAiResult(null);
    setAiAction(null);
    toast.success("นำข้อความ AI มาใช้แล้ว");
  };

  const discardAiResult = () => { setAiResult(null); setAiAction(null); };

  // Progress bar
  const progressPct = Math.min(100, Math.round((wordCount / wordTarget) * 100));
  const progressColor = progressPct >= 100 ? "bg-emerald-500" : progressPct >= 70 ? "bg-primary" : progressPct >= 40 ? "bg-amber-500" : "bg-rose-400";

  if (loadingChapters) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <>
    <ExportDialog open={exportOpen} onOpenChange={setExportOpen} novel={novel} chapters={chapter ? [{ ...chapter, content }] : []} />
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      {/* Word count progress */}
      <div className="bg-card border border-border/60 rounded-xl px-4 py-3 space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium flex items-center gap-2">
            {wordCount >= wordTarget
              ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              : <span className="text-muted-foreground">✍️</span>
            }
            <span className={wordCount >= wordTarget ? "text-emerald-600" : ""}>
              {wordCount.toLocaleString()} / {wordTarget.toLocaleString()} คำ
            </span>
          </span>
          <div className="flex items-center gap-2">
            {isDirty && <span className="text-[11px] text-amber-600 animate-pulse">● ยังไม่บันทึก</span>}
            <Badge variant="outline" className="text-xs">{progressPct}%</Badge>
            {writerRecord && (
              <span className="text-[11px] text-primary/70 font-medium flex items-center gap-1">
                <Bot className="w-3 h-3" />{writerRecord.name}
              </span>
            )}
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setExportOpen(true)}>
              <Download className="w-3 h-3" />ส่งออก
            </Button>
          </div>
        </div>
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div className={`h-2 rounded-full transition-all duration-300 ${progressColor}`} style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Characters (collapsible) */}
      {characters.length > 0 && (
        <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-muted/30 transition-colors"
            onClick={() => setShowChars((v) => !v)}
          >
            <span className="flex items-center gap-2 font-medium">
              <Users className="w-3.5 h-3.5 text-primary" />
              ตัวละคร ({characters.length})
            </span>
            {showChars ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {showChars && (
            <div className="px-4 pb-3 flex flex-wrap gap-2 border-t border-border/40 pt-2.5">
              {characters.map((c) => (
                <div key={c.id} className="text-xs bg-muted/50 rounded-lg px-3 py-1.5 border border-border/40">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted-foreground ml-1.5">({c.role})</span>
                  {c.personality && <p className="text-muted-foreground mt-0.5">{c.personality}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AI Tools */}
      <div className="bg-card border border-border/60 rounded-xl p-3">
        <p className="text-[11px] font-semibold text-muted-foreground mb-2 px-1">ช่วยเขียน AI</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {AI_ACTIONS.map((a) => (
            <button
              key={a.id}
              onClick={() => handleAiAction(a.id)}
              disabled={aiLoading}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left transition-all text-xs ${
                aiAction === a.id
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border/60 hover:border-primary/40 hover:bg-muted/40"
              } disabled:opacity-50`}
              title={a.desc}
            >
              {aiLoading && aiAction === a.id
                ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                : <a.icon className={`w-3.5 h-3.5 shrink-0 ${a.color}`} />
              }
              <span className="font-medium">{a.label}</span>
            </button>
          ))}
        </div>

        {/* AI result preview */}
        {aiResult && (
          <div className="mt-3 border border-primary/30 rounded-lg overflow-hidden">
            <div className="bg-primary/5 px-3 py-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-primary">ผลลัพธ์จาก AI — ตรวจสอบก่อนนำใช้</span>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={discardAiResult}>ยกเลิก</Button>
                <Button size="sm" className="h-7 text-xs gap-1 bg-primary" onClick={applyAiResult}>
                  <CheckCircle2 className="w-3 h-3" />
                  {aiResult.action === "continue" ? "เพิ่มต่อท้าย" : "แทนที่เนื้อหา"}
                </Button>
              </div>
            </div>
            <ScrollArea className="max-h-48">
              <div className="px-3 py-2 text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">{aiResult.text}</div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Main editor */}
      <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40">
          <span className="text-sm font-medium">เนื้อเรื่อง</span>
          <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 gap-1.5 text-xs">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
        </div>
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          placeholder="เริ่มเขียนเรื่องสั้นของคุณที่นี่..."
          className="min-h-[60vh] border-0 rounded-none resize-none text-sm leading-relaxed focus-visible:ring-0 font-body p-4"
        />
      </div>

      {/* Synopsis & Notes */}
      {novel?.synopsis && (
        <div className="bg-muted/30 border border-border/40 rounded-xl px-4 py-3 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground/70 mb-1">เรื่องย่อ</p>
          <p className="leading-relaxed">{novel.synopsis}</p>
        </div>
      )}
    </div>
    </>
  );
}