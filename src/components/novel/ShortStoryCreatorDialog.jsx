import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, BookOpen, CheckCircle2, AlertTriangle, Bot } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { enforceWordRange, buildWordCountInstruction, getWordRange } from "@/lib/wordCountControl";
import { SHARED_CRAFT_RULES } from "@/lib/chapterContextBuilder";

const GENRES = ["โรแมนติก", "แฟนตาซี", "อิงประวัติศาสตร์", "จีนย้อนยุค", "วาย", "สยองขวัญ", "ลึกลับ", "แอ็คชั่น", "ดราม่า", "อื่นๆ"];
const ENDING_TYPES = ["จบสุข (HEA)", "จบเศร้า (HFE)", "จบเปิด (Open Ending)", "จบตามจริง"];
const WORD_COUNTS = [1000, 1500, 2000, 3000, 5000];

const countThaiWords = (text) => {
  if (!text) return 0;
  const segmenter = new Intl.Segmenter('th', { granularity: 'word' });
  let count = 0;
  for (const { isWordLike } of segmenter.segment(text)) {
    if (isWordLike) count++;
  }
  return count;
};

export default function ShortStoryCreatorDialog({ open, onOpenChange }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    idea: "",
    genre: "โรแมนติก",
    ending_type: "จบตามจริง",
    word_count_target: 2000,
    writer_id: "",
  });
  const [step, setStep] = useState("form"); // form | generating | done
  const [statusMsg, setStatusMsg] = useState("");
  const [createdNovelId, setCreatedNovelId] = useState(null);
  const [totalWords, setTotalWords] = useState(0);

  const { data: writers = [] } = useQuery({
    queryKey: ["writers"],
    queryFn: () => base44.entities.Writer.list(),
  });
  const activeWriters = writers.filter((w) => w.is_active !== false);

  const handleCreate = async () => {
    if (!form.idea.trim()) { toast.error("กรุณาใส่ไอเดียสั้นๆ ก่อน"); return; }
    setStep("generating");

    const writerRecord = activeWriters.find((w) => w.id === form.writer_id);
    const writerStyle = writerRecord?.system_prompt || "คุณคือนักเขียนนิยายภาษาไทยมืออาชีพ ใช้ภาษาสละสลวย เห็นภาพ";

    // ─── Step 1: สร้างพล็อต + ตัวละคร ───
    setStatusMsg("🧠 AI กำลังวางพล็อตและสร้างตัวละคร...");
    const setupPrompt = `${writerStyle}

คุณกำลังเตรียมเขียนเรื่องสั้นภาษาไทย 1 เรื่อง ตามไอเดียต่อไปนี้:

ไอเดีย: "${form.idea}"
แนว: ${form.genre}
รูปแบบตอนจบ: ${form.ending_type}
ความยาวเป้าหมาย: ${form.word_count_target} คำ

ให้สร้างข้อมูลต่อไปนี้ในรูปแบบ JSON:
{
  "title": "ชื่อเรื่องสั้นที่น่าสนใจ",
  "synopsis": "เรื่องย่อ 2-3 ประโยค",
  "era": "ยุคสมัย/ฉากหลังของเรื่อง",
  "characters": [
    {
      "name": "ชื่อตัวละคร",
      "role": "ตัวเอก|ตัวรอง|ตัวร้าย|ตัวประกอบ",
      "age": "อายุ",
      "appearance": "ลักษณะภายนอก 1 ประโยค",
      "personality": "นิสัย 1 ประโยค",
      "desire": "สิ่งที่ต้องการ"
    }
  ],
  "plot_outline": "โครง 3 องก์: เปิดปม / บีบให้ตึง / จุดพีคและตอนจบ (3-5 ประโยค)"
}

กฎ: ตัวละครหลักไม่เกิน 3 คน ใช้ภาษาไทย ตอบ JSON เท่านั้น ไม่มีข้อความอื่น`;

    let novelData = {};
    let characters = [];

    const setupRes = await base44.integrations.Core.InvokeLLM({
      prompt: setupPrompt,
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
                appearance: { type: "string" },
                personality: { type: "string" },
                desire: { type: "string" },
              },
            },
          },
        },
      },
    });

    novelData = setupRes || {};
    characters = novelData.characters || [];

    // ─── Step 2: บันทึก Novel ───
    setStatusMsg("💾 กำลังบันทึกข้อมูลเรื่อง...");
    const novel = await base44.entities.Novel.create({
      title: novelData.title || form.idea.substring(0, 50),
      genre: form.genre,
      synopsis: novelData.synopsis || "",
      era: novelData.era || "",
      plot_outline: novelData.plot_outline || "",
      ending_type: form.ending_type,
      word_count_target: form.word_count_target,
      novel_type: "เรื่องสั้น",
      target_chapters: 1,
      writer_id: form.writer_id || undefined,
      status: "กำลังเขียน",
    });

    // บันทึกตัวละคร
    if (characters.length > 0) {
      await Promise.all(
        characters.map((c) =>
          base44.entities.Character.create({
            novel_id: novel.id,
            name: c.name,
            role: c.role || "ตัวประกอบ",
            age: c.age || "",
            appearance: c.appearance || "",
            personality: c.personality || "",
            desire: c.desire || "",
          })
        )
      );
    }

    // ─── Step 3: เขียนเนื้อเรื่องเต็ม ───
    setStatusMsg(`✍️ AI กำลังเขียนเนื้อเรื่อง (เป้าหมาย ${form.word_count_target} คำ)...`);

    const charDesc = characters
      .map((c) => `• ${c.name} (${c.role}): ${c.personality}. ลักษณะ: ${c.appearance}. ต้องการ: ${c.desire}`)
      .join("\n");

    const endingInstruction = {
      "จบสุข (HEA)": "จบด้วยความสุขและความหวัง ตัวละครได้สิ่งที่ต้องการ",
      "จบเศร้า (HFE)": "จบด้วยการสูญเสียหรือความเสียใจ สะเทือนใจ",
      "จบเปิด (Open Ending)": "จบเปิด ไม่ฟันธง ให้ผู้อ่านตีความ",
      "จบตามจริง": "จบตามความสมจริงของเรื่อง ไม่บิดเบือน",
    }[form.ending_type] || "";

    const writePrompt = `[สไตล์นักเขียนประจำเรื่อง — แกนหลักที่ต้องยึดอย่างเคร่งครัด ใช้สำนวน น้ำเสียง โทรป และมุมมองเฉพาะตัวนี้เป็นหลักในทุกประโยค]
${writerStyle}

${SHARED_CRAFT_RULES}

เขียนเรื่องสั้นภาษาไทยให้สมบูรณ์ ตามข้อมูลต่อไปนี้:

ชื่อเรื่อง: ${novelData.title || form.idea}
แนว: ${form.genre}
ยุคสมัย: ${novelData.era || "ปัจจุบัน"}
เรื่องย่อ: ${novelData.synopsis || ""}

โครงเรื่อง:
${novelData.plot_outline || ""}

ตัวละคร:
${charDesc}

รูปแบบตอนจบ: ${endingInstruction}

[คำสั่งสำคัญ]
${buildWordCountInstruction(form.word_count_target)}- เขียนเรื่องสั้นสมบูรณ์จบในตัวเอง
- โครง 3 องก์บีบอัด: เปิดปม 20% / บีบให้ตึง 60% / จุดพีคและตอนจบ 20%
- เปิดเรื่องกลางสถานการณ์ทันที (in media res) ไม่เกริ่นนำยาว
- มีทั้งบทบรรยายและบทสนทนาที่เป็นธรรมชาติ ไม่เขียนเป็นโครงหรือสรุป
- ประโยคสุดท้ายต้องคมและค้างใจ
- ตอบด้วยเนื้อเรื่องล้วนๆ ไม่มีหัวข้อหรือคำอธิบายก่อนหน้า`;

    const contentRes = await base44.integrations.Core.InvokeLLM({
      prompt: writePrompt,
      model: "claude_sonnet_4_6",
    });

    let content = typeof contentRes === "string" ? contentRes : (contentRes?.text || "");
    content = content.replace(/^```[\w]*\n?/m, "").replace(/\n?```$/m, "").trim();

    // ตรวจนับจำนวนคำ แล้วขยาย/ย่อให้อยู่ในช่วงเป้าหมาย ±500 คำ
    let wordCount = countThaiWords(content);
    const { min: rangeMin, max: rangeMax } = getWordRange(form.word_count_target);

    if (wordCount < rangeMin || wordCount > rangeMax) {
      setStatusMsg(`📝 ปรับจำนวนคำให้อยู่ในช่วง ${rangeMin.toLocaleString()}-${rangeMax.toLocaleString()} คำ (ตอนนี้ ${wordCount} คำ)...`);
      const adjusted = await enforceWordRange(content, form.word_count_target, {
        context: `เรื่องสั้น: ${novelData.title || form.idea}`,
        writerPrompt: writerStyle,
      });
      content = adjusted.content;
      wordCount = adjusted.wordCount;
    }

    // ─── Step 4: บันทึก Chapter ───
    setStatusMsg("💾 กำลังบันทึกเนื้อเรื่อง...");
    await base44.entities.Chapter.create({
      novel_id: novel.id,
      title: novelData.title || form.idea.substring(0, 50),
      order: 1,
      status: "เขียนเสร็จ",
      content,
      word_count: wordCount,
    });

    await base44.entities.Novel.update(novel.id, {
      auto_written: true,
      status: "เขียนเสร็จ",
    });

    queryClient.invalidateQueries({ queryKey: ["novels"] });

    setTotalWords(wordCount);
    setCreatedNovelId(novel.id);
    setStep("done");
    toast.success("สร้างเรื่องสั้นสำเร็จ!");
  };

  const handleClose = () => {
    setStep("form");
    setStatusMsg("");
    setCreatedNovelId(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-md max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/60 shrink-0">
          <DialogTitle className="font-heading flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-sky-600" />
            สร้างเรื่องสั้นด้วย AI
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">ใส่ไอเดีย AI จะเขียนพล็อต ตัวละคร และเนื้อเรื่องให้จบในครั้งเดียว</p>
        </DialogHeader>

        {/* Form */}
        {step === "form" && (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">ไอเดียสั้นๆ <span className="text-destructive">*</span></label>
              <Textarea
                rows={3}
                value={form.idea}
                onChange={(e) => setForm({ ...form, idea: e.target.value })}
                placeholder="เช่น: นักดนตรีสาวกับชายปริศนาที่มาฟังเธอเล่นดนตรีทุกคืน แล้วหายไปโดยไม่บอกลา"
                className="resize-none text-sm"
                maxLength={300}
              />
              <p className="text-[11px] text-muted-foreground mt-1">{form.idea.length}/300 ตัวอักษร</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">แนว</label>
                <Select value={form.genre} onValueChange={(v) => setForm({ ...form, genre: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{GENRES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">รูปแบบตอนจบ</label>
                <Select value={form.ending_type} onValueChange={(v) => setForm({ ...form, ending_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ENDING_TYPES.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">จำนวนคำเป้าหมาย</label>
              <Select value={form.word_count_target.toString()} onValueChange={(v) => setForm({ ...form, word_count_target: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WORD_COUNTS.map((w) => <SelectItem key={w} value={w.toString()}>{w.toLocaleString()} คำ</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">นักเขียน AI <span className="text-muted-foreground font-normal">(ไม่บังคับ)</span></label>
              <Select value={form.writer_id || "none"} onValueChange={(v) => setForm({ ...form, writer_id: v === "none" ? "" : v })}>
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

            <div className="rounded-xl bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800/40 p-3 text-xs text-sky-700 dark:text-sky-300">
              <p className="font-medium mb-1 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" />AI จะสร้างให้ครบในครั้งเดียว</p>
              <ul className="space-y-0.5 text-sky-600 dark:text-sky-400">
                <li>✓ ชื่อเรื่องและเรื่องย่อ</li>
                <li>✓ ตัวละครหลัก (สูงสุด 3 คน) พร้อมประวัติ</li>
                <li>✓ เนื้อเรื่องสมบูรณ์ ~{form.word_count_target.toLocaleString()} คำ</li>
              </ul>
              <p className="text-sky-500 mt-1.5">ใช้ Claude Sonnet — ประมาณ 60 เครดิต</p>
            </div>
          </div>
        )}

        {/* Generating */}
        {step === "generating" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-12 px-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-sky-500 animate-spin" />
            </div>
            <div>
              <p className="font-heading font-semibold text-lg">กำลังสร้างเรื่องสั้น...</p>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed max-w-xs">{statusMsg}</p>
            </div>
            <p className="text-xs text-muted-foreground">อาจใช้เวลา 1-2 นาที กรุณาอย่าปิดหน้าต่างนี้</p>
          </div>
        )}

        {/* Done */}
        {step === "done" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-10 px-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-emerald-500" />
            </div>
            <div>
              <p className="font-heading font-semibold text-lg">สร้างเรื่องสั้นสำเร็จ!</p>
              <p className="text-sm text-muted-foreground mt-1">{totalWords.toLocaleString()} คำ · พร้อมอ่านและแก้ไข</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/60 shrink-0 flex items-center justify-end gap-2">
          {step === "form" && (
            <>
              <Button variant="ghost" size="sm" onClick={handleClose} disabled={step === "generating"}>ยกเลิก</Button>
              <Button 
                onClick={handleCreate} 
                disabled={!form.idea.trim() || step === "generating"} 
                title={!form.idea.trim() ? "กรุณากรอกไอเดียสั้นๆ ก่อน" : ""}
                className="gap-2 bg-sky-600 hover:bg-sky-700 text-white"
              >
                {step === "generating" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {step === "generating" ? "กำลังสร้าง..." : "สร้างเรื่องสั้น"}
              </Button>
            </>
          )}
          {step === "generating" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              กำลังสร้างเรื่องสั้น...
            </div>
          )}
          {step === "done" && (
            <>
              <Button variant="outline" size="sm" onClick={handleClose}>ปิด</Button>
              <Button
                className="gap-2 bg-sky-600 hover:bg-sky-700 text-white"
                onClick={() => { handleClose(); navigate(`/novel/${createdNovelId}`); }}
              >
                <BookOpen className="w-4 h-4" />
                เปิดอ่าน/แก้ไข
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}