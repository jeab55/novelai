import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const IMAGE_STYLES = {
  anime: "anime and manga illustration style, vibrant colors, clean line art, detailed character design",
  photorealistic: "photorealistic, cinematic photography, highly detailed, dramatic lighting, 8k resolution",
  watercolor: "watercolor painting, soft brush strokes, literary illustration, gentle pastel tones, artistic",
  digital_art: "digital art, concept art, beautifully detailed, fantasy illustration style",
  thai_contemporary: "Thai contemporary art style, traditional Thai motifs blended with modern design, gold accents, intricate patterns",
  chinese_historical: "Chinese historical painting style, ink wash painting, traditional Chinese art, dynasty era illustration, elegant brushwork",
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 });
    }

    const body = await req.json();
    const { chapterTitle, chapterExcerpt, novelTitle, novelEra, characters, style } = body;

    // ดึง OpenAI API key ที่ผู้ใช้บันทึกไว้
    const apiKey = Deno.env.get("OPENAI_API_KEY_USER_" + user.id) || Deno.env.get("OPENAI_API_KEY");
    
    if (!apiKey) {
      return Response.json({ error: 'ไม่พบ OpenAI API key กรุณาตั้งค่า API key ในหน้าตั้งค่าก่อน' }, { status: 400 });
    }

    // สร้าง image prompt อัตโนมัติ
    const styleDesc = IMAGE_STYLES[style] || IMAGE_STYLES.anime;
    const characterDesc = characters?.length > 0
      ? `Characters: ${characters.map(c => `${c.name} (${c.role}${c.appearance ? ', ' + c.appearance : ''})`).join(', ')}.`
      : '';
    const eraDesc = novelEra ? `Setting/Era: ${novelEra}.` : '';

    // ดึงสรุปเนื้อหาสั้นๆ จาก excerpt
    const excerpt = (chapterExcerpt || '').substring(0, 500);

    const prompt = `${styleDesc}. 
Novel: "${novelTitle}". Chapter: "${chapterTitle}". 
${eraDesc} ${characterDesc}
Scene description based on chapter: ${excerpt}
High quality illustration, no text or watermarks.`;

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt.trim(),
        n: 1,
        size: '1024x1024',
        quality: 'standard',
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      const msg = err?.error?.message || 'เกิดข้อผิดพลาดจาก OpenAI';
      // แปลข้อความ error ให้เข้าใจง่าย
      if (msg.includes('API key')) return Response.json({ error: 'API key ไม่ถูกต้องหรือหมดอายุ กรุณาตรวจสอบ API key ในหน้าตั้งค่า' }, { status: 400 });
      if (msg.includes('billing') || msg.includes('quota')) return Response.json({ error: 'เครดิต OpenAI หมดหรือมีปัญหาด้านการชำระเงิน กรุณาตรวจสอบบัญชี OpenAI ของคุณ' }, { status: 402 });
      if (msg.includes('content policy') || msg.includes('safety')) return Response.json({ error: 'เนื้อหาไม่ผ่านตัวกรองของ OpenAI กรุณาแก้ไขเนื้อหาบางส่วน' }, { status: 400 });
      return Response.json({ error: msg }, { status: 400 });
    }

    const data = await response.json();
    const imageUrl = data?.data?.[0]?.url;

    if (!imageUrl) {
      return Response.json({ error: 'ไม่ได้รับ URL ภาพจาก OpenAI' }, { status: 500 });
    }

    return Response.json({ url: imageUrl, prompt: prompt.trim() });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});