import React, { useState, useCallback, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Loader2, Download, Copy, MoreHorizontal, Maximize2, Minimize2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { debounce } from "lodash";
import { downloadChapterTxt, downloadChapterMd, copyChapterToClipboard } from "@/utils/exportChapter";

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
  const thaiChars = (cleaned.match(/[\u0E00-\u0E7F]/g) || []).length;
  const eng = (cleaned.match(/[a-zA-Z]+/g) || []).length;
  return Math.round(thaiChars / 3.5) + eng;
}

export default function ChapterEditor({ chapter, novelId, onBack }) {
  const [title, setTitle] = useState(chapter.title);
  const [content, setContent] = useState(chapter.content || "");
  const [status, setStatus] = useState(chapter.status || "ร่าง");
  const [saving, setSaving] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const queryClient = useQueryClient();

  const wordCount = countWords(content);

  // ออกโหมดโฟกัสด้วย Esc
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape" && focusMode) setFocusMode(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [focusMode]);

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

  const toolbar = (
    <div className={`border-b border-border/60 px-4 py-2.5 flex items-center gap-3 transition-all ${focusMode ? "bg-background/95 backdrop-blur-sm" : "bg-card/30"}`}>
      {!focusMode && (
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
      )}
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="max-w-sm font-heading font-semibold border-none bg-transparent shadow-none focus-visible:ring-0 px-0 text-base"
      />
      <div className="flex items-center gap-2 ml-auto">
        <span className="text-xs text-muted-foreground tabular-nums">
          {wordCount.toLocaleString()} คำ
        </span>

        {/* Focus mode toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => setFocusMode((v) => !v)}
          title={focusMode ? "ออกโหมดโฟกัส (Esc)" : "โหมดโฟกัส"}
        >
          {focusMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </Button>

        {/* Export menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => downloadChapterTxt(title, content)}>
              <Download className="w-3.5 h-3.5 mr-2" />
              ดาวน์โหลดเป็น .txt
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => downloadChapterMd(title, content)}>
              <Download className="w-3.5 h-3.5 mr-2" />
              ดาวน์โหลดเป็น .md
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                await copyChapterToClipboard(title, content);
                toast.success("คัดลอกแล้ว");
              }}
            >
              <Copy className="w-3.5 h-3.5 mr-2" />
              คัดลอกทั้งตอน
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {!focusMode && (
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
        )}
        <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          บันทึก
        </Button>
      </div>
    </div>
  );

  // โหมดโฟกัส: fullscreen overlay
  if (focusMode) {
    return (
      <div className="fixed inset-0 z-50 bg-[hsl(35,30%,97%)] flex flex-col">
        {toolbar}
        <div className="flex-1 overflow-auto">
          <div className="mx-auto px-8 py-12" style={{ maxWidth: "720px" }}>
            <textarea
              autoFocus
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                debouncedAutoSave(e.target.value);
              }}
              placeholder="เริ่มเขียนเรื่องราวของคุณที่นี่..."
              className="w-full min-h-[80vh] bg-transparent border-none outline-none resize-none placeholder:text-muted-foreground/40"
              style={{
                fontFamily: "'Sarabun', 'Noto Sans Thai', sans-serif",
                fontSize: "19px",
                lineHeight: "1.9",
                color: "hsl(25, 20%, 15%)",
              }}
            />
          </div>
        </div>
        <div className="text-center pb-4">
          <span className="text-xs text-muted-foreground/50">กด Esc เพื่อออกจากโหมดโฟกัส</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      {toolbar}
      <div className="flex-1 overflow-auto bg-background">
        <div className="mx-auto px-8 py-10" style={{ maxWidth: "720px" }}>
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              debouncedAutoSave(e.target.value);
            }}
            placeholder="เริ่มเขียนเรื่องราวของคุณที่นี่..."
            className="w-full min-h-[65vh] bg-transparent border-none outline-none resize-none placeholder:text-muted-foreground/40"
            style={{
              fontFamily: "'Sarabun', 'Noto Sans Thai', sans-serif",
              fontSize: "19px",
              lineHeight: "1.9",
              color: "hsl(25, 20%, 15%)",
            }}
          />
        </div>
      </div>
    </div>
  );
}