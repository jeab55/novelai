import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, AlertTriangle, AlertCircle, Loader2, Scan, FileText, Users, Clock, Info } from "lucide-react";
import { motion } from "framer-motion";

export default function ContinuityChecker({ novelId, chapter, onClose }) {
  const [checking, setChecking] = useState(false);
  const [results, setResults] = useState(null);

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

  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters", novelId],
    queryFn: () => base44.entities.Chapter.filter({ novel_id: novelId }, "order"),
    enabled: open,
  });

  const checkContinuity = async () => {
    setChecking(true);
    setResults(null);

    try {
      // Prepare context for AI
      const characterContext = characters.map(c => 
        `${c.name} (${c.role}): ${c.appearance}, ${c.personality}, ${c.background}, ${c.desire}, ${c.relationships}`
      ).join("\n");

      const timelineContext = events.map(e => 
        `#${e.order} ${e.title} (${e.time_period}): ${e.description} - ตัวละคร: ${e.characters_involved}`
      ).join("\n");

      const previousChaptersContext = chapters
        .filter(c => c.order < chapter.order && c.content)
        .map(c => `ตอน#${c.order} ${c.title}:\n${c.content.substring(0, 500)}...`)
        .join("\n\n");

      const prompt = `คุณคือบรรณาธิการนิยายผู้เชี่ยวชาญ ตรวจสอบความต่อเนื่องของเนื้อเรื่อง

ข้อมูลบริบท:
=== ตัวละคร ===
${characterContext}

=== ไทม์ไลน์เหตุการณ์ ===
${timelineContext}

=== ตอนก่อนหน้า ===
${previousChaptersContext}

=== ตอนที่จะตรวจสอบ (ตอนที่ ${chapter.order}: ${chapter.title}) ===
${chapter.content}

=== คำแนะนำการตรวจสอบ ===
ให้ตรวจสอบประเด็นต่อไปนี้:
1. ความขัดแย้งเกี่ยวกับตัวละคร (ชื่อ, อายุ, ลักษณะภายนอก, นิสัย, บทบาท)
2. ความขัดแย้งเกี่ยวกับเวลาและสถานที่ (ไทม์ไลน์ไม่ตรง, เหตุการณ์เกิดก่อน-หลังผิดลำดับ)
3. ความขัดแย้งเกี่ยวกับความสัมพันธ์ระหว่างตัวละคร
4. ความขัดแย้งเกี่ยวกับความสามารถหรือความรู้ของตัวละคร
5. ความขัดแย้งเกี่ยวกับเหตุการณ์ที่เกิดขึ้นแล้วในตอนก่อนหน้า
6. การใช้อายุหรือคำศัพท์ที่ไม่ตรงกับยุคสมัย (นิยายอิงประวัติศาสตร์)

สำหรับแต่ละจุดที่พบ ให้ระบุ:
- ประเภท: [character|timeline|relationship|ability|plot|anachronism]
- ระดับความรุนแรง: [critical|major|minor]
- ตำแหน่งในเนื้อหา (ประมาณ)
- คำอธิบายปัญหา
- คำแนะนำการแก้ไข

ส่งผลลัพธ์เป็น JSON format ตามโครงสร้างนี้:
{
  "issues": [
    {
      "type": "character",
      "severity": "major",
      "location": "กลางตอน",
      "description": "อธิบายปัญหา",
      "suggestion": "คำแนะนำ"
    }
  ],
  "summary": "สรุปภาพรวม",
  "passed": true/false
}`;

      const result = await base44.integrations.Core.InvokeLLM({ 
        prompt, 
        model: "claude_sonnet_4_6",
        response_json_schema: {
          type: "object",
          properties: {
            issues: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  severity: { type: "string" },
                  location: { type: "string" },
                  description: { type: "string" },
                  suggestion: { type: "string" }
                },
                required: ["type", "severity", "description"]
              }
            },
            summary: { type: "string" },
            passed: { type: "boolean" }
          },
          required: ["issues", "summary", "passed"]
        }
      });

      setResults(result);
    } catch (error) {
      console.error("Continuity check failed:", error);
      setResults({
        error: true,
        message: "ไม่สามารถตรวจสอบได้: " + error.message
      });
    } finally {
      setChecking(false);
    }
  };

  const getSeverityIcon = (severity) => {
    if (severity === "critical") return <AlertCircle className="w-4 h-4 text-destructive" />;
    if (severity === "major") return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    return <Info className="w-4 h-4 text-blue-500" />;
  };

  const getSeverityColor = (severity) => {
    if (severity === "critical") return "bg-destructive/10 text-destructive border-destructive/20";
    if (severity === "major") return "bg-amber-50 text-amber-700 border-amber-200";
    return "bg-blue-50 text-blue-700 border-blue-200";
  };

  const getTypeLabel = (type) => {
    const labels = {
      character: "ตัวละคร",
      timeline: "ไทม์ไลน์",
      relationship: "ความสัมพันธ์",
      ability: "ความสามารถ",
      plot: "พล็อต",
      anachronism: "ยุคสมัย"
    };
    return labels[type] || type;
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-background rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl"
      >
        <div className="px-6 pt-5 pb-4 border-b border-border/60 shrink-0 flex items-center justify-between">
          <div>
            <h2 className="font-heading font-semibold text-lg flex items-center gap-2">
              <Scan className="w-5 h-5 text-primary" />
              ตรวจเช็กความต่อเนื่องของเนื้อเรื่อง
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              AI จะสแกนเนื้อหาและตรวจสอบความขัดแย้งกับข้อมูลตัวละคร ไทม์ไลน์ และตอนก่อนหน้า
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
            <span className="sr-only">ปิด</span>
            ✕
          </Button>
        </div>

        {/* Action Bar */}
        <div className="px-6 py-3 border-b border-border/40 bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="w-4 h-4" />
            <span>ตอนที่ {chapter.order}: {chapter.title}</span>
          </div>
          <Button 
            onClick={checkContinuity} 
            disabled={checking || !chapter.content}
            size="sm"
            className="gap-2"
          >
            {checking ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                กำลังตรวจสอบ...
              </>
            ) : (
              <>
                <Scan className="w-4 h-4" />
                เริ่มตรวจสอบ
              </>
            )}
          </Button>
        </div>

        <ScrollArea className="flex-1 px-6 py-5">
          {!results && !checking && (
            <div className="text-center py-16">
              <Scan className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="font-heading font-semibold mb-2">ยังไม่ได้ตรวจสอบ</h3>
              <p className="text-muted-foreground text-sm mb-4">
                กดปุ่ม "เริ่มตรวจสอบ" เพื่อให้ AI สแกนหาความขัดแย้งในเนื้อหา
              </p>
              <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground mt-6">
                <div className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  <span>ข้อมูลตัวละคร</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>ไทม์ไลน์</span>
                </div>
                <div className="flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" />
                  <span>ตอนก่อนหน้า</span>
                </div>
              </div>
            </div>
          )}

          {checking && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-medium mb-1">กำลังตรวจสอบความต่อเนื่อง...</p>
                <p className="text-sm text-muted-foreground">
                  AI กำลังสแกนเนื้อหาและเปรียบเทียบกับข้อมูลตัวละคร ไทม์ไลน์ และตอนก่อนหน้า
                </p>
              </div>
            </div>
          )}

          {results && results.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>เกิดข้อผิดพลาด</AlertTitle>
              <AlertDescription>{results.message}</AlertDescription>
            </Alert>
          )}

          {results && !results.error && (
            <div className="space-y-4">
              {/* Summary */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {results.passed ? (
                  <Alert className="bg-green-50 text-green-800 border-green-200">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <AlertTitle>ผ่านเกณฑ์! ไม่พบความขัดแย้ง</AlertTitle>
                    <AlertDescription className="text-green-700 mt-1">
                      {results.summary}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="bg-amber-50 text-amber-800 border-amber-200">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    <AlertTitle>พบ {results.issues.length} จุดที่อาจมีปัญหา</AlertTitle>
                    <AlertDescription className="text-amber-700 mt-1">
                      {results.summary}
                    </AlertDescription>
                  </Alert>
                )}
              </motion.div>

              {/* Issues */}
              {results.issues && results.issues.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-heading font-semibold text-sm">ปัญหาที่พบ:</h4>
                  {results.issues.map((issue, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`p-4 rounded-xl border ${getSeverityColor(issue.severity)}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 mt-0.5">
                          {getSeverityIcon(issue.severity)}
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {getTypeLabel(issue.type)}
                            </Badge>
                            <span className="text-xs font-medium">
                              {issue.severity === "critical" ? "รุนแรงมาก" : 
                               issue.severity === "major" ? "รุนแรง" : "เล็กน้อย"}
                            </span>
                            {issue.location && (
                              <span className="text-xs text-muted-foreground">
                                · {issue.location}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium">{issue.description}</p>
                          {issue.suggestion && (
                            <div className="bg-white/60 rounded-lg p-2.5 mt-2">
                              <p className="text-xs font-medium text-muted-foreground mb-0.5">
                                คำแนะนำ:
                              </p>
                              <p className="text-sm">{issue.suggestion}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </motion.div>
    </div>
  );
}