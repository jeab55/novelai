// ตัวประกอบ context กลางสำหรับการเขียนตอน (Bulk / AI Draft)
// เป้าหมาย: ทุกตอนที่เขียนทีละตอน ต้องได้ context ครบเท่ากับโหมดสร้างทั้งหมด
// — โครง 3 องก์, โครงตอนก่อน/ปัจจุบัน/ถัดไป, ตัวละครครบ, โลก/ฉากที่เกี่ยวข้อง,
//   บทสรุปย่อตอนก่อนหน้าที่เขียนแล้ว, สไตล์นักเขียน, จำนวนคำเป้าหมาย

const DEFAULT_WRITER_PROMPT = `คุณคือนักเขียนนิยายภาษาไทยมืออาชีพที่กำลังร่างตอนใหม่ให้ผู้เขียน
คุณต้องร่างเนื้อหาตอนที่สมบูรณ์ตามโครงที่ได้รับ รักษาสำนวนและโทนของเรื่อง ใช้ภาษาไทยที่อ่านลื่น`;

// กฎพื้นฐานร่วม (craft) — ใส่ครั้งเดียวให้ทุกการเรียก AI เขียน เพื่อไม่ให้ซ้ำซ้อนใน system_prompt ของนักเขียนแต่ละคน
// กฎเหล่านี้คือ "วิธีนำเสนอสำหรับนิยายออนไลน์" ที่ใช้ร่วมกันได้ทุกแนว — ไม่กำหนดสไตล์/น้ำเสียงเฉพาะตัว
export const SHARED_CRAFT_RULES = `[กฎพื้นฐานงานเขียนออนไลน์ — เป็นวิธีนำเสนอ ไม่ใช่สไตล์]
※ ลำดับความสำคัญ: ข้อที่เป็น "รูปแบบเทคนิค" (กฎบทสนทนาเรื่องขึ้นบรรทัดใหม่เมื่อเปลี่ยนผู้พูด / ห้ามรูปแบบ "ชื่อ: คำพูด", การเว้นบรรทัดให้โปร่ง, และห้ามใส่หัวข้อ/เลขฉากในผลลัพธ์) — บังคับทุกกรณี ส่วนข้อที่เหลือทั้งหมดเป็น "แนวทางคุณภาพที่เป็นค่าเริ่มต้น": ถ้าสไตล์นักเขียนประจำเรื่องด้านบนกำหนดต่างจากข้อใด ให้ยึดสไตล์นักเขียนก่อนเสมอ ห้ามให้กฎเหล่านี้กลบลายเซ็นเฉพาะตัวของนักเขียน
- เปิดตอนให้ติดหมัดใน 1-2 ย่อหน้าแรก มีปม คำถาม หรือสิ่งผิดปกติทันที ไม่เปิดด้วยบรรยายฉากยาวหรือเล่าอดีต
- ปิดตอนให้ค้างใจ ส่วนใหญ่ปิดด้วยเบ็ด (คำถามค้าง / ข้อมูลใหม่กระแทก / การตัดสินใจชวนลุ้น) แต่ไม่ต้องเป็นสูตรเดียวทุกตอน — บางตอนปิดนิ่งเพื่อพักอารมณ์ หรือปิดด้วยภาพ/ประโยคคมที่ทิ้งความรู้สึกไว้ก็ได้ (ยกเว้นตอนจบเรื่อง)
- บทสนทนาขับเรื่อง สัดส่วนราว 40-60% ของฉากปกติ (ปรับเพิ่มได้ตามแนวที่นักเขียนถนัด)
- กฎบทสนทนา: ขึ้นบรรทัดใหม่ทุกครั้งที่เปลี่ยนผู้พูด / ใช้การกระทำ-ท่าทาง (action beat) ติดกับคำพูดเพื่อระบุผู้พูดและอารมณ์ แทนการเขียน "เขากล่าว" ซ้ำๆ / ห้ามใช้รูปแบบ "ชื่อ: คำพูด" / ให้บทสนทนามีชั้นใต้คำพูด (subtext) ตัวละครไม่ต้องพูดสิ่งที่คิดตรงๆ เสมอ
- ตัวละครแต่ละคนมีลายเซ็นการพูดเฉพาะตัว อ่านแล้วแยกได้แม้ไม่บอกชื่อ
- ย่อหน้าสั้น 2-4 ประโยค เว้นบรรทัดให้โปร่ง เหมาะกับการอ่านบนมือถือ
- ก่อนเขียนแต่ละฉาก กำหนด "อารมณ์เป้าหมาย" ที่อยากให้ผู้อ่านรู้สึก แล้วเขียนให้ถึง

[ชั้นเชิงร้อยแก้ว (craft) — ยกระดับจากงานกลางๆ เป็นงานคุณภาพ]
- แสดงอย่าบอก (show, don't tell): แทนบอกอารมณ์ตรงๆ ("เธอโกรธมาก") ให้แสดงผ่านการกระทำ ท่าทาง ร่างกาย ("มือเธอกำจนเล็บจิกฝ่ามือ")
- เลี่ยงคำกรอง (filter words) ที่ถ่างผู้อ่านออกจากฉาก เช่น "รู้สึกว่า", "เห็นว่า", "ได้ยินว่า", "นึกว่า" — ตัดออกแล้วเล่าสิ่งนั้นตรงๆ
- ให้ประสาทสัมผัสยึดฉากกับความจริง: เลือกดีเทลที่ "คม" 1-2 จุดต่อฉาก ไม่บรรยายทุกอย่าง
- จังหวะประโยค: สลับประโยคสั้น-ยาว ประโยคสั้นห้วนเร่งความตึง/จุดกระแทก ประโยคยาวตอนไหลลื่น อย่าราบเรียบเท่ากันหมด
- ใช้กริยาที่มีพลังและเฉพาะเจาะจง เลี่ยงกริยากลางๆ ("ทำ", "เดินไป", "มองดู") และคำวิเศษณ์ฟุ่มเฟือย
- อย่าบรรยายรูปพรรณตัวละคร/ฉากซ้ำเดิมทุกตอน เอ่ยถึงเฉพาะเมื่อมีความหมายต่อฉากนั้น
- หลีกเลี่ยงวลีสำเร็จรูป/สำนวนเฝือ (cliché) — หาวิธีพูดที่สดและเป็นของเรื่องนี้เอง
- โครงสร้างภายในตอน: ก่อนเขียน วางฉากย่อย 3-5 ฉากในใจ แต่ละฉากมีเป้าหมาย ความขัดแย้ง และจุดเปลี่ยน จัดจังหวะให้ตอนไต่ระดับความตึงขึ้นเรื่อยๆ — แล้วเขียนเป็นร้อยแก้วต่อเนื่อง ห้ามแสดงหัวข้อ/เลขฉากในผลลัพธ์ ให้ออกมาเป็นเนื้อเรื่องล้วน`;

