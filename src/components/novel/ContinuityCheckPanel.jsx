import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ShieldCheck, Loader2, Sparkles, AlertTriangle, CheckCircle2, Users, Clock, Globe, Brain,
  ChevronDown, ChevronUp, ListTree, Save, Check, Square, RotateCcw, Play,
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

const CHAPTER_ISSUE_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "สรุปข้อเท็จจริงสำคัญของตอนนี้แบบกระชับ (ตัวละคร ลักษณะ สถานที่ ช่วงเวลา ข้อมูลโลก ปมพล็อต)" },
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["character", "timeline", "world", "plot"] },
          severity: { type: "string", enum: ["high", "medium", "low"] },
          title: { type: "string" },
          detail: { type: "string", description: "อธิบายความขัดแย้งให้ชัดเจนว่าตอนก่อนหน้าพูดอย่างไร ตอนนี้พูดต่างออกไปอย่างไร" },
          suggestion: { type: "string" },
        },
      },
    },
  },
};

function fmtTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export default function ContinuityCheckPanel({ novelId, novel }) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, label: "" });
  const [issues, setIssues] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [filterType, setFilterType] = useState("all");
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved
  const [record, setRecord] = useState(null);
  const [recordLoaded, setRecordLoaded] = useState(false);
  const [confirmRescan, setConfirmRescan] = useState(false);
  const stopRef = useRef(false);

  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters-continuity", novelId],
    queryFn: async () => {
      const list = await base44.entities.Chapter.filter({ novel_id: novelId }, "order");
      return list.filter((c) => !c.is_deleted).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    },
    enabled: !!novelId,
  });

  const written = chapters.filter((c) => (c.content || "").trim().length > 50);

  // โหลดผลตรวจล่าสุดจาก ContinuityCheck (resume)
  useEffect(() => {
    if (!novelId) return;
    let active = true;
    (async () => {
      try {
        const found = await base44.entities.ContinuityCheck.filter({ novel_id: novelId });
        if (!active) return;
        const rec = found?.[0] || null;
        if (rec) {
          setRecord(rec);
          let parsed = [];
          try { parsed = JSON.parse(rec.issues || "[]"); } catch { parsed = []; }
          setIssues(Array.isArray(parsed) ? parsed : []);
          if (rec.status === "กำลังตรวจ" && rec.progress > 0 && rec.progress < (rec.total || 0)) {
            setProgress({ done: rec.progress, total: rec.total, label: `ตรวจค้างไว้ ${rec.progress}/${rec.total} ตอน` });
          }
        }
      } catch {
        // ignore
      } finally {
        if (active) setRecordLoaded(true);
      }
    })();
    return () => { active = false; };
  }, [novelId]);

  // upsert ผลตรวจลง ContinuityCheck (1 เรคคอร์ดต่อ 1 นิยาย)
  const persist = async ({ issuesArr, done, total, status }) => {
    setSaveStatus("saving");
    const updated_at = new Date().toISOString();
    const payload = {
      novel_id: novelId,
      issues: JSON.stringify(issuesArr),
      progress: done,
      total,
      status,
      updated_at,
    };
    try {
      let rec = record;
      if (rec?.id) {
        await base44.entities.ContinuityCheck.update(rec.id, payload);
        rec = { ...rec, ...payload };
      } else {
        rec = await base44.entities.ContinuityCheck.create(payload);
      }
      setRecord(rec);
      setSaveStatus("saved");
      return rec;
    } catch (e) {
      setSaveStatus("idle");
      throw e;
    }
  };

  const runScan = async (resume) => {
    if (written.length < 2) {
      toast.error("ต้องมีตอนที่เขียนแล้วอย่างน้อย 2 ตอนจึงจะตรวจความต่อเนื่องได้");
      return;
    }
    stopRef.current = false;
    setRunning(true);
    setExpanded({});

    const total = written.length;
    // กันซ้ำ: ตอนที่มี issues อยู่แล้ว + ตอนตามจำนวน progress ที่บันทึกไว้ ถือว่าตรวจแล้ว
    let accIssues = resume ? [...(issues || [])] : [];
    const checkedIds = new Set(resume ? accIssues.map((it) => it.chapter_id).filter(Boolean) : []);
    let startIdx = 0;
    if (resume) {
      const savedProgress = Math.min(record?.progress || 0, total);
      // เริ่มจากตอนแรกที่ยังไม่ถูกตรวจ (เลย progress และไม่อยู่ใน checkedIds)
      startIdx = savedProgress;
      while (startIdx < total && checkedIds.has(written[startIdx].id)) startIdx++;
    }
    if (!resume) setIssues([]);

    // สร้างเรคคอร์ดเริ่มต้น/ตั้งสถานะกำลังตรวจ
    try {
      await persist({ issuesArr: accIssues, done: startIdx, total, status: "กำลังตรวจ" });
    } catch (e) {
      toast.error("บันทึกสถานะเริ่มต้นไม่สำเร็จ: " + (e.message || ""));
      setRunning(false);
      return;
    }

    // เตรียมสรุปตอนก่อนหน้าที่ตรวจไปแล้ว เพื่อใช้เป็นฐานเทียบเมื่อตรวจต่อ
    const priorSummaries = [];
    if (resume) {
      for (let j = 0; j < startIdx; j++) {
        const pc = written[j];
        priorSummaries.push(`[ตอน ${pc.order ? pc.order + ". " : ""}${pc.title}]\n${(pc.content || "").slice(0, 1500)}`);
      }
    }
    try {
      for (let i = startIdx; i < total; i++) {
        if (stopRef.current) {
          await persist({ issuesArr: accIssues, done: i, total, status: "หยุดกลางคัน" });
          toast.message("หยุดการตรวจแล้ว — ผลที่ตรวจมาถูกบันทึกไว้");
          setRunning(false);
          return;
        }
        const ch = written[i];
        // ข้ามตอนที่ตรวจไปแล้ว (กันตรวจซ้ำ/issues ซ้ำ)
        if (checkedIds.has(ch.id)) {
          setProgress({ done: i + 1, total, label: `ตรวจแล้ว ${i + 1}/${total} ตอน` });
          continue;
        }
        const chLabel = `${ch.order ? ch.order + ". " : ""}${ch.title}`;
        setProgress({ done: i, total, label: `กำลังตรวจตอน "${chLabel}"...` });

        const prompt = `คุณคือบรรณาธิการตรวจความต่อเนื่อง (continuity editor) มืออาชีพ กำลังตรวจนิยายเรื่อง "${novel?.title || ""}" ทีละตอน

นี่คือสรุปข้อเท็จจริงของตอนก่อนหน้าทั้งหมด (ใช้เป็นฐานเทียบ):
"""
${priorSummaries.length ? priorSummaries.join("\n\n").slice(0, 18000) : "(นี่คือตอนแรกที่ตรวจ ยังไม่มีตอนก่อนหน้า)"}
"""

ตอนที่กำลังตรวจ "${chLabel}":
"""
${(ch.content || "").slice(0, 9000)}
"""

ให้ทำ 2 อย่าง:
1) summary: สรุปข้อเท็จจริงสำคัญของ "ตอนนี้" แบบกระชับ (ตัวละครที่ปรากฏพร้อมลักษณะ เช่น สีตา สีผม อายุ นิสัย, สถานที่/ฉาก, ช่วงเวลา/ลำดับเหตุการณ์, ข้อมูลโลก, ปมพล็อตที่เปิด/ปิด)
2) issues: หา "จุดขัดแย้ง/ไม่สอดคล้อง" ของตอนนี้เทียบกับตอนก่อนหน้า เช่น
   - character: ลักษณะตัวละครบรรยายไม่ตรงกับตอนก่อน
   - timeline: ลำดับ/วันเวลาเหตุการณ์ขัดกัน
   - world: ข้อมูลโลก/สถานที่เล่าไม่ตรงกัน
   - plot: ปมที่เปิดไว้ก่อนหน้าแต่ค้างไม่สะสาง หรือขัดกัน
   ถ้าไม่พบให้คืน issues เป็น array ว่าง รายงานเฉพาะความขัดแย้งจริง อย่าเดา`;

        const result = await invokeAIStable({
          prompt,
          model: "claude_sonnet_4_6",
          response_json_schema: CHAPTER_ISSUE_SCHEMA,
        });
        const parsed = typeof result === "string" ? JSON.parse(result) : (result?.response ?? result?.output ?? result);
        const summary = parsed?.summary || "";
        const chIssues = Array.isArray(parsed?.issues) ? parsed.issues : [];

        priorSummaries.push(`[ตอน ${chLabel}]\n${summary}`);

        const mapped = chIssues.map((it) => ({
          chapter_id: ch.id,
          chapter_title: ch.title,
          order: ch.order ?? null,
          type: it.type || "plot",
          severity: it.severity || "low",
          title: it.title || "",
          detail: it.detail || "",
          suggestion: it.suggestion || "",
        }));
        accIssues = [...accIssues, ...mapped];
        checkedIds.add(ch.id);

        setIssues([...accIssues]);
        setProgress({ done: i + 1, total, label: `ตรวจแล้ว ${i + 1}/${total} ตอน` });

        // บันทึกเรียลไทม์ทันทีหลังตรวจตอนนี้เสร็จ
        const status = i + 1 >= total ? "ตรวจเสร็จ" : "กำลังตรวจ";
        await persist({ issuesArr: accIssues, done: i + 1, total, status });
      }
      toast.success(accIssues.length === 0 ? "ไม่พบจุดขัดแย้ง 🎉" : `พบ ${accIssues.length} จุดที่ควรตรวจสอบ`);
    } catch (e) {
      // เน็ตหลุด/error: บันทึกผลที่ได้มาแล้ว ไม่ทิ้ง
      try {
        await persist({ issuesArr: accIssues, done: progress.done, total, status: "หยุดกลางคัน" });
      } catch { /* ignore */ }
      toast.error("ตรวจไม่สำเร็จ — ผลที่ตรวจมาแล้วถูกบันทึกไว้: " + (e.message || ""));
    } finally {
      setRunning(false);
    }
  };

  const handleStop = () => { stopRef.current = true; };

  const filtered = (issues || []).filter((i) => filterType === "all" || i.type === filterType);
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const hasResult = Array.isArray(issues);
  const canResume = !running && !!record &&
    (record.status === "หยุดกลางคัน" || record.status === "กำลังตรวจ") &&
    (record.progress || 0) < (record.total || 0);

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="font-heading flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              ตรวจความต่อเนื่อง (Continuity Check)
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {running ? (
                <Button variant="outline" onClick={handleStop} className="gap-2">
                  <Square className="w-4 h-4" />หยุด
                </Button>
              ) : canResume ? (
                <>
                  <Button variant="outline" onClick={() => setConfirmRescan(true)} disabled={written.length < 2} className="gap-2">
                    <RotateCcw className="w-4 h-4" />ตรวจใหม่ทั้งหมด
                  </Button>
                  <Button onClick={() => runScan(true)} disabled={written.length < 2} className="gap-2">
                    <Play className="w-4 h-4" />ตรวจต่อ
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => (hasResult && issues.length >= 0 && record ? setConfirmRescan(true) : runScan(false))}
                  disabled={written.length < 2}
                  className="gap-2"
                >
                  {record ? <><RotateCcw className="w-4 h-4" />ตรวจใหม่ทั้งหมด</> : <><Sparkles className="w-4 h-4" />สแกนทั้งเรื่อง</>}
                </Button>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            AI จะตรวจ {written.length} ตอนที่เขียนแล้วทีละตอน เพื่อหาจุดขัดแย้งเรื่องตัวละคร ไทม์ไลน์ โลก/ฉาก และพล็อตที่ค้าง — บันทึกผลอัตโนมัติทุกตอน
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ตัวบ่งชี้การบันทึก + ความคืบหน้า */}
          {(running || (record && (saveStatus !== "idle" || record.updated_at))) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm flex-wrap gap-2">
                <span className="text-primary font-medium flex items-center gap-1.5">
                  {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  {running ? progress.label : (record?.status || "")}
                </span>
                <span className="flex items-center gap-1.5 text-xs">
                  {saveStatus === "saving" ? (
                    <span className="text-amber-600 flex items-center gap-1"><Save className="w-3.5 h-3.5 animate-pulse" />กำลังบันทึก…</span>
                  ) : (record?.updated_at ? (
                    <span className="text-green-600 flex items-center gap-1"><Check className="w-3.5 h-3.5" />บันทึกแล้ว • {fmtTime(record.updated_at)}</span>
                  ) : null)}
                </span>
              </div>
              {(running || (progress.total > 0)) && (
                <>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>ตรวจแล้ว {progress.done}/{progress.total} ตอน</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div className="h-2 rounded-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
                  </div>
                </>
              )}
            </div>
          )}

          {hasResult && !running && issues.length === 0 && (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-900/10">
              <AlertDescription className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                <span className="text-sm">ไม่พบจุดขัดแย้งระหว่างตอน เนื้อเรื่องสอดคล้องกันดี</span>
              </AlertDescription>
            </Alert>
          )}

          {hasResult && issues.length > 0 && (
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
                    <motion.div key={idx} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
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
                                {issue.chapter_title && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    ตอน: {issue.order ? issue.order + ". " : ""}{issue.chapter_title}
                                  </p>
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
                              <p className="text-sm text-muted-foreground whitespace-pre-line">{issue.detail}</p>
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

          {recordLoaded && !hasResult && !running && (
            <div className="text-center py-10">
              <ListTree className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                {written.length < 2 ? "ต้องมีตอนที่เขียนแล้วอย่างน้อย 2 ตอน" : 'กด "สแกนทั้งเรื่อง" เพื่อให้ AI ตรวจหาจุดขัดแย้ง'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmRescan} onOpenChange={setConfirmRescan}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ตรวจใหม่ทั้งหมด?</AlertDialogTitle>
            <AlertDialogDescription>
              การตรวจใหม่จะลบผลตรวจเดิมทั้งหมดและเริ่มตรวจตั้งแต่ตอนแรก ยืนยันหรือไม่
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmRescan(false); runScan(false); }}>
              ยืนยัน ตรวจใหม่
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}