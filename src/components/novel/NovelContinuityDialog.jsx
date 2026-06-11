import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Scan, Loader2, AlertCircle, AlertTriangle, Info, CheckCircle2,
  History, ChevronDown, ChevronRight, Users, Clock, MapPin, BookOpen,
  Calendar, FileSearch, Trash2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { th } from "date-fns/locale";

// ---- Prompt builder ----
function buildNovelContinuityPrompt(novel, characters, plotEvents, worldEntries, chapters) {
  let ctx = `คุณคือบรรณาธิการนิยายผู้เชี่ยวชาญ ตรวจสอบความต่อเนื่องและข้อขัดแย้งทั้งเรื่อง\n\n`;

  ctx += `=== ข้อมูลเรื่อง ===\n`;
  ctx += `ชื่อ: ${novel.title}\n`;
  if (novel.genre) ctx += `แนว: ${novel.genre}\n`;
  if (novel.era) ctx += `ยุคสมัย/ฉากหลัง: ${novel.era}\n`;
  if (novel.synopsis) ctx += `เรื่องย่อ: ${novel.synopsis}\n\n`;

  if (characters.length > 0) {
    ctx += `=== คลังตัวละคร (ข้อมูลอ้างอิงที่ถูกต้อง) ===\n`;
    characters.forEach((c) => {
      ctx += `• ${c.name} (${c.role || "ตัวประกอบ"})`;
      if (c.age) ctx += ` อายุ: ${c.age}`;
      if (c.occupation) ctx += ` อาชีพ: ${c.occupation}`;
      ctx += `\n`;
      if (c.appearance) ctx += `  ลักษณะ: ${c.appearance}\n`;
      if (c.personality) ctx += `  นิสัย: ${c.personality}\n`;
      if (c.background) ctx += `  ปูมหลัง: ${c.background}\n`;
      if (c.relationships) ctx += `  ความสัมพันธ์: ${c.relationships}\n`;
    });
    ctx += `\n`;
  }

  if (plotEvents.length > 0) {
    ctx += `=== ไทม์ไลน์เหตุการณ์ (ลำดับที่ถูกต้อง) ===\n`;
    plotEvents.forEach((e) => {
      ctx += `#${e.order} ${e.title}`;
      if (e.time_period) ctx += ` [${e.time_period}]`;
      if (e.is_historical) ctx += ` [เหตุการณ์จริงทางประวัติศาสตร์]`;
      if (e.characters_involved) ctx += ` ตัวละคร: ${e.characters_involved}`;
      ctx += `\n`;
      if (e.description) ctx += `  ${e.description}\n`;
    });
    ctx += `\n`;
  }

  if (worldEntries.length > 0) {
    ctx += `=== โลกและฉาก ===\n`;
    worldEntries.forEach((w) => {
      ctx += `• [${w.category || "อื่นๆ"}] ${w.title}`;
      if (w.description) ctx += `: ${w.description}`;
      ctx += `\n`;
    });
    ctx += `\n`;
  }

  ctx += `=== เนื้อหาทุกตอน ===\n`;
  chapters.forEach((ch) => {
    ctx += `\n--- ตอนที่ ${ch.order}: "${ch.title}" (${(ch.word_count || 0).toLocaleString()} คำ) ---\n`;
    // Send full content up to 3000 chars per chapter to avoid token overflow
    const content = ch.content || "";
    ctx += content.length > 3000 ? content.substring(0, 3000) + "\n…[ตัดต่อ]" : content;
    ctx += `\n`;
  });

  ctx += `\n=== คำสั่ง ===\n`;
  ctx += `ตรวจสอบความขัดแย้งและปัญหาต่อไปนี้ข้ามทุกตอน:\n`;
  ctx += `1. ตัวละคร — ชื่อ อายุ ลักษณะภายนอก บุคลิก บทบาท ที่ไม่สอดคล้องกันระหว่างตอน หรือขัดกับคลังตัวละคร\n`;
  ctx += `2. ไทม์ไลน์ — ลำดับเหตุการณ์ผิด เวลาย้อนหลัง เหตุการณ์ในตอนหลังขัดกับตอนก่อน\n`;
  ctx += `3. สถานที่ — ระยะทาง/เส้นทาง/ฉากที่ไม่สมเหตุสมผลหรือขัดกัน\n`;
  ctx += `4. ข้อเท็จจริงประวัติศาสตร์ — เหตุการณ์จริง/วันที่/บุคคลจริงที่คลาดเคลื่อนจากความเป็นจริง\n`;
  ctx += `5. พล็อตและข้อเท็จจริงในเรื่อง — สิ่งที่เกิดในตอนก่อนแต่ถูกเล่าใหม่ผิดในตอนหลัง\n`;
  ctx += `6. ภาษาและยุคสมัย — คำ/เทคโนโลยี/สิ่งของที่ไม่ตรงยุค\n\n`;
  ctx += `สำหรับปัญหาแต่ละข้อ ให้ระบุ:\n`;
  ctx += `- chapter_refs: อาร์เรย์ลำดับตอนที่เกี่ยวข้อง เช่น [1, 3]\n`;
  ctx += `- quoted_a: ข้อความจากตอนแรกที่ขัดแย้ง (ยกมาโดยตรง)\n`;
  ctx += `- quoted_b: ข้อความจากตอนที่ขัดแย้ง (ยกมาโดยตรง)\n`;
  ctx += `- type: character | timeline | location | history | plot | anachronism\n`;
  ctx += `- severity: critical | major | minor\n`;
  ctx += `- description: อธิบายปัญหาอย่างชัดเจน\n`;
  ctx += `- suggestion: แนวทางแก้ไขที่เป็นรูปธรรม\n`;

  return ctx;
}