// ตัดเนื้อหายาวเป็นบทสรุปย่อแบบ heuristic (ไม่เรียก AI เพิ่ม เพื่อความเร็ว)
function summarizeContent(content, maxChars = 600) {
  if (!content) return "";
  const clean = content.replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return clean;
  // เก็บต้นเรื่อง + ท้ายเรื่อง เพื่อรักษาทั้งจุดเริ่มและจุดจบของตอน
  const head = clean.substring(0, Math.floor(maxChars * 0.6));
  const tail = clean.substring(clean.length - Math.floor(maxChars * 0.35));
  return `${head} … ${tail}`;
}

/**
 * ประกอบ system prompt ที่ครบบริบทสำหรับการเขียน "ตอนหนึ่งตอน"
 *
 * @param {Object} args
 * @param {Object} args.novel              นิยาย (มี plot_outline 3 องก์, synopsis, era, genre, ending_type, novel_type, word_count_target)
 * @param {Array}  args.characters         ตัวละครทั้งหมด (นิสัย/ปม/ความสัมพันธ์)
 * @param {Array}  args.worldEntries       WorldEntry ทั้งหมด (สถานที่/ขนบ/ระบบ)
 * @param {Array}  args.plotEvents         ไทม์ไลน์ทั้งหมด (เรียง order)
 * @param {Array}  args.allChapters        ตอนทั้งหมด (ที่มีเนื้อหา/โครง) เรียง order — ใช้หาตอนก่อน/ถัดไป
 * @param {number} args.currentOrder       ลำดับตอนที่กำลังเขียน
 * @param {Object} [args.linkedEvent]      เหตุการณ์ไทม์ไลน์หลักของตอนนี้
 * @param {string} [args.writerPrompt]     สไตล์การเขียนของนักเขียน AI
 * @param {number} [args.wordTarget]       จำนวนคำเป้าหมายต่อตอน
 * @param {Object} [args.previousSeasonLastChapter] ตอนท้ายของ Season ก่อนหน้า (สำหรับ Season 2+)
 * @param {string} [args.isOneShotSection] บล็อกคำสั่งเพิ่มเติม (กรณีเรื่องสั้น) — ส่งเป็น string ถ้ามี
 */
