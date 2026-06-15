import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Users, Plus, Check, ChevronRight, Save, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function NewEpisodeDialog({ open, onClose, novel }) {
  const [step, setStep] = useState(1); // 1=setup, 2=characters, 3=confirm
  const [epTitle, setEpTitle] = useState("");
  const [epSynopsis, setEpSynopsis] = useState("");
  const [inheritedChars, setInheritedChars] = useState([]);
  const [aiNewChars, setAiNewChars] = useState([]);
  const [generatingChars, setGeneratingChars] = useState(false);
  const [creating, setCreating] = useState(false);
  const [generatingEp, setGeneratingEp] = useState(false);
  const [epGenerated, setEpGenerated] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const novelId = novel?.id;

  // โหลดตัวละครจาก EP นี้
  const { data: existingChars = [] } = useQuery({
    queryKey: ["characters", novelId],
    queryFn: () => base44.entities.Character.filter({ novel_id: novelId }),
    enabled: !!novelId && open,
    select: (data) => data.filter((c) => !c.is_deleted),
  });

  // โหลด Writer ของนิยายนี้
  const { data: writer } = useQuery({
    queryKey: ["writers-all"],
    queryFn: () => base44.entities.Writer.list(),
    enabled: !!novel?.writer_id,
    select: (data) => data.find((w) => String(w.id) === String(novel?.writer_id)),
  });

  // โหลด EP ก่อนหน้าทั้งหมดใน Series เดียวกัน
  const { data: prevEpisodes = [] } = useQuery({
    queryKey: ["series-novels", novel?.series_id],
    queryFn: () => base44.entities.Novel.filter({ series_id: novel.series_id }),
    enabled: !!novel?.series_id && open,
    select: (data) => data.filter((n) => !n.is_deleted && n.id !== novelId),
  });

  // ถ้า existingChars โหลดครั้งแรก → select ทั้งหมด
  React.useEffect(() => {
    if (existingChars.length > 0 && inheritedChars.length === 0) {
      setInheritedChars(existingChars.map((c) => c.id));
    }
  }, [existingChars]);

  function toggleChar(id) {
    setInheritedChars((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleGenerateEp() {
    setGeneratingEp(true);
    const writerCtx = writer?.system_prompt
      ? `[สไตล์และโทนการเขียน]\n${writer.system_prompt}\n\n`
      : "";
    const charSummary = existingChars.map((c) => `${c.name} (${c.role}) — ${c.personality || ""}`).join("\n");

    // สรุป EP ก่อนหน้าทั้งหมด เรียงตามลำดับ
    const prevEpCtx = prevEpisodes.length > 0
      ? `\n[EP ก่อนหน้าในซีรีส์]\n` + prevEpisodes.map((ep, i) =>
          `EP ${i + 1}: ${ep.title}\nเรื่องย่อ: ${ep.synopsis || "(ไม่มีเรื่องย่อ)"}`
        ).join("\n\n")
      : "";

    const currentEpCtx = `\n[EP ปัจจุบัน (EP ที่กำลังต่อ)]\nชื่อ: ${novel?.title}\nเรื่องย่อ: ${novel?.synopsis || "(ไม่มีเรื่องย่อ)"}`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `${writerCtx}คุณเป็นนักเขียนนิยายซีรีส์ ต้องการสร้าง EP ใหม่ที่ต่อเนื่องและเชื่อมโยงกับ EP ก่อนหน้า
ชื่อซีรีส์/นิยาย: ${novel?.title}
แนว: ${novel?.genre || ""}
${prevEpCtx}
${currentEpCtx}

ตัวละครหลักที่มีอยู่ใน EP ปัจจุบัน:
${charSummary || "(ยังไม่มี)"}

กรุณาสร้างชื่อ EP ใหม่และเรื่องย่อสำหรับ EP ถัดไป โดย:
- ต้องมีเหตุการณ์ใหม่ที่ต่อเนื่องจากเหตุการณ์ใน EP ก่อนหน้า
- แสดงผลกระทบหรือความเปลี่ยนแปลงที่เกิดขึ้นจาก EP ก่อนหน้า
- ตัวละครเดิมต้องปรากฏและมีพัฒนาการต่อเนื่อง
- เรื่องราวต้องสดใหม่ แต่มีความเชื่อมโยงเป็นเนื้อเดียวกันกับทั้งซีรีส์`,
      response_json_schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          synopsis: { type: "string" },
        },
      },
    });
    setEpTitle(result.title || "");
    setEpSynopsis(result.synopsis || "");
    setEpGenerated(true);
    setGeneratingEp(false);
  }

  async function handleGenerateNewChars() {
    setGeneratingChars(true);
    const selectedChars = existingChars.filter((c) => inheritedChars.includes(c.id));
    const charSummary = selectedChars.map((c) => `${c.name} (${c.role}) — ${c.personality || ""}`).join("\n");
    const writerCtx = writer?.system_prompt
      ? `[สไตล์และโทนการเขียน]\n${writer.system_prompt}\n\n`
      : "";

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `${writerCtx}คุณเป็นนักเขียนนิยาย ต้องการสร้างตัวละครใหม่สำหรับ EP ต่อไปของนิยาย
ชื่อนิยาย: ${novel?.title}
แนว: ${novel?.genre || ""}
EP ใหม่ชื่อ: "${epTitle}"
เนื้อเรื่องย่อ EP ใหม่: ${epSynopsis}
ตัวละครเดิมที่มีอยู่: 
${charSummary || "(ยังไม่มี)"}

กรุณาสร้างตัวละครใหม่ที่จำเป็นสำหรับพล็อตของ EP นี้ (2-4 ตัว) ที่ไม่ซ้ำกับตัวละครเดิม`,
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
    if (!epTitle.trim()) { toast.error("กรุณากรอกชื่อ EP"); return; }
    setCreating(true);

    // 1. หาเลข EP ถัดไปในซีรีส์เดียวกัน
    const siblingsAll = await base44.entities.Novel.filter({ series_id: novel.series_id || "" });
    const siblings = siblingsAll.filter((n) => !n.is_deleted);
    const epNumber = siblings.length + 1;

    // 2. สร้างนิยายใหม่
    const newNovel = await base44.entities.Novel.create({
      title: epTitle,
      genre: novel.genre,
      synopsis: epSynopsis || novel.synopsis,
      era: novel.era,
      status: "กำลังเขียน",
      writer_id: novel.writer_id || "",
      series_id: novel.series_id || "",
      novel_type: novel.novel_type || "นิยายยาว",
      target_chapters: novel.target_chapters || 10,
      word_count_target: novel.word_count_target || 1500,
      ending_type: novel.ending_type || "",
    });

    // 3. คัดลอกตัวละครที่เลือก
    const charsToInherit = existingChars.filter((c) => inheritedChars.includes(c.id));
    await Promise.all(
      charsToInherit.map((c) =>
        base44.entities.Character.create({
          novel_id: newNovel.id,
          name: c.name,
          role: c.role,
          age: c.age || "",
          occupation: c.occupation || "",
          appearance: c.appearance || "",
          personality: c.personality || "",
          background: c.background || "",
          desire: c.desire || "",
          wound: c.wound || "",
          relationships: c.relationships || "",
        })
      )
    );

    // 4. สร้างตัวละครใหม่จาก AI
    await Promise.all(
      aiNewChars.map((c) =>
        base44.entities.Character.create({
          novel_id: newNovel.id,
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

    // 5. อัปเดต Series total_episodes ถ้ามี
    if (novel.series_id) {
      await base44.entities.Series.update(novel.series_id, {
        total_episodes: epNumber,
      });
    }

    queryClient.invalidateQueries({ queryKey: ["novels"] });
    toast.success(`สร้าง EP ใหม่ "${epTitle}" เรียบร้อยแล้ว!`);
    setCreating(false);
    onClose();
    navigate(`/novel/${newNovel.id}`);
  }

  function handleClose() {
    setStep(1);
    setEpTitle("");
    setEpSynopsis("");
    setAiNewChars([]);
    setInheritedChars([]);
    setEpGenerated(false);
    onClose();
  }

  const roleColors = {
    "ตัวเอก": "bg-primary/10 text-primary border-primary/20",
    "ตัวรอง": "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300",
    "ตัวร้าย": "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300",
    "ตัวประกอบ": "bg-muted text-muted-foreground border-border",
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
          <DialogTitle className="font-heading text-xl flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            สร้าง EP ใหม่
          </DialogTitle>
          <DialogDescription>
            ต่อจาก "{novel?.title}" — ตัวละครเดิมจะนำข้ามมาได้ และ AI จะสร้างตัวละครใหม่ตามพล็อต
          </DialogDescription>
          {/* Steps */}
          <div className="flex items-center gap-2 mt-3">
            {["กำหนด EP", "ตัวละคร", "ยืนยัน"].map((label, i) => (
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
          {/* Step 1: กำหนด EP */}
          {step === 1 && (
            <div className="space-y-4">
              {!epGenerated ? (
                <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Sparkles className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <p className="font-heading font-semibold text-base mb-1">ให้ AI สร้างข้อมูล EP ใหม่</p>
                    <p className="text-sm text-muted-foreground">
                      AI จะใช้สไตล์ของ{writer ? <span className="text-primary font-medium"> {writer.name}</span> : "นักเขียน AI ที่เลือกไว้"}<br />
                      สร้างชื่อ EP และเรื่องย่อที่ต่อเนื่องจาก "{novel?.title}" อัตโนมัติ
                    </p>
                  </div>
                  <Button
                    onClick={handleGenerateEp}
                    disabled={generatingEp}
                    size="lg"
                    className="gap-2 px-8 mt-2"
                  >
                    {generatingEp
                      ? <><Loader2 className="w-4 h-4 animate-spin" />กำลังสร้าง EP...</>
                      : <><Sparkles className="w-4 h-4" />สร้าง EP ใหม่</>}
                  </Button>
                  {!writer && (
                    <p className="text-xs text-muted-foreground/70">
                      💡 เลือก AI Writer ให้นิยายนี้เพื่อให้ผลลัพธ์ดียิ่งขึ้น
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-muted-foreground">แก้ไขข้อมูลได้ตามต้องการ</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-xs h-7 text-muted-foreground"
                      onClick={handleGenerateEp}
                      disabled={generatingEp}
                    >
                      {generatingEp ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      สร้างใหม่
                    </Button>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">ชื่อ EP ใหม่ <span className="text-destructive">*</span></label>
                    <Input
                      placeholder="เช่น ฤดูใบไม้ร่วงแห่งความรัก EP.2"
                      value={epTitle}
                      onChange={(e) => setEpTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">เนื้อเรื่องย่อ EP ใหม่</label>
                    <Textarea
                      placeholder="เรื่องย่อของ EP นี้..."
                      value={epSynopsis}
                      onChange={(e) => setEpSynopsis(e.target.value)}
                      className="h-32 resize-none"
                    />
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
                    <p className="text-sm text-muted-foreground">กดปุ่ม "สร้างตัวละครใหม่" เพื่อให้ AI สร้างตัวละครที่เหมาะกับพล็อต EP ใหม่</p>
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
                   <p className="text-xs text-muted-foreground mb-0.5">ชื่อ EP ใหม่</p>
                   <p className="font-heading font-semibold text-base">{epTitle}</p>
                 </div>
                 <div>
                   <p className="text-xs text-muted-foreground mb-1.5">เนื้อเรื่องย่อ (แก้ไขได้)</p>
                   <Textarea
                     value={epSynopsis}
                     onChange={(e) => setEpSynopsis(e.target.value)}
                     placeholder="เรื่องย่อของ EP นี้..."
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
                     <p className="text-2xl font-bold text-primary">{novel?.target_chapters || 10}</p>
                     <p className="text-xs text-muted-foreground">จำนวนตอน</p>
                   </div>
                 </div>
               </div>
               <p className="text-sm text-muted-foreground text-center">
                 ระบบจะสร้างนิยายใหม่ใน Series เดียวกัน พร้อมตัวละครที่เลือก
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
             {step === 1 && epGenerated && (
               <>
                 <Button
                   variant="outline"
                   className="gap-1.5"
                   onClick={handleCreate}
                   disabled={!epTitle.trim() || creating}
                 >
                   {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                   บันทึก
                 </Button>
                 <Button
                   onClick={() => setStep(2)}
                   disabled={!epTitle.trim()}
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
                 ตกลง สร้าง EP
               </Button>
             )}
           </div>
         </div>
      </DialogContent>
    </Dialog>
  );
}