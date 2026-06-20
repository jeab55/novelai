import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Languages, Link2, FileText, Upload, Loader2, CheckCircle2, Sparkles, Wand2, Save, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { invokeAIStable } from "@/lib/aiInvoke";

const GENRES = ["โรแมนติก", "แฟนตาซี", "อิงประวัติศาสตร์", "จีนย้อนยุค", "วาย", "สยองขวัญ", "ลึกลับ", "แอ็คชั่น", "ดราม่า", "อื่นๆ"];
const TONES = ["ดราม่าเข้มข้น", "อบอุ่นซึ้งกินใจ", "ลึกลับชวนติดตาม", "สนุกสดใส", "โศกเศร้าสะเทือนใจ", "ตื่นเต้นเร้าใจ", "โรแมนติกหวานซึ้ง"];
const LENGTHS = [
  { value: 800, label: "สั้น (~800 คำ)" },
  { value: 1500, label: "ปานกลาง (~1,500 คำ)" },
  { value: 2500, label: "ยาว (~2,500 คำ)" },
  { value: 4000, label: "ยาวมาก (~4,000 คำ)" },
];

const STEPS = ["นำเข้า", "แปล", "ดัดแปลง", "บันทึก"];

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
  const [step, setStep] = useState(0);

  // import
  const [inputMode, setInputMode] = useState("text"); // text | url | file
  const [sourceText, setSourceText] = useState("");
  const [url, setUrl] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [fetching, setFetching] = useState(false);
  const [uploading, setUploading] = useState(false);

  // translate
  const [translating, setTranslating] = useState(false);
  const [translation, setTranslation] = useState("");

  // adapt
  const [genre, setGenre] = useState("โรแมนติก");
  const [tone, setTone] = useState("ดราม่าเข้มข้น");
  const [wordTarget, setWordTarget] = useState(1500);
  const [adapting, setAdapting] = useState(false);
  const [adapted, setAdapted] = useState("");

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

  const reset = () => {
    setStep(0);
    setInputMode("text");
    setSourceText(""); setUrl(""); setSourceTitle("");
    setTranslation(""); setAdapted("");
    setGenre("โรแมนติก"); setTone("ดราม่าเข้มข้น"); setWordTarget(1500);
    setSaveMode("new"); setNewTitle(""); setTargetNovelId("");
  };

  const handleClose = () => {
    if (translating || adapting || saving || fetching || uploading) return;
    reset();
    onClose();
  };

  const handleFetchUrl = async () => {
    if (!url.trim()) return;
    setFetching(true);
    try {
      const res = await base44.functions.invoke("fetchUrlContent", { url: url.trim() });
      const data = res.data;
      if (!data || data.error) throw new Error(data?.error || "ดึงเนื้อหาไม่สำเร็จ");
      setSourceText(data.text);
      if (data.title && !sourceTitle) setSourceTitle(data.title);
      toast.success(`ดึงเนื้อหาสำเร็จ: ${data.character_count.toLocaleString()} ตัวอักษร`);
    } catch (e) {
      toast.error(e.message || "ดึงเนื้อหาจากลิงก์ไม่สำเร็จ");
    } finally {
      setFetching(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = [".txt", ".md", ".docx", ".pdf"];
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!validTypes.includes(ext)) {
      toast.error("รองรับ: TXT, MD, DOCX, PDF");
      e.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("ไฟล์ใหญ่เกินไป (สูงสุด 5MB)");
      e.target.value = "";
      return;
    }
    setUploading(true);
    try {
      const reader = new FileReader();
      const b64 = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await base44.functions.invoke("extractTextFromFile", {
        file_name: file.name,
        file_type: file.type,
        file_data: b64,
      });
      const data = res.data;
      if (!data || data.error) throw new Error(data?.error || "อ่านไฟล์ไม่สำเร็จ");
      setSourceText(data.text);
      if (!sourceTitle) setSourceTitle(file.name.replace(/\.[^.]+$/, ""));
      toast.success(`อ่านไฟล์สำเร็จ: ${data.character_count.toLocaleString()} ตัวอักษร`);
      e.target.value = "";
    } catch (err) {
      toast.error(err.message || "อ่านไฟล์ไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  };

  const handleTranslate = async () => {
    if (!sourceText.trim()) {
      toast.error("กรุณาใส่เนื้อหาต้นทางก่อน");
      return;
    }
    setTranslating(true);
    setStep(1);
    try {
      const prompt = `คุณคือนักแปลมืออาชีพ จงตรวจจับภาษาต้นทางอัตโนมัติ แล้วแปลข้อความต่อไปนี้เป็น "ภาษาไทย" ที่เป็นธรรมชาติ สละสลวย รักษาความหมาย อารมณ์ และโครงสร้างย่อหน้า/บรรทัด (เช่น เนื้อเพลงให้คงการขึ้นบรรทัด) ไว้ให้ครบถ้วน

ห้ามเพิ่มคำอธิบายหรือความเห็น ให้ส่งเฉพาะคำแปลภาษาไทยเท่านั้น

ข้อความต้นทาง:
"""
${sourceText.slice(0, 12000)}
"""

คำแปลภาษาไทย:`;
      const result = await invokeAIStable({ prompt, model: "claude_sonnet_4_6" });
      setTranslation((result || "").trim());
    } catch (e) {
      toast.error("แปลไม่สำเร็จ: " + (e.message || ""));
      setStep(0);
    } finally {
      setTranslating(false);
    }
  };

  const handleAdapt = async () => {
    if (!translation.trim()) return;
    setAdapting(true);
    try {
      const writerPrompt = writers.find((w) => w.is_active !== false)?.system_prompt || "";
      const prompt = `${writerPrompt ? `[สไตล์การเขียน]\n${writerPrompt}\n\n` : ""}คุณคือนักเขียนนิยายมืออาชีพ จงนำ "เนื้อหาที่แปลแล้ว" ด้านล่างมาดัดแปลงและเรียบเรียงใหม่ให้กลายเป็น "เนื้อเรื่องนิยาย" ที่อ่านลื่นไหล มีบรรยากาศ มีการบรรยายฉาก อารมณ์ และมุมมองตัวละคร

[ข้อกำหนด]
- แนวเรื่อง: ${genre}
- โทน/อารมณ์: ${tone}
- ความยาวประมาณ: ${wordTarget} คำ (±15%)
- เขียนเป็นร้อยแก้วนิยายภาษาไทย ไม่ใช่การแปลตรงตัว
- รักษาแก่นเนื้อหาและความหมายเดิมไว้ แต่เพิ่มชั้นเชิงวรรณศิลป์
- ส่งเฉพาะเนื้อเรื่องที่ดัดแปลงแล้ว ไม่ต้องมีคำนำหรือหัวข้อ

[เนื้อหาที่แปลแล้ว]
"""
${translation.slice(0, 12000)}
"""

[เนื้อเรื่องนิยายที่ดัดแปลงแล้ว]`;
      const result = await invokeAIStable({ prompt, model: "claude_sonnet_4_6" });
      setAdapted((result || "").trim());
      setStep(2);
    } catch (e) {
      toast.error("ดัดแปลงไม่สำเร็จ: " + (e.message || ""));
    } finally {
      setAdapting(false);
    }
  };

  const handleSave = async () => {
    if (!adapted.trim()) return;
    setSaving(true);
    try {
      let novelId = targetNovelId;
      const chapterTitle = sourceTitle.trim() || "ตอนที่ดัดแปลง";

      if (saveMode === "new") {
        if (!newTitle.trim()) {
          toast.error("กรุณาใส่ชื่อเรื่อง");
          setSaving(false);
          return;
        }
        const novel = await base44.entities.Novel.create({
          title: newTitle.trim(),
          genre,
          synopsis: translation.slice(0, 300),
        });
        novelId = novel.id;
      }

      if (!novelId) {
        toast.error("กรุณาเลือกนิยายปลายทาง");
        setSaving(false);
        return;
      }

      const existing = await base44.entities.Chapter.filter({ novel_id: novelId });
      const maxOrder = existing.reduce((m, c) => Math.max(m, c.order || 0), 0);
      await base44.entities.Chapter.create({
        novel_id: novelId,
        title: chapterTitle,
        content: adapted,
        order: maxOrder + 1,
        word_count: countWords(adapted),
        status: "ร่าง",
      });

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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Languages className="w-5 h-5 text-primary" />
            แปลและดัดแปลงเป็นเนื้อเรื่อง
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
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

        <div className="flex-1 overflow-y-auto min-h-0 pr-1">
          {/* Step 0: นำเข้า */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { v: "text", icon: FileText, label: "วางข้อความ" },
                  { v: "url", icon: Link2, label: "ลิงก์ URL" },
                  { v: "file", icon: Upload, label: "อัปโหลดไฟล์" },
                ].map(({ v, icon: Icon, label }) => (
                  <Button
                    key={v}
                    variant={inputMode === v ? "default" : "outline"}
                    className="h-11 gap-1.5 text-sm"
                    onClick={() => setInputMode(v)}
                  >
                    <Icon className="w-4 h-4" />{label}
                  </Button>
                ))}
              </div>

              {inputMode === "url" && (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">ลิงก์บทความ / เนื้อเพลง</label>
                  <div className="flex gap-2">
                    <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className="flex-1" />
                    <Button onClick={handleFetchUrl} disabled={fetching || !url.trim()}>
                      {fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : "ดึงเนื้อหา"}
                    </Button>
                  </div>
                </div>
              )}

              {inputMode === "file" && (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">อัปโหลดไฟล์ (TXT, MD, DOCX, PDF · สูงสุด 5MB)</label>
                  <div className="flex items-center gap-2">
                    <Input type="file" accept=".txt,.md,.docx,.pdf" onChange={handleFileUpload} disabled={uploading} className="flex-1 text-sm" />
                    {uploading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium mb-1.5 block flex items-center justify-between">
                  <span>เนื้อหาต้นทาง {inputMode !== "text" && <span className="text-xs font-normal text-muted-foreground">(แก้ไขได้)</span>}</span>
                  {sourceText.trim() && <Badge variant="outline" className="text-xs">{sourceText.length.toLocaleString()} ตัวอักษร</Badge>}
                </label>
                <Textarea
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                  placeholder="วางเนื้อเพลงหรือบทความภาษาใดก็ได้ที่นี่ ระบบจะตรวจจับภาษาต้นทางและแปลเป็นไทยให้อัตโนมัติ..."
                  className="min-h-[180px] text-sm resize-none"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">ชื่อต้นฉบับ (ไม่บังคับ — ใช้เป็นชื่อตอน)</label>
                <Input value={sourceTitle} onChange={(e) => setSourceTitle(e.target.value)} placeholder="เช่น ชื่อเพลง / ชื่อบทความ" className="text-sm" />
              </div>

              <Button className="w-full gap-2 h-11" onClick={handleTranslate} disabled={!sourceText.trim()}>
                <Languages className="w-4 h-4" />
                แปลเป็นภาษาไทย →
              </Button>
            </div>
          )}

          {/* Step 1: แปล */}
          {step === 1 && (
            <div className="space-y-4">
              {translating ? (
                <div className="flex flex-col items-center py-12 text-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">กำลังตรวจจับภาษาและแปลเป็นไทย...</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block flex items-center justify-between">
                      <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" />คำแปลภาษาไทย (แก้ไขได้)</span>
                      <Badge variant="outline" className="text-xs">{countWords(translation).toLocaleString()} คำ</Badge>
                    </label>
                    <Textarea value={translation} onChange={(e) => setTranslation(e.target.value)} className="min-h-[220px] text-sm resize-none" />
                  </div>

                  <div className="bg-secondary/40 rounded-xl border border-border/50 p-4 space-y-3">
                    <p className="text-sm font-medium flex items-center gap-1.5"><Wand2 className="w-4 h-4 text-primary" />ตั้งค่าการดัดแปลงเป็นเนื้อเรื่อง</p>
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
                        <label className="text-xs text-muted-foreground mb-1 block">ความยาว</label>
                        <Select value={String(wordTarget)} onValueChange={(v) => setWordTarget(Number(v))}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>{LENGTHS.map((l) => <SelectItem key={l.value} value={String(l.value)}>{l.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setStep(0)} disabled={adapting}>ย้อนกลับ</Button>
                    <Button className="flex-[2] gap-2" onClick={handleAdapt} disabled={adapting || !translation.trim()}>
                      {adapting ? <><Loader2 className="w-4 h-4 animate-spin" />กำลังดัดแปลง...</> : <><Sparkles className="w-4 h-4" />ดัดแปลงเป็นเนื้อเรื่อง →</>}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 2: ดัดแปลง + บันทึก */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-primary" />ร่างเนื้อเรื่องที่ดัดแปลง (แก้ไขได้)</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{countWords(adapted).toLocaleString()} คำ</Badge>
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleAdapt} disabled={adapting}>
                      {adapting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}สร้างใหม่
                    </Button>
                  </div>
                </label>
                <Textarea value={adapted} onChange={(e) => setAdapted(e.target.value)} className="min-h-[240px] text-sm resize-none" />
              </div>

              <div className="bg-secondary/40 rounded-xl border border-border/50 p-4 space-y-3">
                <p className="text-sm font-medium flex items-center gap-1.5"><Save className="w-4 h-4 text-primary" />บันทึกเข้าโปรเจกต์</p>
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
                  disabled={saving || !adapted.trim() || (saveMode === "new" ? !newTitle.trim() : !targetNovelId)}
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
              <p className="text-sm text-muted-foreground mb-6">เนื้อเรื่องที่ดัดแปลงถูกบันทึกเป็นตอนใหม่ในโปรเจกต์แล้ว</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { reset(); }}>ดัดแปลงอีกชิ้น</Button>
                <Button onClick={handleClose}>ปิด</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}