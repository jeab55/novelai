import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Languages, Plus, Loader2, CheckCircle2, Sparkles, Wand2, Save, Layers, Files, Archive, Bookmark } from "lucide-react";
import { toast } from "sonner";
import { invokeAIStable } from "@/lib/aiInvoke";
import SourceItemCard from "@/components/novel/SourceItemCard";
import SavedTranslationsLibrary from "@/components/novel/SavedTranslationsLibrary";

const GENRES = ["โรแมนติก", "แฟนตาซี", "อิงประวัติศาสตร์", "จีนย้อนยุค", "วาย", "สยองขวัญ", "ลึกลับ", "แอ็คชั่น", "ดราม่า", "ยูริ", "โรแมนซ์คอมเมดี้", "ดาร์กโรแมนซ์", "โรแมนซ์แฟนตาซี", "ชีวิต", "ต่างโลก-เกิดใหม่", "ไซไฟ", "สืบสวนสอบสวน", "ระทึกขวัญ", "ผจญภัย", "กำลังภายใน", "วัยรุ่น", "อื่นๆ"];
const TONES = ["ดราม่าเข้มข้น", "อบอุ่นซึ้งกินใจ", "ลึกลับชวนติดตาม", "สนุกสดใส", "โศกเศร้าสะเทือนใจ", "ตื่นเต้นเร้าใจ", "โรแมนติกหวานซึ้ง"];
const LENGTHS = [
  { value: 800, label: "สั้น (~800 คำ)" },
  { value: 1500, label: "ปานกลาง (~1,500 คำ)" },
  { value: 2500, label: "ยาว (~2,500 คำ)" },
  { value: 4000, label: "ยาวมาก (~4,000 คำ)" },
];

const STEPS = ["นำเข้า", "แปล", "ดัดแปลง", "บันทึก"];

let _sid = 0;
const newSource = () => ({ id: ++_sid, mode: "text", text: "", url: "", title: "" });

function countWords(text) {
  if (!text) return 0;
  try {
    const seg = new Intl.Segmenter("th", { granularity: "word" });
    return [...seg.segment(text)].filter((s) => s.isWordLike).length;
  } catch {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }
}

