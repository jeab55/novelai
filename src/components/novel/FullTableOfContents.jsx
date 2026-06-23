import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, BookMarked, FileText, ChevronRight, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const statusColors = {
  "ร่าง": "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300",
  "เขียนเสร็จ": "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300",
  "เผยแพร่": "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-300",
};

export default function FullTableOfContents({ novelId, novel, onOpenChapter }) {
  // root = เรื่องหลัก (ภาค 1) เสมอ
  const rootNovelId = novel?.parent_novel_id || novelId;

  // โหลดทุกภาค: เรื่องหลัก + นิยายลูก (parent_novel_id = root)
  const { data: seasons = [], isLoading: loadingSeasons } = useQuery({
    queryKey: ["toc-seasons", rootNovelId],
    queryFn: async () => {
      const all = await base44.entities.Novel.list();
      const root = all.find((n) => String(n.id) === String(rootNovelId) && !n.is_deleted);
      const children = all.filter(
        (n) => String(n.parent_novel_id) === String(rootNovelId) && !n.is_deleted
      );
      return [root, ...children].filter(Boolean).sort((a, b) => {
        const sa = a.season_number || 1;
        const sb = b.season_number || 1;
        if (sa !== sb) return sa - sb;
        return new Date(a.created_date || 0) - new Date(b.created_date || 0);
      });
    },
    enabled: !!rootNovelId,
    staleTime: 30000,
  });

  // โหลดตอนของทุกภาค
  const seasonIds = seasons.map((s) => s.id);
  const { data: chaptersBySeason = {}, isLoading: loadingChapters } = useQuery({
    queryKey: ["toc-chapters", rootNovelId, seasonIds.join(",")],
    queryFn: async () => {
      const map = {};
      await Promise.all(
        seasons.map(async (s) => {
          const chs = await base44.entities.Chapter.filter({ novel_id: s.id }, "order");
          map[s.id] = chs.filter((c) => !c.is_deleted).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        })
      );
      return map;
    },
    enabled: seasons.length > 0,
    staleTime: 30000,
  });

  const isLoading = loadingSeasons || loadingChapters;

  // คำนวณเลขตอนต่อเนื่องทั้งเรื่อง
  let runningNumber = 0;
  const totalChapters = seasons.reduce((acc, s) => acc + (chaptersBySeason[s.id]?.length || 0), 0);
  const totalWords = seasons.reduce(
    (acc, s) => acc + (chaptersBySeason[s.id] || []).reduce((w, c) => w + (c.word_count || 0), 0),
    0
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <BookMarked className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="font-heading text-xl font-bold text-foreground">สารบัญรวมทั้งเรื่อง</h2>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-primary">{seasons.length}</span> ภาค ·{" "}
              <span className="font-semibold text-primary">{totalChapters}</span> ตอน ·{" "}
              <span className="font-semibold text-primary">{totalWords.toLocaleString()}</span> คำ
            </p>
          </div>
        </div>
      </div>

      {totalChapters === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">ยังไม่มีตอนในเรื่องนี้</p>
        </div>
      ) : (
        <div className="space-y-6">
          {seasons.map((season, sIdx) => {
            const chapters = chaptersBySeason[season.id] || [];
            return (
              <div key={season.id} className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden">
                {/* Season header */}
                <div className="flex items-center gap-2.5 px-4 sm:px-5 py-3 bg-secondary/50 border-b border-border/50">
                  <Layers className="w-4 h-4 text-primary shrink-0" />
                  <Badge variant="outline" className="text-xs shrink-0">
                    ภาค {season.season_number || sIdx + 1}
                  </Badge>
                  <span className="font-heading font-semibold text-sm truncate">{season.title}</span>
                  <span className="text-xs text-muted-foreground ml-auto shrink-0">{chapters.length} ตอน</span>
                </div>

                {/* Chapters */}
                {chapters.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic px-5 py-4">ยังไม่มีตอนในภาคนี้</p>
                ) : (
                  <div className="divide-y divide-border/40">
                    {chapters.map((ch) => {
                      runningNumber += 1;
                      const globalNo = runningNumber;
                      return (
                        <button
                          key={ch.id}
                          onClick={() => onOpenChapter?.(season, ch)}
                          className="group w-full flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 text-left hover:bg-primary/5 transition-colors"
                        >
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center text-sm font-bold text-primary shrink-0 border border-primary/15">
                            {globalNo}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-[15px] truncate text-foreground">{ch.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              <span className="font-medium text-primary/70">{(ch.word_count || 0).toLocaleString()}</span> คำ
                              <span className="text-muted-foreground/50"> · ภาค {season.season_number || sIdx + 1} ตอน {ch.order || "?"}</span>
                            </p>
                          </div>
                          <Badge className={`text-[10px] px-2 py-0 shrink-0 ${statusColors[ch.status] || statusColors["ร่าง"]}`}>
                            {ch.status || "ร่าง"}
                          </Badge>
                          <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}