import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, ChevronRight, RotateCcw, Loader2, Clock, User } from "lucide-react";
import { saveVersion } from "@/lib/saveVersion";
import { toast } from "sonner";
import { format } from "date-fns";
import { th } from "date-fns/locale";

const ENTITY_LABEL = {
  chapter: "ตอน",
  plot_event: "เหตุการณ์",
  character: "ตัวละคร",
  world_entry: "โลก/ฉาก",
  novel: "ข้อมูลเรื่อง",
};

// แสดงเนื้อหา snapshot แบบอ่านอย่างเดียว
function SnapshotViewer({ snapshot, entityType }) {
  let data = {};
  try { data = JSON.parse(snapshot); } catch { return <p className="text-sm text-muted-foreground">ไม่สามารถแสดงข้อมูลได้</p>; }

  const fields = Object.entries(data).filter(([k]) => !["id", "created_date", "updated_date", "created_by_id", "novel_id"].includes(k));

  return (
    <div className="space-y-3 text-sm">
      {fields.map(([key, value]) => {
        if (!value && value !== 0) return null;
        const label = key.replace(/_/g, " ");
        const displayVal = typeof value === "boolean" ? (value ? "ใช่" : "ไม่") : String(value);
        return (
          <div key={key}>
            <p className="text-xs text-muted-foreground font-medium capitalize mb-0.5">{label}</p>
            <p className="leading-relaxed whitespace-pre-wrap text-foreground bg-muted/30 rounded-lg px-3 py-2">{displayVal}</p>
          </div>
        );
      })}
    </div>
  );
}

