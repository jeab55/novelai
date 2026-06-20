// คำนวณสถิติการเขียนจากรายการตอน (chapters)

// นับคำภาษาไทย/อังกฤษด้วย Intl.Segmenter (fallback เป็นการแยกช่องว่าง)
export function countWords(text) {
  const clean = (text || "").replace(/<[^>]*>/g, " ").trim();
  if (!clean) return 0;
  try {
    const seg = new Intl.Segmenter("th", { granularity: "word" });
    let n = 0;
    for (const s of seg.segment(clean)) if (s.isWordLike) n++;
    return n;
  } catch {
    return clean.split(/\s+/).filter(Boolean).length;
  }
}

// คำของตอน: ใช้ word_count ถ้ามี ไม่งั้นนับจาก content
export function chapterWords(ch) {
  if (typeof ch.word_count === "number" && ch.word_count > 0) return ch.word_count;
  return countWords(ch.content);
}

function dayKey(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

// สรุปคำที่เขียนรายวัน (ตาม updated_date ของตอน) ย้อนหลัง N วัน
export function dailyWordSeries(chapters, days = 14) {
  const today = new Date();
  const buckets = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    buckets[dayKey(d)] = 0;
  }
  chapters.forEach((c) => {
    const k = dayKey(c.updated_date || c.created_date);
    if (k in buckets) buckets[k] += chapterWords(c);
  });
  return Object.entries(buckets).map(([date, words]) => {
    const dt = new Date(date);
    return { date, words, label: `${dt.getDate()}/${dt.getMonth() + 1}` };
  });
}

// สรุปต่อเรื่อง: จำนวนตอน + คำรวม
export function novelSummaries(novels, chaptersByNovel) {
  return novels.map((n) => {
    const chs = chaptersByNovel[n.id] || [];
    const totalWords = chs.reduce((sum, c) => sum + chapterWords(c), 0);
    return {
      id: n.id,
      title: n.title,
      genre: n.genre,
      chapterCount: chs.length,
      totalWords,
    };
  });
}

// คำที่เขียนวันนี้
export function wordsToday(chapters) {
  const k = dayKey(new Date());
  return chapters.reduce((sum, c) => {
    const ck = dayKey(c.updated_date || c.created_date);
    return ck === k ? sum + chapterWords(c) : sum;
  }, 0);
}