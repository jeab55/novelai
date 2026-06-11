import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ShieldCheck, Loader2, ChevronDown, ChevronUp, Clock, History, Wand2, Save, X } from "lucide-react";
import CopyButton from "@/components/ui/CopyButton";
import { toast } from "sonner";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { saveVersion } from "@/lib/saveVersion";

// -------- helpers --------
function stripFence(raw) {
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
}

function countWordsSimple(text) {
  if (!text) return 0;
  const cleaned = text.replace(/<[^>]*>/g, " ");
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const seg = new Intl.Segmenter("th", { granularity: "word" });
    let n = 0;
    for (const s of seg.segment(cleaned)) { if (s.isWordLike) n++; }
    return n;
  }
  const th = (cleaned.match(/[\u0E00-\u0E7F]/g) || []).length;
  const en = (cleaned.match(/[a-zA-Z]+/g) || []).length;
  return Math.round(th / 3.5) + en;
}

const CATEGORY_LABELS = {
  continuity: "ความต่อเนื่อง",
  anachronism: "ความถูกต้องยุคสมัย",
  character: "ตัวละคร / จังหวะ",
  language: "สำนวน / ภาษา",
};

const SEV = {
  สูง:  { color: "bg-red-50 border-red-200 text-red-800",    badge: "bg-red-100 text-red-700 border-red-200",       dot: "bg-red-500",              label: "ต้องแก้"  },
  กลาง: { color: "bg-orange-50 border-orange-200 text-orange-800", badge: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-400", label: "ควรปรับ"  },
  ต่ำ:  { color: "bg-muted/40 border-border/60 text-foreground/70", badge: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground/40", label: "เล็กน้อย" },
};

const CATEGORIES = ["continuity", "anachronism", "character", "language"];

// ---- prompt builders ----
function buildCheckPrompt(novel, chapter, characters, plotEvents, prevChapter) {
  let p = `คุณคือ **บรรณาธิการนิยายไทยผู้เชี่ยวชาญ** (เชี่ยวชาญทั้งนิยายร่วมสมัยและนิยายอิงประวัติศาสตร์)\n\n`;
  p += `## บริบทเรื่อง\nชื่อเรื่อง: ${novel.title || ""}\n`;
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
      p += "\n";
    });
  }
  if (plotEvents.length > 0) {
    p += `\n## เหตุการณ์ไทม์ไลน์\n`;
    plotEvents.slice(0, 20).forEach((ev) => {
      p += `- ลำดับ ${ev.order}: **${ev.title}**`;
      if (ev.time_period) p += ` [${ev.time_period}]`;
      if (ev.description) p += ` — ${ev.description}`;
      p += "\n";
    });
  }
  if (prevChapter) {
    p += `\n## ตอนก่อนหน้า\n`;
    const t = prevChapter.content || "";
    p += t.length > 800 ? t.slice(0, 800) + "..." : t;
    p += "\n";
  }
  p += `\n## ตอนที่ตรวจ: "${chapter.title}"\n\n${chapter.content || "(ไม่มีเนื้อหา)"}\n\n`;
  p += `---\n## คำสั่ง\nตรวจ 4 หมวด:\n`;
  p += `1. **continuity** — ความต่อเนื่อง\n2. **anachronism** — ความถูกต้องยุคสมัย\n`;
  p += `3. **character** — บุคลิก/จังหวะ\n4. **language** — สำนวน/ภาษา\n\n`;
  p += `ตอบ **เฉพาะ JSON**:\n{"overall_summary":"...","issues":[{"category":"continuity|anachronism|character|language","severity":"สูง|กลาง|ต่ำ","excerpt":"...","suggestion":"..."}]}\n`;
  p += `ห้ามใส่ข้อความอื่นนอก JSON`;
  return p;
}