export default function VersionHistoryDialog({
  open,
  onClose,
  entityType,
  entityId,
  novelId,
  currentData,       // ข้อมูลปัจจุบัน (object) เพื่อ snapshot ก่อนกู้คืน
  currentLabel,      // label ย่อของ record ปัจจุบัน
  createdByName,
  onRestored,        // callback หลังกู้คืน (entityType, entityId, restoredData)
}) {
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const queryClient = useQueryClient();

  const { data: versions = [], isLoading } = useQuery({
    queryKey: ["versions", entityType, entityId],
    queryFn: () =>
      base44.entities.Version.filter({ entity_type: entityType, entity_id: entityId }, "-created_date"),
    enabled: open && !!entityId,
  });

  const restoreMutation = useMutation({
    mutationFn: async (version) => {
      // 1. snapshot ปัจจุบันก่อนกู้คืน
      await saveVersion({
        entityType,
        entityId,
        novelId,
        data: currentData,
        label: `[ก่อนกู้คืน] ${currentLabel || ""}`,
        createdByName,
      });

      // 2. parse snapshot เก่า
      const oldData = JSON.parse(version.snapshot);
      const { id, created_date, updated_date, created_by_id, novel_id, ...restoreFields } = oldData;

      // 3. update record
      const entityMap = {
        chapter: base44.entities.Chapter,
        plot_event: base44.entities.PlotEvent,
        character: base44.entities.Character,
        world_entry: base44.entities.WorldEntry,
        novel: base44.entities.Novel,
      };
      await entityMap[entityType].update(entityId, restoreFields);
      return restoreFields;
    },
    onSuccess: (restoredData) => {
      queryClient.invalidateQueries({ queryKey: ["versions", entityType, entityId] });
      if (onRestored) onRestored(entityType, entityId, restoredData);
      toast.success("กู้คืนเวอร์ชันเรียบร้อยแล้ว");
      setConfirmRestore(false);
      setSelectedVersion(null);
      onClose();
    },
    onError: () => {
      toast.error("กู้คืนไม่สำเร็จ กรุณาลองใหม่");
    },
  });

  const formatDate = (dateStr) => {
    try {
      return format(new Date(dateStr), "d MMM yyyy · HH:mm น.", { locale: th });
    } catch {
      return dateStr || "";
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setSelectedVersion(null); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-border/60 shrink-0">
            <DialogTitle className="font-heading flex items-center gap-2">
              <History className="w-4 h-4 text-primary" />
              ประวัติเวอร์ชัน — {ENTITY_LABEL[entityType] || entityType}
              {currentLabel && <span className="text-sm font-normal text-muted-foreground">({currentLabel})</span>}
            </DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : versions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <History className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">ยังไม่มีประวัติเวอร์ชัน</p>
              <p className="text-xs text-muted-foreground/60 mt-1">ประวัติจะถูกบันทึกทุกครั้งที่มีการบันทึกข้อมูล</p>
            </div>
          ) : (
            <div className="flex flex-1 min-h-0">
              {/* รายการเวอร์ชัน */}
              <div className="w-56 shrink-0 border-r border-border/60 flex flex-col">
                <div className="px-3 py-2 bg-muted/30 border-b border-border/40">
                  <p className="text-xs text-muted-foreground font-medium">{versions.length} เวอร์ชัน</p>
                </div>
                <ScrollArea className="flex-1">
                  <div className="py-1">
                    {versions.map((v, i) => (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVersion(v)}
                        className={`w-full text-left px-3 py-3 hover:bg-muted/40 transition-colors border-b border-border/30 last:border-0 ${selectedVersion?.id === v.id ? "bg-primary/8 border-l-2 border-l-primary" : ""}`}
                      >
                        <div className="flex items-center gap-1 mb-0.5">
                          {i === 0 && (
                            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">ล่าสุด</span>
                          )}
                        </div>
                        <p className="text-xs font-medium leading-snug line-clamp-2 text-foreground">
                          {v.label || `เวอร์ชัน ${versions.length - i}`}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <Clock className="w-2.5 h-2.5 text-muted-foreground/60" />
                          <p className="text-[10px] text-muted-foreground/70">{formatDate(v.created_date)}</p>
                        </div>
                        {v.created_by_name && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <User className="w-2.5 h-2.5 text-muted-foreground/60" />
                            <p className="text-[10px] text-muted-foreground/70">{v.created_by_name}</p>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* เนื้อหาเวอร์ชัน */}
              <div className="flex-1 flex flex-col min-w-0">
                {selectedVersion ? (
                  <>
                    <div className="px-4 py-3 border-b border-border/40 bg-muted/20 flex items-center justify-between shrink-0">
                      <div>
                        <p className="text-sm font-medium">{selectedVersion.label || "เวอร์ชันนี้"}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(selectedVersion.created_date)}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 h-7 text-xs border-primary/30 text-primary hover:bg-primary/5"
                        onClick={() => setConfirmRestore(true)}
                        disabled={restoreMutation.isPending}
                      >
                        <RotateCcw className="w-3 h-3" />
                        กู้คืนเวอร์ชันนี้
                      </Button>
                    </div>
                    <ScrollArea className="flex-1 p-4">
                      <SnapshotViewer snapshot={selectedVersion.snapshot} entityType={entityType} />
                    </ScrollArea>
                  </>
                ) : (
                  <div className="flex flex-1 items-center justify-center flex-col gap-2 text-muted-foreground/50">
                    <ChevronRight className="w-6 h-6" />
                    <p className="text-sm">เลือกเวอร์ชันเพื่อดูเนื้อหา</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmRestore} onOpenChange={setConfirmRestore}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">ยืนยันการกู้คืนเวอร์ชัน</AlertDialogTitle>
            <AlertDialogDescription>
              ระบบจะบันทึก snapshot ของสถานะปัจจุบันไว้ก่อน แล้วจึงกู้คืนข้อมูลเก่ากลับเข้า record
              คุณสามารถย้อนกลับได้เสมอ
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => restoreMutation.mutate(selectedVersion)}
              disabled={restoreMutation.isPending}
            >
              {restoreMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              กู้คืนเลย
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}