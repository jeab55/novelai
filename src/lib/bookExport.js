// ─── ตัวช่วยจัดรูปเล่ม & ส่งออกหนังสือ (client-side) ───────────────────────────
// รวมเนื้อหาตอนเป็นต้นฉบับหนังสือ แล้วสร้าง Markdown / HTML(A5 print) / TXT / JSON

// นับคำภาษาไทย
export function countThaiWords(text) {
  if (!text) return 0;
  try {
    const seg = new Intl.Segmenter("th", { granularity: "word" });
    return [...seg.segment(text)].filter((s) => s.isWordLike).length;
  } catch {
    return String(text).trim().split(/\s+/).filter(Boolean).length;
  }
}

// ทำชื่อไฟล์ให้ปลอดภัย
export function safeFilename(name) {
  return (name || "untitled").replace(/[\\/:*?"<>|]/g, "_").trim();
}

// ดาวน์โหลดไฟล์ผ่าน Blob
export function downloadBlob(filename, content, mimeType = "text/plain") {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// escape HTML
function esc(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// แปลงเนื้อหาข้อความเป็นย่อหน้า HTML
function paragraphsToHtml(content = "") {
  return String(content)
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br/>")}</p>`)
    .join("\n");
}

// ─── ตรวจทานต้นฉบับ — คืน list ปัญหา ─────────────────────────────────────────
export function analyzeManuscript(chapters = [], { maxParagraphWords = 400 } = {}) {
  const issues = [];
  const titleCount = {};
  const orderCount = {};

  chapters.forEach((ch) => {
    const t = (ch.title || "").trim();
    titleCount[t] = (titleCount[t] || 0) + 1;
    const o = ch.order ?? "—";
    orderCount[o] = (orderCount[o] || 0) + 1;
  });

  chapters.forEach((ch, i) => {
    const label = `บทที่ ${i + 1}: ${ch.title || "(ไม่มีชื่อ)"}`;
    const words = countThaiWords(ch.content);
    if (!ch.content || !ch.content.trim()) {
      issues.push({ type: "empty", severity: "high", chapter: label, detail: "ตอนนี้ไม่มีเนื้อหา (ว่างเปล่า)" });
    }
    if ((ch.title || "").trim() && titleCount[(ch.title || "").trim()] > 1) {
      issues.push({ type: "dup_title", severity: "medium", chapter: label, detail: `ชื่อตอนซ้ำกับตอนอื่น ("${ch.title}")` });
    }
    if (orderCount[ch.order] > 1) {
      issues.push({ type: "dup_order", severity: "medium", chapter: label, detail: `ลำดับตอน (order = ${ch.order}) ซ้ำกับตอนอื่น` });
    }
    // ย่อหน้ายาวเกิน
    const longPara = String(ch.content || "")
      .split(/\n{2,}/)
      .find((p) => countThaiWords(p) > maxParagraphWords);
    if (longPara) {
      issues.push({ type: "long_para", severity: "low", chapter: label, detail: `มีย่อหน้ายาวเกิน ${maxParagraphWords} คำ ควรพิจารณาแบ่งย่อหน้า` });
    }
    if (words > 0 && words < 50) {
      issues.push({ type: "too_short", severity: "low", chapter: label, detail: `ตอนสั้นผิดปกติ (${words} คำ)` });
    }
  });

  // ลบซ้ำระดับ dup (เก็บครั้งแรกพอ) — คงไว้ตามตอนเพื่อชี้เป้าได้
  return issues;
}

// ─── ค่าประมาณเลย์เอาต์ A5 (ใช้คำนวณเลขหน้าโดยประมาณสำหรับ HTML/PDF) ─────────
// อ้างอิงรูปแบบ A5 ของระบบ: หน้า A5 148×210mm, ขอบ 18/16mm, ฟอนต์ Sarabun ~14pt
// ค่าเหล่านี้เป็น "ค่าประมาณ" — จะคลาดเคลื่อนหากผู้ใช้เปลี่ยนฟอนต์/ขอบกระดาษ/ขนาดตัวอักษร
export const A5_LAYOUT = {
  words_per_page: 220, // คำโดยประมาณต่อหน้า A5 (Sarabun 14pt, line-height 1.75)
  front_matter_pages: 2, // ปก + ปกใน (ก่อนส่วนเนื้อหา)
};

// ─── คำเตือนความคลาดเคลื่อนของเลขหน้า (ใช้ทั้ง UI และ HTML) ──────────────────
export const PAGE_ESTIMATE_WARNING =
  "เลขหน้าคำนวณโดยประมาณจากรูปแบบ A5 มาตรฐานของระบบ (ฟอนต์ Sarabun, ขอบ 18/16mm) " +
  "หากเปลี่ยนฟอนต์ ขนาดตัวอักษร หรือขอบกระดาษตอนพิมพ์/บันทึก PDF เลขหน้าอาจคลาดเคลื่อนได้";

// คำนวณเลขหน้าเริ่มต้นของแต่ละบท (ประมาณ) — สำหรับ HTML/PDF เท่านั้น
function estimatePageStarts(bookChapters, layout = A5_LAYOUT) {
  const wpp = layout.words_per_page || 220;
  // หน้าเริ่มเนื้อหา = ปก + ปกใน + front matter + สารบัญ (เผื่ออย่างน้อย 1 หน้า)
  let cursor = (layout.front_matter_pages || 2) + 1 /* toc */ + 1;
  return bookChapters.map((c) => {
    const startPage = cursor;
    const pages = Math.max(1, Math.ceil((c.word_count || 0) / wpp));
    cursor += pages; // แต่ละบทขึ้นหน้าใหม่
    return { index: c.index, title: c.title, start_page: startPage, estimated_pages: pages };
  });
}

// ─── สร้าง object รูปเล่ม (สำหรับ JSON + เป็น source ของ export อื่น) ─────────
export function buildBookObject(meta, chapters = []) {
  const sorted = [...chapters].sort((a, b) => (a.order || 0) - (b.order || 0));
  const bookChapters = sorted.map((ch, i) => ({
    index: i + 1,
    order: ch.order ?? i + 1,
    title: ch.title || `บทที่ ${i + 1}`,
    word_count: countThaiWords(ch.content),
    content: ch.content || "",
  }));
  const totalWords = bookChapters.reduce((s, c) => s + c.word_count, 0);

  // สารบัญแบบอ่านต่อเนื่อง — ไม่มีเลขหน้า (ใช้กับ Markdown/TXT/JSON)
  const tableOfContents = bookChapters.map((c) => ({
    index: c.index,
    title: c.title,
    word_count: c.word_count,
  }));

  // เลขหน้าประมาณ — เฉพาะ HTML/PDF (แยกออกจาก tableOfContents ไม่ปนกัน)
  const printPageEstimates = {
    layout: "A5",
    words_per_page: A5_LAYOUT.words_per_page,
    note: PAGE_ESTIMATE_WARNING,
    chapters: estimatePageStarts(bookChapters),
  };

  return {
    version: 2,
    generated_at: new Date().toISOString(),
    meta,
    stats: { chapter_count: bookChapters.length, total_words: totalWords },
    // สารบัญอ่านต่อเนื่อง (ไม่มีเลขหน้า)
    tableOfContents,
    // เลขหน้าประมาณสำหรับ HTML/PDF เท่านั้น (แยกกันชัดเจน)
    printPageEstimates,
    chapters: bookChapters,
  };
}

// ─── Markdown ───────────────────────────────────────────────────────────────
export function buildMarkdown(book) {
  const { meta, chapters } = book;
  const lines = [];
  lines.push(`# ${meta.title || "ไม่มีชื่อเรื่อง"}`);
  if (meta.subtitle) lines.push(`### ${meta.subtitle}`);
  lines.push("");
  if (meta.author) lines.push(`**ผู้แต่ง:** ${meta.author}`);
  if (meta.translator) lines.push(`**ผู้แปล/เรียบเรียง:** ${meta.translator}`);
  if (meta.publisher) lines.push(`**สำนักพิมพ์:** ${meta.publisher}`);
  if (meta.category) lines.push(`**หมวด:** ${meta.category}`);
  if (meta.status) lines.push(`**สถานะ:** ${meta.status}`);
  lines.push("\n---\n");

  if (meta.blurb) {
    lines.push(`> ${meta.blurb.replace(/\n/g, "\n> ")}`);
    lines.push("\n---\n");
  }
  if (meta.preface) {
    lines.push(`## คำนำ\n\n${meta.preface}\n\n---\n`);
  }
  if (meta.editor_note) {
    lines.push(`## หมายเหตุผู้เรียบเรียง\n\n${meta.editor_note}\n\n---\n`);
  }

  // สารบัญ
  lines.push(`## สารบัญ\n`);
  chapters.forEach((c) => lines.push(`${c.index}. ${c.title}`));
  lines.push("\n---\n");

  // เนื้อหา
  chapters.forEach((c) => {
    lines.push(`## บทที่ ${c.index}: ${c.title}\n`);
    lines.push(`${c.content || "*(ไม่มีเนื้อหา)*"}\n`);
    lines.push("\n---\n");
  });

  if (meta.afterword) lines.push(`## บทส่งท้าย\n\n${meta.afterword}\n\n---\n`);
  if (meta.about_author) lines.push(`## เกี่ยวกับผู้แต่ง\n\n${meta.about_author}\n\n---\n`);
  if (meta.next_volume) lines.push(`## เล่มถัดไป / หมายเหตุท้ายเล่ม\n\n${meta.next_volume}\n\n---\n`);
  if (meta.copyright) lines.push(`## ลิขสิทธิ์ / เครดิต\n\n${meta.copyright}\n`);

  return lines.join("\n");
}

// ─── TXT ────────────────────────────────────────────────────────────────────
export function buildTxt(book) {
  const { meta, chapters } = book;
  const bar = "=".repeat(40);
  const lines = [];
  lines.push(bar, (meta.title || "").toUpperCase(), meta.subtitle || "", bar, "");
  if (meta.author) lines.push(`ผู้แต่ง: ${meta.author}`);
  if (meta.translator) lines.push(`ผู้แปล/เรียบเรียง: ${meta.translator}`);
  if (meta.publisher) lines.push(`สำนักพิมพ์: ${meta.publisher}`);
  lines.push("");
  if (meta.blurb) lines.push(meta.blurb, "");
  if (meta.preface) lines.push("── คำนำ ──", meta.preface, "");

  lines.push("── สารบัญ ──");
  chapters.forEach((c) => lines.push(`${c.index}. ${c.title}`));
  lines.push("");

  chapters.forEach((c) => {
    lines.push(bar, `บทที่ ${c.index}: ${c.title}`, bar, "", c.content || "(ไม่มีเนื้อหา)", "");
  });

  if (meta.afterword) lines.push("── บทส่งท้าย ──", meta.afterword, "");
  if (meta.about_author) lines.push("── เกี่ยวกับผู้แต่ง ──", meta.about_author, "");
  if (meta.copyright) lines.push("── ลิขสิทธิ์ / เครดิต ──", meta.copyright, "");
  return lines.join("\n");
}

// ─── HTML (A5 print / PDF friendly — มีเลขหน้า) ─────────────────────────────
export function buildPrintHtml(book) {
  const { meta, chapters } = book;
  // map เลขหน้าประมาณต่อ index
  const pageByIndex = {};
  (book.printPageEstimates?.chapters || []).forEach((p) => { pageByIndex[p.index] = p.start_page; });

  // สารบัญ HTML: ชื่อบท ........ หน้า N
  const toc = chapters
    .map((c) => `<li><span class="toc-num-left">${c.index}.</span><span class="toc-title">${esc(c.title)}</span><span class="toc-dots"></span><span class="toc-page">หน้า ${pageByIndex[c.index] ?? "—"}</span></li>`)
    .join("\n");

  const body = chapters
    .map(
      (c) => `
    <div class="page chapter">
      <h2 class="chapter-title"><span class="chapter-num">บทที่ ${c.index}</span>${esc(c.title)}</h2>
      <div class="chapter-body">${paragraphsToHtml(c.content) || "<p><em>(ไม่มีเนื้อหา)</em></p>"}</div>
    </div>`
    )
    .join("\n");

  const coverImg = meta.cover_url
    ? `<div class="cover-img" style="background-image:url('${esc(meta.cover_url)}')"></div>`
    : `<div class="cover-img cover-fallback">${esc(meta.title || "")}</div>`;

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(meta.title || "หนังสือ")}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&family=Noto+Serif+Thai:wght@400;500;600;700&display=swap');
@page {
  size: A5;
  margin: 18mm 16mm;
  /* เลขหน้าที่ footer ทุกหน้า (เท่าที่ CSS print ทำได้) */
  @bottom-center { content: counter(page); font-family: 'Sarabun', sans-serif; font-size: 9pt; color: #78716c; }
}
* { box-sizing: border-box; }
body { font-family: 'Sarabun', sans-serif; color: #1c1917; line-height: 1.75; margin: 0; background: #f5f5f4; }
.page { background: #fff; width: 148mm; min-height: 210mm; margin: 12px auto; padding: 18mm 16mm; box-shadow: 0 4px 18px rgba(0,0,0,.12); page-break-after: always; }
h1,h2,h3 { font-family: 'Noto Serif Thai', serif; }
/* Cover */
.cover { display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:14px; }
.cover-img { width: 90mm; height: 120mm; border-radius: 8px; background-size: cover; background-position:center; box-shadow: 0 8px 24px rgba(0,0,0,.2); display:flex; align-items:center; justify-content:center; }
.cover-fallback { background: linear-gradient(135deg,#f59e0b,#ea580c); color:#fff; font-family:'Noto Serif Thai',serif; font-size: 22pt; font-weight:700; padding: 20px; }
.cover h1 { font-size: 26pt; margin: 8px 0 0; }
.cover .subtitle { font-size: 14pt; color:#78716c; margin:0; }
.cover .author { font-size: 13pt; margin-top: 18px; }
.cover .cover-text { font-size: 11pt; color:#57534e; white-space:pre-line; }
/* Title page */
.title-page { text-align:center; display:flex; flex-direction:column; justify-content:center; gap:10px; }
.title-page h1 { font-size: 24pt; }
.title-page .meta { color:#57534e; font-size: 11pt; }
/* Front matter */
.front h2 { font-size: 17pt; border-bottom: 2px solid #f59e0b; padding-bottom: 6px; margin-bottom: 14px; }
.front p { white-space: pre-line; }
/* TOC — ชื่อบท ....... หน้า N */
.toc h2 { font-size: 18pt; margin-bottom: 6px; }
.toc .toc-hint { font-size: 8.5pt; color:#a8a29e; margin: 0 0 14px; }
.toc ol { list-style:none; padding:0; margin:0; }
.toc li { display:flex; align-items:baseline; gap:6px; padding: 5px 0; font-size: 11pt; }
.toc-num-left { color:#f59e0b; font-weight:600; min-width: 2.2em; }
.toc-title { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width: 64%; }
.toc-dots { flex:1; border-bottom: 1px dotted #a8a29e; transform: translateY(-3px); }
.toc-page { color:#78716c; white-space:nowrap; }
/* footer เลขหน้า fallback บนจอ (บนกระดาษใช้ @page counter) */
.page-footer { position:absolute; bottom:8mm; left:0; right:0; text-align:center; font-size:9pt; color:#a8a29e; }
@media print { .page-footer { display:none; } }
/* Chapters — แต่ละบทขึ้นหน้าใหม่ (ตรงกับการประมาณเลขหน้า) */
.chapter-title { font-size: 18pt; margin: 0 0 18px; text-align:center; }
.chapter-num { display:block; font-size: 11pt; color:#f59e0b; font-weight:600; letter-spacing:1px; margin-bottom:4px; }
.chapter-body p { text-indent: 2em; margin: 0 0 10px; text-align: justify; }
@media screen and (max-width: 640px){ .page{ width:auto; padding: 24px; } .cover-img{ width: 70vw; height: 95vw; } }
@media print { body{ background:#fff; } .page{ box-shadow:none; margin:0; width:auto; min-height:auto; } }
</style>
</head>
<body>
  <!-- ปก -->
  <div class="page cover">
    ${coverImg}
    <h1>${esc(meta.title || "")}</h1>
    ${meta.subtitle ? `<p class="subtitle">${esc(meta.subtitle)}</p>` : ""}
    ${meta.author ? `<p class="author">${esc(meta.author)}</p>` : ""}
    ${meta.cover_text ? `<p class="cover-text">${esc(meta.cover_text)}</p>` : ""}
  </div>

  <!-- ปกใน -->
  <div class="page title-page">
    <h1>${esc(meta.title || "")}</h1>
    ${meta.subtitle ? `<p class="subtitle">${esc(meta.subtitle)}</p>` : ""}
    <div class="meta">
      ${meta.author ? `<div>ผู้แต่ง: ${esc(meta.author)}</div>` : ""}
      ${meta.translator ? `<div>ผู้แปล/เรียบเรียง: ${esc(meta.translator)}</div>` : ""}
      ${meta.publisher ? `<div>${esc(meta.publisher)}</div>` : ""}
      ${meta.category ? `<div>หมวด: ${esc(meta.category)}</div>` : ""}
    </div>
    ${meta.inner_title_note ? `<p class="cover-text">${esc(meta.inner_title_note)}</p>` : ""}
  </div>

  ${meta.blurb ? `<div class="page front"><h2>คำโปรย</h2><p>${esc(meta.blurb)}</p></div>` : ""}
  ${meta.preface ? `<div class="page front"><h2>คำนำ</h2><p>${esc(meta.preface)}</p></div>` : ""}
  ${meta.editor_note ? `<div class="page front"><h2>หมายเหตุผู้เรียบเรียง</h2><p>${esc(meta.editor_note)}</p></div>` : ""}
  ${meta.copyright ? `<div class="page front"><h2>ลิขสิทธิ์ / เครดิต</h2><p>${esc(meta.copyright)}</p></div>` : ""}

  <!-- สารบัญ (มีเลขหน้าประมาณตามรูปแบบ A5) -->
  <div class="page toc">
    <h2>สารบัญ</h2>
    <p class="toc-hint">* ${esc(PAGE_ESTIMATE_WARNING)}</p>
    <ol>${toc}</ol>
  </div>

  <!-- เนื้อหา (แต่ละบท = 1 หน้าเริ่มต้น) -->
  ${body}

  ${meta.afterword ? `<div class="page front"><h2>บทส่งท้าย</h2><p>${esc(meta.afterword)}</p></div>` : ""}
  ${meta.about_author ? `<div class="page front"><h2>เกี่ยวกับผู้แต่ง</h2><p>${esc(meta.about_author)}</p></div>` : ""}
  ${meta.next_volume ? `<div class="page front"><h2>เล่มถัดไป / หมายเหตุท้ายเล่ม</h2><p>${esc(meta.next_volume)}</p></div>` : ""}
</body>
</html>`;
}