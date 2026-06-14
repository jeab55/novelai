import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, BookOpen, Feather, Layers, CheckCircle2, Clock, PauseCircle } from "lucide-react";
import { motion } from "framer-motion";
import SeriesFormDialog from "@/components/series/SeriesFormDialog";
import AppLayout from "@/components/AppLayout";

const statusConfig = {
  ongoing: { label: "กำลังเขียน", color: "bg-blue-100 text-blue-700 border-blue-200", icon: Clock },
  completed: { label: "จบแล้ว", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  hiatus: { label: "พักชั่วคราว", color: "bg-amber-100 text-amber-700 border-amber-200", icon: PauseCircle },
};

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
  const [createOpen, setCreateOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: series = [], isLoading } = useQuery({
    queryKey: ["series"],
    queryFn: () => base44.entities.Series.list("-created_date"),
  });

  const { data: episodes = [] } = useQuery({
    queryKey: ["episodes-all"],
    queryFn: () => base44.entities.Episode.list(),
  });

  const getEpisodeCount = (seriesId) =>
    episodes.filter((e) => String(e.series_id) === String(seriesId)).length;

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-heading font-bold text-2xl text-foreground tracking-tight">ซีรีส์ทั้งหมด</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {series.length > 0 ? `${series.length} ซีรีส์` : "ยังไม่มีซีรีส์"}
            </p>
          </div>
          <Button className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4" />
            สร้างซีรีส์ใหม่
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : series.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-24"
          >
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/10 to-accent/30 flex items-center justify-center mx-auto mb-6 shadow-inner">
              <Layers className="w-12 h-12 text-primary/50" />
            </div>
            <h2 className="text-2xl font-heading font-semibold mb-3">ยังไม่มีซีรีส์</h2>
            <p className="text-muted-foreground mb-8 max-w-sm mx-auto leading-relaxed">
              สร้างซีรีส์แรกของคุณเพื่อเริ่มจัดการตอนต่างๆ อย่างเป็นระบบ
            </p>
            <Button onClick={() => setCreateOpen(true)} className="gap-2 h-11 px-6 text-base shadow-sm">
              <Plus className="w-4 h-4" />
              สร้างซีรีส์ใหม่
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {series.map((s, i) => {
              const statusInfo = statusConfig[s.status] || statusConfig.ongoing;
              const StatusIcon = statusInfo.icon;
              const gradient = genreColors[s.genre] || "from-gray-400 to-slate-500";
              const epCount = getEpisodeCount(s.id);

              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link to={`/series/${s.id}`}>
                    <div className="group bg-card border border-border/60 rounded-2xl overflow-hidden hover:shadow-xl hover:shadow-primary/5 hover:border-primary/25 transition-all duration-300 cursor-pointer flex flex-col h-full">
                      {/* Cover image or gradient placeholder */}
                      <div className="relative h-44 overflow-hidden">
                        {s.cover_image_url ? (
                          <img
                            src={s.cover_image_url}
                            alt={s.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                            <BookOpen className="w-12 h-12 text-white/60" />
                          </div>
                        )}
                        {/* Status badge overlay */}
                        <div className="absolute top-3 right-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border backdrop-blur-sm bg-white/90 ${statusInfo.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusInfo.label}
                          </span>
                        </div>
                        {/* Genre badge */}
                        {s.genre && (
                          <div className="absolute bottom-3 left-3">
                            <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-black/40 text-white backdrop-blur-sm">
                              {s.genre}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="p-5 flex flex-col flex-1">
                        <h3 className="font-heading font-bold text-base leading-tight group-hover:text-primary transition-colors mb-2 line-clamp-2">
                          {s.title}
                        </h3>
                        {s.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed flex-1">
                            {s.description}
                          </p>
                        )}

                        {/* Footer */}
                        <div className="mt-4 pt-4 border-t border-border/40 flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <BookOpen className="w-3.5 h-3.5" />
                            <span className="font-medium text-foreground">{epCount}</span>
                            <span>ตอน</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(s.created_date).toLocaleDateString("th-TH")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <SeriesFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["series"] });
          setCreateOpen(false);
        }}
      />
    </AppLayout>
  );
}