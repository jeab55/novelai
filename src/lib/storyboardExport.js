// แปลงสตอรีบอร์ดเป็นข้อความ และ CSV สำหรับ export

export function storyboardToText(scenes, meta = {}) {
  const header = [
    `สตอรีบอร์ด: ${meta.title || ""}`,
    meta.platform ? `แพลตฟอร์ม: ${meta.platform}` : "",
    meta.duration ? `ความยาวเป้าหมาย: ${meta.duration} วินาที` : "",
    meta.tone ? `โทน: ${meta.tone}` : "",
    `จำนวนฉาก: ${scenes.length}`,
  ].filter(Boolean).join("\n");

  const body = scenes
    .map((s, i) => {
      return [
        `━━━━━━━━━━━━━━━━━━━━━━`,
        `ฉากที่ ${s.scene_number || i + 1}${s.duration ? ` (~${s.duration} วิ)` : ""}`,
        s.shot ? `🎥 มุมกล้อง/อารมณ์: ${s.shot}` : "",
        s.voiceover ? `🎙️ บทพากย์: ${s.voiceover}` : "",
        s.dialogue ? `💬 บทสนทนา: ${s.dialogue}` : "",
        s.image_prompt ? `🖼️ พรอมต์ภาพ AI: ${s.image_prompt}` : "",
      ].filter(Boolean).join("\n");
    })
    .join("\n\n");

  return `${header}\n\n${body}\n`;
}

function csvCell(v) {
  const s = String(v ?? "").replace(/"/g, '""');
  return `"${s}"`;
}

export function storyboardToCsv(scenes) {
  const headers = ["ฉาก", "ความยาว(วิ)", "มุมกล้อง/อารมณ์", "บทพากย์", "บทสนทนา", "พรอมต์ภาพ AI"];
  const rows = scenes.map((s, i) => [
    s.scene_number || i + 1,
    s.duration || "",
    s.shot || "",
    s.voiceover || "",
    s.dialogue || "",
    s.image_prompt || "",
  ]);
  return [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
}

export function downloadFile(content, filename, type) {
  const bom = type.includes("csv") ? "\uFEFF" : "";
  const blob = new Blob([bom + content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}