import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  ChevronDown, ChevronUp, Loader2, ShieldCheck, AlertTriangle,
  AlertCircle, Info, Clock, History
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { th } from "date-fns/locale";

// -------- helpers --------
function stripFence(raw) {
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
}

const CATEGORY_LABELS = {
  "continuity": "ความต่อเนื่อง",
  "anachronism": "ความถูกต้องยุคสมัย",
  "character": "ตัวละคร / จังหวะ",
  "language": "สำนวน / ภาษา",
};

const SEVERITY_CONFIG = {
  "สูง": { color: "bg-red-50 border-red-200 text-red-800", badge: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500", label: "ต้องแก้" },
  "กลาง": { color: "bg-orange-50 border-orange-200 text-orange-800", badge: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-400", label: "ควรปรับ" },
  "ต่ำ": { color: "bg-muted/40 border-border/60 text-foreground/70", badge: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground/40", label: "เล็กน้อย" },
};

const CATEGORIES = ["continuity", "anachronism", "character", "language"];

function buildPrompt(novel, chapter, characters, plotEvents, prevChapter) {
  let p = `คุณคือ **บรรณาธิการนิยายไทยผู้เชี่ยวชาญ** (เชี่ยวชาญทั้งนิยายร่วมสมัยและนิยายอิงประวัติศาสตร์)\n\n`;
  p += `## บริบทเรื่อง\n`;
  p += `ชื่อเรื่อง: ${novel.title}\n`;
  if (novel.genre) p += `แนว: ${novel.genre}\n`;
  if (novel.era) p += `ยุคสมัย/ฉาก: ${novel.era}\n`;
  if (novel.synopsis) p += `เรื่องย่อ: ${novel.synopsis}\n`;

  if (characters.length > 0) {
    p += `\n## ตัวละคร\n`;
    characters.forEach((c) => {
      p += `- **${c.name}** (${c.role || "ตัวประกอบ"})`;
      if (c.age) p += ` อายุ: ${c.age}`;
      if (c.personality) p += ` — บุคลิก: ${c.personality}`;
      if (c.background) p += ` | ปูมหลัง: ${c.background}`;
      p += `\n`;
    });
  }

  if (plotEvents.length > 0) {
    p += `\n## เหตุการณ์ไทม์ไลน์\n`;
    plotEvents.slice(0, 20).forEach((ev) => {
      p += `- ลำดับ ${ev.order}: **${ev.title}**`;
      if (ev.time_period) p += ` [${ev.time_period}]`;
      if (ev.description) p += ` — ${ev.description}`;
      p += `\n`;
    });
  }

  if (prevChapter) {
    p += `\n## ตอนก่อนหน้า (สรุปหรือเนื้อหา)\n`;
    const prevText = prevChapter.content || "";
    p += prevText.length > 800 ? prevText.slice(0, 800) + "..." : prevText;
    p += `\n`;
  }

  p += `\n## ตอนที่ต้องการตรวจ: "${chapter.title}"\n\n`;
  p += chapter.content || "(ไม่มีเนื้อหา)";

  p += `\n\n---\n## คำสั่ง\n`;
  p += `ตรวจตอนนี้ใน **4 หมวด** ต่อไปนี้:\n`;
  p += `1. **continuity** — ความต่อเนื่องของเรื่อง เทียบกับตอนก่อน ไทม์ไลน์ และตัวละคร\n`;
  p += `2. **anachronism** — ความถูกต้องยุคสมัย คำ/สิ่งของ/เทคโนโลยีผิดยุค การใช้ราชาศัพท์/คำขุนนาง\n`;
  p += `3. **character** — บุคลิกตัวละครสม่ำเสมอ จังหวะและโครงสร้างตอน\n`;
  p += `4. **language** — สำนวนและภาษา ข้อผิดพลาด รอยผิด\n\n`;
  p += `ตอบ **เฉพาะ JSON** รูปแบบ:\n`;
  p += `{\n  "overall_summary": "สรุปภาพรวม 2-3 ประโยค",\n`;
  p += `  "issues": [\n    {\n      "category": "continuity|anachronism|character|language",\n`;
  p += `      "severity": "สูง|กลาง|ต่ำ",\n      "excerpt": "ข้อความที่ยกมาจากตอน (สั้นๆ)",\n`;
  p += `      "suggestion": "ข้อเสนอแนะการแก้ไข"\n    }\n  ]\n}\n`;
  p += `ถ้าไม่พบปัญหาในหมวดใด ไม่ต้องใส่ issue ของหมวดนั้น issues อาจเป็น [] ถ้าสมบูรณ์มาก\n`;
  p += `ห้ามใส่ข้อความอื่นนอก JSON`;

  return p;
}

function IssueCard({ issue }) {
  const cfg = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG["ต่ำ"];
  return (
    <div className={`rounded-lg border px-3 py-2.5 text-xs ${cfg.color}`}>
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className={`px-1.5 py-0.5 rounded-full border text-[10px] font-semibold ${cfg.badge}`}>
              {issue.severity} — {cfg.label}
            </span>
          </div>
          {issue.excerpt && (
            <p className="italic text-[11px] opacity-75 mb-1 leading-relaxed">
              "{issue.excerpt}"
            </p>
          )}
          <p className="leading-relaxed">{issue.suggestion}</p>
        </div>
      </div>
    </div>
  );
}

function ReviewReport({ review }) {
  let issues = [];
  try { issues = JSON.parse(review.issues || "[]"); } catch {}

  const byCategory = {};
  CATEGORIES.forEach((c) => { byCategory[c] = issues.filter((i) => i.category === c); });
  const hasAny = issues.length > 0;

  return (
    <div className="space-y-3">
      {review.overall_summary && (
        <div className="bg-primary/5 border border-primary/15 rounded-lg px-3 py-2.5 text-xs text-foreground/80 leading-relaxed">
          <span className="font-semibold text-primary/80 block mb-0.5">ภาพรวม</span>
          {review.overall_summary}
        </div>
      )}
      {!hasAny && (
        <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
          ไม่พบปัญหาสำคัญ — ตอนนี้ผ่านการตรวจแล้ว!
        </div>
      )}
      {CATEGORIES.map((cat) => {
        const list = byCategory[cat];
        if (!list || list.length === 0) return null;
        const highCount = list.filter((i) => i.severity === "สูง").length;
        return (
          <div key={cat}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-[11px] font-semibold text-foreground/70 uppercase tracking-wide">
                {CATEGORY_LABELS[cat] || cat}
              </span>
              <span className="text-[10px] text-muted-foreground bg-muted/60 rounded-full px-1.5 py-0.5">
                {list.length} รายการ
              </span>
              {highCount > 0 && (
                <span className="text-[10px] text-red-600 bg-red-50 border border-red-200 rounded-full px-1.5 py-0.5">
                  ต้องแก้ {highCount}
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              {list.map((issue, i) => <IssueCard key={i} issue={issue} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AiEditorReviewPanel({ chapter, novel, novelId }) {
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const queryClient = useQueryClient();

  const { data: characters = [] } = useQuery({
    queryKey: ["characters", novelId],
    queryFn: () => base44.entities.Character.filter({ novel_id: novelId }),
    enabled: open,
  });

  const { data: plotEvents = [] } = useQuery({
    queryKey: ["plotEvents", novelId],
    queryFn: () => base44.entities.PlotEvent.filter({ novel_id: novelId }, "order"),
    enabled: open,
  });

  const { data: allChapters = [] } = useQuery({
    queryKey: ["chapters", novelId],
    queryFn: () => base44.entities.Chapter.filter({ novel_id: novelId }, "order"),
    enabled: open,
  });

  const { data: reviewHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: ["editorReviews", chapter.id],
    queryFn: () => base44.entities.EditorReview.filter({ chapter_id: chapter.id }, "-created_date"),
    enabled: open,
  });

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.EditorReview.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["editorReviews", chapter.id] });
    },
  });

  const activeReview = selectedHistoryId
    ? reviewHistory.find((r) => r.id === selectedHistoryId)
    : reviewHistory[0];

  const handleCheck = async () => {
    if (!chapter.content?.trim()) {
      toast.error("ยังไม่มีเนื้อหาให้ตรวจ");
      return;
    }
    setChecking(true);
    setShowHistory(false);
    setSelectedHistoryId(null);

    // หาตอนก่อนหน้า
    const sorted = [...allChapters].sort((a, b) => (a.order || 0) - (b.order || 0));
    const idx = sorted.findIndex((c) => c.id === chapter.id);
    const prevChapter = idx > 0 ? sorted[idx - 1] : null;

    const prompt = buildPrompt(novel || {}, chapter, characters, plotEvents, prevChapter);

    const raw = await base44.integrations.Core.InvokeLLM({ prompt, model: "claude_sonnet_4_6" });
    const rawStr = typeof raw === "string" ? raw : (raw?.text || JSON.stringify(raw));
    const stripped = stripFence(rawStr);

    let parsed;
    try {
      parsed = JSON.parse(stripped);
    } catch (err) {
      setChecking(false);
      toast.error(`แปลงผลลัพธ์ไม่สำเร็จ: ${err.message} — ลองใหม่อีกครั้ง`);
      return;
    }

    await saveMutation.mutateAsync({
      novel_id: novelId,
      chapter_id: chapter.id,
      chapter_title: chapter.title,
      overall_summary: parsed.overall_summary || "",
      issues: JSON.stringify(parsed.issues || []),
    });

    setChecking(false);
    toast.success("บรรณาธิการ AI ตรวจเสร็จแล้ว");
  };

  const formatDate = (d) => {
    try { return format(new Date(d), "d MMM yy HH:mm", { locale: th }); } catch { return ""; }
  };

  return (
    <div className="border-b border-border/50 bg-card/20">
      {/* Header toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2 text-xs hover:bg-muted/30 transition-colors"
      >
        <ShieldCheck className="w-3.5 h-3.5 text-rose-500/70" />
        <span className="font-medium text-foreground/70">ตรวจโดยบรรณาธิการ AI</span>
        {reviewHistory.length > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 text-[10px] font-medium">
            {reviewHistory.length} ครั้ง
          </span>
        )}
        <span className="ml-auto">{open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Action row */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5 bg-rose-600 hover:bg-rose-700 text-white"
              onClick={handleCheck}
              disabled={checking}
            >
              {checking ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" />บรรณาธิการกำลังตรวจ...</>
              ) : (
                <><ShieldCheck className="w-3.5 h-3.5" />ให้บรรณาธิการ AI ตรวจตอนนี้</>
              )}
            </Button>

            {reviewHistory.length > 0 && (
              <button
                onClick={() => setShowHistory((v) => !v)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <History className="w-3.5 h-3.5" />
                ประวัติการตรวจ ({reviewHistory.length})
              </button>
            )}
          </div>

          {checking && (
            <div className="flex items-center gap-2 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              บรรณาธิการ AI กำลังอ่านและตรวจทั้ง 4 หมวด... อาจใช้เวลา 30–60 วินาที
            </div>
          )}

          {/* History dropdown */}
          {showHistory && reviewHistory.length > 0 && (
            <div className="border border-border/50 rounded-lg divide-y divide-border/30 overflow-hidden">
              {reviewHistory.map((r) => (
                <button
                  key={r.id}
                  onClick={() => { setSelectedHistoryId(r.id === selectedHistoryId ? null : r.id); setShowHistory(false); }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-muted/30 transition-colors ${selectedHistoryId === r.id ? "bg-primary/5" : ""}`}
                >
                  <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">{formatDate(r.created_date)}</span>
                  {(() => {
                    let issues = [];
                    try { issues = JSON.parse(r.issues || "[]"); } catch {}
                    const high = issues.filter((i) => i.severity === "สูง").length;
                    return high > 0 ? (
                      <span className="ml-auto text-[10px] text-red-600 bg-red-50 border border-red-200 rounded-full px-1.5 py-0.5">
                        ต้องแก้ {high}
                      </span>
                    ) : (
                      <span className="ml-auto text-[10px] text-green-600 bg-green-50 border border-green-200 rounded-full px-1.5 py-0.5">
                        ผ่าน
                      </span>
                    );
                  })()}
                </button>
              ))}
            </div>
          )}

          {/* Report */}
          {!checking && activeReview && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] text-muted-foreground">
                  ผลตรวจ: {formatDate(activeReview.created_date)}
                </span>
                {selectedHistoryId && (
                  <button
                    onClick={() => setSelectedHistoryId(null)}
                    className="text-[11px] text-primary/70 hover:text-primary underline"
                  >
                    ดูล่าสุด
                  </button>
                )}
              </div>
              <ReviewReport review={activeReview} />
            </div>
          )}

          {!checking && !activeReview && reviewHistory.length === 0 && (
            <p className="text-xs text-muted-foreground/60 italic">
              กดปุ่มด้านบนเพื่อให้บรรณาธิการ AI ตรวจตอนนี้เป็นครั้งแรก
            </p>
          )}
        </div>
      )}
    </div>
  );
}