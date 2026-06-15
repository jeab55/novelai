import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Download, FileJson, FileText, HardDrive, Loader2, BookOpen, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";

function countWords(text) {
  if (!text) return 0;
  try {
    const seg = new Intl.Segmenter("th", { granularity: "word" });
    return [...seg.segment(text)].filter((s) => s.isWordLike).length;
  } catch {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }
}

export default function BackupDialog({ open, onClose }) {
  const { user } = useAuth();
  const [backingUp, setBackingUp] = useState(false);
  const [backupComplete, setBackupComplete] = useState(false);

  const { data: novels = [], isLoading: novelsLoading } = useQuery({
    queryKey: ["novels-backup", user?.id],
    queryFn: async () => {
      const all = await base44.entities.Novel.list("-created_date");
      return all.filter((n) => !n.is_deleted);
    },
    enabled: !!user && open,
  });

  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters-backup"],
    queryFn: () => base44.entities.Chapter.list(),
    enabled: !!user && open,
  });

  const { data: characters = [] } = useQuery({
    queryKey: ["characters-backup"],
    queryFn: () => base44.entities.Character.list(),
    enabled: !!user && open,
  });

  const { data: plotEvents = [] } = useQuery({
    queryKey: ["plot-events-backup"],
    queryFn: () => base44.entities.PlotEvent.list(),
    enabled: !!user && open,
  });

  const { data: worldEntries = [] } = useQuery({
    queryKey: ["world-entries-backup"],
    queryFn: () => base44.entities.WorldEntry.list(),
    enabled: !!user && open,
  });

  const totalWords = chapters.reduce((sum, c) => sum + (c.word_count || 0), 0);

  const handleBackupJSON = async () => {
    setBackingUp(true);
    try {
      const backupData = {
        export_date: new Date().toISOString(),
        user_email: user?.email,
        novels: novels.map(novel => ({
          ...novel,
          chapters: chapters.filter(c => String(c.novel_id) === String(novel.id)),
          characters: characters.filter(c => String(c.novel_id) === String(novel.id)),
          plot_events: plotEvents.filter(p => String(p.novel_id) === String(novel.id)),
          world_entries: worldEntries.filter(w => String(w.novel_id) === String(novel.id)),
        })),
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `novel-backup-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setBackupComplete(true);
      toast.success("สำรองข้อมูลเรียบร้อยแล้ว!");
      
      setTimeout(() => {
        setBackupComplete(false);
        onClose();
      }, 2000);
    } catch (e) {
      toast.error("เกิดข้อผิดพลาด: " + e.message);
    } finally {
      setBackingUp(false);
    }
  };

  const handleBackupTXT = async () => {
    setBackingUp(true);
    try {
      let content = `=== สำรองข้อมูลนิยาย ===\nวันที่: ${new Date().toLocaleString("th-TH")}\nผู้ใช้: ${user?.email}\n\n`;
      
      for (const novel of novels) {
        content += `\n═══════════════════════════════════════\n`;
        content += `เรื่อง: ${novel.title}\n`;
        content += `แนว: ${novel.genre || "-"}\n`;
        content += `สถานะ: ${novel.status || "-"}\n`;
        if (novel.synopsis) content += `เรื่องย่อ: ${novel.synopsis}\n`;
        content += `═══════════════════════════════════════\n\n`;

        const novelChapters = chapters
          .filter(c => String(c.novel_id) === String(novel.id))
          .sort((a, b) => (a.order || 0) - (b.order || 0));

        for (const ch of novelChapters) {
          content += `\n--- ${ch.title} ---\n`;
          content += `${ch.content || ""}\n\n`;
        }
      }

      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `novel-backup-${new Date().toISOString().split("T")[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setBackupComplete(true);
      toast.success("สำรองข้อมูลเป็น TXT แล้ว!");
      
      setTimeout(() => {
        setBackupComplete(false);
        onClose();
      }, 2000);
    } catch (e) {
      toast.error("เกิดข้อผิดพลาด: " + e.message);
    } finally {
      setBackingUp(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-primary" />
            สำรองข้อมูลนิยาย
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <span>{novels.length} เรื่อง</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <span>{chapters.length} ตอน</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span>{characters.length} ตัวละคร</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileJson className="w-4 h-4 text-primary" />
                  <span>{totalWords.toLocaleString()} คำ</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              เลือกวิธีสำรองข้อมูล:
            </p>
            
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2"
                onClick={handleBackupJSON}
                disabled={backingUp || novelsLoading || novels.length === 0}
              >
                {backingUp ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileJson className="w-5 h-5" />}
                <span className="text-sm font-medium">JSON (พร้อมนำเข้าใหม่)</span>
                <span className="text-xs text-muted-foreground">รวมทุกข้อมูล + โครงสร้าง</span>
              </Button>

              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2"
                onClick={handleBackupTXT}
                disabled={backingUp || novelsLoading || novels.length === 0}
              >
                {backingUp ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                <span className="text-sm font-medium">TXT (อ่านง่าย)</span>
                <span className="text-xs text-muted-foreground">เฉพาะเนื้อหาตอน</span>
              </Button>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <HardDrive className="w-4 h-4" />
              วิธีบันทึกลง Google Drive
            </h4>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>ดาวน์โหลดไฟล์สำรองข้อมูล</li>
              <li>เปิด Google Drive ในเบราว์เซอร์</li>
              <li>ลากไฟล์ที่ดาวน์โหลดไปวางใน Google Drive</li>
              <li>หรือคลิก "ใหม่" → "อัปโหลดไฟล์" → เลือกไฟล์</li>
            </ol>
          </div>

          {backupComplete && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2 text-green-700">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm font-medium">สำรองข้อมูลเรียบร้อยแล้ว!</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}