import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Heart, Sword, Shield, HelpCircle, Network, Search } from "lucide-react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";

const roleColors = {
  "ตัวเอก": "bg-amber-100 text-amber-700",
  "ตัวรอง": "bg-sky-100 text-sky-700",
  "ตัวร้าย": "bg-red-100 text-red-700",
  "ตัวประกอบ": "bg-gray-100 text-gray-600",
};

const relationshipTypeColors = {
 มิตร: "bg-green-100 text-green-700 border-green-200",
 ศัตรู: "bg-red-100 text-red-700 border-red-200",
  รัก: "bg-pink-100 text-pink-700 border-pink-200",
  คู่แข่ง: "bg-orange-100 text-orange-700 border-orange-200",
  เพื่อน: "bg-blue-100 text-blue-700 border-blue-200",
  อื่นๆ: "bg-gray-100 text-gray-600 border-gray-200",
};

function getRelationshipType(description) {
  const desc = description.toLowerCase();
  if (desc.includes("รัก") || desc.includes("slow-burn") || desc.includes("ใจ")) return "รัก";
  if (desc.includes("ศัตรู") || desc.includes("ปรปักษ์") || desc.includes("ใส่ความ")) return "ศัตรู";
  if (desc.includes("เพื่อน") || desc.includes("เพื่อนแท้")) return "เพื่อน";
  if (desc.includes("คู่แข่ง") || desc.includes("แข่งขัน")) return "คู่แข่ง";
  if (desc.includes("มิตร") || desc.includes("ไว้ใจ") || desc.includes("ร่วมงาน")) return "มิตร";
  return "อื่นๆ";
}

