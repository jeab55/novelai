import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2, RotateCcw, AlertTriangle } from "lucide-react";

/**
 * mode: "delete" | "restore" | "permanent"
 */
export default function DeleteNovelDialog({ open, onClose, onConfirm, novel, mode = "delete", isPending = false }) {
  if (!novel) return null;

  const config = {
    delete: {
      icon: <Trash2 className="w-5 h-5 text-destructive" />,
      title: "ย้ายไปถังขยะ",
      desc: `"${novel.title}" จะถูกย้ายไปถังขยะ สามารถกู้คืนได้ในภายหลัง`,
      confirmLabel: "ย้ายไปถังขยะ",
      confirmClass: "bg-destructive hover:bg-destructive/90 text-destructive-foreground",
    },
    restore: {
      icon: <RotateCcw className="w-5 h-5 text-primary" />,
      title: "กู้คืนนิยาย",
      desc: `"${novel.title}" จะถูกกู้คืนกลับมาในรายการนิยายปกติ`,
      confirmLabel: "กู้คืน",
      confirmClass: "",
    },
    permanent: {
      icon: <AlertTriangle className="w-5 h-5 text-destructive" />,
      title: "ลบถาวร",
      desc: `"${novel.title}" จะถูกลบออกจากระบบถาวร ไม่สามารถกู้คืนได้อีก`,
      confirmLabel: "ลบถาวร",
      confirmClass: "bg-destructive hover:bg-destructive/90 text-destructive-foreground",
    },
  };

  const c = config[mode];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            {c.icon}
            {c.title}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground leading-relaxed mt-1">{c.desc}</p>
        <div className="flex gap-2 mt-4">
          <Button variant="ghost" className="flex-1" onClick={onClose} disabled={isPending}>
            ยกเลิก
          </Button>
          <Button
            className={`flex-1 ${c.confirmClass}`}
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? "กำลังดำเนินการ..." : c.confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}