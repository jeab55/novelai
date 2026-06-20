import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Megaphone, Loader2, Sparkles, Copy, Check, Tag, FileText } from "lucide-react";
import { toast } from "sonner";
import { invokeAIStable } from "@/lib/aiInvoke";

const PLATFORMS = ["เด็กดี (Dek-D)", "ธัญวลัย (Tunwalai)", "ReadAWrite", "จอยลดา (Joylada)"];

export default function PublishKitDialog({ open, onClose, novels = [] }) {
  const [novelId, setNovelId] = useState("");
  const [platform, setPlatform] = useState(PLATFORMS[0]);
  const [generating, setGenerating] = useState(false);
  const [kit, setKit] = useState(null);
  const [copiedKey, setCopiedKey] = useState("");

  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters-for-publishkit", novelId],
    queryFn: async () => {
      const list = await base44.entities.Chapter.filter({ novel_id: novelId });
      return list.filter((c) => !c.is_deleted).sort((a, b) => (a.order || 0) - (b.order || 0));
    },
    enabled: open && !!novelId,
  });

  const selectedNovel = novels.find((n) => n.id === novelId);

  const reset = () => {
    setNovelId(""); setPlatform(PLATFORMS[0]); setKit(null); setCopiedKey("");
  };
  const handleClose = () => {
    if (generating) return;
    reset();
    onClose();
  };

  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("คัดลอกแล้ว");
    setTimeout(() => setCopiedKey(""), 1500);
  };

  const handleGenerate = async () => {
    if (!novelId) { toast.error("กรุณาเลือกนิยาย"); return; }
    setGenerating(true);
    try {
      const sample = chapters.slice(0, 3).map((c) => `[${c.title}]\n${(c.content || "").replace(/<[^>]*>/g, " ").slice(0, 2000)}`).join("\n\n");
      const prompt = `คุณคือนักการตลาดและบรรณาธิการนิยายไทยมืออาชีพ จงสร้าง "ชุดข้อความประกาศลงแพลตฟอร์ม" สำหรับนิยายต่อไปนี้ เพื่อนำไปลงที่ "${platform}"

ข้อมูลนิยาย:
- ชื่อเรื่อง: ${selectedNovel?.title || ""}
- แนว: ${selectedNovel?.genre || "ไม่ระบุ"}
- ยุค/ฉากหลัง: ${selectedNovel?.era || "ไม่ระบุ"}
- เรื่องย่อเดิม: ${selectedNovel?.synopsis || "ไม่มี"}

ตัวอย่างเนื้อหาช่วงต้นเรื่อง:
"""
${sample || "(ยังไม่มีเนื้อหา ใช้ข้อมูลด้านบนเป็นหลัก)"}
"""

จงสร้างผลลัพธ์ตามนี้ (ภาษาไทยทั้งหมด เหมาะกับนักอ่านบน ${platform}):
- synopsis_short: เรื่องย่อสั้น 1-2 ประโยค (ดึงดูดทันที)
- synopsis_medium: เรื่องย่อกลาง 3-5 ประโยค
- synopsis_long: เรื่องย่อยาว 1-2 ย่อหน้า (เห็นภาพปม ตัวละคร เดิมพัน โดยไม่สปอยล์ตอนจบ)
- hook: คำโปรยดึงดูด/แคปชั่นเปิดตัว สั้นเร้าใจ ชวนกดอ่าน (1-3 บรรทัด)
- tags: รายการแท็ก/หมวดหมู่ที่เหมาะ 8-12 แท็ก (คำสั้นๆ ตรงแนวและกลุ่มผู้อ่าน ${platform})`;

      const result = await invokeAIStable({
        prompt,
        model: "claude_sonnet_4_6",
        response_json_schema: {
          type: "object",
          properties: {
            synopsis_short: { type: "string" },
            synopsis_medium: { type: "string" },
            synopsis_long: { type: "string" },
            hook: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
          },
        },
      });

      const parsed = typeof result === "string" ? JSON.parse(result) : result;
      const data = parsed?.response ?? parsed?.output ?? parsed;
      if (!data?.synopsis_short && !data?.hook) throw new Error("ไม่สามารถสร้างชุดข้อความได้");
      setKit({ ...data, tags: Array.isArray(data.tags) ? data.tags : [] });
      toast.success("สร้างชุดประกาศสำเร็จ");
    } catch (e) {
      toast.error("สร้างไม่สำเร็จ: " + (e.message || ""));
    } finally {
      setGenerating(false);
    }
  };

  const Block = ({ label, value, k }) => (
    <div className="rounded-xl border border-border/60 bg-background p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" />{label}</span>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => copy(value, k)}>
          {copiedKey === k ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          {copiedKey === k ? "คัดลอกแล้ว" : "คัดลอก"}
        </Button>
      </div>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{value}</p>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" />ชุดข้อความประกาศลงแพลตฟอร์ม
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-4">
          <div className="bg-secondary/40 rounded-xl border border-border/50 p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">เลือกนิยาย</label>
                <Select value={novelId} onValueChange={setNovelId}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="เลือกนิยาย" /></SelectTrigger>
                  <SelectContent>{novels.map((n) => <SelectItem key={n.id} value={n.id}>{n.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">แพลตฟอร์มปลายทาง</label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full gap-2 h-11" onClick={handleGenerate} disabled={generating || !novelId}>
              {generating ? <><Loader2 className="w-4 h-4 animate-spin" />กำลังสร้างชุดประกาศ...</> : <><Sparkles className="w-4 h-4" />สร้างชุดข้อความ</>}
            </Button>
          </div>

          {kit && (
            <div className="space-y-3">
              {kit.hook && <Block label="คำโปรยดึงดูด" value={kit.hook} k="hook" />}
              {kit.synopsis_short && <Block label="เรื่องย่อสั้น" value={kit.synopsis_short} k="short" />}
              {kit.synopsis_medium && <Block label="เรื่องย่อกลาง" value={kit.synopsis_medium} k="medium" />}
              {kit.synopsis_long && <Block label="เรื่องย่อยาว" value={kit.synopsis_long} k="long" />}
              {kit.tags?.length > 0 && (
                <div className="rounded-xl border border-border/60 bg-background p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" />แท็ก / หมวดหมู่</span>
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => copy(kit.tags.join(", "), "tags")}>
                      {copiedKey === "tags" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedKey === "tags" ? "คัดลอกแล้ว" : "คัดลอกทั้งหมด"}
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {kit.tags.map((t, i) => <Badge key={i} variant="secondary" className="font-normal">#{t}</Badge>)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}