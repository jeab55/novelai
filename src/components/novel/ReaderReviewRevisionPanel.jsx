import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2, Users, BookOpen, Wand2, Save, X, ChevronDown, ChevronUp, Star } from "lucide-react";
import { toast } from "sonner";

// ——— diff: paragraph-level ———
function splitParas(text) {
  return (text || "").split(/\n/).map((p) => p.trimEnd());
}
function diffParas(oldText, newText) {
  const oldSet = new Set(splitParas(oldText).filter((p) => p.trim() !== ""));
  return splitParas(newText).map((para) => ({
    type: para.trim() === "" ? "same" : oldSet.has(para) ? "same" : "added",
    text: para,
  }));
}

// ——— prompt builder (single review) ———
function buildSinglePrompt(novel, characters, chapter, review, reviewerLabel, writerSystemPrompt) {
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
  ctx += `\n[ความคิดเห็นจาก${reviewerLabel} — ปรับปรุงเฉพาะตามรีวิวนี้เท่านั้น]\n`;
  ctx += `${review.reviewer_name}: ${review.content}\n`;
  ctx += `\n[เนื้อหาตอนปัจจุบัน]\n${chapter.content}\n\n`;
  ctx += `[คำสั่ง]\n`;
  ctx += `- ปรับปรุงเนื้อหาเฉพาะตามความคิดเห็นข้างต้น ไม่ต้องแก้ส่วนอื่น\n`;
  ctx += `- รักษาโครงเรื่อง ตัวละคร และสไตล์การเขียนของนักเขียน AI ประจำเรื่องไว้\n`;
  ctx += `- ผลลัพธ์: เฉพาะเนื้อหาตอนที่ปรับปรุงแล้ว ไม่ต้องมีคำอธิบายหรือ prefix ใดๆ\n`;
  return ctx;
}

// ——— config ———
const CFG = {
  reader: {
    reviewerType: "นักอ่าน",
    label: "นักอ่าน",
    icon: Users,
    color: "#16a34a",
    cardBorder: "border-green-200",
    cardBg: "bg-green-50/60 dark:bg-green-950/20",
    nameCls: "text-green-800 dark:text-green-300",
    btnCls: "bg-green-600 hover:bg-green-700 text-white",
    dotCls: "bg-green-500",
  },
  editor: {
    reviewerType: "บรรณาธิการ AI",
    label: "บรรณาธิการ AI",
    icon: BookOpen,
    color: "#dc2626",
    cardBorder: "border-red-200",
    cardBg: "bg-red-50/60 dark:bg-red-950/20",
    nameCls: "text-red-800 dark:text-red-300",
    btnCls: "bg-red-600 hover:bg-red-700 text-white",
    dotCls: "bg-red-500",
  },
};

