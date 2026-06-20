import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Target } from "lucide-react";

export default function GoalEditor({ open, onClose, goal, onSave, saving }) {
  const [daily, setDaily] = useState(1000);
  const [perNovel, setPerNovel] = useState(50000);

  useEffect(() => {
    if (goal) {
      setDaily(goal.daily_word_goal || 1000);
      setPerNovel(goal.novel_word_goal || 50000);
    }
  }, [goal, open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />ตั้งเป้าหมายการเขียน
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div>
            <label className="text-sm font-medium mb-1.5 block">เป้าหมายคำต่อวัน</label>
            <Input type="number" min={0} value={daily} onChange={(e) => setDaily(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">เป้าหมายคำต่อเรื่อง</label>
            <Input type="number" min={0} value={perNovel} onChange={(e) => setPerNovel(Number(e.target.value))} />
          </div>
          <Button className="w-full" onClick={() => onSave({ daily_word_goal: daily, novel_word_goal: perNovel })} disabled={saving}>
            {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />กำลังบันทึก...</> : "บันทึกเป้าหมาย"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}