import React, { useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Clock, Link2 } from "lucide-react";
import { motion } from "framer-motion";

const roleColors = {
  "ตัวเอก": "bg-amber-100 text-amber-700",
  "ตัวรอง": "bg-sky-100 text-sky-700",
  "ตัวร้าย": "bg-red-100 text-red-700",
  "ตัวประกอบ": "bg-gray-100 text-gray-600",
};

export default function CharacterRelationshipMap({ open, onClose, novelId, seasonIds }) {
  const ids = (seasonIds && seasonIds.length > 0) ? seasonIds : [novelId].filter(Boolean);

  const { data: characters = [] } = useQuery({
    queryKey: ["characters", "story-map", ids.join(",")],
    queryFn: async () => {
      const all = (await Promise.all(ids.map((id) => base44.entities.Character.filter({ novel_id: id })))).flat();
      return all.filter((c) => !c.is_deleted);
    },
    enabled: open && ids.length > 0,
  });

  const { data: events = [] } = useQuery({
    queryKey: ["plotEvents", "story-map", ids.join(",")],
    queryFn: async () => {
      const all = (await Promise.all(ids.map((id) => base44.entities.PlotEvent.filter({ novel_id: id }, "order")))).flat();
      return all.filter((e) => !e.is_deleted);
    },
    enabled: open && ids.length > 0,
  });

  // สร้าง mapping ของตัวละครในแต่ละเหตุการณ์
  const characterEventsMap = useMemo(() => {
    const map = {};
    characters.forEach((char) => {
      map[char.id] = {
        character: char,
        events: [],
        relatedCharacters: new Set(),
      };
    });

    events.forEach((ev) => {
      if (ev.characters_involved) {
        const involvedNames = ev.characters_involved.split(",").map((s) => s.trim());
        involvedNames.forEach((name) => {
          const char = characters.find((c) => c.name.includes(name) || name.includes(c.name));
          if (char && map[char.id]) {
            map[char.id].events.push(ev);
            // เพิ่มตัวละครอื่นที่เกี่ยวข้องในเหตุการณ์เดียวกัน
            involvedNames.forEach((otherName) => {
              if (otherName !== name) {
                const otherChar = characters.find((c) => c.name.includes(otherName) || otherName.includes(c.name));
                if (otherChar && otherChar.id !== char.id) {
                  map[char.id].relatedCharacters.add(otherChar);
                }
              }
            });
          }
        });
      }
    });

    return map;
  }, [characters, events]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/60 shrink-0">
          <DialogTitle className="font-heading flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            ความสัมพันธ์ตัวละครในแต่ละเหตุการณ์
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            แสดงภาพรวมว่าตัวละครแต่ละตัวปรากฏในเหตุการณ์ใดบ้าง และมีความสัมพันธ์กับตัวละครอื่นอย่างไร
          </p>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-5">
          {characters.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">ยังไม่มีตัวละคร</p>
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">ยังไม่มีเหตุการณ์ในไทม์ไลน์</p>
            </div>
          ) : (
            <div className="space-y-6">
              {characters.map((char, i) => {
                const charData = characterEventsMap[char.id];
                const relatedChars = Array.from(charData?.relatedCharacters || []);
                const charEvents = charData?.events || [];

                return (
                  <motion.div
                    key={char.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="border border-border/60 rounded-xl overflow-hidden bg-card/50"
                  >
                    {/* Header */}
                    <div className="bg-gradient-to-r from-primary/5 via-secondary/30 to-primary/5 px-4 py-3 border-b border-border/40">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Users className="w-5 h-5 text-primary/60" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground">{char.name}</h3>
                            <Badge className={`${roleColors[char.role] || roleColors["ตัวประกอบ"]} text-xs`}>
                              {char.role}
                            </Badge>
                          </div>
                          {char.age && <p className="text-xs text-muted-foreground mt-0.5">{char.age} ปี</p>}
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-4 space-y-4">
                      {/* ความสัมพันธ์ */}
                      {relatedChars.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <Link2 className="w-3.5 h-3.5 text-primary" />
                            <span className="text-sm font-medium text-muted-foreground">ตัวละครที่เกี่ยวข้อง:</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {relatedChars.map((rc) => (
                              <Badge key={rc.id} variant="outline" className="text-xs bg-accent/30">
                                {rc.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* เหตุการณ์ที่ปรากฏ */}
                      {charEvents.length > 0 ? (
                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <Clock className="w-3.5 h-3.5 text-primary" />
                            <span className="text-sm font-medium text-muted-foreground">
                              ปรากฏใน {charEvents.length} เหตุการณ์:
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            {charEvents.map((ev) => (
                              <div
                                key={ev.id}
                                className="flex items-start gap-2 text-sm p-2 rounded-lg bg-muted/30 border border-border/40"
                              >
                                <span className="text-xs font-mono text-primary/70 shrink-0">#{ev.order}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-foreground truncate">{ev.title}</p>
                                  {ev.time_period && (
                                    <p className="text-xs text-muted-foreground mt-0.5">{ev.time_period}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground italic">
                          ยังไม่ปรากฏในเหตุการณ์ใด
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}