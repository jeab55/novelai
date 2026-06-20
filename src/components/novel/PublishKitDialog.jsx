import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Megaphone, Loader2, Sparkles, Copy, Check, Tag, FileText, Save, X } from "lucide-react";
import { toast } from "sonner";
import { invokeAIStable } from "@/lib/aiInvoke";

const PLATFORMS = ["เด็กดี (Dek-D)", "ธัญวลัย (Tunwalai)", "ReadAWrite", "จอยลดา (Joylada)"];

const emptyKit = { hook: "", synopsis_short: "", synopsis_medium: "", synopsis_long: "", tags: [] };

export default function PublishKitDialog({ open, onClose, novels = [] }) {
  const [novelId, setNovelId] = useState("");
  const [platform, setPlatform] = useState(PLATFORMS[0]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [kit, setKit] = useState(null);
  const [tagInput, setTagInput] = useState("");
  const [copiedKey, setCopiedKey] = useState("");
  const queryClient = useQueryClient();

  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters-for-publishkit", novelId],
    queryFn: async () => {
      const list = await base44.entities.Chapter.filter({ novel_id: novelId });
      return list.filter((c) => !c.is_deleted).sort((a, b) => (a.order || 0) - (b.order || 0));
    },
    enabled: open && !!novelId,
  });

  const selectedNovel = novels.find((n) => n.id === novelId);

  // โหลดค่าที่บันทึกไว้เมื่อเลือกนิยาย
  useEffect(() => {
    if (!selectedNovel) { setKit(null); return; }
    const hasSaved =
      selectedNovel.synopsis_short || selectedNovel.synopsis_medium ||
      selectedNovel.synopsis_long || selectedNovel.publish_hook ||
      (selectedNovel.publish_tags?.length > 0);
    if (hasSaved) {
      setKit({
        hook: selectedNovel.publish_hook || "",
        synopsis_short: selectedNovel.synopsis_short || "",
        synopsis_medium: selectedNovel.synopsis_medium || "",
        synopsis_long: selectedNovel.synopsis_long || "",
        tags: Array.isArray(selectedNovel.publish_tags) ? selectedNovel.publish_tags : [],
      });
    } else {
      setKit(null);
    }
  }, [novelId]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => {
    setNovelId(""); setPlatform(PLATFORMS[0]); setKit(null); setCopiedKey(""); setTagInput("");
  };
  const handleClose = () => {
    if (generating || saving) return;
    reset();
    onClose();
  };

  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("คัดลอกแล้ว");
    setTimeout(() => setCopiedKey(""), 1500);
  };

  const updateField = (k, v) => setKit((prev) => ({ ...(prev || emptyKit), [k]: v }));
  const removeTag = (i) => setKit((prev) => ({ ...prev, tags: prev.tags.filter((_, idx) => idx !== i) }));
  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, "");
    if (!t) return;
    setKit((prev) => ({ ...(prev || emptyKit), tags: [...((prev || emptyKit).tags || []), t] }));
    setTagInput("");
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
      setKit({ ...emptyKit, ...data, tags: Array.isArray(data.tags) ? data.tags : [] });
      toast.success("สร้างชุดประกาศสำเร็จ");
    } catch (e) {
      toast.error("สร้างไม่สำเร็จ: " + (e.message || ""));
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!novelId || !kit) return;
    setSaving(true);
    try {
      await base44.entities.Novel.update(novelId, {
        synopsis_short: kit.synopsis_short || "",
        synopsis_medium: kit.synopsis_medium || "",
        synopsis_long: kit.synopsis_long || "",
        publish_hook: kit.hook || "",
        publish_tags: Array.isArray(kit.tags) ? kit.tags : [],
      });
      await queryClient.invalidateQueries({ queryKey: ["novels"] });
      toast.success("บันทึกลงเล่มเรียบร้อยแล้ว");
    } catch (e) {
      toast.error("บันทึกไม่สำเร็จ: " + (e.message || ""));
    } finally {
      setSaving(false);
    }
  };

  const EditBlock = ({ label, value, k, long }) => (
    <div className="rounded-xl border border-border/60 bg-background p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" />{label}</span>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => copy(value, k)} disabled={!value}>
          {copiedKey === k ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          {copiedKey === k ? "คัดลอกแล้ว" : "คัดลอก"}
        </Button>
      </div>
      <Textarea
        value={value}
        onChange={(e) => updateField(k === "short" ? "synopsis_short" : k === "medium" ? "synopsis_medium" : k === "long" ? "synopsis_long" : "hook", e.target.value)}
        rows={long ? 5 : 2}
        className="text-sm leading-relaxed resize-y"
        placeholder={`แก้ไข${label}ได้ที่นี่`}
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-2xl max-h-[90vh] flex flex-col">
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
              {generating ? <><Loader2 className="w-4 h-4 animate-spin" />กำลังสร้างชุดประกาศ...</> : <><Sparkles className="w-4 h-4" />{kit ? "สร้างใหม่อีกครั้ง" : "สร้างชุดข้อความ"}</>}
            </Button>
          </div>

          {kit && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">แก้ไขข้อความได้ตามต้องการก่อนบันทึกลงเล่ม</p>
              <EditBlock label="คำโปรยดึงดูด" value={kit.hook} k="hook" />
              <EditBlock label="เรื่องย่อสั้น" value={kit.synopsis_short} k="short" />
              <EditBlock label="เรื่องย่อกลาง" value={kit.synopsis_medium} k="medium" />
              <EditBlock label="เรื่องย่อยาว" value={kit.synopsis_long} k="long" long />

              <div className="rounded-xl border border-border/60 bg-background p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" />แท็ก / หมวดหมู่</span>
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => copy((kit.tags || []).join(", "), "tags")} disabled={!kit.tags?.length}>
                    {copiedKey === "tags" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedKey === "tags" ? "คัดลอกแล้ว" : "คัดลอกทั้งหมด"}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {(kit.tags || []).map((t, i) => (
                    <Badge key={i} variant="secondary" className="font-normal gap-1 pr-1">
                      #{t}
                      <button onClick={() => removeTag(i)} className="hover:text-destructive"><X className="w-3 h-3" /></button>
                    </Badge>
                  ))}
                  {(!kit.tags || kit.tags.length === 0) && <span className="text-xs text-muted-foreground">ยังไม่มีแท็ก</span>}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                    placeholder="เพิ่มแท็ก แล้วกด Enter"
                    className="h-8 text-sm"
                  />
                  <Button variant="outline" size="sm" className="h-8" onClick={addTag}>เพิ่ม</Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {kit && (
          <div className="pt-3 border-t border-border/50">
            <Button className="w-full gap-2 h-11" onClick={handleSave} disabled={saving || generating}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" />กำลังบันทึก...</> : <><Save className="w-4 h-4" />บันทึกลงเล่ม</>}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}