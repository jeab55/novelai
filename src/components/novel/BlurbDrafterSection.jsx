import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Feather, Sparkles, Loader2, Check, History, RotateCcw, Trash2, Link2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useBlurbDrafter } from "@/hooks/useBlurbDrafter";
import BlurbPicker from "@/components/novel/BlurbPicker";

// ส่วน "คำโปรย" ในหน้าวิเคราะห์พล็อต
// แก้ไขได้เอง + ร่างหลายแบบ + เลือกแหล่งอ้างอิง + เก็บร่างก่อนหน้าไว้เทียบ
export default function BlurbDrafterSection({ novel, novelId, analysisSummary }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState(novel?.synopsis || "");
  const [saving, setSaving] = useState(false);
  const [sourceMode, setSourceMode] = useState("anchored"); // anchored | free
  const [history, setHistory] = useState([]); // ร่างก่อนหน้าที่เก็บไว้เทียบ
  const { drafting, blurbs, pickerOpen, draftFromPlot, closePicker } = useBlurbDrafter();

  const handleDraft = () => {
    draftFromPlot(novel, { synopsis: text, analysis_summary: analysisSummary, sourceMode });
  };

  // เก็บร่างปัจจุบันเข้า history ก่อน แล้วค่อยเลือกของใหม่ (ไม่เขียนทับของเดิมถาวร)
  const handleSelectNew = (b) => {
    if ((text || "").trim()) {
      setHistory((prev) => [{ id: Date.now(), text }, ...prev].slice(0, 8));
    }
    setText(b);
    closePicker();
  };

  const restoreDraft = (item) => {
    if ((text || "").trim() && text !== item.text) {
      setHistory((prev) => [{ id: Date.now(), text }, ...prev.filter((h) => h.id !== item.id)].slice(0, 8));
    } else {
      setHistory((prev) => prev.filter((h) => h.id !== item.id));
    }
    setText(item.text);
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
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="font-heading flex items-center gap-2">
            <Feather className="w-5 h-5" />
            คำโปรย
          </CardTitle>
          <Button onClick={handleDraft} disabled={drafting} className="gap-2">
            {drafting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {drafting ? "กำลังร่าง..." : (history.length || (text || "").trim() ? "✨ สร้างอีกแบบ" : "✨ ร่างคำโปรยจากพล็อต")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* เลือกแหล่งอ้างอิงก่อนสร้าง */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">แหล่งอ้างอิง:</span>
          <Button
            type="button"
            variant={sourceMode === "anchored" ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => setSourceMode("anchored")}
          >
            <Link2 className="w-3 h-3" /> อิงเรื่องย่อ/พล็อตเดิม
          </Button>
          <Button
            type="button"
            variant={sourceMode === "free" ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => setSourceMode("free")}
          >
            <Wand2 className="w-3 h-3" /> แตกแนวใหม่อิสระ
          </Button>
        </div>

        <Textarea
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="คำโปรย / เรื่องย่อ — พิมพ์แก้ไขได้เอง หรือกด ✨ ให้ AI ร่างหลายแบบ"
        />

        {/* ร่างก่อนหน้า — เทียบ/เลือกใช้ภายหลัง */}
        {history.length > 0 && (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <History className="w-3.5 h-3.5" /> ร่างก่อนหน้า ({history.length})
            </div>
            {history.map((item) => (
              <div key={item.id} className="flex items-start gap-2 rounded-md bg-background/60 border border-border/40 p-2">
                <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed flex-1 line-clamp-3">{item.text}</p>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-primary" title="ใช้ร่างนี้" onClick={() => restoreDraft(item)}>
                    <RotateCcw className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" title="ลบ"
                    onClick={() => setHistory((prev) => prev.filter((h) => h.id !== item.id))}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

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
        onSelect={handleSelectNew}
      />
    </Card>
  );
}