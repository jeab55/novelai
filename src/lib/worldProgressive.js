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

// คำแนะนำเฉพาะหมวด เพื่อให้ AI โฟกัสและ output เล็กลง = ตอบไวขึ้น
const CATEGORY_BRIEF = {
  "สถานที่": "สถานที่สำคัญในเรื่อง — ต้องรวมทุกสถานที่จากไทม์ไลน์ + เพิ่มที่น่าจะมี",
  "ขนบธรรมเนียม": "ประเพณี วัฒนธรรม ความเชื่อ พิธีกรรม",
  "ยุคสมัย": "บรรยากาศยุค เหตุการณ์ประวัติศาสตร์พื้นหลัง สภาพสังคม",
  "สิ่งของ": "อาวุธ สิ่งประดิษฐ์ ของสำคัญ สัญลักษณ์",
  "ระบบ": "การปกครอง กฎหมาย ระบบสังคม เศรษฐกิจ",
  "อื่นๆ": "สิ่งที่ไม่เข้าหมวดอื่นแต่สำคัญต่อโลกของเรื่อง",
};

function buildContext(novel, writer, characters, plotEvents) {
  const writerCtx = writer?.system_prompt ? `สไตล์การเขียน: ${writer.system_prompt}\n` : "";
  const charList = characters
    .map((c) => `${c.name} (${c.role || "ตัวละคร"})`)
    .join(", ");
  const eventList = plotEvents
    .map((e) => `#${e.order} ${e.title}${e.location ? ` @ ${e.location}` : ""}`)
    .join("\n");
  const locations = [...new Set(
    plotEvents.map((e) => e.location).filter(Boolean).map((l) => l.trim())
  )];

  return `${writerCtx}ข้อมูลนิยาย:
- ชื่อเรื่อง: ${novel.title}
- แนว: ${novel.genre || "ไม่ระบุ"}
- ยุคสมัย/ฉากหลัง: ${novel.era || "ไม่ระบุ"}
- เรื่องย่อ: ${novel.synopsis || "ไม่มี"}
- โครงเรื่อง: ${novel.plot_outline || "ไม่มี"}
ตัวละคร: ${charList || "(ยังไม่มี)"}
ไทม์ไลน์:
${eventList || "(ยังไม่มี)"}
สถานที่ในไทม์ไลน์: ${locations.length ? locations.join(", ") : "(ไม่มี)"}`;
}

/**
 * สร้างรายการโลก/ฉากของ "หมวดเดียว" — output เล็ก ตอบไว เรียกขนานได้หลายหมวดพร้อมกัน
 * คงโมเดล claude_sonnet_4_6 ไว้เพื่อคุณภาพ
 */
export async function generateWorldCategory({ novel, writer, characters, plotEvents, category }, options = {}) {
  const ctx = buildContext(novel, writer, characters, plotEvents);
  const brief = CATEGORY_BRIEF[category] || category;

  const prompt = `${ctx}

คุณคือผู้ช่วยสร้างโลกนิยายภาษาไทย สร้างรายการเฉพาะหมวด "${category}" (${brief})
แต่ละรายการมี:
- title: ชื่อ
- description: คำอธิบาย 2-4 ประโยค เชื่อมโยงกับเรื่อง

สร้าง 3-5 รายการสำหรับหมวดนี้ ให้สอดคล้องกับยุคสมัยและเนื้อเรื่อง
ตอบ JSON ล้วนเท่านั้น ไม่มี markdown:
{"entries":[{"title":"","description":""}]}`;

  const schema = {
    type: "object",
    properties: {
      entries: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
          },
        },
      },
    },
  };

  const raw = await invokeAIStable({ prompt, model: "claude_sonnet_4_6", response_json_schema: schema }, options);
  const parsed = safeParse(raw);
  const arr = (parsed && (parsed.entries || parsed.world_entries || parsed.items)) || [];
  return arr
    .filter((e) => e && e.title)
    .map((e) => ({
      title: e.title || "",
      description: e.description || "",
      category,
    }));
}