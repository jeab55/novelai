import { invokeAIStable } from "@/lib/aiInvoke";

// ความคลาดเคลื่อนที่ยอมรับได้ของจำนวนคำ (บวก/ลบ)
export const WORD_TOLERANCE = 500;

// นับคำภาษาไทยอย่างแม่นยำด้วย Intl.Segmenter
export function countThaiWords(text) {
  if (!text || typeof text !== "string") return 0;
  try {
    const segmenter = new Intl.Segmenter("th", { granularity: "word" });
    let count = 0;
    for (const { isWordLike, segment } of segmenter.segment(text)) {
      if (isWordLike && segment.trim().length > 0) count += 1;
    }
    return count;
  } catch {
    return text.split(/\s+/).filter(Boolean).length;
  }
}

// ช่วงจำนวนคำที่ยอมรับ: เป้าหมาย ± WORD_TOLERANCE
export function getWordRange(target) {
  const t = Number(target) || 1500;
  return { target: t, min: Math.max(t - WORD_TOLERANCE, 100), max: t + WORD_TOLERANCE };
}

// ข้อความคำสั่งจำนวนคำที่ใส่ลงใน prompt ทุกครั้งที่ AI สร้างเนื้อเรื่อง
export function buildWordCountInstruction(target) {
  const { target: t, min, max } = getWordRange(target);
  return (
    `[ข้อกำหนดจำนวนคำ — สำคัญมาก ต้องปฏิบัติตามอย่างเคร่งครัด]\n` +
    `- จำนวนคำเป้าหมาย: ${t.toLocaleString()} คำ\n` +
    `- ช่วงที่ยอมรับได้: ${min.toLocaleString()} ถึง ${max.toLocaleString()} คำ (คลาดเคลื่อนได้ไม่เกิน ±${WORD_TOLERANCE} คำ)\n` +
    `- ห้ามเขียนสั้นกว่า ${min.toLocaleString()} คำ และห้ามยาวเกิน ${max.toLocaleString()} คำเด็ดขาด\n`
  );
}

// ขยายเนื้อหาเมื่อสั้นกว่าช่วง
async function expandToRange(content, target, { context = "", writerPrompt = "", onProgress } = {}) {
  const { min, max } = getWordRange(target);
  let text = content;
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const wc = countThaiWords(text);
    if (onProgress) onProgress({ phase: "expand", attempt, maxAttempts, wordCount: wc, target });
    if (wc >= min) break;

    const needed = Math.max(target - wc, 200);
    let prompt = writerPrompt ? `[บทบาทและสไตล์การเขียน]\n${writerPrompt}\n\n` : "";
    prompt += `[ขยายเนื้อหา — เขียนต่อจากเดิม]\n`;
    prompt += `เนื้อหาปัจจุบันมี ${wc} คำ แต่ต้องการให้อยู่ในช่วง ${min.toLocaleString()}-${max.toLocaleString()} คำ\n`;
    prompt += `โปรดเขียนเนื้อหาต่อจากด้านล่าง เพิ่มอีกประมาณ ${needed.toLocaleString()} คำ แต่อย่าให้รวมแล้วเกิน ${max.toLocaleString()} คำ\n\n`;
    prompt += `[คำสั่ง]\n`;
    prompt += `- เขียนต่อจากเนื้อหาเดิมทันที ไม่ต้องมีคำนำ\n`;
    prompt += `- เพิ่มฉาก บทสนทนา รายละเอียดการกระทำและความคิดของตัวละคร\n`;
    prompt += `- รักษาโทนและสไตล์ให้สม่ำเสมอ\n\n`;
    if (context) prompt += `${context}\n\n`;
    prompt += `[เนื้อหาปัจจุบัน — เขียนต่อจากบรรทัดสุดท้าย]\n${text.substring(0, 2500)}${text.length > 2500 ? "\n...(ต่อ)" : ""}\n\n`;
    prompt += `[เขียนต่อจากนี้ — ประมาณ ${needed.toLocaleString()} คำ]:\n`;

    try {
      const expansion = await invokeAIStable({ prompt, model: "claude_sonnet_4_6" });
      if (!expansion || expansion.length < 50) break;
      text = text + "\n\n" + expansion;
    } catch {
      break;
    }
  }
  return text;
}

// ย่อเนื้อหาเมื่อยาวกว่าช่วง
async function shrinkToRange(content, target, { writerPrompt = "", onProgress } = {}) {
  const { min, max, target: t } = getWordRange(target);
  const wc = countThaiWords(content);
  if (onProgress) onProgress({ phase: "shrink", wordCount: wc, target });
  if (wc <= max) return content;

  let prompt = writerPrompt ? `[บทบาทและสไตล์การเขียน]\n${writerPrompt}\n\n` : "";
  prompt += `[ย่อ/กระชับเนื้อหา]\n`;
  prompt += `เนื้อหาด้านล่างมี ${wc} คำ ซึ่งยาวเกินไป ต้องการให้อยู่ในช่วง ${min.toLocaleString()}-${max.toLocaleString()} คำ (เป้าหมาย ${t.toLocaleString()} คำ)\n\n`;
  prompt += `[คำสั่ง]\n`;
  prompt += `- เขียนเนื้อเรื่องเดิมใหม่ให้กระชับขึ้น คงโครงเรื่อง เหตุการณ์สำคัญ และตอนจบไว้ครบ\n`;
  prompt += `- ตัดรายละเอียดที่ซ้ำซ้อนหรือเยิ่นเย้อ แต่ยังคงอารมณ์และสำนวนของเรื่อง\n`;
  prompt += `- ผลลัพธ์ต้องอยู่ในช่วง ${min.toLocaleString()}-${max.toLocaleString()} คำ\n`;
  prompt += `- ตอบเฉพาะเนื้อเรื่องที่ย่อแล้ว ไม่ต้องมีคำอธิบาย\n\n`;
  prompt += `[เนื้อหาเดิม]\n${content}\n\n[เนื้อหาที่ย่อแล้ว]:\n`;

  try {
    const shrunk = await invokeAIStable({ prompt, model: "claude_sonnet_4_6" });
    if (shrunk && shrunk.length > 100) return shrunk;
  } catch {
    // ถ้าย่อไม่สำเร็จ คืนค่าเดิม
  }
  return content;
}

/**
 * บังคับให้เนื้อหาอยู่ในช่วงเป้าหมาย ±500 คำ:
 * - สั้นกว่าช่วง → ขยาย
 * - ยาวกว่าช่วง → ย่อ
 * คืน { content, wordCount }
 */
export async function enforceWordRange(content, target, options = {}) {
  const { min, max } = getWordRange(target);
  let text = content;
  let wc = countThaiWords(text);

  if (wc < min) {
    text = await expandToRange(text, target, options);
    wc = countThaiWords(text);
  }
  if (wc > max) {
    text = await shrinkToRange(text, target, options);
    wc = countThaiWords(text);
  }
  return { content: text, wordCount: wc };
}