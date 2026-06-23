import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown, ChevronUp, BookOpen, Loader2, Wand2, RotateCcw,
  Plus, Trash2, Pencil, Check, X
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { th } from "date-fns/locale";

const REVIEWER_TYPES = ["บรรณาธิการ AI", "นักอ่าน", "ผู้เขียน", "อื่นๆ"];

const TYPE_COLORS = {
  "บรรณาธิการ AI": "bg-primary/10 text-primary/80 border-primary/20",
  "นักอ่าน": "bg-green-50 text-green-700 border-green-200",
  "ผู้เขียน": "bg-amber-50 text-amber-700 border-amber-200",
  "อื่นๆ": "bg-muted text-muted-foreground border-border",
};

function buildReviewPrompt(novel, characters, worldEntries, currentChapter, selectedReviews, writerSystemPrompt) {
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

  if (worldEntries.length > 0) {
    ctx += `\n[โลกและฉาก]\n`;
    worldEntries.forEach((w) => {
      ctx += `• [${w.category || "อื่นๆ"}] ${w.title}${w.description ? `: ${w.description}` : ""}\n`;
    });
  }

  if (currentChapter.plot_event_id && currentChapter.plot_event_title) {
    ctx += `\n[เหตุการณ์ไทม์ไลน์]\nลำดับ ${currentChapter.plot_event_order}: ${currentChapter.plot_event_title}\n`;
    if (currentChapter.plot_event_description) ctx += `รายละเอียด: ${currentChapter.plot_event_description}\n`;
  }

  ctx += `\n[งาน: ปรับปรุงเนื้อหาตามความคิดเห็นของผู้รีวิว]\n`;
  ctx += `ชื่อตอน: ${currentChapter.title}\n\n`;
  ctx += `[ความคิดเห็นผู้รีวิว — นำไปปรับทั้งหมด]\n`;
  selectedReviews.forEach((r, i) => {
    ctx += `${i + 1}. [${r.reviewer_type}] ${r.reviewer_name}: ${r.content}\n`;
  });
  ctx += `\n[เนื้อหาตอนปัจจุบัน]\n${currentChapter.content}\n\n`;
  ctx += `[คำสั่ง]\n- ปรับปรุงเนื้อหาตามความคิดเห็นทั้งหมดข้างต้น\n- รักษาโครงเรื่องและตัวละครเดิม\n- ผลลัพธ์: เฉพาะเนื้อหาตอนที่ปรับปรุงแล้ว ไม่ต้องมีคำอธิบาย\n`;

  return ctx;
}

