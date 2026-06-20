import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ShieldCheck, Loader2, Sparkles, AlertTriangle, CheckCircle2, Users, Clock, Globe, Brain,
  ChevronDown, ChevronUp, ListTree,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { invokeAIStable } from "@/lib/aiInvoke";

const TYPE_META = {
  character: { icon: Users, label: "ตัวละคร", color: "bg-rose-100 text-rose-800 border-rose-300" },
  timeline: { icon: Clock, label: "ไทม์ไลน์", color: "bg-amber-100 text-amber-800 border-amber-300" },
  world: { icon: Globe, label: "โลก/ฉาก", color: "bg-sky-100 text-sky-800 border-sky-300" },
  plot: { icon: Brain, label: "พล็อตค้าง", color: "bg-violet-100 text-violet-800 border-violet-300" },
};
const SEVERITY = {
  high: { label: "รุนแรง", color: "bg-red-100 text-red-800 border-red-300", bar: "border-l-red-500" },
  medium: { label: "ปานกลาง", color: "bg-yellow-100 text-yellow-800 border-yellow-300", bar: "border-l-yellow-500" },
  low: { label: "เล็กน้อย", color: "bg-blue-100 text-blue-800 border-blue-300", bar: "border-l-blue-500" },
};

const ISSUE_SCHEMA = {
  type: "object",
  properties: {
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["character", "timeline", "world", "plot"] },
          severity: { type: "string", enum: ["high", "medium", "low"] },
          title: { type: "string" },
          description: { type: "string" },
          chapters: { type: "array", items: { type: "string" } },
          suggestion: { type: "string" },
        },
      },
    },
  },
};

