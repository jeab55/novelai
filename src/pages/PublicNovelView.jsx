import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useParams } from "react-router-dom";
import { Feather, BookOpen, ChevronDown, ChevronUp, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ProseContent from "@/components/novel/ProseContent";
import ReadingSettingsPanel from "@/components/novel/ReadingSettingsPanel";
import { useReadingSettings } from "@/hooks/useReadingSettings";

export default function PublicNovelView() {
  const { token } = useParams();
  const [novel, setNovel] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openChapters, setOpenChapters] = useState({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { settings, update, fontSizePx, fontCss, FONT_SIZES, LINE_HEIGHTS, FONT_FAMILIES } = useReadingSettings();

  useEffect(() => {
    async function load() {
      const all = await base44.entities.Novel.list();
      const found = all.find((n) => n.public_token === token && !n.is_deleted);
      if (!found) { setLoading(false); return; }
      setNovel(found);
      const chs = await base44.entities.Chapter.filter({ novel_id: found.id }, "order");
      setChapters(chs.filter((c) => c.status === "เผยแพร่"));
      setLoading(false);
    }
    load();
  }, [token]);

  const toggle = (id) => setOpenChapters((prev) => ({ ...prev, [id]: !prev[id] }));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!novel) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-3">
        <BookOpen className="w-12 h-12 text-muted-foreground/40" />
        <p className="text-muted-foreground text-center">ไม่พบลิงก์นี้ หรืออาจถูกปิดการเข้าถึงแล้ว</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/60 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Feather className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-heading font-bold text-base truncate">{novel.title}</h1>
            <p className="text-xs text-muted-foreground">อ่านอย่างเดียว</p>
          </div>
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              settingsOpen
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            ตั้งค่าการอ่าน
          </button>
        </div>
        {settingsOpen && (
          <div className="border-t border-border/40">
            <div className="max-w-3xl mx-auto">
              <ReadingSettingsPanel
                settings={settings}
                update={update}
                FONT_SIZES={FONT_SIZES}
                LINE_HEIGHTS={LINE_HEIGHTS}
                FONT_FAMILIES={FONT_FAMILIES}
              />
            </div>
          </div>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        {/* Novel info */}
        <div className="mb-10">
          {novel.genre && (
            <Badge className="mb-3 text-xs bg-amber-100 text-amber-700 border-0">{novel.genre}</Badge>
          )}
          <h2
            className="font-heading font-bold mb-2"
            style={{ fontSize: `${fontSizePx + 6}px` }}
          >
            {novel.title}
          </h2>
          {novel.era && (
            <p className="text-sm text-primary/70 font-medium mb-3">{novel.era}</p>
          )}
          {novel.synopsis && (
            <p
              className="text-muted-foreground border-l-2 border-primary/25 pl-4"
              style={{ fontFamily: fontCss, fontSize: `${fontSizePx - 1}px`, lineHeight: settings.lineHeight }}
            >
              {novel.synopsis}
            </p>
          )}
        </div>

        {/* Chapters */}
        <h3 className="font-heading font-semibold text-base mb-5 text-muted-foreground uppercase tracking-wide text-xs">
          ตอนทั้งหมด · {chapters.length} ตอน
        </h3>
        {chapters.length === 0 ? (
          <p className="text-muted-foreground text-sm italic">ยังไม่มีตอนที่เผยแพร่</p>
        ) : (
          <div className="space-y-4">
            {chapters.map((ch) => (
              <div key={ch.id} className="border border-border/60 rounded-2xl overflow-hidden bg-card shadow-sm">
                <button
                  className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-muted/30 transition-colors"
                  onClick={() => toggle(ch.id)}
                >
                  <div>
                    <span className="text-xs text-muted-foreground block mb-0.5">
                      {ch.order != null ? `ตอนที่ ${ch.order}` : ""}
                    </span>
                    <span className="font-heading font-semibold" style={{ fontSize: `${fontSizePx}px` }}>
                      {ch.title}
                    </span>
                  </div>
                  {openChapters[ch.id]
                    ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  }
                </button>
                {openChapters[ch.id] && (
                  <div className="px-6 pb-8 pt-4 border-t border-border/40">
                    <ProseContent
                      content={ch.content}
                      fontSizePx={fontSizePx}
                      fontCss={fontCss}
                      lineHeight={settings.lineHeight}
                      maxWidth={620}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}