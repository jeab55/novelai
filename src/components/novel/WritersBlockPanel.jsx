import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Loader2, Sparkles, X, ArrowRight, Wind } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { invokeAIStable } from "@/lib/aiInvoke";

const SCHEMA = {
  type: "object",
  properties: {
    directions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          summary: { type: "string" },
          tone: { type: "string" },
        },
      },
    },
  },
};

export default function WritersBlockPanel({ content, novel, onClose }) {
  const [situation, setSituation] = useState((content || "").replace(/<[^>]*>/g, " ").trim().slice(-1200));
  const [directions, setDirections] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSuggest = async () => {
    const text = (situation || "").trim();
    if (text.length < 15) {
      toast.error("กรุณาใส่สถานการณ์ปัจจุบันของเรื่อง (อย่างน้อยสั้นๆ)");
      return;
    }
    setLoading(true);
    setDirections([]);
    try {
      const prompt = `คุณคือนักวางพล็อตนิยายไทยมืออาชีพ${novel?.genre ? ` แนว${novel.genre}` : ""} ผู้เขียนกำลังตันและต้องการไอเดียเดินเรื่องต่อ

สถานการณ์ปัจจุบันของเรื่อง:
"""
${text}
"""

จงเสนอ "ทางเดินเรื่องต่อ" 4 แนวทางที่แตกต่างกันอย่างชัดเจน (เช่น พลิกผัน/หักมุม, ดราม่าอารมณ์, เร่งความขัดแย้ง, เฉลยปม ฯลฯ) แต่ละแนวทางให้ระบุ:
- title: ชื่อแนวทางสั้นๆ น่าสนใจ
- summary: อธิบายว่าเรื่องจะเดินต่ออย่างไร (2-3 ประโยค กระชับแต่เห็นภาพ)
- tone: อารมณ์/โทนของแนวทางนี้ (คำสั้นๆ)

ทุกแนวทางต้องต่อเนื่องสมเหตุสมผลจากสถานการณ์ปัจจุบัน และต่างมุมกันจริง`;

      const result = await invokeAIStable({ prompt, model: "claude_sonnet_4_6", response_json_schema: SCHEMA });
      const parsed = typeof result === "string" ? JSON.parse(result) : result;
      const list = parsed?.directions || parsed?.response?.directions || parsed?.output?.directions || [];
      if (!Array.isArray(list) || list.length === 0) throw new Error("ไม่สามารถเสนอแนวทางได้");
      setDirections(list);
      toast.success(`เสนอ ${list.length} แนวทางให้เดินเรื่องต่อ`);
    } catch (e) {
      toast.error("เสนอแนวทางไม่สำเร็จ: " + (e.message || ""));
      setDirections(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-t border-border/60 bg-card/30 p-4">
      <div className="max-w-4xl mx-auto space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-heading font-semibold flex items-center gap-2 text-sm">
            <Lightbulb className="w-4 h-4 text-amber-500" />เครื่องมือแก้ตัน (Writer's Block Helper)
          </h3>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        <div>
          <p className="text-xs font-medium mb-1 text-muted-foreground">สถานการณ์ปัจจุบันของเรื่อง (ดึงจากท้ายตอนล่าสุดอัตโนมัติ — แก้ไขได้)</p>
          <Textarea value={situation} onChange={(e) => setSituation(e.target.value)} className="min-h-[110px] text-sm leading-relaxed resize-none" placeholder="เช่น ตัวเอกเพิ่งรู้ความลับของพ่อ และกำลังตัดสินใจว่าจะเผชิญหน้าหรือหนี..." />
        </div>
        <Button onClick={handleSuggest} disabled={loading} className="gap-2">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" />กำลังคิดแนวทาง...</> : <><Sparkles className="w-4 h-4" />เสนอทางเดินเรื่องต่อ</>}
        </Button>

        {directions && directions.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-3 pt-1">
            {directions.map((d, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                <Card className="h-full border-l-4 border-l-amber-400">
                  <CardHeader className="py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                      {d.tone && <Badge variant="outline" className="text-[10px] gap-1"><Wind className="w-2.5 h-2.5" />{d.tone}</Badge>}
                    </div>
                    <CardTitle className="text-sm flex items-start gap-1.5"><ArrowRight className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />{d.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground leading-relaxed">{d.summary}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}