import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Download, Copy, Check, Sparkles, Loader2, FileText,
  CheckCircle2, Circle, ChevronRight, ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import CopyButton from "@/components/ui/CopyButton";

// ---- Platform Configs ----
const PLATFORMS = [
  {
    id: "readawrite",
    name: "ReadAWrite",
    desc: "วางได้เลย ใช้ย่อหน้าเว้น 1 บรรทัดเปล่าระหว่างย่อหน้า หัวตอนเป็นข้อความธรรมดา",
    url: "https://www.readawrite.com",
    color: "border-rose-200 bg-rose-50/50 hover:border-rose-400",
    activeColor: "border-rose-500 bg-rose-50",
    badgeColor: "bg-rose-100 text-rose-700 border-rose-200",
    formatChapter: (ch) => {
      const title = `ตอนที่ ${ch.order}: ${ch.title}`;
      const body = formatParagraphsBlankLine(ch.content || "");
      return `${title}\n\n${body}`;
    },
  },
  {
    id: "dek-d",
    name: "เด็กดี",
    desc: "ใช้ย่อหน้าเว้น 1 บรรทัดเปล่า ไม่ใช้ markdown หัวตอนเป็นตัวหนาในรูปแบบ [ตอนที่ X]",
    url: "https://writer.dek-d.com",
    color: "border-amber-200 bg-amber-50/50 hover:border-amber-400",
    activeColor: "border-amber-500 bg-amber-50",
    badgeColor: "bg-amber-100 text-amber-700 border-amber-200",
    formatChapter: (ch) => {
      const title = `[ตอนที่ ${ch.order}: ${ch.title}]`;
      const body = formatParagraphsBlankLine(ch.content || "");
      return `${title}\n\n${body}`;
    },
  },
  {
    id: "thanyawalai",
    name: "ธัญวลัย",
    desc: "ใช้ย่อหน้าเว้น 1 บรรทัด หัวตอนรูปแบบ ◆ ตอนที่ X — ชื่อตอน ◆",
    url: "https://www.thanyawalai.com",
    color: "border-violet-200 bg-violet-50/50 hover:border-violet-400",
    activeColor: "border-violet-500 bg-violet-50",
    badgeColor: "bg-violet-100 text-violet-700 border-violet-200",
    formatChapter: (ch) => {
      const title = `◆ ตอนที่ ${ch.order} — ${ch.title} ◆`;
      const body = formatParagraphsBlankLine(ch.content || "");
      return `${title}\n\n${body}`;
    },
  },
  {
    id: "file",
    name: "ไฟล์ธรรมดา",
    desc: "ดาวน์โหลด .txt แยกตอนหรือรวมไฟล์เดียว รูปแบบสะอาด",
    url: null,
    color: "border-slate-200 bg-slate-50/50 hover:border-slate-400",
    activeColor: "border-slate-500 bg-slate-50",
    badgeColor: "bg-slate-100 text-slate-700 border-slate-200",
    formatChapter: (ch) => {
      const title = `ตอนที่ ${ch.order}: ${ch.title}`;
      const sep = "─".repeat(40);
      const body = formatParagraphsBlankLine(ch.content || "");
      return `${title}\n${sep}\n\n${body}`;
    },
  },
];

// แปลงเนื้อหาให้แบ่งย่อหน้าด้วยบรรทัดเปล่า
function formatParagraphsBlankLine(content) {
  return content
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .join("\n\n");
}

