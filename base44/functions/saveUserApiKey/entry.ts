/**
 * saveUserApiKey — บันทึก OpenAI API key ของผู้ใช้ (เก็บเป็น env var แยกต่อ user)
 * NOTE: เนื่องจาก Deno edge functions ไม่รองรับการ set env var แบบ dynamic ที่ persist ได้,
 * เราจะใช้ base44 entity "UserSettings" เป็นที่เก็บ key แทน
 * (เก็บ key จริงๆ ผ่าน entity ที่มี RLS — user เห็นได้เฉพาะของตัวเอง)
 * 
 * เพื่อความปลอดภัย: key จะถูกเก็บใน entity UserSettings (เข้าถึงได้เฉพาะเจ้าของ)
 * และใช้งานเฉพาะใน backend function generateChapterIllustration เท่านั้น
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 });
    }

    const body = await req.json();
    const { action, apiKey } = body;

    const existing = await base44.entities.UserSettings.filter({ user_id: user.id });
    const record = existing?.[0];

    if (action === 'save') {
      if (!apiKey || !apiKey.startsWith('sk-')) {
        return Response.json({ error: 'API key ไม่ถูกต้อง ต้องขึ้นต้นด้วย sk-' }, { status: 400 });
      }
      if (record) {
        await base44.entities.UserSettings.update(record.id, { openai_api_key: apiKey });
      } else {
        await base44.entities.UserSettings.create({ user_id: user.id, openai_api_key: apiKey });
      }
      return Response.json({ success: true });
    }

    if (action === 'get') {
      const key = record?.openai_api_key || '';
      // ส่งกลับแค่ masked version เพื่อความปลอดภัย
      const masked = key ? key.substring(0, 7) + '...' + key.substring(key.length - 4) : '';
      return Response.json({ haKey: !!key, maskedKey: masked });
    }

    if (action === 'delete') {
      if (record) {
        await base44.entities.UserSettings.update(record.id, { openai_api_key: '' });
      }
      return Response.json({ success: true });
    }

    if (action === 'test') {
      const key = record?.openai_api_key || '';
      if (!key) return Response.json({ error: 'ยังไม่ได้บันทึก API key' }, { status: 400 });

      const resp = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${key}` },
      });
      if (resp.ok) {
        return Response.json({ success: true, message: 'API key ใช้งานได้ปกติ ✓' });
      } else {
        const err = await resp.json();
        return Response.json({ error: err?.error?.message || 'API key ไม่สามารถใช้งานได้' }, { status: 400 });
      }
    }

    return Response.json({ error: 'action ไม่ถูกต้อง' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});