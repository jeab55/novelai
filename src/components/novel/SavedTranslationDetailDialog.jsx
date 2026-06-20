import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Languages, Sparkles, FileText, BookPlus } from "lucide-react";

function countWords(text) {
  if (!text) return 0;
  try {
    const seg = new Intl.Segmenter("th", { granularity: "word" });
    return [...seg.segment(text)].filter((s) => s.isWordLike).length;
  } catch {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }
}

export default function SavedTranslationDetailDialog({ project, open, onClose, onCreateNovel }) {
  if (!project) return null;
  let translations = [];
  let drafts = [];
  try { translations = JSON.parse(project.translations || "[]"); } catch { /* ignore */ }
  try { drafts = JSON.parse(project.drafts || "[]"); } catch { /* ignore */ }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            {project.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5">
          {project.genre && <Badge variant="secondary" className="text-xs">{project.genre}</Badge>}
          {project.tone && <Badge variant="outline" className="text-xs">{project.tone}</Badge>}
          {project.word_target && <Badge variant="outline" className="text-xs">~{project.word_target.toLocaleString()} คำ</Badge>}
          <Badge variant="outline" className="text-xs">{project.combine_mode === "separate" ? "แยกตอน" : "รวมเรื่องเดียว"}</Badge>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-4 mt-1">
          {/* ต้นฉบับแปล */}
          <div className="space-y-2">
            <p className="text-sm font-semibold flex items-center gap-1.5"><Languages className="w-4 h-4 text-sky-600" />เนื้อหาต้นฉบับที่แปลแล้ว</p>
            {translations.map((t, i) => (
              <div key={i} className="rounded-xl border border-border/60 bg-card overflow-hidden">
                <div className="flex items-center justify-between bg-sky-50 dark:bg-sky-950/20 px-3 py-1.5 border-b border-border/50">
                  <span className="text-xs font-medium">{t.title}</span>
                  <Badge variant="outline" className="text-xs">{countWords(t.text).toLocaleString()} คำ</Badge>
                </div>
                <p className="p-3 text-sm whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">{t.text}</p>
              </div>
            ))}
          </div>

          {/* ร่างดัดแปลง */}
          <div className="space-y-2">
            <p className="text-sm font-semibold flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-primary" />ร่างเนื้อเรื่องที่ดัดแปลงแล้ว</p>
            {drafts.map((d, i) => (
              <div key={i} className="rounded-xl border border-border/60 bg-card overflow-hidden">
                <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/20 px-3 py-1.5 border-b border-border/50">
                  <span className="text-xs font-medium">{d.title}</span>
                  <Badge variant="outline" className="text-xs">{countWords(d.content).toLocaleString()} คำ</Badge>
                </div>
                <p className="p-3 text-sm whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">{d.content}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose}>ปิด</Button>
          <Button className="flex-[2] gap-2" onClick={() => onCreateNovel(project)}>
            <BookPlus className="w-4 h-4" />สร้างนิยายต่อ
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}