export default function ContinuityCheckPanel({ novelId, novel }) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, label: "" });
  const [issues, setIssues] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [filterType, setFilterType] = useState("all");

  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters-continuity", novelId],
    queryFn: async () => {
      const list = await base44.entities.Chapter.filter({ novel_id: novelId }, "order");
      return list.filter((c) => !c.is_deleted).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    },
    enabled: !!novelId,
  });

  const written = chapters.filter((c) => (c.content || "").trim().length > 50);

  const handleScan = async () => {
    if (written.length < 2) {
      toast.error("ต้องมีตอนที่เขียนแล้วอย่างน้อย 2 ตอนจึงจะตรวจความต่อเนื่องได้");
      return;
    }
    setRunning(true);
    setIssues([]);
    setExpanded({});
    try {
      // STEP 1: ทยอยสรุปแต่ละตอน (progress จริงตามจำนวนตอน)
      setProgress({ done: 0, total: written.length + 1, label: "กำลังสรุปแต่ละตอน..." });
      const summaries = [];
      for (let i = 0; i < written.length; i++) {
        const ch = written[i];
        const sumPrompt = `สรุปข้อเท็จจริงสำคัญของตอนนี้แบบกระชับเพื่อใช้ตรวจความต่อเนื่อง ระบุ: ตัวละครที่ปรากฏพร้อมลักษณะที่บรรยาย (สีตา สีผม อายุ นิสัย), สถานที่/ฉาก, ช่วงเวลา/ลำดับเหตุการณ์, ข้อมูลโลกที่กล่าวถึง, และปมพล็อตที่เปิดหรือปิดในตอนนี้

ตอน "${ch.order ? ch.order + ". " : ""}${ch.title}":
"""
${(ch.content || "").slice(0, 8000)}
"""`;
        const res = await invokeAIStable({ prompt: sumPrompt, model: "claude_sonnet_4_6" });
        const inner = typeof res === "string" ? res : res?.response ?? res?.output ?? res;
        summaries.push(`[ตอน ${ch.order ? ch.order + ". " : ""}${ch.title}]\n${typeof inner === "string" ? inner : JSON.stringify(inner)}`);
        setProgress({ done: i + 1, total: written.length + 1, label: `สรุปแล้ว ${i + 1}/${written.length} ตอน` });
      }

      // STEP 2: เทียบหาความขัดแย้งข้ามตอน
      setProgress({ done: written.length, total: written.length + 1, label: "กำลังเทียบหาความขัดแย้งข้ามตอน..." });
      const checkPrompt = `คุณคือบรรณาธิการตรวจความต่อเนื่อง (continuity editor) มืออาชีพ จงเปรียบเทียบสรุปทุกตอนต่อไปนี้ของนิยายเรื่อง "${novel?.title || ""}" เพื่อหา "จุดขัดแย้ง/ไม่สอดคล้องกัน" ระหว่างตอน เช่น
- character: ชื่อหรือลักษณะตัวละครที่บรรยายไม่ตรงกัน (สีตา สีผม อายุ นิสัย พฤติกรรม)
- timeline: ลำดับเหตุการณ์หรือไทม์ไลน์ที่ขัดกัน วันเวลาที่ไม่สอดคล้อง
- world: ข้อมูลโลก/สถานที่/ฉากที่เล่าไม่ตรงกัน
- plot: ปมพล็อตที่เปิดไว้แต่ค้างไม่ได้สะสาง

แต่ละปัญหาให้ระบุ:
- type: หนึ่งใน character / timeline / world / plot
- severity: high / medium / low
- title: หัวข้อปัญหาสั้นๆ
- description: อธิบายความขัดแย้งให้ชัดเจนว่าตอนไหนพูดอย่างไร ตอนไหนพูดต่างออกไป
- chapters: รายชื่อตอนที่เกี่ยวข้อง (อ้างชื่อตอนตามที่ให้มา)
- suggestion: ข้อเสนอแนะวิธีแก้ที่ทำได้จริง

ถ้าไม่พบปัญหาให้คืน issues เป็น array ว่าง รายงานเฉพาะที่เป็นความขัดแย้งจริง อย่าเดา

สรุปทุกตอน:
"""
${summaries.join("\n\n").slice(0, 24000)}
"""`;

      const result = await invokeAIStable({
        prompt: checkPrompt,
        model: "claude_sonnet_4_6",
        response_json_schema: ISSUE_SCHEMA,
      });
      const parsed = typeof result === "string" ? JSON.parse(result) : result;
      const list = parsed?.issues || parsed?.response?.issues || parsed?.output?.issues || [];
      setProgress({ done: written.length + 1, total: written.length + 1, label: "เสร็จสิ้น" });
      setIssues(Array.isArray(list) ? list : []);
      toast.success(list.length === 0 ? "ไม่พบจุดขัดแย้ง 🎉" : `พบ ${list.length} จุดที่ควรตรวจสอบ`);
    } catch (e) {
      toast.error("ตรวจความต่อเนื่องไม่สำเร็จ: " + (e.message || ""));
      setIssues(null);
    } finally {
      setRunning(false);
    }
  };

  const filtered = (issues || []).filter((i) => filterType === "all" || i.type === filterType);
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="font-heading flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              ตรวจความต่อเนื่อง (Continuity Check)
            </CardTitle>
            <Button onClick={handleScan} disabled={running || written.length < 2} className="gap-2">
              {running ? <><Loader2 className="w-4 h-4 animate-spin" />กำลังสแกน...</> : <><Sparkles className="w-4 h-4" />สแกนทั้งเรื่อง</>}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            AI จะสแกน {written.length} ตอนที่เขียนแล้ว เพื่อหาจุดขัดแย้งเรื่องตัวละคร ไทม์ไลน์ โลก/ฉาก และพล็อตที่ค้าง
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

          {issues && !running && issues.length === 0 && (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-900/10">
              <AlertDescription className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                <span className="text-sm">ไม่พบจุดขัดแย้งระหว่างตอน เนื้อเรื่องสอดคล้องกันดี</span>
              </AlertDescription>
            </Alert>
          )}

          {issues && !running && issues.length > 0 && (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="gap-1"><AlertTriangle className="w-3 h-3" />{issues.length} จุด</Badge>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกประเภท</SelectItem>
                    <SelectItem value="character">ตัวละคร</SelectItem>
                    <SelectItem value="timeline">ไทม์ไลน์</SelectItem>
                    <SelectItem value="world">โลก/ฉาก</SelectItem>
                    <SelectItem value="plot">พล็อตค้าง</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <AnimatePresence>
                {filtered.map((issue, idx) => {
                  const tm = TYPE_META[issue.type] || TYPE_META.plot;
                  const sv = SEVERITY[issue.severity] || SEVERITY.low;
                  const Icon = tm.icon;
                  const open = expanded[idx];
                  return (
                    <motion.div key={idx} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}>
                      <Card className={`border-l-4 ${sv.bar}`}>
                        <CardHeader className="py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className={`p-2 rounded-lg ${tm.color}`}><Icon className="w-4 h-4" /></div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <Badge className={sv.color}>{sv.label}</Badge>
                                  <Badge variant="outline">{tm.label}</Badge>
                                </div>
                                <CardTitle className="text-base">{issue.title}</CardTitle>
                                {issue.chapters?.length > 0 && (
                                  <p className="text-xs text-muted-foreground mt-1">ตอนที่เกี่ยวข้อง: {issue.chapters.join(", ")}</p>
                                )}
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setExpanded((p) => ({ ...p, [idx]: !p[idx] }))}>
                              {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </div>
                        </CardHeader>
                        {open && (
                          <CardContent className="space-y-3 pt-0">
                            <div>
                              <p className="text-sm font-medium mb-1">รายละเอียดความขัดแย้ง</p>
                              <p className="text-sm text-muted-foreground whitespace-pre-line">{issue.description}</p>
                            </div>
                            {issue.suggestion && (
                              <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                                <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">💡 ข้อเสนอแนะวิธีแก้</p>
                                <p className="text-sm text-blue-700 dark:text-blue-400 whitespace-pre-line">{issue.suggestion}</p>
                              </div>
                            )}
                          </CardContent>
                        )}
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </>
          )}

          {!issues && !running && (
            <div className="text-center py-10">
              <ListTree className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                {written.length < 2 ? "ต้องมีตอนที่เขียนแล้วอย่างน้อย 2 ตอน" : 'กด "สแกนทั้งเรื่อง" เพื่อให้ AI ตรวจหาจุดขัดแย้ง'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}