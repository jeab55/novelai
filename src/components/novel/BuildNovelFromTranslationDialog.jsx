import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, BookOpen, BookText, CheckCircle2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

function countWords(text) {
  if (!text) return 0;
  try {
    const seg = new Intl.Segmenter("th", { granularity: "word" });
    return [...seg.segment(text)].filter((s) => s.isWordLike).length;
  } catch {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }
}

// ดึงเนื้อหาที่ดัดแปลงไว้ (ถ้าไม่มีร่างดัดแปลง ใช้ต้นฉบับแปล)
function getSourceMaterial(project) {
  let drafts = [];
  let translations = [];
  try { drafts = JSON.parse(project.drafts || "[]"); } catch { /* ignore */ }
  try { translations = JSON.parse(project.translations || "[]"); } catch { /* ignore */ }
  const draftText = drafts.map((d) => d.content).filter((c) => c?.trim()).join("\n\n");
  const transText = translations.map((t) => t.text).filter((c) => c?.trim()).join("\n\n");
  return (draftText || transText || "").trim();
}

export default function BuildNovelFromTranslationDialog({ project, open, onClose }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState("long"); // long | short
  const [writerId, setWriterId] = useState("");
  const [step, setStep] = useState("setup"); // setup | working | done
  const [statusMsg, setStatusMsg] = useState("");
  const [createdId, setCreatedId] = useState(null);

  const { data: writers = [] } = useQuery({
    queryKey: ["writers"],
    queryFn: () => base44.entities.Writer.list(),
    enabled: open,
  });
  const activeWriters = writers.filter((w) => w.is_active !== false);

  React.useEffect(() => {
    if (open) { setMode("long"); setWriterId(""); setStep("setup"); setStatusMsg(""); setCreatedId(null); }
  }, [open, project]);

  if (!project) return null;

  const sourceMaterial = getSourceMaterial(project);

  const handleBuild = async () => {
    if (!sourceMaterial) { toast.error("ไม่พบเนื้อหาที่ดัดแปลงไว้ในรายการนี้"); return; }
    setStep("working");

    try {
      const writerRecord = activeWriters.find((w) => w.id === writerId);
      const writerStyle = writerRecord?.system_prompt || "คุณคือนักเขียนนิยายภาษาไทยมืออาชีพ ใช้ภาษาสละสลวย เห็นภาพ";
      const isShort = mode === "short";

      // ─── ขั้น 1: ให้ AI สกัดโครงเรื่องตั้งต้นจากเนื้อหาที่นำเข้ามา ───
      setStatusMsg("🧠 AI กำลังวิเคราะห์เนื้อหา สกัดตัวละคร ฉาก และเหตุการณ์...");
      const material = sourceMaterial.slice(0, 16000);
      const setupRes = await base44.integrations.Core.InvokeLLM({
        prompt: `${writerStyle}

ด้านล่างคือเนื้อหาที่ผู้เขียนแปลและดัดแปลงไว้ ใช้เป็น "วัตถุดิบตั้งต้น" สำหรับสร้างนิยาย${isShort ? "เรื่องสั้น" : "เรื่องใหม่หลายตอน"}:

"""
${material}
"""

อ่านเนื้อหาทั้งหมด แล้วสกัดข้อมูลออกมาเป็น JSON โดย "ยึดตามเนื้อหาที่ให้มา" — ตัวละคร ฉาก และเหตุการณ์ต้องดึงจากเนื้อหานี้ ไม่ใช่แต่งใหม่:
{
  "title": "ชื่อเรื่องที่เหมาะกับเนื้อหา",
  "synopsis": "เรื่องย่อ 2-4 ประโยค สรุปจากเนื้อหาจริง",
  "era": "ยุคสมัย/ฉากหลังตามเนื้อหา",
  "characters": [
    { "name": "ชื่อตัวละครที่ปรากฏในเนื้อหา", "role": "ตัวเอก|ตัวรอง|ตัวร้าย|ตัวประกอบ", "age": "อายุถ้ามี", "personality": "นิสัยที่สังเกตได้", "background": "ปูมหลังจากเนื้อหา", "desire": "สิ่งที่ตัวละครต้องการ", "voice_profile": "เสียงพูด (ลายนิ้วมือเสียง) ที่สังเกตได้จากบทสนทนา: คำติดปาก จังหวะประโยค สรรพนาม/คำลงท้าย ระดับภาษา", "address_terms": "สรรพนาม & คำเรียกขาน (รายคู่): ตัวละครเรียกตัวเอง/เรียกตัวละครอื่นแต่ละคนว่าอะไร ตามที่ปรากฏในเนื้อหา" }
  ],
  "plot_outline": "โครงเรื่องตั้งต้นจากเนื้อหาจริง — เหตุการณ์/ฉากสำคัญเรียงตามลำดับ${isShort ? " (โครง 3 องก์บีบอัด)" : " ครอบคลุมทั้งเรื่อง"}"
}

กฎ: ใช้ภาษาไทย ตอบ JSON เท่านั้น ไม่มีข้อความอื่น`,
        model: "claude_sonnet_4_6",
        response_json_schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            synopsis: { type: "string" },
            era: { type: "string" },
            plot_outline: { type: "string" },
            characters: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  role: { type: "string" },
                  age: { type: "string" },
                  personality: { type: "string" },
                  background: { type: "string" },
                  desire: { type: "string" },
                  voice_profile: { type: "string" },
                  address_terms: { type: "string" },
                },
              },
            },
          },
        },
      });

      const seed = setupRes || {};
      const characters = seed.characters || [];

      // ─── ขั้น 2: สร้าง Novel ───
      setStatusMsg("💾 กำลังสร้างเรื่องและบันทึกโครงตั้งต้น...");
      const novel = await base44.entities.Novel.create({
        title: seed.title || project.name || "นิยายจากงานแปล",
        genre: project.genre || undefined,
        synopsis: seed.synopsis || "",
        era: seed.era || "",
        plot_outline: seed.plot_outline || "",
        novel_type: isShort ? "เรื่องสั้น" : "นิยายยาว",
        target_chapters: isShort ? 1 : 10,
        word_count_target: isShort ? 2000 : 1500,
        ending_type: "จบตามจริง",
        writer_id: writerId || undefined,
        status: "กำลังเขียน",
      });

      // ─── ขั้น 3: บันทึกตัวละครที่สกัดได้ ───
      if (characters.length > 0) {
        await Promise.all(
          characters.filter((c) => c.name?.trim()).map((c) =>
            base44.entities.Character.create({
              novel_id: novel.id,
              name: c.name.trim(),
              role: c.role || "ตัวประกอบ",
              age: c.age || undefined,
              personality: c.personality || undefined,
              background: c.background || undefined,
              desire: c.desire || undefined,
              voice_profile: c.voice_profile || undefined,
              address_terms: c.address_terms || undefined,
            })
          )
        );
      }

      // ─── ขั้น 4: สร้างตอน/เล่มจริงในห้องเขียน ───
      let drafts = [];
      try { drafts = JSON.parse(project.drafts || "[]"); } catch { /* ignore */ }
      const validDrafts = drafts.filter((d) => d.content?.trim());

      setStatusMsg("✍️ กำลังสร้างตอนในห้องเขียน...");
      if (isShort) {
        // เรื่องสั้น — รวมร่างเป็นตอนเดียว
        const content = validDrafts.length > 0
          ? validDrafts.map((d) => d.content).join("\n\n")
          : sourceMaterial;
        await base44.entities.Chapter.create({
          novel_id: novel.id,
          title: seed.title || project.name || "เรื่องสั้น",
          order: 1,
          status: "ร่าง",
          content,
          word_count: countWords(content),
        });
      } else {
        // เรื่องใหม่หลายตอน — แต่ละร่างเป็น 1 ตอน (ถ้าไม่มีร่าง ใช้เนื้อหารวมเป็นตอนแรก)
        const chapterDrafts = validDrafts.length > 0
          ? validDrafts
          : [{ title: "ตอนที่ 1", content: sourceMaterial }];
        let order = 0;
        for (const d of chapterDrafts) {
          order += 1;
          await base44.entities.Chapter.create({
            novel_id: novel.id,
            title: d.title || `ตอนที่ ${order}`,
            content: d.content,
            order,
            status: "ร่าง",
            word_count: countWords(d.content),
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ["novels"] });
      queryClient.invalidateQueries({ queryKey: ["novels-all"] });
      queryClient.invalidateQueries({ queryKey: ["chapters", novel.id] });

      setCreatedId(novel.id);
      setStep("done");
      toast.success(`สร้าง${isShort ? "เรื่องสั้น" : "นิยาย"}จากงานแปลสำเร็จ!`);
    } catch (e) {
      setStep("setup");
      toast.error("สร้างไม่สำเร็จ: " + (e.message || ""));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && step !== "working" && onClose()}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-md max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/60 shrink-0">
          <DialogTitle className="font-heading flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-primary" />
            นำไปสร้างเป็นนิยาย
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">จากงานแปล: {project.name}</p>
        </DialogHeader>

        {step === "setup" && (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">เลือกรูปแบบที่จะสร้าง</label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setMode("long")}
                  className={`rounded-xl border p-3 text-left transition-colors ${mode === "long" ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted/40"}`}
                >
                  <BookOpen className={`w-5 h-5 mb-1.5 ${mode === "long" ? "text-primary" : "text-muted-foreground"}`} />
                  <p className="text-sm font-medium">เรื่องใหม่</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">เล่ม / หลายตอน</p>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("short")}
                  className={`rounded-xl border p-3 text-left transition-colors ${mode === "short" ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted/40"}`}
                >
                  <BookText className={`w-5 h-5 mb-1.5 ${mode === "short" ? "text-primary" : "text-muted-foreground"}`} />
                  <p className="text-sm font-medium">เรื่องสั้น</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">จบในตอนเดียว</p>
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">นักเขียน AI <span className="text-muted-foreground font-normal">(ไม่บังคับ)</span></label>
              <Select value={writerId || "none"} onValueChange={(v) => setWriterId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="เลือกนักเขียน AI" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ไม่เลือก (ใช้สไตล์เริ่มต้น)</SelectItem>
                  {activeWriters.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      <span className="font-medium">{w.name}</span>
                      {w.description && <span className="text-muted-foreground ml-1 text-xs">— {w.description}</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-xs text-foreground/80">
              <p className="font-medium mb-1 flex items-center gap-1.5 text-primary"><Sparkles className="w-3.5 h-3.5" />AI จะใช้เนื้อหาที่ดัดแปลงเป็นโครงตั้งต้น</p>
              <ul className="space-y-0.5 text-muted-foreground">
                <li>✓ สกัดตัวละคร ฉาก และเหตุการณ์จากเนื้อหา</li>
                <li>✓ วางชื่อเรื่อง เรื่องย่อ และโครงพล็อต</li>
                <li>✓ สร้างเป็น{mode === "short" ? "เรื่องสั้น 1 ตอน" : "ตอนจริงหลายตอน"}ในห้องเขียนที่แก้ไขต่อได้</li>
              </ul>
            </div>
          </div>
        )}

        {step === "working" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-12 px-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-primary animate-spin" />
            </div>
            <div>
              <p className="font-heading font-semibold text-lg">กำลังสร้างนิยาย...</p>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed max-w-xs">{statusMsg}</p>
            </div>
            <p className="text-xs text-muted-foreground">อาจใช้เวลา 1-2 นาที กรุณาอย่าปิดหน้าต่างนี้</p>
          </div>
        )}

        {step === "done" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-10 px-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-emerald-500" />
            </div>
            <div>
              <p className="font-heading font-semibold text-lg">สร้างสำเร็จ!</p>
              <p className="text-sm text-muted-foreground mt-1">เปิดในห้องเขียนเพื่อแก้ไขต่อได้เลย</p>
            </div>
          </div>
        )}

        <div className="px-6 py-4 border-t border-border/60 shrink-0 flex items-center justify-end gap-2">
          {step === "setup" && (
            <>
              <Button variant="ghost" size="sm" onClick={onClose}>ยกเลิก</Button>
              <Button onClick={handleBuild} className="gap-2">
                <Sparkles className="w-4 h-4" />
                สร้าง{mode === "short" ? "เรื่องสั้น" : "เรื่องใหม่"}
              </Button>
            </>
          )}
          {step === "done" && (
            <>
              <Button variant="outline" size="sm" onClick={onClose}>ปิด</Button>
              <Button className="gap-2" onClick={() => { onClose(); navigate(`/novel/${createdId}`); }}>
                <BookOpen className="w-4 h-4" />
                เปิดในห้องเขียน
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}