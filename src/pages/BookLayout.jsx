import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BookMarked, ArrowLeft, ArrowRight, ImagePlus, Loader2, Sparkles, FileText, Code2,
  FileType, Braces, AlertTriangle, CheckCircle2, BookOpen, Layers, Eye, X, ListOrdered,
} from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/lib/AuthContext";
import BookStepper from "@/components/booklayout/BookStepper";
import ExportButton from "@/components/booklayout/ExportButton";
import {
  buildBookObject, buildMarkdown, buildTxt, buildPrintHtml, analyzeManuscript,
  countThaiWords, safeFilename, PAGE_ESTIMATE_WARNING,
} from "@/lib/bookExport";

const STEPS = [
  { id: "select", label: "เลือกนิยาย" },
  { id: "info", label: "ข้อมูลหนังสือ" },
  { id: "cover", label: "ปก" },
  { id: "front", label: "หน้าเปิดเล่ม" },
  { id: "toc", label: "สารบัญ" },
  { id: "content", label: "เนื้อหา" },
  { id: "back", label: "บทส่งท้าย" },
  { id: "review", label: "ตรวจทาน" },
  { id: "export", label: "ส่งออก" },
];

const emptyMeta = {
  title: "", subtitle: "", author: "", translator: "", publisher: "", blurb: "",
  category: "", status: "",
  cover_url: "", cover_text: "",
  inner_title_note: "", preface: "", copyright: "", editor_note: "",
  afterword: "", about_author: "", next_volume: "",
};

