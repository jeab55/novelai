import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, CheckCircle2, PenTool } from "lucide-react";

export default function SeriesEpisodeNav({ novel, currentNovelId, selectedEpId, onSelectEp }) {
  const { data: episodes = [] } = useQuery({
    queryKey: ["series-novels", novel?.series_id],
    queryFn: () => base44.entities.Novel.filter({ series_id: novel.series_id }),
    enabled: !!novel?.series_id,
    select: (data) =>
      data
        .filter((n) => !n.is_deleted)
        .sort((a, b) => new Date(a.created_date) - new Date(b.created_date)),
  });

  if (!novel?.series_id || episodes.length <= 1) return null;

  return (
    <div className="border-b border-border/50 bg-muted/20 px-4 py-2">
      <div className="max-w-4xl mx-auto">
        <p className="text-xs text-muted-foreground font-medium mb-2 flex items-center gap-1.5">
          <BookOpen className="w-3 h-3" />
          EP ในซีรีส์นี้
        </p>
        <ScrollArea className="w-full">
          <div className="flex gap-2 pb-1">
            {episodes.map((ep, i) => {
              const isActive = String(ep.id) === String(selectedEpId || currentNovelId);
              return (
                <button
                  key={ep.id}
                  onClick={() => onSelectEp(ep)}
                  className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-medium transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-card border-border/50 text-foreground hover:border-primary/40 hover:bg-primary/5 cursor-pointer"
                  }`}
                >
                  <span className={`text-xs font-bold ${isActive ? "opacity-80" : "text-primary/60"}`}>
                    EP{i + 1}
                  </span>
                  <span className="max-w-[140px] truncate">{ep.title}</span>
                  {ep.status === "เขียนเสร็จ" && (
                    <CheckCircle2 className={`w-3 h-3 shrink-0 ${isActive ? "opacity-80" : "text-emerald-500"}`} />
                  )}
                  {String(ep.id) === String(currentNovelId) && (
                    <PenTool className={`w-3 h-3 shrink-0 ${isActive ? "opacity-80" : "text-primary/50"}`} />
                  )}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}