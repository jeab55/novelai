import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { content, novel } = await req.json();
        
        if (!content || typeof content !== 'string') {
            return Response.json({ error: 'Content is required' }, { status: 400 });
        }

        const genre = novel?.genre || '';
        const era = novel?.era || '';
        const isHistorical = genre === 'อิงประวัติศาสตร์' || (era && era.toLowerCase().includes('สมัย'));

        // ใช้ AI ตรวจสอบคำผิดภาษาไทย
        const response = await base44.integrations.Core.InvokeLLM({
            prompt: `คุณคือผู้ตรวจพิสูจน์ภาษาไทยที่เชี่ยวชาญ${isHistorical ? ' และมีความรู้ด้านภาษาโบราณและคำศัพท์historicalไทยสมัยต่างๆ' : ''}

${isHistorical ? `ยุคสมัย: ${era}
` : ''}
กรุณาตรวจสอบเนื้อหาต่อไปนี้โดยเน้น:
1. คำที่สะกดผิด
2. คำที่อาจใช้ไม่เหมาะสม${isHistorical ? ' สำหรับนิยายอิงประวัติศาสตร์' : ''}
3. คำแนะนำคำที่ควรใช้${isHistorical ? ' ที่สอดคล้องกับยุคสมัย' : ''}
4. การเว้นวรรคที่ไม่ถูกต้อง

เนื้อหา:
${content.slice(0, 5000)}

ตอบกลับในรูปแบบ JSON เท่านั้น:
{
  "spelling_errors": [
    {
      "wrong": "คำที่เขียนผิด",
      "correct": "คำที่ถูกต้อง",
      "position": ตำแหน่งตัวอักษรเริ่มต้น (number),
      "context": "ประโยคที่มีคำผิด (string)",
      "explanation": "คำอธิบายว่าทำไมถึงผิด (string)"
    }
  ],
  "word_suggestions": [
    {
      "original": "คำเดิม",
      "suggested": "คำที่แนะนำ",
      "position": ตำแหน่งตัวอักษรเริ่มต้น (number),
      "context": "ประโยคที่มีคำนั้น (string)",
      "reason": "เหตุผลที่แนะนำ (string)"
    }
  ],
  "spacing_issues": [
    {
      "issue": "คำอธิบายปัญหา",
      "count": จำนวนที่พบ (number),
      "suggestion": "คำแนะนำ"
    }
  ],
  "anachronistic_words": [
    {
      "word": "คำที่ไม่สอดคล้องกับยุคสมัย",
      "modern_alternative": "คำสมัยใหม่ที่ควรใช้แทน",
      "historical_alternative": "คำโบราณที่ควรใช้แทน (ถ้ามี)",
      "position": ตำแหน่งตัวอักษรเริ่มต้น (number),
      "context": "ประโยคที่มีคำนั้น (string)"
    }
  ]
}

${isHistorical ? `**หมายเหตุสำคัญ**: สำหรับนิยายอิงประวัติศาสตร์ กรุณาตรวจสอบคำที่ไม่สอดคล้องกับยุคสมัย เช่น:
- คำศัพท์สมัยใหม่ (เช่น เทคโนโลยี, การแพทย์สมัยใหม่)
- ชื่อสถานที่ที่ยังไม่เกิดในยุคนั้น
- วัฒนธรรมหรือประเพณีที่ยังไม่มี
- คำราชาศัพท์หรือคำสุภาพที่อาจใช้ไม่ถูกต้อง

ถ้าไม่พบข้อผิดพลาด ให้คืนค่า:
{
  "spelling_errors": [],
  "word_suggestions": [],
  "spacing_issues": [],
  "anachronistic_words": []
}` : `ถ้าไม่พบข้อผิดพลาด ให้คืนค่า:
{
  "spelling_errors": [],
  "word_suggestions": [],
  "spacing_issues": [],
  "anachronistic_words": []
}`}
`,
            response_json_schema: {
                type: "object",
                properties: {
                    spelling_errors: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                wrong: { type: "string" },
                                correct: { type: "string" },
                                position: { type: "number" },
                                context: { type: "string" },
                                explanation: { type: "string" }
                            },
                            required: ["wrong", "correct"]
                        }
                    },
                    word_suggestions: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                original: { type: "string" },
                                suggested: { type: "string" },
                                position: { type: "number" },
                                context: { type: "string" },
                                reason: { type: "string" }
                            },
                            required: ["original", "suggested"]
                        }
                    },
                    spacing_issues: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                issue: { type: "string" },
                                count: { type: "number" },
                                suggestion: { type: "string" }
                            }
                        }
                    },
                    anachronistic_words: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                word: { type: "string" },
                                modern_alternative: { type: "string" },
                                historical_alternative: { type: "string" },
                                position: { type: "number" },
                                context: { type: "string" }
                            },
                            required: ["word"]
                        }
                    }
                },
                required: ["spelling_errors", "word_suggestions", "spacing_issues", "anachronistic_words"]
            }
        });

        return Response.json(response.data);
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});