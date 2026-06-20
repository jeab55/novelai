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
    story.analysis_summary && `ผลวิเคราะห์พล็อต: ${story.analysis_summary}`,
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

ตอบกลับเป็น JSON เท่านั้น รูปแบบนี้ (แต่ละแบบมีตัวคำโปรย text และโทน tone):
{"blurbs":[{"text":"คำโปรยแบบที่ 1","tone":"ดราม่า"},{"text":"คำโปรยแบบที่ 2","tone":"ลึกลับ"},{"text":"คำโปรยแบบที่ 3","tone":"อารมณ์"}]}

ตอบเป็นภาษาไทย JSON ล้วน ไม่ต้องมีคำอธิบายเพิ่มเติม`;
}

// แปลง error จาก InvokeLLM เป็นข้อความภาษาไทยที่บอกสาเหตุจริง
function describeLlmError(err) {
  const status = err?.response?.status || err?.status;
  const raw = err?.response?.data?.error || err?.response?.data?.detail || err?.message || "";
  const text = typeof raw === "string" ? raw : JSON.stringify(raw);
  if (status === 401 || /unauthorized|invalid api key|incorrect api key/i.test(text)) {
    return "API key ไม่ถูกต้องหรือหมดอายุ (401) กรุณาตรวจสอบ OpenAI API key ในหน้าตั้งค่า";
  }
  if (status === 429 || /quota|rate limit|insufficient_quota/i.test(text)) {
    return "เกินโควต้าหรือเรียกถี่เกินไป (429) กรุณาตรวจสอบเครดิต/โควต้า แล้วลองใหม่";
  }
  if (/model|not found|does not exist/i.test(text)) {
    return `ชื่อโมเดลไม่ถูกต้องหรือใช้งานไม่ได้: ${text}`;
  }
  if (status) return `เรียก AI ไม่สำเร็จ (${status}) — ${text || "ไม่ทราบสาเหตุ"}`;
  return text || "เรียก AI ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
}

// แปลงรายการ 1 รายการให้เป็นข้อความคำโปรย (รองรับ string หรือ object {text/blurb/content/synopsis})
function toBlurbText(item) {
  if (typeof item === "string") return item.trim();
  if (item && typeof item === "object") {
    const v = item.text || item.blurb || item.content || item.synopsis || item.value;
    return typeof v === "string" ? v.trim() : "";
  }
  return "";
}

// ดึง array คำโปรยจากผลลัพธ์ได้หลายรูปแบบ:
//  - array ตรงๆ (string หรือ object)
//  - object ที่มี key blurbs/options/results/items (เป็น array)
//  - JSON string ที่ห่อ object/array ไว้
//  - string หลายย่อหน้า/ตัวเลขนำหน้า
function parseBlurbs(result) {
  const fromContainer = (obj) => {
    if (Array.isArray(obj)) return obj;
    if (obj && typeof obj === "object") {
      const key = ["blurbs", "options", "results", "items"].find((k) => Array.isArray(obj[k]));
      if (key) return obj[key];
    }
    return null;
  };

  // บางโมเดล (เช่น claude) ห่อผลลัพธ์ไว้ใน result.response / result.output
  const unwrapped = (result && typeof result === "object" && !Array.isArray(result))
    ? (result.response ?? result.output ?? result)
    : result;

  // กรณีเป็น object/array อยู่แล้ว
  const direct = fromContainer(unwrapped);
  if (direct) return direct.map(toBlurbText).filter(Boolean);
  // result อาจมี blurbs ตรงๆ ขณะที่ unwrapped ชี้ไปที่ response (กันพลาด)
  if (unwrapped !== result) {
    const direct2 = fromContainer(result);
    if (direct2) return direct2.map(toBlurbText).filter(Boolean);
  }

  // ถ้า unwrapped เป็น string ให้ไปต่อด้วย logic string ด้านล่าง
  if (typeof unwrapped === "string") result = unwrapped;

  // กรณีเป็น string — ลอง parse JSON ทั้งก้อนหรือเฉพาะส่วน {...} / [...]
  if (typeof result === "string") {
    const cleaned = result.replace(/^```[\w]*\n?/m, "").replace(/```$/m, "").trim();
    const tryParse = (s) => { try { return JSON.parse(s); } catch { return null; } };
    const match = cleaned.match(/[[{][\s\S]*[\]}]/);
    const parsed = tryParse(cleaned) || (match && tryParse(match[0]));
    const fromParsed = parsed && fromContainer(parsed);
    if (fromParsed) return fromParsed.map(toBlurbText).filter(Boolean);

    // ไม่มี JSON — แยกตามย่อหน้า/ตัวเลขนำหน้า
    if (cleaned) {
      return cleaned
        .split(/\n{2,}|\n(?=\d+[.)])/)
        .map((s) => s.replace(/^\d+[.)]\s*/, "").trim())
        .filter(Boolean);
    }
  }
  return [];
}

/**
 * เรียก AI ร่างคำโปรยหลายแบบ คืน array ของคำโปรย
 * โยน Error ที่มีสาเหตุจริงถ้าเรียก AI ไม่สำเร็จ
 */
export async function generateBlurbs(story = {}, characters = [], options = {}) {
  const prompt = buildBlurbPrompt(story, characters, options);
  const schema = {
    type: "object",
    properties: {
      blurbs: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: { type: "string", description: "ตัวคำโปรย" },
            tone: { type: "string", description: "โทนของคำโปรย เช่น ดราม่า/ลึกลับ/อารมณ์" },
          },
          required: ["text"],
        },
      },
    },
    required: ["blurbs"],
  };

  let result;
  let firstError;
  // ลองโมเดลคุณภาพสูงก่อน ถ้าล้มเหลว (เช่นโมเดลใช้ไม่ได้) ลองโมเดล default อัตโนมัติ
  try {
    result = await base44.integrations.Core.InvokeLLM({
      prompt,
      model: "claude_sonnet_4_6",
      response_json_schema: schema,
    });
  } catch (err) {
    firstError = err;
    try {
      result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: schema,
      });
    } catch (err2) {
      // ทั้งสองโมเดลล้มเหลว — โยนสาเหตุจริง
      throw new Error(describeLlmError(firstError || err2));
    }
  }

  const blurbs = parseBlurbs(result).map((b) => (b || "").trim()).filter(Boolean);
  if (!blurbs.length) {
    throw new Error("AI ตอบกลับมาแต่ไม่พบคำโปรยที่ใช้ได้ กรุณาลองใหม่อีกครั้ง");
  }
  return blurbs;
}