/**
 * ChapterIllustrationPanel
 * สร้างและจัดการภาพประกอบ AI สำหรับแต่ละตอน
 */
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X, Image, Sparkles, Loader2, Trash2, RefreshCw, AlertTriangle, ExternalLink, Settings } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const STYLES = [
  { id: "anime", label: "อนิเมะ / มังงะ", emoji: "🎌", desc: "Anime & Manga style" },
  { id: "photorealistic", label: "สมจริง (Photorealistic)", emoji: "📷", desc: "Cinematic photography" },
  { id: "watercolor", label: "สีน้ำ / วรรณกรรม", emoji: "🎨", desc: "Watercolor illustration" },
  { id: "digital_art", label: "ดิจิทัลอาร์ต", emoji: "💻", desc: "Digital concept art" },
  { id: "thai_contemporary", label: "ไทยประยุกต์", emoji: "🏮", desc: "Thai contemporary art" },
  { id: "chinese_historical", label: "จีนย้อนยุค", emoji: "🏯", desc: "Chinese historical painting" },
];

export default function ChapterIllustrationPanel({ chapter, novel, novelId, onClose }) {
  const [selectedStyle, setSelectedStyle] = useState("anime");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const queryClient = useQueryClient();

  // ดึงตัวละครในนิยาย
  const { data: characters = [] } = useQuery({
    queryKey: ["characters", novelId],
    queryFn: async () => {
      const all = await base44.entities.Character.filter({ novel_id: novelId });
      return all.filter((c) => !c.is_deleted);
    },
  });

  const illustrationUrls = chapter.illustration_urls || [];

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);

    const mainChars = characters.filter((c) => c.role === "ตัวเอก" || c.role === "ตัวรอง").slice(0, 3);

    const res = await base44.functions.invoke("getChapterIllustration", {
      chapterTitle: chapter.title,
      chapterExcerpt: (chapter.content || "").substring(0, 600),
      novelTitle: novel?.title || "",
      novelEra: novel?.era || "",
      characters: mainChars.map((c) => ({ name: c.name, role: c.role, appearance: c.appearance })),
      style: selectedStyle,
    });

    setGenerating(false);

    if (res.data?.error) {
      setError(res.data.error);
      if (res.data.needsSetup) {
        // key ยังไม่ได้ตั้งค่า — จะแสดง link ไปหน้าตั้งค่า
      }
      return;
    }

    if (res.data?.url) {
      // บันทึก URL ใน chapter
      const newUrls = [...illustrationUrls, res.data.url];
      await base44.entities.Chapter.update(chapter.id, { illustration_urls: newUrls });
      queryClient.invalidateQueries({ queryKey: ["chapters", novelId] });
      // อัปเดต local chapter prop ไม่ได้ direct — แต่ queryClient จะ refresh ผ่าน parent
      setPreviewUrl(res.data.url);
      toast.success("สร้างภาพประกอบสำเร็จ!");
    }
  };

  const handleDelete = async (urlToDelete) => {
    const newUrls = illustrationUrls.filter((u) => u !== urlToDelete);
    await base44.entities.Chapter.update(chapter.id, { illustration_urls: newUrls });
    queryClient.invalidateQueries({ queryKey: ["chapters", novelId] });
    toast.success("ลบภาพแล้ว");
  };

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

      <ScrollArea className="max-h-80">
        <div className="px-4 py-3 space-y-3">
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

          {/* Error message */}
          {error && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p>{error}</p>
                {error.includes("ตั้งค่า") && (
                  <Link to="/settings" className="inline-flex items-center gap-1 mt-1 underline text-red-600 font-medium">
                    <Settings className="w-3 h-3" />
                    ไปหน้าตั้งค่า OpenAI API key
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Generate button */}
          <Button
            className="w-full gap-2 bg-violet-600 hover:bg-violet-700 text-white h-9"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                กำลังสร้างภาพ... (อาจใช้เวลา 15-30 วิ)
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                สร้างภาพประกอบ
              </>
            )}
          </Button>

          {/* Existing illustrations */}
          {illustrationUrls.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground mb-2">ภาพที่สร้างแล้ว</p>
              <div className="grid grid-cols-2 gap-2">
                {illustrationUrls.map((url, idx) => (
                  <div key={idx} className="relative group rounded-lg overflow-hidden border border-border/60 bg-muted/30">
                    <img
                      src={url}
                      alt={`ภาพประกอบ ${idx + 1}`}
                      className="w-full aspect-square object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors"
                        title="เปิดภาพขนาดใหญ่"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => handleDelete(url)}
                        className="p-1.5 rounded-full bg-red-500/70 hover:bg-red-500 text-white transition-colors"
                        title="ลบภาพ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="absolute bottom-1 left-1 text-[10px] text-white/70 bg-black/40 px-1.5 py-0.5 rounded">
                      #{idx + 1}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No illustrations yet hint */}
          {illustrationUrls.length === 0 && !generating && !error && (
            <p className="text-xs text-muted-foreground text-center py-2">
              เลือกสไตล์แล้วกด "สร้างภาพประกอบ" เพื่อสร้างภาพ AI สำหรับตอนนี้
            </p>
          )}
        </div>
      </ScrollArea>

      {/* Preview dialog (ภาพที่เพิ่งสร้าง) */}
      {previewUrl && (
        <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-heading flex items-center gap-2">
                <Image className="w-4 h-4 text-violet-600" />
                ภาพประกอบใหม่
              </DialogTitle>
            </DialogHeader>
            <img src={previewUrl} alt="ภาพประกอบ AI" className="w-full rounded-lg" />
            <div className="flex gap-2">
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button variant="outline" className="w-full gap-2">
                  <ExternalLink className="w-3.5 h-3.5" />
                  เปิดขนาดเต็ม
                </Button>
              </a>
              <Button className="flex-1 gap-2" onClick={() => { setPreviewUrl(null); handleGenerate(); }}>
                <RefreshCw className="w-3.5 h-3.5" />
                สร้างใหม่
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}