function buildFixPrompt(chapter, selectedIssues) {
  let p = `คุณคือ **บรรณาธิการนิยายไทยผู้เชี่ยวชาญ**\n\n`;
  p += `## เนื้อหาตอนปัจจุบัน: "${chapter.title}"\n\n${chapter.content}\n\n`;
  p += `---\n## รายการที่ต้องแก้ไข (เฉพาะจุดเหล่านี้เท่านั้น)\n`;
  selectedIssues.forEach((issue, i) => {
    p += `\n**${i + 1}. [${CATEGORY_LABELS[issue.category] || issue.category}] ระดับ: ${issue.severity}**\n`;
    if (issue.excerpt) p += `   ข้อความที่มีปัญหา: "${issue.excerpt}"\n`;
    p += `   ข้อเสนอ: ${issue.suggestion}\n`;
  });
  p += `\n---\n## คำสั่ง\n`;
  p += `- แก้ไขเฉพาะจุดที่ระบุด้านบนเท่านั้น\n`;
  p += `- คงโครงเรื่อง ตัวละคร สำนวน และน้ำเสียงของผู้เขียนไว้ทุกส่วนที่ไม่เกี่ยวกับจุดที่แก้\n`;
  p += `- ตอบ **เฉพาะเนื้อหาตอนฉบับปรับปรุงเต็ม** ไม่ต้องมีคำอธิบาย ไม่ต้องมี code fence`;
  return p;
}

// ---- sub-components ----
function IssueCard({ issue, issueKey, checked, onToggle }) {
  const cfg = SEV[issue.severity] || SEV["ต่ำ"];
  return (
    <div
      className={`rounded-lg border px-3 py-2.5 text-xs cursor-pointer transition-all ${cfg.color} ${checked ? "ring-1 ring-primary/40" : ""}`}
      onClick={() => onToggle(issueKey)}
    >
      <div className="flex items-start gap-2">
        <Checkbox
          checked={checked}
          onCheckedChange={() => onToggle(issueKey)}
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5 shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className={`px-1.5 py-0.5 rounded-full border text-[10px] font-semibold ${cfg.badge}`}>
              {issue.severity} — {cfg.label}
            </span>
          </div>
          {issue.excerpt && (
            <p className="italic text-[11px] opacity-75 mb-1 leading-relaxed">"{issue.excerpt}"</p>
          )}
          <p className="leading-relaxed">{issue.suggestion}</p>
        </div>
      </div>
    </div>
  );
}

