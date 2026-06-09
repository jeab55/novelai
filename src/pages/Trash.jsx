import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Trash2, RotateCcw, Feather } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import DeleteNovelDialog from "@/components/novel/DeleteNovelDialog";
import { toast } from "sonner";

const genreColors = {
  "โรแมนติก": "bg-pink-100 text-pink-700",
  "แฟนตาซี": "bg-purple-100 text-purple-700",
  "อิงประวัติศาสตร์": "bg-amber-100 text-amber-700",
  "จีนย้อนยุค": "bg-red-100 text-red-700",
  "วาย": "bg-sky-100 text-sky-700",
  "สยองขวัญ": "bg-slate-100 text-slate-700",
  "ลึกลับ": "bg-indigo-100 text-indigo-700",
  "แอ็คชั่น": "bg-orange-100 text-orange-700",
  "ดราม่า": "bg-teal-100 text-teal-700",
  "อื่นๆ": "bg-gray-100 text-gray-700",
};

export default function Trash() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const queryClient = useQueryClient();

  const [dialogState, setDialogState] = useState({ open: false, mode: "restore", novel: null });

  const { data: trashedNovels = [], isLoading } = useQuery({
    queryKey: ["novels-trash", user?.id],
    queryFn: async () => {
      const all = isAdmin
        ? await base44.entities.Novel.list("-deleted_at")
        : await base44.entities.Novel.filter({ created_by_id: user?.id }, "-deleted_at");
      return all.filter((n) => n.is_deleted === true);
    },
    enabled: !!user,
  });

  const restoreMutation = useMutation({
    mutationFn: async (id) => {
      await base44.entities.Novel.update(id, { is_deleted: false, deleted_at: "" });
      // Restore all child records
      const [chapters, characters, plotEvents] = await Promise.all([
        base44.entities.Chapter.filter({ novel_id: id }),
        base44.entities.Character.filter({ novel_id: id }),
        base44.entities.PlotEvent.filter({ novel_id: id }),
      ]);
      await Promise.all([
        ...chapters.map((c) => base44.entities.Chapter.update(c.id, { is_deleted: false })),
        ...characters.map((c) => base44.entities.Character.update(c.id, { is_deleted: false })),
        ...plotEvents.map((e) => base44.entities.PlotEvent.update(e.id, { is_deleted: false })),
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["novels"] });
      queryClient.invalidateQueries({ queryKey: ["novels-trash"] });
      toast.success("กู้คืนนิยายแล้ว");
      setDialogState({ open: false, mode: "restore", novel: null });
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Novel.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["novels-trash"] });
      toast.success("ลบถาวรแล้ว");
      setDialogState({ open: false, mode: "permanent", novel: null });
    },
  });

  const canAct = (novel) => isAdmin || novel.created_by_id === user?.id;

  const openDialog = (e, novel, mode) => {
    e.preventDefault();
    e.stopPropagation();
    setDialogState({ open: true, mode, novel });
  };

  const handleConfirm = () => {
    const { mode, novel } = dialogState;
    if (mode === "restore") restoreMutation.mutate(novel.id);
    else if (mode === "permanent") permanentDeleteMutation.mutate(novel.id);
  };

  const isPending = restoreMutation.isPending || permanentDeleteMutation.isPending;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/60 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center">
              <Trash2 className="w-4 h-4 text-destructive" />
            </div>
            <div>
              <h1 className="text-base font-heading font-bold">ถังขยะ</h1>
              <p className="text-xs text-muted-foreground">นิยายที่ถูกลบชั่วคราว</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : trashedNovels.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-6">
              <Trash2 className="w-10 h-10 text-muted-foreground/30" />
            </div>
            <h2 className="text-xl font-heading font-semibold mb-2">ถังขยะว่างเปล่า</h2>
            <p className="text-muted-foreground mb-6">ไม่มีนิยายในถังขยะ</p>
            <Link to="/">
              <Button variant="outline" className="gap-2">
                <Feather className="w-4 h-4" />
                กลับหน้าหลัก
              </Button>
            </Link>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {trashedNovels.map((novel, i) => (
              <motion.div
                key={novel.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="group relative bg-card border border-border/60 rounded-2xl p-6 opacity-80"
              >
                <h3 className="font-heading font-semibold text-lg leading-tight mb-2 pr-2">
                  {novel.title}
                </h3>
                {novel.genre && (
                  <Badge className={`${genreColors[novel.genre] || "bg-gray-100 text-gray-700"} text-xs mb-2`}>
                    {novel.genre}
                  </Badge>
                )}
                {novel.synopsis && (
                  <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed mb-3">
                    {novel.synopsis}
                  </p>
                )}
                {novel.deleted_at && (
                  <p className="text-xs text-destructive/60 mb-3">
                    ลบเมื่อ {new Date(novel.deleted_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                )}

                {canAct(novel) && (
                  <div className="flex gap-2 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5 text-primary border-primary/30 hover:bg-primary/5"
                      onClick={(e) => openDialog(e, novel, "restore")}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      กู้คืน
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5"
                      onClick={(e) => openDialog(e, novel, "permanent")}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      ลบถาวร
                    </Button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </main>

      <DeleteNovelDialog
        open={dialogState.open}
        onClose={() => setDialogState({ ...dialogState, open: false })}
        onConfirm={handleConfirm}
        novel={dialogState.novel}
        mode={dialogState.mode}
        isPending={isPending}
      />
    </div>
  );
}