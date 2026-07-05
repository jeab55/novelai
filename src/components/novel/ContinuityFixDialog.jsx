import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Save, Lightbulb, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { saveChapterContent } from "@/lib/saveChapterContent";

// ไดอะล็อกแก้ไขเนื้อหาตอนที่มีจุดขัดแย้ง แล้วบันทึกลงเนื้อหาจริง
export default function ContinuityFixDialog({ open, onOpenChange, issue, novelId, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [chapter, setChapter] = useState(null);
  const [content, setContent] = useState("");

  useEffect(() => {
    if (!open || !issue?.chapter_id) return;
    let active = true;
    setLoading(true);
    setChapter(null);
    setContent("");
    (async () => {
      try {
        const all = await base44.entities.Chapter.list();
        const found = all.find((c) => c.id === issue.chapter_id);
        if (!active) return;
        if (found) {
          setChapter(found);
          setContent(found.content || "");
        } else {
          toast.error("ไม่พบตอนที่ต้องการแก้ไข");
        }
      } catch (e) {
        if (active) toast.error("โหลดเนื้อหาไม่สำเร็จ: " + (e.message || ""));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [open, issue?.chapter_id]);

  const handleSave = async () => {
    if (!chapter) return;
    setSaving(true);
    try {
      const res = await saveChapterContent({
        novelId,
        chapterId: chapter.id,
        content,
        status: chapter.status || "ร่าง",
      });
      if (res?.success) {
        toast.success("บันทึกการแก้ไขเรียบร้อยแล้ว");
        onSaved?.();
        onOpenChange(false);
      } else {
        toast.error(res?.error || "บันทึกไม่สำเร็จ");
      }
    } catch (e) {
      toast.error("บันทึกไม่สำเร็จ: " + (e.message || ""));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-primary" />
            แก้ไขเนื้อหา — {issue?.order ? issue.order + ". " : ""}{issue?.chapter_title || ""}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />กำลังโหลดเนื้อหา...
          </div>
        ) : (
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-3">
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800 p-3">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">{issue?.title}</p>
                {issue?.detail && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 whitespace-pre-line">{issue.detail}</p>
                )}
              </div>
              {issue?.suggestion && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-900/10 dark:border-blue-800 p-3">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                    <Lightbulb className="w-4 h-4" />ข้อเสนอแนะวิธีแก้
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-400 mt-1 whitespace-pre-line">{issue.suggestion}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium mb-1.5">เนื้อหาตอน (แก้ไขได้)</p>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[320px] font-body text-sm leading-relaxed"
                  placeholder="เนื้อหาตอน..."
                />
              </div>
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>ยกเลิก</Button>
          <Button onClick={handleSave} disabled={loading || saving || !chapter} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            บันทึกการแก้ไข
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}