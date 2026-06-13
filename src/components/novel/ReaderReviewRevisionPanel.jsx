import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2, Users, Wand2, Save, X, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

// ——— diff utilities ———
// แบ่ง text เป็น array ของ paragraphs
function splitParas(text) {
  return (text || "").split(/\n/).map((p) => p.trimEnd());
}

// คำนวณ diff ระดับ paragraph — คืน array of { type: "same"|"added"|"changed", text }
function diffParas(oldText, newText) {
  const oldParas = splitParas(oldText);
  const newParas = splitParas(newText);

  // สร้าง set ของ old paragraphs เพื่อ lookup เร็ว
  const oldSet = new Set(oldParas.filter((p) => p.trim() !== ""));

  const result = [];
  for (const para of newParas) {
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

// ——— build prompt ———
function buildReaderReviewPrompt(novel, characters, chapter, readerReviews, writerSystemPrompt) {
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

  ctx += `\n[ความคิดเห็นจากนักอ่าน — นำไปปรับปรุงทั้งหมด]\n`;
  readerReviews.forEach((r, i) => {
    ctx += `${i + 1}. ${r.reviewer_name}: ${r.content}\n`;
  });

  ctx += `\n[เนื้อหาตอนปัจจุบัน]\n${chapter.content}\n\n`;
  ctx += `[คำสั่ง]\n`;
  ctx += `- ปรับปรุงเนื้อหาตามความคิดเห็นของนักอ่านทั้งหมดข้างต้น\n`;
  ctx += `- รักษาโครงเรื่อง ตัวละคร และสไตล์การเขียนของนักเขียน AI ประจำเรื่องไว้\n`;
  ctx += `- แก้ไขเพื่อปรับปรุง ไม่ใช่เขียนใหม่ทั้งตอน\n`;
  ctx += `- ผลลัพธ์: เฉพาะเนื้อหาตอนที่ปรับปรุงแล้ว ไม่ต้องมีคำอธิบายหรือ prefix ใดๆ\n`;

  return ctx;
}

export default function ReaderReviewRevisionPanel({ chapter, novel, novelId, onContentUpdate }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [diffResult, setDiffResult] = useState(null); // array of { type, text } | null
  const [revisedContent, setRevisedContent] = useState(null); // เนื้อหาที่ AI แก้แล้ว (plain text)
  const [originalContent, setOriginalContent] = useState(null); // เนื้อหาเดิมก่อน AI แก้
  const queryClient = useQueryClient();

  // ดึงรีวิวจากนักอ่านเท่านั้น
  const { data: readerReviews = [] } = useQuery({
    queryKey: ["reviews", chapter.id],
    queryFn: () => base44.entities.Review.filter({ chapter_id: chapter.id }, "created_date"),
    enabled: open,
    select: (all) => all.filter((r) => r.reviewer_type === "นักอ่าน"),
  });

  // ดึงนักเขียนประจำเรื่อง
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

  const handleRevise = async () => {
    if (readerReviews.length === 0) {
      toast.error("ไม่มีรีวิวจากนักอ่านสำหรับตอนนี้");
      return;
    }
    if (!chapter.content?.trim()) {
      toast.error("ไม่มีเนื้อหาตอนให้ปรับปรุง");
      return;
    }

    setLoading(true);
    setDiffResult(null);
    setRevisedContent(null);
    setOriginalContent(null);

    const prompt = buildReaderReviewPrompt(
      novel,
      characters,
      chapter,
      readerReviews,
      novelWriter?.system_prompt
    );

    const result = await base44.integrations.Core.InvokeLLM({ prompt, model: "claude_sonnet_4_6" });
    const revised = typeof result === "string" ? result.trim() : (result?.text || "").trim();

    const diff = diffParas(chapter.content, revised);
    setDiffResult(diff);
    setRevisedContent(revised);
    setOriginalContent(chapter.content);
    setLoading(false);
    toast.success("AI แก้ไขเนื้อหาเรียบร้อยแล้ว — ตรวจสอบและกด 'บันทึก' เพื่อยืนยัน");
  };

  const handleSave = async () => {
    if (!revisedContent) return;
    // เก็บเนื้อหาเดิมไว้ใน previous_content
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
    <div className="border-b border-border/50 bg-green-50/30 dark:bg-green-950/10">
      {/* Header toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2 text-xs hover:bg-muted/30 transition-colors"
      >
        <Users className="w-3.5 h-3.5 text-green-600" />
        <span className="font-medium text-foreground/70">แก้ตามรีวิวนักอ่าน (AI)</span>
        {readerReviews.length > 0 && open && (
          <span className="px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-medium border border-green-200">
            {readerReviews.length} รีวิว
          </span>
        )}
        <span className="ml-auto">{open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* รายการรีวิวจากนักอ่าน */}
          {readerReviews.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 italic py-1">
              ยังไม่มีรีวิวจากนักอ่าน (ประเภท "นักอ่าน") สำหรับตอนนี้
            </p>
          ) : (
            <div className="space-y-1.5">
              {readerReviews.map((r) => (
                <div key={r.id} className="rounded-xl border border-green-200 bg-green-50/60 px-3 py-2 text-xs dark:bg-green-950/20 dark:border-green-800/40">
                  <span className="font-semibold text-green-800 dark:text-green-300">{r.reviewer_name}: </span>
                  <span className="text-foreground/80">{r.content}</span>
                </div>
              ))}
            </div>
          )}

          {/* ปุ่มให้ AI แก้ */}
          {!diffResult && (
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5 bg-green-600 hover:bg-green-700 text-white"
              onClick={handleRevise}
              disabled={loading || readerReviews.length === 0}
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              {loading ? "AI กำลังแก้ไขเนื้อหา..." : "ให้ AI แก้ตามรีวิวนักอ่าน"}
            </Button>
          )}

          {loading && (
            <p className="text-[11px] text-muted-foreground/70 italic">
              AI กำลังอ่านรีวิวและปรับปรุงเนื้อหา... อาจใช้เวลา 30-60 วินาที
            </p>
          )}

          {/* แสดง diff พร้อม action */}
          {diffResult && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 border border-green-300 text-green-700 font-medium">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  ข้อความที่ AI แก้ไข/เพิ่ม
                </span>
                <span className="text-muted-foreground/60">| ข้อความสีปกติ = เนื้อหาเดิมที่ไม่เปลี่ยน</span>
              </div>

              {/* Diff preview */}
              <div
                className="rounded-xl border border-border/60 bg-background px-5 py-4 text-sm leading-relaxed max-h-[50vh] overflow-y-auto"
                style={{ fontFamily: "'Sarabun', 'Noto Sans Thai', sans-serif", fontSize: "15px", lineHeight: "1.95" }}
              >
                {diffResult.map((seg, i) => (
                  seg.text === "" ? (
                    <br key={i} />
                  ) : seg.type === "added" ? (
                    <span
                      key={i}
                      style={{ color: "#16a34a", fontWeight: 500 }}
                    >
                      {seg.text}
                      {i < diffResult.length - 1 ? "\n" : ""}
                    </span>
                  ) : (
                    <span key={i} style={{ color: "hsl(var(--foreground))" }}>
                      {seg.text}
                      {i < diffResult.length - 1 ? "\n" : ""}
                    </span>
                  )
                ))}
              </div>

              {/* บันทึก / ยกเลิก */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                  onClick={handleSave}
                >
                  <Save className="w-3.5 h-3.5" />
                  บันทึก (ลบไฮไลต์ + บันทึกทับ)
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs gap-1.5 text-muted-foreground"
                  onClick={handleCancel}
                >
                  <X className="w-3.5 h-3.5" />
                  ยกเลิก
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}