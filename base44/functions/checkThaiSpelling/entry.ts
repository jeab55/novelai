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

        // ตรวจคำผิดแบบใช้ regex - ตรวจคำที่มักเขียนผิดบ่อยๆ
        const spellingErrors = [];
        
        // คำที่มักเขียนผิด
        const commonMistakes = [
            { wrong: 'นะค่ะ', correct: 'นะคะ' },
            { wrong: 'อนุญาติ', correct: 'อนุญาต' },
            { wrong: 'โอกาศ', correct: 'โอกาส' },
            { wrong: 'รสชาด', correct: 'รสชาติ' },
            { wrong: 'สะใภ้', correct: 'สะใภ้' },
            { wrong: 'เค้า', correct: 'เขา' },
            { wrong: 'ทำไร', correct: 'ทำอะไร' },
            { wrong: 'จิงๆ', correct: 'จริงๆ' },
            { wrong: 'เดี๋ยวนี้', correct: 'เดี๋ยวนี้' },
            { wrong: 'เพราะว่า', correct: 'เพราะว่า' },
            { wrong: 'ยังไง', correct: 'อย่างไร' },
            { wrong: 'คอมพิวเตอ์', correct: 'คอมพิวเตอร์' },
            { wrong: 'อินเตอร์เน็ต', correct: 'อินเทอร์เน็ต' },
            { wrong: 'เว๊บไซท์', correct: 'เว็บไซต์' },
        ];

        commonMistakes.forEach(({ wrong, correct }) => {
            let index = 0;
            while ((index = content.indexOf(wrong, index)) !== -1) {
                const start = Math.max(0, index - 20);
                const end = Math.min(content.length, index + wrong.length + 20);
                const context = content.slice(start, end).replace(/\n/g, ' ');
                
                spellingErrors.push({
                    wrong,
                    correct,
                    context: `...${context}...`
                });
                
                index += wrong.length;
            }
        });

        return Response.json({
            spelling_errors: spellingErrors,
            garant_issues: []
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});