// สร้าง "บทสรุปความจำต่อเนื่อง" (rolling recap) ของแต่ละตอน
// ใช้เก็บลง Chapter.recap แล้วนำไปเป็นความจำระยะยาวตอน AI เขียนตอนถัดไป
// (แทนการตัด string หัว-ท้ายแบบเดิมที่ทำให้ปมที่วางไว้หายจากบริบท)
import { invokeAIStable } from "@/lib/aiInvoke";

// timeout สั้น — recap เป็นงานเสริม ถ้าช้า/ล้มเหลวให้ข้ามได้โดยไม่บล็อกการบันทึกตอน
const RECAP_TIMEOUT_MS = 60000;

export function buildRecapPrompt({ title, content }) {
  const body = (content || "").substring(0, 6000);
  const truncated = (content || "").length > 6000 ? "\n…(ตัดมาบางส่วน)" : "";
  return `สรุปตอนนิยายต่อไปนี้เป็น "บันทึกความจำต่อเนื่อง" สั้นๆ 2-3 บรรทัด สำหรับให้ AI ใช้อ้างอิงตอนเขียนตอนถัดไปให้สอดคล้อง
เน้น 3 อย่าง:
1) เหตุการณ์สำคัญที่เกิดขึ้นในตอนนี้ (เฉพาะที่กระทบเรื่องต่อไป)
2) การเปลี่ยนแปลงของตัวละคร/ความสัมพันธ์
3) "ปมที่ยังค้าง" ที่ตอนหลังต้องสะสาง — คำถามค้าง, สิ่งที่ถูกวางไว้ (setup/foreshadow), สัญญา/นัดหมาย, ความลับที่ยังไม่เฉลย
เขียนเป็นข้อความบรรยายกระชับ ไม่ต้องมีหัวข้อหรือ bullet ไม่ต้องมีคำนำ ตอบเฉพาะบทสรุป

[ชื่อตอน] ${title || ""}
[เนื้อหา]
${body}${truncated}

[บทสรุปความจำต่อเนื่อง 2-3 บรรทัด]:`;
}

/**
 * สร้าง recap ของตอน — คืน "" ถ้าเนื้อหาสั้นเกินไปหรือ AI ไม่ตอบ
 * ออกแบบให้ไม่ throw เพื่อไม่บล็อกการบันทึกตอน (best-effort)
 * @param {{ title?: string, content?: string }} args
 * @returns {Promise<string>}
 */
export async function generateChapterRecap({ title, content }) {
  if (!content || content.trim().length < 100) return "";
  try {
    const raw = await invokeAIStable(
      { prompt: buildRecapPrompt({ title, content }), model: "claude_sonnet_4_6" },
      { timeoutMs: RECAP_TIMEOUT_MS }
    );
    return (typeof raw === "string" ? raw : "").trim();
  } catch {
    return "";
  }
}