function ReviewReport({ review, checkedKeys, onToggle }) {
  let issues = [];
  try { issues = JSON.parse(review.issues || "[]"); } catch {}

  const byCategory = {};
  CATEGORIES.forEach((c) => { byCategory[c] = []; });
  issues.forEach((issue, idx) => {
    const cat = issue.category in byCategory ? issue.category : "language";
    byCategory[cat].push({ ...issue, _key: idx });
  });

  const hasAny = issues.length > 0;

  return (
    <div className="space-y-3">
      {review.overall_summary && (
        <div className="bg-primary/5 border border-primary/15 rounded-lg px-3 py-2.5 text-xs text-foreground/80 leading-relaxed">
          <div className="flex items-center justify-between mb-0.5">
            <span className="font-semibold text-primary/80">ภาพรวม</span>
            <CopyButton size="xs" text={review.overall_summary} />
          </div>
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
        const checkedCount = list.filter((i) => checkedKeys.has(i._key)).length;
        return (
          <div key={cat}>
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
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
              {checkedCount > 0 && (
                <span className="text-[10px] text-primary bg-primary/10 border border-primary/20 rounded-full px-1.5 py-0.5">
                  เลือก {checkedCount}
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              {list.map((issue) => (
                <IssueCard
                  key={issue._key}
                  issue={issue}
                  issueKey={issue._key}
                  checked={checkedKeys.has(issue._key)}
                  onToggle={onToggle}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DiffDialog({ open, original, revised, onSave, onCancel, saving }) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-4xl w-full max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-rose-500" />
            ตรวจสอบร่างที่ปรับแล้ว
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden grid grid-cols-2 gap-3 min-h-0">
          {/* Original */}
          <div className="flex flex-col min-h-0">
            <div className="text-[11px] font-semibold text-muted-foreground mb-1.5 px-1">ต้นฉบับเดิม</div>
            <div className="flex-1 overflow-auto rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-xs leading-relaxed whitespace-pre-wrap text-foreground/70 font-body">
              {original}
            </div>
          </div>
          {/* Revised */}
          <div className="flex flex-col min-h-0">
            <div className="text-[11px] font-semibold text-rose-600 mb-1.5 px-1">ฉบับปรับตามบรรณาธิการ</div>
            <div className="flex-1 overflow-auto rounded-lg border border-rose-200 bg-rose-50/30 px-3 py-2.5 text-xs leading-relaxed whitespace-pre-wrap text-foreground font-body">
              {revised}
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2 pt-2">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={onCancel} disabled={saving}>
            <X className="w-3.5 h-3.5" /> ยกเลิก
          </Button>
          <Button size="sm" className="gap-1.5 bg-rose-600 hover:bg-rose-700 text-white" onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? "กำลังบันทึก..." : "บันทึกทับ (เวอร์ชันเดิมจะถูกสำรอง)"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- main component ----
export default function AiEditorReviewPanel({ chapter, novel, novelId, onContentUpdate }) {
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [checkedKeys, setCheckedKeys] = useState(new Set());
  const [revisedContent, setRevisedContent] = useState(null);
  const [diffOpen, setDiffOpen] = useState(false);
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
  const { data: reviewHistory = [] } = useQuery({
    queryKey: ["editorReviews", chapter.id],
    queryFn: () => base44.entities.EditorReview.filter({ chapter_id: chapter.id }, "-created_date"),
    enabled: open,
  });

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.EditorReview.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["editorReviews", chapter.id] }),
  });

  const activeReview = selectedHistoryId
    ? reviewHistory.find((r) => r.id === selectedHistoryId)
    : reviewHistory[0];

  // parse issues จาก activeReview
  const activeIssues = useMemo(() => {
    if (!activeReview) return [];
    try { return JSON.parse(activeReview.issues || "[]"); } catch { return []; }
  }, [activeReview]);

  // เมื่อเปลี่ยน review ที่แสดง ให้ default ติ๊กข้อ severity สูงอัตโนมัติ
  const handleReviewSelect = (reviewId) => {
    setSelectedHistoryId(reviewId);
    setShowHistory(false);
    // อ่าน issues ของ review นั้น แล้วติ๊กข้อ สูง
    const r = reviewHistory.find((x) => x.id === reviewId) || reviewHistory[0];
    if (r) {
      try {
        const iss = JSON.parse(r.issues || "[]");
        setCheckedKeys(new Set(iss.map((_, i) => i).filter((i) => iss[i].severity === "สูง")));
      } catch { setCheckedKeys(new Set()); }
    }
  };

  // เมื่อ check ใหม่หลังตรวจ ให้ default ติ๊กข้อสูงอัตโนมัติ
  const applyDefaultChecks = (issues) => {
    setCheckedKeys(new Set(issues.map((_, i) => i).filter((i) => issues[i].severity === "สูง")));
  };

  const toggleKey = (key) => {
    setCheckedKeys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // ---- ตรวจ ----
  const handleCheck = async () => {
    if (!chapter.content?.trim()) { toast.error("ยังไม่มีเนื้อหาให้ตรวจ"); return; }
    setChecking(true);
    setShowHistory(false);
    setSelectedHistoryId(null);
    setCheckedKeys(new Set());

    const sorted = [...allChapters].sort((a, b) => (a.order || 0) - (b.order || 0));
    const idx = sorted.findIndex((c) => c.id === chapter.id);
    const prevChapter = idx > 0 ? sorted[idx - 1] : null;

    const prompt = buildCheckPrompt(novel || {}, chapter, characters, plotEvents, prevChapter);
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

    applyDefaultChecks(parsed.issues || []);
    setChecking(false);
    toast.success("บรรณาธิการ AI ตรวจเสร็จแล้ว");
  };

  // ---- ปรับตามที่เลือก ----
  const handleFix = async () => {
    if (checkedKeys.size === 0) return;
    const selected = [...checkedKeys].map((k) => activeIssues[k]).filter(Boolean);
    if (selected.length === 0) return;
    if (!chapter.content?.trim()) { toast.error("ไม่มีเนื้อหาให้ปรับ"); return; }

    setFixing(true);
    const prompt = buildFixPrompt(chapter, selected);
    const raw = await base44.integrations.Core.InvokeLLM({ prompt, model: "claude_sonnet_4_6" });
    const rawStr = typeof raw === "string" ? raw : (raw?.text || JSON.stringify(raw));
    const result = stripFence(rawStr);

    if (!result) {
      setFixing(false);
      toast.error("AI ไม่ส่งผลลัพธ์กลับมา — ลองใหม่อีกครั้ง");
      return;
    }

    setRevisedContent(result);
    setFixing(false);
    setDiffOpen(true);
  };

  // ---- บันทึก ----
  const handleSave = async () => {
    if (!revisedContent) return;
    setSaving(true);

    // snapshot เวอร์ชันเดิมก่อน
    await saveVersion({
      entityType: "chapter",
      entityId: chapter.id,
      novelId,
      data: { ...chapter },
      label: `ก่อนปรับตามบรรณาธิการ AI: ${chapter.title}`,
    });

    const wc = countWordsSimple(revisedContent);
    await base44.entities.Chapter.update(chapter.id, {
      content: revisedContent,
      word_count: wc,
    });

    queryClient.invalidateQueries({ queryKey: ["chapters", novelId] });
    if (onContentUpdate) onContentUpdate(revisedContent);

    setSaving(false);
    setDiffOpen(false);
    setRevisedContent(null);
    toast.success("บันทึกแล้ว — เวอร์ชันเดิมถูกสำรองไว้ในประวัติ");
  };

  const formatDate = (d) => {
    try { return format(new Date(d), "d MMM yy HH:mm", { locale: th }); } catch { return ""; }
  };

  return (
    <>
      <DiffDialog
        open={diffOpen}
        original={chapter.content || ""}
        revised={revisedContent || ""}
        onSave={handleSave}
        onCancel={() => { setDiffOpen(false); setRevisedContent(null); }}
        saving={saving}
      />

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
                disabled={checking || fixing}
              >
                {checking ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" />กำลังตรวจ...</>
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
                {reviewHistory.map((r) => {
                  let iss = [];
                  try { iss = JSON.parse(r.issues || "[]"); } catch {}
                  const high = iss.filter((i) => i.severity === "สูง").length;
                  return (
                    <button
                      key={r.id}
                      onClick={() => handleReviewSelect(r.id)}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-muted/30 transition-colors ${selectedHistoryId === r.id ? "bg-primary/5" : ""}`}
                    >
                      <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">{formatDate(r.created_date)}</span>
                      {high > 0 ? (
                        <span className="ml-auto text-[10px] text-red-600 bg-red-50 border border-red-200 rounded-full px-1.5 py-0.5">
                          ต้องแก้ {high}
                        </span>
                      ) : (
                        <span className="ml-auto text-[10px] text-green-600 bg-green-50 border border-green-200 rounded-full px-1.5 py-0.5">
                          ผ่าน
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Report */}
            {!checking && activeReview && (
              <div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-[11px] text-muted-foreground">
                    ผลตรวจ: {formatDate(activeReview.created_date)}
                  </span>
                  {selectedHistoryId && (
                    <button
                      onClick={() => handleReviewSelect(reviewHistory[0]?.id)}
                      className="text-[11px] text-primary/70 hover:text-primary underline"
                    >
                      ดูล่าสุด
                    </button>
                  )}
                  {activeIssues.length > 0 && (
                    <button
                      onClick={() => {
                        if (checkedKeys.size === activeIssues.length) {
                          setCheckedKeys(new Set());
                        } else {
                          setCheckedKeys(new Set(activeIssues.map((_, i) => i)));
                        }
                      }}
                      className="text-[11px] text-primary/70 hover:text-primary underline ml-auto"
                    >
                      {checkedKeys.size === activeIssues.length ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด"}
                    </button>
                  )}
                </div>

                <ReviewReport
                  review={activeReview}
                  checkedKeys={checkedKeys}
                  onToggle={toggleKey}
                />

                {/* Fix action */}
                {activeIssues.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/40 flex items-center gap-2 flex-wrap">
                    <Button
                      size="sm"
                      className="h-8 text-xs gap-1.5 bg-primary hover:bg-primary/90"
                      disabled={checkedKeys.size === 0 || fixing || checking}
                      onClick={handleFix}
                    >
                      {fixing ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" />AI กำลังปรับ...</>
                      ) : (
                        <><Wand2 className="w-3.5 h-3.5" />
                          {checkedKeys.size > 0
                            ? `ปรับตามคำแนะนำที่เลือก (${checkedKeys.size} ข้อ)`
                            : "ปรับตามคำแนะนำที่เลือก"}
                        </>
                      )}
                    </Button>
                    {fixing && (
                      <span className="text-[11px] text-muted-foreground/70 italic">
                        AI กำลังปรับเนื้อหา... อาจใช้เวลา 30–60 วินาที
                      </span>
                    )}
                  </div>
                )}
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
    </>
  );
}