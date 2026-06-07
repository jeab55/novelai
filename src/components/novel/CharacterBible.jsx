import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Users, Trash2, Edit2, User, Loader2, History } from "lucide-react";
import VersionHistoryDialog from "./VersionHistoryDialog";
import { motion, AnimatePresence } from "framer-motion";
import CharacterForm from "./CharacterForm";

const roleColors = {
  "ตัวเอก": "bg-amber-100 text-amber-700",
  "ตัวรอง": "bg-sky-100 text-sky-700",
  "ตัวร้าย": "bg-red-100 text-red-700",
  "ตัวประกอบ": "bg-gray-100 text-gray-600",
};

export default function CharacterBible({ novelId }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [versionChar, setVersionChar] = useState(null);
  const queryClient = useQueryClient();

  const { data: characters = [], isLoading } = useQuery({
    queryKey: ["characters", novelId],
    queryFn: () => base44.entities.Character.filter({ novel_id: novelId }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Character.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["characters", novelId] }),
  });

  const handleOpenEdit = (char) => {
    setEditing(char);
    setDialogOpen(true);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {versionChar && (
        <VersionHistoryDialog
          open={!!versionChar}
          onClose={() => setVersionChar(null)}
          entityType="character"
          entityId={versionChar.id}
          novelId={novelId}
          currentData={versionChar}
          currentLabel={versionChar.name}
          onRestored={() => queryClient.invalidateQueries({ queryKey: ["characters", novelId] })}
        />
      )}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-heading text-lg font-semibold">คลังตัวละคร</h2>
          <p className="text-sm text-muted-foreground">{characters.length} ตัวละคร</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              เพิ่มตัวละคร
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-heading">{editing ? "แก้ไขตัวละคร" : "เพิ่มตัวละครใหม่"}</DialogTitle>
            </DialogHeader>
            <CharacterForm
              novelId={novelId}
              character={editing}
              novelIdForVersion={novelId}
              onDone={() => { setDialogOpen(false); setEditing(null); }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : characters.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">ยังไม่มีตัวละคร</p>
          <Button onClick={() => setDialogOpen(true)} size="sm" className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            เพิ่มตัวละครแรก
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {characters.map((char, i) => (
              <motion.div
                key={char.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="border border-border/60 rounded-xl overflow-hidden bg-card/50"
              >
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedId(expandedId === char.id ? null : char.id)}
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-primary/60" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{char.name}</p>
                    <p className="text-xs text-muted-foreground">{char.age ? `${char.age} ปี` : ""}</p>
                  </div>
                  <Badge className={`${roleColors[char.role] || roleColors["ตัวประกอบ"]} text-xs`}>
                    {char.role || "ตัวประกอบ"}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="ประวัติเวอร์ชัน" onClick={(e) => { e.stopPropagation(); setVersionChar(char); }}>
                    <History className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleOpenEdit(char); }}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(char.id); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                {expandedId === char.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-border/40 px-4 py-4 space-y-3 text-sm"
                  >
                    {char.appearance && <div><span className="text-muted-foreground font-medium">ลักษณะ:</span> {char.appearance}</div>}
                    {char.personality && <div><span className="text-muted-foreground font-medium">นิสัย:</span> {char.personality}</div>}
                    {char.background && <div><span className="text-muted-foreground font-medium">ปูมหลัง:</span> {char.background}</div>}
                    {char.desire && <div><span className="text-muted-foreground font-medium">ต้องการ:</span> {char.desire}</div>}
                    {char.wound && <div><span className="text-muted-foreground font-medium">ปม/บาดแผล:</span> {char.wound}</div>}
                    {char.relationships && <div><span className="text-muted-foreground font-medium">ความสัมพันธ์:</span> {char.relationships}</div>}
                  </motion.div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}