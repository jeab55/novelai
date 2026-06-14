import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Layers, X, FileEdit, Eye } from "lucide-react";
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

export default function SeriesDashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [selectedNovel, setSelectedNovel] = useState(null);

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

  const { data: episodes = [] } = useQuery({
    queryKey: ["episodes-all"],
    queryFn: () => base44.entities.Episode.list(),
  });

  const getNovelEpisodes = (novelId) =>
    episodes
      .filter((e) => String(e.novel_id) === String(novelId))
      .sort((a, b) => (a.episode_number || 0) - (b.episode_number || 0));

  const getEpisodeCount = (novelId) => getNovelEpisodes(novelId).length;

  const selectedEpisodes = selectedNovel ? getNovelEpisodes(selectedNovel.id) : [];

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
          <div className="flex gap-6">
            {/* Novel grid */}
            <div className={`grid gap-5 transition-all duration-300 ${selectedNovel ? "grid-cols-1 sm:grid-cols-2 flex-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 w-full"}`}>
              {novels.map((novel, i) => {
                const gradient = genreColors[novel.genre] || "from-gray-400 to-slate-500";
                const epCount = getEpisodeCount(novel.id);
                const isSelected = selectedNovel?.id === novel.id;

                return (
                  <motion.div
                    key={novel.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => setSelectedNovel(isSelected ? null : novel)}
                  >
                    <div className={`group bg-card border rounded-2xl overflow-hidden hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 cursor-pointer flex flex-col h-full ${
                      isSelected ? "border-primary/50 ring-2 ring-primary/20 shadow-lg" : "border-border/60 hover:border-primary/25"
                    }`}>
                      <div className="relative h-44 overflow-hidden">
                        {novel.cover_url ? (
                          <img
                            src={novel.cover_url}
                            alt={novel.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                            <BookOpen className="w-12 h-12 text-white/60" />
                          </div>
                        )}
                        {novel.genre && (
                          <div className="absolute bottom-3 left-3">
                            <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-black/40 text-white backdrop-blur-sm">
                              {novel.genre}
                            </span>
                          </div>
                        )}
                        <div className="absolute top-3 right-3">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border backdrop-blur-sm bg-white/90 text-primary border-primary/20">
                            {epCount} ตอน
                          </span>
                        </div>
                      </div>

                      <div className="p-5 flex flex-col flex-1">
                        <h3 className="font-heading font-bold text-base leading-tight group-hover:text-primary transition-colors mb-2 line-clamp-2">
                          {novel.title}
                        </h3>
                        {novel.synopsis && (
                          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed flex-1">
                            {novel.synopsis}
                          </p>
                        )}
                        <div className="mt-4 pt-4 border-t border-border/40 flex items-center justify-between">
                          <Badge variant="outline" className="text-xs font-normal">
                            {novel.status || "กำลังเขียน"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(novel.created_date).toLocaleDateString("th-TH")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Episode panel */}
            <AnimatePresence>
              {selectedNovel && (
                <motion.div
                  initial={{ opacity: 0, x: 30, width: 0 }}
                  animate={{ opacity: 1, x: 0, width: 320 }}
                  exit={{ opacity: 0, x: 30, width: 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="shrink-0 overflow-hidden"
                  style={{ width: 320 }}
                >
                  <div className="bg-card border border-border/60 rounded-2xl overflow-hidden h-full flex flex-col" style={{ minHeight: 400 }}>
                    {/* Panel header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
                      <div className="min-w-0 flex-1 pr-2">
                        <h3 className="font-heading font-bold text-sm leading-tight truncate">{selectedNovel.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{selectedEpisodes.length} ตอน</p>
                      </div>
                      <button
                        onClick={() => setSelectedNovel(null)}
                        className="p-1 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Episode list */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                      {selectedEpisodes.length === 0 ? (
                        <div className="text-center py-10">
                          <p className="text-sm text-muted-foreground">ยังไม่มีตอน</p>
                          <Link to={`/series/${selectedNovel.id}`}>
                            <Button size="sm" variant="outline" className="mt-3 gap-1.5 text-xs">
                              เพิ่มตอนแรก
                            </Button>
                          </Link>
                        </div>
                      ) : (
                        selectedEpisodes.map((ep) => (
                          <Link
                            key={ep.id}
                            to={`/series/${selectedNovel.id}/episode/${ep.id}`}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent/50 transition-colors group block"
                          >
                            <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                              {ep.episode_number}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium leading-tight truncate">{ep.title}</p>
                              {ep.word_count > 0 && (
                                <p className="text-xs text-muted-foreground mt-0.5">{ep.word_count.toLocaleString()} คำ</p>
                              )}
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium border shrink-0 ${
                              ep.status === "published"
                                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                : "bg-muted text-muted-foreground border-border"
                            }`}>
                              {ep.status === "published" ? "เผยแพร่" : "ร่าง"}
                            </span>
                          </Link>
                        ))
                      )}
                    </div>

                    {/* Panel footer */}
                    <div className="px-4 py-3 border-t border-border/40">
                      <Link to={`/series/${selectedNovel.id}`}>
                        <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs">
                          <FileEdit className="w-3.5 h-3.5" />
                          จัดการตอนทั้งหมด
                        </Button>
                      </Link>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </AppLayout>
  );
}