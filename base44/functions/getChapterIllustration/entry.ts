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
    if (!user) return Response.json({ error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    // ดึง API key จาก UserSettings
    const settings = await base44.entities.UserSettings.filter({ user_id: user.id });
    const apiKey = settings?.[0]?.openai_api_key;

    // ─── ACTION: generatePrompt ───────────────────────────────────────────────
    // ใช้ InvokeLLM ผ่าน base44 เพื่อเขียน image prompt จากบริบทเรื่อง
    if (action === 'generatePrompt') {
      const { hint, chapterTitle, chapterContent, novelTitle, novelEra, characters, style } = body;

      const styleDesc = IMAGE_STYLES[style] || IMAGE_STYLES.anime;
      const cleanContent = (chapterContent || '').replace(/<[^>]*>/g, '').substring(0, 1000);
      const charList = (characters || []).slice(0, 4)
        .map(c => `- ${c.name} (${c.role})${c.appearance ? ': ' + c.appearance : ''}`)
        .join('\n');

      const llmPrompt = `You are an expert at writing DALL-E 3 image prompts for novel illustrations.

NOVEL CONTEXT:
- Novel: "${novelTitle || 'Unknown'}"
- Era/Setting: "${novelEra || 'unspecified'}"
- Chapter: "${chapterTitle || 'Untitled'}"
- Art style requested: ${styleDesc}

CHARACTERS:
${charList || '(none specified)'}

CHAPTER CONTENT (excerpt):
${cleanContent || '(no content yet)'}

USER HINT (may be empty): "${hint || ''}"

TASK:
Write a single vivid DALL-E 3 image prompt in English that:
1. If the user hint is provided, illustrates that specific scene/moment
2. If no hint, pick the most visually striking scene from the chapter content
3. Incorporates the art style naturally
4. Includes relevant character appearances (clothing, era-appropriate details)
5. Specifies atmosphere, lighting, and composition
6. Ends with: "No text, no watermarks, high quality."

Output ONLY the prompt text, nothing else. No explanations, no quotes around it.`;

      const llmRes = await base44.integrations.Core.InvokeLLM({ prompt: llmPrompt });
      const generatedPrompt = typeof llmRes === 'string' ? llmRes.trim() : '';

      return Response.json({ prompt: generatedPrompt });
    }

    // ─── ACTION: generateImage ────────────────────────────────────────────────
    // รับ prompt ที่ผ่านการตรวจสอบแล้ว → ส่ง DALL-E 3
    if (action === 'generateImage') {
      const { prompt } = body;

      if (!apiKey) {
        return Response.json({
          error: 'ยังไม่ได้ตั้งค่า OpenAI API key กรุณาไปที่ตั้งค่า → OpenAI API key ก่อน',
          needsSetup: true,
        }, { status: 400 });
      }

      if (!prompt) return Response.json({ error: 'ไม่มี prompt' }, { status: 400 });

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
          return Response.json({ error: 'เนื้อหาไม่ผ่านตัวกรองความปลอดภัยของ OpenAI กรุณาลองปรับ prompt' }, { status: 400 });
        }
        return Response.json({ error: msg }, { status: 400 });
      }

      const imageUrl = data?.data?.[0]?.url;
      if (!imageUrl) return Response.json({ error: 'ไม่ได้รับ URL ภาพจาก OpenAI' }, { status: 500 });

      return Response.json({ url: imageUrl });
    }

    return Response.json({ error: 'action ไม่ถูกต้อง (ใช้ generatePrompt หรือ generateImage)' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});