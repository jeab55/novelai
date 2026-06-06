import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Send, Sparkles, Loader2, User, Bot, Lightbulb, BookOpen, Search, AlertTriangle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";

const QUICK_PROMPTS = [
  { icon: Lightbulb, label: "ช่วยคิดพล็อต", prompt: "ช่วยคิดพล็อตต่อจากเนื้อเรื่องที่มีอยู่ โดยอ้างอิงตัวละครและฉากหลังของเรื่อง" },
  { icon: User, label: "สร้างตัวละคร", prompt: "ช่วยสร้างตัวละครใหม่ที่เข้ากับเรื่องราวและยุคสมัยของนิยาย พร้อมรายละเอียดครบถ้วน" },
  { icon: BookOpen, label: "แต่งต่อฉาก", prompt: "ช่วยเขียนฉากต่อจากเนื้อเรื่องล่าสุด ให้สอดคล้องกับตัวละครและบรรยากาศของเรื่อง" },
  { icon: Search, label: "ค้นคว้ายุคสมัย", prompt: "ช่วยค้นคว้าข้อมูลเกี่ยวกับยุคสมัยและฉากหลังของนิยายเรื่องนี้ เพื่อให้เขียนได้ถูกต้องตามประวัติศาสตร์" },
  { icon: AlertTriangle, label: "ตรวจ Anachronism", prompt: "ช่วยตรวจสอบเนื้อเรื่องที่เขียนไปแล้วว่ามีสิ่งของ คำพูด หรือแนวคิดที่ผิดยุคสมัย (anachronism) หรือไม่" },
];

