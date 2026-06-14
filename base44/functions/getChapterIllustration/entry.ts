/**
 * getChapterIllustration — wrapper ที่ดึง API key จาก UserSettings แล้วเรียก OpenAI
 * (รวม saveUserApiKey logic ไว้ด้วยเพื่อให้ generate ได้ในที่เดียว)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const IMAGE_STYLES = {
  anime: "anime and manga illustration style, vibrant colors, clean line art, expressive characters, Studio Ghibli inspired",
  photorealistic: "photorealistic cinematic photography, highly detailed, dramatic lighting, 8k resolution, film still",
  watercolor: "watercolor painting illustration, soft delicate brush strokes, literary book illustration, gentle pastel palette",
  digital_art: "detailed digital art, concept art for a novel, fantasy illustration, painterly style, richly colored",
  thai_contemporary: "Thai contemporary art, traditional Thai decorative motifs merged with modern illustration, gold and jewel tones, intricate patterns",
  chinese_historical: "Chinese historical ink painting style, Song dynasty brush painting, elegant calligraphic brushwork, misty atmospheric landscape",
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

    // ดึง API key จาก UserSettings
    const settings = await base44.entities.UserSettings.filter({ user_id: user.id });
    const apiKey = settings?.[0]?.openai_api_key;

    if (!apiKey) {
      return Response.json({
        error: 'ยังไม่ได้ตั้งค่า OpenAI API key กรุณาไปที่ตั้งค่า → OpenAI API key ก่อน',
        needsSetup: true,
      }, { status: 400 });
    }

    const styleDesc = IMAGE_STYLES[style] || IMAGE_STYLES.anime;
    const characterDesc = characters?.length > 0
      ? `Main characters: ${characters.slice(0, 3).map(c => `${c.name}${c.appearance ? ' (' + c.appearance + ')' : ''}`).join(', ')}.`
      : '';
    const eraDesc = novelEra ? `Time period/Setting: ${novelEra}.` : '';
    const excerpt = (chapterExcerpt || '').replace(/<[^>]*>/g, '').substring(0, 600);

    const prompt = [
      styleDesc,
      `Novel title: "${novelTitle || 'Unknown'}". Chapter: "${chapterTitle || 'Untitled'}".`,
      eraDesc,
      characterDesc,
      excerpt ? `Scene: ${excerpt}` : '',
      'High quality, no text, no watermarks, no signatures.',
    ].filter(Boolean).join(' ');

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

    const data = await response.json();

    if (!response.ok) {
      const msg = data?.error?.message || 'เกิดข้อผิดพลาดจาก OpenAI';
      if (msg.includes('API key') || msg.includes('Incorrect') || msg.includes('invalid')) {
        return Response.json({ error: 'API key ไม่ถูกต้องหรือหมดอายุ กรุณาตรวจสอบในหน้าตั้งค่า' }, { status: 400 });
      }
      if (msg.includes('billing') || msg.includes('quota') || msg.includes('insufficient')) {
        return Response.json({ error: 'เครดิต OpenAI หมดหรือมีปัญหาด้านการชำระเงิน กรุณาตรวจสอบบัญชี OpenAI' }, { status: 402 });
      }
      if (msg.includes('content policy') || msg.includes('safety') || msg.includes('violates')) {
        return Response.json({ error: 'เนื้อหาไม่ผ่านตัวกรองความปลอดภัยของ OpenAI กรุณาลองปรับคำอธิบายตอน' }, { status: 400 });
      }
      return Response.json({ error: msg }, { status: 400 });
    }

    const imageUrl = data?.data?.[0]?.url;
    if (!imageUrl) {
      return Response.json({ error: 'ไม่ได้รับ URL ภาพจาก OpenAI' }, { status: 500 });
    }

    return Response.json({ url: imageUrl });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});