import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { BookPlus, ChevronRight, Scissors, FileText, CheckCircle2, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

// ค้นหา delimiter ที่เป็น "ตอนที่" / "บทที่" / "Chapter" ฯลฯ
const CHAPTER_PATTERNS = [
  /^(ตอนที่\s*\d+[^\n]*)/m,
  /^(บทที่\s*\d+[^\n]*)/m,
  /^(Chapter\s*\d+[^\n]*)/im,
  /^(ตอน\s*\d+[^\n]*)/m,
  /^(เล่ม\s*\d+[^\n]*)/m,
  /^(ภาค\s*\d+[^\n]*)/m,
];

function detectAndSplit(text, customDelimiter) {
  if (customDelimiter && customDelimiter.trim()) {
    const regex = new RegExp(`(${customDelimiter.trim()})`, "gm");
    const parts = text.split(regex).filter(Boolean);
    const chapters = [];
    let i = 0;
    while (i < parts.length) {
      const isHeader = regex.test(parts[i]);
      regex.lastIndex = 0;
      if (isHeader) {
        const title = parts[i].trim();
        const content = parts[i + 1] ? parts[i + 1].trim() : "";
        chapters.push({ title, content });
        i += 2;
      } else {
        i++;
      }
    }
    return chapters.length > 0 ? chapters : [{ title: "ตอนที่ 1", content: text.trim() }];
  }

  // auto-detect
  for (const pattern of CHAPTER_PATTERNS) {
    const globalPattern = new RegExp(pattern.source, "gm");
    const matches = [...text.matchAll(globalPattern)];
    if (matches.length >= 2) {
      const chapters = [];
      for (let i = 0; i < matches.length; i++) {
        const start = matches[i].index + matches[i][0].length;
        const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
        chapters.push({
          title: matches[i][0].trim(),
          content: text.slice(start, end).trim(),
        });
      }
      return chapters;
    }
  }

  // fallback: ไม่พบ delimiter ให้เป็นตอนเดียว
  return [{ title: "ตอนที่ 1", content: text.trim() }];
}

function countWords(text) {
  if (!text) return 0;
  try {
    const seg = new Intl.Segmenter("th", { granularity: "word" });
    return [...seg.segment(text)].filter((s) => s.isWordLike).length;
  } catch {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }
}

const STEPS = ["ข้อความ", "ตรวจสอบ", "ตั้งค่า", "นำเข้า"];

export default function ImportNovelDialog({ open, onClose, novels = [], seriesList = [] }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [rawText, setRawText] = useState("");
  const [customDelimiter, setCustomDelimiter] = useState("");
  const [chapters, setChapters] = useState([]);
  const [expandedIdx, setExpandedIdx] = useState(null);

  // step 2: settings
  const [mode, setMode] = useState("new"); // "new" | "existing"
  const [novelTitle, setNovelTitle] = useState("");
  const [novelGenre, setNovelGenre] = useState("โรแมนติก");
  const [targetNovelId, setTargetNovelId] = useState("");
  const [targetSeriesId, setTargetSeriesId] = useState("__none__");

  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);

  const genres = ["โรแมนติก","แฟนตาซี","อิงประวัติศาสตร์","จีนย้อนยุค","วาย","สยองขวัญ","ลึกลับ","แอ็คชั่น","ดราม่า","อื่นๆ"];

  const handleSplit = () => {
    const result = detectAndSplit(rawText, customDelimiter);
    setChapters(result);
    setStep(1);
  };

  const handleImport = async () => {
    if (importing) return;
    setImporting(true);
    try {
      let novelId = targetNovelId;

      if (mode === "new") {
        if (!novelTitle.trim()) {
          toast.error("กรุณาใส่ชื่อนิยาย");
          setImporting(false);
          return;
        }
        const novel = await base44.entities.Novel.create({
          title: novelTitle.trim(),
          genre: novelGenre,
          series_id: targetSeriesId === "__none__" ? "" : targetSeriesId,
        });
        novelId = novel.id;
        queryClient.invalidateQueries({ queryKey: ["novels-for-series"] });
      }

      if (!novelId) {
        toast.error("กรุณาเลือกนิยาย");
        setImporting(false);
        return;
      }

      // หา max order ปัจจุบัน
      const existing = await base44.entities.Chapter.filter({ novel_id: novelId });
      const maxOrder = existing.reduce((m, c) => Math.max(m, c.order || 0), 0);

      for (let i = 0; i < chapters.length; i++) {
        const ch = chapters[i];
        const wc = countWords(ch.content);
        await base44.entities.Chapter.create({
          novel_id: novelId,
          title: ch.title || `ตอนที่ ${maxOrder + i + 1}`,
          content: ch.content,
          order: maxOrder + i + 1,
          word_count: wc,
          status: "ร่าง",
        });
      }

      queryClient.invalidateQueries({ queryKey: ["chapters-all"] });
      queryClient.invalidateQueries({ queryKey: ["chapters", novelId] });
      setDone(true);
      setStep(3);
      toast.success(`นำเข้า ${chapters.length} ตอนเรียบร้อยแล้ว!`);
    } catch (e) {
      toast.error("เกิดข้อผิดพลาด: " + e.message);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    if (!importing) {
      setStep(0);
      setRawText("");
      setCustomDelimiter("");
      setChapters([]);
      setNovelTitle("");
      setNovelGenre("โรแมนติก");
      setTargetNovelId("");
      setTargetSeriesId("__none__");
      setDone(false);
      setExpandedIdx(null);
      onClose();
    }
  };

  const totalWords = useMemo(() => chapters.reduce((s, c) => s + countWords(c.content), 0), [chapters]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <BookPlus className="w-5 h-5 text-primary" />
            นำเข้านิยายจากข้อความ
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-4">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                i === step ? "bg-primary text-primary-foreground" :
                i < step ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
              }`}>
                {i < step ? <CheckCircle2 className="w-3 h-3" /> : <span>{i + 1}</span>}
                {s}
              </div>
              {i < STEPS.length - 1 && <div className="w-4 h-px bg-border flex-shrink-0" />}
            </React.Fragment>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Step 0: วางข้อความ */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">วางข้อความนิยายที่นี่</label>
                <Textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={`วางเนื้อหานิยายทั้งหมด...\n\nตัวอย่างรูปแบบที่รองรับ:\n• ตอนที่ 1 ชื่อตอน\nเนื้อหา...\n• บทที่ 1\nเนื้อหา...\n• Chapter 1\nเนื้อหา...`}
                  className="min-h-[260px] font-mono text-sm resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {rawText.length > 0 ? `${rawText.length.toLocaleString()} ตัวอักษร` : "รองรับรูปแบบ ตอนที่ / บทที่ / Chapter โดยอัตโนมัติ"}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block flex items-center gap-1.5">
                  <Scissors className="w-3.5 h-3.5" />
                  ตัวคั่นตอน (ไม่บังคับ)
                </label>
                <Input
                  value={customDelimiter}
                  onChange={(e) => setCustomDelimiter(e.target.value)}
                  placeholder="เช่น 'ตอนที่' หรือ '---' หรือ 'Chapter'"
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">ถ้าไม่ระบุ ระบบจะตรวจจับอัตโนมัติ</p>
              </div>
              <Button
                className="w-full gap-2"
                onClick={handleSplit}
                disabled={!rawText.trim()}
              >
                <ChevronRight className="w-4 h-4" />
                แบ่งตอน
              </Button>
            </div>
          )}

          {/* Step 1: ตรวจสอบตอน */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  พบ <span className="font-semibold text-foreground">{chapters.length} ตอน</span> · รวม {totalWords.toLocaleString()} คำ
                </p>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setStep(0)}>
                  แก้ไขข้อความ
                </Button>
              </div>
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {chapters.map((ch, i) => (
                  <div key={i} className="border rounded-lg overflow-hidden">
                    <button
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
                      onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                    >
                      <span className="w-6 h-6 rounded-md bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <span className="flex-1 text-sm font-medium truncate">{ch.title}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{countWords(ch.content).toLocaleString()} คำ</span>
                      {expandedIdx === i ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                    </button>
                    {expandedIdx === i && (
                      <div className="px-3 pb-3 pt-0 border-t bg-muted/20">
                        <p className="text-xs text-muted-foreground whitespace-pre-line line-clamp-6 mt-2 leading-relaxed">
                          {ch.content || "(ไม่มีเนื้อหา)"}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <Button className="w-full gap-2" onClick={() => setStep(2)}>
                <ChevronRight className="w-4 h-4" />
                ถัดไป: ตั้งค่านิยาย
              </Button>
            </div>
          )}

          {/* Step 2: ตั้งค่า */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant={mode === "new" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setMode("new")}
                >
                  สร้างนิยายใหม่
                </Button>
                <Button
                  variant={mode === "existing" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setMode("existing")}
                >
                  เพิ่มในนิยายที่มีอยู่
                </Button>
              </div>

              {mode === "new" ? (
                <>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">ชื่อนิยาย *</label>
                    <Input
                      value={novelTitle}
                      onChange={(e) => setNovelTitle(e.target.value)}
                      placeholder="ใส่ชื่อนิยาย"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">แนว</label>
                    <Select value={novelGenre} onValueChange={setNovelGenre}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {genres.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">ซีรีย์ (ถ้ามี)</label>
                    <Select value={targetSeriesId} onValueChange={setTargetSeriesId}>
                      <SelectTrigger><SelectValue placeholder="เลือกซีรีย์" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— ไม่ระบุ —</SelectItem>
                        {seriesList.map((s) => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">เลือกนิยาย</label>
                  <Select value={targetNovelId} onValueChange={setTargetNovelId}>
                    <SelectTrigger><SelectValue placeholder="เลือกนิยายปลายทาง" /></SelectTrigger>
                    <SelectContent>
                      {novels.map((n) => <SelectItem key={n.id} value={n.id}>{n.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1.5">ตอนที่นำเข้าจะถูกเพิ่มต่อจากตอนที่มีอยู่แล้ว</p>
                </div>
              )}

              <div className="bg-muted/40 rounded-lg p-3 text-sm text-muted-foreground space-y-1">
                <div className="flex justify-between"><span>จำนวนตอน</span><span className="font-medium text-foreground">{chapters.length} ตอน</span></div>
                <div className="flex justify-between"><span>รวมคำ</span><span className="font-medium text-foreground">{totalWords.toLocaleString()} คำ</span></div>
              </div>

              <Button
                className="w-full gap-2"
                onClick={handleImport}
                disabled={importing || (mode === "new" && !novelTitle.trim()) || (mode === "existing" && !targetNovelId)}
              >
                {importing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />กำลังนำเข้า...</>
                ) : (
                  <><FileText className="w-4 h-4" />นำเข้า {chapters.length} ตอน</>
                )}
              </Button>
            </div>
          )}

          {/* Step 3: เสร็จ */}
          {step === 3 && (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-green-100 dark:bg-green-900/20 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-heading font-semibold mb-2">นำเข้าสำเร็จ!</h3>
              <p className="text-sm text-muted-foreground mb-6">
                นำเข้า <span className="font-semibold text-foreground">{chapters.length} ตอน</span> เรียบร้อยแล้ว
              </p>
              <Button onClick={handleClose}>ปิด</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}