export default function BookLayout() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const urlParams = new URLSearchParams(window.location.search);
  const preselectId = urlParams.get("novelId") || "";

  const [step, setStep] = useState(0);
  const [selectedNovelId, setSelectedNovelId] = useState(preselectId);
  const [meta, setMeta] = useState(emptyMeta);
  const [uploading, setUploading] = useState(false);
  const [manuscriptReady, setManuscriptReady] = useState(false);

  // ── โหลดนิยาย ──
  const { data: novels = [], isLoading: loadingNovels } = useQuery({
    queryKey: ["booklayout-novels", user?.id],
    queryFn: async () => {
      const all = await base44.entities.Novel.list("-created_date");
      return all.filter((n) => {
        if (n.is_deleted) return false;
        if (isAdmin) return true;
        if (String(n.created_by_id) === String(user?.id)) return true;
        if (Array.isArray(n.shared_with) && n.shared_with.includes(user?.email)) return true;
        return false;
      });
    },
    enabled: !!user,
  });

  const { data: allChapters = [] } = useQuery({
    queryKey: ["booklayout-chapters", selectedNovelId],
    queryFn: () => base44.entities.Chapter.filter({ novel_id: selectedNovelId }),
    enabled: !!selectedNovelId,
  });

  const selectedNovel = useMemo(
    () => novels.find((n) => String(n.id) === String(selectedNovelId)),
    [novels, selectedNovelId]
  );

  // ตอนที่ยังไม่ถูกลบ เรียงตาม order จริง
  const chapters = useMemo(
    () =>
      allChapters
        .filter((c) => !c.is_deleted)
        .sort((a, b) => (a.order || 0) - (b.order || 0)),
    [allChapters]
  );

  const totalWords = useMemo(
    () => chapters.reduce((s, c) => s + countThaiWords(c.content), 0),
    [chapters]
  );

  const issues = useMemo(() => (manuscriptReady ? analyzeManuscript(chapters) : []), [manuscriptReady, chapters]);

  // ── เมื่อเลือกนิยาย เติมข้อมูลเริ่มต้นจาก Novel ──
  useEffect(() => {
    if (selectedNovel) {
      setMeta((m) => ({
        ...m,
        title: m.title || selectedNovel.title || "",
        blurb: m.blurb || selectedNovel.synopsis || "",
        category: m.category || selectedNovel.genre || "",
        status: m.status || selectedNovel.status || "",
        cover_url: m.cover_url || selectedNovel.cover_url || "",
        author: m.author || selectedNovel.author || (user?.full_name || ""),
      }));
    }
  }, [selectedNovel]);

  // reset manuscript flag if novel changes
  useEffect(() => { setManuscriptReady(false); }, [selectedNovelId]);

  const book = useMemo(() => buildBookObject(meta, chapters), [meta, chapters]);
  const fnameBase = safeFilename(meta.title || "book");

  const setField = (k, v) => setMeta((m) => ({ ...m, [k]: v }));

  const handleCoverUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setField("cover_url", file_url);
      toast.success("อัปโหลดรูปปกแล้ว");
    } catch {
      toast.error("อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  };

  const canNext = () => {
    if (step === 0) return !!selectedNovelId && chapters.length > 0;
    return true;
  };

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const generateManuscript = () => {
    if (chapters.length === 0) {
      toast.error("นิยายนี้ยังไม่มีตอน");
      return;
    }
    setManuscriptReady(true);
    toast.success(`สร้างต้นฉบับแล้ว · ${chapters.length} บท · ${totalWords.toLocaleString()} คำ`);
  };

  const openPrintPreview = () => {
    const html = buildPrintHtml(book);
    const w = window.open("", "_blank");
    if (!w) { toast.error("เบราว์เซอร์บล็อกป๊อปอัพ — อนุญาตแล้วลองใหม่"); return; }
    w.document.write(html);
    w.document.close();
  };

  return (
    <AppLayout>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-amber-100/70 via-secondary/40 to-orange-100/50 border border-amber-200/50 rounded-3xl p-4 sm:p-6 mb-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
                <BookMarked className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-heading font-bold text-xl sm:text-2xl tracking-tight">จัดรูปเล่ม</h1>
                <p className="text-sm text-muted-foreground">เตรียมต้นฉบับเป็นหนังสือฉบับสมบูรณ์ พร้อมส่งออก</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="gap-1.5 shrink-0" onClick={() => navigate("/series")}>
              <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">กลับ</span>
            </Button>
          </div>
        </div>

        {/* Stepper */}
        <div className="mb-6">
          <BookStepper steps={STEPS} current={step} onJump={(i) => { if (selectedNovelId || i === 0) setStep(i); }} />
        </div>

        {/* Step body */}
        <div className="space-y-5">
          {/* 0: เลือกนิยาย */}
          {step === 0 && (
            <SectionCard title="เลือกนิยาย/ซีรีส์ที่ต้องการจัดรูปเล่ม" icon={BookOpen}>
              {loadingNovels ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : novels.length === 0 ? (
                <EmptyHint text="ยังไม่มีนิยาย — สร้างนิยายและเขียนตอนก่อน" />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {novels.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => setSelectedNovelId(n.id)}
                      className={`text-left rounded-xl border p-3.5 transition-all ${
                        String(selectedNovelId) === String(n.id)
                          ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                          : "border-border/60 hover:border-primary/40 hover:bg-accent/40"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-heading font-semibold text-sm truncate flex-1">{n.title}</h3>
                        {String(selectedNovelId) === String(n.id) && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {n.genre && <Badge variant="secondary" className="text-[10px]">{n.genre}</Badge>}
                        {n.season_number > 1 && <Badge variant="outline" className="text-[10px]">Season {n.season_number}</Badge>}
                        <Badge variant="outline" className="text-[10px]">{n.status || "กำลังเขียน"}</Badge>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {selectedNovelId && (
                <div className="mt-4 rounded-xl bg-secondary/40 border border-border/50 p-4">
                  {chapters.length === 0 ? (
                    <p className="text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> นิยายนี้ยังไม่มีตอน — เพิ่มตอนก่อนจัดรูปเล่ม
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                      <span className="flex items-center gap-1.5"><ListOrdered className="w-4 h-4 text-primary" /> <b>{chapters.length}</b> ตอน</span>
                      <span className="text-muted-foreground">รวม <b className="text-foreground">{totalWords.toLocaleString()}</b> คำ</span>
                      <span className="text-muted-foreground">เรียงตามลำดับตอนจริง (order)</span>
                    </div>
                  )}
                </div>
              )}
            </SectionCard>
          )}

          {/* 1: ข้อมูลหนังสือ */}
          {step === 1 && (
            <SectionCard title="ข้อมูลหนังสือ" icon={FileText}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="ชื่อเรื่อง"><Input value={meta.title} onChange={(e) => setField("title", e.target.value)} placeholder="ชื่อหนังสือ" /></Field>
                <Field label="ชื่อรอง"><Input value={meta.subtitle} onChange={(e) => setField("subtitle", e.target.value)} placeholder="ชื่อรอง (ถ้ามี)" /></Field>
                <Field label="ผู้แต่ง"><Input value={meta.author} onChange={(e) => setField("author", e.target.value)} placeholder="ชื่อผู้แต่ง" /></Field>
                <Field label="ผู้แปล/เรียบเรียง"><Input value={meta.translator} onChange={(e) => setField("translator", e.target.value)} placeholder="ผู้แปล/เรียบเรียง" /></Field>
                <Field label="สำนักพิมพ์"><Input value={meta.publisher} onChange={(e) => setField("publisher", e.target.value)} placeholder="สำนักพิมพ์" /></Field>
                <Field label="หมวด"><Input value={meta.category} onChange={(e) => setField("category", e.target.value)} placeholder="เช่น กำลังภายใน" /></Field>
                <Field label="สถานะ">
                  <Select value={meta.status || "none"} onValueChange={(v) => setField("status", v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="เลือกสถานะ" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— ไม่ระบุ —</SelectItem>
                      <SelectItem value="กำลังเขียน">กำลังเขียน</SelectItem>
                      <SelectItem value="เขียนเสร็จ">เขียนเสร็จ</SelectItem>
                      <SelectItem value="พักไว้ก่อน">พักไว้ก่อน</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="คำโปรย" className="mt-4">
                <Textarea rows={3} value={meta.blurb} onChange={(e) => setField("blurb", e.target.value)} placeholder="คำโปรยหลังปก / เรื่องย่อ" />
              </Field>
            </SectionCard>
          )}

          {/* 2: ปก */}
          {step === 2 && (
            <SectionCard title="ปกหนังสือ" icon={ImagePlus}>
              <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-6">
                <div>
                  <label className="text-sm font-medium mb-2 block">รูปปก</label>
                  <label className="relative block w-full aspect-[3/4] rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer overflow-hidden bg-muted/30">
                    {meta.cover_url ? (
                      <>
                        <img src={meta.cover_url} alt="ปก" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          className="absolute top-2 right-2 w-6 h-6 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white"
                          onClick={(e) => { e.preventDefault(); setField("cover_url", ""); }}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground p-4 text-center">
                        {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <ImagePlus className="w-6 h-6" />}
                        <span className="text-xs">{uploading ? "กำลังอัปโหลด..." : "คลิกเพื่ออัปโหลดรูปปก"}</span>
                      </div>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleCoverUpload(e.target.files?.[0])} />
                  </label>
                  {selectedNovel?.cover_url && meta.cover_url !== selectedNovel.cover_url && (
                    <Button variant="ghost" size="sm" className="w-full mt-2 text-xs h-7" onClick={() => setField("cover_url", selectedNovel.cover_url)}>
                      ใช้รูปปกเดิมของนิยาย
                    </Button>
                  )}
                </div>
                <div className="space-y-4">
                  <Field label="ข้อความบนปก (นอกเหนือจากชื่อเรื่อง)">
                    <Textarea rows={4} value={meta.cover_text} onChange={(e) => setField("cover_text", e.target.value)} placeholder="เช่น คำคม, ชื่อชุด, เล่มที่..." />
                  </Field>
                  <div className="rounded-xl bg-secondary/40 border border-border/50 p-3 text-xs text-muted-foreground">
                    ปกจะแสดงชื่อเรื่อง "{meta.title || "—"}" {meta.subtitle && `/ ${meta.subtitle}`} {meta.author && `· โดย ${meta.author}`}
                  </div>
                </div>
              </div>
            </SectionCard>
          )}

          {/* 3: หน้าเปิดเล่ม */}
          {step === 3 && (
            <SectionCard title="หน้าเปิดเล่ม" icon={BookOpen}>
              <div className="space-y-4">
                <Field label="ปกใน (หมายเหตุ)"><Textarea rows={2} value={meta.inner_title_note} onChange={(e) => setField("inner_title_note", e.target.value)} placeholder="ข้อความเพิ่มเติมในหน้าปกใน" /></Field>
                <Field label="คำนำ"><Textarea rows={4} value={meta.preface} onChange={(e) => setField("preface", e.target.value)} placeholder="คำนำของหนังสือ" /></Field>
                <Field label="ลิขสิทธิ์ / เครดิต"><Textarea rows={3} value={meta.copyright} onChange={(e) => setField("copyright", e.target.value)} placeholder="© สงวนลิขสิทธิ์... / เครดิตทีมงาน" /></Field>
                <Field label="หมายเหตุผู้เรียบเรียง"><Textarea rows={3} value={meta.editor_note} onChange={(e) => setField("editor_note", e.target.value)} placeholder="หมายเหตุจากผู้เรียบเรียง/บรรณาธิการ" /></Field>
              </div>
            </SectionCard>
          )}

          {/* 4: สารบัญ */}
          {step === 4 && (
            <SectionCard title="สารบัญ (สร้างอัตโนมัติจากลำดับตอนจริง)" icon={ListOrdered}>
              <div className="mb-4 rounded-xl border border-amber-200/60 dark:border-amber-800/40 bg-amber-50/60 dark:bg-amber-950/20 p-3.5 text-xs space-y-1.5">
                <p className="flex items-start gap-2 text-foreground">
                  <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                  <span><b>Markdown / TXT / JSON:</b> เป็นไฟล์อ่านต่อเนื่อง สารบัญ<b> ไม่มีเลขหน้า</b> (ไล่ตามลำดับบท)</span>
                </p>
                <p className="flex items-start gap-2 text-foreground">
                  <Code2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" />
                  <span><b>HTML / PDF:</b> สารบัญแสดง<b> ชื่อบท ....... หน้า N</b> พร้อมเลขหน้า footer ทุกหน้า ตามรูปแบบ A5</span>
                </p>
                <p className="flex items-start gap-2 text-muted-foreground pt-0.5 border-t border-amber-200/40 dark:border-amber-800/30 mt-1">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
                  <span>{PAGE_ESTIMATE_WARNING}</span>
                </p>
              </div>
              {chapters.length === 0 ? (
                <EmptyHint text="ยังไม่มีตอน" />
              ) : (
                <ol className="divide-y divide-border/50 rounded-xl border border-border/50 overflow-hidden">
                  {chapters.map((c, i) => (
                    <li key={c.id} className="flex items-center gap-3 px-3.5 py-2.5 text-sm hover:bg-accent/30">
                      <span className="w-7 h-7 rounded-md bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                      <span className="flex-1 truncate">{c.title || <span className="text-muted-foreground italic">(ไม่มีชื่อตอน)</span>}</span>
                      <span className="text-xs text-muted-foreground shrink-0">order {c.order ?? "—"}</span>
                      <span className="text-xs text-muted-foreground shrink-0 w-16 text-right">{countThaiWords(c.content).toLocaleString()} คำ</span>
                    </li>
                  ))}
                </ol>
              )}
            </SectionCard>
          )}

          {/* 5: เนื้อหา */}
          {step === 5 && (
            <SectionCard title="เนื้อหา — รวมบทตามลำดับจริง" icon={FileText}>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <Button className="gap-2 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white border-0" onClick={generateManuscript}>
                  <Sparkles className="w-4 h-4" /> สร้างต้นฉบับ
                </Button>
                {manuscriptReady && (
                  <Button variant="outline" className="gap-2" onClick={openPrintPreview}>
                    <Eye className="w-4 h-4" /> พรีวิวรูปเล่ม (พิมพ์/PDF)
                  </Button>
                )}
                <span className="text-sm text-muted-foreground">{chapters.length} บท · {totalWords.toLocaleString()} คำ</span>
              </div>

              {!manuscriptReady ? (
                <EmptyHint text='กด "สร้างต้นฉบับ" เพื่อรวมเนื้อหาทุกบทเป็นต้นฉบับ (ไม่แก้ไขตอนจริง)' />
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {book.chapters.map((c) => (
                    <details key={c.index} className="rounded-xl border border-border/50 overflow-hidden group">
                      <summary className="flex items-center gap-3 px-3.5 py-2.5 cursor-pointer hover:bg-accent/30 text-sm list-none">
                        <span className="w-7 h-7 rounded-md bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">{c.index}</span>
                        <span className="flex-1 truncate font-medium">{c.title}</span>
                        {!c.content.trim() && <Badge variant="destructive" className="text-[10px]">ว่าง</Badge>}
                        <span className="text-xs text-muted-foreground shrink-0">{c.word_count.toLocaleString()} คำ</span>
                      </summary>
                      <div className="px-3.5 pb-3 pt-1 border-t border-border/40 bg-muted/20">
                        <p className="text-xs text-muted-foreground whitespace-pre-line line-clamp-6 leading-relaxed">
                          {c.content || "(ไม่มีเนื้อหา)"}
                        </p>
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {/* 6: บทส่งท้าย */}
          {step === 6 && (
            <SectionCard title="บทส่งท้าย" icon={BookMarked}>
              <div className="space-y-4">
                <Field label="บทส่งท้าย"><Textarea rows={4} value={meta.afterword} onChange={(e) => setField("afterword", e.target.value)} placeholder="บทส่งท้ายของหนังสือ" /></Field>
                <Field label="เกี่ยวกับผู้แต่ง"><Textarea rows={3} value={meta.about_author} onChange={(e) => setField("about_author", e.target.value)} placeholder="ประวัติผู้แต่งโดยย่อ" /></Field>
                <Field label="เล่มถัดไป / หมายเหตุท้ายเล่ม"><Textarea rows={3} value={meta.next_volume} onChange={(e) => setField("next_volume", e.target.value)} placeholder="ตัวอย่างเล่มถัดไป หรือหมายเหตุปิดเล่ม" /></Field>
              </div>
            </SectionCard>
          )}

          {/* 7: ตรวจทาน */}
          {step === 7 && (
            <SectionCard title="ตรวจทานต้นฉบับ" icon={AlertTriangle}>
              {!manuscriptReady && (
                <div className="mb-4">
                  <Button variant="outline" className="gap-2" onClick={generateManuscript}>
                    <Sparkles className="w-4 h-4" /> สร้างต้นฉบับก่อนตรวจทาน
                  </Button>
                </div>
              )}
              {manuscriptReady && (
                issues.length === 0 ? (
                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 p-6 text-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                    <p className="font-semibold text-emerald-700 dark:text-emerald-300">ต้นฉบับพร้อมจัดรูปเล่ม ไม่พบปัญหา</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground mb-2">พบ <b className="text-foreground">{issues.length}</b> รายการที่ควรตรวจ (ระบบไม่แก้ไขให้อัตโนมัติ)</p>
                    {issues.map((iss, idx) => (
                      <div key={idx} className={`rounded-lg border p-3 text-sm flex items-start gap-2.5 ${
                        iss.severity === "high" ? "border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800/40"
                        : iss.severity === "medium" ? "border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800/40"
                        : "border-border/60 bg-muted/30"
                      }`}>
                        <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${iss.severity === "high" ? "text-red-500" : iss.severity === "medium" ? "text-amber-500" : "text-muted-foreground"}`} />
                        <div>
                          <p className="font-medium">{iss.chapter}</p>
                          <p className="text-muted-foreground text-xs">{iss.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </SectionCard>
          )}

          {/* 8: ส่งออก */}
          {step === 8 && (
            <SectionCard title="ส่งออกรูปเล่ม" icon={FileType}>
              {!manuscriptReady && (
                <div className="mb-4">
                  <Button variant="outline" className="gap-2" onClick={generateManuscript}>
                    <Sparkles className="w-4 h-4" /> สร้างต้นฉบับก่อนส่งออก
                  </Button>
                </div>
              )}
              <div className="mb-4 rounded-xl border border-border/60 bg-secondary/40 p-3.5 text-xs space-y-1.5">
                <p className="flex items-start gap-2 text-foreground">
                  <Code2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" />
                  <span><b>HTML / PDF:</b> มี<b> เลขหน้า</b> — สารบัญโยงเลขหน้า และมีเลขหน้า footer ทุกหน้าตามรูปแบบ A5</span>
                </p>
                <p className="flex items-start gap-2 text-muted-foreground">
                  <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span><b>Markdown / TXT / JSON:</b> ไฟล์อ่านต่อเนื่อง <b>ไม่มีเลขหน้า</b> (JSON เก็บ <code>tableOfContents</code> ไม่มีเลขหน้า แยกจาก <code>printPageEstimates</code>)</span>
                </p>
                <p className="flex items-start gap-2 text-muted-foreground pt-0.5 border-t border-border/40 mt-1">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
                  <span>{PAGE_ESTIMATE_WARNING}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                <Button variant="outline" className="gap-2" onClick={openPrintPreview}>
                  <Eye className="w-4 h-4" /> เปิดพรีวิวเพื่อพิมพ์/บันทึกเป็น PDF
                </Button>
                <span className="text-xs text-muted-foreground self-center">ในหน้าพรีวิว กด Ctrl/Cmd+P → บันทึกเป็น PDF (ขนาด A5)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ExportButton label="Markdown" icon={FileText} description="ต้นฉบับ .md · สารบัญอ่านต่อเนื่อง (ไม่มีเลขหน้า)" filename={`${fnameBase}.md`} mimeType="text/markdown" content={buildMarkdown(book)} />
                <ExportButton label="HTML (พิมพ์/PDF)" icon={Code2} description="เลย์เอาต์ A5 · มีเลขหน้า + สารบัญโยงหน้า" filename={`${fnameBase}.html`} mimeType="text/html" content={buildPrintHtml(book)} />
                <ExportButton label="ข้อความล้วน" icon={FileType} description="ไฟล์ .txt อ่านต่อเนื่อง (ไม่มีเลขหน้า)" filename={`${fnameBase}.txt`} mimeType="text/plain" content={buildTxt(book)} />
                <ExportButton label="JSON รูปเล่ม" icon={Braces} description="tableOfContents (ไม่มีเลขหน้า) + printPageEstimates" filename={`${fnameBase}.json`} mimeType="application/json" content={JSON.stringify(book, null, 2)} />
              </div>
            </SectionCard>
          )}
        </div>

        {/* Nav footer */}
        <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-border/40">
          <Button variant="outline" className="gap-1.5" onClick={back} disabled={step === 0}>
            <ArrowLeft className="w-4 h-4" /> ย้อนกลับ
          </Button>
          <span className="text-xs text-muted-foreground">ขั้นตอน {step + 1}/{STEPS.length} · {STEPS[step].label}</span>
          {step < STEPS.length - 1 ? (
            <Button
              className="gap-1.5 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white border-0"
              onClick={next}
              disabled={!canNext()}
              title={!canNext() ? "เลือกนิยายที่มีตอนก่อน" : ""}
            >
              ถัดไป <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button variant="outline" className="gap-1.5" onClick={() => navigate("/series")}>
              <Layers className="w-4 h-4" /> เสร็จสิ้น
            </Button>
          )}
        </div>
      </main>
    </AppLayout>
  );
}

// ─── sub components ─────────────────────────────────────────────────────────
function SectionCard({ title, icon: Icon, children }) {
  return (
    <div className="bg-card border border-border/60 rounded-2xl p-4 sm:p-6 shadow-sm">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/30 text-amber-600 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        <h2 className="font-heading font-semibold text-base">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children, className = "" }) {
  return (
    <div className={className}>
      <label className="text-sm font-medium mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

function EmptyHint({ text }) {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 py-10 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}