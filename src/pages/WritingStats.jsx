import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/AppLayout";
import StatCard from "@/components/stats/StatCard";
import DailyWordsChart from "@/components/stats/DailyWordsChart";
import GoalEditor from "@/components/stats/GoalEditor";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BarChart3, BookText, FileText, PenLine, Target, Flame, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { novelSummaries, dailyWordSeries, wordsToday, chapterWords } from "@/lib/writingStats";

export default function WritingStats() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [goalOpen, setGoalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: novels = [], isLoading: loadingNovels } = useQuery({
    queryKey: ["stats-novels", user?.id],
    queryFn: async () => {
      const all = await base44.entities.Novel.list("-created_date");
      return all.filter((n) => {
        if (n.is_deleted) return false;
        if (isAdmin) return true;
        return String(n.created_by_id) === String(user?.id);
      });
    },
    enabled: !!user,
  });

  const { data: chapters = [], isLoading: loadingChapters } = useQuery({
    queryKey: ["stats-chapters"],
    queryFn: async () => {
      const all = await base44.entities.Chapter.list("-updated_date", 2000);
      return all.filter((c) => !c.is_deleted);
    },
    enabled: !!user,
  });

  const { data: goals = [] } = useQuery({
    queryKey: ["writing-goal", user?.id],
    queryFn: () => base44.entities.WritingGoal.filter({ user_id: user?.id }),
    enabled: !!user,
  });
  const goal = goals[0] || { daily_word_goal: 1000, novel_word_goal: 50000 };

  const saveGoal = useMutation({
    mutationFn: async (data) => {
      if (goals[0]?.id) return base44.entities.WritingGoal.update(goals[0].id, data);
      return base44.entities.WritingGoal.create({ user_id: user?.id, ...data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["writing-goal"] });
      toast.success("บันทึกเป้าหมายแล้ว");
      setGoalOpen(false);
    },
  });

  const novelIds = new Set(novels.map((n) => n.id));
  const myChapters = chapters.filter((c) => novelIds.has(c.novel_id));
  const chaptersByNovel = myChapters.reduce((acc, c) => {
    (acc[c.novel_id] = acc[c.novel_id] || []).push(c);
    return acc;
  }, {});

  const summaries = novelSummaries(novels, chaptersByNovel).sort((a, b) => b.totalWords - a.totalWords);
  const totalWords = myChapters.reduce((sum, c) => sum + chapterWords(c), 0);
  const totalChapters = myChapters.length;
  const today = wordsToday(myChapters);
  const series = dailyWordSeries(myChapters, 14);

  const dailyPct = goal.daily_word_goal > 0 ? Math.min(100, Math.round((today / goal.daily_word_goal) * 100)) : 0;
  const isLoading = loadingNovels || loadingChapters;

  return (
    <AppLayout>
      <GoalEditor open={goalOpen} onClose={() => setGoalOpen(false)} goal={goal} onSave={(d) => saveGoal.mutate(d)} saving={saveGoal.isPending} />
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between gap-3 mb-8 flex-wrap">
          <div>
            <h2 className="font-heading font-bold text-2xl flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-primary" />สถิติการเขียน
            </h2>
            <p className="text-sm text-muted-foreground mt-1">ดูพัฒนาการและความคืบหน้าเทียบเป้าหมายของคุณ</p>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => setGoalOpen(true)}>
            <Target className="w-4 h-4" />ตั้งเป้าหมาย
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={BookText} label="จำนวนเรื่อง" value={novels.length} bg="bg-amber-100" color="text-amber-600" />
              <StatCard icon={FileText} label="จำนวนตอนรวม" value={totalChapters.toLocaleString()} bg="bg-sky-100" color="text-sky-600" />
              <StatCard icon={PenLine} label="คำรวมทั้งหมด" value={totalWords.toLocaleString()} bg="bg-violet-100" color="text-violet-600" />
              <StatCard icon={Flame} label="คำที่เขียนวันนี้" value={today.toLocaleString()} sub={`เป้า ${goal.daily_word_goal.toLocaleString()} คำ`} bg="bg-rose-100" color="text-rose-600" />
            </div>

            {/* Daily goal progress */}
            <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="font-heading font-semibold">ความคืบหน้าเป้าหมายวันนี้</span>
                <span className="text-sm font-semibold text-primary">{dailyPct}%</span>
              </div>
              <Progress value={dailyPct} className="h-3" />
              <p className="text-xs text-muted-foreground mt-2">{today.toLocaleString()} / {goal.daily_word_goal.toLocaleString()} คำ</p>
            </div>

            {/* Daily chart */}
            <DailyWordsChart data={series} goal={goal.daily_word_goal} />

            {/* Per-novel breakdown */}
            <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm">
              <h3 className="font-heading font-semibold mb-4">ความคืบหน้าต่อเรื่อง (เทียบเป้า {goal.novel_word_goal.toLocaleString()} คำ)</h3>
              {summaries.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">ยังไม่มีนิยาย</p>
              ) : (
                <div className="space-y-4">
                  {summaries.map((s, i) => {
                    const pct = goal.novel_word_goal > 0 ? Math.min(100, Math.round((s.totalWords / goal.novel_word_goal) * 100)) : 0;
                    return (
                      <motion.div key={s.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                        <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                          <span className="font-medium text-sm flex items-center gap-2">
                            {s.title}
                            {s.genre && <Badge variant="secondary" className="font-normal text-[10px]">{s.genre}</Badge>}
                          </span>
                          <span className="text-xs text-muted-foreground">{s.chapterCount} ตอน · {s.totalWords.toLocaleString()} คำ · {pct}%</span>
                        </div>
                        <Progress value={pct} className="h-2" />
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </AppLayout>
  );
}