export default function TranslateAdaptDialog({ open, onClose, novels = [] }) {
  const queryClient = useQueryClient();
  const [view, setView] = useState("create"); // create | library
  const [step, setStep] = useState(0);
  const [savingProject, setSavingProject] = useState(false);

  // import — multiple sources
  const [sources, setSources] = useState([newSource()]);
  const [combineMode, setCombineMode] = useState("merge"); // merge | separate

  // translate (array, one per source)
  const [translating, setTranslating] = useState(false);
  const [translations, setTranslations] = useState([]); // [{ title, text }]

  // adapt settings + result
  const [genre, setGenre] = useState("โรแมนติก");
  const [tone, setTone] = useState("ดราม่าเข้มข้น");
  const [wordTarget, setWordTarget] = useState(1500);
  const [adapting, setAdapting] = useState(false);
  const [adaptProgress, setAdaptProgress] = useState("");
  const [drafts, setDrafts] = useState([]); // [{ title, content }]

  // save
  const [saveMode, setSaveMode] = useState("new"); // new | existing
  const [newTitle, setNewTitle] = useState("");
  const [targetNovelId, setTargetNovelId] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: writers = [] } = useQuery({
    queryKey: ["writers"],
    queryFn: () => base44.entities.Writer.list(),
    enabled: open,
  });

  const busy = translating || adapting || saving;
  const filledSources = sources.filter((s) => s.text?.trim());

  const reset = () => {
    setView("create");
    setStep(0);
    setSources([newSource()]);
    setCombineMode("merge");
    setTranslations([]); setDrafts([]);
    setGenre("โรแมนติก"); setTone("ดราม่าเข้มข้น"); setWordTarget(1500);
    setSaveMode("new"); setNewTitle(""); setTargetNovelId("");
    setAdaptProgress("");
  };

  const handleClose = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const updateSource = (id, next) => setSources((arr) => arr.map((s) => (s.id === id ? next : s)));
  const addSource = () => setSources((arr) => [...arr, newSource()]);
  const removeSource = (id) => setSources((arr) => arr.filter((s) => s.id !== id));

  const handleTranslate = async () => {
    if (filledSources.length === 0) {
      toast.error("กรุณาใส่เนื้อหาต้นทางอย่างน้อย 1 แหล่ง");
      return;
    }
    setTranslating(true);
    setStep(1);
    try {
      const results = await Promise.all(
        filledSources.map(async (s, i) => {
          const prompt = `คุณคือนักแปลมืออาชีพ จงตรวจจับภาษาต้นทางอัตโนมัติ แล้วแปลข้อความต่อไปนี้เป็น "ภาษาไทย" ที่เป็นธรรมชาติ สละสลวย รักษาความหมาย อารมณ์ และโครงสร้างย่อหน้า/บรรทัด (เช่น เนื้อเพลงให้คงการขึ้นบรรทัด) ไว้ให้ครบถ้วน

ห้ามเพิ่มคำอธิบายหรือความเห็น ให้ส่งเฉพาะคำแปลภาษาไทยเท่านั้น

ข้อความต้นทาง:
"""
${s.text.slice(0, 12000)}
"""

คำแปลภาษาไทย:`;
          const result = await invokeAIStable({ prompt, model: "claude_sonnet_4_6" });
          return { title: s.title?.trim() || `แหล่งที่ ${i + 1}`, text: (result || "").trim() };
        })
      );
      setTranslations(results);
    } catch (e) {
      toast.error("แปลไม่สำเร็จ: " + (e.message || ""));
      setStep(0);
    } finally {
      setTranslating(false);
    }
  };

  const adaptMerged = async () => {
    const writerPrompt = writers.find((w) => w.is_active !== false)?.system_prompt || "";
    const combined = translations
      .map((t, i) => `[แหล่งที่ ${i + 1}: ${t.title}]\n${t.text}`)
      .join("\n\n---\n\n");
    const prompt = `${writerPrompt ? `[สไตล์การเขียน]\n${writerPrompt}\n\n` : ""}คุณคือนักเขียนนิยายมืออาชีพ ด้านล่างคือเนื้อหา ${translations.length} แหล่งที่แปลเป็นภาษาไทยแล้ว จงนำเนื้อหาทั้งหมดมา "หลอมรวมและเรียบเรียงใหม่เป็นเนื้อเรื่องนิยายเรื่องเดียว" ที่ต่อเนื่องกลมกลืน ไม่ใช่การนำมาต่อท้ายกันแบบแยกส่วน

[ข้อกำหนด]
- เชื่อมโยงแก่นเรื่อง ตัวละคร และเหตุการณ์จากทุกแหล่งให้เป็นเรื่องเดียวที่ลื่นไหล มีจุดเริ่ม-กลาง-จบ
- แนวเรื่อง: ${genre}
- โทน/อารมณ์: ${tone}
- ความยาวประมาณ: ${wordTarget} คำ (±15%)
- เขียนเป็นร้อยแก้วนิยายภาษาไทย มีการบรรยายฉาก อารมณ์ และมุมมองตัวละคร ไม่ใช่การแปลตรงตัว
- ส่งเฉพาะเนื้อเรื่องที่เรียบเรียงแล้ว ไม่ต้องมีคำนำหรือหัวข้อ

[เนื้อหาที่แปลแล้วทั้งหมด]
${combined.slice(0, 20000)}

[เนื้อเรื่องนิยายที่หลอมรวมแล้ว]`;
    const result = await invokeAIStable({ prompt, model: "claude_sonnet_4_6" });
    return [{ title: newTitle.trim() || "เนื้อเรื่องที่ดัดแปลง", content: (result || "").trim() }];
  };

  const adaptSeparate = async () => {
    const writerPrompt = writers.find((w) => w.is_active !== false)?.system_prompt || "";
    const out = [];
    for (let i = 0; i < translations.length; i++) {
      const t = translations[i];
      setAdaptProgress(`กำลังดัดแปลงชิ้นที่ ${i + 1}/${translations.length}...`);
      const prompt = `${writerPrompt ? `[สไตล์การเขียน]\n${writerPrompt}\n\n` : ""}คุณคือนักเขียนนิยายมืออาชีพ จงนำ "เนื้อหาที่แปลแล้ว" ด้านล่างมาดัดแปลงและเรียบเรียงใหม่ให้กลายเป็น "เนื้อเรื่องนิยาย" ที่อ่านลื่นไหล มีบรรยากาศ มีการบรรยายฉาก อารมณ์ และมุมมองตัวละคร

[ข้อกำหนด]
- แนวเรื่อง: ${genre}
- โทน/อารมณ์: ${tone}
- ความยาวประมาณ: ${wordTarget} คำ (±15%)
- เขียนเป็นร้อยแก้วนิยายภาษาไทย ไม่ใช่การแปลตรงตัว รักษาแก่นเนื้อหาเดิมไว้
- ส่งเฉพาะเนื้อเรื่องที่ดัดแปลงแล้ว ไม่ต้องมีคำนำหรือหัวข้อ

[เนื้อหาที่แปลแล้ว]
"""
${t.text.slice(0, 12000)}
"""

[เนื้อเรื่องนิยายที่ดัดแปลงแล้ว]`;
      const result = await invokeAIStable({ prompt, model: "claude_sonnet_4_6" });
      out.push({ title: t.title, content: (result || "").trim() });
    }
    return out;
  };

  const handleAdapt = async () => {
    if (translations.length === 0) return;
    setAdapting(true);
    setAdaptProgress("");
    try {
      const result = combineMode === "merge" || translations.length === 1
        ? await adaptMerged()
        : await adaptSeparate();
      setDrafts(result);
      setStep(2);
    } catch (e) {
      toast.error("ดัดแปลงไม่สำเร็จ: " + (e.message || ""));
    } finally {
      setAdapting(false);
      setAdaptProgress("");
    }
  };

  const handleSave = async () => {
    if (drafts.length === 0 || drafts.every((d) => !d.content.trim())) return;
    setSaving(true);
    try {
      let novelId = targetNovelId;

      if (saveMode === "new") {
        if (!newTitle.trim()) {
          toast.error("กรุณาใส่ชื่อเรื่อง");
          setSaving(false);
          return;
        }
        const novel = await base44.entities.Novel.create({
          title: newTitle.trim(),
          genre,
          synopsis: (translations[0]?.text || "").slice(0, 300),
        });
        novelId = novel.id;
      }

      if (!novelId) {
        toast.error("กรุณาเลือกนิยายปลายทาง");
        setSaving(false);
        return;
      }

      const existing = await base44.entities.Chapter.filter({ novel_id: novelId });
      let maxOrder = existing.reduce((m, c) => Math.max(m, c.order || 0), 0);

      for (const d of drafts) {
        if (!d.content.trim()) continue;
        maxOrder += 1;
        await base44.entities.Chapter.create({
          novel_id: novelId,
          title: d.title || `ตอนที่ ${maxOrder}`,
          content: d.content,
          order: maxOrder,
          word_count: countWords(d.content),
          status: "ร่าง",
        });
      }

      queryClient.invalidateQueries({ queryKey: ["chapters-all"] });
      queryClient.invalidateQueries({ queryKey: ["chapters", novelId] });
      queryClient.invalidateQueries({ queryKey: ["novels"] });
      queryClient.invalidateQueries({ queryKey: ["novels-all"] });
      setStep(3);
      toast.success("บันทึกเข้าโปรเจกต์นิยายเรียบร้อยแล้ว!");
    } catch (e) {
      toast.error("บันทึกไม่สำเร็จ: " + (e.message || ""));
    } finally {
      setSaving(false);
    }
  };

  const updateDraft = (idx, patch) => setDrafts((arr) => arr.map((d, i) => (i === idx ? { ...d, ...patch } : d)));

  const handleSaveProject = async () => {
    if (drafts.length === 0 || drafts.every((d) => !d.content.trim())) {
      toast.error("ยังไม่มีร่างเนื้อเรื่องให้บันทึก");
      return;
    }
    setSavingProject(true);
    try {
      const name = newTitle.trim() || translations[0]?.title || drafts[0]?.title || "งานแปล";
      await base44.entities.TranslationProject.create({
        name,
        translations: JSON.stringify(translations),
        drafts: JSON.stringify(drafts),
        genre,
        tone,
        word_target: wordTarget,
        combine_mode: combineMode,
        source_count: translations.length || 1,
      });
      queryClient.invalidateQueries({ queryKey: ["translation-projects"] });
      toast.success("บันทึกงานแปลเข้าคลังแล้ว ดูซ้ำได้ทุกเมื่อ");
    } catch (e) {
      toast.error("บันทึกงานแปลไม่สำเร็จ: " + (e.message || ""));
    } finally {
      setSavingProject(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Languages className="w-5 h-5 text-primary" />
            แปลและดัดแปลงเป็นเนื้อเรื่อง
          </DialogTitle>
        </DialogHeader>

        {/* View tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-xl mb-1">
          <button
            onClick={() => setView("create")}
            className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-1.5 rounded-lg transition-colors ${view === "create" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
          >
            <Languages className="w-4 h-4" />แปลใหม่
          </button>
          <button
            onClick={() => setView("library")}
            className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-1.5 rounded-lg transition-colors ${view === "library" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
          >
            <Archive className="w-4 h-4" />คลังงานแปลที่บันทึกไว้
          </button>
        </div>

        {view === "library" && (
          <div className="flex-1 overflow-y-auto min-h-0 pr-1">
            <SavedTranslationsLibrary enabled={open && view === "library"} novels={novels} />
          </div>
        )}

        {/* Step indicator */}
        {view === "create" && (
        <div className="flex items-center gap-1 mb-2">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                i === step ? "bg-primary text-primary-foreground" :
                i < step ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
              }`}>
                {i < step ? <CheckCircle2 className="w-3 h-3" /> : <span>{i + 1}</span>}
                {s}
              </div>
              {i < STEPS.length - 1 && <div className="w-3 h-px bg-border flex-shrink-0" />}
            </React.Fragment>
          ))}
        </div>
        )}

        {view === "create" && (
        <div className="flex-1 overflow-y-auto min-h-0 pr-1">
          {/* Step 0: นำเข้าหลายแหล่ง */}
          {step === 0 && (
            <div className="space-y-3">
              {sources.map((s, i) => (
                <SourceItemCard
                  key={s.id}
                  source={s}
                  index={i}
                  total={sources.length}
                  onChange={(next) => updateSource(s.id, next)}
                  onRemove={() => removeSource(s.id)}
                />
              ))}

              <Button variant="outline" className="w-full gap-2 border-dashed h-11" onClick={addSource}>
                <Plus className="w-4 h-4" />เพิ่มแหล่งเนื้อหา
              </Button>

              {sources.length > 1 && (
                <div className="bg-secondary/40 rounded-xl border border-border/50 p-3 space-y-2">
                  <p className="text-sm font-medium">วิธีประมวลผลหลายแหล่ง</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={combineMode === "merge" ? "default" : "outline"}
                      className="h-auto py-2.5 flex-col gap-1 items-start text-left"
                      onClick={() => setCombineMode("merge")}
                    >
                      <span className="flex items-center gap-1.5 text-sm font-medium"><Layers className="w-4 h-4" />รวมเป็นเรื่องเดียว</span>
                      <span className="text-[11px] font-normal opacity-80 leading-tight">หลอมทุกแหล่งเป็นนิยายเรื่องเดียวที่ต่อเนื่อง</span>
                    </Button>
                    <Button
                      variant={combineMode === "separate" ? "default" : "outline"}
                      className="h-auto py-2.5 flex-col gap-1 items-start text-left"
                      onClick={() => setCombineMode("separate")}
                    >
                      <span className="flex items-center gap-1.5 text-sm font-medium"><Files className="w-4 h-4" />แปลแยกแต่ละชิ้น</span>
                      <span className="text-[11px] font-normal opacity-80 leading-tight">ดัดแปลงแยกเป็นคนละตอน</span>
                    </Button>
                  </div>
                </div>
              )}

              <Button className="w-full gap-2 h-11" onClick={handleTranslate} disabled={filledSources.length === 0}>
                <Languages className="w-4 h-4" />
                แปลเป็นภาษาไทย ({filledSources.length} แหล่ง) →
              </Button>
            </div>
          )}

          {/* Step 1: แปล */}
          {step === 1 && (
            <div className="space-y-4">
              {translating ? (
                <div className="flex flex-col items-center py-12 text-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">กำลังตรวจจับภาษาและแปล {filledSources.length} แหล่งเป็นไทย...</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {translations.map((t, i) => (
                      <div key={i}>
                        <label className="text-sm font-medium mb-1.5 block flex items-center justify-between">
                          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" />คำแปล: {t.title}</span>
                          <Badge variant="outline" className="text-xs">{countWords(t.text).toLocaleString()} คำ</Badge>
                        </label>
                        <Textarea
                          value={t.text}
                          onChange={(e) => setTranslations((arr) => arr.map((x, idx) => (idx === i ? { ...x, text: e.target.value } : x)))}
                          className="min-h-[140px] text-sm resize-none"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="bg-secondary/40 rounded-xl border border-border/50 p-4 space-y-3">
                    <p className="text-sm font-medium flex items-center gap-1.5"><Wand2 className="w-4 h-4 text-primary" />ตั้งค่าการดัดแปลงเป็นเนื้อเรื่อง</p>
                    {translations.length > 1 && (
                      <p className="text-xs text-muted-foreground">
                        โหมด: {combineMode === "merge" ? "รวมทุกแหล่งเป็นเรื่องเดียว" : "ดัดแปลงแยกเป็นคนละตอน"}
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">แนวเรื่อง</label>
                        <Select value={genre} onValueChange={setGenre}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>{GENRES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">โทน/อารมณ์</label>
                        <Select value={tone} onValueChange={setTone}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>{TONES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-muted-foreground mb-1 block">ความยาว{combineMode === "separate" && translations.length > 1 ? " (ต่อชิ้น)" : ""}</label>
                        <Select value={String(wordTarget)} onValueChange={(v) => setWordTarget(Number(v))}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>{LENGTHS.map((l) => <SelectItem key={l.value} value={String(l.value)}>{l.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setStep(0)} disabled={adapting}>ย้อนกลับ</Button>
                    <Button className="flex-[2] gap-2" onClick={handleAdapt} disabled={adapting || translations.every((t) => !t.text.trim())}>
                      {adapting ? <><Loader2 className="w-4 h-4 animate-spin" />{adaptProgress || "กำลังดัดแปลง..."}</> : <><Sparkles className="w-4 h-4" />ดัดแปลงเป็นเนื้อเรื่อง →</>}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 2: ดัดแปลง + บันทึก */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-3">
                {drafts.map((d, i) => (
                  <div key={i}>
                    <label className="text-sm font-medium mb-1.5 block flex items-center justify-between">
                      <span className="flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-primary" />{drafts.length > 1 ? `ตอน: ${d.title}` : "ร่างเนื้อเรื่องที่ดัดแปลง (แก้ไขได้)"}</span>
                      <Badge variant="outline" className="text-xs">{countWords(d.content).toLocaleString()} คำ</Badge>
                    </label>
                    <Textarea value={d.content} onChange={(e) => updateDraft(i, { content: e.target.value })} className="min-h-[200px] text-sm resize-none" />
                  </div>
                ))}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" onClick={handleAdapt} disabled={adapting}>
                    {adapting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}สร้างใหม่ทั้งหมด
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    className="h-8 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                    onClick={handleSaveProject}
                    disabled={savingProject || drafts.every((d) => !d.content.trim())}
                  >
                    {savingProject ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bookmark className="w-3 h-3" />}บันทึกงานแปลเข้าคลัง
                  </Button>
                </div>
              </div>

              <div className="bg-secondary/40 rounded-xl border border-border/50 p-4 space-y-3">
                <p className="text-sm font-medium flex items-center gap-1.5"><Save className="w-4 h-4 text-primary" />บันทึกเข้าโปรเจกต์ {drafts.length > 1 && <span className="text-xs font-normal text-muted-foreground">({drafts.length} ตอน)</span>}</p>
                <div className="flex gap-2">
                  <Button variant={saveMode === "new" ? "default" : "outline"} className="flex-1 h-10" onClick={() => setSaveMode("new")}>📖 นิยายใหม่</Button>
                  <Button variant={saveMode === "existing" ? "default" : "outline"} className="flex-1 h-10" onClick={() => setSaveMode("existing")}>📁 นิยายที่มีอยู่</Button>
                </div>
                {saveMode === "new" ? (
                  <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="ชื่อนิยายใหม่" className="h-10" />
                ) : (
                  <Select value={targetNovelId} onValueChange={setTargetNovelId}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="เลือกนิยายปลายทาง (เพิ่มเป็นตอนใหม่)" /></SelectTrigger>
                    <SelectContent>{novels.map((n) => <SelectItem key={n.id} value={n.id}>{n.title}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(1)} disabled={saving}>ย้อนกลับ</Button>
                <Button
                  className="flex-[2] gap-2"
                  onClick={handleSave}
                  disabled={saving || drafts.every((d) => !d.content.trim()) || (saveMode === "new" ? !newTitle.trim() : !targetNovelId)}
                >
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" />กำลังบันทึก...</> : <><Save className="w-4 h-4" />บันทึกเข้าโปรเจกต์</>}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: เสร็จ */}
          {step === 3 && (
            <div className="flex flex-col items-center py-10 text-center">
              <div className="w-16 h-16 rounded-2xl bg-green-100 dark:bg-green-900/20 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-heading font-semibold mb-2">บันทึกสำเร็จ!</h3>
              <p className="text-sm text-muted-foreground mb-6">เนื้อเรื่องที่ดัดแปลงถูกบันทึก{drafts.length > 1 ? `เป็น ${drafts.length} ตอน` : "เป็นตอนใหม่"}ในโปรเจกต์แล้ว</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="outline" className="gap-1.5" onClick={handleSaveProject} disabled={savingProject}>
                  {savingProject ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bookmark className="w-4 h-4" />}บันทึกงานแปลเข้าคลัง
                </Button>
                <Button variant="outline" onClick={() => { reset(); }}>ดัดแปลงอีกชุด</Button>
                <Button onClick={handleClose}>ปิด</Button>
              </div>
            </div>
          )}
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
}