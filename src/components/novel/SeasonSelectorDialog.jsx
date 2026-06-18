import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, Users, Plus, Check, ChevronRight, Save, RefreshCw, Layers, BookOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function SeasonSelectorDialog({ open, onClose, novel, onSeasonChange }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1); // 1=setup, 2=characters, 3=confirm
  const [seasonTitle, setSeasonTitle] = useState("");
  const [seasonSynopsis, setSeasonSynopsis] = useState("");
  const [targetChapters, setTargetChapters] = useState("10");
  const [inheritedChars, setInheritedChars] = useState([]);
  const [aiNewChars, setAiNewChars] = useState([]);
  const [generatingChars, setGeneratingChars] = useState(false);
  const [creating, setCreating] = useState(false);
  const [generatingSeason, setGeneratingSeason] = useState(false);
  const [seasonGenerated, setSeasonGenerated] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [createdSeasonId, setCreatedSeasonId] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, season: null });
  const [successDialog, setSuccessDialog] = useState({ open: false, seasonTitle: "" });

  // โหลดทุก Season ของนิยายเรื่องนี้
  const { data: seasons = [] } = useQuery({
    queryKey: ["seasons", novel?.id],
    queryFn: async () => {
      if (!novel?.id) return [];
      const all = await base44.entities.Novel.list();
      return all
        .filter((n) => String(n.parent_novel_id) === String(novel.id) && !n.is_deleted)
        .sort((a, b) => {
          const sa = a.season_number || 1;
          const sb = b.season_number || 1;
          if (sa !== sb) return sa - sb;
          return new Date(a.created_date || 0) - new Date(b.created_date || 0);
        });
    },
    enabled: !!novel?.id && open,
  });

  const deleteSeasonMutation = useMutation({
    mutationFn: async (seasonId) => {
      // Soft delete Season
      await base44.entities.Novel.update(seasonId, { is_deleted: true, deleted_at: new Date().toISOString() });
      // Soft delete chapters ทั้งหมดใน Season นี้
      const chapters = await base44.entities.Chapter.filter({ novel_id: seasonId });
      await Promise.all(
        chapters.map((ch) => base44.entities.Chapter.update(ch.id, { is_deleted: true }))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seasons", novel?.id] });
      queryClient.invalidateQueries({ queryKey: ["episodes", novel?.series_id] });
      toast.success("ลบ Season แล้ว (สามารถกู้คืนจากถังขยะได้)");
      setDeleteDialog({ open: false, season: null });
    },
  });

  // โหลดตัวละครจาก Season ปัจจุบัน
  const { data: existingChars = [] } = useQuery({
    queryKey: ["characters", novel?.id],
    queryFn: () => base44.entities.Character.filter({ novel_id: novel.id }),
    enabled: !!novel?.id && open,
    select: (data) => data.filter((c) => !c.is_deleted),
  });

  // โหลด Writer ของนิยายนี้
  const { data: writer } = useQuery({
    queryKey: ["writers-all"],
    queryFn: () => base44.entities.Writer.list(),
    enabled: !!novel?.writer_id,
    select: (data) => data.find((w) => String(w.id) === String(novel?.writer_id)),
  });

  // ถ้า existingChars โหลดครั้งแรก → select ทั้งหมด
  useEffect(() => {
    if (existingChars.length > 0 && inheritedChars.length === 0) {
      setInheritedChars(existingChars.map((c) => c.id));
    }
  }, [existingChars]);

  function toggleChar(id) {
    setInheritedChars((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleGenerateSeason() {
    setGeneratingSeason(true);
    const writerCtx = writer?.system_prompt
      ? `[สไตล์และโทนการเขียน]\n${writer.system_prompt}\n\n`
      : "";
    const charSummary = existingChars.map((c) => `${c.name} (${c.role}) — ${c.personality || ""}`).join("\n");

    // สรุป Season ก่อนหน้าทั้งหมด
    const prevSeasonCtx = seasons.length > 0
      ? `\n[Season ก่อนหน้า]\n` + seasons.map((s, i) =>
          `Season ${i + 1}: ${s.title}\nเรื่องย่อ: ${s.synopsis || "(ไม่มีเรื่องย่อ)"}`
        ).join("\n\n")
      : "";

    const currentSeasonCtx = `\n[Season ปัจจุบัน (Season ที่กำลังสร้างภาคต่อ)]\nชื่อ: ${novel?.title}\nเรื่องย่อ: ${novel?.synopsis || "(ไม่มีเรื่องย่อ)"}`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `${writerCtx}คุณเป็นนักเขียนนิยายซีรีส์ ต้องการสร้าง Season ใหม่ที่ต่อเนื่องและเชื่อมโยงกับ Season ก่อนหน้า
ชื่อซีรีส์/นิยาย: ${novel?.title}
แนว: ${novel?.genre || ""}
${prevSeasonCtx}
${currentSeasonCtx}

ตัวละครหลักที่มีอยู่ใน Season ปัจจุบัน:
${charSummary || "(ยังไม่มี)"}

กรุณาสร้างชื่อ Season ใหม่และเรื่องย่อสำหรับ Season ถัดไป โดยยึดหลักดังนี้อย่างเคร่งครัด:
1. พล็อตและเหตุการณ์หลักต้องใหม่ทั้งหมด — ห้ามวนซ้ำหรือรีไซเคิลพล็อตจาก Season ก่อนหน้าโดยเด็ดขาด
2. ต้องเกิดความขัดแย้ง ปัญหา หรือเหตุการณ์สำคัญใหม่ที่ยังไม่เคยเกิดขึ้นใน Season ใด ๆ ก่อนหน้า
3. ตัวละครเดิมต้องปรากฏในบทบาทที่ต่อเนื่อง แสดงพัฒนาการจากสิ่งที่เกิดขึ้นใน Season ก่อน
4. บริบทของโลก ความสัมพันธ์ และผลพวงจาก Season ก่อนต้องส่งผลต่อเหตุการณ์ใหม่อย่างชัดเจน
5. ผู้อ่านต้องรู้สึกว่าเรื่องก้าวหน้าไปข้างหน้า ไม่ได้วนอยู่กับที่

ข้อกำหนดเรื่องชื่อ Season (สำคัญมาก):
- ตั้งชื่อภาคที่เป็นเอกลักษณ์ของตัวเองล้วน ๆ
- ห้ามใส่คำนำหน้าว่า "Season X:", "ภาค X:" หรือเลขลำดับใด ๆ นำหน้าชื่อโดยเด็ดขาด
- ห้ามนำชื่อเรื่องหลัก ("${novel?.title}") มาพ่วงหรือซ้ำในชื่อภาค — ให้เป็นชื่อใหม่ล้วน ๆ`,
      response_json_schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          synopsis: { type: "string" },
        },
      },
    });
    // ตัดคำนำหน้า "Season X:" / "ภาค X:" ออก เผื่อ AI ยังเติมมา
    const cleanTitle = (result.title || "")
      .replace(/^\s*(season|ภาค)\s*\d+\s*[:：\-–.]?\s*/i, "")
      .trim();
    setSeasonTitle(cleanTitle);
    setSeasonSynopsis(result.synopsis || "");
    setSeasonGenerated(true);
    setGeneratingSeason(false);
  }

  async function handleGenerateNewChars() {
    setGeneratingChars(true);
    const selectedChars = existingChars.filter((c) => inheritedChars.includes(c.id));
    const charSummary = selectedChars.map((c) => `${c.name} (${c.role}) — ${c.personality || ""}`).join("\n");
    const writerCtx = writer?.system_prompt
      ? `[สไตล์และโทนการเขียน]\n${writer.system_prompt}\n\n`
      : "";

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `${writerCtx}คุณเป็นนักเขียนนิยาย ต้องการสร้างตัวละครใหม่สำหรับ Season ต่อไปของนิยาย
ชื่อนิยาย: ${novel?.title}
แนว: ${novel?.genre || ""}
Season ใหม่ชื่อ: "${seasonTitle}"
เนื้อเรื่องย่อ Season ใหม่: ${seasonSynopsis}
ตัวละครเดิมที่มีอยู่: 
${charSummary || "(ยังไม่มี)"}

กรุณาสร้างตัวละครใหม่ที่จำเป็นสำหรับพล็อตของ Season นี้ (2-4 ตัว) ที่ไม่ซ้ำกับตัวละครเดิม`,
      response_json_schema: {
        type: "object",
        properties: {
          characters: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                role: { type: "string", enum: ["ตัวเอก", "ตัวรอง", "ตัวร้าย", "ตัวประกอบ"] },
                age: { type: "string" },
                occupation: { type: "string" },
                appearance: { type: "string" },
                personality: { type: "string" },
                background: { type: "string" },
                desire: { type: "string" },
              },
            },
          },
        },
      },
    });
    setAiNewChars(result.characters || []);
    setGeneratingChars(false);
  }

  async function handleCreate() {
    if (!seasonTitle.trim()) { toast.error("กรุณากรอกชื่อ Season"); return; }
    setCreating(true);

    try {
      // หาเลข Season ถัดไป
      const maxSeasonNumber = seasons.reduce((max, s) => Math.max(max, s.season_number || 1), 0);
      const newSeasonNumber = maxSeasonNumber + 1;

      // สร้าง Season ใหม่ — lock writer_id จาก parent novel เสมอ
      const newSeason = await base44.entities.Novel.create({
        title: seasonTitle,
        genre: novel.genre,
        synopsis: seasonSynopsis || novel.synopsis,
        era: novel.era,
        status: "กำลังเขียน",
        writer_id: novel.writer_id || "", // ★ สำคัญ: lock writer จาก parent novel — ห้ามให้ null
        series_id: novel.series_id || "",
        parent_novel_id: novel.id,
        season_number: newSeasonNumber,
        novel_type: novel.novel_type || "นิยายยาว",
        target_chapters: parseInt(targetChapters) || novel.target_chapters || 10,
        word_count_target: novel.word_count_target || 1500,
        ending_type: novel.ending_type || "",
      });

      // คัดลอกตัวละครที่เลือก
      const charsToInherit = existingChars.filter((c) => inheritedChars.includes(c.id));
      await Promise.all(
        charsToInherit.map((c) =>
          base44.entities.Character.create({
            novel_id: newSeason.id,
            name: c.name,
            role: c.role,
            age: c.age || "",
            occupation: c.occupation || "",
            dialect: c.dialect || "กลาง",
            dialect_examples: c.dialect_examples || "",
            appearance: c.appearance || "",
            personality: c.personality || "",
            background: c.background || "",
            desire: c.desire || "",
            wound: c.wound || "",
            relationships: c.relationships || "",
          })
        )
      );

      // สร้างตัวละครใหม่จาก AI
      await Promise.all(
        aiNewChars.map((c) =>
          base44.entities.Character.create({
            novel_id: newSeason.id,
            name: c.name,
            role: c.role || "ตัวประกอบ",
            age: c.age || "",
            occupation: c.occupation || "",
            appearance: c.appearance || "",
            personality: c.personality || "",
            background: c.background || "",
            desire: c.desire || "",
          })
        )
      );

      queryClient.invalidateQueries({ queryKey: ["seasons", novel?.id] });
      queryClient.invalidateQueries({ queryKey: ["episodes", novel?.series_id] });
      setCreatedSeasonId(newSeason.id);
      setCreating(false);
      setSavedSuccess(true);
      setSuccessDialog({ open: true, seasonTitle: seasonTitle });
      toast.success("สร้าง Season สำเร็จ");
    } catch (error) {
      console.error("Failed to create Season:", error);
      toast.error("ไม่สามารถสร้าง Season ได้ กรุณาลองใหม่อีกครั้ง");
      setCreating(false);
    }
  }

  function handleClose() {
    setStep(1);
    setSeasonTitle("");
    setSeasonSynopsis("");
    setTargetChapters("10");
    setAiNewChars([]);
    setInheritedChars([]);
    setSeasonGenerated(false);
    setSavedSuccess(false);
    setCreatedSeasonId(null);
    setSuccessDialog({ open: false, seasonTitle: "" });
    onClose();
  }

  const roleColors = {
    "ตัวเอก": "bg-primary/10 text-primary border-primary/20",
    "ตัวรอง": "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300",
    "ตัวร้าย": "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300",
    "ตัวประกอบ": "bg-muted text-muted-foreground border-border",
  };

  const currentSeason = seasons.find(s => String(s.id) === String(novel?.id));
  const seasonNumber = currentSeason?.season_number || 1;

  // ถ้า step = 0 แสดงหน้าเลือกรายการ Season (mode เดิม)
  if (step === 0) {
    return (
      <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              จัดการ Season
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Current Season Info */}
            <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Season ปัจจุบัน</span>
                <Badge className="bg-primary text-primary-foreground">
                  Season {seasonNumber}
                </Badge>
              </div>
              <p className="font-semibold text-lg">{novel?.title}</p>
              {novel?.synopsis && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{novel.synopsis}</p>
              )}
            </div>

            {/* All Seasons List */}
            <div>
              <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-muted-foreground" />
                Season ทั้งหมด ({seasons.length})
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {seasons.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    ยังไม่มี Season
                  </p>
                ) : (
                  seasons.map((season, idx) => (
                    <div
                      key={season.id}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                        String(season.id) === String(novel?.id)
                          ? "bg-primary/10 border-primary/30"
                          : "bg-card hover:bg-accent/50 border-border"
                      }`}
                      onClick={() => {
                        onSeasonChange?.(season);
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            Season {season.season_number || idx + 1}
                          </Badge>
                          <span className="font-medium truncate">{season.title}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {season.target_chapters || 10} ตอน · {season.word_count_target?.toLocaleString() || 1500} คำ/ตอน
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {String(season.id) === String(novel?.id) ? (
                          <Badge className="bg-primary text-primary-foreground">ปัจจุบัน</Badge>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDeleteDialog({ open: true, season });
                            }}
                            className="w-7 h-7 rounded-lg bg-destructive/10 hover:bg-destructive/20 flex items-center justify-center transition-all text-destructive"
                            title="ลบ Season นี้"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Create New Season Button */}
            <Button
              variant="outline"
              className="w-full gap-2 border-dashed"
              onClick={() => setStep(1)}
            >
              <Plus className="w-4 h-4" />
              เพิ่ม Season
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, season: deleteDialog.season })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">ยืนยันการลบ Season</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบ "<strong>{deleteDialog.season?.title}</strong>" ใช่หรือไม่?
              <br /><br />
              การลบจะ<strong>ซ่อน</strong> Season นี้และตอนทั้งหมดใน Season นี้ (สามารถกู้คืนจากถังขยะได้)
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteSeasonMutation.mutate(deleteDialog.season?.id)}
              disabled={deleteSeasonMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSeasonMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />กำลังลบ...</> : "ลบ Season"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </>
    );
  }

  // Mode: Wizard สร้าง Season ใหม่
  return (
    <>
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
          <DialogTitle className="font-heading text-xl flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            สร้าง Season ใหม่
          </DialogTitle>
          <DialogDescription>
            ภาคต่อจาก "{novel?.title}" — ตัวละครเดิมจะนำข้ามมาได้ และ AI จะสร้างตัวละครใหม่ตามพล็อต
          </DialogDescription>
          {/* Steps */}
          <div className="flex items-center gap-2 mt-3">
            {["กำหนด Season", "ตัวละคร", "ยืนยัน"].map((label, i) => (
              <React.Fragment key={i}>
                <div className={`flex items-center gap-1.5 text-xs font-medium ${step === i + 1 ? "text-primary" : step > i + 1 ? "text-muted-foreground" : "text-muted-foreground/50"}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${step === i + 1 ? "bg-primary text-primary-foreground border-primary" : step > i + 1 ? "bg-muted border-border text-muted-foreground" : "border-border/40 text-muted-foreground/40"}`}>
                    {step > i + 1 ? <Check className="w-3 h-3" /> : i + 1}
                  </span>
                  {label}
                </div>
                {i < 2 && <ChevronRight className="w-3 h-3 text-muted-foreground/30" />}
              </React.Fragment>
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Step 1: กำหนด Season */}
          {step === 1 && (
            <div className="space-y-4">
              {!seasonGenerated ? (
                <div className="space-y-4">
                  <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <Sparkles className="w-7 h-7 text-primary" />
                    </div>
                    <div>
                      <p className="font-heading font-semibold text-base mb-1">ให้ AI สร้างข้อมูล Season ใหม่</p>
                      <p className="text-sm text-muted-foreground">
                        AI จะใช้สไตล์ของ{writer ? <span className="text-primary font-medium"> {writer.name}</span> : "นักเขียน AI ที่เลือกไว้"}<br />
                        สร้างชื่อ Season และเรื่องย่อที่ต่อเนื่องจาก "{novel?.title}" อัตโนมัติ
                      </p>
                    </div>
                    <Button
                      onClick={handleGenerateSeason}
                      disabled={generatingSeason || !writer}
                      size="lg"
                      className="gap-2 px-8 mt-2"
                    >
                      {generatingSeason
                        ? <><Loader2 className="w-4 h-4 animate-spin" />กำลังสร้าง Season...</>
                        : <><Sparkles className="w-4 h-4" />สร้าง Season ใหม่</>}
                    </Button>
                    {!novel?.writer_id && (
                      <div className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
                        ⚠️ นิยายนี้ยังไม่มีนักเขียน AI กรุณาแก้ไขนิยายและเลือกนักเขียนก่อนสร้าง Season ใหม่
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-3">หรือกรอกข้อมูลเอง</p>
                    <Button
                      variant="outline"
                      onClick={() => setSeasonGenerated(true)}
                      className="gap-1.5"
                    >
                      <Sparkles className="w-4 h-4" />
                      กรอกข้อมูล Season เอง
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-muted-foreground">แก้ไขข้อมูลได้ตามต้องการ</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-xs h-7 text-muted-foreground"
                      onClick={handleGenerateSeason}
                      disabled={generatingSeason}
                    >
                      {generatingSeason ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      สร้างใหม่
                    </Button>
                  </div>
                  <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 mb-2">
                    <p className="text-xs text-muted-foreground">
                      💡 เนื้อหานี้สร้างโดย AI คุณสามารถแก้ไขชื่อ Season พล็อต หรือเรื่องย่อให้ตรงใจก่อนดำเนินการต่อ
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">ชื่อ Season ใหม่ <span className="text-destructive">*</span></label>
                    <Input
                      placeholder="ตั้งชื่อภาคนี้ (ชื่อล้วน ๆ ไม่ต้องใส่ 'Season X:' หรือชื่อเรื่องหลัก)"
                      value={seasonTitle}
                      onChange={(e) => setSeasonTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">เนื้อเรื่องย่อ Season ใหม่</label>
                    <Textarea
                      placeholder="เรื่องย่อของ Season นี้..."
                      value={seasonSynopsis}
                      onChange={(e) => setSeasonSynopsis(e.target.value)}
                      className="h-32 resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">จำนวนตอนที่วางแผน</label>
                    <Select value={targetChapters} onValueChange={setTargetChapters}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10 ตอน</SelectItem>
                        <SelectItem value="20">20 ตอน</SelectItem>
                        <SelectItem value="30">30 ตอน</SelectItem>
                        <SelectItem value="40">40 ตอน</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: ตัวละคร */}
          {step === 2 && (
            <div className="space-y-5">
              {/* ตัวละครเดิม */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-primary" />
                    ตัวละครเดิม — เลือกที่จะนำข้ามมา
                  </h3>
                  <span className="text-xs text-muted-foreground">{inheritedChars.length}/{existingChars.length} เลือก</span>
                </div>
                {existingChars.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded-xl">ไม่มีตัวละครในนิยายนี้</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {existingChars.map((c) => {
                      const selected = inheritedChars.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          onClick={() => toggleChar(c.id)}
                          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all ${selected ? "border-primary/40 bg-primary/5" : "border-border/50 bg-muted/20 opacity-60"}`}
                        >
                          <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${selected ? "bg-primary border-primary" : "border-border"}`}>
                            {selected && <Check className="w-3 h-3 text-primary-foreground" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{c.name}</p>
                            <Badge className={`text-[10px] px-1.5 py-0 mt-0.5 ${roleColors[c.role] || roleColors["ตัวประกอบ"]}`}>
                              {c.role}
                            </Badge>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ตัวละครใหม่ */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-primary" />
                    ตัวละครใหม่ที่ AI สร้าง
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-7 text-xs text-primary border-primary/20"
                    onClick={handleGenerateNewChars}
                    disabled={generatingChars}
                  >
                    {generatingChars ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    {aiNewChars.length > 0 ? "สร้างใหม่" : "สร้างตัวละครใหม่"}
                  </Button>
                </div>
                {generatingChars ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    AI กำลังสร้างตัวละครใหม่...
                  </div>
                ) : aiNewChars.length === 0 ? (
                  <div className="text-center py-6 bg-muted/20 rounded-xl border border-dashed border-border/40">
                    <Plus className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">กดปุ่ม "สร้างตัวละครใหม่" เพื่อให้ AI สร้างตัวละครที่เหมาะกับพล็อต Season ใหม่</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {aiNewChars.map((c, i) => (
                      <div key={i} className="px-4 py-3 rounded-xl border border-border/50 bg-card/60">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-semibold text-sm">{c.name}</p>
                          <Badge className={`text-[10px] px-1.5 ${roleColors[c.role] || roleColors["ตัวประกอบ"]}`}>{c.role}</Badge>
                        </div>
                        {c.occupation && <p className="text-xs text-muted-foreground">อาชีพ: {c.occupation}</p>}
                        {c.personality && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{c.personality}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: ยืนยัน */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-2xl p-4 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">ชื่อ Season ใหม่</p>
                  <p className="font-heading font-semibold text-base">{seasonTitle}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">เนื้อเรื่องย่อ (แก้ไขได้)</p>
                  <Textarea
                    value={seasonSynopsis}
                    onChange={(e) => setSeasonSynopsis(e.target.value)}
                    placeholder="เรื่องย่อของ Season นี้..."
                    className="resize-none h-24"
                  />
                </div>
                <div className="flex gap-6 pt-1">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-primary">{inheritedChars.length}</p>
                    <p className="text-xs text-muted-foreground">ตัวละครเดิม</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-primary">{aiNewChars.length}</p>
                    <p className="text-xs text-muted-foreground">ตัวละครใหม่</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-primary">{targetChapters}</p>
                    <p className="text-xs text-muted-foreground">จำนวนตอน</p>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                ระบบจะสร้าง Season ใหม่ใน Series เดียวกัน พร้อมตัวละครที่เลือก
              </p>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="px-6 py-4 border-t border-border/40 shrink-0 flex justify-between gap-3">
          <Button variant="outline" onClick={step === 1 ? handleClose : () => setStep(s => s - 1)}>
            {step === 1 ? "ยกเลิก" : "ย้อนกลับ"}
          </Button>
          <div className="flex gap-2">
            {step === 1 && seasonGenerated && !savedSuccess && (
              <>
                <Button
                  variant="outline"
                  className="gap-1.5"
                  onClick={handleCreate}
                  disabled={!seasonTitle.trim() || creating}
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  บันทึก
                </Button>
                <Button
                  onClick={() => setStep(2)}
                  disabled={!seasonTitle.trim()}
                >
                  ถัดไป <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </>
            )}
            {step === 1 && savedSuccess && (
              <>
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 px-3">
                  <Check className="w-5 h-5" />
                  <span className="font-medium text-sm">บันทึกสำเร็จ!</span>
                </div>
                <Button
                  onClick={() => {
                    toast.success(`สร้าง Season ใหม่ "${seasonTitle}" เรียบร้อยแล้ว!`);
                    onSeasonChange?.(seasons.find(s => String(s.id) === String(createdSeasonId)) || { id: createdSeasonId });
                    onClose();
                  }}
                  className="gap-1.5"
                >
                  ถัดไป <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </>
            )}
            {step === 2 && (
              <Button onClick={() => setStep(3)}>
                ถัดไป <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
            {step === 3 && (
              <Button onClick={handleCreate} disabled={creating} className="gap-2">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                ตกลง สร้าง Season
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Delete Confirmation Dialog */}
    <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, season: deleteDialog.season })}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading">ยืนยันการลบ Season</AlertDialogTitle>
          <AlertDialogDescription>
            คุณต้องการลบ "<strong>{deleteDialog.season?.title}</strong>" ใช่หรือไม่?
            <br /><br />
            การลบจะ<strong>ซ่อน</strong> Season นี้และตอนทั้งหมดใน Season นี้ (สามารถกู้คืนจากถังขยะได้)
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deleteSeasonMutation.mutate(deleteDialog.season?.id)}
            disabled={deleteSeasonMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteSeasonMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />กำลังลบ...</> : "ลบ Season"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Success Dialog */}
    <AlertDialog open={successDialog.open} onOpenChange={(open) => setSuccessDialog({ open, seasonTitle: successDialog.seasonTitle })}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading flex items-center gap-2">
            <Check className="w-5 h-5 text-emerald-600" />
            สร้าง Season สำเร็จ
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center py-2">
            ได้สร้าง Season ใหม่ "<strong>{successDialog.seasonTitle}</strong>" เรียบร้อยแล้ว
            <br />
            พร้อมเริ่มเขียนตอนแรกแล้ว
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-center">
          <Button
            onClick={() => {
              setSuccessDialog({ open: false, seasonTitle: "" });
              onSeasonChange?.(seasons.find(s => String(s.id) === String(createdSeasonId)) || { id: createdSeasonId });
              onClose();
            }}
            className="min-w-[120px]"
          >
            ตกลง
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}