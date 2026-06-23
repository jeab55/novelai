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

        // แบ่งเนื้อหาเป็น chunks (chunk ละ ~1500 คำ เพื่อไม่ให้เกิน token limit)
        const chunkSize = 1500;
        const chunks = [];
        let currentIndex = 0;
        
        while (currentIndex < content.length) {
            let end = Math.min(currentIndex + chunkSize, content.length);
            
            // พยายามตัดที่จุดจบประโยคหรือย่อหน้า เพื่อไม่ให้ตัดกลางคำ
            if (end < content.length) {
                const lastPeriod = content.lastIndexOf('۔', end);
                const lastNewline = content.lastIndexOf('\n', end);
                const lastSpace = content.lastIndexOf(' ', end);
                const breakPoint = Math.max(lastPeriod, lastNewline, lastSpace);
                
                if (breakPoint > currentIndex + chunkSize * 0.8) {
                    end = breakPoint + 1;
                }
            }
            
            chunks.push({
                text: content.slice(currentIndex, end),
                start: currentIndex,
                end: end
            });
            
            currentIndex = end;
        }

        console.log(`แบ่งเนื้อหาเป็น ${chunks.length} chunks`);

        // ใช้ AI ตรวจคำผิดทุก chunk
        const allErrors = [];
        
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            console.log(`กำลังตรวจ chunk ${i + 1}/${chunks.length}`);
            
            const writerCtx = novel?.writer_id 
                ? `\n[สไตล์การเขียน]\nกรุณาตรวจโดยคำนึงถึงสไตล์การเขียนของนิยายประเภท ${novel.genre || 'นิยายทั่วไป'}`
                : "";

            const result = await base44.integrations.Core.InvokeLLM({
                model: 'gemini_3_flash',
                prompt: `คุณเป็นผู้เชี่ยวชาญพิสูจน์อักษรภาษาไทยที่เข้มงวดและละเอียดที่สุด มีประสบการณ์ 20+ ปี

หน้าที่: ตรวจหาคำผิดทั้งหมดในข้อความต่อไปนี้แบบ EXHAUSTIVE — ห้ามพลาดแม้แต่จุดเดียว

## วิธีตรวจ (สำคัญที่สุด)
1. แบ่งข้อความออกเป็นย่อหน้า แล้วแบ่งแต่ละย่อหน้าออกเป็นประโยค
2. ไล่ตรวจ "ทีละประโยค" จากต้นจนจบ อ่านทุกคำในประโยคนั้นทีละคำ
3. ในแต่ละคำ ให้ถามตัวเองว่า: สะกดถูกไหม? วรรณยุกต์ถูกไหม? สระถูกตำแหน่ง/ถูกความยาวไหม? มีตัวอักษรตก/เกิน/สลับไหม? ใช้คำถูกบริบทไหม?
4. ทำซ้ำจนครบทุกประโยค ห้ามข้ามประโยคใด ๆ

## ประเภทคำผิดที่ต้องจับให้ครบ
1. **spelling** — สะกดผิดตามพจนานุกรม เช่น อนุญาติ→อนุญาต, โอกาศ→โอกาส, รสชาด→รสชาติ, สังเกตุ→สังเกต
2. **tone** — อักขระถูกแต่ผิดวรรณยุกต์/สระ/บริบท เช่น สี้→สี่, ค่ะ↔คะ (ค่ะ ใช้ตอบรับ/ลงท้ายประโยคบอกเล่า, คะ ใช้ลงท้ายคำถาม), น่ะ↔นะ, นะค่ะ→นะคะ, เปล่าค่ะ→เปล่าคะ(เมื่อเป็นคำถาม)
3. **vowel_tone_position** — สระหรือวรรณยุกต์ผิดตำแหน่ง/ผิดความยาว เช่น อยุ่→อยู่, เเ→แ (สระแอแยกเป็นสองตัว), กระเปา→กระเป๋า, เกีด→เกิด
4. **typo** — พิมพ์ตก/พิมพ์เกิน/พิมพ์สลับ เช่น ครับบ→ครับ, เมือ→เมื่อ, ทเล→ทะเล, สดุ→สุด(สลับ), เพราะะ→เพราะ
5. **garant** — การันต์เกินหรือขาด เช่น เกษตร์→เกษตร, สัตว→สัตว์
6. **spacing** — เว้นวรรคผิด เช่น เคาะวรรคกลางคำ หรือไม่เว้นวรรคที่ควรเว้น
7. **confused** — คำพ้องเสียงที่ใช้ผิด เช่น ทาน↔ทาร, ตำหนิ↔ตำหนิ
8. **word_choice** — ใช้คำไม่เหมาะกับบริบท เช่น ทำไร→ทำอะไร

## ตัวอย่าง (few-shot)
ตัวอย่างประโยค: "เธออยุ่ที่บ้านมาตั้งสี้วันแล้วนะค่ะ"
ผลลัพธ์ที่ถูกต้อง:
{"errors":[
 {"type":"vowel_tone_position","wrong":"อยุ่","correct":"อยู่","context":"เธออยุ่ที่บ้านมาตั้งสี้วันแล้วนะค่ะ","position":3,"explanation":"สระอูพิมพ์ผิดตำแหน่ง ต้องเป็น อยู่","confidence":0.97},
 {"type":"tone","wrong":"สี้","correct":"สี่","context":"เธออยุ่ที่บ้านมาตั้งสี้วันแล้วนะค่ะ","position":17,"explanation":"จำนวนนับต้องใช้ สี่ (ไม้เอก) ไม่ใช่ สี้ (ไม้โท)","confidence":0.98},
 {"type":"tone","wrong":"นะค่ะ","correct":"นะคะ","context":"เธออยุ่ที่บ้านมาตั้งสี้วันแล้วนะค่ะ","position":24,"explanation":"ลงท้ายด้วย นะ ต้องตามด้วย คะ (ไม่มีไม้เอก)","confidence":0.95}
]}

ตัวอย่างประโยค: "วันนี้อากาศดีมากกครับ"
ผลลัพธ์: {"errors":[{"type":"typo","wrong":"มากก","correct":"มาก","context":"วันนี้อากาศดีมากกครับ","position":13,"explanation":"พิมพ์ ก เกินมา 1 ตัว","confidence":0.96}]}
${writerCtx}

## ข้อความที่ต้องตรวจ
"""
${chunk.text}
"""

## กฎ
- ไล่ตรวจทุกประโยคจนจบ ห้ามข้าม — รายงานคำผิดแบบ EXHAUSTIVE ให้ครบทุกจุด
- พบคำผิดแม้ 1 ตัวอักษรหรือวรรณยุกต์ ต้องรายงาน
- ใส่ "confidence" เป็นเลขทศนิยม 0–1 (ความมั่นใจว่าเป็นคำผิดจริง) ทุกรายการ
- "context" = ประโยคต้นฉบับที่มีคำผิด (ไม่เกิน 120 ตัวอักษร) คัดลอกมาตามจริง
- ถ้าคำถูกต้องแล้วห้ามรายงาน — รายงานเฉพาะคำที่ผิดจริง
- ตอบเป็น JSON เท่านั้น ไม่มีข้อความอื่น`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        errors: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    type: { type: "string" },
                                    wrong: { type: "string" },
                                    correct: { type: "string" },
                                    context: { type: "string" },
                                    position: { type: "number" },
                                    explanation: { type: "string" },
                                    confidence: { type: "number" }
                                },
                                required: ["type", "wrong", "correct", "context", "position"]
                            }
                        },
                        total_words_checked: { type: "number" }
                    },
                    required: ["errors", "total_words_checked"]
                }
            });

            // เพิ่ม position ที่ถูกต้อง (relative to original content)
            if (result.errors && Array.isArray(result.errors)) {
                result.errors.forEach(error => {
                    allErrors.push({
                        ...error,
                        globalPosition: chunk.start + (error.position || 0)
                    });
                });
            }
        }

        console.log(`ตรวจพบคำผิดทั้งหมด ${allErrors.length} รายการ`);

        // จัดกลุ่มคำผิดตามประเภท
        const spelling_errors = allErrors.filter(e => e.type === 'spelling' || e.type === 'typo');
        const garant_issues = allErrors.filter(e => e.type === 'garant');
        const tone_issues = allErrors.filter(e => e.type === 'tone' || e.type === 'vowel_tone_position');
        const spacing_issues = allErrors.filter(e => e.type === 'spacing');
        const confused_words = allErrors.filter(e => e.type === 'confused');
        const word_choice_issues = allErrors.filter(e => e.type === 'word_choice');

        // สรุปสถิติ
        const totalWordsChecked = chunks.reduce((sum, chunk, i) => {
            // โดยประมาณจากจำนวนตัวอักษร / 4.5 (ค่าเฉลี่ยคำไทย)
            return sum + Math.ceil(chunk.text.length / 4.5);
        }, 0);

        return Response.json({
            spelling_errors,
            garant_issues,
            tone_issues,
            spacing_issues: spacing_issues.length > 0 ? [{
                issue: 'การเว้นวรรค',
                count: spacing_issues.length,
                examples: spacing_issues.slice(0, 5).map(e => `${e.wrong} → ${e.correct}`)
            }] : [],
            word_suggestions: confused_words,
            word_choice_issues,
            total_chunks_checked: chunks.length,
            total_words_checked: totalWordsChecked,
            total_errors_found: allErrors.length,
            all_errors: allErrors // สำหรับ debug
        });
    } catch (error) {
        console.error('Error in checkThaiSpelling:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});