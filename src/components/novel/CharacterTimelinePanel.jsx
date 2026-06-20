import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, Loader2, Sparkles, MapPin, Activity, TrendingUp, BookOpen, UserCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { invokeAIStable } from "@/lib/aiInvoke";

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

export default function CharacterTimelinePanel({ novelId, novel }) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, label: "" });
  // rows: [{ chapterTitle, order, appearances: [{character, location, action, development}] }]
  const [rows, setRows] = useState(null);
  const [filterChar, setFilterChar] = useState("all");

  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters-chartimeline", novelId],
    queryFn: async () => {
      const list = await base44.entities.Chapter.filter({ novel_id: novelId }, "order");
      return list.filter((c) => !c.is_deleted).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    },
    enabled: !!novelId,
  });

  const { data: characters = [] } = useQuery({
    queryKey: ["characters-chartimeline", novelId],
    queryFn: async () => {
      const list = await base44.entities.Character.filter({ novel_id: novelId });
      return list.filter((c) => !c.is_deleted);
    },
    enabled: !!novelId,
  });

  const written = chapters.filter((c) => (c.content || "").trim().length > 50);

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
        const row = { chapterTitle: ch.title, order: ch.order || i + 1, appearances: Array.isArray(apps) ? apps : [] };
        built.push(row);
        setRows([...built]);
        setProgress({ done: i + 1, total: written.length, label: `วิเคราะห์แล้ว ${i + 1}/${written.length} ตอน` });
      }
      toast.success("สร้างไทม์ไลน์ตัวละครสำเร็จ");
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
                        <CardTitle className="text-base flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-primary shrink-0" />
                          ตอน {row.order}: {row.chapterTitle}
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