import { invokeAIStable } from "@/lib/aiInvoke";

// ความคลาดเคลื่อนขั้นต่ำของจำนวนคำ (คำ) — ช่วงจริงคิดเป็น 15% ของเป้า แต่ไม่ต่ำกว่าค่านี้
export const WORD_TOLERANCE = 400;

// timeout สั้นสำหรับขั้น "เกลาจำนวนคำ" (ปิดท้าย) — ถ้า AI ช้าเกินนี้ให้ข้าม ไม่รอ 180 วิ
const POLISH_TIMEOUT_MS = 75000; // 75 วินาที ต่อครั้ง
// retry น้อยลงในขั้นปิดท้าย เพื่อไม่ให้รอนานจนเหมือนแฮงค์
const POLISH_INVOKE_OPTS = { timeoutMs: POLISH_TIMEOUT_MS };

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

// ช่วงจำนวนคำที่ยอมรับ: เป้าหมาย ± max(15% ของเป้า, WORD_TOLERANCE)
// — ตอนยาว (เช่น 5,000 คำ) จะได้ช่วงกว้างขึ้นตามสัดส่วน ไม่บีบเท่าตอนสั้น
export function getWordRange(target) {
  const t = Number(target) || 1500;
  const tol = Math.max(Math.round(t * 0.15), WORD_TOLERANCE);
  return { target: t, min: Math.max(t - tol, 100), max: t + tol };
}

// ข้อความคำสั่งจำนวนคำที่ใส่ลงใน prompt ทุกครั้งที่ AI สร้างเนื้อเรื่อง
export function buildWordCountInstruction(target) {
  const { target: t, min, max } = getWordRange(target);
  return (
    `[ความยาวเป้าหมาย — คุมความยาว แต่คุณภาพการเล่าเรื่องต้องมาก่อนเสมอ]\n` +
    `- ความยาวที่ต้องการ: ประมาณ ${t.toLocaleString()} คำ (ช่วงที่ดี ${min.toLocaleString()}-${max.toLocaleString()} คำ)\n` +
    `- ให้ความยาวมาจากเนื้อเรื่องที่แน่นและสมบูรณ์ — เล่าฉากให้ครบ พัฒนาอารมณ์ให้ถึง ไม่ยืดน้ำหรือย้ำความเดิมเพียงเพื่อให้ครบคำ\n` +
    `- อย่าจบฉากห้วนหรือตัดจบกลางคันเพียงเพราะถึงจำนวนคำ และอย่ายัดเนื้อฟุ่มเฟือยเพียงเพื่อให้ยาวขึ้น\n` +
    `- ถ้าเรื่องต้องการมากหรือน้อยกว่าช่วงนี้เล็กน้อยเพื่อให้ฉากสมบูรณ์ ทำได้\n`
  );
}

// ขยายเนื้อหาเมื่อสั้นกว่าช่วง
// คืน { text, skipped } — skipped=true เมื่อ AI ไม่ตอบ/timeout ในรอบแรก (ยังไม่ขยายได้เลย)
async function expandToRange(content, target, { context = "", writerPrompt = "", onProgress } = {}) {
  const { min, max } = getWordRange(target);
  let text = content;
  const maxAttempts = 2;
  let expandedAny = false;
  let failedFirst = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const wc = countThaiWords(text);
    if (onProgress) onProgress({ phase: "expand", attempt, maxAttempts, wordCount: wc, target });
    if (wc >= min) break;

    let prompt = writerPrompt ? `[บทบาทและสไตล์การเขียน]\n${writerPrompt}\n\n` : "";
    prompt += `[เขียนตอนนี้ใหม่ทั้งตอนให้แน่นและลึกขึ้น]\n`;
    prompt += `ร่างปัจจุบันมี ${wc} คำ ซึ่งบางเกินไป ต้องการให้อยู่ในช่วง ${min.toLocaleString()}-${max.toLocaleString()} คำ\n\n`;
    prompt += `[คำสั่ง]\n`;
    prompt += `- เขียนตอนนี้ใหม่ทั้งตอน คงโครงเรื่อง ลำดับเหตุการณ์ และตอนจบเดิมไว้ครบทุกอย่าง\n`;
    prompt += `- เพิ่มความลึกแทรกไปทั่วทั้งตอน (ไม่ใช่ต่อหางท้ายเรื่อง): ขยายบทสนทนาให้มีชั้นเชิง เพิ่มความคิด/ความรู้สึกภายในตัวละคร ประสาทสัมผัสที่คม และการกระทำที่เห็นภาพ\n`;
    prompt += `- ห้ามเพิ่มเหตุการณ์/ตัวละครใหม่ที่ขัดกับเรื่องเดิม และห้ามยืดน้ำหรือย้ำความเดิมเพียงเพื่อให้ยาว\n`;
    prompt += `- รักษาโทนและสำนวนเดิม ตอบเฉพาะเนื้อเรื่องที่เขียนใหม่ ไม่ต้องมีคำอธิบาย\n\n`;
    if (context) prompt += `${context}\n\n`;
    prompt += `[ร่างเดิมที่ต้องเขียนใหม่ให้แน่นขึ้น]\n${text}\n\n[เนื้อเรื่องฉบับเขียนใหม่ (${min.toLocaleString()}-${max.toLocaleString()} คำ)]:\n`;

    try {
      const rewritten = await invokeAIStable({ prompt, model: "claude_sonnet_4_6" }, POLISH_INVOKE_OPTS);
      if (!rewritten || rewritten.length < 100) { if (!expandedAny) failedFirst = true; break; }
      if (countThaiWords(rewritten) > countThaiWords(text)) {
        text = rewritten;
        expandedAny = true;
      } else if (!expandedAny) { failedFirst = true; break; }
    } catch {
      if (!expandedAny) failedFirst = true;
      break;
    }
  }
  // skipped = ขั้นเกลาทำอะไรไม่ได้เลย (AI ไม่ตอบตั้งแต่รอบแรก) → ปลายทางจะใช้ร่างเดิม
  return { text, skipped: failedFirst };
}

