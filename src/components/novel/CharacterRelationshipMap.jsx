import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Network, User, Clock } from "lucide-react";
import { motion } from "framer-motion";

const roleColors = {
  "ตัวเอก": "bg-amber-100 text-amber-700",
  "ตัวรอง": "bg-sky-100 text-sky-700",
  "ตัวร้าย": "bg-red-100 text-red-700",
  "ตัวประกอบ": "bg-gray-100 text-gray-600",
};

export default function CharacterRelationshipMap({ novelId }) {
  const [open, setOpen] = useState(false);

  const { data: characters = [] } = useQuery({
    queryKey: ["characters", novelId],
    queryFn: () => base44.entities.Character.filter({ novel_id: novelId }),
    enabled: open,
  });

  const { data: events = [] } = useQuery({
    queryKey: ["plotEvents", novelId],
    queryFn: () => base44.entities.PlotEvent.filter({ novel_id: novelId }, "order"),
    enabled: open,
  });

  // สร้าง mapping ของตัวละครในแต่ละเหตุการณ์
  const characterEventMap = characters.map((char) => {
    const involvedEvents = events.filter((ev) => {
      const charsInvolved = ev.characters_involved || "";
      return charsInvolved.includes(char.name) || charsInvolved.includes(char.name.split(" ")[0]);
    });

    // วิเคราะห์ความสัมพันธ์จากฟิลด์ relationships
    const relationships = [];
    if (char.relationships) {
      const relLines = char.relationships.split("/").map((r) => r.trim());
      relLines.forEach((rel) => {
        if (rel.includes("กับ")) {
          const [target, description] = rel.split("กับ").map((s) => s.trim());
          relationships.push({ target, description });
        }
      });
    }

    return {
      ...char,
      involvedEvents,
      relationships,
    };
  });

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 text-muted-foreground">
            <Network className="w-3.5 h-3.5" />
            ความสัมพันธ์ตัวละคร
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] p-0">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/60">
            <DialogTitle className="font-heading flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              แผนที่ความสัมพันธ์ตัวละคร
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              แสดงตัวละครที่ปรากฏในแต่ละเหตุการณ์และความสัมพันธ์ระหว่างตัวละคร
            </p>
          </DialogHeader>

          <ScrollArea className="max-h-[65vh] px-6 py-5">
            <div className="space-y-6">
              {/* ส่วนที่ 1: สรุปตัวละครทั้งหมด */}
              <div>
                <h3 className="font-heading font-semibold text-sm mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  ตัวละครทั้งหมด ({characters.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {characterEventMap.map((char) => (
                    <motion.div
                      key={char.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-card/60 border border-border/60 rounded-xl p-3 hover:border-primary/30 transition-all"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={`${roleColors[char.role] || roleColors["ตัวประกอบ"]} text-xs`}>
                          {char.role}
                        </Badge>
                        <span className="font-semibold text-sm">{char.name}</span>
                      </div>
                      {char.relationships.length > 0 && (
                        <div className="space-y-1.5 text-xs">
                          {char.relationships.map((rel, idx) => (
                            <div key={idx} className="flex items-start gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1 shrink-0" />
                              <div>
                                <span className="text-muted-foreground font-medium">กับ{rel.target}: </span>
                                <span className="text-foreground/90">{rel.description}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* ส่วนที่ 2: เหตุการณ์และตัวละครที่เกี่ยวข้อง */}
              {events.length > 0 && (
                <div>
                  <h3 className="font-heading font-semibold text-sm mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    ตัวละครในแต่ละเหตุการณ์ ({events.length})
                  </h3>
                  <div className="space-y-3">
                    {events.map((ev, i) => {
                      // หาตัวละครที่เกี่ยวข้องกับเหตุการณ์นี้
                      const involvedCharacters = characterEventMap.filter((char) =>
                        ev.characters_involved?.includes(char.name) ||
                        ev.characters_involved?.includes(char.name.split(" ")[0])
                      );

                      return (
                        <motion.div
                          key={ev.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="bg-gradient-to-br from-primary/5 via-secondary/30 to-primary/5 border border-primary/15 rounded-xl p-4"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-mono text-primary/70">#{ev.order}</span>
                            <h4 className="font-semibold text-foreground">{ev.title}</h4>
                            {ev.time_period && (
                              <span className="text-xs text-muted-foreground">· {ev.time_period}</span>
                            )}
                          </div>
                          {ev.description && (
                            <p className="text-sm text-muted-foreground mb-3">{ev.description}</p>
                          )}
                          {involvedCharacters.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {involvedCharacters.map((char) => (
                                <Badge
                                  key={char.id}
                                  className={`${roleColors[char.role] || roleColors["ตัวประกอบ"]} text-xs gap-1.5`}
                                >
                                  <User className="w-2.5 h-2.5" />
                                  {char.name}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">ไม่มีตัวละครที่ระบุ</p>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}