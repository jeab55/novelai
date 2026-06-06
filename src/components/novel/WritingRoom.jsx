import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, FileText, Save, Loader2, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ChapterEditor from "./ChapterEditor";

const statusColors = {
  "ร่าง": "bg-yellow-100 text-yellow-700",
  "เขียนเสร็จ": "bg-green-100 text-green-700",
  "เผยแพร่": "bg-blue-100 text-blue-700",
};

export default function WritingRoom({ novelId, novel }) {
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [newChapterOpen, setNewChapterOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const queryClient = useQueryClient();

  const { data: chapters = [], isLoading } = useQuery({
    queryKey: ["chapters", novelId],
    queryFn: () => base44.entities.Chapter.filter({ novel_id: novelId }, "order"),
  });

  const createChapter = useMutation({
    mutationFn: (data) => base44.entities.Chapter.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chapters", novelId] });
      setNewChapterOpen(false);
      setNewTitle("");
    },
  });

  const deleteChapter = useMutation({
    mutationFn: (id) => base44.entities.Chapter.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chapters", novelId] });
      setSelectedChapter(null);
    },
  });

  if (selectedChapter) {
    return (
      <ChapterEditor
        chapter={selectedChapter}
        novelId={novelId}
        onBack={() => setSelectedChapter(null)}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-heading text-lg font-semibold">ห้องเขียน</h2>
          <p className="text-sm text-muted-foreground">
            {chapters.length} ตอน · {chapters.reduce((acc, c) => acc + (c.word_count || 0), 0).toLocaleString()} คำ
          </p>
        </div>
        <Dialog open={newChapterOpen} onOpenChange={setNewChapterOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              ตอนใหม่
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading">สร้างตอนใหม่</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <Input
                placeholder="ชื่อตอน"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <Button
                className="w-full"
                onClick={() => createChapter.mutate({
                  novel_id: novelId,
                  title: newTitle,
                  order: chapters.length + 1,
                  status: "ร่าง",
                  content: "",
                  word_count: 0,
                })}
                disabled={!newTitle || createChapter.isPending}
              >
                สร้างตอน
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : chapters.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">ยังไม่มีตอน เริ่มเขียนตอนแรกเลย!</p>
          <Button onClick={() => setNewChapterOpen(true)} size="sm" className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            สร้างตอนแรก
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {chapters.map((ch, i) => (
              <motion.div
                key={ch.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="group flex items-center gap-3 p-4 rounded-xl border border-border/60 hover:border-primary/20 hover:bg-card cursor-pointer transition-all"
                onClick={() => setSelectedChapter(ch)}
              >
                <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center text-sm font-medium text-primary shrink-0">
                  {ch.order || i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{ch.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {(ch.word_count || 0).toLocaleString()} คำ
                  </p>
                </div>
                <Badge className={`${statusColors[ch.status] || statusColors["ร่าง"]} text-xs`}>
                  {ch.status || "ร่าง"}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteChapter.mutate(ch.id);
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}