export default function EditorReviewPanel({ chapter, novel, novelId, onContentUpdate, onPreviousContentRestore }) {
  const [open, setOpen] = useState(false);
  const [improving, setImproving] = useState(false);
  const [selectedReviewIds, setSelectedReviewIds] = useState(new Set());
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ reviewer_name: "", reviewer_type: "บรรณาธิการ AI", content: "" });

  const queryClient = useQueryClient();

  const { data: reviews = [] } = useQuery({
    queryKey: ["reviews", chapter.id],
    queryFn: () => base44.entities.Review.filter({ chapter_id: chapter.id }, "created_date"),
    enabled: open,
  });

  // ดึงนักเขียนประจำเรื่องจาก novel.writer_id
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
  const { data: worldEntries = [] } = useQuery({
    queryKey: ["worldEntries", novelId],
    queryFn: () => base44.entities.WorldEntry.filter({ novel_id: novelId }),
    enabled: open,
  });

  const selectedWriter = novelWriter;

  // บันทึกรีวิวใหม่ลง EditorReview เป็นแหล่งมาตรฐานเดียว (เลิกเขียนลงตาราง Review)
  const addMutation = useMutation({
    mutationFn: (data) =>
      base44.entities.EditorReview.create({
        novel_id: novelId,
        chapter_id: chapter.id,
        chapter_title: chapter.title,
        overall_summary: `[${data.reviewer_type}] ${data.reviewer_name}: ${data.content}`,
        issues: "[]",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["editorReviews", chapter.id] });
      setForm({ reviewer_name: "", reviewer_type: "บรรณาธิการ AI", content: "" });
      setShowForm(false);
      toast.success("บันทึกรีวิวแล้ว (รวมในแผงบันทึกบรรณาธิการ)");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, content }) => base44.entities.Review.update(id, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews", chapter.id] });
      setEditingId(null);
      toast.success("แก้ไขแล้ว");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Review.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews", chapter.id] });
      toast.success("ลบแล้ว");
    },
  });

  const handleAddReview = () => {
    if (!form.reviewer_name.trim() || !form.content.trim()) {
      toast.error("กรุณากรอกชื่อและความคิดเห็น");
      return;
    }
    addMutation.mutate({ chapter_id: chapter.id, ...form });
  };

  const toggleSelect = (id) => {
    setSelectedReviewIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedReviewIds.size === reviews.length) {
      setSelectedReviewIds(new Set());
    } else {
      setSelectedReviewIds(new Set(reviews.map((r) => r.id)));
    }
  };

  const handleImprove = async () => {
    const toUse = reviews.filter((r) => selectedReviewIds.size === 0 || selectedReviewIds.has(r.id));
    if (toUse.length === 0) { toast.error("ไม่มีรีวิวที่จะส่งให้ AI"); return; }
    if (!chapter.content?.trim()) { toast.error("ไม่มีเนื้อหาตอนให้ปรับปรุง"); return; }

    setImproving(true);
    await base44.entities.Chapter.update(chapter.id, { previous_content: chapter.content });

    const prompt = buildReviewPrompt(novel, characters, worldEntries, chapter, toUse, selectedWriter?.system_prompt);
    const result = await base44.integrations.Core.InvokeLLM({ prompt, model: "claude_sonnet_4_6" });
    const improved = typeof result === "string" ? result : result?.text || "";

    await base44.entities.Chapter.update(chapter.id, { content: improved, word_count: 0 });
    onContentUpdate(improved, chapter.content);
    setImproving(false);
    toast.success("ปรับปรุงเนื้อหาตามรีวิวแล้ว — กด 'คืนค่าเดิม' ถ้าไม่ถูกใจ");
  };

  const handleRestore = async () => {
    if (!chapter.previous_content) { toast.error("ไม่มีเนื้อหาสำรองให้คืนค่า"); return; }
    await base44.entities.Chapter.update(chapter.id, { content: chapter.previous_content, previous_content: "" });
    onPreviousContentRestore(chapter.previous_content);
    toast.success("คืนค่าเนื้อหาเดิมแล้ว");
  };

  const formatDate = (d) => {
    try { return format(new Date(d), "d MMM yy HH:mm", { locale: th }); } catch { return ""; }
  };

  return (
    <div className="border-b border-border/50 bg-card/20">
      {/* Header toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2 text-xs hover:bg-muted/30 transition-colors"
      >
        <BookOpen className="w-3.5 h-3.5 text-primary/60" />
        <span className="font-medium text-foreground/70">รีวิวจากนักอ่าน</span>
        {reviews.length > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary/70 text-[10px] font-medium">
            {reviews.length} รีวิว
          </span>
        )}
        {chapter.previous_content && (
          <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-medium">มีฉบับสำรอง</span>
        )}
        <span className="ml-auto">{open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Review thread */}
          {reviews.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 italic py-1">ยังไม่มีรีวิวจากนักอ่าน</p>
          ) : (
            <div className="space-y-2">
              {/* Select all */}
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleSelectAll}
                  className="text-[11px] text-primary/70 hover:text-primary underline-offset-2 hover:underline"
                >
                  {selectedReviewIds.size === reviews.length ? "ยกเลิกเลือกทั้งหมด" : "เลือกทั้งหมด"}
                </button>
                {selectedReviewIds.size > 0 && (
                  <span className="text-[11px] text-muted-foreground">เลือกแล้ว {selectedReviewIds.size} รีวิว</span>
                )}
              </div>

              {reviews.map((r) => (
                <div
                  key={r.id}
                  className={`rounded-xl border px-3 py-2.5 text-xs transition-all cursor-pointer ${
                    selectedReviewIds.has(r.id)
                      ? "border-primary/40 bg-primary/5"
                      : "border-border/50 bg-background/60 hover:border-border"
                  }`}
                  onClick={() => editingId !== r.id && toggleSelect(r.id)}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="font-semibold text-foreground/80">{r.reviewer_name}</span>
                        <span className={`px-1.5 py-0.5 rounded-full border text-[10px] font-medium ${TYPE_COLORS[r.reviewer_type] || TYPE_COLORS["อื่นๆ"]}`}>
                          {r.reviewer_type}
                        </span>
                        <span className="text-muted-foreground/60 text-[10px]">{formatDate(r.created_date)}</span>
                      </div>

                      {editingId === r.id ? (
                        <div className="space-y-1.5 mt-1" onClick={(e) => e.stopPropagation()}>
                          <Textarea
                            rows={3}
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="text-xs resize-none bg-background"
                            autoFocus
                          />
                          <div className="flex gap-1.5">
                            <Button size="sm" className="h-6 text-[11px] gap-1" onClick={() => updateMutation.mutate({ id: r.id, content: editContent })}>
                              <Check className="w-2.5 h-2.5" /> บันทึก
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => setEditingId(null)}>
                              <X className="w-2.5 h-2.5" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-foreground/80 leading-relaxed whitespace-pre-wrap">{r.content}</p>
                      )}
                    </div>

                    {editingId !== r.id && (
                      <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => { setEditingId(r.id); setEditContent(r.content); }}
                          className="p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(r.id)}
                          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add review form */}
          {showForm ? (
            <div className="border border-border/60 rounded-xl p-3 space-y-2 bg-background/60">
              <div className="flex gap-2">
                <Input
                  value={form.reviewer_name}
                  onChange={(e) => setForm((f) => ({ ...f, reviewer_name: e.target.value }))}
                  placeholder="ชื่อผู้รีวิว"
                  className="h-7 text-xs flex-1"
                />
                <Select value={form.reviewer_type} onValueChange={(v) => setForm((f) => ({ ...f, reviewer_type: v }))}>
                  <SelectTrigger className="h-7 text-xs w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REVIEWER_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Textarea
                rows={3}
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                placeholder="เขียนรีวิว / คำแนะนำสำหรับตอนนี้..."
                className="text-xs resize-none bg-background"
              />
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs gap-1" onClick={handleAddReview} disabled={addMutation.isPending}>
                  {addMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  เพิ่มรีวิว
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowForm(false)}>ยกเลิก</Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 text-xs text-primary/70 hover:text-primary transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              เพิ่มรีวิวใหม่
            </button>
          )}

          {/* Improve actions */}
          <div className="border-t border-border/40 pt-3 space-y-2">
            {selectedWriter && (
              <div className="flex items-center gap-1.5 text-[11px] text-primary/60">
                <span className="text-muted-foreground">นักเขียน AI:</span>
                <span className="font-medium text-primary/80 bg-primary/5 border border-primary/15 px-2 py-0.5 rounded-full">{selectedWriter.name}</span>
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                className="h-7 text-xs gap-1.5 bg-primary/90 hover:bg-primary"
                onClick={handleImprove}
                disabled={improving || reviews.length === 0}
              >
                {improving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                {improving ? "กำลังปรับปรุง..." : selectedReviewIds.size > 0 ? `ปรับปรุงตาม ${selectedReviewIds.size} รีวิว` : "ปรับปรุงตามรีวิวทั้งหมด"}
              </Button>

              {chapter.previous_content && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1.5 text-amber-700 hover:text-amber-800 hover:bg-amber-50"
                  onClick={handleRestore}
                >
                  <RotateCcw className="w-3 h-3" />
                  คืนค่าเนื้อหาเดิม
                </Button>
              )}
            </div>

            {improving && (
              <p className="text-[11px] text-muted-foreground/70 italic">
                AI กำลังปรับปรุงเนื้อหา... อาจใช้เวลา 30-60 วินาที (ใช้ Claude Sonnet)
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}