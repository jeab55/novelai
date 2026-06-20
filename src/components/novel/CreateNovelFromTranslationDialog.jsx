import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookPlus, Loader2, Save, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

function countWords(text) {
  if (!text) return 0;
  try {
    const seg = new Intl.Segmenter("th", { granularity: "word" });
    return [...seg.segment(text)].filter((s) => s.isWordLike).length;
  } catch {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }
}

export default function CreateNovelFromTranslationDialog({ project, open, onClose, novels = [] }) {
  const queryClient = useQueryClient();
  const [saveMode, setSaveMode] = useState("new");
  const [newTitle, setNewTitle] = useState("");
  const [targetNovelId, setTargetNovelId] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  React.useEffect(() => {
    if (open && project) {
      setSaveMode("new");
      setNewTitle(project.name || "");
      setTargetNovelId("");
      setDone(false);
    }
  }, [open, project]);

  if (!project) return null;

  let drafts = [];
  let translations = [];
  try { drafts = JSON.parse(project.drafts || "[]"); } catch { /* ignore */ }
  try { translations = JSON.parse(project.translations || "[]"); } catch { /* ignore */ }

  const handleSave = async () => {
    const validDrafts = drafts.filter((d) => d.content?.trim());
    if (validDrafts.length === 0) {
      toast.error("ไม่มีร่างเนื้อเรื่องให้บันทึก");
      return;
    }
    setSaving(true);
    try {
      let novelId = targetNovelId;
      if (saveMode === "new") {
        if (!newTitle.trim()) {
          toast.error("กรุณาใส่ชื่อเรื่อง");
          setSaving(false);
          return;
        }
        const novel = await base44.entities.Novel.create({
          title: newTitle.trim(),
          genre: project.genre || undefined,
          synopsis: (translations[0]?.text || "").slice(0, 300),
        });
        novelId = novel.id;
      }
      if (!novelId) {
        toast.error("กรุณาเลือกนิยายปลายทาง");
        setSaving(false);
        return;
      }

      const existing = await base44.entities.Chapter.filter({ novel_id: novelId });
      let maxOrder = existing.reduce((m, c) => Math.max(m, c.order || 0), 0);

      for (const d of validDrafts) {
        maxOrder += 1;
        await base44.entities.Chapter.create({
          novel_id: novelId,
          title: d.title || `ตอนที่ ${maxOrder}`,
          content: d.content,
          order: maxOrder,
          word_count: countWords(d.content),
          status: "ร่าง",
        });
      }

      queryClient.invalidateQueries({ queryKey: ["chapters-all"] });
      queryClient.invalidateQueries({ queryKey: ["chapters", novelId] });
      queryClient.invalidateQueries({ queryKey: ["novels"] });
      queryClient.invalidateQueries({ queryKey: ["novels-all"] });
      setDone(true);
      toast.success("สร้างนิยายจากงานแปลเรียบร้อยแล้ว!");
    } catch (e) {
      toast.error("บันทึกไม่สำเร็จ: " + (e.message || ""));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <BookPlus className="w-5 h-5 text-primary" />
            สร้างนิยายต่อจากงานแปล
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-green-100 dark:bg-green-900/20 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-heading font-semibold mb-2">สร้างสำเร็จ!</h3>
            <p className="text-sm text-muted-foreground mb-6">บันทึกร่าง {drafts.length} ตอนเข้าโปรเจกต์แล้ว</p>
            <Button onClick={onClose}>ปิด</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              จะบันทึกร่างเนื้อเรื่องที่ดัดแปลง {drafts.length} ตอนเข้าโปรเจกต์
            </p>
            <div className="flex gap-2">
              <Button variant={saveMode === "new" ? "default" : "outline"} className="flex-1 h-10" onClick={() => setSaveMode("new")}>📖 นิยายใหม่</Button>
              <Button variant={saveMode === "existing" ? "default" : "outline"} className="flex-1 h-10" onClick={() => setSaveMode("existing")}>📁 นิยายที่มีอยู่</Button>
            </div>
            {saveMode === "new" ? (
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="ชื่อนิยายใหม่" className="h-10" />
            ) : (
              <Select value={targetNovelId} onValueChange={setTargetNovelId}>
                <SelectTrigger className="h-10"><SelectValue placeholder="เลือกนิยายปลายทาง (เพิ่มเป็นตอนใหม่)" /></SelectTrigger>
                <SelectContent>{novels.map((n) => <SelectItem key={n.id} value={n.id}>{n.title}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>ยกเลิก</Button>
              <Button
                className="flex-[2] gap-2"
                onClick={handleSave}
                disabled={saving || (saveMode === "new" ? !newTitle.trim() : !targetNovelId)}
              >
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" />กำลังบันทึก...</> : <><Save className="w-4 h-4" />บันทึกเข้าโปรเจกต์</>}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}