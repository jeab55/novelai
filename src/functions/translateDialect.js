import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { text, dialect } = await req.json();

        if (!text || !dialect) {
            return Response.json({ error: 'Missing text or dialect' }, { status: 400 });
        }

        // ใช้ LLM แปลภาษาถิ่นเป็นภาษาไทยกลาง
        const response = await base44.integrations.Core.InvokeLLM({
            prompt: `แปลข้อความภาษา${dialect}ต่อไปนี้เป็นภาษาไทยกลาง โดยรักษาความหมายเดิมไว้ให้ครบถ้วน

ข้อความ: "${text}"

คำแปลภาษาไทยกลาง (เขียนสั้นๆ กระชับ):`
        });

        return Response.json({ translation: response.data });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});