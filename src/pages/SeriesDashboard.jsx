import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Layers, ChevronDown, ChevronRight, FileEdit, Plus, Eye } from "lucide-react";
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

function NovelRow({ novel, episodes, index }) {
  const [open, setOpen] = useState(false);
  const novelEpisodes = episodes
    .filter((e) => String(e.novel_id) === String(novel.id))
    .sort((a, b) => (a.episode_number || 0) - (b.episode_number || 0));
  const gradient = genreColors[novel.genre] || "from-gray-400 to-slate-500";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="bg-card border border-border/60 rounded-2xl overflow-hidden"
    >
      {/* Novel header row */}
      <div
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-accent/30 transition-colors select-none"
        onClick={() => setOpen((v) => !v)}
      >
        {/* Cover thumbnail */}
        <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0">
          {novel.cover_url ? (
            <img src={novel.cover_url} alt={novel.title} className="w-full h-full object-cover" />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
              <BookOpen className="w-6 h-6 text-white/70" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-heading font-bold text-base leading-tight truncate">{novel.title}</h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {novel.genre && (
              <span className="text-xs text-muted-foreground">{novel.genre}</span>
            )}
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">{novelEpisodes.length} ตอน</span>
            {novelEpisodes.filter((e) => e.status === "published").length > 0 && (
              <>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-emerald-600">
                  เผยแพร่แล้ว {novelEpisodes.filter((e) => e.status === "published").length} ตอน
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            to={`/series/${novel.id}`}
            onClick={(e) => e.stopPropagation()}
          >
            <Button size="sm" variant="outline" className="gap-1.5 h-8 px-3 text-xs">
              <Plus className="w-3.5 h-3.5" />
              จัดการ
            </Button>
          </Link>
          {open
            ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
            : <ChevronRight className="w-4 h-4 text-muted-foreground" />
          }
        </div>
      </div>

      {/* Episode list */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="episodes"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/40 px-4 pb-3 pt-2 space-y-1 bg-muted/20">
              {novelEpisodes.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 text-center">
                  ยังไม่มีตอน —{" "}
                  <Link to={`/series/${novel.id}`} className="text-primary underline">
                    เพิ่มตอนแรก
                  </Link>
                </p>
              ) : (
                novelEpisodes.map((ep) => (
                  <div
                    key={ep.id}
                    className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-accent/40 transition-colors group"
                  >
                    <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                      {ep.episode_number}
                    </span>
                    <span className="flex-1 text-sm truncate">{ep.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border shrink-0 ${
                      ep.status === "published"
                        ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                        : "bg-muted text-muted-foreground border-border"
                    }`}>
                      {ep.status === "published" ? "เผยแพร่" : "ร่าง"}
                    </span>
                    <Link
                      to={`/series/${novel.id}/episode/${ep.id}`}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1">
                        <FileEdit className="w-3 h-3" />
                        แก้ไข
                      </Button>
                    </Link>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function SeriesDashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

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

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-6 py-10">
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
          <div className="space-y-3">
            {novels.map((novel, i) => (
              <NovelRow key={novel.id} novel={novel} episodes={episodes} index={i} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}