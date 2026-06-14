import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Copy, Download, FileText, File, CheckCircle2, ChevronDown, ChevronUp,
  Loader2, Globe
} from "lucide-react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";

// ─── Helpers ───────────────────────────────────────────────

function safeFilename(name) {
  return (name || "untitled").replace(/[\\/:*?"<>|]/g, "_").trim();
}

function downloadFile(filename, content, mimeType = "text/plain") {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// จัดย่อหน้าพื้นฐาน: บีบช่องว่างซ้ำ, เพิ่ม indent ต้นบรรทัด
function formatParagraphs(content) {
  if (!content) return "";
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => `    ${line}`)
    .join("\n\n");
}

// ─── Platform formatters ────────────────────────────────────

const PLATFORMS = [
  {
    id: "dek-d",
    label: "เด็กดี",
    emoji: "📗",
    desc: "ย่อหน้าด้วย tab, เว้นบรรทัดเปล่าระหว่างย่อหน้า",
    format: (title, content) => {
      const paras = (content || "").split("\n").map((l) => l.trim()).filter(Boolean);
      return paras.map((p) => `\t${p}`).join("\n\n");
    },
  },
  {
    id: "tunwalai",
    label: "ธัญวลัย",
    emoji: "📘",
    desc: "ย่อหน้า 2 บรรทัดว่าง แยกหัวตอนชัดเจน",
    format: (title, content) => {
      const paras = (content || "").split("\n").map((l) => l.trim()).filter(Boolean);
      const header = title ? `【${title}】\n\n` : "";
      return header + paras.map((p) => `　${p}`).join("\n\n\n");
    },
  },
  {
    id: "readawrite",
    label: "ReadAWrite",
    emoji: "📙",
    desc: "เว้นบรรทัดเดียวระหว่างย่อหน้า ไม่มี indent",
    format: (title, content) => {
      const paras = (content || "").split("\n").map((l) => l.trim()).filter(Boolean);
      const header = title ? `${title}\n${"─".repeat(30)}\n\n` : "";
      return header + paras.join("\n\n");
    },
  },
  {
    id: "joylada",
    label: "จอยลดา",
    emoji: "📕",
    desc: "ย่อหน้าด้วย em space, คั่นฉากด้วย ✦",
    format: (title, content) => {
      const paras = (content || "").split("\n").map((l) => l.trim()).filter(Boolean);
      const header = title ? `${title}\n\n` : "";
      return header + paras.map((p) => `\u2003${p}`).join("\n\n");
    },
  },
];

// ─── PDF generator ──────────────────────────────────────────

function generatePDF(novelTitle, chapters) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxW = pageW - margin * 2;
  let y = margin;

  const addText = (text, size, bold = false, color = [30, 30, 30]) => {
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, maxW);
    lines.forEach((line) => {
      if (y + size * 0.4 > pageH - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += size * 0.5;
    });
  };

  // Title page
  doc.setFontSize(22);
  doc.setTextColor(60, 30, 10);
  const titleLines = doc.splitTextToSize(novelTitle, maxW);
  titleLines.forEach((l) => { doc.text(l, pageW / 2, y, { align: "center" }); y += 10; });
  y += 8;
  doc.setDrawColor(180, 130, 80);
  doc.line(margin, y, pageW - margin, y);
  y += 12;

  chapters.forEach((ch, i) => {
    if (i > 0) { doc.addPage(); y = margin; }
    // Chapter title
    doc.setFontSize(15);
    doc.setTextColor(80, 40, 10);
    const chTitle = ch.order ? `ตอนที่ ${ch.order}: ${ch.title}` : ch.title;
    const chLines = doc.splitTextToSize(chTitle, maxW);
    chLines.forEach((l) => { doc.text(l, margin, y); y += 7; });
    y += 4;
    doc.setDrawColor(200, 170, 130);
    doc.line(margin, y, pageW - margin, y);
    y += 8;

    // Content
    const paras = (ch.content || "").split("\n").map((l) => l.trim()).filter(Boolean);
    paras.forEach((p) => {
      addText(p, 11);
      y += 2;
    });
  });

  doc.save(`${safeFilename(novelTitle)}.pdf`);
}

// ─── DOCX generator (manual XML) ────────────────────────────

function generateDocx(novelTitle, chapters) {
  const escXml = (s) =>
    (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const makePara = (text, bold = false, size = "22") =>
    `<w:p><w:pPr><w:spacing w:after="200"/></w:pPr><w:r><w:rPr>${bold ? "<w:b/>" : ""}<w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${escXml(text)}</w:t></w:r></w:p>`;

  let body = makePara(novelTitle, true, "32") + makePara("", false);

  chapters.forEach((ch) => {
    const chTitle = ch.order ? `ตอนที่ ${ch.order}: ${ch.title}` : ch.title;
    body += makePara(chTitle, true, "26") + makePara("", false);
    const paras = (ch.content || "").split("\n").map((l) => l.trim()).filter(Boolean);
    paras.forEach((p) => { body += makePara("    " + p); });
    body += makePara("", false);
  });

  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 wp14"><w:body>${body}<w:sectPr/></w:body></w:document>`;

  downloadFile(`${safeFilename(novelTitle)}.docx`, xml, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
}

// ─── TXT generator ──────────────────────────────────────────

function generateTxt(novelTitle, chapters) {
  const parts = chapters.map((ch) => {
    const chTitle = ch.order ? `ตอนที่ ${ch.order}: ${ch.title}` : ch.title;
    const paras = (ch.content || "").split("\n").map((l) => l.trim()).filter(Boolean);
    return `${chTitle}\n${"═".repeat(40)}\n\n${paras.map((p) => `    ${p}`).join("\n\n")}`;
  });
  const txt = `${novelTitle}\n${"═".repeat(novelTitle.length)}\n\n${parts.join("\n\n\n")}`;
  downloadFile(`${safeFilename(novelTitle)}.txt`, txt, "text/plain");
}

// ─── Main Component ─────────────────────────────────────────

export default function ExportDialog({ open, onOpenChange, novel, chapters }) {
  const [tab, setTab] = useState("copy");
  const [selectedIds, setSelectedIds] = useState(null); // null = ทั้งหมด
  const [platformId, setPlatformId] = useState("dek-d");
  const [copied, setCopied] = useState(false);
  const [platformCopied, setPlatformCopied] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const sorted = [...(chapters || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  const isShortStory = novel?.novel_type === "เรื่องสั้น" || sorted.length === 1;

  const selected = isShortStory
    ? sorted
    : selectedIds === null
    ? sorted
    : sorted.filter((c) => selectedIds.includes(c.id));

  const toggleChapter = (id) => {
    if (selectedIds === null) {
      setSelectedIds(sorted.map((c) => c.id).filter((i) => i !== id));
    } else if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const selectAll = () => setSelectedIds(null);
  const deselectAll = () => setSelectedIds([]);

  // ─── Tab: คัดลอก ───────────────────────────────────────
  const handleCopy = async () => {
    const lines = selected.map((ch) => {
      const title = ch.order ? `ตอนที่ ${ch.order}: ${ch.title}` : ch.title;
      const paras = (ch.content || "").split("\n").map((l) => l.trim()).filter(Boolean);
      return `${title}\n\n${paras.map((p) => `    ${p}`).join("\n\n")}`;
    });
    const text = `${novel?.title || ""}\n\n${lines.join("\n\n\n")}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("คัดลอกแล้ว!");
    setTimeout(() => setCopied(false), 2500);
  };

  // ─── Tab: ดาวน์โหลด ─────────────────────────────────────
  const handleDownloadPdf = () => {
    setPdfLoading(true);
    setTimeout(() => {
      generatePDF(novel?.title || "novel", selected);
      setPdfLoading(false);
    }, 50);
  };

  const handleDownloadDocx = () => {
    generateDocx(novel?.title || "novel", selected);
    toast.success("ดาวน์โหลด .docx แล้ว");
  };

  const handleDownloadTxt = () => {
    generateTxt(novel?.title || "novel", selected);
    toast.success("ดาวน์โหลด .txt แล้ว");
  };

  // ─── Tab: แพลตฟอร์ม ─────────────────────────────────────
  const platform = PLATFORMS.find((p) => p.id === platformId) || PLATFORMS[0];
  const platformText = selected
    .map((ch) => platform.format(ch.title, ch.content))
    .join("\n\n" + "─".repeat(20) + "\n\n");

  const handlePlatformCopy = async () => {
    await navigator.clipboard.writeText(platformText);
    setPlatformCopied(true);
    toast.success(`คัดลอกสำหรับ ${platform.label} แล้ว!`);
    setTimeout(() => setPlatformCopied(false), 2500);
  };

  const handlePlatformTxt = () => {
    downloadFile(`${safeFilename(novel?.title || "novel")}_${platform.id}.txt`, platformText, "text/plain");
    toast.success("ดาวน์โหลดแล้ว");
  };

  const totalWords = selected.reduce((s, c) => s + (c.word_count || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/60 shrink-0">
          <DialogTitle className="font-heading flex items-center gap-2">
            <Download className="w-5 h-5 text-primary" />
            ส่งออกงานเขียน
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">{novel?.title} · {totalWords.toLocaleString()} คำ</p>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Chapter selector (นิยายยาว > 1 ตอน) */}
          {!isShortStory && sorted.length > 1 && (
            <div className="px-5 pt-4 pb-3 border-b border-border/40 shrink-0">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-muted-foreground">เลือกตอนที่จะส่งออก</p>
                <div className="flex gap-2">
                  <button onClick={selectAll} className="text-[11px] text-primary hover:underline">ทั้งหมด</button>
                  <span className="text-muted-foreground text-[11px]">·</span>
                  <button onClick={deselectAll} className="text-[11px] text-muted-foreground hover:underline">ล้าง</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {sorted.map((ch) => {
                  const isSelected = selectedIds === null || selectedIds.includes(ch.id);
                  return (
                    <button
                      key={ch.id}
                      onClick={() => toggleChapter(ch.id)}
                      className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${
                        isSelected
                          ? "bg-primary/10 border-primary/40 text-primary font-medium"
                          : "bg-muted/30 border-border/40 text-muted-foreground"
                      }`}
                    >
                      {ch.order ? `ตอนที่ ${ch.order}` : ch.title}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                เลือก {selected.length}/{sorted.length} ตอน · {totalWords.toLocaleString()} คำ
              </p>
            </div>
          )}

          <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
            <div className="px-5 pt-3 shrink-0">
              <TabsList className="w-full grid grid-cols-3 h-9">
                <TabsTrigger value="copy" className="text-xs gap-1.5">
                  <Copy className="w-3.5 h-3.5" />คัดลอก
                </TabsTrigger>
                <TabsTrigger value="download" className="text-xs gap-1.5">
                  <Download className="w-3.5 h-3.5" />ดาวน์โหลด
                </TabsTrigger>
                <TabsTrigger value="platform" className="text-xs gap-1.5">
                  <Globe className="w-3.5 h-3.5" />แพลตฟอร์ม
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ─── Tab: คัดลอก ─── */}
            <TabsContent value="copy" className="flex-1 overflow-y-auto px-5 py-4 mt-0">
              <div className="space-y-4">
                <div className="rounded-xl bg-muted/30 border border-border/40 p-4 text-sm text-muted-foreground leading-relaxed">
                  <p className="font-medium text-foreground mb-1">คัดลอกเนื้อเรื่องทั้งหมด</p>
                  <p className="text-xs">เนื้อหาจะถูกจัดย่อหน้าพร้อมนำไปวางในแอพ/แพลตฟอร์มใดก็ได้ทันที</p>
                </div>
                <Button
                  className="w-full gap-2 h-11 text-base"
                  onClick={handleCopy}
                  disabled={selected.length === 0}
                >
                  {copied ? (
                    <><CheckCircle2 className="w-5 h-5 text-emerald-400" />คัดลอกแล้ว!</>
                  ) : (
                    <><Copy className="w-5 h-5" />คัดลอกเนื้อเรื่อง ({selected.length} ตอน)</>
                  )}
                </Button>
                {selected.length === 0 && (
                  <p className="text-xs text-center text-muted-foreground">กรุณาเลือกตอนอย่างน้อย 1 ตอน</p>
                )}
              </div>
            </TabsContent>

            {/* ─── Tab: ดาวน์โหลด ─── */}
            <TabsContent value="download" className="flex-1 overflow-y-auto px-5 py-4 mt-0">
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">เลือกรูปแบบไฟล์ที่ต้องการ</p>

                <button
                  onClick={handleDownloadPdf}
                  disabled={selected.length === 0 || pdfLoading}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all text-left disabled:opacity-50"
                >
                  <div className="w-9 h-9 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                    {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin text-red-500" /> : <FileText className="w-4 h-4 text-red-500" />}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">PDF</p>
                    <p className="text-xs text-muted-foreground">จัดหน้าพร้อมพิมพ์หรือบันทึกถาวร</p>
                  </div>
                  <Badge variant="outline" className="ml-auto text-[10px]">.pdf</Badge>
                </button>

                <button
                  onClick={handleDownloadDocx}
                  disabled={selected.length === 0}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all text-left disabled:opacity-50"
                >
                  <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
                    <File className="w-4 h-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Word Document</p>
                    <p className="text-xs text-muted-foreground">แก้ไขต่อได้ใน Microsoft Word</p>
                  </div>
                  <Badge variant="outline" className="ml-auto text-[10px]">.docx</Badge>
                </button>

                <button
                  onClick={handleDownloadTxt}
                  disabled={selected.length === 0}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all text-left disabled:opacity-50"
                >
                  <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">ข้อความธรรมดา</p>
                    <p className="text-xs text-muted-foreground">ไฟล์เบา เปิดได้ทุกโปรแกรม</p>
                  </div>
                  <Badge variant="outline" className="ml-auto text-[10px]">.txt</Badge>
                </button>
              </div>
            </TabsContent>

            {/* ─── Tab: แพลตฟอร์ม ─── */}
            <TabsContent value="platform" className="flex-1 overflow-hidden flex flex-col mt-0">
              <div className="px-5 pt-3 pb-3 shrink-0 space-y-3">
                <p className="text-xs text-muted-foreground">เลือกแพลตฟอร์มนิยายปลายทาง</p>
                <div className="grid grid-cols-2 gap-2">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPlatformId(p.id)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all ${
                        platformId === p.id
                          ? "border-primary bg-primary/8 text-primary"
                          : "border-border/60 hover:border-primary/30 hover:bg-muted/30"
                      }`}
                    >
                      <span className="text-base">{p.emoji}</span>
                      <div>
                        <p className="text-xs font-semibold">{p.label}</p>
                        <p className="text-[10px] text-muted-foreground leading-tight">{p.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-hidden flex flex-col px-5 pb-4">
                <ScrollArea className="flex-1 border border-border/40 rounded-xl bg-muted/20 p-3 mb-3">
                  <pre className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap font-body">
                    {platformText || "ยังไม่มีเนื้อหา"}
                  </pre>
                </ScrollArea>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={handlePlatformTxt}>
                    <Download className="w-3.5 h-3.5" />ดาวน์โหลด .txt
                  </Button>
                  <Button size="sm" className="flex-1 gap-1.5" onClick={handlePlatformCopy} disabled={selected.length === 0}>
                    {platformCopied ? (
                      <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />คัดลอกแล้ว!</>
                    ) : (
                      <><Copy className="w-3.5 h-3.5" />คัดลอก</>
                    )}
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}