export function buildChapterContext({
  novel,
  characters = [],
  worldEntries = [],
  plotEvents = [],
  allChapters = [],
  currentOrder,
  linkedEvent = null,
  writerPrompt = "",
  wordTarget = 1500,
  previousSeasonLastChapter = null,
  isOneShotSection = "",
}) {
  // สไตล์เฉพาะตัวของนักเขียนประจำเรื่อง = แกนหลักที่ต้องยึด (มาก่อนเสมอ)
  let ctx = `[สไตล์นักเขียนประจำเรื่อง — แกนหลักที่ต้องยึดอย่างเคร่งครัด ใช้สำนวน น้ำเสียง โทรป และมุมมองเฉพาะตัวนี้เป็นหลักในทุกประโยค]\n${writerPrompt || DEFAULT_WRITER_PROMPT}\n\n`;
  // กฎพื้นฐานร่วม = วิธีนำเสนอ (รอง) ไม่ลบล้างสไตล์เฉพาะตัวข้างบน
  ctx += `${SHARED_CRAFT_RULES}\n\n`;

  if (isOneShotSection) ctx += isOneShotSection;

  // ── บริบทเรื่อง + โครงเรื่องภาพรวมทั้งหมด ──
  ctx += `[บริบทเรื่อง]\n`;
  ctx += `ชื่อเรื่อง: ${novel.title}\n`;
  if (novel.genre) ctx += `แนว: ${novel.genre}\n`;
  if (novel.era) ctx += `ยุคสมัย/ฉากหลัง: ${novel.era}\n`;
  if (novel.synopsis) ctx += `เรื่องย่อ: ${novel.synopsis}\n`;
  if (novel.plot_outline) ctx += `\n[โครงเรื่องภาพรวมของทั้งเรื่อง — โครงสร้างการเล่าที่ตอนนี้ต้องสอดคล้อง (ยึดโครงสร้างตามที่โครงนี้กำหนดจริง จะเป็น 3 องก์หรือแบบอื่นก็ได้)]\n${novel.plot_outline}\n`;

  // ── ตัวละครหลักทั้งหมด ──
  if (characters.length > 0) {
    ctx += `\n[ตัวละครทั้งหมด — รักษานิสัย ปม และความสัมพันธ์ให้คงเส้นคงวา]\n`;
    characters.forEach((c) => {
      ctx += `• ${c.name} (${c.role || "ตัวประกอบ"})${c.age ? ` อายุ ${c.age}` : ""}`;
      if (c.personality) ctx += ` — ${c.personality}`;
      ctx += `\n`;
      if (c.appearance) ctx += `  ลักษณะ: ${c.appearance}\n`;
      if (c.background) ctx += `  ปูมหลัง: ${c.background}\n`;
      if (c.desire) ctx += `  สิ่งที่ต้องการ (Want): ${c.desire}\n`;
      if (c.wound) ctx += `  ปมในใจ (Wound): ${c.wound}\n`;
      if (c.relationships) ctx += `  ความสัมพันธ์: ${c.relationships}\n`;
      if (c.voice_profile) ctx += `  เสียงพูด (ลายนิ้วมือเสียง — ใช้อ้างอิงเขียนบทสนทนาให้คงเสียงเดิม): ${c.voice_profile}\n`;
      if (c.address_terms) ctx += `  สรรพนาม & คำเรียกขาน (รายคู่ — ใช้คำเรียกให้ถูกและเปลี่ยนคำเรียกให้ตรงจังหวะความสัมพันธ์/อารมณ์): ${c.address_terms}\n`;
    });
  }

  // ── โลกและฉาก (เน้นที่เกี่ยวข้องกับตอนนี้ก่อน แล้วตามด้วยที่เหลือ) ──
  if (worldEntries.length > 0) {
    ctx += `\n[โลกและฉาก — ขนบธรรมเนียม สถานที่ ระบบ ที่ต้องใช้ให้ถูกต้อง]\n`;
    worldEntries.forEach((w) => {
      ctx += `• [${w.category || "อื่นๆ"}] ${w.title}${w.description ? `: ${w.description}` : ""}\n`;
    });
  }

  // ── ไทม์ไลน์เหตุการณ์ทั้งหมด ──
  if (plotEvents.length > 0) {
    ctx += `\n[ไทม์ไลน์เหตุการณ์ทั้งเรื่อง]\n`;
    plotEvents.forEach((e) => {
      ctx += `• #${e.order} ${e.title}${e.is_historical ? " [ประวัติศาสตร์]" : ""}${e.time_period ? ` (${e.time_period})` : ""}\n`;
      if (e.description) ctx += `  ${e.description}\n`;
    });
  }

  // ── โครงของตอนก่อนหน้า / ตอนปัจจุบัน / ตอนถัดไป (เพื่อความต่อเนื่อง) ──
  const sorted = [...allChapters].filter((c) => c && c.order != null).sort((a, b) => a.order - b.order);
  const prevOutline = sorted.find((c) => c.order === currentOrder - 1);
  const currentOutline = sorted.find((c) => c.order === currentOrder);
  const nextOutline = sorted.find((c) => c.order === currentOrder + 1);

  const outlineOf = (ch) => {
    if (!ch) return "";
    // ใช้ plot_event_description เป็นโครงถ้ามี ไม่งั้นใช้บทสรุปจากเนื้อหา
    return ch.plot_event_description || summarizeContent(ch.content, 300) || "";
  };

  if (prevOutline || currentOutline || nextOutline) {
    ctx += `\n[โครงตอนโดยรอบ — เพื่อให้ตอนนี้เชื่อมต่ออย่างลื่นไหล]\n`;
    if (prevOutline) {
      const o = outlineOf(prevOutline);
      ctx += `• ตอนก่อนหน้า (#${prevOutline.order}) "${prevOutline.title}"${o ? `: ${o}` : ""}\n`;
    }
    if (currentOutline) {
      const o = outlineOf(currentOutline);
      ctx += `• ★ ตอนที่กำลังเขียน (#${currentOutline.order}) "${currentOutline.title}"${o ? `: ${o}` : ""}\n`;
    }
    if (nextOutline) {
      const o = outlineOf(nextOutline);
      ctx += `• ตอนถัดไป (#${nextOutline.order}) "${nextOutline.title}"${o ? `: ${o}` : ""}\n`;
      ctx += `  → วางจังหวะให้ตอนนี้ส่งต่อไปยังตอนถัดไปได้อย่างเป็นธรรมชาติ\n`;
    }
  }

  // ── บทสรุปย่อของตอนก่อนหน้าที่เขียนไปแล้ว (เนื้อหาจริง) ──
  if (previousSeasonLastChapter && novel.parent_novel_id) {
    ctx += `\n[ตอนสุดท้ายของ Season ก่อนหน้า — เชื่อมต่อเนื้อเรื่อง]\n`;
    ctx += `— ${previousSeasonLastChapter.title} —\n`;
    const preview = (previousSeasonLastChapter.content || "").substring(0, 2000);
    ctx += `${preview}${(previousSeasonLastChapter.content || "").length > 2000 ? "\n…(ต่อ)" : ""}\n`;
    ctx += `→ เขียนตอนนี้ต่อเนื่องจากตอนจบล่าสุด ไม่ต้องเล่าซ้ำ รักษาโทนและตัวละครให้สอดคล้อง\n`;
  } else {
    // บทสรุปย่อตอนก่อนหน้าทั้งหมด (กระชับ) + เนื้อหาเต็มของ 2 ตอนล่าสุด
    const writtenBefore = sorted.filter((c) => c.order < currentOrder && c.content && c.content.trim().length > 100);
    if (writtenBefore.length > 0) {
      // บทสรุปย่อสะสมของทุกตอนก่อนหน้า — เพื่อ "ความจำเรื่อง" เท่ากับโหมดสร้างทั้งหมด
      if (writtenBefore.length > 2) {
        ctx += `\n[เรื่องย่อสะสมของตอนก่อนหน้า — สิ่งที่เกิดขึ้นมาแล้ว]\n`;
        writtenBefore.slice(0, -2).forEach((ch) => {
          // ใช้ recap (rolling summary) ถ้ามี — เก็บเหตุการณ์สำคัญ+ปมค้างได้ดีกว่าการตัด string หัว-ท้าย (fallback ไป summarizeContent ถ้าตอนนั้นยังไม่มี recap)
          const memo = ch.recap && ch.recap.trim() ? ch.recap.trim() : summarizeContent(ch.content, 400);
          ctx += `• ตอนที่ ${ch.order} "${ch.title}": ${memo}\n`;
        });
      }
      // เนื้อหาเต็ม (preview) ของ 2 ตอนล่าสุด — เพื่อรักษาสำนวนและความต่อเนื่องระดับฉาก
      ctx += `\n[เนื้อหาตอนล่าสุด — รักษาสำนวนและความต่อเนื่องระดับฉาก]\n`;
      writtenBefore.slice(-2).forEach((ch) => {
        const preview = (ch.content || "").substring(0, 1500);
        ctx += `\n— ตอนที่ ${ch.order}: "${ch.title}" —\n${preview}${(ch.content || "").length > 1500 ? "\n…(ต่อ)" : ""}\n`;
      });
    }
  }

  // ── เหตุการณ์หลักของตอนนี้ ──
  if (linkedEvent) {
    ctx += `\n[เหตุการณ์หลักที่ตอนนี้ต้องบรรยาย — แกนกลางของพล็อต]\n`;
    ctx += `ลำดับ ${linkedEvent.order}: ${linkedEvent.title}\n`;
    if (linkedEvent.description) ctx += `รายละเอียด: ${linkedEvent.description}\n`;
    if (linkedEvent.time_period) ctx += `ช่วงเวลา: ${linkedEvent.time_period}\n`;
    if (linkedEvent.characters_involved) ctx += `ตัวละครที่เกี่ยวข้อง: ${linkedEvent.characters_involved}\n`;
  }

  return ctx;
}