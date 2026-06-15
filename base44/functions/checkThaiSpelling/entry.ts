import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { content } = await req.json();
        
        if (!content || typeof content !== 'string') {
            return Response.json({ error: 'Content is required' }, { status: 400 });
        }

        // ใช้ AI ตรวจสอบคำผิดภาษาไทย
        const response = await base44.integrations.Core.InvokeLLM({
            prompt: `คุณคือผู้ตรวจพิสูจน์ภาษาไทยที่เชี่ยวชาญ

กรุณาตรวจสอบเนื้อหาต่อไปนี้และระบุคำที่อาจเขียนผิด การเว้นวรรคที่ไม่ถูกต้อง และปัญหาอื่นๆ

เนื้อหา:
${content.slice(0, 5000)}

ตอบกลับในรูปแบบ JSON เท่านั้น:
{
  "spelling_errors": [
    {
      "wrong": "คำที่เขียนผิด",
      "correct": "คำที่ถูกต้อง",
      "position": ตำแหน่งตัวอักษรเริ่มต้น (number),
      "context": "ประโยคที่มีคำผิด (string)"
    }
  ],
  "spacing_issues": [
    {
      "issue": "คำอธิบายปัญหา",
      "count": จำนวนที่พบ (number),
      "suggestion": "คำแนะนำ"
    }
  ],
  "style_issues": [
    {
      "issue": "คำอธิบายปัญหา",
      "count": จำนวนที่พบ (number),
      "suggestion": "คำแนะนำ"
    }
  ]
}

ถ้าไม่พบข้อผิดพลาด ให้คืนค่า:
{
  "spelling_errors": [],
  "spacing_issues": [],
  "style_issues": []
}`,
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
                                context: { type: "string" }
                            },
                            required: ["wrong", "correct"]
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
                    style_issues: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                issue: { type: "string" },
                                count: { type: "number" },
                                suggestion: { type: "string" }
                            }
                        }
                    }
                },
                required: ["spelling_errors", "spacing_issues", "style_issues"]
            }
        });

        return Response.json(response.data);
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});