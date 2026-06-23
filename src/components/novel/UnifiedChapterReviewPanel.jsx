import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, MessageSquareText, BookOpen, Star, Loader2, Plus, Check, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { th } from "date-fns/locale";

const CATEGORY_LABELS = {
  continuity: "ความต่อเนื่อง",
  anachronism: "ความถูกต้องยุคสมัย",
  character: "ตัวละคร / จังหวะ",
  language: "สำนวน / ภาษา",
};

const SEV_BADGE = {
  สูง: "bg-red-100 text-red-700 border-red-200",
  กลาง: "bg-orange-100 text-orange-700 border-orange-200",
  ต่ำ: "bg-muted text-muted-foreground border-border",
};

const TYPE_COLORS = {
  "บรรณาธิการ AI": "bg-primary/10 text-primary/80 border-primary/20",
  นักอ่าน: "bg-green-50 text-green-700 border-green-200",
  ผู้เขียน: "bg-amber-50 text-amber-700 border-amber-200",
  อื่นๆ: "bg-muted text-muted-foreground border-border",
};

function formatDate(d) {
  try { return format(new Date(d), "d MMM yy HH:mm", { locale: th }); } catch { return ""; }
}

// แสดงรายการปัญหาที่เก็บเป็น JSON string ใน EditorReview.issues
function IssueList({ issues }) {
  let parsed = [];
  try { parsed = JSON.parse(issues || "[]"); } catch {}
  if (!parsed.length) return null;
  return (
    <div className="space-y-1.5 mt-2">
      {parsed.map((iss, i) => (
        <div key={i} className="rounded-lg border border-border/50 bg-background/60 px-2.5 py-2 text-[11px]">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <Badge variant="outline" className="text-[10px] border-primary/20 text-primary/70">
              {CATEGORY_LABELS[iss.category] || iss.category || "ทั่วไป"}
            </Badge>
            {iss.severity && (
              <span className={`px-1.5 py-0.5 rounded-full border text-[10px] font-semibold ${SEV_BADGE[iss.severity] || SEV_BADGE["ต่ำ"]}`}>
                {iss.severity}
              </span>
            )}
          </div>
          {iss.excerpt && <p className="italic opacity-70 mb-0.5 leading-relaxed">"{iss.excerpt}"</p>}
          {iss.suggestion && <p className="text-foreground/80 leading-relaxed">{iss.suggestion}</p>}
        </div>
      ))}
    </div>
  );
}

