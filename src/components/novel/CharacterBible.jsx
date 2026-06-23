import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Users, Trash2, Edit2, User, Loader2, History, Network } from "lucide-react";
import VersionHistoryDialog from "./VersionHistoryDialog";
import { motion, AnimatePresence } from "framer-motion";
import CharacterForm from "./CharacterForm";
import CharacterRelationshipMap from "./CharacterRelationshipMap";
import { useStorySeasons, dedupeByName } from "@/hooks/useStorySeasons";
import { Layers } from "lucide-react";

const roleColors = {
  "ตัวเอก": "bg-amber-100 text-amber-700",
  "ตัวรอง": "bg-sky-100 text-sky-700",
  "ตัวร้าย": "bg-red-100 text-red-700",
  "ตัวประกอบ": "bg-gray-100 text-gray-600",
};

export default function CharacterBible({ novelId, novel, focusCharacterName, onFocusConsumed }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [versionChar, setVersionChar] = useState(null);
  const queryClient = useQueryClient();

  // เรื่องหลัก + ทุกภาค → อ่านตัวละครร่วมข้ามภาค, สร้างใหม่ผูกกับ root เสมอ
  const { rootNovelId, seasonIds } = useStorySeasons(novelId, novel);

  const { data: novelWriter } = useQuery({
    queryKey: ["writer", novel?.writer_id],
    queryFn: () => base44.entities.Writer.filter({ id: novel.writer_id }),
    enabled: !!novel?.writer_id,
    select: (d) => d[0],
  });

  const seasonKey = seasonIds.join(",");
  const { data: rawCharacters = [], isLoading } = useQuery({
    queryKey: ["characters-bible", "story", rootNovelId, seasonKey],
    queryFn: async () => {
      const lists = await Promise.all(
        seasonIds.map((id) => base44.entities.Character.filter({ novel_id: id }))
      );
      return lists.flat().filter((c) => !c.is_deleted);
    },
    enabled: seasonIds.length > 0,
    staleTime: 0,
  });

  // รวมรายการชื่อซ้ำข้ามภาคเป็นรายการเดียว (มีป้ายบอกว่าซ้ำ)
  const characters = dedupeByName(rawCharacters, "name");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["characters-bible", "story", rootNovelId, seasonKey] });

  // เมื่อถูกส่งชื่อตัวละครมาจากไทม์ไลน์ → มีอยู่แล้วเปิดแก้ไข, ไม่มีให้สร้างใหม่ (ผูก root) แล้วเปิดแก้ไขทันที
  const [focusResolving, setFocusResolving] = useState(false);
  useEffect(() => {
    if (!focusCharacterName || !rootNovelId || isLoading || focusResolving) return;
    const target = focusCharacterName.trim().toLowerCase();
    const existing = rawCharacters.find(
      (c) => (c.name || "").trim().toLowerCase() === target
    );
    if (existing) {
      setEditing(existing);
      setDialogOpen(true);
      onFocusConsumed?.();
      return;
    }
    // ไม่มี → สร้างใหม่ผูกกับเรื่องหลัก แล้วเปิดฟอร์มแก้ไขต่อ
    setFocusResolving(true);
    base44.entities.Character
      .create({ name: focusCharacterName.trim(), novel_id: rootNovelId })
      .then((created) => {
        invalidate();
        setEditing(created);
        setDialogOpen(true);
      })
      .finally(() => {
        setFocusResolving(false);
        onFocusConsumed?.();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusCharacterName, rootNovelId, isLoading]);

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Character.update(id, { is_deleted: true }),
    onSuccess: invalidate,
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
          onRestored={invalidate}
        />
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="font-heading text-lg font-semibold">คลังตัวละคร</h2>
          <p className="text-sm text-muted-foreground">{characters.length} ตัวละคร</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CharacterRelationshipMap novelId={rootNovelId} seasonIds={seasonIds} />
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
                novelId={rootNovelId}
                character={editing}
                novelIdForVersion={rootNovelId}
                writerSystemPrompt={novelWriter?.system_prompt}
                onDone={() => { setDialogOpen(false); setEditing(null); invalidate(); }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* สรุปบทบาทตัวละคร */}
      {characters.length > 0 && (
        <div className="mb-8 bg-gradient-to-br from-primary/5 via-secondary/30 to-primary/5 border border-primary/15 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-primary" />
            <h3 className="font-heading font-semibold text-primary">สรุปบทบาทตัวละคร</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {characters.map((char) => (
              <div
                key={char.id}
                className="bg-card/80 backdrop-blur-sm rounded-xl p-4 border border-border/60 hover:border-primary/30 transition-all"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Badge className={`${roleColors[char.role] || roleColors["ตัวประกอบ"]} text-xs font-medium`}>
                    {char.role}
                  </Badge>
                  <span className="font-semibold text-foreground">{char.name}</span>
                </div>
                <div className="space-y-2 text-sm">
                  {char.desire && (
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      <div>
                        <span className="text-muted-foreground font-medium">เป้าหมาย: </span>
                        <span className="text-foreground/90">{char.desire}</span>
                      </div>
                    </div>
                  )}
                  {char.relationships && (
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                      <div>
                        <span className="text-muted-foreground font-medium">ความสัมพันธ์: </span>
                        <span className="text-foreground/90">{char.relationships}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                    <p className="font-medium truncate">{char.name}</p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      <Badge className={`${roleColors[char.role] || roleColors["ตัวประกอบ"]} text-xs`}>
                        {char.role || "ตัวประกอบ"}
                      </Badge>
                      {char._isDuplicated && (
                        <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-600 bg-orange-50 gap-1">
                          <Layers className="w-2.5 h-2.5" />
                          ซ้ำ {char._duplicates.length + 1} ภาค
                        </Badge>
                      )}
                      {char.dialect && char.dialect !== "กลาง" && (
                        <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                          {char.dialect}
                        </Badge>
                      )}
                      {char.age && (
                        <span className="text-xs text-muted-foreground">{char.age} ปี</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="ประวัติเวอร์ชัน" onClick={(e) => { e.stopPropagation(); setVersionChar(char); }}>
                      <History className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="แก้ไข" onClick={(e) => { e.stopPropagation(); handleOpenEdit(char); }}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" title="ลบ" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(char.id); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                {expandedId === char.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-border/40 px-4 py-4 space-y-3 text-sm"
                  >
                    {char.dialect && (
                      <div>
                        <span className="text-muted-foreground font-medium">ภาษาถิ่น: </span>
                        <Badge variant="outline" className="text-xs border-primary/30 text-primary ml-1.5">
                          {char.dialect}
                        </Badge>
                      </div>
                    )}
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