import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Wand2, Loader2, Star, ChevronDown, ChevronUp, BarChart2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

function avgStars(reviews) {
  const rated = reviews.filter((r) => r.star_rating > 0);
  if (!rated.length) return null;
  return (rated.reduce((s, r) => s + r.star_rating, 0) / rated.length).toFixed(1);
}

function StarDisplay({ value }) {
  const n = parseFloat(value);
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className="w-3.5 h-3.5"
          style={{
            fill: s <= Math.round(n) ? "#f59e0b" : "transparent",
            stroke: s <= Math.round(n) ? "#f59e0b" : "#d1d5db",
          }}
        />
      ))}
    </span>
  );
}

export default function NovelReviewSummary({ novelId, chapters }) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  const { data: allReviews = [] } = useQuery({
    queryKey: ["novel-reviews-summary", novelId],
    queryFn: async () => {
      if (!chapters.length) return [];
      const lists = await Promise.all(
        chapters.map((c) => base44.entities.Review.filter({ chapter_id: c.id }))
      );
      return lists.flat().filter((r) => r.reviewer_type === "นักอ่าน");
    },
    enabled: open && chapters.length > 0,
  });

  // คะแนนรายตอน
  const chapterStats = chapters.map((ch) => {
    const chRevs = allReviews.filter((r) => r.chapter_id === ch.id);
    return { ch, count: chRevs.length, avg: avgStars(chRevs) };
  }).filter((s) => s.count > 0);

  const handleSummarize = async () => {
    if (!allReviews.length) return;
    setLoading(true);
    setSummary(null);

    const chapterMap = Object.fromEntries(chapters.map((c) => [c.id, c.title]));
    const reviewLines = allReviews.map((r) =>
      `[${chapterMap[r.chapter_id] || r.chapter_id}] ${r.reviewer_name}${r.star_rating ? ` (${r.star_rating}⭐)` : ""}: ${r.content}`
    ).join("\n");

    const prompt = `คุณคือผู้ช่วยนักเขียน วิเคราะห์รีวิวจากนักอ่านต่อไปนี้แล้วสรุปเป็นประเด็นหลัก:

[รีวิวทั้งหมด]
${reviewLines}

[คำสั่ง]
สรุปเป็น 3 หัวข้อ:
1. 👍 สิ่งที่นักอ่านชอบมากที่สุด (พร้อมตัวอย่างจากรีวิว)
2. ✏️ สิ่งที่นักอ่านอยากให้ปรับปรุง (พร้อมตัวอย่างจากรีวิว)
3. 💬 ความคิดเห็น/คำแนะนำที่พบบ่อย

เขียนเป็นภาษาไทย กระชับ อ่านง่าย ไม่เกิน 300 คำ`;

    const result = await base44.integrations.Core.InvokeLLM({ prompt });
    setSummary(typeof result === "string" ? result : result?.text || "");
    setLoading(false);
  };

  return (
    <div className="border border-border/50 rounded-2xl overflow-hidden bg-card/50 mb-6">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-5 py-3 text-sm font-medium hover:bg-muted/30 transition-colors text-left"
      >
        <BarChart2 className="w-4 h-4 text-primary/70" />
        สรุปรีวิวนักอ่าน
        {allReviews.length > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary/70 text-xs font-medium">
            {allReviews.length} รีวิว
          </span>
        )}
        <span className="ml-auto">{open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 pt-2 border-t border-border/40 space-y-4">
          {/* คะแนนรายตอน */}
          {chapterStats.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">คะแนนรายตอน</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {chapterStats.map(({ ch, count, avg }) => (
                  <div key={ch.id} className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{ch.order != null ? `ตอน ${ch.order} — ` : ""}{ch.title}</p>
                      <p className="text-[11px] text-muted-foreground">{count} รีวิว</p>
                    </div>
                    {avg ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <StarDisplay value={avg} />
                        <span className="text-xs font-semibold text-amber-600">{avg}</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">ไม่มีคะแนน</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ปุ่มสรุป AI */}
          {allReviews.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 italic">ยังไม่มีรีวิวจากนักอ่าน</p>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-primary/70 border-primary/20"
              onClick={handleSummarize}
              disabled={loading}
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              {loading ? "AI กำลังสรุปรีวิว..." : "สรุปรีวิวด้วย AI"}
            </Button>
          )}

          {/* ผลสรุป */}
          {summary && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
              {summary}
            </div>
          )}
        </div>
      )}
    </div>
  );
}