export default function AiAssistant({ novelId, novel }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  const { data: characters = [] } = useQuery({
    queryKey: ["characters", novelId],
    queryFn: () => base44.entities.Character.filter({ novel_id: novelId }),
  });

  const { data: worldEntries = [] } = useQuery({
    queryKey: ["worldEntries", novelId],
    queryFn: () => base44.entities.WorldEntry.filter({ novel_id: novelId }),
  });

  const { data: plotEvents = [] } = useQuery({
    queryKey: ["plotEvents", novelId],
    queryFn: () => base44.entities.PlotEvent.filter({ novel_id: novelId }, "order"),
  });

  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters", novelId],
    queryFn: () => base44.entities.Chapter.filter({ novel_id: novelId }, "order"),
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const buildContext = () => {
    let ctx = `คุณคือ "NovelAi" ผู้ช่วยแต่งนิยายภาษาไทยที่เชี่ยวชาญ โดยเฉพาะนิยายอิงประวัติศาสตร์\n\n`;
    ctx += `--- ข้อมูลนิยาย ---\n`;
    ctx += `ชื่อเรื่อง: ${novel.title}\n`;
    if (novel.genre) ctx += `แนว: ${novel.genre}\n`;
    if (novel.era) ctx += `ยุคสมัย/ฉากหลัง: ${novel.era}\n`;
    if (novel.synopsis) ctx += `เรื่องย่อ: ${novel.synopsis}\n`;

    if (characters.length > 0) {
      ctx += `\n--- ตัวละคร (${characters.length} ตัว) ---\n`;
      characters.forEach((c) => {
        ctx += `• ${c.name} (${c.role || "ตัวประกอบ"})`;
        if (c.age) ctx += ` อายุ ${c.age}`;
        ctx += "\n";
        if (c.appearance) ctx += `  ลักษณะ: ${c.appearance}\n`;
        if (c.personality) ctx += `  นิสัย: ${c.personality}\n`;
        if (c.background) ctx += `  ปูมหลัง: ${c.background}\n`;
        if (c.desire) ctx += `  ต้องการ: ${c.desire}\n`;
        if (c.wound) ctx += `  ปม: ${c.wound}\n`;
        if (c.relationships) ctx += `  ความสัมพันธ์: ${c.relationships}\n`;
      });
    }

    if (worldEntries.length > 0) {
      ctx += `\n--- โลกและฉาก (${worldEntries.length} รายการ) ---\n`;
      worldEntries.forEach((w) => {
        ctx += `• [${w.category || "อื่นๆ"}] ${w.title}: ${w.description || ""}\n`;
      });
    }

    if (plotEvents.length > 0) {
      ctx += `\n--- ไทม์ไลน์เหตุการณ์ (${plotEvents.length} เหตุการณ์) ---\n`;
      plotEvents.forEach((e) => {
        ctx += `• #${e.order} ${e.title}${e.is_historical ? " [ประวัติศาสตร์จริง]" : ""}`;
        if (e.time_period) ctx += ` (${e.time_period})`;
        ctx += "\n";
        if (e.description) ctx += `  ${e.description}\n`;
        if (e.characters_involved) ctx += `  ตัวละคร: ${e.characters_involved}\n`;
      });
    }

    if (chapters.length > 0) {
      ctx += `\n--- ตอนที่เขียนแล้ว (${chapters.length} ตอน) ---\n`;
      chapters.forEach((ch) => {
        ctx += `• ตอนที่ ${ch.order}: ${ch.title} [${ch.status}] (${ch.word_count || 0} คำ)\n`;
        if (ch.content) {
          const preview = ch.content.substring(0, 500);
          ctx += `  เนื้อหาย่อ: ${preview}${ch.content.length > 500 ? "..." : ""}\n`;
        }
      });
    }

    ctx += `\nกรุณาตอบเป็นภาษาไทย ใช้ข้อมูลข้างต้นเป็นบริบท ตอบอย่างสร้างสรรค์และสอดคล้องกับเรื่อง\n`;
    ctx += `สำหรับนิยายอิงประวัติศาสตร์: ให้ใส่ใจความถูกต้องตามยุคสมัย ทั้งภาษา สิ่งของ ประเพณี และเหตุการณ์\n`;

    return ctx;
  };

  const sendMessage = async (text) => {
    if (!text.trim()) return;
    const userMsg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const context = buildContext();
    const conversationHistory = [...messages, userMsg]
      .map((m) => `${m.role === "user" ? "ผู้ใช้" : "AI"}: ${m.content}`)
      .join("\n");

    const fullPrompt = `${context}\n\n--- บทสนทนา ---\n${conversationHistory}\n\nAI:`;

    const response = await base44.integrations.Core.InvokeLLM({
      prompt: fullPrompt,
      add_context_from_internet: true,
    });

    setMessages((prev) => [...prev, { role: "assistant", content: response }]);
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-primary/40" />
              </div>
              <h3 className="font-heading text-lg font-semibold mb-2">ผู้ช่วย AI พร้อมช่วยคุณเขียน</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                AI จะอ้างอิงข้อมูลตัวละคร โลก และไทม์ไลน์ของเรื่อง "{novel.title}" ในการตอบ
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {QUICK_PROMPTS.map((qp) => (
                  <Button
                    key={qp.label}
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => sendMessage(qp.prompt)}
                  >
                    <qp.icon className="w-3.5 h-3.5" />
                    {qp.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role !== "user" && (
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border/60"}`}>
                  {msg.role === "user" ? (
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                  ) : (
                    <div className="text-sm prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4 text-secondary-foreground" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-card border border-border/60 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  กำลังคิด...
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border/60 bg-card/30 p-4">
        <div className="max-w-3xl mx-auto flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="ถามผู้ช่วย AI... เช่น ช่วยคิดบทสนทนาระหว่างตัวละครหลัก"
            rows={2}
            className="resize-none flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
          />
          <Button
            size="icon"
            className="shrink-0 h-auto"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        {messages.length > 0 && (
          <div className="max-w-3xl mx-auto mt-2 flex gap-2 flex-wrap">
            {QUICK_PROMPTS.map((qp) => (
              <Button
                key={qp.label}
                variant="ghost"
                size="sm"
                className="text-xs h-7 gap-1"
                onClick={() => sendMessage(qp.prompt)}
                disabled={loading}
              >
                <qp.icon className="w-3 h-3" />
                {qp.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}