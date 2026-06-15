import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Layers, BookOpen } from "lucide-react";
import { toast } from "sonner";

export default function SeasonSelectorDialog({ open, onClose, novel, onSeasonChange }) {
  const queryClient = useQueryClient();
  const [newSeasonTitle, setNewSeasonTitle] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  // โหลดทุก Season ของนิยายเรื่องนี้
  const { data: seasons = [] } = useQuery({
    queryKey: ["seasons", novel?.id],
    queryFn: async () => {
      if (!novel?.id) return [];
      const all = await base44.entities.Novel.list();
      return all
        .filter((n) => String(n.parent_novel_id) === String(novel.id) && !n.is_deleted)
        .sort((a, b) => (a.season_number || 1) - (b.season_number || 1));
    },
    enabled: !!novel?.id && open,
  });

  const createSeason = useMutation({
    mutationFn: async (data) => {
      const newSeason = await base44.entities.Novel.create(data);
      return newSeason;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seasons", novel?.id] });
      queryClient.invalidateQueries({ queryKey: ["episodes", novel?.series_id] });
      toast.success("สร้าง Season ใหม่แล้ว");
      setShowCreateForm(false);
      setNewSeasonTitle("");
    },
  });

  const handleCreateSeason = () => {
    if (!newSeasonTitle.trim()) return;
    
    const maxSeasonNumber = seasons.reduce((max, s) => Math.max(max, s.season_number || 1), 0);
    
    createSeason.mutate({
      title: newSeasonTitle,
      genre: novel.genre,
      synopsis: novel.synopsis,
      era: novel.era,
      writer_id: novel.writer_id,
      series_id: novel.series_id,
      parent_novel_id: novel.id,
      season_number: maxSeasonNumber + 1,
      novel_type: novel.novel_type,
      ending_type: novel.ending_type,
      target_chapters: novel.target_chapters,
      main_character_count: novel.main_character_count,
      word_count_target: novel.word_count_target,
    });
  };

  const currentSeason = seasons.find(s => String(s.id) === String(novel?.id));
  const seasonNumber = currentSeason?.season_number || 1;

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v) {
        setShowCreateForm(false);
        setNewSeasonTitle("");
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            จัดการ Season
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Season Info */}
          <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Season ปัจจุบัน</span>
              <Badge className="bg-primary text-primary-foreground">
                Season {seasonNumber}
              </Badge>
            </div>
            <p className="font-semibold text-lg">{novel?.title}</p>
            {novel?.synopsis && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{novel.synopsis}</p>
            )}
          </div>

          {/* All Seasons List */}
          <div>
            <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-muted-foreground" />
              Season ทั้งหมด ({seasons.length})
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {seasons.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  ยังไม่มี Season
                </p>
              ) : (
                seasons.map((season, idx) => (
                  <div
                    key={season.id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                      String(season.id) === String(novel?.id)
                        ? "bg-primary/10 border-primary/30"
                        : "bg-card hover:bg-accent/50 border-border"
                    }`}
                    onClick={() => {
                      onSeasonChange?.(season);
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          Season {season.season_number || idx + 1}
                        </Badge>
                        <span className="font-medium truncate">{season.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {season.target_chapters || 10} ตอน · {season.word_count_target?.toLocaleString() || 1500} คำ/ตอน
                      </p>
                    </div>
                    {String(season.id) === String(novel?.id) && (
                      <Badge className="bg-primary text-primary-foreground">ปัจจุบัน</Badge>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Create New Season */}
          {showCreateForm ? (
            <div className="bg-muted/50 rounded-xl p-4 space-y-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">ชื่อ Season ใหม่</label>
                <Input
                  value={newSeasonTitle}
                  onChange={(e) => setNewSeasonTitle(e.target.value)}
                  placeholder={`เช่น ${novel?.title} Season 2`}
                  className="h-10"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewSeasonTitle("");
                  }}
                >
                  ยกเลิก
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleCreateSeason}
                  disabled={!newSeasonTitle.trim() || createSeason.isPending}
                >
                  {createSeason.isPending ? "กำลังสร้าง..." : "สร้าง Season"}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full gap-2 border-dashed"
              onClick={() => setShowCreateForm(true)}
            >
              <Plus className="w-4 h-4" />
              สร้าง Season ใหม่ (ภาคต่อ)
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}