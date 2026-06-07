/**
 * ดาวน์โหลดไฟล์ข้อความ
 */
function downloadFile(filename, content, mimeType = "text/plain") {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * ทำชื่อไฟล์ให้ปลอดภัย
 */
function safeFilename(name) {
  return (name || "untitled").replace(/[\\/:*?"<>|]/g, "_").trim();
}

/**
 * ดาวน์โหลดตอนเดียวเป็น .txt
 */
export function downloadChapterTxt(chapterTitle, content) {
  const text = `${chapterTitle}\n${"=".repeat(chapterTitle.length)}\n\n${content || ""}`;
  downloadFile(`${safeFilename(chapterTitle)}.txt`, text, "text/plain");
}

/**
 * ดาวน์โหลดตอนเดียวเป็น .md
 */
export function downloadChapterMd(chapterTitle, content) {
  const md = `# ${chapterTitle}\n\n${content || ""}`;
  downloadFile(`${safeFilename(chapterTitle)}.md`, md, "text/markdown");
}

/**
 * คัดลอกเนื้อหาตอนไปคลิปบอร์ด — คืน Promise<void>
 */
export async function copyChapterToClipboard(chapterTitle, content) {
  const text = `${chapterTitle}\n\n${content || ""}`;
  await navigator.clipboard.writeText(text);
}

/**
 * ดาวน์โหลดทั้งเรื่องรวมทุกตอนเป็น .md ไฟล์เดียว
 * chapters: [{ order, title, content }] เรียงตามลำดับแล้ว
 * novelTitle: ชื่อนิยาย
 */
export function downloadAllChaptersMd(novelTitle, chapters) {
  const sorted = [...chapters].sort((a, b) => (a.order || 0) - (b.order || 0));
  const parts = sorted.map((ch, i) => {
    const heading = `## ตอนที่ ${ch.order || i + 1}: ${ch.title}`;
    return `${heading}\n\n${ch.content || ""}`;
  });
  const md = `# ${novelTitle}\n\n---\n\n${parts.join("\n\n---\n\n")}`;
  downloadFile(`${safeFilename(novelTitle)}.md`, md, "text/markdown");
}