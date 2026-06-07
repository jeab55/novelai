/**
 * Reliable chapter content saver with retry and verification.
 * - Uses list() + find() instead of filter({id}) to avoid built-in field issues
 * - Retries up to 2 times if saved content is empty
 * - Returns { success, chapterId, error }
 */
import { base44 } from "@/api/base44Client";

function countWords(text) {
  if (!text) return 0;
  const cleaned = text.replace(/<[^>]*>/g, " ").replace(/&[a-z]+;/g, " ");
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter("th", { granularity: "word" });
    let count = 0;
    for (const seg of segmenter.segment(cleaned)) {
      if (seg.isWordLike) count++;
    }
    return count;
  }
  const thaiChars = (cleaned.match(/[\u0E00-\u0E7F]/g) || []).length;
  const eng = (cleaned.match(/[a-zA-Z]+/g) || []).length;
  return Math.round(thaiChars / 3.5) + eng;
}

async function verifyChapterContent(chapterId, expectedLength) {
  // Use list() and find() — never filter by id (built-in field)
  const allChapters = await base44.entities.Chapter.list();
  const found = allChapters.find((ch) => ch.id === chapterId);
  if (!found) return false;
  const saved = (found.content || "").length;
  // Accept if saved content is at least 80% of expected (allow minor trim differences)
  return saved >= Math.max(1, expectedLength * 0.8);
}

export async function saveChapterContent({
  novelId,
  chapterId,       // if updating an existing chapter
  title,
  order,
  content,
  status = "ร่าง",
  maxRetries = 2,
}) {
  const word_count = countWords(content);
  const expectedLength = (content || "").length;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let savedId = chapterId;

    if (chapterId) {
      // Update existing
      await base44.entities.Chapter.update(chapterId, {
        content,
        word_count,
        status,
        ...(title ? { title } : {}),
      });
    } else {
      // Create new — check if one with same novel_id + order exists first
      const allChapters = await base44.entities.Chapter.list();
      const existing = allChapters.find(
        (ch) => ch.novel_id === novelId && ch.order === order
      );
      if (existing) {
        savedId = existing.id;
        await base44.entities.Chapter.update(existing.id, {
          content,
          word_count,
          status,
          ...(title ? { title } : {}),
        });
      } else {
        const created = await base44.entities.Chapter.create({
          novel_id: novelId,
          title: title || `ตอนที่ ${order}`,
          order,
          content,
          word_count,
          status,
        });
        savedId = created?.id || created;
      }
    }

    // Verify
    if (savedId) {
      const ok = await verifyChapterContent(savedId, expectedLength);
      if (ok) return { success: true, chapterId: savedId };
    }

    // If last attempt, return failure
    if (attempt === maxRetries) {
      return {
        success: false,
        chapterId: savedId,
        error: `บันทึกซ้ำ ${maxRetries + 1} ครั้งแล้วแต่เนื้อหายังไม่ครบ กรุณาลองบันทึกอีกครั้ง`,
      };
    }

    // Wait briefly before retry
    await new Promise((r) => setTimeout(r, 800));
  }
}