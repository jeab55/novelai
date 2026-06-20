import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Archive, Eye, BookPlus, Trash2, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import SavedTranslationDetailDialog from "@/components/novel/SavedTranslationDetailDialog";
import CreateNovelFromTranslationDialog from "@/components/novel/CreateNovelFromTranslationDialog";

export default function SavedTranslationsLibrary({ enabled, novels = [] }) {
  const queryClient = useQueryClient();
  const [detailProject, setDetailProject] = useState(null);
  const [createProject, setCreateProject] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["translation-projects"],
    queryFn: () => base44.entities.TranslationProject.list("-created_date"),
    enabled,
  });

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await base44.entities.TranslationProject.delete(id);
      queryClient.invalidateQueries({ queryKey: ["translation-projects"] });
      toast.success("ลบงานแปลแล้ว");
    } catch (e) {
      toast.error("ลบไม่สำเร็จ: " + (e.message || ""));
    } finally {
      setDeletingId(null);
    }
  };

  const draftCount = (p) => {
    try { return JSON.parse(p.drafts || "[]").length; } catch { return 0; }
  };

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center py-10 text-center text-muted-foreground">
        <Archive className="w-10 h-10 mb-2 opacity-40" />
        <p className="text-sm">ยังไม่มีงานแปลที่บันทึกไว้</p>
        <p className="text-xs mt-1">เมื่อแปลและดัดแปลงเสร็จ กด "บันทึกงานแปล" เพื่อเก็บไว้ดูซ้ำได้</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2.5">
        {projects.map((p) => (
          <div key={p.id} className="rounded-xl border border-border/60 bg-card p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm flex items-center gap-1.5 truncate">
                  <FileText className="w-4 h-4 text-primary flex-shrink-0" />{p.name}
                </p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {p.genre && <Badge variant="secondary" className="text-[11px]">{p.genre}</Badge>}
                  {p.tone && <Badge variant="outline" className="text-[11px]">{p.tone}</Badge>}
                  <Badge variant="outline" className="text-[11px]">{draftCount(p)} ตอน</Badge>
                  <Badge variant="outline" className="text-[11px]">{p.source_count || 1} แหล่ง</Badge>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <Button variant="outline" size="sm" className="flex-1 h-8 text-xs gap-1.5" onClick={() => setDetailProject(p)}>
                <Eye className="w-3.5 h-3.5" />ดู
              </Button>
              <Button variant="outline" size="sm" className="flex-1 h-8 text-xs gap-1.5" onClick={() => setCreateProject(p)}>
                <BookPlus className="w-3.5 h-3.5" />สร้างนิยายต่อ
              </Button>
              <Button
                variant="outline" size="sm"
                className="h-8 px-2.5 text-destructive hover:bg-destructive/10 border-destructive/30"
                onClick={() => handleDelete(p.id)}
                disabled={deletingId === p.id}
              >
                {deletingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <SavedTranslationDetailDialog
        project={detailProject}
        open={!!detailProject}
        onClose={() => setDetailProject(null)}
        onCreateNovel={(p) => { setDetailProject(null); setCreateProject(p); }}
      />
      <CreateNovelFromTranslationDialog
        project={createProject}
        open={!!createProject}
        onClose={() => setCreateProject(null)}
        novels={novels}
      />
    </>
  );
}