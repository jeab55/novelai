import React, { useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Users, ArrowLeft, Network, Loader2 } from "lucide-react";
import { useStorySeasons, fetchAcrossSeasons } from "@/hooks/useStorySeasons";
import RelationshipGraph from "@/components/novel/RelationshipGraph";

function getRelationshipType(description = "") {
  const desc = description.toLowerCase();
  if (desc.includes("รัก") || desc.includes("slow-burn") || desc.includes("ใจ")) return "รัก";
  if (desc.includes("ศัตรู") || desc.includes("ปรปักษ์") || desc.includes("ใส่ความ")) return "ศัตรู";
  if (desc.includes("เพื่อน")) return "เพื่อน";
  if (desc.includes("คู่แข่ง") || desc.includes("แข่งขัน")) return "คู่แข่ง";
  if (desc.includes("มิตร") || desc.includes("ไว้ใจ") || desc.includes("ร่วมงาน")) return "มิตร";
  return "อื่นๆ";
}

const matchChar = (characters, raw) =>
  characters.find((c) =>
    c.name.includes(raw) || raw.includes(c.name) ||
    c.name.split(" ")[0].includes(raw.split(" ")[0])
  );

// หาตัวละครอื่นที่ถูกเอ่ยถึงในข้อความความสัมพันธ์ (จับชื่อ/ชื่อต้นที่ปรากฏในประโยค)
const findMentioned = (characters, self, text) =>
  characters.filter((c) => {
    if (c.id === self.id) return false;
    const first = c.name.split(" ")[0];
    return text.includes(c.name) || (first.length >= 2 && text.includes(first));
  });

const legendItems = [
  { color: "#ec4899", label: "รัก" },
  { color: "#ef4444", label: "ศัตรู" },
  { color: "#3b82f6", label: "เพื่อน" },
  { color: "#f97316", label: "คู่แข่ง" },
  { color: "#22c55e", label: "มิตร" },
  { color: "#94a3b8", label: "เกี่ยวข้อง" },
];

export default function CharacterRelationships() {
  const { id: novelId } = useParams();
  const navigate = useNavigate();

  const { data: novel } = useQuery({
    queryKey: ["novel", novelId],
    queryFn: () => base44.entities.Novel.get(novelId),
    enabled: !!novelId,
  });

  const { rootNovelId, seasonIds } = useStorySeasons(novelId, novel);
  const seasonKey = seasonIds.join(",");

  const { data: characters = [], isLoading: loadingChars } = useQuery({
    queryKey: ["characters", "story", rootNovelId, seasonKey],
    queryFn: async () => (await fetchAcrossSeasons("Character", seasonIds)).filter((c) => !c.is_deleted),
    enabled: seasonIds.length > 0,
  });

  const { data: events = [] } = useQuery({
    queryKey: ["plotEvents", "story", rootNovelId, seasonKey],
    queryFn: async () => (await fetchAcrossSeasons("PlotEvent", seasonIds, "order")).filter((e) => !e.is_deleted),
    enabled: seasonIds.length > 0,
  });

  // สร้างเส้นเชื่อมโยงจากฟิลด์ความสัมพันธ์ + เหตุการณ์ที่ปรากฏร่วมกัน (ไม่ซ้ำคู่)
  const edges = useMemo(() => {
    const seen = new Set();
    const result = [];
    const addEdge = (from, to, type, source) => {
      if (from === to) return;
      const key = [from, to].sort().join("|");
      if (seen.has(key)) return;
      seen.add(key);
      result.push({ from, to, type, source });
    };

    // จากฟิลด์ relationships — จับทุกตัวละครที่ถูกเอ่ยถึงในแต่ละบรรทัด
    characters.forEach((char) => {
      if (!char.relationships) return;
      char.relationships.split("/").map((r) => r.trim()).filter(Boolean).forEach((rel) => {
        const targets = findMentioned(characters, char, rel);
        targets.forEach((target) => addEdge(char.id, target.id, getRelationshipType(rel), "field"));
      });
    });

    // จากเหตุการณ์ที่ปรากฏร่วมกัน
    events.forEach((ev) => {
      if (!ev.characters_involved) return;
      const involved = ev.characters_involved.split(",").map((s) => s.trim())
        .map((name) => matchChar(characters, name)).filter(Boolean);
      for (let i = 0; i < involved.length; i++) {
        for (let j = i + 1; j < involved.length; j++) {
          addEdge(involved[i].id, involved[j].id, "อื่นๆ", "event");
        }
      }
    });

    return result;
  }, [characters, events]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate(`/novel/${novelId}`)}>
            <ArrowLeft className="w-4 h-4" />กลับห้องเขียน
          </Button>
          <div className="flex items-center gap-2">
            <Network className="w-5 h-5 text-primary" />
            <h1 className="font-heading text-lg sm:text-xl font-semibold">แผนผังความสัมพันธ์ตัวละคร</h1>
          </div>
          {novel?.title && <span className="text-sm text-muted-foreground truncate">— {novel.title}</span>}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4 text-xs text-muted-foreground">
          {legendItems.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 rounded-full" style={{ backgroundColor: l.color }} />
              {l.label}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed border-muted-foreground/60" />
            ปรากฏร่วมในเหตุการณ์
          </span>
        </div>

        {/* Graph */}
        <div className="rounded-2xl border border-border/60 bg-card/50 p-4 sm:p-6">
          {loadingChars ? (
            <div className="flex items-center justify-center py-24 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />กำลังโหลดตัวละคร...
            </div>
          ) : characters.length === 0 ? (
            <div className="text-center py-24 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>ยังไม่มีตัวละครในคลังตัวละคร</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate(`/novel/${novelId}`)}>
                ไปเพิ่มตัวละคร
              </Button>
            </div>
          ) : (
            <>
              <RelationshipGraph characters={characters} edges={edges} />
              <p className="text-center text-xs text-muted-foreground mt-4">
                {characters.length} ตัวละคร · {edges.length} ความเชื่อมโยง — ชี้/แตะที่ตัวละครเพื่อเน้นเส้นเชื่อมโยง
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}