export default function CharacterRelationshipDiagram({ novelId }) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedChar, setSelectedChar] = useState(null);

  const { data: characters = [] } = useQuery({
    queryKey: ["characters", novelId],
    queryFn: async () => {
      const all = await base44.entities.Character.filter({ novel_id: novelId });
      return all.filter((c) => !c.is_deleted);
    },
    enabled: open,
  });

  const { data: events = [] } = useQuery({
    queryKey: ["plotEvents", novelId],
    queryFn: async () => {
      const all = await base44.entities.PlotEvent.filter({ novel_id: novelId }, "order");
      return all.filter((e) => !e.is_deleted);
    },
    enabled: open,
  });

  // วิเคราะห์ความสัมพันธ์จากฟิลด์ relationships
  const relationshipNetwork = useMemo(() => {
    const network = {};
    
    characters.forEach((char) => {
      network[char.id] = {
        character: char,
        relationships: [],
        coAppearances: new Set(),
      };

      if (char.relationships) {
        const relLines = char.relationships.split("/").map((r) => r.trim());
        relLines.forEach((rel) => {
          if (rel.includes("กับ")) {
            const [targetRaw, description] = rel.split("กับ").map((s) => s.trim());
            // หาตัวละครที่ตรงกับ target
            const targetChar = characters.find((c) => 
              c.name.includes(targetRaw) || targetRaw.includes(c.name) ||
              c.name.split(" ")[0].includes(targetRaw.split(" ")[0])
            );
            
            if (targetChar) {
              const relType = getRelationshipType(description);
              network[char.id].relationships.push({
                target: targetChar,
                description,
                type: relType,
              });
            }
          }
        });
      }
    });

    // หา co-appearance ในเหตุการณ์
    events.forEach((ev) => {
      if (ev.characters_involved) {
        const involvedNames = ev.characters_involved.split(",").map((s) => s.trim());
        const involvedChars = characters.filter((char) =>
          involvedNames.some((name) => 
            char.name.includes(name) || name.includes(char.name) ||
            char.name.split(" ")[0].includes(name.split(" ")[0])
          )
        );

        involvedChars.forEach((char1) => {
          involvedChars.forEach((char2) => {
            if (char1.id !== char2.id && network[char1.id]) {
              network[char1.id].coAppearances.add(char2.id);
            }
          });
        });
      }
    });

    return network;
  }, [characters, events]);

  // กรองตาม search
  const filteredCharacters = useMemo(() => {
    if (!searchTerm) return characters;
    return characters.filter((char) =>
      char.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      char.role.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [characters, searchTerm]);

  const selectedCharData = selectedChar ? relationshipNetwork[selectedChar.id] : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Network className="w-3.5 h-3.5" />
          แผนภาพความสัมพันธ์
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/60 shrink-0">
          <DialogTitle className="font-heading flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            แผนภาพความสัมพันธ์ตัวละคร
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            แสดงความสัมพันธ์ระหว่างตัวละคร มิตร/ศัตรู/รัก และเหตุการณ์ที่ปรากฏร่วมกัน
          </p>
        </DialogHeader>

        {/* Search */}
        <div className="px-6 py-3 border-b border-border/40 bg-muted/30">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหาตัวละคร..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* ด้านซ้าย: รายชื่อตัวละคร */}
          <ScrollArea className="w-80 border-r border-border/40">
            <div className="p-4 space-y-2">
              {filteredCharacters.map((char) => {
                const charData = relationshipNetwork[char.id];
                const relCount = charData?.relationships.length || 0;
                const coCount = charData?.coAppearances.size || 0;

                return (
                  <motion.button
                    key={char.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => setSelectedChar(char)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      selectedChar?.id === char.id
                        ? "bg-primary/5 border-primary/30 shadow-sm"
                        : "bg-card/50 border-border/60 hover:border-primary/20 hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4 text-primary/60" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{char.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge className={`${roleColors[char.role] || roleColors["ตัวประกอบ"]} text-[10px] px-1.5 py-0`}>
                            {char.role}
                          </Badge>
                          {relCount > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              {relCount} ความสัมพันธ์
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </ScrollArea>

          {/* ด้านขวา: รายละเอียดความสัมพันธ์ */}
          <ScrollArea className="flex-1">
            {selectedChar ? (
              <div className="p-5 space-y-5">
                {/* Header */}
                <div className="flex items-center gap-3 pb-4 border-b border-border/40">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="w-6 h-6 text-primary/60" />
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold text-lg">{selectedChar.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={`${roleColors[selectedChar.role] || roleColors["ตัวประกอบ"]} text-xs`}>
                        {selectedChar.role}
                      </Badge>
                      {selectedChar.age && <span className="text-xs text-muted-foreground">{selectedChar.age} ปี</span>}
                    </div>
                  </div>
                </div>

                {/* ความสัมพันธ์ */}
                {selectedCharData?.relationships.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                      <Heart className="w-4 h-4 text-pink-500" />
                      ความสัมพันธ์ ({selectedCharData.relationships.length})
                    </h4>
                    <div className="space-y-2">
                      {selectedCharData.relationships.map((rel, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className={`p-3 rounded-lg border ${relationshipTypeColors[rel.type] || relationshipTypeColors["อื่นๆ"]}`}
                        >
                          <div className="flex items-start gap-2">
                            {rel.type === "ศัตรู" ? (
                              <Sword className="w-4 h-4 mt-0.5 shrink-0" />
                            ) : rel.type === "รัก" ? (
                              <Heart className="w-4 h-4 mt-0.5 shrink-0" />
                            ) : rel.type === "มิตร" || rel.type === "เพื่อน" ? (
                              <Shield className="w-4 h-4 mt-0.5 shrink-0" />
                            ) : (
                              <HelpCircle className="w-4 h-4 mt-0.5 shrink-0" />
                            )}
                            <div className="flex-1">
                              <p className="font-medium text-sm">
                                กับ <span className="text-foreground">{rel.target.name}</span>
                              </p>
                              <p className="text-xs mt-1 opacity-80">{rel.description}</p>
                            </div>
                            <Badge className="text-[10px] shrink-0">{rel.type}</Badge>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ปรากฏร่วมกัน */}
                {selectedCharData?.coAppearances.size > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      ปรากฏในเหตุการณ์เดียวกัน
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(selectedCharData.coAppearances).map((charId) => {
                        const char = characters.find((c) => c.id === charId);
                        if (!char) return null;
                        return (
                          <Badge
                            key={charId}
                            variant="outline"
                            className="text-xs bg-accent/30 cursor-pointer hover:bg-accent/50 transition-colors"
                            onClick={() => setSelectedChar(char)}
                          >
                            {char.name}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* จุดประสงค์ */}
                {selectedChar.desire && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-amber-500" />
                      จุดประสงค์หลัก
                    </h4>
                    <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                      {selectedChar.desire}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full py-20">
                <div className="text-center text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>เลือกตัวละครเพื่อดูความสัมพันธ์</p>
                </div>
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}