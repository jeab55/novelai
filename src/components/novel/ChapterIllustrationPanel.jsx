import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { X, Image, Sparkles, Loader2, Trash2, RefreshCw, AlertTriangle, ExternalLink, Settings, Pencil, Check } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const STYLES = [
  { id: "anime", label: "อนิเมะ", emoji: "🎌" },
  { id: "photorealistic", label: "สมจริง", emoji: "📷" },
  { id: "watercolor", label: "สีน้ำ", emoji: "🎨" },
  { id: "digital_art", label: "ดิจิทัล", emoji: "💻" },
  { id: "thai_contemporary", label: "ไทยประยุกต์", emoji: "🏮" },
  { id: "chinese_historical", label: "จีนย้อนยุค", emoji: "🏯" },
];

// Step: "input" → "reviewPrompt" → "generating" → done (แสดงภาพ)
export default function ChapterIllustrationPanel({ chapter, novel, novelId, onClose }) {
  const [selectedStyle, setSelectedStyle] = useState("anime");
  const [hint, setHint] = useState("");
  const [step, setStep] = useState("input"); // input | reviewPrompt | generating
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [editedPrompt, setEditedPrompt] = useState("");
  const [buildingPrompt, setBuildingPrompt] = useState(false);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const queryClient = useQueryClient();

  const { data: characters = [] } = useQuery({
    queryKey: ["characters", novelId],
    queryFn: async () => {
      const all = await base44.entities.Character.filter({ novel_id: novelId });
      return all.filter((c) => !c.is_deleted);
    },
  });

  const illustrationUrls = chapter.illustration_urls || [];

  // ขั้น 1: AI เขียน prompt จากบริบท
  const handleBuildPrompt = async () => {
    setBuildingPrompt(true);
    setError(null);

    const mainChars = characters.filter((c) => c.role === "ตัวเอก" || c.role === "ตัวรอง");
    const res = await base44.functions.invoke("getChapterIllustration", {
      action: "generatePrompt",
      hint: hint.trim(),
      chapterTitle: chapter.title,
      chapterContent: chapter.content || "",
      novelTitle: novel?.title || "",
      novelEra: novel?.era || "",
      characters: mainChars.map((c) => ({ name: c.name, role: c.role, appearance: c.appearance })),
      style: selectedStyle,
    });

    setBuildingPrompt(false);

    if (res.data?.error) { setError(res.data.error); return; }
    if (res.data?.prompt) {
      setGeneratedPrompt(res.data.prompt);
      setEditedPrompt(res.data.prompt);
      setStep("reviewPrompt");
    }
  };

  // ขั้น 2: ส่ง prompt สร้างภาพจริง
  const handleGenerateImage = async () => {
    setStep("generating");
    setError(null);

    const res = await base44.functions.invoke("getChapterIllustration", {
      action: "generateImage",
      prompt: editedPrompt,
    });

    if (res.data?.error) {
      setError(res.data.error);
      setStep("reviewPrompt");
      return;
    }

    if (res.data?.url) {
      const newUrls = [...illustrationUrls, res.data.url];
      await base44.entities.Chapter.update(chapter.id, { illustration_urls: newUrls });
      queryClient.invalidateQueries({ queryKey: ["chapters", novelId] });
      setPreviewUrl(res.data.url);
      setStep("input");
      toast.success("สร้างภาพประกอบสำเร็จ!");
    }
  };

  const handleDelete = async (urlToDelete) => {
    const newUrls = illustrationUrls.filter((u) => u !== urlToDelete);
    await base44.entities.Chapter.update(chapter.id, { illustration_urls: newUrls });
    queryClient.invalidateQueries({ queryKey: ["chapters", novelId] });
    toast.success("ลบภาพแล้ว");
  };

  const handleReset = () => { setStep("input"); setError(null); };

  return (
    <div className="border-b border-border/60 bg-card/30">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40">
        <Image className="w-3.5 h-3.5 text-violet-600" />
        <span className="text-xs font-semibold text-violet-700">ภาพประกอบ AI</span>
        {illustrationUrls.length > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-600 font-medium">
            {illustrationUrls.length} ภาพ
          </span>
        )}
        <Button variant="ghost" size="icon" className="ml-auto h-6 w-6 text-muted-foreground" onClick={onClose}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      <ScrollArea className="max-h-[32rem]">
        <div className="px-4 py-3 space-y-3">

          {/* ─── STEP: input ─── */}
          {step === "input" && (
            <>
              {/* Style selector */}
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground mb-2">เลือกสไตล์ภาพ</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {STYLES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedStyle(s.id)}
                      className={`flex flex-col items-start px-2.5 py-2 rounded-lg border text-left transition-all ${
                        selectedStyle === s.id
                          ? "border-violet-400 bg-violet-50 text-violet-800"
                          : "border-border/60 hover:border-violet-200 hover:bg-violet-50/40 text-foreground"
                      }`}
                    >
                      <span className="text-base mb-0.5">{s.emoji}</span>
                      <span className="text-[11px] font-medium leading-tight">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Hint input */}
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">
                  คำใบ้สั้นๆ <span className="font-normal">(ไม่บังคับ)</span>
                </p>
                <Textarea
                  value={hint}
                  onChange={(e) => setHint(e.target.value)}
                  placeholder="เช่น: ฉากที่ใสยื่นซาลาเปาให้เทียนกลางสายฝน&#10;หรือเว้นว่างไว้ให้ AI เลือกฉากเด่นเอง"
                  className="resize-none text-xs h-16 leading-relaxed"
                  maxLength={200}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  AI จะใช้บริบทตัวละคร ยุคสมัย และเนื้อหาตอนนี้เขียน prompt ต่อให้เอง
                </p>
              </div>

              {/* Error */}
              {error && <ErrorBox error={error} />}

              {/* Build prompt button */}
              <Button
                className="w-full gap-2 bg-violet-600 hover:bg-violet-700 text-white h-9"
                onClick={handleBuildPrompt}
                disabled={buildingPrompt}
              >
                {buildingPrompt ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" />AI กำลังเขียน prompt...</>
                ) : (
                  <><Sparkles className="w-3.5 h-3.5" />ให้ AI สร้าง prompt →</>
                )}
              </Button>
            </>
          )}

          {/* ─── STEP: reviewPrompt ─── */}
          {step === "reviewPrompt" && (
            <>
              <div className="flex items-center gap-2">
                <Pencil className="w-3.5 h-3.5 text-violet-600" />
                <p className="text-[11px] font-semibold text-violet-700">ตรวจสอบ / แก้ไข Prompt</p>
                <button onClick={handleReset} className="ml-auto text-[10px] text-muted-foreground hover:text-foreground underline">
                  ← กลับ
                </button>
              </div>

              <Textarea
                value={editedPrompt}
                onChange={(e) => setEditedPrompt(e.target.value)}
                className="resize-none text-xs h-36 leading-relaxed font-mono"
                placeholder="AI-generated prompt..."
              />
              <p className="text-[10px] text-muted-foreground -mt-1">
                แก้ไขได้ตามต้องการก่อนกดสร้างภาพ
              </p>

              {error && <ErrorBox error={error} />}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-1.5 h-9 text-xs"
                  onClick={handleBuildPrompt}
                  disabled={buildingPrompt}
                >
                  {buildingPrompt
                    ? <><Loader2 className="w-3 h-3 animate-spin" />กำลังเขียนใหม่...</>
                    : <><RefreshCw className="w-3 h-3" />เขียน prompt ใหม่</>
                  }
                </Button>
                <Button
                  className="flex-1 gap-1.5 h-9 text-xs bg-violet-600 hover:bg-violet-700 text-white"
                  onClick={handleGenerateImage}
                  disabled={!editedPrompt.trim()}
                >
                  <Check className="w-3 h-3" />
                  สร้างภาพ!
                </Button>
              </div>
            </>
          )}

          {/* ─── STEP: generating ─── */}
          {step === "generating" && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Loader2 className="w-7 h-7 text-violet-500 animate-spin" />
              <p className="text-sm font-medium">กำลังสร้างภาพ...</p>
              <p className="text-xs text-muted-foreground">DALL·E 3 อาจใช้เวลา 15–30 วินาที</p>
            </div>
          )}

          {/* ─── Existing illustrations (แสดงทุก step) ─── */}
          {illustrationUrls.length > 0 && step !== "generating" && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground mb-2 pt-1 border-t border-border/40">ภาพที่สร้างแล้ว</p>
              <div className="grid grid-cols-2 gap-2">
                {illustrationUrls.map((url, idx) => (
                  <div key={idx} className="relative group rounded-lg overflow-hidden border border-border/60 bg-muted/30">
                    <img src={url} alt={`ภาพประกอบ ${idx + 1}`} className="w-full aspect-square object-cover" loading="lazy" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <a href={url} target="_blank" rel="noopener noreferrer"
                        className="p-1.5 rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button onClick={() => handleDelete(url)}
                        className="p-1.5 rounded-full bg-red-500/70 hover:bg-red-500 text-white transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="absolute bottom-1 left-1 text-[10px] text-white/70 bg-black/40 px-1.5 py-0.5 rounded">#{idx + 1}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </ScrollArea>

      {/* Preview dialog (ภาพที่เพิ่งสร้าง) */}
      {previewUrl && (
        <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-heading flex items-center gap-2">
                <Image className="w-4 h-4 text-violet-600" />ภาพประกอบใหม่
              </DialogTitle>
            </DialogHeader>
            <img src={previewUrl} alt="ภาพประกอบ AI" className="w-full rounded-lg" />
            <div className="flex gap-2">
              <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                <Button variant="outline" className="w-full gap-2">
                  <ExternalLink className="w-3.5 h-3.5" />เปิดขนาดเต็ม
                </Button>
              </a>
              <Button className="flex-1 gap-2" onClick={() => { setPreviewUrl(null); setStep("input"); }}>
                <Sparkles className="w-3.5 h-3.5" />สร้างอีกภาพ
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function ErrorBox({ error }) {
  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      <div className="flex-1">
        <p>{error}</p>
        {error.includes("ตั้งค่า") && (
          <Link to="/settings" className="inline-flex items-center gap-1 mt-1 underline text-red-600 font-medium">
            <Settings className="w-3 h-3" />ไปหน้าตั้งค่า OpenAI API key
          </Link>
        )}
      </div>
    </div>
  );
}