// ย่อเนื้อหาเมื่อยาวกว่าช่วง
// คืน { text, skipped } — skipped=true เมื่อ AI ไม่ตอบ/timeout (ใช้ร่างเดิมแทน)
async function shrinkToRange(content, target, { writerPrompt = "", onProgress } = {}) {
  const { min, max, target: t } = getWordRange(target);
  const wc = countThaiWords(content);
  if (onProgress) onProgress({ phase: "shrink", wordCount: wc, target });
  if (wc <= max) return { text: content, skipped: false };

  let prompt = writerPrompt ? `[บทบาทและสไตล์การเขียน]\n${writerPrompt}\n\n` : "";
  prompt += `[ย่อ/กระชับเนื้อหา]\n`;
  prompt += `เนื้อหาด้านล่างมี ${wc} คำ ซึ่งยาวเกินไป ต้องการให้อยู่ในช่วง ${min.toLocaleString()}-${max.toLocaleString()} คำ (เป้าหมาย ${t.toLocaleString()} คำ)\n\n`;
  prompt += `[คำสั่ง]\n`;
  prompt += `- เขียนเนื้อเรื่องเดิมใหม่ให้กระชับขึ้น คงโครงเรื่อง เหตุการณ์สำคัญ ตอนจบ และน้ำเสียงเฉพาะตัวของนักเขียนไว้ครบ\n`;
  prompt += `- ตัดเฉพาะส่วนที่ซ้ำซ้อนหรือเยิ่นเย้อจริงๆ เท่านั้น — รักษาจังหวะประโยค ลูกเล่น และการซ้ำที่นักเขียนตั้งใจไว้ (อย่าเข้าใจผิดว่าเป็นน้ำ)\n`;
  prompt += `- ผลลัพธ์ต้องอยู่ในช่วง ${min.toLocaleString()}-${max.toLocaleString()} คำ\n`;
  prompt += `- ตอบเฉพาะเนื้อเรื่องที่ย่อแล้ว ไม่ต้องมีคำอธิบาย\n\n`;
  prompt += `[เนื้อหาเดิม]\n${content}\n\n[เนื้อหาที่ย่อแล้ว]:\n`;

  try {
    const shrunk = await invokeAIStable({ prompt, model: "claude_sonnet_4_6" }, POLISH_INVOKE_OPTS);
    if (shrunk && shrunk.length > 100) return { text: shrunk, skipped: false };
  } catch {
    // ถ้าย่อไม่สำเร็จ คืนค่าเดิม
  }
  // AI ไม่ตอบ/timeout → ใช้ร่างเดิม
  return { text: content, skipped: true };
}

/**
 * ปรับเนื้อหาให้ใกล้เคียงช่วงเป้าหมาย (± สัดส่วน):
 * - สั้นกว่าช่วง → เขียนใหม่ให้แน่นขึ้น
 * - ยาวเกินเป้ามากจริง (> 25%) → ย่อ (เกินช่วงเล็กน้อยปล่อยไว้ ไม่เสี่ยงตัดจังหวะที่ตั้งใจ)
 * คืน { content, wordCount, skipped } — skipped=true เมื่อ AI ไม่ตอบในขั้นเกลา (ใช้ร่างเดิมแทน)
 */
export async function enforceWordRange(content, target, options = {}) {
  const { min } = getWordRange(target);
  const t = Number(target) || 1500;
  // ย่อเฉพาะตอนที่ยาวเกินเป้า > 25% — เกินช่วงเล็กน้อยปล่อยไว้ กันการตัดจังหวะ/ลูกเล่นที่นักเขียนตั้งใจ
  const shrinkThreshold = Math.round(t * 1.25);
  let text = content;
  let wc = countThaiWords(text);
  let skipped = false;

  if (wc < min) {
    const res = await expandToRange(text, target, options);
    text = res.text;
    if (res.skipped) skipped = true;
    wc = countThaiWords(text);
  }
  if (wc > shrinkThreshold) {
    const res = await shrinkToRange(text, target, options);
    text = res.text;
    if (res.skipped) skipped = true;
    wc = countThaiWords(text);
  }
  return { content: text, wordCount: wc, skipped };
}