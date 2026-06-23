import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, Loader2, Sparkles, MapPin, Activity, TrendingUp, BookOpen, UserCircle, UserCog, UserPlus,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { invokeAIStable } from "@/lib/aiInvoke";
import { useStorySeasons } from "@/hooks/useStorySeasons";

const TIMELINE_SCHEMA = {
  type: "object",
  properties: {
    appearances: {
      type: "array",
      items: {
        type: "object",
        properties: {
          character: { type: "string" },
          location: { type: "string" },
          action: { type: "string" },
          development: { type: "string" },
        },
      },
    },
  },
};

export default function CharacterTimelinePanel({ novelId, novel, onDevelopCharacter }) {
  // เรื่องหลัก + ทุกภาค → วิเคราะห์/เรียงไทม์ไลน์ตัวละครต่อเนื่องข้ามทุกภาค
  const { rootNovelId, seasons, seasonIds } = useStorySeasons(novelId, novel);
  const seasonKey = seasonIds.join(",");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, label: "" });
  // rows: [{ chapterTitle, order, appearances: [{character, location, action, development}] }]
  const [rows, setRows] = useState(null);
  const [filterChar, setFilterChar] = useState("all");
  const queryClient = useQueryClient();

  // โหลดไทม์ไลน์ที่บันทึกไว้ล่าสุด (ถ้ามี) — ผูกกับเรื่องหลัก (ครอบคลุมทุกภาค)
  const { data: savedTimeline } = useQuery({
    queryKey: ["character-timeline", "story", rootNovelId],
    queryFn: async () => {
      const list = await base44.entities.CharacterTimeline.filter({ novel_id: rootNovelId });
      return list[0] || null;
    },
    enabled: !!rootNovelId,
  });

  // แสดงผลที่บันทึกไว้ตอนเปิดหน้า (ครั้งแรกที่ยังไม่มีผลใน state)
  useEffect(() => {
    if (rows === null && savedTimeline?.rows) {
      try {
        const parsed = JSON.parse(savedTimeline.rows);
        if (Array.isArray(parsed)) setRows(parsed);
      } catch { /* ข้ามถ้า parse ไม่ได้ */ }
    }
  }, [savedTimeline, rows]);

  const persistRows = async (built) => {
    const payload = {
      novel_id: rootNovelId,
      rows: JSON.stringify(built),
      generated_at: new Date().toISOString(),
    };
    if (savedTimeline?.id) {
      await base44.entities.CharacterTimeline.update(savedTimeline.id, payload);
    } else {
      await base44.entities.CharacterTimeline.create(payload);
    }
    queryClient.invalidateQueries({ queryKey: ["character-timeline", "story", rootNovelId] });
  };

  // ดึงตอนจากทุกภาค แล้วเรียงต่อเนื่อง: ภาค 1 ก่อน → ภาค 2, 3... และตาม order ภายในภาค
  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters-chartimeline", "story", rootNovelId, seasonKey],
    queryFn: async () => {
      const seasonOrder = new Map(
        seasons.map((s, i) => [String(s.id), s.season_number ?? i + 1])
      );
      const perSeason = await Promise.all(
        seasonIds.map(async (id) => {
          const list = await base44.entities.Chapter.filter({ novel_id: id }, "order");
          return list.filter((c) => !c.is_deleted).map((c) => ({
            ...c,
            _seasonNo: seasonOrder.get(String(id)) ?? 1,
            _seasonTitle: seasons.find((s) => String(s.id) === String(id))?.title || "",
          }));
        })
      );
      return perSeason
        .flat()
        .sort((a, b) =>
          a._seasonNo !== b._seasonNo
            ? a._seasonNo - b._seasonNo
            : (a.order ?? 0) - (b.order ?? 0)
        );
    },
    enabled: seasonIds.length > 0,
  });

  const { data: characters = [] } = useQuery({
    queryKey: ["characters-chartimeline", "story", rootNovelId, seasonKey],
    queryFn: async () => {
      const lists = await Promise.all(
        seasonIds.map((id) => base44.entities.Character.filter({ novel_id: id }))
      );
      return lists.flat().filter((c) => !c.is_deleted);
    },
    enabled: seasonIds.length > 0,
  });

  const written = chapters.filter((c) => (c.content || "").trim().length > 50);

  // เพิ่มตัวละครที่ไทม์ไลน์ตรวจพบทั้งหมดลงคลังตัวละคร (เฉพาะตัวที่ยังไม่มี)
  const [importing, setImporting] = useState(false);
  const handleImportAll = async () => {
    if (!rows || rows.length === 0) return;
    setImporting(true);
    try {
      // รวมการปรากฏของแต่ละชื่อตัวละครจากทุกตอน
      const map = new Map(); // key: ชื่อ (lower+trim) → { name, appearances: [{order, chapterTitle, location, action, development}] }
      for (const row of rows) {
        for (const a of row.appearances || []) {
          const name = (a.character || "").trim();
          if (!name) continue;
          const key = name.toLowerCase();
          if (!map.has(key)) map.set(key, { name, appearances: [] });
          map.get(key).appearances.push({
            order: row.order,
            chapterTitle: row.chapterTitle,
            location: a.location || "",
            action: a.action || "",
            development: a.development || "",
          });
        }
      }

      // ชื่อตัวละครที่มีอยู่แล้วของทั้งเรื่อง (root + ทุกภาค) เพื่อกันซ้ำ
      const existingLists = await Promise.all(
        seasonIds.map((id) => base44.entities.Character.filter({ novel_id: id }))
      );
      const existingNames = new Set(
        existingLists.flat()
          .filter((c) => !c.is_deleted)
          .map((c) => (c.name || "").trim().toLowerCase())
      );

      const toCreate = [];
      let skipped = 0;
      for (const { name, appearances } of map.values()) {
        if (existingNames.has(name.toLowerCase())) { skipped++; continue; }
        // เติมสรุปจากไทม์ไลน์ลงช่องปูมหลัง
        const lines = appearances.map((ap) => {
          const parts = [];
          if (ap.location) parts.push(`อยู่ที่ ${ap.location}`);
          if (ap.action) parts.push(ap.action);
          if (ap.development) parts.push(`พัฒนาการ: ${ap.development}`);
          return `• ตอน ${ap.order} (${ap.chapterTitle}): ${parts.join(" — ") || "ปรากฏตัว"}`;
        });
        toCreate.push({
          novel_id: rootNovelId,
          name,
          role: "ตัวประกอบ",
          background: `สรุปจากไทม์ไลน์ตัวละคร:\n${lines.join("\n")}`,
        });
      }

      if (toCreate.length === 0) {
        toast.info(`ตัวละครทั้งหมด (${skipped} ตัว) มีอยู่ในคลังแล้ว`);
        return;
      }
      await base44.entities.Character.bulkCreate(toCreate);
      // รีเฟรชหน้าคลังตัวละคร + รายการในหน้านี้
      queryClient.invalidateQueries({ queryKey: ["characters-bible", "story", rootNovelId] });
      queryClient.invalidateQueries({ queryKey: ["characters-chartimeline", "story", rootNovelId] });
      toast.success(`เพิ่ม ${toCreate.length} ตัวละครลงคลังแล้ว${skipped > 0 ? ` (ข้าม ${skipped} ตัวที่มีอยู่แล้ว)` : ""}`);
    } catch (e) {
      toast.error("เพิ่มตัวละครไม่สำเร็จ: " + (e.message || ""));
    } finally {
      setImporting(false);
    }
  };

  const handleBuild = async () => {
    if (written.length === 0) {
      toast.error("ยังไม่มีตอนที่เขียนแล้ว");
      return;
    }
    setRunning(true);
    setRows([]);
    try {
      const charHint = characters.length > 0
        ? `รายชื่อตัวละครหลักในเรื่อง: ${characters.map((c) => c.name).join(", ")}`
        : "";
      const built = [];
      setProgress({ done: 0, total: written.length, label: "กำลังวิเคราะห์ตัวละครในแต่ละตอน..." });
      for (let i = 0; i < written.length; i++) {
        const ch = written[i];
        const prompt = `วิเคราะห์ตอนนิยายต่อไปนี้ แล้วสรุปว่า "ตัวละครแต่ละตัวที่ปรากฏในตอนนี้" — อยู่ที่ไหน ทำอะไร และมีพัฒนาการ/เหตุการณ์สำคัญอะไร
${charHint}

สำหรับตัวละครแต่ละตัวที่ปรากฏจริงในตอนนี้ ให้ระบุ:
- character: ชื่อตัวละคร
- location: สถานที่/ฉากที่ตัวละครอยู่ในตอนนี้
- action: สิ่งที่ตัวละครทำหรือบทบาทในตอนนี้ (กระชับ)
- development: พัฒนาการของตัวละครหรือเหตุการณ์สำคัญที่เกิดกับเขาในตอนนี้ (ถ้าไม่มีให้เว้นว่าง "")

รายงานเฉพาะตัวละครที่ปรากฏจริง อย่าเดาตัวที่ไม่ได้อยู่ในตอน

ตอน "${ch.order ? ch.order + ". " : ""}${ch.title}":
"""
${(ch.content || "").slice(0, 9000)}
"""`;
        const result = await invokeAIStable({
          prompt,
          model: "claude_sonnet_4_6",
          response_json_schema: TIMELINE_SCHEMA,
        });
        const parsed = typeof result === "string" ? JSON.parse(result) : result;
        const apps = parsed?.appearances || parsed?.response?.appearances || parsed?.output?.appearances || [];
        const row = {
          chapterTitle: ch.title,
          order: ch.order || i + 1,
          seasonNo: ch._seasonNo || 1,
          seasonTitle: ch._seasonTitle || "",
          appearances: Array.isArray(apps) ? apps : [],
        };
        built.push(row);
        setRows([...built]);
        setProgress({ done: i + 1, total: written.length, label: `วิเคราะห์แล้ว ${i + 1}/${written.length} ตอน` });
      }
      await persistRows(built);
      toast.success("สร้างและบันทึกไทม์ไลน์ตัวละครสำเร็จ");
    } catch (e) {
      toast.error("สร้างไทม์ไลน์ไม่สำเร็จ: " + (e.message || ""));
    } finally {
      setRunning(false);
    }
  };

  // รายชื่อตัวละครที่พบจริงในผลลัพธ์ (สำหรับ filter)
  const foundChars = Array.from(
    new Set((rows || []).flatMap((r) => r.appearances.map((a) => a.character)).filter(Boolean))
  ).sort();

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="font-heading flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              ไทม์ไลน์ตัวละคร (Character Timeline)
            </CardTitle>
            <Button onClick={handleBuild} disabled={running || written.length === 0} className="gap-2">
              {running ? <><Loader2 className="w-4 h-4 animate-spin" />กำลังสร้าง...</> : <><Sparkles className="w-4 h-4" />สร้างไทม์ไลน์</>}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            สรุปว่าตัวละครแต่ละตัวปรากฏในตอนใด อยู่ที่ไหน ทำอะไร และมีพัฒนาการอะไร — กรองตามตัวละครได้
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {running && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-primary font-medium flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />{progress.label}
                </span>
                <span className="text-muted-foreground">{pct}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div className="h-2 rounded-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}

          {rows && rows.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="gap-1"><UserCircle className="w-3 h-3" />{foundChars.length} ตัวละคร</Badge>
              <Select value={filterChar} onValueChange={setFilterChar}>
                <SelectTrigger className="h-8 w-52 text-xs"><SelectValue placeholder="กรองตามตัวละคร" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกตัวละคร</SelectItem>
                  {foundChars.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                </SelectContent>
              </Select>
              {foundChars.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs border-primary/40 text-primary hover:bg-primary/10 ml-auto"
                  onClick={handleImportAll}
                  disabled={importing}
                >
                  {importing
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />กำลังเพิ่ม...</>
                    : <><UserPlus className="w-3.5 h-3.5" />เพิ่มตัวละครทั้งหมดลงคลังตัวละคร</>}
                </Button>
              )}
            </div>
          )}

          {/* Timeline view */}
          {rows && rows.length > 0 && (
            <div className="space-y-3">
              {rows.map((row, ri) => {
                const apps = row.appearances.filter((a) => filterChar === "all" || a.character === filterChar);
                if (apps.length === 0) return null;
                return (
                  <motion.div key={ri} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: ri * 0.03 }}>
                    <Card className="border-l-4 border-l-primary/50">
                      <CardHeader className="py-3">
                        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                          <BookOpen className="w-4 h-4 text-primary shrink-0" />
                          {seasons.length > 1 && (
                            <Badge variant="outline" className="text-[10px] border-primary/30 text-primary shrink-0">
                              ภาค {row.seasonNo || 1}
                            </Badge>
                          )}
                          <span>ตอน {row.order}: {row.chapterTitle}</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 pt-0">
                        {apps.map((a, ai) => (
                          <div key={ai} className="rounded-lg border border-border/60 bg-secondary/30 p-3 space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <UserCircle className="w-4 h-4 text-primary" />
                              </div>
                              <span className="font-medium text-sm">{a.character}</span>
                              {a.character && onDevelopCharacter && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 ml-auto gap-1 text-xs text-primary hover:bg-primary/10 px-2 shrink-0"
                                  onClick={() => onDevelopCharacter(a.character)}
                                  title="ไปสร้าง/พัฒนาตัวละครนี้ที่หน้าตัวละคร"
                                >
                                  <UserCog className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">สร้าง/พัฒนาที่หน้าตัวละคร</span>
                                </Button>
                              )}
                            </div>
                            <div className="grid sm:grid-cols-3 gap-2 text-xs">
                              {a.location && (
                                <Field icon={MapPin} label="สถานที่" color="text-sky-600" text={a.location} />
                              )}
                              {a.action && (
                                <Field icon={Activity} label="ทำอะไร" color="text-amber-600" text={a.action} />
                              )}
                              {a.development && (
                                <Field icon={TrendingUp} label="พัฒนาการ" color="text-emerald-600" text={a.development} />
                              )}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}

          {!rows && !running && (
            <div className="text-center py-10">
              <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                {written.length === 0 ? "ยังไม่มีตอนที่เขียนแล้ว" : 'กด "สร้างไทม์ไลน์" เพื่อให้ AI สรุปการปรากฏของตัวละครในแต่ละตอน'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ icon: Icon, label, color, text }) {
  return (
    <div>
      <p className={`flex items-center gap-1 font-medium mb-0.5 ${color}`}>
        <Icon className="w-3 h-3" />{label}
      </p>
      <p className="text-muted-foreground leading-relaxed">{text}</p>
    </div>
  );
}