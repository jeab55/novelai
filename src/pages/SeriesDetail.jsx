import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, ArrowLeft, BookOpen, FileEdit, Trash2, Eye, EyeOff, Sparkles, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AppLayout from "@/components/AppLayout";

export default function SeriesDetail() {
  const { id: novelId } = useParams();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSynopsis, setNewSynopsis] = useState("");
  const [generatingSynopsis, setGeneratingSynopsis] = useState(false);
  const autoImportedRef = useRef(false);

  const { data: novel, isLoading: novelLoading } = useQuery({
    queryKey: ["novel", novelId],
    queryFn: async () => {
      const all = await base44.entities.Novel.list();
      return all.find((n) => String(n.id) === String(novelId));
    },
  });

  const { data: writer } = useQuery({
    queryKey: ["writer-for-series", novel?.writer_id],
    queryFn: async () => {
      if (!novel?.writer_id) return null;
      const all = await base44.entities.Writer.list();
      return all.find((w) => w.id === novel.writer_id) || null;
    },
    enabled: !!novel?.writer_id,
  });

  const { data: characters = [] } = useQuery({
    queryKey: ["characters-for-series", novelId],
    queryFn: () => base44.entities.Character.filter({ novel_id: novelId }),
  });

  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters-for-import", novelId],
    queryFn: async () => {
      const all = await base44.entities.Chapter.filter({ novel_id: novelId });
      return all
        .filter((c) => !c.is_deleted)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
    },
  });

  const { data: episodes = [], isLoading: episodesLoading } = useQuery({
    queryKey: ["episodes", novelId],
    queryFn: async () => {
      const all = await base44.entities.Episode.filter({ novel_id: novelId });
      return all.sort((a, b) => (a.episode_number || 0) - (b.episode_number || 0));
    },
  });

  // Auto-import chapters that don't have a matching episode yet
  useEffect(() => {
    if (autoImportedRef.current) return;
    if (episodesLoading || chapters.length === 0) return;

    const episodeTitles = new Set(episodes.map((e) => e.title));
    const toImport = chapters.filter((c) => !episodeTitles.has(c.title));
    if (toImport.length === 0) return;

    autoImportedRef.current = true;

    const run = async () => {
      const baseNumber = episodes.length + 1;
      for (let i = 0; i < toImport.length; i++) {
        const ch = toImport[i];
        await base44.entities.Episode.create({
          novel_id: novelId,
          title: ch.title,
          episode_number: baseNumber + i,
          content: ch.content || "",
          word_count: ch.word_count || 0,
          status: "draft",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["episodes", novelId] });
      queryClient.invalidateQueries({ queryKey: ["episodes-all"] });
      toast.success(`นำเข้า ${toImport.length} ตอนอัตโนมัติแล้ว`);
    };

    run();
  }, [chapters, episodes, episodesLoading, novelId, queryClient]);

  const createEpisodeMutation = useMutation({
    mutationFn: (data) => base44.entities.Episode.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["episodes", novelId] });
      queryClient.invalidateQueries({ queryKey: ["episodes-all"] });
      setAddOpen(false);
      setNewTitle("");
      toast.success("เพิ่มตอนแล้ว");
    },
  });

  const deleteEpisodeMutation = useMutation({
    mutationFn: (epId) => base44.entities.Episode.delete(epId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["episodes", novelId] });
      queryClient.invalidateQueries({ queryKey: ["episodes-all"] });
      toast.success("ลบตอนแล้ว");
    },
  });

  const togglePublishMutation = useMutation({
    mutationFn: ({ epId, status }) =>
      base44.entities.Episode.update(epId, {
        status,
        published_at: status === "published" ? new Date().toISOString() : null,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["episodes", novelId] }),
  });

  const generateSynopsis = async () => {
    if (!newTitle.trim()) { toast.error("กรุณาใส่ชื่อตอนก่อน"); return; }
    setGeneratingSynopsis(true);
    const writerCtx = writer?.system_prompt ? `[สไตล์และโทนการเขียน]\n${writer.system_prompt}\n\n` : "";
    const charSummary = characters
      .filter((c) => !c.is_deleted)
      .map((c) => `${c.name} (${c.role || "ตัวประกอบ"})`)
      .join(", ");
    const prompt = `${writerCtx}คุณเป็นนักเขียนนิยายมืออาชีพ กำลังวางแผนเรื่องย่อของตอนใหม่
ชื่อนิยาย: ${novel?.title || ""}
แนว: ${novel?.genre || ""}
เนื้อเรื่องย่อนิยาย: ${novel?.synopsis || "(ไม่มี)"}
ตอนทั้งหมดที่มีแล้ว: ${episodes.length} ตอน
ตอนใหม่ที่ ${episodes.length + 1}: "${newTitle}"
ตัวละครหลัก: ${charSummary || "(ยังไม่มี)"}

กรุณาเขียนเรื่องย่อของตอนนี้ประมาณ 3-5 ประโยค ให้น่าสนใจ สอดคล้องกับนิยาย และสอดคล้องกับสไตล์การเขียน ตอบเป็นภาษาไทยเท่านั้น ห้ามใส่หัวข้อหรือคำนำหน้า`;
    const result = await base44.integrations.Core.InvokeLLM({ prompt });
    setNewSynopsis(typeof result === "string" ? result.trim() : "");
    setGeneratingSynopsis(false);
  };

  const handleAddEpisode = () => {
    if (!newTitle.trim()) return;
    createEpisodeMutation.mutate({
      novel_id: novelId,
      title: newTitle.trim(),
      episode_number: episodes.length + 1,
      content: newSynopsis.trim() ? `[เรื่องย่อ]\n${newSynopsis.trim()}` : "",
      status: "draft",
    });
  };

  const handleOpenAddDialog = () => {
    setNewTitle("");
    setNewSynopsis("");
    setAddOpen(true);
  };

  if (novelLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!novel) {
    return (
      <AppLayout>
        <div className="text-center py-24">
          <p className="text-muted-foreground">ไม่พบนิยายนี้</p>
          <Link to="/series"><Button className="mt-4" variant="outline">กลับไปหน้าซีรีส์</Button></Link>
        </div>
      </AppLayout>
    );
  }

  const publishedCount = episodes.filter((e) => e.status === "published").length;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Link to="/series" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          กลับไปหน้าซีรีส์
        </Link>

        {/* Novel header */}
        <div className="bg-card border border-border/60 rounded-2xl overflow-hidden mb-8 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-0">
            <div className="sm:w-44 h-44 sm:h-auto shrink-0 relative overflow-hidden">
              {novel.cover_url ? (
                <img src={novel.cover_url} alt={novel.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/40 flex items-center justify-center">
                  <BookOpen className="w-14 h-14 text-primary/40" />
                </div>
              )}
            </div>
            <div className="flex-1 p-6 flex flex-col justify-between">
              <div>
                <h1 className="font-heading font-bold text-2xl leading-tight mb-2">{novel.title}</h1>
                {novel.synopsis && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{novel.synopsis}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-4">
                {novel.genre && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                    {novel.genre}
                  </span>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {episodes.length} ตอน · เผยแพร่ {publishedCount} ตอน
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Episodes list */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-heading font-semibold text-lg">รายการตอน</h2>
          <Button className="gap-2" onClick={handleOpenAddDialog}>
            <Plus className="w-4 h-4" />
            เพิ่มตอนใหม่
          </Button>
        </div>

        {episodesLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : episodes.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border/60 rounded-2xl">
            <FileEdit className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">ยังไม่มีตอน เริ่มเพิ่มตอนแรกได้เลย</p>
            <Button variant="outline" className="gap-2" onClick={handleOpenAddDialog}>
              <Plus className="w-4 h-4" />
              เพิ่มตอนแรก
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {episodes.map((ep, i) => (
              <motion.div
                key={ep.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="group bg-card border border-border/60 rounded-xl px-5 py-4 flex items-center gap-4 hover:border-primary/25 hover:shadow-sm transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/8 border border-primary/15 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">{ep.episode_number}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm leading-tight truncate">{ep.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                      ep.status === "published"
                        ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                        : "bg-muted text-muted-foreground border-border"
                    }`}>
                      {ep.status === "published" ? "เผยแพร่แล้ว" : "ร่าง"}
                    </span>
                    {ep.word_count > 0 && (
                      <span className="text-xs text-muted-foreground">{ep.word_count.toLocaleString()} คำ</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link to={`/series/${novelId}/episode/${ep.id}`}>
                    <Button size="sm" variant="outline" className="gap-1.5 h-8 px-3 text-xs">
                      <FileEdit className="w-3.5 h-3.5" />
                      แก้ไข
                    </Button>
                  </Link>
                  <Button
                    size="sm" variant="ghost" className="h-8 w-8 p-0"
                    title={ep.status === "published" ? "ถอนการเผยแพร่" : "เผยแพร่"}
                    onClick={() => togglePublishMutation.mutate({ epId: ep.id, status: ep.status === "published" ? "draft" : "published" })}
                  >
                    {ep.status === "published"
                      ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                      : <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                    }
                  </Button>
                  <Button
                    size="sm" variant="ghost"
                    className="h-8 w-8 p-0 hover:text-destructive hover:bg-destructive/5"
                    onClick={() => {
                      if (confirm(`ลบตอนที่ ${ep.episode_number}: ${ep.title}?`)) {
                        deleteEpisodeMutation.mutate(ep.id);
                      }
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Add Episode Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">เพิ่มตอนใหม่ (ตอนที่ {episodes.length + 1})</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">ชื่อตอน</label>
              <div className="flex gap-2">
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="ชื่อตอน..."
                  autoFocus
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  className="gap-1.5 shrink-0"
                  onClick={generateSynopsis}
                  disabled={generatingSynopsis || !newTitle.trim()}
                  title={!newTitle.trim() ? "กรุณากรอกชื่อตอนก่อน" : "ให้ AI สร้างเรื่องย่ออัตโนมัติ"}
                >
                  {generatingSynopsis
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Sparkles className="w-4 h-4" />}
                  {generatingSynopsis ? "กำลังสร้าง..." : "AI สร้างเรื่องย่อ"}
                </Button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                เรื่องย่อตอน
                <span className="text-xs font-normal text-muted-foreground ml-2">(แก้ไขได้ก่อนยืนยัน)</span>
              </label>
              <Textarea
                value={newSynopsis}
                onChange={(e) => setNewSynopsis(e.target.value)}
                placeholder="เรื่องย่อของตอนนี้... (ไม่บังคับ)"
                rows={5}
                className="resize-none"
              />
              {!writer && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  💡 เลือก AI Writer ให้นิยายนี้เพื่อให้ AI ใช้สไตล์ที่เหมาะสม
                </p>
              )}
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="ghost" onClick={() => setAddOpen(false)}>ยกเลิก</Button>
              <Button
                onClick={handleAddEpisode}
                disabled={!newTitle.trim() || createEpisodeMutation.isPending}
                title={!newTitle.trim() ? "กรุณากรอกชื่อตอน" : ""}
              >
                {createEpisodeMutation.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />กำลังเพิ่ม...</>
                  : "ยืนยันเพิ่มตอน"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}