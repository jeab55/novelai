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

        // ใช้ AI ตรวจสอบคำผิดภาษาไทยตามหลักพจนานุกรมราชบัณฑิตยสภา
        const response = await base44.integrations.Core.InvokeLLM({
            model: "automatic",
            prompt: `ตรวจคำผิดภาษาไทย: ${content.slice(0, 2000)}

ส่ง JSON: {"spelling_errors":[],"word_suggestions":[],"spacing_issues":[],"garant_issues":[],"yamok_issues":[],"tone_issues":[],"anachronistic_words":[]}
`,
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
                            },
                            required: ["issue", "count"]
                        }
                    },
                    garant_issues: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                word: { type: "string" },
                                correct: { type: "string" },
                                issue: { type: "string" },
                                context: { type: "string" }
                            },
                            required: ["word", "correct"]
                        }
                    },
                    yamok_issues: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                word: { type: "string" },
                                issue: { type: "string" },
                                suggestion: { type: "string" },
                                context: { type: "string" }
                            },
                            required: ["word", "issue"]
                        }
                    },
                    tone_issues: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                word: { type: "string" },
                                correct: { type: "string" },
                                explanation: { type: "string" },
                                context: { type: "string" }
                            },
                            required: ["word", "correct"]
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
                                context: { type: "string" }
                            },
                            required: ["word"]
                        }
                    }
                },
                required: []
            }
        });

        return Response.json(response.data);
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});