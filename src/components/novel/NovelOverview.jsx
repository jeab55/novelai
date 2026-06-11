import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, Users, Globe, Clock, FileText, Target, TrendingUp, Feather, ArrowRight, CheckCircle2, Edit3 } from "lucide-react";
// Note: Icon is used via dynamic shortcut map below
import CopyButton from "@/components/ui/CopyButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const statusColors = {
  "ร่าง": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "เขียนเสร็จ": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "เผยแพร่": "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
};

function StatCard({ icon: Icon, label, value, sub, color = "text-primary" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className={`w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center mb-3 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-heading font-bold text-foreground">{value}</p>
      <p className="text-sm font-medium text-foreground/80 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </motion.div>
  );
}

export default function NovelOverview({ novel, novelId, onTabChange }) {
  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters", novelId],
    queryFn: async () => {
      const all = await base44.entities.Chapter.filter({ novel_id: novelId }, "order");
      return all.filter((c) => !c.is_deleted);
    },
  });

  const { data: characters = [] } = useQuery({
    queryKey: ["characters", novelId],
    queryFn: async () => {
      const all = await base44.entities.Character.filter({ novel_id: novelId });
      return all.filter((c) => !c.is_deleted);
    },
  });

  const { data: worldEntries = [] } = useQuery({
    queryKey: ["worldEntries", novelId],
    queryFn: async () => {
      const all = await base44.entities.WorldEntry.filter({ novel_id: novelId });
      return all.filter((w) => !w.is_deleted);
    },
  });

  const { data: plotEvents = [] } = useQuery({
    queryKey: ["plotEvents", novelId],
    queryFn: async () => {
      const all = await base44.entities.PlotEvent.filter({ novel_id: novelId }, "order");
      return all.filter((e) => !e.is_deleted);
    },
  });

  const totalWords = chapters.reduce((acc, c) => acc + (c.word_count || 0), 0);
  const doneChapters = chapters.filter((c) => c.status === "เขียนเสร็จ" || c.status === "เผยแพร่").length;
  const targetChapters = novel?.target_chapters || 10;
  const progress = Math.min(100, Math.round((doneChapters / targetChapters) * 100));
  const recentChapters = [...chapters].sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date)).slice(0, 5);

  const shortcuts = [
    { label: "ห้องเขียน", icon: Edit3, tab: "writing", count: `${chapters.length} ตอน`, color: "from-amber-50 to-orange-50 border-amber-200/60 dark:from-amber-900/20 dark:to-orange-900/20 dark:border-amber-800/40" },
    { label: "ตัวละคร", icon: Users, tab: "characters", count: `${characters.length} ตัว`, color: "from-sky-50 to-blue-50 border-sky-200/60 dark:from-sky-900/20 dark:to-blue-900/20 dark:border-sky-800/40" },
    { label: "ไทม์ไลน์", icon: Clock, tab: "timeline", count: `${plotEvents.length} เหตุการณ์`, color: "from-violet-50 to-purple-50 border-violet-200/60 dark:from-violet-900/20 dark:to-purple-900/20 dark:border-violet-800/40" },
    { label: "โลก/ฉาก", icon: Globe, tab: "world", count: `${worldEntries.length} รายการ`, color: "from-emerald-50 to-teal-50 border-emerald-200/60 dark:from-emerald-900/20 dark:to-teal-900/20 dark:border-emerald-800/40" },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

      {/* Plot Outline */}
      {novel?.plot_outline && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border/60 rounded-2xl p-6 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-primary font-heading">โครงเรื่อง 3 องก์</span>
            <CopyButton text={novel.plot_outline} label="คัดลอก" size="xs" className="ml-auto" />
          </div>
          <p className="text-sm leading-relaxed text-foreground/85 font-body whitespace-pre-wrap">{novel.plot_outline}</p>
        </motion.div>
      )}

      {/* Synopsis */}
      {novel?.synopsis && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-primary/5 via-accent/30 to-primary/5 border border-primary/15 rounded-2xl p-6"
        >
          <div className="flex items-center gap-2 mb-3">
            <Feather className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-primary font-heading">เรื่องย่อ</span>
            <CopyButton text={novel.synopsis} label="คัดลอก" size="xs" className="ml-auto" />
          </div>
          <p className="text-sm leading-relaxed text-foreground/85 font-body italic">"{novel.synopsis}"</p>
          {novel.era && <p className="text-xs text-primary/60 mt-3 font-medium">📍 {novel.era}</p>}
        </motion.div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FileText} label="ตอนทั้งหมด" value={chapters.length} sub={`เป้าหมาย ${targetChapters} ตอน`} />
        <StatCard icon={TrendingUp} label="จำนวนคำรวม" value={totalWords.toLocaleString()} sub="คำ" />
        <StatCard icon={CheckCircle2} label="เขียนเสร็จแล้ว" value={doneChapters} sub={`จาก ${targetChapters} ตอน`} />
        <StatCard icon={Users} label="ตัวละคร" value={characters.length} sub={`ในเรื่อง`} />
      </div>

      {/* Progress Bar */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border/60 rounded-2xl p-6 shadow-sm"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm font-heading">ความคืบหน้า</span>
          </div>
          <span className="text-2xl font-bold font-heading text-primary">{progress}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
            className="h-3 rounded-full bg-gradient-to-r from-primary to-primary/70"
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span>{doneChapters} ตอนเขียนเสร็จ</span>
          <span>เป้าหมาย {targetChapters} ตอน</span>
        </div>
      </motion.div>

      {/* Quick Shortcuts */}
      <div>
        <h3 className="font-heading font-semibold text-base mb-4 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          ทางลัด
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {shortcuts.map((s, i) => (
            <motion.button
              key={s.tab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => onTabChange?.(s.tab)}
              className={`group bg-gradient-to-br ${s.color} border rounded-2xl p-4 text-left hover:shadow-md transition-all duration-200 hover:-translate-y-0.5`}
            >
              <s.icon className="w-6 h-6 text-foreground/60 mb-3 group-hover:text-primary transition-colors" />
              <p className="font-semibold text-sm text-foreground">{s.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.count}</p>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 mt-3 group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </motion.button>
          ))}
        </div>
      </div>

      {/* Recent Chapters */}
      {recentChapters.length > 0 && (
        <div>
          <h3 className="font-heading font-semibold text-base mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            ตอนล่าสุด
          </h3>
          <div className="space-y-2">
            {recentChapters.map((ch, i) => (
              <motion.div
                key={ch.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-4 bg-card border border-border/50 rounded-xl px-4 py-3 hover:border-primary/20 hover:shadow-sm transition-all cursor-pointer group"
                onClick={() => onTabChange?.("writing")}
              >
                <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {ch.order || i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{ch.title}</p>
                  <p className="text-xs text-muted-foreground">{(ch.word_count || 0).toLocaleString()} คำ</p>
                </div>
                <Badge className={`${statusColors[ch.status] || statusColors["ร่าง"]} text-xs`}>
                  {ch.status || "ร่าง"}
                </Badge>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}