import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Sparkles, Loader2, ChevronDown, ChevronUp, Check, Users, BookOpen, Feather, Library } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import SeasonSelectorDialog from "./SeasonSelectorDialog";

const GENRES = ["โรแมนติก", "แฟนตาซี", "อิงประวัติศาสตร์", "จีนย้อนยุค", "วาย", "สยองขวัญ", "ลึกลับ", "แอ็คชั่น", "ดราม่า", "อื่นๆ"];
const CHAR_ROLES = ["ตัวเอก", "ตัวรอง", "ตัวร้าย", "ตัวประกอบ"];
const DIALECTS = ["กลาง", "อีสาน", "เหนือ", "ใต้", "ตะวันออก", "อื่นๆ"];
const emptyChar = () => ({ name: "", role: "ตัวเอก", age: "", occupation: "", dialect: "กลาง", dialect_examples: "", personality: "", background: "", wound: "", desire: "" });

const STEPS = [
  { id: 1, label: "ประเภทและข้อมูล", icon: BookOpen },
  { id: 2, label: "ตัวละครหลัก", icon: Users },
  { id: 3, label: "นักเขียน & ยืนยัน", icon: Feather },
];

// ─── CharacterCard ─────────────────────────────────────────────────────────
function CharacterCard({ c, onUpdate, onRemove, writerSystemPrompt }) {
  const [expanded, setExpanded] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(c.ai_analysis || null);
  const [analysisOpen, setAnalysisOpen] = useState(!!c.ai_analysis);

  const handleAnalyze = async () => {
    if (!c.name) return;
    setAnalyzing(true);
    setAnalysis(null);
    const charDesc = [
      `ชื่อ: ${c.name}`,
      c.role && `บทบาท: ${c.role}`,
      c.age && `อายุ: ${c.age}`,
      c.occupation && `อาชีพ: ${c.occupation}`,
      c.personality && `นิสัย: ${c.personality}`,
      c.background && `ปูมหลัง: ${c.background}`,
      c.desire && `สิ่งที่ต้องการ: ${c.desire}`,
      c.wound && `ปม/บาดแผล: ${c.wound}`,
    ].filter(Boolean).join("\n");

    const writerCtx = writerSystemPrompt
      ? `[สไตล์และโทนการเขียน]\n${writerSystemPrompt}\n\n`
      : "";
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `${writerCtx}คุณคือนักวิเคราะห์ตัวละครในนิยายมืออาชีพ วิเคราะห์ตัวละครต่อไปนี้:\n\n${charDesc}\n\nวิเคราะห์ใน 4 หัวข้อ:\n1. **จุดแข็ง** — สิ่งที่น่าสนใจและโดดเด่น\n2. **Want vs Need** — ความต้องการที่รับรู้ vs ความต้องการที่แท้จริง\n3. **Character Arc** — เส้นทางการเติบโตที่เป็นไปได้\n4. **คำแนะนำ** — สิ่งที่ควรเติมเพื่อให้ตัวละครสมบูรณ์ยิ่งขึ้น\n\nตอบเป็นภาษาไทย กระชับ ตรงประเด็น สอดคล้องกับสไตล์การเขียนที่กำหนด`,
    });
    setAnalysis(result);
    setAnalysisOpen(true);
    setAnalyzing(false);
    // clear saved badge when new analysis is generated (not saved yet)
    if (c.ai_analysis) onUpdate("ai_analysis", "");
  };

  const handleSaveAnalysis = () => {
    onUpdate("ai_analysis", analysis);
    toast.success(`บันทึกผลวิเคราะห์ของ ${c.name || "ตัวละคร"} แล้ว ✓`);
  };

  return (
    <div className={`border rounded-xl bg-muted/20 overflow-hidden transition-colors ${c.ai_analysis ? "border-primary/30" : "border-border/60"}`}>
      <div className="flex items-center gap-2 p-2.5">
        <div className="flex-1 flex items-center gap-1.5 min-w-0">
          <Input placeholder="ชื่อตัวละคร" value={c.name} onChange={(e) => onUpdate("name", e.target.value)} className="flex-1 h-8 text-sm font-medium" />
          {c.ai_analysis && (
            <span className="shrink-0 flex items-center gap-0.5 text-[10px] text-primary font-medium bg-primary/8 border border-primary/20 rounded-full px-1.5 py-0.5 whitespace-nowrap">
              <Sparkles className="w-2.5 h-2.5" />มีผลวิเคราะห์
            </span>
          )}
        </div>
        <Select value={c.role} onValueChange={(v) => onUpdate("role", v)}>
          <SelectTrigger className="w-26 h-8 text-xs shrink-0"><SelectValue /></SelectTrigger>
          <SelectContent>{CHAR_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
        </Select>

        <Input placeholder="อายุ" value={c.age} onChange={(e) => onUpdate("age", e.target.value)} className="w-14 h-8 text-xs shrink-0" />
        <Input placeholder="คำแปล" value={c.dialect_examples || ""} onChange={(e) => onUpdate("dialect_examples", e.target.value)} className="w-28 h-8 text-xs shrink-0" />
        <Select value={c.dialect || "กลาง"} onValueChange={(v) => onUpdate("dialect", v)}>
          <SelectTrigger className="w-20 h-8 text-xs shrink-0"><SelectValue /></SelectTrigger>
          <SelectContent>{DIALECTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
        </Select>
        <button type="button" onClick={() => setExpanded((v) => !v)} className="h-8 w-8 shrink-0 rounded-md flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors text-xs" title={expanded ? "ย่อ" : "กรอกรายละเอียด"}>
          {expanded ? "▲" : "▼"}
        </button>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={onRemove}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
      {expanded && (
        <div className="px-2.5 pb-2.5 space-y-2 border-t border-border/40 pt-2">
          <Input placeholder="อุปนิสัย/บุคลิก" value={c.personality} onChange={(e) => onUpdate("personality", e.target.value)} className="h-8 text-xs w-full" />
          <Input placeholder="ปูมหลัง" value={c.background} onChange={(e) => onUpdate("background", e.target.value)} className="h-8 text-xs w-full" />
          <div className="flex gap-2">
            <Input placeholder="ปม/บาดแผล" value={c.wound} onChange={(e) => onUpdate("wound", e.target.value)} className="flex-1 h-8 text-xs" />
            <Input placeholder="สิ่งที่ต้องการ" value={c.desire} onChange={(e) => onUpdate("desire", e.target.value)} className="flex-1 h-8 text-xs" />
          </div>
        </div>
      )}
      <div className="px-2.5 pb-2.5 pt-1 border-t border-border/30">
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-primary/70 hover:text-primary hover:bg-primary/8 w-full" onClick={handleAnalyze} disabled={!c.name || analyzing}>
          {analyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          {analyzing ? "กำลังวิเคราะห์..." : "วิเคราะห์ตัวละคร AI"}
        </Button>
      </div>
      {analysis && (
        <div className="mx-2.5 mb-2.5 rounded-lg border border-primary/20 bg-primary/4 overflow-hidden">
          <button type="button" className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/8 transition-colors" onClick={() => setAnalysisOpen((v) => !v)}>
            <span className="flex items-center gap-1"><Sparkles className="w-3 h-3" />ผลวิเคราะห์ AI</span>
            {analysisOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {analysisOpen && (
            <div className="px-3 pb-3 text-xs prose prose-sm max-w-none [&>*:first-child]:mt-0 text-foreground/90">
              <ReactMarkdown>{analysis}</ReactMarkdown>
              {c.ai_analysis === analysis ? (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-primary font-medium">
                  <Check className="w-3.5 h-3.5" />บันทึกแล้ว
                </div>
              ) : (
                <Button type="button" size="sm" variant="outline" className="mt-2 gap-1.5 border-primary/30 text-primary hover:bg-primary/8 text-xs h-7" onClick={handleSaveAnalysis}>
                  <Sparkles className="w-3 h-3" />บันทึกผลวิเคราะห์นี้ไว้กับตัวละคร
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Stepper ───────────────────────────────────────────────────────────────
function Stepper({ currentStep }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-6">
      {STEPS.map((step, i) => {
        const done = currentStep > step.id;
        const active = currentStep === step.id;
        const Icon = step.icon;
        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center gap-1">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                done ? "bg-primary border-primary text-primary-foreground" :
                active ? "bg-primary/10 border-primary text-primary" :
                "bg-muted/50 border-border text-muted-foreground"
              }`}>
                {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              <span className={`text-[10px] font-medium whitespace-nowrap ${active ? "text-primary" : done ? "text-primary/70" : "text-muted-foreground"}`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 w-10 mx-1 mb-4 rounded-full transition-all ${currentStep > step.id ? "bg-primary" : "bg-border"}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Step 1: Novel Info ────────────────────────────────────────────────────
function Step1({ form, setForm, chars, activeWriters }) {
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [confirmMode, setConfirmMode] = useState(false);
  const [seasonSelectorOpen, setSeasonSelectorOpen] = useState(false);

  const handleDraftSynopsis = async (append = false) => {
    setConfirmMode(false);
    setDraftError("");
    setDrafting(true);
    const namedChars = chars.filter((c) => c.name.trim());
    const isOneShot = form.novel_type === "เรื่องสั้น";
    const contextParts = [
      `ชื่อเรื่อง: ${form.title}`,
      `ประเภท: ${isOneShot ? "เรื่องสั้นจบในตอนเดียว" : "นิยายยาวหลายตอน"}`,
      form.genre && `แนวนิยาย: ${form.genre}`,
      form.era && `ยุคสมัยและฉากหลัง: ${form.era}`,
      isOneShot 
        ? `ความยาวเป้าหมาย: ${form.word_count_target || 3000} คำ`
        : form.target_chapters && `จำนวนตอน: ${form.target_chapters} ตอน`,
      namedChars.length > 0 && `ตัวละครหลัก: ${namedChars.map((c) => `${c.name} (${c.role})`).join(", ")}`,
    ].filter(Boolean).join("\n");

    // ดึง writer system_prompt ถ้าเลือกแล้ว
    const selectedWriter = activeWriters?.find((w) => w.id === form.writer_id);
    const writerCtx = selectedWriter?.system_prompt
      ? `[สไตล์และโทนการเขียน]\n${selectedWriter.system_prompt}\n\n`
      : "";

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `${writerCtx}คุณคือนักเขียนนิยายมืออาชีพ ช่วยร่างเรื่องย่อ${isOneShot ? "เรื่องสั้น" : "นิยาย"}เรื่องนี้:\n\n${contextParts}\n\nเขียนเรื่องย่อภาษาไทย 3-5 ประโยค กระชับ น่าสนใจ ดึงดูดให้อยากอ่าน เหมาะกับแนว${form.genre || "นิยาย"}ที่เลือก อย่าเพิ่งเปิดเผยปมสำคัญทั้งหมด ให้รู้สึกอยากติดตาม ตอบเฉพาะเรื่องย่อ ไม่ต้องมีหัวข้อหรือคำอธิบายเพิ่มเติม`,
    });

    // Strip code fences
    const cleaned = result.replace(/^```[\w]*\n?/m, "").replace(/```$/m, "").trim();
    if (!cleaned) {
      setDraftError("AI ไม่สามารถร่างเรื่องย่อได้ กรุณาลองใหม่อีกครั้ง");
      setDrafting(false);
      return;
    }

    if (append && form.synopsis.trim()) {
      setForm({ ...form, synopsis: form.synopsis.trim() + "\n\n" + cleaned });
    } else {
      setForm({ ...form, synopsis: cleaned });
    }
    setDrafting(false);
  };

  const handleAiClick = () => {
    if (!form.title.trim()) {
      setDraftError("กรุณากรอกชื่อเรื่องก่อนให้ AI ช่วยร่าง");
      return;
    }
    if (form.synopsis.trim()) {
      setConfirmMode(true); // ask overwrite or append
      return;
    }
    handleDraftSynopsis(false);
  };

  const isOneShot = form.novel_type === "เรื่องสั้น";

  return (
    <div className="space-y-4">
      {/* ประเภทงาน */}
      <div className="space-y-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 border-dashed"
          onClick={async () => {
            // ดึงข้อมูล parent novel ถ้ามี เพื่อ lock writer_id ล่วงหน้า
            if (form.parent_novel_id) {
              try {
                const parent = await base44.entities.Novel.get(form.parent_novel_id);
                if (parent?.writer_id) {
                  setForm({ ...form, writer_id: parent.writer_id });
                  toast.success(`ล็อค AI Writer: ${parent.writer_id ? "ใช้.writer เดิม" : ""}`);
                }
              } catch {}
            }
            setSeasonSelectorOpen(true);
          }}
        >
          <Library className="w-4 h-4" />
          {form.parent_novel_id ? `Season ${form.season_number || 2}: กำลังสร้างภาคต่อ` : "สร้าง Season ใหม่ (ภาคต่อ)"}
        </Button>
        {seasonSelectorOpen && (
          <SeasonSelectorDialog
            open={true}
            onClose={() => setSeasonSelectorOpen(false)}
            novelId={form.parent_novel_id || activeWriters?.[0]?.id}
            onSeasonSelected={async (season) => {
              // ดึง writer_id จาก parent novel เสมอ
              let inheritedWriterId = form.writer_id;
              if (season.parent_novel_id || season.id) {
                try {
                  const parent = await base44.entities.Novel.get(season.parent_novel_id || season.id);
                  if (parent?.writer_id) {
                    inheritedWriterId = parent.writer_id;
                  }
                } catch {}
              }
              setForm({ 
                ...form, 
                parent_novel_id: season.parent_novel_id || season.id,
                season_number: (season.season_number || 1) + 1,
                writer_id: inheritedWriterId
              });
              setSeasonSelectorOpen(false);
              toast.success(`สร้างภาคต่อจาก ${season.title} — ใช้ AI Writer เดิม`);
            }}
          />
        )}

      </div>

      <div>
        <label className="text-sm font-medium mb-1.5 block">ชื่อเรื่อง <span className="text-destructive">*</span></label>
        <Input placeholder="เช่น ลับแลลายเมฆ" value={form.title} onChange={(e) => { setForm({ ...form, title: e.target.value }); setDraftError(""); }} autoFocus />
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">แนวนิยาย</label>
        <Select value={form.genre} onValueChange={(v) => setForm({ ...form, genre: v })}>
          <SelectTrigger><SelectValue placeholder="เลือกแนว" /></SelectTrigger>
          <SelectContent>{GENRES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">ยุคสมัยและฉากหลัง</label>
        <Input placeholder="เช่น กรุงศรีอยุธยาตอนปลาย พ.ศ. 2310" value={form.era} onChange={(e) => setForm({ ...form, era: e.target.value })} />
      </div>
      <div>
          <label className="text-sm font-medium mb-1.5 block">จำนวนตอนที่ต้องการ</label>
          <Select value={form.target_chapters.toString()} onValueChange={(v) => setForm({ ...form, target_chapters: v })}>
            <SelectTrigger><SelectValue placeholder="เลือกจำนวนตอน" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 ตอน</SelectItem>
              <SelectItem value="20">20 ตอน</SelectItem>
              <SelectItem value="30">30 ตอน</SelectItem>
              <SelectItem value="40">40 ตอน</SelectItem>
            </SelectContent>
          </Select>
        </div>

      <div>
        <label className="text-sm font-medium mb-1.5 block">จำนวนคำเป้าหมายต่อตอน</label>
        <Select value={form.word_count_target.toString()} onValueChange={(v) => setForm({ ...form, word_count_target: v })}>
          <SelectTrigger><SelectValue placeholder="เลือกจำนวนคำ" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1000">~1,000 คำ</SelectItem>
            <SelectItem value="1500">~1,500 คำ</SelectItem>
            <SelectItem value="2000">~2,000 คำ</SelectItem>
            <SelectItem value="3000">~3,000 คำ</SelectItem>
            <SelectItem value="5000">~5,000 คำ</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium">เรื่องย่อ</label>
          {!confirmMode ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-primary/70 hover:text-primary hover:bg-primary/8 px-2"
              onClick={handleAiClick}
              disabled={drafting}
            >
              {drafting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {drafting ? "กำลังร่าง..." : "✨ ให้ AI ช่วยร่างเรื่องย่อ"}
            </Button>
          ) : (
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground mr-1">มีข้อความอยู่แล้ว:</span>
              <Button type="button" size="sm" variant="outline" className="h-6 text-xs px-2 border-destructive/40 text-destructive hover:bg-destructive/8" onClick={() => handleDraftSynopsis(false)}>
                แทนที่
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-6 text-xs px-2 border-primary/40 text-primary hover:bg-primary/8" onClick={() => handleDraftSynopsis(true)}>
                ต่อท้าย
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-6 text-xs px-1.5 text-muted-foreground" onClick={() => setConfirmMode(false)}>
                ยกเลิก
              </Button>
            </div>
          )}
        </div>
        {draftError && <p className="text-xs text-destructive mb-1.5">{draftError}</p>}
        <Textarea placeholder="เล่าเรื่องย่อของนิยาย..." rows={4} value={form.synopsis} onChange={(e) => setForm({ ...form, synopsis: e.target.value })} />
      </div>
    </div>
  );
}

// ─── Step 2: Characters ────────────────────────────────────────────────────
function Step2({ chars, setChars, writerSystemPrompt }) {
  const addRow = () => setChars([...chars, emptyChar()]);
  const removeRow = (i) => setChars(chars.filter((_, idx) => idx !== i));
  const updateRow = (i, field, value) => setChars(chars.map((c, idx) => idx === i ? { ...c, [field]: value } : c));

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">เพิ่มตัวละครหลัก — ข้ามได้ ปล่อยให้ AI เติมทีหลังก็ได้</p>
      {chars.map((c, i) => (
        <CharacterCard key={i} c={c} onUpdate={(field, value) => updateRow(i, field, value)} onRemove={() => removeRow(i)} writerSystemPrompt={writerSystemPrompt} />
      ))}
      <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={addRow}>
        <Plus className="w-3 h-3" />เพิ่มตัวละคร
      </Button>
    </div>
  );
}

// ─── Step 3: Writer + Summary ──────────────────────────────────────────────
function Step3({ form, setForm, chars, activeWriters }) {
  const writer = activeWriters.find((w) => w.id === form.writer_id);
  const namedChars = chars.filter((c) => c.name.trim());

  return (
    <div className="space-y-5">
      {/* Writer picker */}
      <div>
        <label className="text-sm font-medium mb-1.5 block">นักเขียน AI ประจำเรื่อง <span className="text-destructive">*</span></label>
        <Select value={form.writer_id} onValueChange={(v) => setForm({ ...form, writer_id: v })}>
          <SelectTrigger><SelectValue placeholder="เลือกนักเขียน AI" /></SelectTrigger>
          <SelectContent>
            {activeWriters.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                <span className="font-medium">{w.name}</span>
                {w.description && <span className="text-muted-foreground ml-1.5 text-xs">— {w.description}</span>}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {writer && <p className="text-xs text-primary/60 mt-1">โทน: {writer.style || "-"}</p>}
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-border/50 bg-muted/20 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40 bg-muted/30">
          <p className="text-sm font-semibold">สรุปข้อมูลนิยาย</p>
        </div>
        <div className="px-4 py-3 space-y-2 text-sm">
          <SummaryRow label="ชื่อเรื่อง" value={form.title} bold />
          <SummaryRow label="แนวนิยาย" value={form.genre} />
          <SummaryRow label="ยุคสมัย" value={form.era} />
          {form.novel_type === "เรื่องสั้น" ? (
            <>
              <SummaryRow label="ประเภท" value="เรื่องสั้นจบในตอนเดียว" highlight />
              <SummaryRow label="ความยาวเป้าหมาย" value={`${form.word_count_target.toLocaleString()} คำ`} />
              <SummaryRow label="ตอนจบ" value={form.ending_type} />
            </>
          ) : (
            <>
              <SummaryRow label="จำนวนตอน" value={form.target_chapters ? `${form.target_chapters} ตอน` : null} />
              <SummaryRow label="จำนวนคำต่อตอน" value={form.word_count_target ? `${form.word_count_target.toLocaleString()} คำ` : null} />
            </>
          )}
          <SummaryRow label="นักเขียน AI" value={writer?.name} highlight />
          {form.synopsis && (
            <div className="pt-1">
              <span className="text-muted-foreground text-xs">เรื่องย่อ: </span>
              <span className="text-xs text-foreground/80 line-clamp-2">{form.synopsis}</span>
            </div>
          )}
        </div>
        {namedChars.length > 0 && (
          <div className="px-4 pb-3 border-t border-border/40 pt-2">
            <p className="text-xs font-medium text-muted-foreground mb-2">ตัวละคร ({namedChars.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {namedChars.map((c, i) => (
                <span key={i} className="px-2 py-0.5 rounded-full bg-primary/8 text-primary text-xs border border-primary/15">
                  {c.name} <span className="opacity-60">({c.role})</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value, bold, highlight }) {
  if (!value) return <div className="flex justify-between"><span className="text-muted-foreground text-xs">{label}:</span><span className="text-xs text-muted-foreground/50">ไม่ได้กรอก</span></div>;
  return (
    <div className="flex justify-between items-baseline gap-2">
      <span className="text-muted-foreground text-xs shrink-0">{label}:</span>
      <span className={`text-xs text-right ${bold ? "font-semibold text-foreground" : highlight ? "text-primary font-medium" : "text-foreground/80"}`}>{value}</span>
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────
export default function CreateNovelWizard({ open, onOpenChange, activeWriters, onCreated }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ title: "", genre: "", synopsis: "", era: "", writer_id: "", novel_type: "นิยายยาว", target_chapters: "10", word_count_target: "1500", ending_type: "จบตามจริง", parent_novel_id: "", season_number: 1 });
  const [chars, setChars] = useState([emptyChar()]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [seasonSelectorOpen, setSeasonSelectorOpen] = useState(false);

  const handleClose = (v) => {
    onOpenChange(v);
    if (!v) {
      setTimeout(() => {
        setStep(1);
        setForm({ title: "", genre: "", synopsis: "", era: "", writer_id: "", novel_type: "นิยายยาว", target_chapters: "10", word_count_target: "1500", ending_type: "จบตามจริง" });
        setChars([emptyChar()]);
        setError("");
      }, 300);
    }
  };

  const validateStep = () => {
    if (step === 1 && !form.title.trim()) { setError("กรุณากรอกชื่อเรื่องก่อน"); return false; }
    if (step === 3 && !form.writer_id) { setError("กรุณาเลือกนักเขียน AI ประจำเรื่อง"); return false; }
    setError("");
    return true;
  };

  const next = () => { if (validateStep()) setStep((s) => s + 1); };
  const back = () => { setError(""); setStep((s) => s - 1); };

  const handleCreate = async () => {
    if (!validateStep()) return;
    setCreating(true);

    // หา writer ที่เลือก เพื่อดึง system_prompt มาใช้เป็นหัวใจ
    const selectedWriter = activeWriters.find((w) => w.id === form.writer_id);
    const writerSystemPrompt = selectedWriter?.system_prompt || "";
    const writerName = selectedWriter?.name || "";

    // ถ้าเป็น Season ใหม่ ให้คัดลอกข้อมูลจาก Season ก่อนหน้า — โดย writer_id ต้องมาจาก parent เท่านั้น
    const novelData = { ...form };
    if (form.parent_novel_id && form.season_number > 1) {
      const parentNovel = await base44.entities.Novel.get(form.parent_novel_id);
      if (parentNovel) {
        // ★ สำคัญ: lock writer_id จาก parent novel เสมอ — ห้ามให้ null
        novelData.writer_id = parentNovel.writer_id || form.writer_id;
        novelData.genre = parentNovel.genre || form.genre;
        novelData.era = parentNovel.era || form.era;
        novelData.novel_type = parentNovel.novel_type || form.novel_type;
        novelData.ending_type = parentNovel.ending_type || form.ending_type;
        novelData.target_chapters = parentNovel.target_chapters || form.target_chapters;
        novelData.word_count_target = parentNovel.word_count_target || form.word_count_target;
        novelData.main_character_count = parentNovel.main_character_count || form.main_character_count;
        novelData.season_number = form.season_number;
        novelData.parent_novel_id = parentNovel.parent_novel_id || form.parent_novel_id;
      }
    }
    // ★ ตรวจสอบอีกครั้ง — ถ้ายังไม่มี writer_id ให้ใช้จาก form ที่ผู้ใช้เลือก
    if (!novelData.writer_id && form.writer_id) {
      novelData.writer_id = form.writer_id;
    }

    const namedChars = chars.filter((c) => c.name.trim());
    const isOneShot = novelData.novel_type === "เรื่องสั้น";

    // ── สร้าง plot_outline โดยใช้ system_prompt ของนักเขียน AI เป็นหัวใจ ──
    if (writerSystemPrompt && form.title.trim()) {
      const charSummary = namedChars.length > 0
        ? namedChars.map((c) => {
            const parts = [
              `${c.name} (${c.role})`,
              c.age && `อายุ ${c.age}`,
              c.occupation && `อาชีพ: ${c.occupation}`,
              c.personality && `นิสัย: ${c.personality}`,
              c.background && `ปูมหลัง: ${c.background}`,
              c.desire && `want: ${c.desire}`,
              c.wound && `wound: ${c.wound}`,
            ].filter(Boolean).join(", ");
            return `• ${parts}`;
          }).join("\n")
        : "ยังไม่ระบุตัวละคร";

      const contextBlock = [
        `ชื่อเรื่อง: ${form.title}`,
        form.genre && `แนว: ${form.genre}`,
        form.era && `ยุคสมัย/ฉากหลัง: ${form.era}`,
        form.synopsis && `เรื่องย่อที่ผู้เขียนให้มา: ${form.synopsis}`,
        isOneShot
          ? `ประเภท: เรื่องสั้นจบในตอนเดียว — ความยาว ${novelData.word_count_target || 3000} คำ — ตอนจบ: ${novelData.ending_type || "ตามจริง"}`
          : `ประเภท: นิยายหลายตอน — ${novelData.target_chapters || 10} ตอน — จำนวนคำต่อตอน: ${novelData.word_count_target || 1500} คำ`,
        `ตัวละครหลัก:\n${charSummary}`,
      ].filter(Boolean).join("\n");

      const plotPrompt = `[สกิลและสไตล์การเขียนของ${writerName ? ` ${writerName}` : "นักเขียน AI"} — ใช้เป็นหัวใจในการสร้างเรื่องนี้]\n${writerSystemPrompt}\n\n[ข้อมูลนิยายจากผู้เขียน]\n${contextBlock}\n\n[งานที่ต้องทำ]\nอ่านข้อมูลข้างต้นทั้งหมด แล้วสร้าง "โครงเรื่องหลัก" สำหรับนิยายเรื่องนี้โดยใช้สกิลและสไตล์การเขียนของ${writerName ? `${writerName}` : "นักเขียน AI"} เป็นหัวใจ\n\nโครงเรื่องต้องครอบคลุม:\n1. แก่น/ธีมหลักของเรื่อง\n2. โครงสามองก์ (ต้นเรื่อง / กลางเรื่อง / จุดสูงสุดและบทสรุป)\n3. อารมณ์และโทนที่ต้องการสื่อ สอดคล้องกับสไตล์นักเขียน\n4. ปมหลักและจุดหักเหสำคัญ\n5. ความสัมพันธ์ระหว่างตัวละครหลัก\n\nตอบเป็นภาษาไทย กระชับ ชัดเจน ไม่เกิน 600 คำ ตอบเฉพาะโครงเรื่อง ไม่ต้องมีคำอธิบายเพิ่มเติม`;

      try {
        const result = await base44.integrations.Core.InvokeLLM({
          prompt: plotPrompt,
          model: "claude_sonnet_4_6",
        });
        const plotOutline = typeof result === "string"
          ? result.replace(/^```[\w]*\n?/m, "").replace(/```$/m, "").trim()
          : (result?.text || "").trim();
        if (plotOutline) {
          novelData.plot_outline = plotOutline;
        }
      } catch {
        // ถ้า AI ล้มเหลว ก็สร้างเรื่องได้เลยโดยไม่มี plot_outline
      }
    }

    const novel = await base44.entities.Novel.create(novelData);

    if (namedChars.length > 0) {
      await Promise.all(namedChars.map((c) =>
        base44.entities.Character.create({
          novel_id: novel.id,
          name: c.name.trim(),
          role: c.role,
          age: c.age || undefined,
          occupation: c.occupation || undefined,
          dialect: c.dialect || "กลาง",
          dialect_examples: c.dialect_examples || undefined,
          personality: c.personality || undefined,
          background: c.background || undefined,
          wound: c.wound || undefined,
          desire: c.desire || undefined,
          ai_analysis: c.ai_analysis || undefined,
        })
      ));
    }

    setCreating(false);
    handleClose(false);
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg flex flex-col max-h-[85vh] p-0 gap-0 overflow-hidden">
        {/* Sticky header */}
        <div className="px-6 pt-5 pb-4 border-b border-border/40 shrink-0">
          <h2 className="font-heading text-lg font-semibold mb-4">สร้างนิยายเรื่องใหม่</h2>
          <Stepper currentStep={step} />
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 1 && <Step1 form={form} setForm={setForm} chars={chars} activeWriters={activeWriters} />}
          {step === 2 && <Step2 chars={chars} setChars={setChars} writerSystemPrompt={activeWriters?.find((w) => w.id === form.writer_id)?.system_prompt} />}
          {step === 3 && <Step3 form={form} setForm={setForm} chars={chars} activeWriters={activeWriters} />}
        </div>

        {/* Sticky footer */}
        <div className="px-6 py-4 border-t border-border/40 shrink-0 bg-background">
          {error && <p className="text-xs text-destructive mb-2">{error}</p>}
          <div className="flex gap-2">
            {step > 1 && (
              <Button variant="outline" className="flex-1" onClick={back} disabled={creating}>
                ย้อนกลับ
              </Button>
            )}
            {step < 3 ? (
              <Button className="flex-1" onClick={next} disabled={creating}>
                ถัดไป
              </Button>
            ) : (
              <Button className="flex-1" onClick={handleCreate} disabled={creating || !form.title.trim() || !form.writer_id} title={!form.title.trim() ? "กรุณากรอกชื่อเรื่อง" : !form.writer_id ? "กรุณาเลือกนักเขียน AI" : ""}>
                {creating ? <><Loader2 className="w-4 h-4 animate-spin mr-1.5" />AI กำลังสร้างโครงเรื่อง...</> : "สร้างนิยาย"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}