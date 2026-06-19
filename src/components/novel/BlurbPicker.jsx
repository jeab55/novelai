import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Check } from "lucide-react";

// แสดงคำโปรยหลายแบบที่ AI ร่างให้ ผู้ใช้กดเลือก 1 แบบ
export default function BlurbPicker({ open, onClose, blurbs = [], onSelect }) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            เลือกคำโปรยที่ชอบ
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-1">
          AI ร่างคำโปรยให้ {blurbs.length} แบบ อิงจากเนื้อเรื่องจริง — กดเลือกแบบที่ชอบ
        </p>
        <div className="space-y-3 mt-1">
          {blurbs.map((b, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(b)}
              className="group w-full text-left rounded-xl border border-border/60 bg-muted/20 hover:border-primary/50 hover:bg-primary/5 transition-all p-4"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-primary">แบบที่ {i + 1}</span>
                <span className="flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  <Check className="w-3.5 h-3.5" /> ใช้แบบนี้
                </span>
              </div>
              <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{b}</p>
            </button>
          ))}
        </div>
        <div className="flex justify-end pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>ยกเลิก</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}