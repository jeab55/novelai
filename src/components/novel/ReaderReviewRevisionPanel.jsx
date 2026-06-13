import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2, Users, BookOpen, Wand2, Save, X, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

// ——— diff: paragraph-level ———
function splitParas(text) {
  return (text || "").split(/\n/).map((p) => p.trimEnd());
}

function diffParas(oldText, newText) {
  const oldSet = new Set(splitParas(oldText).filter((p) => p.trim() !== ""));
  const result = [];
  for (const para of splitParas(newText)) {
    if (para.trim() === "") {
      result.push({ type: "same", text: "" });
    } else if (oldSet.has(para)) {
      result.push({ type: "same", text: para });
    } else {
      result.push({ type: "added", text: para });
    }
  }
  return result;
}

// ——— prompt builder ———
function buildPrompt(novel, characters, chapter, reviews, reviewerLabel, writerSystemPrompt) {
  let ctx = `[บทบาท]\n${writerSystemPrompt || "คุณคือนักเขียนนิยายภาษาไทยมืออาชีพ"}\n\n`;
  ctx += `[บริบทเรื่อง]\nชื่อเรื่อง: ${novel.title}\n`;
  if (novel.genre) ctx += `แนว: ${novel.genre}\n`;
  if (novel.era) ctx += `ยุคสมัย: ${novel.era}\n`;
  if (novel.synopsis) ctx += `เรื่องย่อ: ${novel.synopsis}\n`;

  if (characters.length > 0) {
    ctx += `\n[ตัวละคร]\n`;
    characters.forEach((c) => {
      ctx += `• ${c.name} (${c.role || "ตัวประกอบ"})${c.personality ? ` — ${c.personality}` : ""}\n`;
    });
  }

  if (chapter.plot_event_id && chapter.plot_event_title) {
    ctx += `\n[เหตุการณ์ไทม์ไลน์]\nลำดับ ${chapter.plot_event_order}: ${chapter.plot_event_title}\n`;
    if (chapter.plot_event_description) ctx += `รายละเอียด: ${chapter.plot_event_description}\n`;
  }

  ctx += `\n[ความคิดเห็นจาก${reviewerLabel} — นำไปปรับปรุงทั้งหมด]\n`;
  reviews.forEach((r, i) => {
    ctx += `${i + 1}. ${r.reviewer_name}: ${r.content}\n`;
  });

  ctx += `\n[เนื้อหาตอนปัจจุบัน]\n${chapter.content}\n\n`;
  ctx += `[คำสั่ง]\n`;
  ctx += `- ปรับปรุงเนื้อหาตามความคิดเห็นของ${reviewerLabel}ทั้งหมดข้างต้น\n`;
  ctx += `- รักษาโครงเรื่อง ตัวละคร และสไตล์การเขียนของนักเขียน AI ประจำเรื่องไว้\n`;
  ctx += `- แก้ไขเพื่อปรับปรุง ไม่ใช่เขียนใหม่ทั้งตอน\n`;
  ctx += `- ผลลัพธ์: เฉพาะเนื้อหาตอนที่ปรับปรุงแล้ว ไม่ต้องมีคำอธิบายหรือ prefix ใดๆ\n`;
  return ctx;
}

// ——— config per reviewer type ———
const REVISION_TYPES = {
  reader: {
    key: "reader",
    reviewerType: "นักอ่าน",
    label: "นักอ่าน",
    buttonLabel: "แก้ตามรีวิวนักอ่าน",
    icon: Users,
    color: "#16a34a",         // green-600
    badgeCls: "bg-green-100 text-green-700 border-green-200",
    cardCls: "border-green-200 bg-green-50/60 dark:bg-green-950/20 dark:border-green-800/40",
    nameColorCls: "text-green-800 dark:text-green-300",
    btnCls: "bg-green-600 hover:bg-green-700 text-white",
    legendLabel: "เขียว = แก้ตามนักอ่าน",
    legendDotCls: "bg-green-500",
  },
  editor: {
    key: "editor",
    reviewerType: "บรรณาธิการ AI",
    label: "บรรณาธิการ AI",
    buttonLabel: "แก้ตามรีวิวบรรณาธิการ",
    icon: BookOpen,
    color: "#dc2626",         // red-600
    badgeCls: "bg-red-100 text-red-700 border-red-200",
    cardCls: "border-red-200 bg-red-50/60 dark:bg-red-950/20 dark:border-red-800/40",
    nameColorCls: "text-red-800 dark:text-red-300",
    btnCls: "bg-red-600 hover:bg-red-700 text-white",
    legendLabel: "แดง = แก้ตามบรรณาธิการ",
    legendDotCls: "bg-red-500",
  },
};

