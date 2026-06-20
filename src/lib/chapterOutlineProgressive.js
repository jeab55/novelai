import { invokeAIStable } from "@/lib/aiInvoke";

function stripFence(text) {
  if (typeof text !== "string") return text;
  return text.replace(/^```[\w]*\n?/m, "").replace(/\n?```$/m, "").trim();
}

function safeParse(raw) {
  if (raw && typeof raw === "object") return raw;
  const cleaned = stripFence(String(raw));
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/[[{][\s\S]*[\]}]/);
    if (m) {
      try { return JSON.parse(m[0]); } catch { /* ตกไป */ }
    }
    return null;
  }
}

const OUTLINE_SCHEMA = {
  type: "object",
  properties: {
    chapters: {
      type: "array",
      items: {
        type: "object",
        properties: {
          order: { type: "number" },
          title: { type: "string" },
          content: { type: "string" },
          act: { type: "number" },
          plot_event_title: { type: "string" },
        },
      },
    },
  },
};

function buildBatchPrompt({ novel, writer, eventsContext, fromOrder, toOrder, totalChapters }) {
  const writerCtx = writer?.system_prompt ? `[สไตล์การเขียน]\n${writer.system_prompt}\n\n` : "";
  return `${writerCtx}คุณคือผู้ช่วยแต่งนิยาย ช่วยสร้างโครงตอนย่อยจากโครงเรื่องหลัก

ข้อมูลนิยาย:
- ชื่อ: ${novel.title}
- แนว: ${novel.genre || "ไม่ระบุ"}
- เรื่องย่อ: ${novel.synopsis || "ไม่มี"}
- จำนวนตอนทั้งหมด: ${totalChapters} ตอน
- โครงเรื่อง 3 องก์: ${novel.plot_outline || "ไม่มี"}

${eventsContext}

จงสร้างโครงตอนย่อย "เฉพาะตอนที่ ${fromOrder} ถึง ${toOrder}" (เป็นส่วนหนึ่งของ ${totalChapters} ตอน) โดยแต่ละตอนมี:
- order: ลำดับตอน (${fromOrder}-${toOrder})
- title: ชื่อตอน
- content: โครงย่อของตอน (3-5 บรรทัด) ระบุว่าเกิดอะไรขึ้น ใครทำอะไร มีปมอะไร
- act: องก์ที่สังกัด (1, 2, หรือ 3)
- plot_event_title: (ถ้ามี) ชื่อเหตุการณ์ไทม์ไลน์ที่ตอนนี้อ้างอิง

ให้สอดคล้องต่อเนื่องกับภาพรวมทั้งเรื่อง ตอบ JSON ล้วนเท่านั้น ไม่มี markdown:
{"chapters":[{"order":${fromOrder},"title":"","content":"","act":1,"plot_event_title":""}]}

ภาษาไทยทั้งหมด ตอบ JSON ล้วน`;
}

/**
 * สร้างโครงตอนแบบ progressive: แบ่งเป็น batch ขนาน + callback ทยอยส่งผลแต่ละ batch
 * คงโมเดล claude_sonnet_4_6 + บังคับ response_json_schema + parse เสถียร
 * @param {object} params { novel, writer, plotEvents, totalChapters, batchSize }
 * @param {object} cb { onBatch(chapters[]), onError(order,msg) }
 */
export async function generateChapterOutlineProgressive(
  { novel, writer, plotEvents = [], totalChapters, batchSize = 5 },
  cb = {},
  options = {}
) {
  const eventsContext = plotEvents.length > 0
    ? `เหตุการณ์ไทม์ไลน์ที่มี:\n${plotEvents.map((e, i) => `${i + 1}. ${e.title} - ${e.description || ""}`).join("\n")}`
    : "ยังไม่มีเหตุการณ์ไทม์ไลน์";

  // แบ่งเป็นช่วง ๆ
  const batches = [];
  for (let from = 1; from <= totalChapters; from += batchSize) {
    batches.push({ from, to: Math.min(from + batchSize - 1, totalChapters) });
  }

  // ยิงทุก batch ขนานกัน แต่ละ batch เสร็จเมื่อไหร่ callback ทันที (ทยอยแสดง)
  await Promise.all(
    batches.map(async ({ from, to }) => {
      const prompt = buildBatchPrompt({
        novel, writer, eventsContext, fromOrder: from, toOrder: to, totalChapters,
      });
      try {
        const raw = await invokeAIStable(
          { prompt, model: "claude_sonnet_4_6", response_json_schema: OUTLINE_SCHEMA },
          options
        );
        const parsed = safeParse(raw);
        const list = (parsed && (parsed.chapters || parsed.items)) || [];
        const normalized = list.map((c, i) => ({
          order: c.order ?? from + i,
          title: c.title || `ตอนที่ ${from + i}`,
          content: c.content || c.description || "",
          act: c.act || 1,
          plot_event_title: c.plot_event_title || null,
        }));
        cb.onBatch?.(normalized);
      } catch (err) {
        cb.onError?.(from, err?.message || "สร้างไม่สำเร็จ");
      }
    })
  );
}