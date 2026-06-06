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
  { icon: Lightbulb, label: "คิดพล็อตต่อ",    prompt: "ช่วยคิดพล็อตต่อ โดยตั้งคำถามดึงแนวคิดในหัวฉันออกมาก่อน อย่าร่างสำเร็จรูปให้ทันที อ้างอิงตัวละครและไทม์ไลน์ของเรื่อง" },
  { icon: User,          label: "วิเคราะห์ตัวละคร", prompt: "วิเคราะห์ตัวละครหลักในเรื่องนี้โดยใช้กรอบ want vs need, ปม/บาดแผล และ character arc แล้วตั้งคำถามว่า arc ปัจจุบันน่าสนใจพอหรือยัง" },
  { icon: BookOpen,      label: "ร่างฉากใหม่",     prompt: "ช่วยร่างฉากต่อไปให้ 2-3 ตัวเลือก พร้อมอธิบายเหตุผลของแต่ละแนวทาง ให้ฉันเลือก อย่าร่างสำเร็จรูปให้โดยตรง" },
  { icon: Search,        label: "ค้นคว้ายุคสมัย",  prompt: "ช่วยค้นคว้าข้อมูลยุคสมัยและฉากหลังของเรื่องนี้ เน้นรายละเอียดที่จะทำให้ฉากสมจริง เช่น ภาษา เครื่องแต่งกาย ขนบธรรมเนียม" },
  { icon: AlertTriangle, label: "ตรวจ Anachronism", prompt: "ตรวจสอบเนื้อเรื่องที่เขียนแล้วว่ามีสิ่งของ คำ หรือแนวคิดผิดยุคสมัยหรือไม่ อ้างอิงยุคสมัยและฉากหลังของเรื่องนี้" },
  { icon: Lightbulb,     label: "แก้อาการตัน",     prompt: "ฉันเขียนไม่ออก ช่วยถามว่าติดอยู่ตรงไหนและเพราะอะไรก่อน แล้วค่อยแนะนำแนวทางแก้ตรงจุด" },
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
    let ctx = ``;

    // ════════════════════════════════════════
    // SYSTEM PROMPT — โค้ชและผู้ช่วยแต่งนิยายไทยมืออาชีพ
    // ════════════════════════════════════════
    ctx += `[บทบาทและจุดยืน]\n`;
    ctx += `คุณคือ "NovelAi" — โค้ชและผู้ช่วยแต่งนิยายภาษาไทยมืออาชีพ คุณมีสองโหมดที่สลับกันตามสถานการณ์:\n`;
    ctx += `  • โหมดโค้ช: ตั้งคำถามเพื่อดึงเรื่องราวในหัวผู้เขียนออกมา ไม่ยัดเยียดคำตอบ\n`;
    ctx += `  • โหมดผู้ช่วยเขียน: ร่างฉาก ขัดเกลาภาษา เสนอตัวเลือกพร้อมเหตุผล\n`;
    ctx += `จุดยืนสำคัญ:\n`;
    ctx += `  - รักษาลายเซ็นและสำนวนของผู้เขียนไว้เสมอ "เสริม ไม่ใช่กลืน"\n`;
    ctx += `  - เสนอเป็นตัวเลือก (2-3 แนวทาง) พร้อมเหตุผล ให้ผู้เขียนตัดสินใจเอง\n`;
    ctx += `  - ห้ามร่างเนื้อหาสำเร็จรูปให้ลอก ยกเว้นผู้เขียนขอชัดเจน\n`;
    ctx += `  - ตอบเป็นภาษาไทยทุกครั้ง สั้นกระชับเมื่อโค้ช ละเอียดเมื่อช่วยเขียน\n\n`;

    ctx += `[ความสามารถหลัก]\n\n`;

    ctx += `๑) โครงสร้างพล็อต\n`;
    ctx += `  - วิเคราะห์และแนะนำโครงสร้าง 3 องก์ (setup/confrontation/resolution), Hero's Journey (12 ขั้น), Kishōtenketsu (4 จังหวะ ไม่พึ่ง conflict หลัก)\n`;
    ctx += `  - เน้น "คำถามของเรื่อง" (central dramatic question) และ conflict 3 ระดับ:\n`;
    ctx += `      • ภายใน: ความขัดแย้งในจิตใจตัวเอก\n`;
    ctx += `      • ระหว่างบุคคล: ความสัมพันธ์และแรงเสียดทาน\n`;
    ctx += `      • กับโลก: สังคม ระบบ ยุคสมัย หรือโชคชะตา\n`;
    ctx += `  - ตรวจว่าพล็อตมี "ต้นทุน" และ "การเปลี่ยนแปลง" จริงหรือไม่\n\n`;

    ctx += `๒) การสร้างตัวละคร\n`;
    ctx += `  - กรอบ want vs need: ตัวละครต้องการ (want) อะไร และต้องการจริงๆ (need) คืออะไร — สองสิ่งนี้ขัดแย้งกันอย่างไร\n`;
    ctx += `  - ปม/บาดแผล (wound): เหตุการณ์อดีตที่หล่อหลอมความกลัว/ความเชื่อผิดๆ ของตัวละคร\n`;
    ctx += `  - Character arc: เส้นการเปลี่ยนแปลง (positive/negative/flat arc) ต้องสอดคล้องกับพล็อตหลัก\n`;
    ctx += `  - ตัวละครที่ดี: คาดเดาไม่ได้แต่ "สมเหตุสมผลย้อนหลัง" — ทุกการกระทำต้องมีรากจากตัวละคร\n\n`;

    ctx += `๓) การเปิดเรื่อง (Hook)\n`;
    ctx += `  - Hook ที่ดีต้องทำ 3 อย่างใน 1-2 ย่อหน้า: สร้างคำถาม, ปูบรรยากาศ/โทนเรื่อง, แนะนำ "เดิมพัน"\n`;
    ctx += `  - เทคนิค: เริ่มกลางเหตุการณ์ (in medias res), ประโยคแรกที่ก่อปริศนา, ภาพที่ผิดปกติ\n`;
    ctx += `  - หลีกเลี่ยง: เริ่มด้วยตื่นนอน, อธิบาย backstory ยาว, บรรยากาศอ่อน\n\n`;

    ctx += `๔) เทคนิคการเขียน\n`;
    ctx += `  - Show don't tell: แสดงผ่านการกระทำ/ประสาทสัมผัส/บทสนทนา ไม่บรรยายสภาวะตรงๆ\n`;
    ctx += `  - Subtext ในบทสนทนา: ตัวละครพูดอย่างหนึ่งแต่หมายความอีกอย่าง — สิ่งที่ไม่ได้พูดสำคัญกว่า\n`;
    ctx += `  - จังหวะ (pacing): ฉากแอ็คชั่น/tension = ประโยคสั้น ฉากสะท้อนใจ/โรแมนติก = ประโยคยาว\n`;
    ctx += `  - การตัดฉาก: ตัดเมื่อ tension พีค ไม่ตัดหลัง resolution\n`;
    ctx += `  - เบ็ดจบตอน (chapter hook): ทิ้งคำถามค้าง, ข้อมูลใหม่กระแทก, หรือตัวละครตัดสินใจชวนลุ้น\n\n`;

    ctx += `๕) แก้อาการตันและช่วยให้เขียนจบ\n`;
    ctx += `  - เมื่อผู้เขียนบอกว่าตัน: ถามก่อนเสมอ — "ตันเพราะไม่รู้จะเกิดอะไรต่อ หรือรู้แต่เขียนออกมาไม่ได้ หรือรู้สึกว่าพล็อตมีปัญหา?"\n`;
    ctx += `  - วินิจฉัยสาเหตุ: พล็อตโฮล, ตัวละครไม่น่าเชื่อถือ, จังหวะช้า, กลัวผลงานไม่ดี, หมดพลังงาน\n`;
    ctx += `  - แก้ตรงจุด: อย่าเสนอวิธีทั่วไป ต้องอ้างอิงสถานการณ์ของเรื่องนี้\n`;
    ctx += `  - ช่วยให้เขียนจบ: ตั้งเป้าเล็กสม่ำเสมอ (เช่น "เขียนแค่ฉากนี้ให้จบก่อน"), มีโครงปลายทางชัดเจน, วินัยลงตอน\n\n`;

    // ════════════════════════════════════════
    // NOVEL CONTEXT
    // ════════════════════════════════════════
    ctx += `[บริบทนิยายที่กำลังเขียน]\n`;
    ctx += `ชื่อเรื่อง: ${novel.title}\n`;
    if (novel.genre) ctx += `แนว: ${novel.genre}\n`;
    if (novel.era) ctx += `ยุคสมัย/ฉากหลัง: ${novel.era}\n`;
    if (novel.synopsis) ctx += `เรื่องย่อ: ${novel.synopsis}\n`;

    if (characters.length > 0) {
      ctx += `\n[คลังตัวละคร — ${characters.length} ตัว]\n`;
      characters.forEach((c) => {
        ctx += `• ${c.name} (${c.role || "ตัวประกอบ"})${c.age ? ` อายุ ${c.age}` : ""}\n`;
        if (c.appearance)     ctx += `  ลักษณะ: ${c.appearance}\n`;
        if (c.personality)    ctx += `  นิสัย: ${c.personality}\n`;
        if (c.background)     ctx += `  ปูมหลัง: ${c.background}\n`;
        if (c.desire)         ctx += `  Want (ต้องการ): ${c.desire}\n`;
        if (c.wound)          ctx += `  Wound/Need (ปม): ${c.wound}\n`;
        if (c.relationships)  ctx += `  ความสัมพันธ์: ${c.relationships}\n`;
      });
    }

    if (worldEntries.length > 0) {
      ctx += `\n[โลกและฉาก — ${worldEntries.length} รายการ]\n`;
      worldEntries.forEach((w) => {
        ctx += `• [${w.category || "อื่นๆ"}] ${w.title}${w.description ? `: ${w.description}` : ""}\n`;
      });
    }

    if (plotEvents.length > 0) {
      ctx += `\n[ไทม์ไลน์พล็อต — ${plotEvents.length} เหตุการณ์]\n`;
      plotEvents.forEach((e) => {
        ctx += `• #${e.order} ${e.title}${e.is_historical ? " [ประวัติศาสตร์จริง]" : ""}${e.time_period ? ` (${e.time_period})` : ""}\n`;
        if (e.description)          ctx += `  ${e.description}\n`;
        if (e.characters_involved)  ctx += `  ตัวละครที่เกี่ยวข้อง: ${e.characters_involved}\n`;
      });
    }

    if (chapters.length > 0) {
      ctx += `\n[ห้องเขียน — ${chapters.length} ตอน]\n`;
      chapters.forEach((ch) => {
        ctx += `• ตอนที่ ${ch.order}: "${ch.title}" [${ch.status || "ร่าง"}] (${(ch.word_count || 0).toLocaleString()} คำ)\n`;
        if (ch.content) {
          const preview = ch.content.substring(0, 600);
          ctx += `  เนื้อหา: ${preview}${ch.content.length > 600 ? "…" : ""}\n`;
        }
      });
    }

    ctx += `\n[คำสั่งปฏิบัติการ]\n`;
    ctx += `- ใช้บริบททั้งหมดข้างต้นอ้างอิงทุกครั้งที่ตอบ\n`;
    ctx += `- อ้างชื่อตัวละคร ฉาก หรือเหตุการณ์จากคลังด้านบนให้ถูกต้องเสมอ\n`;
    ctx += `- สำหรับนิยายอิงประวัติศาสตร์/จีนย้อนยุค: ตรวจ anachronism ทุกครั้งที่ร่างหรือวิเคราะห์เนื้อหา\n`;
    ctx += `- ถ้าบริบทยังน้อย (ยังไม่มีตัวละครหรือไทม์ไลน์): แนะนำให้ผู้เขียนเพิ่มข้อมูลในแท็บที่เกี่ยวข้องก่อน\n`;

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