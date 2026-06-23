import { base44 } from "@/api/base44Client";
import { invokeAIStable } from "@/lib/aiInvoke";

const CHARACTER_SCHEMA = {
  type: "object",
  properties: {
    role: { type: "string", description: "บทบาท: ตัวเอก / ตัวรอง / ตัวร้าย / ตัวประกอบ" },
    appearance: { type: "string", description: "ลักษณะภายนอกเท่าที่อนุมานได้จากเนื้อเรื่อง" },
    personality: { type: "string", description: "นิสัยและบุคลิก" },
    background: { type: "string", description: "ปูมหลัง ที่มา ประวัติ" },
    desire: { type: "string", description: "สิ่งที่ตัวละครต้องการ เป้าหมาย แรงจูงใจ" },
    wound: { type: "string", description: "ปม/บาดแผลทางใจ ความกลัว" },
    relationships: { type: "string", description: "ความสัมพันธ์กับตัวละครอื่น" },
    ai_analysis: { type: "string", description: "บทวิเคราะห์ตัวละครโดยรวม (จุดแข็ง, Want vs Need, Character Arc)" },
  },
};

const ALLOWED_ROLES = ["ตัวเอก", "ตัวรอง", "ตัวร้าย", "ตัวประกอบ"];

/**
 * วิเคราะห์ตัวละครจากเนื้อตอนที่ตัวละครปรากฏ แล้วคืนค่าฟิลด์ที่เติมได้
 * @param {object} args
 * @param {string} args.name ชื่อตัวละคร
 * @param {Array} args.appearances สรุปการปรากฏจากไทม์ไลน์ [{order, chapterTitle, location, action, development}]
 * @param {Array} args.chapters ตอนทั้งหมด (root + ทุกภาค) [{title, order, content}]
 * @returns {Promise<object>} ฟิลด์ Character ที่วิเคราะห์ได้
 */
export async function analyzeTimelineCharacter({ name, appearances, chapters }) {
  // เลือกเฉพาะตอนที่ตัวละครนี้ปรากฏ (อิงจาก order ในไทม์ไลน์ + ชื่อปรากฏในเนื้อหา)
  const appearOrders = new Set((appearances || []).map((a) => a.order));
  const relevant = (chapters || [])
    .filter((c) => appearOrders.has(c.order) || (c.content || "").includes(name))
    .slice(0, 8);

  const excerpts = relevant
    .map((c) => `[ตอน ${c.order || ""}: ${c.title}]\n${(c.content || "").slice(0, 4000)}`)
    .join("\n\n---\n\n");

  const timelineHint = (appearances || [])
    .map((ap) => {
      const parts = [];
      if (ap.location) parts.push(`อยู่ที่ ${ap.location}`);
      if (ap.action) parts.push(ap.action);
      if (ap.development) parts.push(`พัฒนาการ: ${ap.development}`);
      return `• ตอน ${ap.order} (${ap.chapterTitle}): ${parts.join(" — ") || "ปรากฏตัว"}`;
    })
    .join("\n");

  const prompt = `คุณคือนักวิเคราะห์ตัวละครในนิยายมืออาชีพ จงวิเคราะห์ตัวละครชื่อ "${name}" จากเนื้อเรื่องที่ให้มา แล้วเติมข้อมูลตัวละครให้ครบทุกหัวข้อเท่าที่อนุมานได้จากเนื้อเรื่องจริง อย่าแต่งเรื่องที่ไม่มีในเนื้อหา ถ้าหัวข้อใดไม่มีข้อมูลให้สรุปอย่างระมัดระวังหรือเว้นว่าง ""

สรุปการปรากฏของตัวละครจากไทม์ไลน์:
${timelineHint}

เนื้อตอนที่ตัวละครปรากฏ:
"""
${excerpts || "(ไม่พบเนื้อตอน ใช้ข้อมูลจากไทม์ไลน์ด้านบนแทน)"}
"""

ตอบเป็นภาษาไทย กระชับ ตรงประเด็น สำหรับช่อง role ให้เลือกหนึ่งใน: ${ALLOWED_ROLES.join(", ")}`;

  const result = await invokeAIStable({
    prompt,
    model: "claude_sonnet_4_6",
    response_json_schema: CHARACTER_SCHEMA,
  });
  const parsed = typeof result === "string" ? JSON.parse(result) : result;
  const data = parsed?.response || parsed?.output || parsed || {};

  // role ต้องอยู่ในชุดที่อนุญาต
  let role = (data.role || "").trim();
  if (!ALLOWED_ROLES.includes(role)) role = "ตัวประกอบ";

  return {
    role,
    appearance: data.appearance || "",
    personality: data.personality || "",
    background: data.background || "",
    desire: data.desire || "",
    wound: data.wound || "",
    relationships: data.relationships || "",
    ai_analysis: data.ai_analysis || "",
  };
}