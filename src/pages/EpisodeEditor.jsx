import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Save, Eye, EyeOff, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";

// Thai word counter
const countWords = (text) => {
  if (!text) return 0;
  try {
    const seg = new Intl.Segmenter("th", { granularity: "word" });
    let count = 0;
    for (const { isWordLike, segment } of seg.segment(text)) {
      if (isWordLike && segment.trim().length > 0) count++;
    }
    return count;
  } catch {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }
};

export default function EpisodeEditor() {
  const { seriesId, episodeId } = useParams();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [saved, setSaved] = useState(false);
  const autoSaveRef = useRef(null);

  const { data: episode, isLoading } = useQuery({
    queryKey: ["episode", episodeId],
    queryFn: async () => {
      const all = await base44.entities.Episode.list();
      return all.find((e) => String(e.id) === String(episodeId));
    },
  });

  const { data: series } = useQuery({
    queryKey: ["series", seriesId],
    queryFn: async () => {
      const all = await base44.entities.Series.list();
      return all.find((s) => String(s.id) === String(seriesId));
    },
  });

  useEffect(() => {
    if (episode) {
      setTitle(episode.title || "");
      setContent(episode.content || "");
      setWordCount(countWords(episode.content || ""));
    }
  }, [episode]);

  useEffect(() => {
    setWordCount(countWords(content));
    setIsDirty(true);
    setSaved(false);

    // Auto-save after 3s of no typing
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      if (episodeId) handleSave(false);
    }, 3000);

    return () => clearTimeout(autoSaveRef.current);
  }, [content, title]);

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.Episode.update(episodeId, data),
    onSuccess: () => {
      setIsDirty(false);
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["episode", episodeId] });
      queryClient.invalidateQueries({ queryKey: ["episodes", seriesId] });
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const togglePublishMutation = useMutation({
    mutationFn: (status) =>
      base44.entities.Episode.update(episodeId, {
        status,
        published_at: status === "published" ? new Date().toISOString() : null,
      }),
    onSuccess: (_, status) => {
      queryClient.invalidateQueries({ queryKey: ["episode", episodeId] });
      toast.success(status === "published" ? "เผยแพร่แล้ว" : "ถอนการเผยแพร่แล้ว");
    },
  });

  const handleSave = (showToast = true) => {
    if (!title.trim()) return;
    saveMutation.mutate({ title, content, word_count: countWords(content) });
    if (showToast) toast.success("บันทึกแล้ว");
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  const isPublished = episode?.status === "published";

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-6 py-6 flex flex-col gap-5 min-h-[calc(100vh-4rem)]">
        {/* Top bar */}
        <div className="flex items-center gap-3">
          <Link
            to={`/series/${seriesId}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {series?.title || "กลับ"}
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-sm text-muted-foreground">
            ตอนที่ {episode?.episode_number}
          </span>

          <div className="ml-auto flex items-center gap-2">
            {/* Word count */}
            <span className="text-xs text-muted-foreground hidden sm:block">
              {wordCount.toLocaleString()} คำ
            </span>

            {/* Save indicator */}
            {saveMutation.isPending ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                กำลังบันทึก...
              </span>
            ) : saved ? (
              <span className="flex items-center gap-1 text-xs text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5" />
                บันทึกแล้ว
              </span>
            ) : null}

            {/* Publish toggle */}
            <Button
              variant={isPublished ? "outline" : "default"}
              size="sm"
              className="gap-1.5"
              onClick={() => togglePublishMutation.mutate(isPublished ? "draft" : "published")}
              disabled={togglePublishMutation.isPending}
            >
              {isPublished
                ? <><EyeOff className="w-3.5 h-3.5" />ถอนการเผยแพร่</>
                : <><Eye className="w-3.5 h-3.5" />เผยแพร่</>
              }
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => handleSave(true)}
              disabled={saveMutation.isPending}
            >
              <Save className="w-3.5 h-3.5" />
              บันทึก
            </Button>
          </div>
        </div>

        {/* Title input */}
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="ชื่อตอน..."
          className="text-xl font-heading font-bold border-none shadow-none px-0 h-auto focus-visible:ring-0 bg-transparent placeholder:text-muted-foreground/40"
        />

        {/* Status badge */}
        <div className="flex items-center gap-2 -mt-3">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
            isPublished
              ? "bg-emerald-100 text-emerald-700 border-emerald-200"
              : "bg-muted text-muted-foreground border-border"
          }`}>
            {isPublished ? "✅ เผยแพร่แล้ว" : "📝 ร่าง"}
          </span>
          <span className="text-xs text-muted-foreground sm:hidden">{wordCount.toLocaleString()} คำ</span>
        </div>

        {/* Editor */}
        <div className="flex-1 bg-card border border-border/60 rounded-2xl overflow-hidden shadow-sm">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="เริ่มเขียนเนื้อหาตอนนี้..."
            className="w-full h-full min-h-[60vh] p-6 bg-transparent text-sm leading-relaxed font-body resize-none focus:outline-none placeholder:text-muted-foreground/40"
            style={{ fontFamily: "var(--font-body)" }}
          />
        </div>

        {/* Bottom word count bar */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pb-2">
          <span>{wordCount.toLocaleString()} คำ</span>
          <span>{content.length.toLocaleString()} ตัวอักษร</span>
        </div>
      </div>
    </AppLayout>
  );
}