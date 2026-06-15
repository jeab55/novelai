import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, CheckCircle2, XCircle, AlertCircle, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export default function NovelSpellCheckSummary({ open, onClose, novelId, novel }) {
  // โหลดทุกตอน
  const { data: chapters = [], isLoading } = useQuery({
    queryKey: ["chapters", novelId],
    queryFn: async () => {
      const all = await base44.entities.Chapter.filter({ novel_id: novelId }, "order");
      return all.filter((c) => !c.is_deleted).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    },
    enabled: open,
  });

  // ตรวจสอบคำผิดในแต่ละตอน
  const { data: spellCheckResults = [], isLoading: isChecking } = useQuery({
    queryKey: ["spellCheckResults", novelId, chapters.map(c => c.id).join(",")],
    queryFn: async () => {
      const results = await Promise.all(
        chapters.map(async (chapter) => {
          if (!chapter.content || chapter.content.length === 0) {
            return { chapterId: chapter.id, chapterTitle: chapter.title, chapterOrder: chapter.order, errors: [] };
          }

          try {
            const response = await base44.functions.invoke("checkThaiSpelling", {
              content: chapter.content,
              novel: novel || {},
            });

            const errors = response.data?.spelling_errors || [];
            return {
              chapterId: chapter.id,
              chapterTitle: chapter.title,
              chapterOrder: chapter.order,
              errors,
            };
          } catch (error) {
            console.error(`Error checking chapter ${chapter.id}:`, error);
            return {
              chapterId: chapter.id,
              chapterTitle: chapter.title,
              chapterOrder: chapter.order,
              errors: [],
              error: error.message,
            };
          }
        })
      );
      return results;
    },
    enabled: open && chapters.length > 0,
  });

  // คำนวณสถิติ
  const totalErrors = spellCheckResults.reduce((sum, r) => sum + (r.errors?.length || 0), 0);
  const chaptersWithErrors = spellCheckResults.filter((r) => r.errors?.length > 0).length;
  const chaptersClean = spellCheckResults.filter((r) => !r.errors || r.errors.length === 0).length;

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            สรุปการตรวจคำผิดทั้งเรื่อง — {novel?.title}
          </DialogTitle>
        </DialogHeader>

        {isLoading || isChecking ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">กำลังตรวจคำผิดทุกตอน...</p>
          </div>
        ) : (
          <>
            {/* สถิติ */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-rose-600">{totalErrors}</p>
                <p className="text-xs text-rose-700">คำผิดทั้งหมด</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-amber-600">{chaptersWithErrors}</p>
                <p className="text-xs text-amber-700">ตอนที่มีคำผิด</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">{chaptersClean}</p>
                <p className="text-xs text-emerald-700">ตอนสะอาด</p>
              </div>
            </div>

            {/* รายการตอน */}
            <ScrollArea className="max-h-[50vh]">
              <div className="space-y-3">
                {spellCheckResults.map((result) => (
                  <div
                    key={result.chapterId}
                    className={`border rounded-lg p-4 ${
                      result.errors?.length > 0
                        ? "border-rose-200 bg-rose-50/30"
                        : "border-emerald-200 bg-emerald-50/30"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                          result.errors?.length > 0
                            ? "bg-rose-100 text-rose-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}>
                          {result.chapterOrder}
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm">{result.chapterTitle}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            {result.errors?.length > 0 ? (
                              <>
                                <XCircle className="w-3.5 h-3.5 text-rose-500" />
                                <span className="text-xs text-rose-600 font-medium">
                                  {result.errors.length} คำผิด
                                </span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                <span className="text-xs text-emerald-600 font-medium">ไม่มีคำผิด</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {result.errors?.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {result.errors.slice(0, 5).map((error, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs bg-white rounded p-2 border border-rose-100">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-rose-600 line-through font-medium">{error.wrong}</span>
                                <ChevronRight className="w-3 h-3 text-muted-foreground" />
                                <span className="text-emerald-600 font-medium">{error.correct}</span>
                              </div>
                              {error.context && (
                                <p className="text-muted-foreground mt-1 line-clamp-1">
                                  ...{error.context}...
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                        {result.errors.length > 5 && (
                          <p className="text-xs text-muted-foreground text-center">
                            + อีก {result.errors.length - 5} คำผิด (เปิดตอนเพื่อแก้ไข)
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={onClose}>ปิด</Button>
              <Button
                onClick={() => {
                  toast.info("เปิดตอนที่มีคำผิดเพื่อแก้ไข");
                  onClose();
                }}
              >
                ไปแก้ไข
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}