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
                prompt: `คุณเป็นผู้เชี่ยวชาญพิสูจน์อักษรภาษาไทยที่เข้มงวดและมีประสบการณ์ 20+ ปี

หน้าที่: ตรวจแก้คำผิดในข้อความต่อไปนี้ อย่างละเอียด EVERY SINGLE ERROR

ประเภทคำผิดที่ต้องตรวจ (สำคัญมาก - ต้องตรวจให้ครบทุกข้อ):

1. **คำสะกดผิด** - คำที่สะกดไม่ถูกต้องตามพจนานุกรม
   - เช่น: นะค่ะ→นะคะ, อนุญาติ→อนุญาต, โอกาศ→โอกาส, รสชาด→รสชาติ, เค้า→เขา, จิงๆ→จริงๆ
   - คำที่มักเขียนผิด: ผัดวันประกันพรุ่ง, อนุญาต, โอกาส, ประโยชน์, คุณภาพ, ภาพยนตร์

2. **การันต์ผิด** - คำที่มีการันต์เกิน或缺หาย
   - เช่น: เกษตร์→เกษตร, รสชาติ→รสชาติ (ไม่มีการันต์), สัมมนา→สัมมนา

3. **วรรณยุกต์ผิด** - เสียงวรรณยุกต์ไม่ถูกต้อง
   - เช่น: กล่อง→กล่อง, กระเป๋า→กระเป๋า, เสื้อ→เสื้อ

4. **เว้นวรรคผิด** - การเคาะวรรคไม่ถูกต้อง
   - เช่น: "ครับผม" → "ครับ ผม", "นะคะ" (ไม่เว้นวรรคกลางคำ)

5. **คำที่มักสับสน** - คำที่ออกเสียงคล้ายแต่เขียนต่างกัน
   - เช่น: ใจ→จัย, ทราย→ทราย, ศุกร์→ศุุกร์

6. **คำพิมพ์ตก/พิมพ์เกิน** - ตัวอักษรหายหรือเกิน
   - เช่น: ค่ะ→ค่ะ, ครับ→ครับ, เมื่อ→เมื่อ

7. **การใช้คำไม่เหมาะสม** - คำที่ควรใช้คำอื่นในบริบทนั้น
   - เช่น: ทำไร→ทำอะไร, เดี๋ยวนี้→เดี๋ยวนี้

${writerCtx}

ข้อความที่ต้องตรวจ:
"""
${chunk.text}
"""

กฎสำคัญ:
- ต้องตรวจทีละประโยค ห้ามข้ามประโยคใด ๆ
- ถ้าพบคำผิด แม้เพียง 1 ตัวอักษร ต้องรายงานทันที
- ห้ามตอบว่า "ไม่พบคำผิด" ถ้ายังตรวจไม่ครบทุกประโยค
- ถ้าคำไหนถูกต้องแล้ว ไม่ต้องรายงาน
- รายงานเฉพาะคำที่ผิดเท่านั้น

รูปแบบการตอบ (JSON เท่านั้น):
{
  "errors": [
    {
      "type": "spelling|garant|tone|spacing|confused|typo|word_choice",
      "wrong": "คำที่ผิด",
      "correct": "คำที่ถูก",
      "context": "ประโยคที่มีคำผิด (ยาวไม่เกิน 100 ตัวอักษร)",
      "position": ตำแหน่งเริ่มต้นของคำผิดในข้อความ (ตัวเลข),
      "explanation": "คำอธิบายสั้นๆ ว่าทำไมถึงผิด (optional)"
    }
  ],
  "total_words_checked": จำนวนคำที่ตรวจใน chunk นี้
}

ถ้าไม่พบคำผิดจริงๆ ให้ตอบ:
{
  "errors": [],
  "total_words_checked": จำนวนคำที่ตรวจ
}

ตอบมาเฉพาะ JSON เท่านั้น ไม่ต้องมีข้อความอื่น`,
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
                                    explanation: { type: "string" }
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
        const tone_issues = allErrors.filter(e => e.type === 'tone');
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