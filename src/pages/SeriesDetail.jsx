import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus, ArrowLeft, BookOpen, CheckCircle2, Clock, FileEdit,
  Trash2, PauseCircle, Edit, Eye, EyeOff
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import SeriesFormDialog from "@/components/series/SeriesFormDialog";
import EpisodeFormDialog from "@/components/series/EpisodeFormDialog";
import AppLayout from "@/components/AppLayout";

const statusConfig = {
  ongoing: { label: "กำลังเขียน", color: "bg-blue-100 text-blue-700 border-blue-200", icon: Clock },
  completed: { label: "จบแล้ว", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  hiatus: { label: "พักชั่วคราว", color: "bg-amber-100 text-amber-700 border-amber-200", icon: PauseCircle },
};

export default function SeriesDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editSeriesOpen, setEditSeriesOpen] = useState(false);
  const [addEpisodeOpen, setAddEpisodeOpen] = useState(false);
  const [editEpisode, setEditEpisode] = useState(null);

  const { data: series, isLoading: seriesLoading } = useQuery({
    queryKey: ["series", id],
    queryFn: async () => {
      const all = await base44.entities.Series.list();
      return all.find((s) => String(s.id) === String(id));
    },
  });

  const { data: episodes = [], isLoading: episodesLoading } = useQuery({
    queryKey: ["episodes", id],
    queryFn: async () => {
      const all = await base44.entities.Episode.filter({ series_id: id });
      return all.sort((a, b) => (a.episode_number || 0) - (b.episode_number || 0));
    },
  });

  const deleteEpisodeMutation = useMutation({
    mutationFn: (epId) => base44.entities.Episode.delete(epId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["episodes", id] });
      toast.success("ลบตอนแล้ว");
    },
  });

  const togglePublishMutation = useMutation({
    mutationFn: ({ epId, status }) =>
      base44.entities.Episode.update(epId, {
        status,
        published_at: status === "published" ? new Date().toISOString() : null,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["episodes", id] }),
  });

  if (seriesLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!series) {
    return (
      <AppLayout>
        <div className="text-center py-24">
          <p className="text-muted-foreground">ไม่พบซีรีส์นี้</p>
          <Link to="/series"><Button className="mt-4" variant="outline">กลับไปหน้าซีรีส์</Button></Link>
        </div>
      </AppLayout>
    );
  }

  const statusInfo = statusConfig[series.status] || statusConfig.ongoing;
  const StatusIcon = statusInfo.icon;
  const publishedCount = episodes.filter((e) => e.status === "published").length;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Back button */}
        <Link to="/series" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          กลับไปหน้าซีรีส์
        </Link>

        {/* Series header */}
        <div className="bg-card border border-border/60 rounded-2xl overflow-hidden mb-8 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-0">
            {/* Cover */}
            <div className="sm:w-48 h-48 sm:h-auto shrink-0 relative overflow-hidden">
              {series.cover_image_url ? (
                <img src={series.cover_image_url} alt={series.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/40 flex items-center justify-center">
                  <BookOpen className="w-14 h-14 text-primary/40" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h1 className="font-heading font-bold text-2xl leading-tight">{series.title}</h1>
                  <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={() => setEditSeriesOpen(true)}>
                    <Edit className="w-3.5 h-3.5" />
                    แก้ไข
                  </Button>
                </div>
                {series.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">{series.description}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${statusInfo.color}`}>
                  <StatusIcon className="w-3 h-3" />
                  {statusInfo.label}
                </span>
                {series.genre && (
                  <Badge variant="outline" className="text-xs">{series.genre}</Badge>
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
          <Button className="gap-2" onClick={() => setAddEpisodeOpen(true)}>
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
            <Button variant="outline" className="gap-2" onClick={() => setAddEpisodeOpen(true)}>
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
                {/* Episode number */}
                <div className="w-10 h-10 rounded-xl bg-primary/8 border border-primary/15 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">{ep.episode_number}</span>
                </div>

                {/* Info */}
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
                    {ep.published_at && ep.status === "published" && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(ep.published_at).toLocaleDateString("th-TH")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link to={`/series/${id}/episode/${ep.id}`}>
                    <Button size="sm" variant="outline" className="gap-1.5 h-8 px-3 text-xs">
                      <FileEdit className="w-3.5 h-3.5" />
                      แก้ไข
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    title={ep.status === "published" ? "ถอนการเผยแพร่" : "เผยแพร่"}
                    onClick={() => togglePublishMutation.mutate({
                      epId: ep.id,
                      status: ep.status === "published" ? "draft" : "published",
                    })}
                  >
                    {ep.status === "published"
                      ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                      : <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                    }
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
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

      <SeriesFormDialog
        open={editSeriesOpen}
        onClose={() => setEditSeriesOpen(false)}
        series={series}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["series", id] });
          queryClient.invalidateQueries({ queryKey: ["series"] });
          setEditSeriesOpen(false);
        }}
      />

      <EpisodeFormDialog
        open={addEpisodeOpen}
        onClose={() => setAddEpisodeOpen(false)}
        seriesId={id}
        nextEpisodeNumber={episodes.length + 1}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["episodes", id] });
          setAddEpisodeOpen(false);
        }}
      />
    </AppLayout>
  );
}