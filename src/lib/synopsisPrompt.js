// Centralized prompt + parser for AI synopsis / blurb (คำโปรย) generation.
// Every place that drafts a synopsis should use this so the blurb is always
// tied to the real story data and follows the 6 rules below.

import { base44 } from "@/api/base44Client";
import { getTropesForGenre } from "@/lib/genreTropes";

// หลัก 6 ข้อของคำโปรยที่ดี (ใช้ทุกที่)
const BLURB_RULES = `[หลักการเขียนคำโปรย 6 ข้อ — ต้องทำตามทุกข้อ]
1. สั้นกระชับ ไม่เกิน 2-4 บรรทัด ไม่มีคำซ้ำซ้อน
2. เปิดด้วยสถานการณ์ที่ผิดปกติหรือสะดุดใจ ทำให้คนอยากอ่านต่อทันที
3. เขียนจากมุมมองบุคคลที่สาม เลี่ยงคำว่า "ฉัน/ผม"
4. สื่อแนวของเรื่องให้ชัด (รัก/แค้น/ลุ้น/หลอน ตามแนวจริงของเรื่อง)
5. ใช้คีย์เวิร์ดที่ใส่อารมณ์และบ่งบอกเดิมพันของเรื่อง
6. มีปม/เดิมพัน แล้วทิ้งท้ายด้วยคำถามหรือประโยคค้างคา ห้ามสปอยตอนจบ

[โครงสร้างที่ต้องใช้]
[ตัวละคร + สถานการณ์ผิดปกติ] → [ปม/เดิมพันที่ขวางอยู่] → [ประโยคทิ้งค้างที่ทำให้อยากอ่านต่อ]`;

/**
 * รวมบริบทจริงของเรื่องเป็นข้อความเดียว
 * story: { title, genre, synopsis, plot_outline, era }
 * characters: [{ name, role, personality, desire, wound, background }]
 */
export function buildStoryContext(story = {}, characters = []) {
  const named = (characters || []).filter((c) => c && (c.name || "").trim());
  const charLines = named.length > 0
    ? named.map((c) => {
        const parts = [
          `${c.name} (${c.role || "ตัวละคร"})`,
          c.personality && `นิสัย: ${c.personality}`,
          c.desire && `สิ่งที่ต้องการ: ${c.desire}`,
          c.wound && `ปมในใจ: ${c.wound}`,
        ].filter(Boolean).join(" — ");
        return `• ${parts}`;
      }).join("\n")
    : "ยังไม่ระบุตัวละคร";

  return [
    story.title && `ชื่อเรื่อง: ${story.title}`,
    story.genre && `แนว: ${story.genre}`,
    story.era && `ยุคสมัย/ฉากหลัง: ${story.era}`,
    story.synopsis && `เรื่องย่อปัจจุบัน: ${story.synopsis}`,
    story.plot_outline && `โครงเรื่อง: ${story.plot_outline}`,
    `ตัวละครหลักและปมขัดแย้ง:\n${charLines}`,
  ].filter(Boolean).join("\n");
}

/**
 * สร้างพรอมป์ร่างคำโปรยที่อิงข้อมูลจริง + เสนอหลายแบบ
 * options: { variants = 3, writerSystemPrompt = "" }
 */
export function buildBlurbPrompt(story = {}, characters = [], options = {}) {
  const { variants = 3, writerSystemPrompt = "", marketMode = false } = options;
  const writerCtx = writerSystemPrompt ? `[สไตล์และโทนการเขียน]\n${writerSystemPrompt}\n\n` : "";
  const tropes = story.genre ? getTropesForGenre(story.genre) : "";
  const tropeBlock = tropes
    ? `\n[โทรปยอดนิยมของแนว ${story.genre} — ${marketMode ? "ต้องสอดแทรกอย่างน้อย 1 โทรปให้กลมกลืนเพื่อให้ขายได้ในตลาด" : "สอดแทรกได้ถ้ากลมกลืน"}]\n${tropes}\n`
    : "";

  return `${writerCtx}คุณคือนักเขียนนิยายไทยมือทอง เชี่ยวชาญการเขียน "คำโปรย" ที่ดึงดูดให้คนกดอ่าน

[ข้อมูลจริงของเรื่องนี้ — ต้องใช้เป็นแกนในการเขียน ห้ามแต่งลอยๆ ทั่วไป]
${buildStoryContext(story, characters)}
${tropeBlock}
${BLURB_RULES}

[งานที่ต้องทำ]
เขียนคำโปรย ${variants} แบบที่แตกต่างกัน โดยทุกแบบต้องสะท้อนเนื้อเรื่องจริงจากข้อมูลด้านบน (แนว, เรื่องย่อ, โครงเรื่อง, ยุค/ฉาก, ตัวละครและปม) และทำตามหลัก 6 ข้อ + โครงสร้างที่กำหนด

ตอบกลับเป็น JSON เท่านั้น รูปแบบนี้:
{"blurbs":["คำโปรยแบบที่ 1","คำโปรยแบบที่ 2","คำโปรยแบบที่ 3"]}

ตอบเป็นภาษาไทย JSON ล้วน ไม่ต้องมีคำอธิบายเพิ่มเติม`;
}

/**
 * เรียก AI ร่างคำโปรยหลายแบบ คืน array ของคำโปรย
 */
export async function generateBlurbs(story = {}, characters = [], options = {}) {
  const prompt = buildBlurbPrompt(story, characters, options);
  const result = await base44.integrations.Core.InvokeLLM({
    prompt,
    model: "claude_sonnet_4_6",
    response_json_schema: {
      type: "object",
      properties: {
        blurbs: { type: "array", items: { type: "string" } },
      },
      required: ["blurbs"],
    },
  });

  let blurbs = [];
  if (result && Array.isArray(result.blurbs)) {
    blurbs = result.blurbs;
  } else if (typeof result === "string") {
    try {
      const parsed = JSON.parse(result.replace(/^```[\w]*\n?/m, "").replace(/```$/m, "").trim());
      blurbs = parsed.blurbs || [];
    } catch {
      blurbs = [];
    }
  }
  return blurbs.map((b) => (b || "").trim()).filter(Boolean);
}