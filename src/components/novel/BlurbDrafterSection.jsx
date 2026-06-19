import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Feather, Sparkles, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { useBlurbDrafter } from "@/hooks/useBlurbDrafter";
import BlurbPicker from "@/components/novel/BlurbPicker";

// ส่วน "คำโปรย" ในหน้าวิเคราะห์พล็อต
// แสดง/แก้ไขคำโปรย + ปุ่มร่างคำโปรยจากพล็อต (ใช้พรอมป์กลางตัวเดียวกัน)
// analysisSummary: สรุปผลวิเคราะห์พล็อตล่าสุด (ถ้ามี) เพื่อใช้เป็นบริบทเสริม
export default function BlurbDrafterSection({ novel, novelId, analysisSummary }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState(novel?.synopsis || "");
  const [saving, setSaving] = useState(false);
  const { drafting, blurbs, pickerOpen, draftFromPlot, closePicker } = useBlurbDrafter();

  const handleDraft = () => {
    draftFromPlot(novel, { synopsis: text, analysis_summary: analysisSummary });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.entities.Novel.update(novelId, { synopsis: text });
      queryClient.invalidateQueries({ queryKey: ["novel", novelId] });
      queryClient.invalidateQueries({ queryKey: ["novels"] });
      toast.success("บันทึกคำโปรยเป็นเรื่องย่อของเรื่องแล้ว");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="font-heading flex items-center gap-2">
            <Feather className="w-5 h-5" />
            คำโปรย
          </CardTitle>
          <Button onClick={handleDraft} disabled={drafting} className="gap-2">
            {drafting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {drafting ? "กำลังร่าง..." : "✨ ร่างคำโปรยจากพล็อต"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="คำโปรย / เรื่องย่อ — กด ✨ เพื่อให้ AI ร่างจากพล็อตจริงของเรื่อง"
        />
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={saving || (text || "") === (novel?.synopsis || "")}
            className="gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            บันทึกเป็นเรื่องย่อของเรื่อง
          </Button>
        </div>
      </CardContent>

      <BlurbPicker
        open={pickerOpen}
        onClose={closePicker}
        blurbs={blurbs}
        onSelect={(b) => { setText(b); closePicker(); }}
      />
    </Card>
  );
}