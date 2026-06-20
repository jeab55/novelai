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
    // ดึงเฉพาะก้อน JSON แรกที่เจอ
    const m = cleaned.match(/[[{][\s\S]*[\]}]/);
    if (m) {
      try { return JSON.parse(m[0]); } catch { /* ตกไป */ }
    }
    return null;
  }
}

function buildNovelContext(novel, writer) {
  const writerContext = writer?.system_prompt ? `\nสไตล์การเขียน: ${writer.system_prompt}\n` : "";
  return `${writerContext}
ข้อมูลนิยาย:
- ชื่อเรื่อง: ${novel.title}
- แนว: ${novel.genre || "ไม่ระบุ"}
- เรื่องย่อ: ${novel.synopsis || "ไม่มีเรื่องย่อ"}
- ยุคสมัย/ฉากหลัง: ${novel.era || "ไม่ระบุ"}`;
}

function buildCharsContext(characters) {
  const known = characters.map((c) => c.name).filter(Boolean).join(", ") || "ยังไม่มี";
  const detailed = characters
    .filter((c) => c.name)
    .map((c) => `- ${c.name} (${c.role || "ตัวละคร"})${c.personality ? `: ${c.personality}` : ""}`)
    .join("\n");
  return { known, detailed };
}

/**
 * รอบแรก (เร็ว): วางโครง 3 องก์กระชับ + ตัวละครหลัก — output เล็ก ตอบไว
 * คงโมเดล claude_sonnet_4_6 ไว้เพื่อคุณภาพ
 */
export async function generatePlotSkeleton({ novel, writer, characters }, options = {}) {
  const ctx = buildNovelContext(novel, writer);
  const { known, detailed } = buildCharsContext(characters);

  const prompt = `${ctx}

ตัวละครที่มีอยู่แล้ว (ห้ามสร้างซ้ำชื่อ คงไว้): ${known}
${detailed ? `รายละเอียดตัวละครเดิม:\n${detailed}\n` : ""}
คุณคือบรรณาธิการ วาง "โครงเรื่องแบบกระชับ" เพื่อให้เห็นภาพรวมเร็ว ตอบเป็น JSON ล้วนเท่านั้น ห้ามมีข้อความอื่น

งาน:
1) เขียน plot_outline สรุปโครง 3 องก์ แก่น/ธีม คำถามหลัก จุดหักเห (กระชับ 4-6 บรรทัด)
2) สร้างตัวละครหลักที่จำเป็น (รวมตัวที่มีอยู่แล้วถ้ายังขาดรายละเอียด แต่ห้ามซ้ำชื่อที่ระบุไว้) แต่ละตัวมีฟิลด์: name, role, age, appearance, personality, background, desire, wound, relationships

ตอบ JSON โครงสร้างนี้เท่านั้น (ไม่มี markdown):
{"plot_outline":"...","characters":[{"name":"","role":"ตัวเอก","age":"","appearance":"","personality":"","background":"","desire":"","wound":"","relationships":""}]}

ภาษาไทยทั้งหมด ตอบ JSON ล้วน`;

  const schema = {
    type: "object",
    properties: {
      plot_outline: { type: "string" },
      characters: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" }, role: { type: "string" }, age: { type: "string" },
            appearance: { type: "string" }, personality: { type: "string" }, background: { type: "string" },
            desire: { type: "string" }, wound: { type: "string" }, relationships: { type: "string" },
          },
        },
      },
    },
  };
  const raw = await invokeAIStable({ prompt, model: "claude_sonnet_4_6", response_json_schema: schema }, options);
  const parsed = safeParse(raw);
  if (!parsed) throw new Error("แยกผลโครงเรื่องไม่สำเร็จ");
  return {
    outline: parsed.plot_outline || parsed.outline || "",
    characters: Array.isArray(parsed.characters) ? parsed.characters : [],
  };
}

/**
 * Parallel กับรอบแรก: แตกไทม์ไลน์แบบกระชับ (title + 1 บรรทัด/ตอน) — output เล็ก ตอบไว
 */
export async function generateTimelineOutline({ novel, writer, characters }, options = {}) {
  const ctx = buildNovelContext(novel, writer);
  const targetChapters = novel.target_chapters || 10;
  const { known } = buildCharsContext(characters);

  const prompt = `${ctx}
ตัวละครที่มีอยู่: ${known}

แบ่งโครงเรื่อง 3 องก์ออกเป็น ${targetChapters} ตอนเท่าๆ กัน แบบ "กระชับ" เพื่อเห็นภาพรวมเร็ว
แต่ละตอนมีแค่:
- order: เลขลำดับตอน (1-${targetChapters})
- title: ชื่อตอน
- description: สรุปสั้นๆ 1 บรรทัด (ไม่เกิน 1-2 ประโยค)
- act: องก์ (1=ต้น, 2=กลาง, 3=Climax/บทสรุป)

ตอบ JSON ล้วนเท่านั้น ไม่มี markdown:
{"events":[{"order":1,"title":"","description":"","act":1}]}

ครบ ${targetChapters} ตอน ครอบคลุม 3 องก์ เหมาะกับแนว "${novel.genre || "ทั่วไป"}" ภาษาไทยทั้งหมด ตอบ JSON ล้วน`;

  const schema = {
    type: "object",
    properties: {
      events: {
        type: "array",
        items: {
          type: "object",
          properties: {
            order: { type: "number" }, title: { type: "string" },
            description: { type: "string" }, act: { type: "number" },
          },
        },
      },
    },
  };
  const raw = await invokeAIStable({ prompt, model: "claude_sonnet_4_6", response_json_schema: schema }, options);
  const parsed = safeParse(raw);
  const eventsRaw = (parsed && (parsed.events || parsed.timeline || parsed.items)) || [];
  return eventsRaw.map((e, i) => ({
    order: e.order ?? i + 1,
    title: e.title || e.name || "",
    description: e.description || e.desc || "",
    act: e.act || 1,
  }));
}

/**
 * ขยายรายละเอียดเฉพาะเหตุการณ์เดียวที่ผู้ใช้เลือก — เรียกทีหลัง on-demand
 */
export async function expandTimelineEvent({ novel, writer, characters, event, outline }, options = {}) {
  const ctx = buildNovelContext(novel, writer);
  const { known } = buildCharsContext(characters);

  const prompt = `${ctx}
ตัวละครที่มีอยู่: ${known}
โครงเรื่องโดยรวม: ${outline || "(ไม่มี)"}

ขยายรายละเอียดของตอนนี้ให้ลึกขึ้น (เหตุการณ์สำคัญ ความขัดแย้ง อารมณ์ จุดพีค) ความยาว 3-5 บรรทัด:
- ตอนที่ ${event.order}: ${event.title}
- สรุปเดิม: ${event.description || "(ยังไม่มี)"}

ตอบเป็น "ข้อความบรรยายล้วน" ภาษาไทย ไม่ต้องมี JSON ไม่ต้องมีหัวข้อ`;

  const raw = await invokeAIStable({ prompt, model: "claude_sonnet_4_6" }, options);
  return stripFence(typeof raw === "string" ? raw : (raw?.text || "")).trim();
}