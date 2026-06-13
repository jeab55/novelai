import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Star, Send, Loader2, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { toast } from "sonner";

function StarRating({ value, onChange, readonly = false }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          disabled={readonly}
          onClick={() => !readonly && onChange(s)}
          onMouseEnter={() => !readonly && setHovered(s)}
          onMouseLeave={() => !readonly && setHovered(0)}
          className={`transition-colors ${readonly ? "cursor-default" : "cursor-pointer"}`}
        >
          <Star
            className="w-5 h-5"
            style={{
              fill: s <= (hovered || value) ? "#f59e0b" : "transparent",
              stroke: s <= (hovered || value) ? "#f59e0b" : "#d1d5db",
            }}
          />
        </button>
      ))}
    </div>
  );
}

export default function PublicChapterReviewBox({ chapterId, novelId }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [star, setStar] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error("กรุณาระบุชื่อผู้รีวิว"); return; }
    if (!content.trim()) { toast.error("กรุณาพิมพ์ความเห็น"); return; }
    if (!star) { toast.error("กรุณาให้คะแนนดาว"); return; }
    setSubmitting(true);
    await base44.entities.Review.create({
      chapter_id: chapterId,
      novel_id: novelId,
      reviewer_name: name.trim(),
      reviewer_type: "นักอ่าน",
      content: content.trim(),
      star_rating: star,
    });
    setSubmitting(false);
    setSubmitted(true);
    toast.success("ขอบคุณสำหรับรีวิว!");
  };

  return (
    <div className="mt-6 border border-border/50 rounded-2xl overflow-hidden bg-card/50">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-5 py-3 text-sm font-medium hover:bg-muted/30 transition-colors text-left"
      >
        <MessageSquare className="w-4 h-4 text-primary/60" />
        เขียนรีวิวตอนนี้
        <span className="ml-auto">{open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-border/40 space-y-3">
          {submitted ? (
            <div className="py-4 text-center text-sm text-green-700 font-medium">
              ✓ บันทึกรีวิวแล้ว ขอบคุณที่ช่วยปรับปรุงนิยาย!
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">ชื่อผู้รีวิว</label>
                <input
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="ชื่อของคุณ (หรือนามแฝง)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">คะแนน</label>
                <StarRating value={star} onChange={setStar} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">ความเห็น</label>
                <textarea
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                  rows={3}
                  placeholder="แสดงความเห็นเกี่ยวกับตอนนี้..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                ส่งรีวิว
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}