// ——— single-review card with inline diff ———
function ReviewRevisionCard({ review, cfg, chapter, novel, characters, novelWriter, novelId, onContentUpdate }) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [diffResult, setDiffResult] = useState(null);
  const [revisedContent, setRevisedContent] = useState(null);
  const [originalContent, setOriginalContent] = useState(null);

  const handleRevise = async () => {
    if (!chapter.content?.trim()) { toast.error("ไม่มีเนื้อหาตอนให้ปรับปรุง"); return; }
    setLoading(true);
    setDiffResult(null);
    setRevisedContent(null);
    setOriginalContent(null);
    const prompt = buildSinglePrompt(novel, characters, chapter, review, cfg.label, novelWriter?.system_prompt);
    const result = await base44.integrations.Core.InvokeLLM({ prompt, model: "claude_sonnet_4_6" });
    const revised = (typeof result === "string" ? result : result?.text || "").trim();
    setDiffResult(diffParas(chapter.content, revised));
    setRevisedContent(revised);
    setOriginalContent(chapter.content);
    setLoading(false);
    toast.success("AI แก้ไขเรียบร้อย — ตรวจสอบและกด 'บันทึก'");
  };

  const handleSave = async () => {
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
    <div className={`rounded-xl border ${cfg.cardBorder} ${cfg.cardBg} overflow-hidden`}>
      {/* review content */}
      <div className="px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <span className={`text-xs font-semibold ${cfg.nameCls}`}>{review.reviewer_name}</span>
            {review.star_rating > 0 && (
              <span className="ml-1.5 text-[10px] text-amber-600 font-medium">
                {"★".repeat(review.star_rating)}{"☆".repeat(5 - review.star_rating)}
              </span>
            )}
            <p className="text-xs text-foreground/80 mt-0.5 leading-relaxed">{review.content}</p>
          </div>
          {/* ปุ่มปรับปรุง */}
          {!diffResult && (
            <Button
              size="sm"
              className={`h-7 text-[11px] gap-1 shrink-0 ${cfg.btnCls}`}
              onClick={handleRevise}
              disabled={loading}
            >
              {loading
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <Wand2 className="w-3 h-3" />}
              {loading ? "กำลังแก้..." : "ปรับปรุงตามรีวิวนี้"}
            </Button>
          )}
        </div>
      </div>

      {/* diff preview */}
      {diffResult && (
        <div className="border-t border-border/40 px-3 py-3 space-y-2 bg-background/60">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: cfg.color }} />
            ข้อความที่แก้ไข/เพิ่ม · ข้อความสีปกติ = ไม่เปลี่ยน
          </div>
          <div
            className="rounded-lg border border-border/50 bg-card px-4 py-3 max-h-[40vh] overflow-y-auto text-sm leading-relaxed"
            style={{ fontFamily: "'Sarabun', 'Noto Sans Thai', sans-serif", fontSize: "14px", lineHeight: "1.9" }}
          >
            {diffResult.map((seg, i) =>
              seg.text === "" ? <br key={i} /> : seg.type === "added" ? (
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
          <div className="flex items-center gap-2">
            <Button size="sm" className={`h-7 text-[11px] gap-1 ${cfg.btnCls}`} onClick={handleSave}>
              <Save className="w-3 h-3" />บันทึกทับ
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 text-muted-foreground" onClick={handleCancel}>
              <X className="w-3 h-3" />ยกเลิก
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ——— grouped section ———
function ReviewGroup({ cfgKey, reviews, chapter, novel, novelId, characters, novelWriter, onContentUpdate }) {
  const cfg = CFG[cfgKey];
  const filtered = reviews.filter((r) => r.reviewer_type === cfg.reviewerType);
  if (!filtered.length) return null;
  const Icon = cfg.icon;

  return (
    <div className="space-y-2 py-2 first:pt-0">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground px-0.5">
        <span className={`w-2 h-2 rounded-full ${cfg.dotCls}`} />
        <Icon className="w-3 h-3" style={{ color: cfg.color }} />
        {cfg.label} ({filtered.length} รีวิว) — เลือกปรับปรุงรายอัน
      </div>
      <div className="space-y-2">
        {filtered.map((r) => (
          <ReviewRevisionCard
            key={r.id}
            review={r}
            cfg={cfg}
            chapter={chapter}
            novel={novel}
            characters={characters}
            novelWriter={novelWriter}
            novelId={novelId}
            onContentUpdate={onContentUpdate}
          />
        ))}
      </div>
    </div>
  );
}

// ——— main export ———
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
  const total = readerCount + editorCount;

  return (
    <div className="border-b border-border/50 bg-card/10">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2 text-xs hover:bg-muted/30 transition-colors"
      >
        <Wand2 className="w-3.5 h-3.5 text-primary/60" />
        <span className="font-medium text-foreground/70">AI แก้ตามรีวิว (เลือกรายอัน)</span>
        {total > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary/70 text-[10px] font-medium">
            {total} รีวิว
          </span>
        )}
        <span className="ml-auto flex items-center gap-2 mr-2">
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />เขียว=นักอ่าน
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />แดง=บรรณาธิการ
          </span>
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 divide-y divide-border/30">
          {total === 0 ? (
            <p className="text-xs text-muted-foreground/60 italic py-2">
              ยังไม่มีรีวิวสำหรับตอนนี้
            </p>
          ) : (
            <>
              <ReviewGroup cfgKey="reader" reviews={allReviews} chapter={chapter} novel={novel} novelId={novelId} characters={characters} novelWriter={novelWriter} onContentUpdate={onContentUpdate} />
              <ReviewGroup cfgKey="editor" reviews={allReviews} chapter={chapter} novel={novel} novelId={novelId} characters={characters} novelWriter={novelWriter} onContentUpdate={onContentUpdate} />
            </>
          )}
        </div>
      )}
    </div>
  );
}