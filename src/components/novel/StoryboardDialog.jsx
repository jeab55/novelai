import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Clapperboard, Loader2, Sparkles, FileText, Table, Film, Save, Library } from "lucide-react";
import { toast } from "sonner";
import { invokeAIStable } from "@/lib/aiInvoke";
import StoryboardSceneEditor from "@/components/novel/StoryboardSceneEditor";
import SavedStoryboardLibrary from "@/components/novel/SavedStoryboardLibrary";
import { storyboardToText, storyboardToCsv, downloadFile } from "@/lib/storyboardExport";

const DURATIONS = [
  { value: 30, label: "30 วินาที (สั้นมาก)" },
  { value: 60, label: "60 วินาที" },
  { value: 90, label: "90 วินาที" },
  { value: 180, label: "3 นาที" },
  { value: 300, label: "5 นาที" },
];
const PLATFORMS = [
  { value: "YouTube แนวนอน (16:9)", label: "YouTube — แนวนอน 16:9" },
  { value: "TikTok/Reels แนวตั้ง (9:16)", label: "TikTok / Reels — แนวตั้ง 9:16" },
];
const TONES = ["ดราม่าเข้มข้น", "อบอุ่นซึ้งกินใจ", "ลึกลับชวนติดตาม", "สนุกสดใส", "ตื่นเต้นเร้าใจ", "สารคดี/บรรยาย"];

