import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { novel_id } = await req.json();
        
        if (!novel_id) {
            return Response.json({ error: 'novel_id is required' }, { status: 400 });
        }

        // Fetch all chapters for this novel
        const chapters = await base44.entities.Chapter.filter({ 
            novel_id, 
            is_deleted: false 
        }, 'order');

        if (chapters.length === 0) {
            return Response.json({ 
                analysis: null, 
                message: 'ไม่มีตอนให้วิเคราะห์' 
            });
        }

        // Fetch characters
        const characters = await base44.entities.Character.filter({ 
            novel_id, 
            is_deleted: false 
        });

        // Fetch plot events
        const plotEvents = await base44.entities.PlotEvent.filter({ 
            novel_id, 
            is_deleted: false 
        }, 'order');

        // Build context from all chapters
        const chapterContexts = chapters.map((ch, idx) => ({
            order: ch.order || idx + 1,
            title: ch.title,
            word_count: ch.word_count || 0,
            content_preview: ch.content?.substring(0, 500) || '',
            characters_mentioned: ch.content ? extractCharacterNames(ch.content, characters) : [],
            plot_event: ch.plot_event_title || null
        }));

        // Build character status tracking
        const characterStatus = characters.map(ch => ({
            name: ch.name,
            role: ch.role,
            desire: ch.desire || '',
            wound: ch.wound || '',
            relationships: ch.relationships || ''
        }));

        // Build plot timeline
        const plotTimeline = plotEvents.map((pe, idx) => ({
            order: pe.order || idx + 1,
            title: pe.title,
            description: pe.description,
            time_period: pe.time_period,
            location: pe.location,
            characters_involved: pe.characters_involved
        }));

        // Construct AI prompt
        const prompt = `คุณเป็นบรรณาธิการนิยายมืออาชีพ วิเคราะห์ความต่อเนื่องของนิยายเรื่องต่อไปนี้

ข้อมูลนิยาย:
- จำนวนตอน: ${chapters.length} ตอน
- ตัวละครหลัก: ${characters.length} ตัว
- เหตุการณ์พล็อต: ${plotEvents.length} เหตุการณ์

ตัวละคร:
${JSON.stringify(characterStatus, null, 2)}

ไทม์ไลน์เหตุการณ์:
${JSON.stringify(plotTimeline, null, 2)}

บริบทแต่ละตอน (ย่อหน้าแรก):
${JSON.stringify(chapterContexts, null, 2)}

โปรดวิเคราะห์และระบุปัญหาความต่อเนื่องต่อไปนี้:

1. **ความขัดแย้งของตัวละคร** (Character Inconsistencies)
   - ตัวละครทำสิ่งขัดแย้งกับบุคลิกภาพหรือแรงจูงใจเดิม
   - ความสัมพันธ์ระหว่างตัวละครเปลี่ยนไปโดยไม่มีเหตุผล
   - ตัวละครปรากฏในสองที่พร้อมกัน

2. **ความขัดแย้งของพล็อต** (Plot Holes)
   - เหตุการณ์ขัดแย้งกับไทม์ไลน์
   - ข้อมูลหรือวัตถุปรากฏขึ้นโดยไม่มีที่มา
   - ปัญหาที่แก้แล้วกลับมาเกิดอีกโดยไม่มีคำอธิบาย

3. **ปัญหาไทม์ไลน์** (Timeline Issues)
   - ลำดับเวลาไม่สอดคล้องกัน
   - ระยะเวลาเหตุการณ์ไม่สมเหตุสมผล
   - ตัวละครอายุหรือเวลาผ่านไม่ตรงกัน

4. **คำแนะนำการแก้ไข** (Recommendations)
   - เสนอวิธีแก้ไขแต่ละปัญหา
   - ระบุตอนที่ควรแก้ไข

รูปแบบคำตอบ JSON:
{
  "has_issues": boolean,
  "overall_score": number (0-100),
  "summary": "string",
  "issues": [
    {
      "type": "character" | "plot" | "timeline",
      "severity": "low" | "medium" | "high",
      "title": "string",
      "description": "string",
      "affected_chapters": [number],
      "suggestion": "string"
    }
  ],
  "positive_aspects": ["string"],
  "recommendations": ["string"]
}`;

        const response = await base44.integrations.Core.InvokeLLM({
            prompt,
            response_json_schema: {
                type: "object",
                properties: {
                    has_issues: { type: "boolean" },
                    overall_score: { type: "number" },
                    summary: { type: "string" },
                    issues: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                type: { type: "string" },
                                severity: { type: "string" },
                                title: { type: "string" },
                                description: { type: "string" },
                                affected_chapters: { type: "array", items: { type: "number" } },
                                suggestion: { type: "string" }
                            },
                            required: ["type", "severity", "title", "description"]
                        }
                    },
                    positive_aspects: { type: "array", items: { type: "string" } },
                    recommendations: { type: "array", items: { type: "string" } }
                },
                required: ["has_issues", "overall_score", "summary", "issues"]
            }
        });

        return Response.json({ analysis: response });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});

function extractCharacterNames(content, characters) {
    const found = [];
    for (const ch of characters) {
        if (content.includes(ch.name)) {
            found.push(ch.name);
        }
    }
    return found;
}