import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Feather, BookOpen, ChevronDown, ChevronUp, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import PublicChapterReviewBox from "@/components/novel/PublicChapterReviewBox";
import NovelReviewSummary from "@/components/novel/NovelReviewSummary";

function StarDisplay({ avg, count }) {
  const n = parseFloat(avg);
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className="w-3 h-3"
          style={{
            fill: s <= Math.round(n) ? "#f59e0b" : "transparent",
            stroke: s <= Math.round(n) ? "#f59e0b" : "#d1d5db",
          }}
        />
      ))}
      <span className="ml-1 text-amber-600 font-semibold">{n.toFixed(1)}</span>
      <span className="text-muted-foreground/60">({count} รีวิว)</span>
    </span>
  );
}

export default function PublicNovelView() {
  const { token } = useParams();
  const [novel, setNovel] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openChapters, setOpenChapters] = useState({});

  useEffect(() => {
    async function load() {
      const all = await base44.entities.Novel.list();
      const found = all.find((n) => n.public_token === token && !n.is_deleted);
      if (!found) { setLoading(false); return; }
      setNovel(found);
      const chs = await base44.entities.Chapter.filter({ novel_id: found.id }, "order");
      setChapters(chs.filter((c) => c.status === "เผยแพร่"));
      setLoading(false);
    }
    load();
  }, [token]);

  const toggle = (id) => setOpenChapters((prev) => ({ ...prev, [id]: !prev[id] }));

  // ดึงรีวิวทั้งหมดเพื่อแสดงคะแนนดาว
  const { data: chapterReviews = [] } = useQuery({
    queryKey: ["public-reviews", novel?.id],
    queryFn: async () => {
      if (!chapters.length) return [];
      const lists = await Promise.all(
        chapters.map((c) => base44.entities.Review.filter({ chapter_id: c.id }))
      );
      return lists.flat().filter((r) => r.reviewer_type === "นักอ่าน" && r.star_rating > 0);
    },
    enabled: !!novel && chapters.length > 0,
  });

  // คำนวณค่าเฉลี่ยดาวต่อตอน
  const chapterAvg = {};
  const chapterCount = {};
  for (const r of chapterReviews) {
    if (!chapterAvg[r.chapter_id]) { chapterAvg[r.chapter_id] = 0; chapterCount[r.chapter_id] = 0; }
    chapterAvg[r.chapter_id] += r.star_rating;
    chapterCount[r.chapter_id]++;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!novel) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-3">
        <BookOpen className="w-12 h-12 text-muted-foreground/40" />
        <p className="text-muted-foreground text-center">ไม่พบลิงก์นี้ หรืออาจถูกปิดการเข้าถึงแล้ว</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/60 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Feather className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="font-heading font-bold text-base truncate">{novel.title}</h1>
            <p className="text-xs text-muted-foreground">อ่านอย่างเดียว</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Novel info */}
        <div className="mb-6">
          {novel.genre && (
            <Badge className="mb-2 text-xs bg-amber-100 text-amber-700">{novel.genre}</Badge>
          )}
          {novel.era && <p className="text-xs text-primary/70 font-medium mb-2">{novel.era}</p>}
          {novel.synopsis && (
            <p className="text-sm text-muted-foreground leading-relaxed border-l-2 border-primary/20 pl-4">
              {novel.synopsis}
            </p>
          )}
        </div>

        {/* สรุปรีวิวรวม */}
        {chapters.length > 0 && (
          <NovelReviewSummary novelId={novel.id} chapters={chapters} />
        )}

        {/* Chapters */}
        <h2 className="font-heading font-semibold text-base mb-4">
          ตอนทั้งหมด ({chapters.length} ตอน)
        </h2>
        {chapters.length === 0 ? (
          <p className="text-muted-foreground text-sm italic">ยังไม่มีตอนที่เผยแพร่</p>
        ) : (
          <div className="space-y-3">
            {chapters.map((ch) => {
              const avg = chapterCount[ch.id] ? chapterAvg[ch.id] / chapterCount[ch.id] : null;
              const count = chapterCount[ch.id] || 0;
              return (
                <div key={ch.id} className="border border-border/60 rounded-xl overflow-hidden bg-card">
                  <button
                    className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-muted/30 transition-colors"
                    onClick={() => toggle(ch.id)}
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-medium text-sm">
                        {ch.order != null ? `ตอนที่ ${ch.order} — ` : ""}{ch.title}
                      </span>
                      {avg && (
                        <StarDisplay avg={avg} count={count} />
                      )}
                    </div>
                    {openChapters[ch.id]
                      ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                      : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    }
                  </button>
                  {openChapters[ch.id] && (
                    <div className="px-5 pb-5 pt-1 border-t border-border/40">
                      <pre className="font-body text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                        {ch.content || "(ไม่มีเนื้อหา)"}
                      </pre>
                      {/* ช่องรีวิว */}
                      <PublicChapterReviewBox chapterId={ch.id} novelId={novel.id} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}