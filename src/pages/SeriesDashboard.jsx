import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Layers, FileEdit, ChevronDown, ChevronUp, MoreVertical, ImagePlus, FolderOpen } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/lib/AuthContext";

const genreColors = {
  "โรแมนติก": "from-pink-400 to-rose-500",
  "แฟนตาซี": "from-purple-400 to-indigo-500",
  "อิงประวัติศาสตร์": "from-amber-400 to-orange-500",
  "จีนย้อนยุค": "from-red-400 to-rose-600",
  "วาย": "from-sky-400 to-blue-500",
  "สยองขวัญ": "from-slate-500 to-gray-700",
  "ลึกลับ": "from-indigo-400 to-violet-600",
  "แอ็คชั่น": "from-orange-400 to-red-500",
  "ดราม่า": "from-teal-400 to-cyan-600",
  "อื่นๆ": "from-gray-400 to-slate-500",
};

function NovelCard({ novel, chapters, uploadingFor, onUploadClick }) {
  const [isOpen, setIsOpen] = useState(false);
  const gradient = genreColors[novel.genre] || "from-gray-400 to-slate-500";
  const novelChapters = chapters
    .filter((c) => String(c.novel_id) === String(novel.id) && !c.is_deleted)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <div
      className={`bg-card border rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer flex flex-col ${
        isOpen ? "border-primary/50 ring-2 ring-primary/20 shadow-lg" : "border-border/60 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/25"
      }`}
      onClick={() => setIsOpen((v) => !v)}
    >
      {/* Cover */}
      <div className="relative h-44 overflow-hidden">
        {novel.cover_url ? (
          <img src={novel.cover_url} alt={novel.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
            <BookOpen className="w-12 h-12 text-white/60" />
          </div>
        )}
        {/* 3-dot menu */}
        <div className="absolute top-2 left-2" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-7 h-7 rounded-lg bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors">
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => onUploadClick(novel.id)}>
                <ImagePlus className="w-4 h-4" />
                {uploadingFor === novel.id ? "กำลังอัปโหลด..." : "เปลี่ยนรูปปก"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {novel.genre && (
          <div className="absolute bottom-3 left-3">
            <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-black/40 text-white backdrop-blur-sm">
              {novel.genre}
            </span>
          </div>
        )}
        <div className="absolute top-3 right-3">
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border backdrop-blur-sm bg-white/90 text-primary border-primary/20">
            {novelChapters.length} ตอน
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-heading font-bold text-base leading-tight mb-2 line-clamp-2 flex-1">{novel.title}</h3>
          {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />}
        </div>
        {novel.synopsis && !isOpen && (
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed flex-1">{novel.synopsis}</p>
        )}
        <div className="mt-4 pt-4 border-t border-border/40 flex items-center justify-between">
          <Badge variant="outline" className="text-xs font-normal">{novel.status || "กำลังเขียน"}</Badge>
          <span className="text-xs text-muted-foreground">{new Date(novel.created_date).toLocaleDateString("th-TH")}</span>
        </div>
      </div>

      {/* Episode list */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="eps"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-t border-border/40 px-4 pb-4 pt-2 space-y-1 bg-muted/20">
              {novelChapters.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-xs text-muted-foreground mb-2">ยังไม่มีตอน</p>
                  <Link to={`/novel/${novel.id}`}>
                    <Button size="sm" variant="outline" className="text-xs h-7">เพิ่มตอนแรก</Button>
                  </Link>
                </div>
              ) : (
                <>
                  {novelChapters.map((ch, idx) => (
                    <Link
                      key={ch.id}
                      to={`/novel/${novel.id}`}
                      className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-accent/60 transition-colors group"
                    >
                      <span className="w-6 h-6 rounded-md bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                        {ch.order || idx + 1}
                      </span>
                      <span className="flex-1 text-sm truncate">{ch.title}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium border shrink-0 ${
                        ch.status === "เผยแพร่"
                          ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                          : "bg-muted text-muted-foreground border-border"
                      }`}>
                        {ch.status || "ร่าง"}
                      </span>
                    </Link>
                  ))}
                  <div className="pt-2">
                    <Link to={`/novel/${novel.id}`}>
                      <Button size="sm" variant="ghost" className="w-full text-xs h-7 gap-1.5 text-muted-foreground">
                        <FileEdit className="w-3 h-3" />
                        เปิดหน้าเขียน
                      </Button>
                    </Link>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SeriesDashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const queryClient = useQueryClient();
  const coverInputRef = useRef(null);
  const [uploadingFor, setUploadingFor] = useState(null);

  const { data: novels = [], isLoading } = useQuery({
    queryKey: ["novels-for-series", user?.id],
    queryFn: async () => {
      const all = await base44.entities.Novel.list("-created_date");
      return all.filter((n) => {
        if (n.is_deleted) return false;
        if (isAdmin) return true;
        if (String(n.created_by_id) === String(user?.id)) return true;
        if (Array.isArray(n.shared_with) && n.shared_with.includes(user?.email)) return true;
        return false;
      });
    },
    enabled: !!user,
  });

  const { data: seriesList = [] } = useQuery({
    queryKey: ["series-list"],
    queryFn: () => base44.entities.Series.list(),
  });

  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters-all"],
    queryFn: () => base44.entities.Chapter.list(),
  });

  const handleCoverUpload = async (novelId, file) => {
    if (!file) return;
    setUploadingFor(novelId);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.Novel.update(novelId, { cover_url: file_url });
    queryClient.invalidateQueries({ queryKey: ["novels-for-series"] });
    setUploadingFor(null);
  };

  const handleUploadClick = (novelId) => {
    coverInputRef.current.dataset.novelid = novelId;
    coverInputRef.current.click();
  };

  // จัดกลุ่มนิยายตาม series
  const novelsInSeries = novels.filter((n) => n.series_id);
  const novelsWithoutSeries = novels.filter((n) => !n.series_id);

  // map series_id -> novels
  const novelsBySeries = seriesList
    .map((s) => ({
      series: s,
      novels: novelsInSeries.filter((n) => String(n.series_id) === String(s.id)),
    }))
    .filter((g) => g.novels.length > 0);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-heading font-bold text-2xl text-foreground tracking-tight">งานของฉัน</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {novels.length > 0 ? `${novels.length} เรื่อง` : "ยังไม่มีนิยาย"}
            </p>
          </div>
          <Link to="/">
            <Button variant="outline" className="gap-2">
              <BookOpen className="w-4 h-4" />
              จัดการนิยาย
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : novels.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-24">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/10 to-accent/30 flex items-center justify-center mx-auto mb-6 shadow-inner">
              <Layers className="w-12 h-12 text-primary/50" />
            </div>
            <h2 className="text-2xl font-heading font-semibold mb-3">ยังไม่มีนิยาย</h2>
            <p className="text-muted-foreground mb-8 max-w-sm mx-auto leading-relaxed">
              สร้างนิยายในหน้าหลักก่อน แล้วจัดการตอนได้ที่นี่
            </p>
            <Link to="/">
              <Button className="gap-2 h-11 px-6 text-base shadow-sm">
                <BookOpen className="w-4 h-4" />
                ไปหน้านิยาย
              </Button>
            </Link>
          </motion.div>
        ) : (
          <div className="space-y-10">
            {/* กลุ่มที่มี Series */}
            {novelsBySeries.map(({ series, novels: sNovels }, si) => (
              <motion.div key={series.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: si * 0.06 }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FolderOpen className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-lg text-foreground">{series.title}</h3>
                    {series.description && <p className="text-xs text-muted-foreground">{series.description}</p>}
                  </div>
                  <Badge variant="outline" className="ml-auto text-xs">{sNovels.length} เรื่อง</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {sNovels.map((novel) => (
                    <NovelCard
                      key={novel.id}
                      novel={novel}
                      chapters={chapters}
                      uploadingFor={uploadingFor}
                      onUploadClick={handleUploadClick}
                    />
                  ))}
                </div>
              </motion.div>
            ))}

            {/* นิยายที่ไม่มี Series */}
            {novelsWithoutSeries.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: novelsBySeries.length * 0.06 }}>
                {novelsBySeries.length > 0 && (
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                      <BookOpen className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <h3 className="font-heading font-bold text-lg text-foreground">ไม่ระบุซีรีย์</h3>
                    <Badge variant="outline" className="ml-auto text-xs">{novelsWithoutSeries.length} เรื่อง</Badge>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {novelsWithoutSeries.map((novel) => (
                    <NovelCard
                      key={novel.id}
                      novel={novel}
                      chapters={chapters}
                      uploadingFor={uploadingFor}
                      onUploadClick={handleUploadClick}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>

      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const novelId = e.target.dataset.novelid;
          if (file && novelId) handleCoverUpload(novelId, file);
          e.target.value = "";
        }}
      />
    </AppLayout>
  );
}