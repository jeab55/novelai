import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveVersion } from "@/lib/saveVersion";
import { useSafeAction } from "@/hooks/useSafeAction";
import { Sparkles, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import ReactMarkdown from "react-markdown";

const ROLES = ["ตัวเอก", "ตัวรอง", "ตัวร้าย", "ตัวประกอบ"];

export default function CharacterForm({ novelId, character, onDone, novelIdForVersion }) {
  const [form, setForm] = useState({
    name: character?.name || "",
    role: character?.role || "",
    age: character?.age || "",
    appearance: character?.appearance || "",
    personality: character?.personality || "",
    background: character?.background || "",
    desire: character?.desire || "",
    wound: character?.wound || "",
    relationships: character?.relationships || "",
  });
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [analysisOpen, setAnalysisOpen] = useState(true);
  const queryClient = useQueryClient();

  const { run: saveChar, isPending: isSaving } = useSafeAction({
    action: character ? "แก้ไขตัวละคร" : "สร้างตัวละคร",
    entity: "Character",
    fn: async (data) => {
      if (character) {
        await saveVersion({
          entityType: "character",
          entityId: character.id,
          novelId: novelIdForVersion || novelId,
          data: character,
          label: `แก้ไขตัวละคร: ${character.name}`,
        });
        return base44.entities.Character.update(character.id, data);
      } else {
        return base44.entities.Character.create({ ...data, novel_id: novelId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["characters", novelId] });
      onDone();
    },
  });

  const set = (field, value) => setForm((p) => ({ ...p, [field]: value }));

  const handleAnalyze = async () => {
    if (!form.name) return;
    setAnalyzing(true);
    setAnalysis(null);
    const charDesc = [
      form.name && `ชื่อ: ${form.name}`,
      form.role && `บทบาท: ${form.role}`,
      form.age && `อายุ: ${form.age}`,
      form.appearance && `ลักษณะ: ${form.appearance}`,
      form.personality && `นิสัย: ${form.personality}`,
      form.background && `ปูมหลัง: ${form.background}`,
      form.desire && `สิ่งที่ต้องการ (Want): ${form.desire}`,
      form.wound && `ปม/บาดแผล (Wound/Need): ${form.wound}`,
      form.relationships && `ความสัมพันธ์: ${form.relationships}`,
    ].filter(Boolean).join("\n");

    const prompt = `คุณคือนักวิเคราะห์ตัวละครในนิยายมืออาชีพ วิเคราะห์ตัวละครต่อไปนี้อย่างละเอียด:

${charDesc}

วิเคราะห์ใน 4 หัวข้อนี้:
1. **จุดแข็ง** — สิ่งที่น่าสนใจและโดดเด่น
2. **Want vs Need** — ความต้องการที่รับรู้ vs ความต้องการที่แท้จริง และความขัดแย้งภายใน
3. **Character Arc** — เส้นทางการเติบโตที่เป็นไปได้ และจุดหักเหที่น่าสนใจ
4. **คำแนะนำ** — สิ่งที่ควรเติมเพื่อทำให้ตัวละครสมบูรณ์และสมจริงยิ่งขึ้น

ตอบเป็นภาษาไทย กระชับ ตรงประเด็น`;

    const result = await base44.integrations.Core.InvokeLLM({ prompt });
    setAnalysis(result);
    setAnalysisOpen(true);
    setAnalyzing(false);
  };

  const fields = [
    { key: "name", label: "ชื่อตัวละคร", type: "input", placeholder: "เช่น เจ้าพระยาวิชาเยนทร์" },
    { key: "role", label: "บทบาท", type: "select", options: ROLES },
    { key: "age", label: "อายุ", type: "input", placeholder: "เช่น 28" },
    { key: "appearance", label: "ลักษณะภายนอก", type: "textarea", placeholder: "รูปร่าง หน้าตา การแต่งกาย..." },
    { key: "personality", label: "นิสัยและบุคลิก", type: "textarea", placeholder: "นิสัย อุปนิสัย พฤติกรรม..." },
    { key: "background", label: "ปูมหลัง", type: "textarea", placeholder: "ที่มา ครอบครัว ประวัติ..." },
    { key: "desire", label: "สิ่งที่ต้องการ", type: "textarea", placeholder: "แรงจูงใจ เป้าหมาย..." },
    { key: "wound", label: "ปม/บาดแผลทางใจ", type: "textarea", placeholder: "ความเจ็บปวด ความกลัว..." },
    { key: "relationships", label: "ความสัมพันธ์", type: "textarea", placeholder: "ความสัมพันธ์กับตัวละครอื่น..." },
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    saveChar(form);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4 mt-2">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="text-sm font-medium mb-1.5 block">{f.label}</label>
            {f.type === "input" && (
              <Input value={form[f.key]} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} />
            )}
            {f.type === "select" && (
              <Select value={form[f.key]} onValueChange={(v) => set(f.key, v)}>
                <SelectTrigger><SelectValue placeholder="เลือก" /></SelectTrigger>
                <SelectContent>
                  {f.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {f.type === "textarea" && (
              <Textarea value={form[f.key]} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} rows={2} />
            )}
          </div>
        ))}

        {/* Analyze button */}
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/5"
          onClick={handleAnalyze}
          disabled={!form.name || analyzing}
        >
          {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {analyzing ? "กำลังวิเคราะห์..." : "วิเคราะห์ตัวละครด้วย AI"}
        </Button>

        {/* Analysis result */}
        {analysis && (
          <div className="rounded-xl border border-primary/20 bg-primary/4 overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-primary hover:bg-primary/8 transition-colors"
              onClick={() => setAnalysisOpen((v) => !v)}
            >
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                ผลวิเคราะห์ AI
              </span>
              {analysisOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {analysisOpen && (
              <div className="px-4 pb-3 text-sm prose prose-sm max-w-none [&>*:first-child]:mt-0 text-foreground/90">
                <ReactMarkdown>{analysis}</ReactMarkdown>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-2 gap-1.5 border-primary/30 text-primary hover:bg-primary/8 text-xs"
                  onClick={() => set("ai_analysis", analysis)}
                >
                  <Sparkles className="w-3 h-3" />
                  บันทึกผลวิเคราะห์นี้ไว้กับตัวละคร
                </Button>
              </div>
            )}
          </div>
        )}
        {form.ai_analysis && !analysis && (
          <div className="rounded-xl border border-border/50 bg-muted/20 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground/70 mb-1 flex items-center gap-1"><Sparkles className="w-3 h-3" />ผลวิเคราะห์ที่บันทึกไว้</p>
            <p className="line-clamp-3">{form.ai_analysis}</p>
          </div>
        )}

        <Button type="submit" className="w-full" disabled={!form.name || isSaving}>
          {isSaving ? <><Loader2 className="w-4 h-4 animate-spin mr-1" />กำลังบันทึก...</> : character ? "อัปเดต" : "เพิ่มตัวละคร"}
        </Button>
      </div>
    </form>
  );
}