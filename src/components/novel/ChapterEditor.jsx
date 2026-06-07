import React, { useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { debounce } from "lodash";

function countWords(text) {
  if (!text) return 0;
  const cleaned = text.replace(/<[^>]*>/g, " ").replace(/&[a-z]+;/g, " ");
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter("th", { granularity: "word" });
    let count = 0;
    for (const seg of segmenter.segment(cleaned)) {
      if (seg.isWordLike) count++;
    }
    return count;
  }
  // fallback: ประมาณจากอักขระไทย + คำอังกฤษ
  const thaiChars = (cleaned.match(/[\u0E00-\u0E7F]/g) || []).length;
  const eng = (cleaned.match(/[a-zA-Z]+/g) || []).length;
  return Math.round(thaiChars / 3.5) + eng;
}

export default function ChapterEditor({ chapter, novelId, onBack }) {
  const [title, setTitle] = useState(chapter.title);
  const [content, setContent] = useState(chapter.content || "");
  const [status, setStatus] = useState(chapter.status || "ร่าง");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const wordCount = countWords(content);

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.Chapter.update(chapter.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chapters", novelId] });
      toast.success("บันทึกแล้ว");
      setSaving(false);
    },
    onError: () => setSaving(false),
  });

  const handleSave = () => {
    setSaving(true);
    saveMutation.mutate({ title, content, status, word_count: wordCount });
  };

  const debouncedAutoSave = useCallback(
    debounce((newContent) => {
      base44.entities.Chapter.update(chapter.id, {
        content: newContent,
        word_count: countWords(newContent),
      });
    }, 3000),
    [chapter.id]
  );

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      {/* Toolbar */}
      <div className="border-b border-border/60 px-4 py-2.5 flex items-center gap-3 bg-card/30">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="max-w-xs font-heading font-medium border-none bg-transparent shadow-none focus-visible:ring-0 px-0 text-base"
        />
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-muted-foreground">{wordCount.toLocaleString()} คำ</span>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ร่าง">ร่าง</SelectItem>
              <SelectItem value="เขียนเสร็จ">เขียนเสร็จ</SelectItem>
              <SelectItem value="เผยแพร่">เผยแพร่</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            บันทึก
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              debouncedAutoSave(e.target.value);
            }}
            placeholder="เริ่มเขียนเรื่องราวของคุณที่นี่..."
            className="w-full min-h-[60vh] bg-transparent border-none outline-none resize-none font-body text-base leading-loose placeholder:text-muted-foreground/50"
          />
        </div>
      </div>
    </div>
  );
}