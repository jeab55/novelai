import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2, FolderOpen, Trash2, Film, Clapperboard } from "lucide-react";
import { toast } from "sonner";

export default function SavedStoryboardLibrary({ onOpen }) {
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["storyboard-projects"],
    queryFn: () => base44.entities.StoryboardProject.list("-updated_date", 100),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.StoryboardProject.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["storyboard-projects"] });
      toast.success("ลบงานที่บันทึกไว้แล้ว");
    },
  });

  const sceneCount = (p) => {
    try { return (JSON.parse(p.scenes || "[]") || []).length; } catch { return 0; }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />กำลังโหลด...
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-secondary/60 flex items-center justify-center mx-auto mb-3">
          <Clapperboard className="w-7 h-7 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">ยังไม่มีสตอรีบอร์ดที่บันทึกไว้</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {projects.map((p) => (
        <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3.5">
          <div className="w-10 h-10 rounded-lg bg-rose-100 dark:bg-rose-950/30 text-rose-600 flex items-center justify-center shrink-0">
            <Film className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-heading font-semibold text-sm truncate">{p.name}</h4>
            <p className="text-xs text-muted-foreground truncate">
              {sceneCount(p)} ฉาก · {p.platform || "-"}{p.duration ? ` · ${p.duration} วิ` : ""}
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs shrink-0" onClick={() => onOpen(p)}>
            <FolderOpen className="w-3.5 h-3.5" />เปิด
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
            onClick={() => deleteMutation.mutate(p.id)}
            disabled={deleteMutation.isPending}
            title="ลบงานนี้"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}