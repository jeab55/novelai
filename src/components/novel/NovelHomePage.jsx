import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles, BookOpen, BookText, Feather, Hash, Calendar, PenTool,
  CheckCircle2, Edit3, X, Save, Loader2, Bot
} from "lucide-react";
import { toast } from "sonner";
import CopyButton from "@/components/ui/CopyButton";
import NovelBlurbDialog from "./NovelBlurbDialog";

const statusColors = {
  "กำลังเขียน": "bg-sky-50 text-sky-700 border-sky-200",
  "เขียนเสร็จ": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "พักไว้ก่อน": "bg-amber-50 text-amber-700 border-amber-200",
};

export default function NovelHomePage({ novel, novelId }) {
  const queryClient = useQueryClient();
  const [editingBlurb, setEditingBlurb] = useState(false);
  const [blurbDraft, setBlurbDraft] = useState("");
  const [savingBlurb, setSavingBlurb] = useState(false);
  const [blurbDialogOpen, setBlurbDialogOpen] = useState(false);

  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters", novelId],
    queryFn: async () => {
      const all = await base44.entities.Chapter.filter({ novel_id: novelId }, "order");
      return all.filter((c) => !c.is_deleted);
    },
  });

  const { data: novelWriter } = useQuery({
    queryKey: ["writers-all"],
    queryFn: () => base44.entities.Writer.list(),
    enabled: !!novel?.writer_id,
    select: (data) => data?.find((w) => String(w.id) === String(novel?.writer_id)),
  });

  const totalWords = chapters.reduce((acc, c) => acc + (c.word_count || 0), 0);
  const withContent = chapters.filter((c) => c.content && (c.word_count || 0) > 0).length;

  const startEditBlurb = () => {
    setBlurbDraft(novel?.blurb || "");
    setEditingBlurb(true);
  };

  const saveBlurb = async () => {
    setSavingBlurb(true);
    await base44.entities.Novel.update(novelId, { blurb: blurbDraft });
    queryClient.invalidateQueries({ queryKey: ["novel", novelId] });
    toast.success("บันทึกคำโปรยแล้ว");
    setSavingBlurb(false);
    setEditingBlurb(false);
  };

  const infoItems = [
    { icon: Hash, label: "แนวเรื่อง", value: novel?.genre },
    { icon: Calendar, label: "ยุคสมัย/ฉากหลัง", value: novel?.era },
    { icon: Bot, label: "นักเขียน AI", value: novelWriter?.name },
    { icon: BookOpen, label: "จำนวนตอน", value: chapters.length > 0 ? `${chapters.length} ตอน (มีเนื้อหา ${withContent} ตอน)` : "ยังไม่มีตอน" },
    { icon: Feather, label: "คำรวมทั้งเรื่อง", value: totalWords > 0 ? `${totalWords.toLocaleString()} คำ` : "-" },
    { icon: PenTool, label: "สถานะ", value: novel?.status },
  ].filter((item) => item.value);

  return (
    <>
      <NovelBlurbDialog
        open={blurbDialogOpen}
        onClose={() => setBlurbDialogOpen(false)}
        novel={novel}
        novelId={novelId}
        chapters={chapters}
      />

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">

        {/* ─── Blurb Section ─── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading text-base font-semibold flex items-center gap-2">
              <BookText className="w-4 h-4 text-primary" />
              คำโปรย
            </h2>
            {novel?.blurb && !editingBlurb && (
              <div className="flex items-center gap-1.5">
                <CopyButton text={novel.blurb} label="คัดลอก" size="sm" />
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground" onClick={startEditBlurb}>
                  <Edit3 className="w-3 h-3" />
                  แก้ไข
                </Button>
              </div>
            )}
          </div>

          {novel?.blurb && !editingBlurb ? (
            // ── ปกหลังหนังสือ ──
            <div className="relative rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/8 via-accent/30 to-background px-7 py-8 shadow-sm overflow-hidden">
              {/* decorative quote */}
              <span className="absolute top-4 left-5 text-6xl font-serif text-primary/10 select-none leading-none">"</span>
              <p className="relative font-body text-[17px] leading-[1.85] text-foreground/90 tracking-wide">
                {novel.blurb}
              </p>
              <span className="absolute bottom-3 right-6 text-5xl font-serif text-primary/10 select-none leading-none">"</span>
              <div className="mt-5 pt-4 border-t border-primary/10 flex items-center gap-2">
                <div className="w-5 h-px bg-primary/30 flex-1" />
                <span className="text-xs text-primary/50 font-medium italic">{novel.title}</span>
                <div className="w-5 h-px bg-primary/30 flex-1" />
              </div>
            </div>
          ) : editingBlurb ? (
            <div className="space-y-2">
              <Textarea
                value={blurbDraft}
                onChange={(e) => setBlurbDraft(e.target.value)}
                rows={5}
                className="resize-none text-base leading-relaxed"
                autoFocus
              />
              <div className="flex items-center gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setEditingBlurb(false)} disabled={savingBlurb}>
                  <X className="w-3.5 h-3.5 mr-1" />ยกเลิก
                </Button>
                <Button size="sm" onClick={saveBlurb} disabled={savingBlurb} className="gap-1.5">
                  {savingBlurb ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  บันทึก
                </Button>
              </div>
            </div>
          ) : (
            // ── ยังไม่มีคำโปรย ──
            <div className="rounded-2xl border-2 border-dashed border-border bg-muted/20 px-6 py-10 text-center">
              <BookText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground mb-1">ยังไม่มีคำโปรย</p>
              <p className="text-xs text-muted-foreground/70 mb-5">
                ให้ AI อ่านเนื้อหาจริงแล้วสร้างคำโปรย 3 แบบให้เลือก<br />หรือเขียนเองก็ได้ค่ะ
              </p>
              <div className="flex items-center justify-center gap-2">
                <Button size="sm" className="gap-1.5" onClick={() => setBlurbDialogOpen(true)}>
                  <Sparkles className="w-3.5 h-3.5" />
                  สรุป + สร้างคำโปรยด้วย AI
                </Button>
                <Button size="sm" variant="outline" onClick={startEditBlurb}>
                  <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                  เขียนเอง
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* ─── Synopsis ─── */}
        {novel?.synopsis && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-heading text-base font-semibold flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                เรื่องย่อ
              </h2>
              <CopyButton text={novel.synopsis} label="คัดลอก" size="sm" />
            </div>
            <div className="rounded-xl border border-border/60 bg-card/60 px-5 py-4">
              <p className="text-sm leading-[1.9] text-foreground/80 whitespace-pre-wrap">{novel.synopsis}</p>
            </div>
          </section>
        )}

        {/* ─── Info ─── */}
        <section>
          <h2 className="font-heading text-base font-semibold flex items-center gap-2 mb-3">
            <Feather className="w-4 h-4 text-primary" />
            ข้อมูลเรื่อง
          </h2>
          <div className="rounded-xl border border-border/60 bg-card/60 divide-y divide-border/40 overflow-hidden">
            {infoItems.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3 px-5 py-3">
                <Icon className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                <span className="text-xs text-muted-foreground w-32 shrink-0">{label}</span>
                {label === "สถานะ" ? (
                  <Badge variant="outline" className={`text-xs ${statusColors[value] || ""}`}>{value}</Badge>
                ) : (
                  <span className="text-sm font-medium">{value}</span>
                )}
              </div>
            ))}
          </div>
        </section>

      </div>
    </>
  );
}