export default function StoryboardDialog({ open, onClose, novels = [] }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("create");
  const [novelId, setNovelId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [duration, setDuration] = useState(60);
  const [platform, setPlatform] = useState(PLATFORMS[1].value);
  const [tone, setTone] = useState("ดราม่าเข้มข้น");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scenes, setScenes] = useState([]);
  const [meta, setMeta] = useState(null);
  const [savedId, setSavedId] = useState(null);

  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters-for-storyboard", novelId],
    queryFn: async () => {
      const list = await base44.entities.Chapter.filter({ novel_id: novelId });
      return list.filter((c) => !c.is_deleted).sort((a, b) => (a.order || 0) - (b.order || 0));
    },
    enabled: open && !!novelId,
  });

  const selectedNovel = novels.find((n) => n.id === novelId);

  const reset = () => {
    setTab("create");
    setNovelId(""); setChapterId(""); setDuration(60);
    setPlatform(PLATFORMS[1].value); setTone("ดราม่าเข้มข้น");
    setScenes([]); setMeta(null); setSavedId(null);
  };

  const handleClose = () => {
    if (generating || saving) return;
    reset();
    onClose();
  };

  const updateScene = (index, newScene) => {
    setScenes((prev) => prev.map((s, i) => (i === index ? newScene : s)));
  };

  const handleGenerate = async () => {
    if (!novelId) {
      toast.error("กรุณาเลือกนิยาย");
      return;
    }
    setGenerating(true);
    try {
      let sourceText = "";
      let sourceTitle = selectedNovel?.title || "";
      if (chapterId) {
        const ch = chapters.find((c) => c.id === chapterId);
        sourceText = ch?.content || "";
        sourceTitle = ch?.title || sourceTitle;
      } else {
        sourceText = chapters.map((c) => `[${c.title}]\n${c.content || ""}`).join("\n\n");
      }
      if (!sourceText.trim()) {
        toast.error("นิยาย/ตอนนี้ยังไม่มีเนื้อหา");
        setGenerating(false);
        return;
      }

      const aspect = platform.includes("9:16") ? "แนวตั้ง 9:16" : "แนวนอน 16:9";
      const prompt = `คุณคือผู้กำกับและนักเขียนสคริปต์วิดีโอมืออาชีพ จงแปลงเนื้อหานิยายต่อไปนี้เป็น "สตอรีบอร์ด/สคริปต์วิดีโอ" โดยแบ่งเป็นฉากย่อยอัตโนมัติให้เหมาะกับวิดีโอความยาวประมาณ ${duration} วินาที สำหรับแพลตฟอร์ม ${platform} (ภาพ${aspect}) โทนเรื่อง: ${tone}

[ข้อกำหนดแต่ละฉาก]
- scene_number: เลขฉาก (เริ่มที่ 1)
- duration: ความยาวฉากโดยประมาณเป็นวินาที (รวมทุกฉากให้ใกล้เคียง ${duration} วินาที)
- shot: มุมกล้องและอารมณ์ของฉาก (เช่น "โคลสอัพใบหน้า สีหน้าตื่นตระหนก", "ภาพมุมกว้าง บรรยากาศเศร้า")
- voiceover: คำบรรยาย/บทพากย์สำหรับฉากนั้น (ภาษาไทย กระชับ เหมาะกับเวลา)
- dialogue: บทสนทนาของตัวละคร (ถ้ามี ใส่ชื่อตัวละครนำหน้า; ถ้าไม่มีให้เว้นว่าง "")
- image_prompt: พรอมต์ข้อความภาษาอังกฤษสำหรับนำไปสร้างภาพด้วย AI (บรรยายฉาก ตัวละคร แสง อารมณ์ สไตล์ภาพ — เป็นข้อความเท่านั้น)

แบ่งฉากให้พอเหมาะ (โดยทั่วไป 1 ฉากยาว 3-8 วินาที) เล่าเรื่องต่อเนื่องครบถ้วน

เนื้อหานิยาย "${sourceTitle}":
"""
${sourceText.slice(0, 16000)}
"""`;

      const result = await invokeAIStable({
        prompt,
        model: "claude_sonnet_4_6",
        response_json_schema: {
          type: "object",
          properties: {
            scenes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  scene_number: { type: "number" },
                  duration: { type: "number" },
                  shot: { type: "string" },
                  voiceover: { type: "string" },
                  dialogue: { type: "string" },
                  image_prompt: { type: "string" },
                },
              },
            },
          },
        },
      });

      const parsed = typeof result === "string" ? JSON.parse(result) : result;
      const list = parsed?.scenes || parsed?.response?.scenes || [];
      if (!Array.isArray(list) || list.length === 0) throw new Error("ไม่สามารถสร้างฉากได้");
      setScenes(list);
      setMeta({ title: sourceTitle, platform, duration, tone });
      setSavedId(null);
      toast.success(`สร้างสตอรีบอร์ดสำเร็จ: ${list.length} ฉาก`);
    } catch (e) {
      toast.error("สร้างสตอรีบอร์ดไม่สำเร็จ: " + (e.message || ""));
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (scenes.length === 0) return;
    setSaving(true);
    try {
      const payload = {
        name: meta?.title || selectedNovel?.title || "สตอรีบอร์ด",
        novel_id: novelId || "",
        novel_title: meta?.title || "",
        chapter_id: chapterId || "",
        platform: meta?.platform || platform,
        duration: meta?.duration || duration,
        tone: meta?.tone || tone,
        scenes: JSON.stringify(scenes),
      };
      if (savedId) {
        await base44.entities.StoryboardProject.update(savedId, payload);
        toast.success("บันทึกทับงานเดิมแล้ว");
      } else {
        const created = await base44.entities.StoryboardProject.create(payload);
        setSavedId(created.id);
        toast.success("บันทึกสตอรีบอร์ดลงคลังแล้ว");
      }
      queryClient.invalidateQueries({ queryKey: ["storyboard-projects"] });
    } catch (e) {
      toast.error("บันทึกไม่สำเร็จ: " + (e.message || ""));
    } finally {
      setSaving(false);
    }
  };

  const openProject = (p) => {
    let list = [];
    try { list = JSON.parse(p.scenes || "[]"); } catch { list = []; }
    setScenes(Array.isArray(list) ? list : []);
    setMeta({ title: p.novel_title || p.name, platform: p.platform, duration: p.duration, tone: p.tone });
    setNovelId(p.novel_id || "");
    setChapterId(p.chapter_id || "");
    if (p.platform) setPlatform(p.platform);
    if (p.duration) setDuration(p.duration);
    if (p.tone) setTone(p.tone);
    setSavedId(p.id);
    setTab("create");
  };

  const exportText = () => {
    downloadFile(storyboardToText(scenes, meta), `storyboard-${meta?.title || "video"}.txt`, "text/plain;charset=utf-8");
    toast.success("ดาวน์โหลดไฟล์ข้อความแล้ว");
  };
  const exportCsv = () => {
    downloadFile(storyboardToCsv(scenes), `storyboard-${meta?.title || "video"}.csv`, "text/csv;charset=utf-8");
    toast.success("ดาวน์โหลดไฟล์ตาราง (CSV) แล้ว");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Clapperboard className="w-5 h-5 text-primary" />
            สร้างสตอรีบอร์ด / สคริปต์วิดีโอ
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid grid-cols-2 w-full shrink-0">
            <TabsTrigger value="create" className="gap-1.5"><Sparkles className="w-4 h-4" />สร้าง / แก้ไข</TabsTrigger>
            <TabsTrigger value="library" className="gap-1.5"><Library className="w-4 h-4" />คลังที่บันทึกไว้</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-4 mt-3">
            {/* Settings */}
            <div className="bg-secondary/40 rounded-xl border border-border/50 p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">เลือกนิยาย</label>
                  <Select value={novelId} onValueChange={(v) => { setNovelId(v); setChapterId(""); }}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="เลือกนิยาย" /></SelectTrigger>
                    <SelectContent>{novels.map((n) => <SelectItem key={n.id} value={n.id}>{n.title}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">เลือกตอน (ไม่เลือก = ทั้งเรื่อง)</label>
                  <Select value={chapterId || "all"} onValueChange={(v) => setChapterId(v === "all" ? "" : v)} disabled={!novelId}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="ทั้งเรื่อง" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทั้งเรื่อง ({chapters.length} ตอน)</SelectItem>
                      {chapters.map((c) => <SelectItem key={c.id} value={c.id}>{c.order ? `${c.order}. ` : ""}{c.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">ความยาวคลิป</label>
                  <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{DURATIONS.map((d) => <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">แพลตฟอร์ม</label>
                  <Select value={platform} onValueChange={setPlatform}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">โทนเรื่อง</label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{TONES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <Button className="w-full gap-2 h-11" onClick={handleGenerate} disabled={generating || !novelId}>
                {generating ? <><Loader2 className="w-4 h-4 animate-spin" />กำลังแบ่งฉากและเขียนสคริปต์...</> : <><Sparkles className="w-4 h-4" />สร้างสตอรีบอร์ด</>}
              </Button>
            </div>

            {/* Results */}
            {scenes.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    <Film className="w-4 h-4 text-primary" />{scenes.length} ฉาก · {meta?.platform}
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={handleSave} disabled={saving}>
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      {savedId ? "บันทึกทับ" : "บันทึก"}
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={exportText}>
                      <FileText className="w-3.5 h-3.5" />ข้อความ
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={exportCsv}>
                      <Table className="w-3.5 h-3.5" />ตาราง CSV
                    </Button>
                  </div>
                </div>
                {scenes.map((s, i) => (
                  <StoryboardSceneEditor key={i} scene={s} index={i} onChange={(ns) => updateScene(i, ns)} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="library" className="flex-1 overflow-y-auto min-h-0 pr-1 mt-3">
            <SavedStoryboardLibrary onOpen={openProject} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}