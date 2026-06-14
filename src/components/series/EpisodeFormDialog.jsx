import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function EpisodeFormDialog({ open, onClose, seriesId, nextEpisodeNumber, onSaved }) {
  const [title, setTitle] = useState("");
  const [epNumber, setEpNumber] = useState(nextEpisodeNumber || 1);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Episode.create(data),
    onSuccess: () => {
      toast.success("เพิ่มตอนใหม่แล้ว");
      setTitle("");
      onSaved();
    },
  });

  const handleSubmit = () => {
    if (!title.trim()) { toast.error("กรุณาใส่ชื่อตอน"); return; }
    createMutation.mutate({
      series_id: seriesId,
      title: title.trim(),
      episode_number: Number(epNumber),
      status: "draft",
      content: "",
      word_count: 0,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/60">
          <DialogTitle className="font-heading">เพิ่มตอนใหม่</DialogTitle>
        </DialogHeader>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">หมายเลขตอน</label>
            <Input
              type="number"
              min={1}
              value={epNumber}
              onChange={(e) => setEpNumber(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">ชื่อตอน <span className="text-destructive">*</span></label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ชื่อตอน..."
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              autoFocus
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border/60 flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            เพิ่มตอน
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}