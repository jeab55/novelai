import { base44 } from "@/api/base44Client";

const DEFAULT_TIMEOUT_MS = 180000; // 180 วินาที ต่อครั้ง
const RETRY_DELAYS_MS = [3000, 8000]; // exponential backoff: รอ 3 วิ แล้ว 8 วิ

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function stripFences(text) {
  if (typeof text !== "string") return text;
  return text.replace(/^```[\w]*\n?/m, "").replace(/\n?```$/m, "").trim();
}

// เรียก InvokeLLM ครั้งเดียวพร้อม timeout
async function invokeOnce(params, timeoutMs) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("หมดเวลารอ AI (timeout)")), timeoutMs);
  });
  try {
    const result = await Promise.race([
      base44.integrations.Core.InvokeLLM(params),
      timeoutPromise,
    ]);
    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * เรียก AI แบบเสถียร: timeout ต่อครั้ง + retry อัตโนมัติ 2 ครั้ง (exponential backoff)
 * @param {object} params - พารามิเตอร์ของ InvokeLLM (prompt, model, ...) — โมเดลคงไว้ตามที่ส่งมา
 * @param {object} options - { timeoutMs, onRetry }
 * @returns {Promise<string>} ข้อความผลลัพธ์ (strip code fences แล้ว)
 */
export async function invokeAIStable(params, options = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, onRetry } = options;
  const maxAttempts = RETRY_DELAYS_MS.length + 1; // 1 ครั้งแรก + 2 retry
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await invokeOnce(params, timeoutMs);
      const text = typeof result === "string" ? result : (result?.text || "");
      return stripFences(text);
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        const delay = RETRY_DELAYS_MS[attempt - 1];
        if (onRetry) onRetry({ attempt, maxAttempts, delay, error: err });
        await sleep(delay);
      }
    }
  }

  const msg = lastError?.message || "ไม่ทราบสาเหตุ";
  throw new Error(`AI ไม่ตอบสนองหลังลองใหม่ ${maxAttempts} ครั้ง — ${msg}`);
}