function safeFilename(name) {
  return (name || "untitled").replace(/[\\/:*?"<>|]/g, "_").trim();
}

function downloadTxt(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---- Tag suggestions by genre ----
const GENRE_TAGS = {
  "โรแมนติก": ["โรแมนติก", "รัก", "หวานซึ้ง", "CP", "ฟีล"],
  "แฟนตาซี": ["แฟนตาซี", "เวทมนตร์", "ต่างโลก", "ระบบพลัง", "ผจญภัย"],
  "อิงประวัติศาสตร์": ["อิงประวัติศาสตร์", "ย้อนยุค", "ราชสำนัก", "สมัยโบราณ"],
  "จีนย้อนยุค": ["จีนย้อนยุค", "ราชสำนักจีน", "ข้ามเวลา", "อิงประวัติศาสตร์", "วังต้องห้าม"],
  "วาย": ["วาย", "BL", "Y", "ชายรักชาย", "สายหวาน"],
  "สยองขวัญ": ["สยองขวัญ", "ฆาตกรรม", "ลึกลับ", "ระทึกขวัญ"],
  "ลึกลับ": ["ลึกลับ", "ระทึกขวัญ", "สืบสวน", "ปริศนา"],
  "แอ็คชั่น": ["แอ็คชั่น", "ต่อสู้", "มาเฟีย", "โหด", "เข้มข้น"],
  "ดราม่า": ["ดราม่า", "ชีวิต", "ครอบครัว", "อารมณ์"],
  "อื่นๆ": ["นิยาย", "ไทย", "อ่านฟรี"],
};

function getTagSuggestions(genre, synopsis) {
  const baseTags = GENRE_TAGS[genre] || GENRE_TAGS["อื่นๆ"];
  // Dark content heuristic
  const darkWords = ["ตาย", "เลือด", "มาเฟีย", "ฆ่า", "โหด", "มืด", "แค้น"];
  const synopsisLower = (synopsis || "").toLowerCase();
  const extraTags = [];
  if (darkWords.some((w) => synopsisLower.includes(w))) extraTags.push("สายดาร์ก", "โหด");
  if (synopsisLower.includes("ข้ามเวลา") || synopsisLower.includes("ย้อนกลับ")) extraTags.push("ข้ามเวลา");
  if (synopsisLower.includes("ประวัติศาสตร์") || synopsisLower.includes("จริง")) extraTags.push("อิงประวัติศาสตร์");
  return [...new Set([...baseTags, ...extraTags])].slice(0, 10);
}

// ---- Checklist ----
function buildChecklist(novel, chapters, tagline) {
  const contentChapters = chapters.filter((c) => c.content && (c.word_count || 0) > 0);
  const avgWords = contentChapters.length > 0
    ? Math.round(contentChapters.reduce((s, c) => s + (c.word_count || 0), 0) / contentChapters.length)
    : 0;

  return [
    { label: "ชื่อเรื่อง", done: !!novel?.title, value: novel?.title },
    { label: "คำโปรย/Tagline", done: !!tagline, value: tagline ? `"${tagline.substring(0, 60)}…"` : "ยังไม่มี" },
    { label: "เรื่องย่อ (Synopsis)", done: !!novel?.synopsis, value: novel?.synopsis ? `${novel.synopsis.substring(0, 60)}…` : "ยังไม่มี" },
    { label: "แนวเรื่อง/Genre", done: !!novel?.genre, value: novel?.genre || "ยังไม่ระบุ" },
    { label: "ยุคสมัย/ฉากหลัง", done: !!novel?.era, value: novel?.era || "ยังไม่ระบุ" },
    { label: "จำนวนตอนที่มีเนื้อหา", done: contentChapters.length > 0, value: `${contentChapters.length} ตอน` },
    { label: "ความยาวเฉลี่ยต่อตอน", done: avgWords >= 800, value: avgWords > 0 ? `~${avgWords.toLocaleString()} คำ ${avgWords < 800 ? "(ควรเพิ่มให้ถึง 800+)" : "✓"}` : "ยังไม่มีเนื้อหา" },
  ];
}

// ---- Main Dialog ----
export default function PublishExportDialog({ open, onClose, novel, novelId, chapters }) {
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [tagline, setTagline] = useState("");
  const [generatingTagline, setGeneratingTagline] = useState(false);
  const [activeSection, setActiveSection] = useState("platform"); // platform | summary | export

  const platform = PLATFORMS.find((p) => p.id === selectedPlatform);
  const sortedChapters = [...chapters].sort((a, b) => (a.order || 0) - (b.order || 0));
  const contentChapters = sortedChapters.filter((c) => c.content && (c.word_count || 0) > 0);
  const tagSuggestions = getTagSuggestions(novel?.genre, novel?.synopsis);
  const checklist = buildChecklist(novel, chapters, tagline);
  const checklistPassed = checklist.filter((i) => i.done).length;

  const generateTagline = async () => {
    if (!novel?.synopsis && !novel?.title) return;
    setGeneratingTagline(true);
    const prompt = `เขียนคำโปรยขายปมสำหรับนิยาย "${novel.title}" แนว ${novel.genre || "ทั่วไป"}
เรื่องย่อ: ${novel.synopsis || "ไม่ระบุ"}
ยุคสมัย: ${novel.era || "ไม่ระบุ"}
ให้คำโปรย 1-2 ประโยค กระชับ ขายปม ดึงดูดให้อยากอ่าน ใช้ภาษาไทย ไม่ต้องมีคำนำหรืออธิบาย ให้แค่คำโปรยเท่านั้น`;
    const result = await base44.integrations.Core.InvokeLLM({ prompt });
    let text = typeof result === "string" ? result : (result?.text || "");
    text = text.replace(/^```[\w]*\n?/m, "").replace(/\n?```$/m, "").trim();
    setTagline(text);
    setGeneratingTagline(false);
  };

  const handleDownloadAll = () => {
    if (!platform) return;
    const allContent = sortedChapters
      .filter((c) => c.content)
      .map((ch) => platform.formatChapter(ch))
      .join("\n\n" + "═".repeat(50) + "\n\n");
    downloadTxt(`${safeFilename(novel?.title || "novel")}_${platform.name}.txt`, allContent);
    toast.success("ดาวน์โหลดแล้ว");
  };

  const handleDownloadSeparate = () => {
    if (!platform) return;
    sortedChapters.filter((c) => c.content).forEach((ch) => {
      const content = platform.formatChapter(ch);
      downloadTxt(`${safeFilename(novel?.title || "novel")}_ตอน${ch.order}_${safeFilename(ch.title)}.txt`, content);
    });
    toast.success("ดาวน์โหลดแยกตอนแล้ว");
  };

  const steps = [
    { id: "platform", label: "เลือกแพลตฟอร์ม" },
    { id: "summary", label: "หน้าสรุปลงเรื่อง" },
    { id: "export", label: "ส่งออก" },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/60 shrink-0">
          <DialogTitle className="font-heading flex items-center gap-2">
            <Download className="w-5 h-5 text-primary" />
            ส่งออกพร้อมลงแพลตฟอร์ม
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            จัดรูปแบบเนื้อหาให้พร้อมวางตามแพลตฟอร์มปลายทาง พร้อมหน้าสรุปก่อนลงเรื่อง
          </p>
        </DialogHeader>

        {/* Step nav */}
        <div className="flex items-center px-6 py-3 border-b border-border/40 bg-muted/20 gap-1 shrink-0">
          {steps.map((step, i) => (
            <React.Fragment key={step.id}>
              <button
                onClick={() => setActiveSection(step.id)}
                className={`text-xs font-medium px-3 py-1 rounded-full transition-colors ${
                  activeSection === step.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {i + 1}. {step.label}
              </button>
              {i < steps.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            </React.Fragment>
          ))}
        </div>

        <ScrollArea className="flex-1 px-6 py-5">
          {/* ---- Step 1: Platform ---- */}
          {activeSection === "platform" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground mb-4">เลือกแพลตฟอร์มที่จะนำเนื้อหาไปลง</p>
              <div className="grid grid-cols-2 gap-3">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPlatform(p.id)}
                    className={`text-left rounded-xl border-2 px-4 py-3 transition-all ${
                      selectedPlatform === p.id ? p.activeColor + " border-2" : p.color
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">{p.name}</span>
                      {selectedPlatform === p.id && <Check className="w-4 h-4 text-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
                    {p.url && (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-primary/60 flex items-center gap-0.5 mt-1.5 hover:text-primary"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                        {p.url.replace("https://", "")}
                      </a>
                    )}
                  </button>
                ))}
              </div>

              {selectedPlatform && (
                <div className="mt-4 rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">ตัวอย่างรูปแบบหัวตอน</p>
                  <pre className="text-sm font-body text-foreground/80 whitespace-pre-wrap bg-background rounded-lg p-3 border border-border/40 text-xs">
                    {platform?.formatChapter({ order: 1, title: "พบกันครั้งแรก", content: "เนื้อหาตอนนี้..." }).substring(0, 80)}…
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* ---- Step 2: Summary ---- */}
          {activeSection === "summary" && (
            <div className="space-y-5">
              {/* Tagline */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">คำโปรยขายปม (Tagline)</label>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-7 text-xs"
                    onClick={generateTagline}
                    disabled={generatingTagline}
                  >
                    {generatingTagline
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <Sparkles className="w-3 h-3 text-primary" />
                    }
                    AI เขียนให้
                  </Button>
                </div>
                <div className="relative">
                  <Textarea
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="เช่น: เมื่อสายลมนำพาเขาข้ามเวลา ชะตากรรมจะยอมให้รักนี้คงอยู่หรือไม่?"
                    rows={3}
                    className="resize-none pr-10"
                  />
                  {tagline && (
                    <div className="absolute top-2 right-2">
                      <CopyButton text={tagline} size="sm" />
                    </div>
                  )}
                </div>
              </div>

              {/* Tags */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">แท็กแนะนำ</label>
                  <CopyButton text={tagSuggestions.join(", ")} label="คัดลอกแท็ก" size="sm" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {tagSuggestions.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs cursor-default px-2.5 py-0.5">
                      #{tag}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  สร้างจากแนวเรื่อง: <span className="font-medium">{novel?.genre || "ไม่ระบุ"}</span>
                </p>
              </div>

              {/* Checklist */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">เช็กลิสต์ก่อนลงเรื่อง</label>
                  <span className="text-xs text-muted-foreground">{checklistPassed}/{checklist.length} รายการ</span>
                </div>
                <div className="space-y-2">
                  {checklist.map((item, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border ${
                        item.done ? "bg-emerald-50/60 border-emerald-100" : "bg-amber-50/40 border-amber-100"
                      }`}
                    >
                      {item.done
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        : <Circle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ---- Step 3: Export ---- */}
          {activeSection === "export" && (
            <div className="space-y-4">
              {!selectedPlatform ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  กลับไปเลือกแพลตฟอร์มก่อนค่ะ
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className={`text-xs ${platform?.badgeColor}`}>{platform?.name}</Badge>
                    <span className="text-sm text-muted-foreground">{contentChapters.length} ตอนที่มีเนื้อหา</span>
                  </div>

                  {/* Download buttons */}
                  {selectedPlatform !== "file" ? (
                    <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-4 space-y-3">
                      <p className="text-sm font-medium">คัดลอกทีละตอน</p>
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {contentChapters.map((ch) => (
                          <div key={ch.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-background border border-border/50">
                            <span className="text-xs text-primary/60 font-medium w-6 shrink-0">{ch.order}.</span>
                            <span className="text-sm flex-1 min-w-0 truncate">{ch.title}</span>
                            <span className="text-xs text-muted-foreground shrink-0">{(ch.word_count || 0).toLocaleString()} คำ</span>
                            <CopyButton text={platform.formatChapter(ch)} label="คัดลอก" size="sm" />
                          </div>
                        ))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 w-full mt-2"
                        onClick={() => {
                          const all = contentChapters.map((ch) => platform.formatChapter(ch)).join("\n\n" + "═".repeat(50) + "\n\n");
                          navigator.clipboard.writeText(all);
                          toast.success("คัดลอกทั้งเรื่องแล้ว");
                        }}
                      >
                        <Copy className="w-3.5 h-3.5" />
                        คัดลอกทั้งเรื่องรวมกัน
                      </Button>
                    </div>
                  ) : null}

                  {/* Download as file */}
                  <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-4 space-y-3">
                    <p className="text-sm font-medium">ดาวน์โหลดเป็นไฟล์</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="gap-1.5 flex-1" onClick={handleDownloadAll}>
                        <Download className="w-3.5 h-3.5" />
                        รวมไฟล์เดียว (.txt)
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5 flex-1" onClick={handleDownloadSeparate}>
                        <Download className="w-3.5 h-3.5" />
                        แยกตอน (.txt)
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Footer nav */}
        <div className="px-6 py-4 border-t border-border/60 shrink-0 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>ปิด</Button>
          <div className="flex gap-2">
            {activeSection !== "platform" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const idx = steps.findIndex((s) => s.id === activeSection);
                  if (idx > 0) setActiveSection(steps[idx - 1].id);
                }}
              >
                ← ย้อนกลับ
              </Button>
            )}
            {activeSection !== "export" && (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  const idx = steps.findIndex((s) => s.id === activeSection);
                  if (idx < steps.length - 1) setActiveSection(steps[idx + 1].id);
                }}
                disabled={activeSection === "platform" && !selectedPlatform}
              >
                ถัดไป <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}