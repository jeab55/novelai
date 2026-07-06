import React, { useState, useMemo, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { BookPlus, ChevronRight, Scissors, FileText, CheckCircle2, Loader2, ChevronDown, ChevronUp, Upload, File } from "lucide-react";
import { toast } from "sonner";

// ค้นหา delimiter ที่เป็น "ตอนที่" / "บทที่" / "Chapter" ฯลฯ
const CHAPTER_PATTERNS = [
  /^(ตอนที่\s*\d+[^\n]*)/gm,
  /^(บทที่\s*\d+[^\n]*)/gm,
  /^(Chapter\s*\d+[^\n]*)/gim,
  /^(ตอน\s*\d+[^\n]*)/gm,
  /^(เล่ม\s*\d+[^\n]*)/gm,
  /^(ภาค\s*\d+[^\n]*)/gm,
  /^(\d+\.\s*[^\n]+)/gm,  // 1. Chapter Title
  /^(---+\s*$)/gm,        // --- separator
  /^(===+\s*$)/gm,        // === separator
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

  // auto-detect: ลองทุก pattern
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
  const [uploading, setUploading] = useState(false);

  // step 2: settings
  const [mode, setMode] = useState("new"); // "new" | "existing"
  const [novelTitle, setNovelTitle] = useState("");
  const [novelGenre, setNovelGenre] = useState("โรแมนติก");
  const [targetNovelId, setTargetNovelId] = useState("");
  const [targetSeriesId, setTargetSeriesId] = useState("");

  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);

  const genres = ["โรแมนติก","แฟนตาซี","อิงประวัติศาสตร์","จีนย้อนยุค","วาย","สยองขวัญ","ลึกลับ","แอ็คชั่น","ดราม่า","ยูริ","โรแมนซ์คอมเมดี้","ดาร์กโรแมนซ์","โรแมนซ์แฟนตาซี","ชีวิต","ต่างโลก-เกิดใหม่","ไซไฟ","สืบสวนสอบสวน","ระทึกขวัญ","ผจญภัย","กำลังภายใน","วัยรุ่น","อื่นๆ"];

  // Debug: log seriesList when dialog opens
  React.useEffect(() => {
    if (open) {
      console.log('📋 ImportNovelDialog opened - seriesList:', seriesList, 'novels:', novels);
    }
  }, [open, seriesList, novels]);

  const handleSplit = () => {
    const result = detectAndSplit(rawText, customDelimiter);
    // ตั้งชื่อตอนอัตโนมัติถ้าไม่มีชื่อ
    const chaptersWithNames = result.map((ch, i) => ({
      ...ch,
      title: ch.title?.trim() ? ch.title.trim() : `ตอนที่ ${i + 1}`
    }));
    setChapters(chaptersWithNames);
    setStep(1);
  };

  const handleImport = async () => {
    if (importing) return;
    console.log('🚀 Starting import...', { mode, novelTitle, targetSeriesId, targetNovelId, chapters: chapters.length });
    setImporting(true);
    try {
      let novelId = targetNovelId;

      if (mode === "new") {
        if (!novelTitle.trim()) {
          toast.error("กรุณาใส่ชื่อนิยาย");
          setImporting(false);
          return;
        }
        if (!targetSeriesId) {
          toast.error("กรุณาเลือกซีรีย์");
          setImporting(false);
          return;
        }
        console.log('📖 Creating new novel...', novelTitle);
        const novel = await base44.entities.Novel.create({
          title: novelTitle.trim(),
          genre: novelGenre,
          series_id: targetSeriesId,
        });
        novelId = novel.id;
        console.log('✅ Novel created:', novelId);
        queryClient.invalidateQueries({ queryKey: ["novels-for-series"] });
      }

      if (!novelId) {
        toast.error("กรุณาเลือกนิยาย");
        setImporting(false);
        return;
      }

      // หา max order ปัจจุบัน
      console.log('📋 Fetching existing chapters...');
      const existing = await base44.entities.Chapter.filter({ novel_id: novelId });
      const maxOrder = existing.reduce((m, c) => Math.max(m, c.order || 0), 0);
      console.log('📊 Max order:', maxOrder);

      console.log('✍️ Creating chapters...');
      for (let i = 0; i < chapters.length; i++) {
        const ch = chapters[i];
        const wc = countWords(ch.content);
        console.log(`  📝 Chapter ${i + 1}: ${ch.title} (${wc} คำ)`);
        await base44.entities.Chapter.create({
          novel_id: novelId,
          title: ch.title,
          content: ch.content,
          order: maxOrder + i + 1,
          word_count: wc,
          status: "ร่าง",
        });
      }

      console.log('🎉 Import complete!');
      queryClient.invalidateQueries({ queryKey: ["chapters-all"] });
      queryClient.invalidateQueries({ queryKey: ["chapters", novelId] });
      setDone(true);
      setStep(3);
      toast.success(`นำเข้า ${chapters.length} ตอนเรียบร้อยแล้ว!`);
    } catch (e) {
      console.error('❌ Import error:', e);
      toast.error("เกิดข้อผิดพลาด: " + (e.message || JSON.stringify(e)));
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
      setTargetSeriesId("");
      setDone(false);
      setExpandedIdx(null);
      onClose();
    }
  };

  const totalWords = useMemo(() => chapters.reduce((s, c) => s + countWords(c.content), 0), [chapters]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['.txt', '.md', '.docx', '.pdf'];
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!validTypes.includes(fileExt)) {
      toast.error("รูปแบบไฟล์ไม่รองรับ (รองรับ: TXT, MD, DOCX, PDF)");
      e.target.value = "";
      return;
    }

    // ตรวจสอบขนาดไฟล์ (สูงสุด 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error(`ไฟล์ใหญ่เกินไป (สูงสุด 5MB) - ไฟล์นี้ ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      e.target.value = "";
      return;
    }

    setUploading(true);
    
    try {
      // อ่านไฟล์เป็น base64
      const reader = new FileReader();
      const base64Promise = new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
      });
      
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;
      
      // เรียกใช้ backend function ผ่าน base44Client
      const response = await base44.functions.invoke('extractTextFromFile', {
        file_name: file.name,
        file_type: file.type,
        file_data: base64Data
      });
      
      const result = response.data;
      
      if (!result || result.error) {
        throw new Error(result?.error || 'เกิดข้อผิดพลาดในการอ่านไฟล์');
      }
      
      setRawText(result.text);
      toast.success(`อ่านไฟล์สำเร็จ: ${result.character_count.toLocaleString()} ตัวอักษร`);
      e.target.value = "";
    } catch (err) {
      console.error('File upload error:', err);
      toast.error(err.message || 'เกิดข้อผิดพลาดในการอ่านไฟล์');
      setRawText("");
    } finally {
      setUploading(false);
    }
  };

  const handleFileUploaded = () => {
    console.log('File uploaded, rawText length:', rawText.length);
    if (rawText.trim()) {
      const result = detectAndSplit(rawText, customDelimiter);
      console.log('Split result:', result.length, 'chapters');
      // ตั้งชื่อตอนอัตโนมัติถ้าไม่มีชื่อ
      const chaptersWithNames = result.map((ch, i) => ({
        ...ch,
        title: ch.title?.trim() ? ch.title.trim() : `ตอนที่ ${i + 1}`
      }));
      console.log('Chapters with names:', chaptersWithNames);
      setChapters(chaptersWithNames);
      setStep(1);
      toast.success(`แบ่งตอนแล้ว: ${chaptersWithNames.length} ตอน`);
    } else {
      console.error('No raw text!');
      toast.error("กรุณาใส่ข้อความหรืออัพโหลดไฟล์ก่อน");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <BookPlus className="w-5 h-5 text-primary" />
            นำเข้านิยายจากไฟล์หรือข้อความ
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
                <label className="text-sm font-medium mb-1.5 block flex items-center justify-between">
                  <span>วางข้อความนิยายที่นี่</span>
                  <span className="text-xs font-normal text-muted-foreground">หรือ</span>
                </label>
                
                {/* File upload section */}
                <div className="mb-3">
                  <label className="block text-xs text-muted-foreground mb-1.5">อัพโหลดไฟล์</label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept=".txt,.md,.docx,.pdf"
                      onChange={handleFileUpload}
                      disabled={uploading}
                      className="flex-1 text-sm"
                    />
                    {uploading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    รองรับ: TXT, MD, DOCX, PDF (สูงสุด 5MB)
                  </p>
                  {uploading && (
                    <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>กำลังอ่านไฟล์...</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-background px-2 text-muted-foreground">หรือวางข้อความด้วยตนเอง</span>
                  </div>
                </div>

                <Textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={rawText ? "" : `วางเนื้อหานิยายทั้งหมดจากแหล่งอื่นที่นี่...\n\nรูปแบบที่ระบบแบ่งตอนอัตโนมัติ:\n• ตอนที่ 1, ตอนที่ 2, ...\n• บทที่ 1, บทที่ 2, ...\n• Chapter 1, Chapter 2, ...\n• 1. Chapter Title\n• --- หรือ === (ตัวคั่น)\n\nระบบจะตรวจจับและแบ่งให้อัตโนมัติ`}
                  className={`min-h-[200px] font-mono text-sm resize-none ${rawText.trim() ? 'border-primary/50 ring-2 ring-primary/20' : ''}`}
                  readOnly={false}
                />
                
                {rawText.trim() && !uploading && (
                  <div className="mt-4 space-y-3">
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border-2 border-green-300 dark:border-green-700 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                          <span className="text-base font-semibold text-green-800 dark:text-green-300">พร้อมนำเข้าไฟล์</span>
                        </div>
                        <Badge className="bg-green-600 text-white">{rawText.length.toLocaleString()} ตัวอักษร</Badge>
                      </div>
                      <div className="text-sm text-green-700 dark:text-green-400 bg-white/60 dark:bg-green-900/30 rounded-lg p-3 font-mono line-clamp-3">
                        {rawText.slice(0, 400)}...
                      </div>
                    </div>
                    
                    <Button
                      className="w-full h-14 text-lg font-bold shadow-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all"
                      onClick={() => {
                        console.log('Process button clicked!');
                        handleFileUploaded();
                      }}
                      size="lg"
                    >
                      <FileText className="w-5 h-5" />
                      เริ่มประมวลผลและแบ่งตอน →
                    </Button>
                  </div>
                )}
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
              <Button className="w-full h-12 text-base font-semibold shadow-lg bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70" onClick={() => setStep(2)}>
                <ChevronRight className="w-5 h-5" />
                ถัดไป: ตั้งค่านิยาย →
              </Button>
            </div>
          )}

          {/* Step 2: ตั้งค่า */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="flex gap-2">
                <Button
                  variant={mode === "new" ? "default" : "outline"}
                  className="flex-1 h-11"
                  onClick={() => setMode("new")}
                >
                  📖 สร้างนิยายใหม่
                </Button>
                <Button
                  variant={mode === "existing" ? "default" : "outline"}
                  className="flex-1 h-11"
                  onClick={() => setMode("existing")}
                >
                  📁 เพิ่มในนิยายที่มีอยู่
                </Button>
              </div>

              {mode === "new" ? (
                <>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block text-primary">📝 ชื่อนิยาย *</label>
                    <Input
                      value={novelTitle}
                      onChange={(e) => setNovelTitle(e.target.value)}
                      placeholder="ใส่ชื่อนิยาย"
                      className="h-11 text-base"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">🎭 แนว</label>
                    <Select value={novelGenre} onValueChange={setNovelGenre}>
                      <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {genres.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block text-primary">📚 ซีรีย์ *</label>
                    <Select value={targetSeriesId} onValueChange={(v) => {
                      console.log('Series selected:', v);
                      setTargetSeriesId(v);
                    }}>
                      <SelectTrigger className={`h-11 ${!targetSeriesId ? 'border-red-500 ring-2 ring-red-500/20' : ''}`}>
                        <SelectValue placeholder="เลือกซีรีย์" />
                      </SelectTrigger>
                      <SelectContent>
                        {seriesList.map((s) => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {!targetSeriesId && (
                      <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                        <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                          ⚠️ กรุณาเลือกซีรีย์ก่อน (จำเป็น)
                        </p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">📁 เลือกนิยาย</label>
                  <Select value={targetNovelId} onValueChange={setTargetNovelId}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="เลือกนิยายปลายทาง" /></SelectTrigger>
                    <SelectContent>
                      {novels.map((n) => <SelectItem key={n.id} value={n.id}>{n.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1.5">ตอนที่นำเข้าจะถูกเพิ่มต่อจากตอนที่มีอยู่แล้ว</p>
                </div>
              )}

              <div className="bg-primary/5 rounded-xl border-2 border-primary/20 p-4 text-sm space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">📄 จำนวนตอน</span>
                  <span className="font-bold text-primary text-base">{chapters.length} ตอน</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">📊 รวมคำ</span>
                  <span className="font-bold text-primary text-base">{totalWords.toLocaleString()} คำ</span>
                </div>
              </div>

              {(mode === "new" && (!novelTitle.trim() || !targetSeriesId)) ? (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border-2 border-amber-200 dark:border-amber-800 text-center">
                  <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">
                    ⚠️ กรุณากรอกชื่อนิยายและเลือกซีรีย์ก่อนนำเข้า
                  </p>
                </div>
              ) : (mode === "existing" && !targetNovelId) ? (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border-2 border-amber-200 dark:border-amber-800 text-center">
                  <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">
                    ⚠️ กรุณาเลือกนิยายปลายทางก่อนนำเข้า
                  </p>
                </div>
              ) : null}

              <Button
                className="w-full h-16 text-xl font-bold shadow-2xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => {
                  console.log('🔘 Import button clicked!', { mode, novelTitle, targetSeriesId, targetNovelId, chapters: chapters.length });
                  handleImport();
                }}
                disabled={importing || (mode === "new" && (!novelTitle.trim() || !targetSeriesId)) || (mode === "existing" && !targetNovelId)}
                size="lg"
              >
                {importing ? (
                  <><Loader2 className="w-6 h-6 animate-spin" />กำลังนำเข้า...</>
                ) : (
                  <><FileText className="w-6 h-6" />นำเข้า {chapters.length} ตอน →</>
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