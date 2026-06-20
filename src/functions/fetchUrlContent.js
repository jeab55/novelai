import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ดึงข้อความหลักจากหน้าเว็บ (บทความ / เนื้อเพลง) แบบง่ายๆ จาก HTML
function extractReadableText(html) {
  if (!html) return "";

  let text = html;

  // ตัด script / style / noscript ออก
  text = text.replace(/<script[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, " ");
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  text = text.replace(/<!--[\s\S]*?-->/g, " ");

  // แปลง <br> และ block tags เป็นขึ้นบรรทัดใหม่ เพื่อรักษาโครงเนื้อเพลง/ย่อหน้า
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/(p|div|h[1-6]|li|tr|section|article)>/gi, "\n");

  // ตัด tag ที่เหลือทั้งหมด
  text = text.replace(/<[^>]+>/g, " ");

  // decode entity ที่พบบ่อย
  const entities = {
    "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">",
    "&quot;": '"', "&#39;": "'", "&apos;": "'", "&mdash;": "—",
    "&ndash;": "–", "&hellip;": "…", "&rsquo;": "'", "&lsquo;": "'",
    "&ldquo;": '"', "&rdquo;": '"',
  };
  text = text.replace(/&[a-zA-Z#0-9]+;/g, (m) => entities[m] || " ");

  // จัดระเบียบช่องว่าง
  text = text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");

  // ยุบบรรทัดว่างซ้อน
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return "";
  return m[1].replace(/&[a-zA-Z#0-9]+;/g, " ").replace(/\s+/g, " ").trim();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return Response.json({ error: 'กรุณาระบุลิงก์ URL' }, { status: 400 });
    }

    let target = url.trim();
    if (!/^https?:\/\//i.test(target)) {
      target = "https://" + target;
    }

    let res;
    try {
      res = await fetch(target, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; NovelBot/1.0)",
          "Accept": "text/html,application/xhtml+xml",
        },
        redirect: "follow",
      });
    } catch (e) {
      return Response.json({ error: 'ดึงเนื้อหาจากลิงก์ไม่สำเร็จ: ' + e.message }, { status: 502 });
    }

    if (!res.ok) {
      return Response.json({ error: `เปิดลิงก์ไม่สำเร็จ (HTTP ${res.status})` }, { status: 502 });
    }

    const html = await res.text();
    const text = extractReadableText(html);
    const title = extractTitle(html);

    if (!text || text.length < 20) {
      return Response.json({ error: 'ไม่พบเนื้อหาที่อ่านได้จากลิงก์นี้ ลองวางข้อความเองแทน' }, { status: 422 });
    }

    return Response.json({
      text,
      title,
      character_count: text.length,
      source_url: target,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});