// ——— single revision button section ———
function RevisionSection({ cfg, reviews, chapter, novel, novelId, characters, novelWriter, onContentUpdate }) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [diffResult, setDiffResult] = useState(null);
  const [revisedContent, setRevisedContent] = useState(null);
  const [originalContent, setOriginalContent] = useState(null);

  const filteredReviews = reviews.filter((r) => r.reviewer_type === cfg.reviewerType);
  if (filteredReviews.length === 0) return null;

  const Icon = cfg.icon;

  const handleRevise = async () => {
    if (!chapter.content?.trim()) { toast.error("ไม่มีเนื้อหาตอนให้ปรับปรุง"); return; }
    setLoading(true);
    setDiffResult(null);
    setRevisedContent(null);
    setOriginalContent(null);

    const prompt = buildPrompt(novel, characters, chapter, filteredReviews, cfg.label, novelWriter?.system_prompt);
    const result = await base44.integrations.Core.InvokeLLM({ prompt, model: "claude_sonnet_4_6" });
    const revised = (typeof result === "string" ? result : result?.text || "").trim();

    setDiffResult(diffParas(chapter.content, revised));
    setRevisedContent(revised);
    setOriginalContent(chapter.content);
    setLoading(false);
    toast.success("AI แก้ไขเนื้อหาเรียบร้อยแล้ว — ตรวจสอบและกด 'บันทึก' เพื่อยืนยัน");
  };

  const handleSave = async () => {
    if (!revisedContent) return;
    await base44.entities.Chapter.update(chapter.id, {
      previous_content: originalContent,
      content: revisedContent,
      word_count: 0,
    });
    queryClient.invalidateQueries({ queryKey: ["chapters", novelId] });
    onContentUpdate(revisedContent, originalContent);
    setDiffResult(null);
    setRevisedContent(null);
    setOriginalContent(null);
    toast.success("บันทึกแล้ว — เนื้อหาเดิมถูกเก็บไว้ใน 'ฉบับสำรอง'");
  };

  const handleCancel = () => {
    setDiffResult(null);
    setRevisedContent(null);
    setOriginalContent(null);
  };

  return (
    <div className="space-y-2 pt-2 first:pt-0">
      {/* review list */}
      <div className="space-y-1.5">
        <div className={`flex items-center gap-1.5 text-[11px] font-medium px-1`}>
          <Icon className="w-3 h-3" style={{ color: cfg.color }} />
          <span className="text-muted-foreground">{cfg.label} ({filteredReviews.length} รีวิว)</span>
        </div>
        {filteredReviews.map((r) => (
          <div key={r.id} className={`rounded-xl border px-3 py-2 text-xs ${cfg.cardCls}`}>
            <span className={`font-semibold ${cfg.nameColorCls}`}>{r.reviewer_name}: </span>
            <span className="text-foreground/80">{r.content}</span>
          </div>
        ))}
      </div>

      {/* action button */}
      {!diffResult && (
        <Button
          size="sm"
          className={`h-8 text-xs gap-1.5 ${cfg.btnCls}`}
          onClick={handleRevise}
          disabled={loading}
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
          {loading ? "AI กำลังแก้ไขเนื้อหา..." : cfg.buttonLabel}
        </Button>
      )}

      {loading && (
        <p className="text-[11px] text-muted-foreground/70 italic">
          AI กำลังอ่านรีวิวและปรับปรุงเนื้อหา... อาจใช้เวลา 30-60 วินาที
        </p>
      )}

      {/* diff preview */}
      {diffResult && (
        <div className="space-y-2">
          {/* diff view */}
          <div
            className="rounded-xl border border-border/60 bg-background px-5 py-4 max-h-[50vh] overflow-y-auto"
            style={{ fontFamily: "'Sarabun', 'Noto Sans Thai', sans-serif", fontSize: "15px", lineHeight: "1.95" }}
          >
            {diffResult.map((seg, i) =>
              seg.text === "" ? (
                <br key={i} />
              ) : seg.type === "added" ? (
                <span key={i} style={{ color: cfg.color, fontWeight: 500 }}>
                  {seg.text}{i < diffResult.length - 1 ? "\n" : ""}
                </span>
              ) : (
                <span key={i} style={{ color: "hsl(var(--foreground))" }}>
                  {seg.text}{i < diffResult.length - 1 ? "\n" : ""}
                </span>
              )
            )}
          </div>

          {/* save / cancel */}
          <div className="flex items-center gap-2">
            <Button size="sm" className={`h-8 text-xs gap-1.5 ${cfg.btnCls}`} onClick={handleSave}>
              <Save className="w-3.5 h-3.5" />
              บันทึก (ลบไฮไลต์ + บันทึกทับ)
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-muted-foreground" onClick={handleCancel}>
              <X className="w-3.5 h-3.5" />
              ยกเลิก
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ——— main panel ———
export default function ReaderReviewRevisionPanel({ chapter, novel, novelId, onContentUpdate }) {
  const [open, setOpen] = useState(false);

  const { data: allReviews = [] } = useQuery({
    queryKey: ["reviews", chapter.id],
    queryFn: () => base44.entities.Review.filter({ chapter_id: chapter.id }, "created_date"),
    enabled: open,
  });

  const { data: novelWriter } = useQuery({
    queryKey: ["writers-all"],
    queryFn: () => base44.entities.Writer.list(),
    enabled: open && !!novel?.writer_id,
    select: (data) => data.find((w) => String(w.id) === String(novel?.writer_id)),
  });

  const { data: characters = [] } = useQuery({
    queryKey: ["characters", novelId],
    queryFn: () => base44.entities.Character.filter({ novel_id: novelId }),
    enabled: open,
  });

  const readerCount = allReviews.filter((r) => r.reviewer_type === "นักอ่าน").length;
  const editorCount = allReviews.filter((r) => r.reviewer_type === "บรรณาธิการ AI").length;
  const totalRelevant = readerCount + editorCount;

  return (
    <div className="border-b border-border/50 bg-card/10">
      {/* header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2 text-xs hover:bg-muted/30 transition-colors"
      >
        <Wand2 className="w-3.5 h-3.5 text-primary/60" />
        <span className="font-medium text-foreground/70">AI แก้ตามรีวิว</span>
        {totalRelevant > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary/70 text-[10px] font-medium">
            {totalRelevant} รีวิว
          </span>
        )}
        {/* legend */}
        <span className="ml-auto flex items-center gap-2 mr-2">
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />เขียว=นักอ่าน
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />แดง=บรรณาธิการ
          </span>
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 divide-y divide-border/30 space-y-0">
          {totalRelevant === 0 ? (
            <p className="text-xs text-muted-foreground/60 italic py-2">
              ยังไม่มีรีวิวจากนักอ่านหรือบรรณาธิการสำหรับตอนนี้
            </p>
          ) : (
            <>
              <RevisionSection
                cfg={REVISION_TYPES.reader}
                reviews={allReviews}
                chapter={chapter}
                novel={novel}
                novelId={novelId}
                characters={characters}
                novelWriter={novelWriter}
                onContentUpdate={onContentUpdate}
              />
              <RevisionSection
                cfg={REVISION_TYPES.editor}
                reviews={allReviews}
                chapter={chapter}
                novel={novel}
                novelId={novelId}
                characters={characters}
                novelWriter={novelWriter}
                onContentUpdate={onContentUpdate}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}