export default function UnifiedChapterReviewPanel({ chapter, novelId }) {
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [note, setNote] = useState("");
  const queryClient = useQueryClient();

  // แหล่ง 1: EditorReview (overall_summary + issues) — แหล่งมาตรฐานเดียวสำหรับเขียนใหม่
  const { data: editorReviews = [] } = useQuery({
    queryKey: ["editorReviews", chapter.id],
    queryFn: () => base44.entities.EditorReview.filter({ chapter_id: chapter.id }, "-created_date"),
    enabled: open && !!chapter.id,
  });

  // แหล่ง 2: Review (ความคิดเห็น/ดาว) — อ่านของเดิมมาแสดงรวม (ไม่เขียนใหม่)
  const { data: reviews = [] } = useQuery({
    queryKey: ["reviews", chapter.id],
    queryFn: () => base44.entities.Review.filter({ chapter_id: chapter.id }, "-created_date"),
    enabled: open && !!chapter.id,
  });

  // แหล่ง 3: ฟิลด์ editor_review ในตัว Chapter เอง (โน้ตเก่า) — อ่านมาแสดงรวม
  const legacyNote = (chapter.editor_review || "").trim();

  const addMutation = useMutation({
    mutationFn: (text) =>
      base44.entities.EditorReview.create({
        novel_id: novelId,
        chapter_id: chapter.id,
        chapter_title: chapter.title,
        overall_summary: text,
        issues: "[]",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["editorReviews", chapter.id] });
      setNote("");
      setShowForm(false);
      toast.success("บันทึกบรรณาธิการแล้ว");
    },
  });

  const handleAdd = () => {
    if (!note.trim()) { toast.error("กรุณากรอกบันทึก"); return; }
    addMutation.mutate(note.trim());
  };

  const totalCount = editorReviews.length + reviews.length + (legacyNote ? 1 : 0);

  return (
    <div className="border-b border-border/50 bg-card/20">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2 text-xs hover:bg-muted/30 transition-colors"
      >
        <MessageSquareText className="w-3.5 h-3.5 text-primary/70" />
        <span className="font-medium text-foreground/70">บันทึกบรรณาธิการ &amp; ความคิดเห็น (รวมทุกแหล่ง)</span>
        {totalCount > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary/70 text-[10px] font-medium">
            {totalCount} รายการ
          </span>
        )}
        <span className="ml-auto">{open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {/* หมวด: บันทึกบรรณาธิการ */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-rose-500/70" />
              <span className="text-[11px] font-semibold text-foreground/70 uppercase tracking-wide">บันทึกบรรณาธิการ</span>
            </div>

            {editorReviews.length === 0 && !legacyNote ? (
              <p className="text-xs text-muted-foreground/60 italic">ยังไม่มีบันทึกบรรณาธิการ</p>
            ) : (
              <div className="space-y-2">
                {/* โน้ตเก่าในฟิลด์ Chapter.editor_review */}
                {legacyNote && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/40 px-3 py-2.5 text-xs">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">บันทึกเดิม (ในตอน)</Badge>
                    </div>
                    <p className="text-foreground/80 leading-relaxed whitespace-pre-wrap">{legacyNote}</p>
                  </div>
                )}
                {/* บันทึกจากตาราง EditorReview */}
                {editorReviews.map((r) => (
                  <div key={r.id} className="rounded-xl border border-border/50 bg-background/60 px-3 py-2.5 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-rose-500/70 shrink-0" />
                      <span className="text-muted-foreground/70 text-[10px]">{formatDate(r.created_date)}</span>
                    </div>
                    {r.overall_summary && (
                      <p className="text-foreground/80 leading-relaxed whitespace-pre-wrap">{r.overall_summary}</p>
                    )}
                    <IssueList issues={r.issues} />
                  </div>
                ))}
              </div>
            )}

            {/* เพิ่มบันทึกใหม่ → เขียนลง EditorReview ที่เดียว */}
            {showForm ? (
              <div className="border border-border/60 rounded-xl p-3 space-y-2 bg-background/60">
                <Textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="เขียนบันทึกบรรณาธิการสำหรับตอนนี้..."
                  className="text-xs resize-none bg-background"
                />
                <div className="flex gap-2">
                  <Button size="sm" className="h-7 text-xs gap-1" onClick={handleAdd} disabled={addMutation.isPending}>
                    {addMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    บันทึก
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
                เพิ่มบันทึกบรรณาธิการ
              </button>
            )}
          </div>

          {/* หมวด: ความคิดเห็น / ดาว */}
          <div className="space-y-2 border-t border-border/40 pt-3">
            <div className="flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-amber-500/70" />
              <span className="text-[11px] font-semibold text-foreground/70 uppercase tracking-wide">ความคิดเห็น / ดาว</span>
            </div>
            {reviews.length === 0 ? (
              <p className="text-xs text-muted-foreground/60 italic">ยังไม่มีความคิดเห็น</p>
            ) : (
              <div className="space-y-2">
                {reviews.map((r) => (
                  <div key={r.id} className="rounded-xl border border-border/50 bg-background/60 px-3 py-2.5 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className="font-semibold text-foreground/80">{r.reviewer_name}</span>
                      <span className={`px-1.5 py-0.5 rounded-full border text-[10px] font-medium ${TYPE_COLORS[r.reviewer_type] || TYPE_COLORS["อื่นๆ"]}`}>
                        {r.reviewer_type}
                      </span>
                      {r.star_rating ? (
                        <span className="flex items-center gap-0.5 text-amber-500">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`w-3 h-3 ${i < r.star_rating ? "fill-amber-400" : "fill-none opacity-30"}`} />
                          ))}
                        </span>
                      ) : null}
                      <span className="text-muted-foreground/60 text-[10px]">{formatDate(r.created_date)}</span>
                    </div>
                    <p className="text-foreground/80 leading-relaxed whitespace-pre-wrap">{r.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}