// ---- Sub-components ----
const SEVERITY_CONFIG = {
  critical: { label: "รุนแรงมาก", icon: AlertCircle, color: "text-destructive", bg: "bg-destructive/8 border-destructive/25", badgeCls: "bg-destructive/10 text-destructive border-destructive/30" },
  major:    { label: "รุนแรง",     icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50/80 border-amber-200",    badgeCls: "bg-amber-50 text-amber-700 border-amber-200" },
  minor:    { label: "เล็กน้อย",   icon: Info,          color: "text-blue-500",  bg: "bg-blue-50/60 border-blue-100",       badgeCls: "bg-blue-50 text-blue-700 border-blue-100" },
};

const TYPE_CONFIG = {
  character:   { label: "ตัวละคร",          icon: Users },
  timeline:    { label: "ไทม์ไลน์",         icon: Clock },
  location:    { label: "สถานที่",           icon: MapPin },
  history:     { label: "ประวัติศาสตร์",     icon: BookOpen },
  plot:        { label: "พล็อต",            icon: FileSearch },
  anachronism: { label: "ยุคสมัย/ภาษา",    icon: Calendar },
};

function IssueCard({ issue, idx }) {
  const [open, setOpen] = useState(false);
  const sev = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.minor;
  const typ = TYPE_CONFIG[issue.type] || { label: issue.type, icon: Info };
  const SevIcon = sev.icon;
  const TypIcon = typ.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.04 }}
      className={`rounded-xl border ${sev.bg} overflow-hidden`}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-black/[0.02] transition-colors"
      >
        <SevIcon className={`w-4 h-4 mt-0.5 shrink-0 ${sev.color}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-1.5 mb-1">
            <Badge variant="outline" className={`text-[11px] px-2 py-0 flex items-center gap-1 ${sev.badgeCls}`}>
              <SevIcon className="w-2.5 h-2.5" />
              {sev.label}
            </Badge>
            <Badge variant="outline" className="text-[11px] px-2 py-0 flex items-center gap-1">
              <TypIcon className="w-2.5 h-2.5" />
              {typ.label}
            </Badge>
            {issue.chapter_refs && issue.chapter_refs.length > 0 && (
              <span className="text-[11px] text-muted-foreground">
                ตอน {issue.chapter_refs.join(", ")}
              </span>
            )}
          </div>
          <p className="text-sm font-medium leading-snug">{issue.description}</p>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2 border-t border-black/[0.06] pt-3">
              {issue.quoted_a && (
                <div className="rounded-lg bg-white/70 border border-black/[0.06] px-3 py-2">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">ข้อความที่ขัดแย้ง A</p>
                  <p className="text-sm italic text-foreground/80 leading-relaxed">"{issue.quoted_a}"</p>
                </div>
              )}
              {issue.quoted_b && (
                <div className="rounded-lg bg-white/70 border border-black/[0.06] px-3 py-2">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">ข้อความที่ขัดแย้ง B</p>
                  <p className="text-sm italic text-foreground/80 leading-relaxed">"{issue.quoted_b}"</p>
                </div>
              )}
              {issue.suggestion && (
                <div className="rounded-lg bg-primary/5 border border-primary/15 px-3 py-2">
                  <p className="text-[11px] font-semibold text-primary/70 uppercase tracking-wide mb-1">ข้อเสนอแก้ไข</p>
                  <p className="text-sm text-foreground/80 leading-relaxed">{issue.suggestion}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ReportView({ report }) {
  const issues = (() => {
    try { return JSON.parse(report.issues_json || "[]"); } catch { return []; }
  })();

  const grouped = {};
  issues.forEach((iss) => {
    const g = iss.type || "other";
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(iss);
  });

  const sortOrder = ["critical", "major", "minor"];
  const sortedIssues = [...issues].sort((a, b) =>
    sortOrder.indexOf(a.severity) - sortOrder.indexOf(b.severity)
  );

  return (
    <div className="space-y-4">
      {/* Summary banner */}
      {report.passed ? (
        <div className="flex items-start gap-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-emerald-800 text-sm">ผ่านการตรวจ — ไม่พบข้อขัดแย้ง</p>
            <p className="text-sm text-emerald-700 mt-0.5">{report.summary}</p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-amber-50/80 border border-amber-200 px-4 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="font-semibold text-amber-800 text-sm">พบ {report.total_issues} ปัญหา</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {report.critical_count > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 font-medium">
                รุนแรงมาก {report.critical_count}
              </span>
            )}
            {report.major_count > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 font-medium">
                รุนแรง {report.major_count}
              </span>
            )}
            {report.minor_count > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 font-medium">
                เล็กน้อย {report.minor_count}
              </span>
            )}
          </div>
          <p className="text-sm text-amber-700">{report.summary}</p>
        </div>
      )}

      {/* Issues list */}
      {sortedIssues.length > 0 && (
        <div className="space-y-2">
          {sortedIssues.map((issue, i) => (
            <IssueCard key={i} issue={issue} idx={i} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Main Dialog ----
export default function NovelContinuityDialog({ open, onClose, novel, novelId }) {
  const [checking, setChecking] = useState(false);
  const [activeTab, setActiveTab] = useState("check"); // "check" | "history"
  const [currentResult, setCurrentResult] = useState(null);
  const queryClient = useQueryClient();

  const { data: characters = [] } = useQuery({
    queryKey: ["characters", novelId],
    queryFn: async () => {
      const all = await base44.entities.Character.filter({ novel_id: novelId });
      return all.filter((c) => !c.is_deleted);
    },
    enabled: open,
  });
  const { data: plotEvents = [] } = useQuery({
    queryKey: ["plotEvents", novelId],
    queryFn: async () => {
      const all = await base44.entities.PlotEvent.filter({ novel_id: novelId }, "order");
      return all.filter((e) => !e.is_deleted);
    },
    enabled: open,
  });
  const { data: worldEntries = [] } = useQuery({
    queryKey: ["worldEntries", novelId],
    queryFn: async () => {
      const all = await base44.entities.WorldEntry.filter({ novel_id: novelId });
      return all.filter((w) => !w.is_deleted);
    },
    enabled: open,
  });
  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters", novelId],
    queryFn: async () => {
      const all = await base44.entities.Chapter.filter({ novel_id: novelId }, "order");
      return all.filter((c) => !c.is_deleted);
    },
    enabled: open,
  });
  const { data: reports = [], refetch: refetchReports } = useQuery({
    queryKey: ["continuityReports", novelId],
    queryFn: async () => {
      const all = await base44.entities.ContinuityReport.filter({ novel_id: novelId }, "-checked_at");
      return all.slice(0, 10); // keep last 10
    },
    enabled: open,
  });

  const chaptersWithContent = chapters.filter((c) => c.content && (c.word_count || 0) > 0);

  const handleCheck = async () => {
    if (chaptersWithContent.length === 0) return;
    setChecking(true);
    setCurrentResult(null);

    const prompt = buildNovelContinuityPrompt(novel, characters, plotEvents, worldEntries, chaptersWithContent);

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
                chapter_refs: { type: "array", items: { type: "number" } },
                quoted_a: { type: "string" },
                quoted_b: { type: "string" },
                description: { type: "string" },
                suggestion: { type: "string" },
              },
              required: ["type", "severity", "description"],
            },
          },
          summary: { type: "string" },
          passed: { type: "boolean" },
        },
        required: ["issues", "summary", "passed"],
      },
    });

    const issues = result?.issues || [];
    const critical_count = issues.filter((i) => i.severity === "critical").length;
    const major_count    = issues.filter((i) => i.severity === "major").length;
    const minor_count    = issues.filter((i) => i.severity === "minor").length;

    // Save report
    await base44.entities.ContinuityReport.create({
      novel_id: novelId,
      checked_at: new Date().toISOString(),
      chapters_checked: chaptersWithContent.length,
      total_issues: issues.length,
      critical_count,
      major_count,
      minor_count,
      passed: result?.passed ?? issues.length === 0,
      summary: result?.summary || "",
      issues_json: JSON.stringify(issues),
    });

    setCurrentResult({
      total_issues: issues.length,
      critical_count,
      major_count,
      minor_count,
      passed: result?.passed ?? issues.length === 0,
      summary: result?.summary || "",
      issues_json: JSON.stringify(issues),
      chapters_checked: chaptersWithContent.length,
    });

    queryClient.invalidateQueries({ queryKey: ["continuityReports", novelId] });
    refetchReports();
    setChecking(false);
  };

  const handleDeleteReport = async (id) => {
    await base44.entities.ContinuityReport.delete(id);
    queryClient.invalidateQueries({ queryKey: ["continuityReports", novelId] });
  };

  const displayReport = currentResult;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col gap-0 p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/60 shrink-0">
          <DialogTitle className="font-heading flex items-center gap-2">
            <Scan className="w-5 h-5 text-primary" />
            ตรวจความต่อเนื่องทั้งเรื่อง
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            AI อ่านทุกตอน + คลังตัวละคร + ไทม์ไลน์ แล้วจับข้อขัดแย้งข้ามตอน
            <br />
            <span className="text-amber-600 font-medium">ใช้ Claude Sonnet — ใช้ credits สูง · ตรวจได้ {chaptersWithContent.length} ตอนที่มีเนื้อหา</span>
          </p>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b border-border/60 shrink-0 px-6 gap-4">
          {[
            { id: "check", label: "ตรวจสอบ" },
            { id: "history", label: `ประวัติ (${reports.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <ScrollArea className="flex-1 px-6 py-5">
          {/* ---- Check Tab ---- */}
          {activeTab === "check" && (
            <div className="space-y-4">
              {!displayReport && !checking && (
                <div className="text-center py-16">
                  <Scan className="w-16 h-16 text-muted-foreground/25 mx-auto mb-4" />
                  <h3 className="font-heading font-semibold mb-2">พร้อมตรวจสอบ</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    AI จะอ่านเนื้อหา {chaptersWithContent.length} ตอน พร้อม{" "}
                    {characters.length} ตัวละคร และ {plotEvents.length} เหตุการณ์ในไทม์ไลน์
                  </p>
                  {chaptersWithContent.length === 0 && (
                    <p className="text-xs text-destructive mt-3">ยังไม่มีตอนที่มีเนื้อหา ต้องร่างตอนก่อนจึงจะตรวจได้</p>
                  )}
                </div>
              )}

              {checking && (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 className="w-12 h-12 animate-spin text-primary" />
                  <div className="text-center">
                    <p className="font-semibold mb-1">กำลังตรวจสอบทั้งเรื่อง...</p>
                    <p className="text-sm text-muted-foreground">
                      AI กำลังอ่าน {chaptersWithContent.length} ตอน อาจใช้เวลา 1–2 นาที
                    </p>
                  </div>
                </div>
              )}

              {displayReport && !checking && <ReportView report={displayReport} />}
            </div>
          )}

          {/* ---- History Tab ---- */}
          {activeTab === "history" && (
            <div className="space-y-3">
              {reports.length === 0 ? (
                <div className="text-center py-12">
                  <History className="w-12 h-12 text-muted-foreground/25 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">ยังไม่มีประวัติการตรวจ</p>
                </div>
              ) : (
                reports.map((rep) => (
                  <HistoryCard key={rep.id} report={rep} onDelete={handleDeleteReport} />
                ))
              )}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/60 shrink-0 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={checking}>
            ปิด
          </Button>
          {activeTab === "check" && (
            <Button
              onClick={handleCheck}
              disabled={checking || chaptersWithContent.length === 0}
              className="gap-2"
            >
              {checking ? (
                <><Loader2 className="w-4 h-4 animate-spin" />กำลังตรวจ...</>
              ) : (
                <><Scan className="w-4 h-4" />ตรวจทั้งเรื่อง</>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---- History Card ----
function HistoryCard({ report, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const issues = (() => {
    try { return JSON.parse(report.issues_json || "[]"); } catch { return []; }
  })();
  const sortOrder = ["critical", "major", "minor"];
  const sortedIssues = [...issues].sort((a, b) =>
    sortOrder.indexOf(a.severity) - sortOrder.indexOf(b.severity)
  );
  const dateStr = report.checked_at
    ? format(new Date(report.checked_at), "d MMM yyyy HH:mm", { locale: th })
    : "—";

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="mt-0.5 shrink-0">
          {report.passed
            ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            : report.critical_count > 0
              ? <AlertCircle className="w-4 h-4 text-destructive" />
              : <AlertTriangle className="w-4 h-4 text-amber-500" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-sm font-medium">{dateStr}</span>
            <span className="text-xs text-muted-foreground">· {report.chapters_checked} ตอน</span>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {report.passed ? (
              <span className="text-xs px-2 py-0 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">ผ่าน</span>
            ) : (
              <>
                {report.critical_count > 0 && <span className="text-xs px-2 py-0 rounded-full bg-destructive/10 text-destructive border border-destructive/20">รุนแรงมาก {report.critical_count}</span>}
                {report.major_count > 0 && <span className="text-xs px-2 py-0 rounded-full bg-amber-50 text-amber-700 border border-amber-200">รุนแรง {report.major_count}</span>}
                {report.minor_count > 0 && <span className="text-xs px-2 py-0 rounded-full bg-blue-50 text-blue-700 border border-blue-100">เล็กน้อย {report.minor_count}</span>}
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            onClick={(e) => { e.stopPropagation(); onDelete(report.id); }}
            title="ลบรายงาน"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border/40"
          >
            <div className="px-4 py-4 space-y-2">
              {report.summary && (
                <p className="text-sm text-muted-foreground mb-3">{report.summary}</p>
              )}
              {sortedIssues.map((issue, i) => (
                <IssueCard key={i} issue={issue} idx={i} />
              ))}
              {sortedIssues.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">ไม่มีปัญหาที่บันทึกไว้</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}