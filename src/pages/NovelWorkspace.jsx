import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Feather, PenTool, Users, Globe, Clock, Bot, Trash2, Share2, History, CheckCircle2, BookOpen, Brain, ShieldCheck, UserCog, Send } from "lucide-react";
import VersionHistoryDialog from "@/components/novel/VersionHistoryDialog";
import { saveVersion } from "@/lib/saveVersion";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import DeleteNovelDialog from "@/components/novel/DeleteNovelDialog";
import ShareNovelDialog from "@/components/novel/ShareNovelDialog";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { useBulkWrite } from "@/lib/BulkWriteContext";
import WritingRoom from "@/components/novel/WritingRoom";
import CharacterBible from "@/components/novel/CharacterBible";
import WorldBible from "@/components/novel/WorldBible";
import Timeline from "@/components/novel/Timeline";
import WriterManager from "@/components/novel/WriterManager";
import ShortStoryWorkspace from "@/components/novel/ShortStoryWorkspace";
import ContinuityAnalysisPanel from "@/components/novel/ContinuityAnalysisPanel";
import ContinuityCheckPanel from "@/components/novel/ContinuityCheckPanel";
import CharacterTimelinePanel from "@/components/novel/CharacterTimelinePanel";
import PublishExportPanel from "@/components/novel/PublishExportPanel";

export default function NovelWorkspace() {
  const novelId = window.location.pathname.split("/novel/")[1]?.split("/")[0];
  const [activeTab, setActiveTab] = useState("characters");
  const [selectedEpisodeId, setSelectedEpisodeId] = useState(null);
  const [pendingOpenChapter, setPendingOpenChapter] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [shareDialog, setShareDialog] = useState(false);
  const [novelVersionOpen, setNovelVersionOpen] = useState(false);
  const { user } = useAuth();
  const { jobs } = useBulkWrite();
  const isAdmin = user?.role === "admin";
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: novel, isLoading } = useQuery({
    queryKey: ["novel", novelId],
    queryFn: async () => {
      const all = await base44.entities.Novel.list();
      return all.find((n) => String(n.id) === String(novelId) && !n.is_deleted);
    },
    enabled: !!novelId,
    staleTime: 60000, // 1 นาที
    gcTime: 300000, // 5 นาที
  });

  // โหลดทุก EP ในซีรีย์เดียวกัน (Novels ที่มี series_id เดียวกัน)
  const { data: episodes = [] } = useQuery({
    queryKey: ["episodes", novel?.series_id],
    queryFn: async () => {
      if (!novel?.series_id) return [novel].filter(Boolean);
      const all = await base44.entities.Novel.list();
      return all
        .filter((n) => String(n.series_id) === String(novel.series_id) && !n.is_deleted)
        .sort((a, b) => (a.created_date || "").localeCompare(b.created_date || ""));
    },
    enabled: !!novel,
    staleTime: 60000, // 1 นาที
    gcTime: 300000, // 5 นาที
  });

  // ถ้ามีหลาย EP ให้ใช้ selectedEpisodeId ถ้าไม่มีให้ใช้ novelId
  const activeNovelId = selectedEpisodeId || novelId;

  // โหลดจำนวนตอนที่เขียนเสร็จ — ใช้ activeNovelId
  const { data: chapters } = useQuery({
    queryKey: ["chapters", activeNovelId],
    queryFn: async () => {
      const all = await base44.entities.Chapter.filter({ novel_id: activeNovelId }, "order");
      return all.filter((c) => !c.is_deleted).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    },
    enabled: !!activeNovelId && !!novel,
    staleTime: 30000, // 30 วินาที
    gcTime: 300000, // 5 นาที
  });

  const completedCount = chapters?.filter(c => c.status === "เขียนเสร็จ").length || 0;
  const targetCount = novel?.target_chapters || 0;
  const progressPct = targetCount > 0 ? Math.round((completedCount / targetCount) * 100) : 0;
  const isBulkWriting = jobs[activeNovelId]?.status === "running";

  const { data: novelWriter } = useQuery({
    queryKey: ["writers-all"],
    queryFn: () => base44.entities.Writer.list(),
    enabled: !!novel?.writer_id,
    select: (data) => data.find((w) => String(w.id) === String(novel?.writer_id)),
    staleTime: 120000, // 2 นาที
  });

  const softDeleteMutation = useMutation({
    mutationFn: async () => {
      if (novel) {
        await saveVersion({
          entityType: "novel",
          entityId: novelId,
          novelId,
          data: novel,
          label: `ก่อนลบ: ${novel.title}`,
          createdByName: user?.full_name || "",
        });
      }
      await base44.entities.Novel.update(novelId, { is_deleted: true, deleted_at: new Date().toISOString() });
      const [chapters, characters, plotEvents] = await Promise.all([
        base44.entities.Chapter.filter({ novel_id: novelId }),
        base44.entities.Character.filter({ novel_id: novelId }),
        base44.entities.PlotEvent.filter({ novel_id: novelId }),
      ]);
      await Promise.all([
        ...chapters.map((c) => base44.entities.Chapter.update(c.id, { is_deleted: true })),
        ...characters.map((c) => base44.entities.Character.update(c.id, { is_deleted: true })),
        ...plotEvents.map((e) => base44.entities.PlotEvent.update(e.id, { is_deleted: true })),
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["novels"] });
      toast.success("ย้ายไปถังขยะแล้ว");
      navigate("/");
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // ตรวจสิทธิ์: เจ้าของ, collaborator, หรือ admin
  const isCollaborator = Array.isArray(novel?.shared_with) && novel.shared_with.includes(user?.email);
  const isOwner = String(novel?.created_by_id) === String(user?.id);
  const canAccess = isAdmin || isOwner || isCollaborator;

  if (!novel || !canAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4">
        <p className="text-muted-foreground">ไม่พบนิยายเรื่องนี้ หรือคุณไม่มีสิทธิ์เข้าถึง</p>
        <Link to="/"><Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 mr-1.5" />กลับหน้าหลัก</Button></Link>
      </div>
    );
  }

  const canDelete = isAdmin || novel.created_by_id === user?.id;
  const canShare = isAdmin || novel.created_by_id === user?.id;

  return (
    <>
    <DeleteNovelDialog
      open={deleteDialog}
      onClose={() => setDeleteDialog(false)}
      onConfirm={() => softDeleteMutation.mutate()}
      novel={novel}
      mode="delete"
      isPending={softDeleteMutation.isPending}
    />
    <ShareNovelDialog
      open={shareDialog}
      onClose={() => setShareDialog(false)}
      novel={novel}
    />
    {novel && (
      <VersionHistoryDialog
        open={novelVersionOpen}
        onClose={() => setNovelVersionOpen(false)}
        entityType="novel"
        entityId={novelId}
        novelId={novelId}
        currentData={novel}
        currentLabel={novel.title}
        onRestored={() => queryClient.invalidateQueries({ queryKey: ["novel", novelId] })}
      />
    )}
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/60 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Feather className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              {/* EP Selector Tabs */}
              {episodes.length > 1 && (
                <div className="flex items-center gap-1 mb-2 overflow-x-auto">
                  {episodes.map((ep, idx) => (
                    <Button
                      key={ep.id}
                      variant={String(ep.id) === String(activeNovelId) ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs shrink-0"
                      onClick={() => setSelectedEpisodeId(ep.id)}
                    >
                      EP{idx + 1}: {ep.title?.slice(0, 20)}{ep.title?.length > 20 ? "..." : ""}
                    </Button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <h1 className="font-heading font-semibold text-base truncate">{novel.title}</h1>
                {(novel.auto_written || (jobs[activeNovelId]?.status === "done")) && (
                  <span className="inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 shadow-sm shrink-0">
                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                    สร้างเสร็จ
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs text-muted-foreground truncate">
                  {novel.genre}{novel.era ? ` · ${novel.era}` : ""}{novel.target_chapters ? ` · ${novel.target_chapters} ตอน` : ""}
                </p>
                {novelWriter && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-primary/70 font-medium bg-primary/8 border border-primary/15 px-2 py-0.5 rounded-full shrink-0">
                    <Bot className="w-2.5 h-2.5" />
                    {novelWriter.name}
                  </span>
                )}
              </div>
              {/* Progress bar — ซ่อนสำหรับเรื่องสั้น (แสดงใน ShortStoryWorkspace แทน) */}
              {novel.novel_type !== "เรื่องสั้น" && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className={isBulkWriting ? "text-primary font-medium" : "text-muted-foreground"}>
                      {isBulkWriting ? `✍️ กำลังสร้างตอนที่ ${jobs[novelId]?.current || 0}/${targetCount}` : `เขียนแล้ว ${completedCount}/${targetCount} ตอน`}
                    </span>
                    <span className={isBulkWriting ? "text-primary font-semibold" : "text-muted-foreground"}>{progressPct}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-500 ${isBulkWriting ? "bg-primary animate-pulse" : "bg-emerald-500"}`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 ml-auto shrink-0">
            {canShare && (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-primary"
                title="แชร์เรื่อง"
                onClick={() => setShareDialog(true)}
              >
                <Share2 className="w-4 h-4" />
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                title="ย้ายไปถังขยะ"
                onClick={() => setDeleteDialog(true)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-primary"
              title="ประวัติเวอร์ชัน"
              onClick={() => setNovelVersionOpen(true)}
            >
              <History className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* เรื่องสั้น → ShortStoryWorkspace แบบ single-page */}
      {novel.novel_type === "เรื่องสั้น" ? (
        <div className="flex-1 overflow-y-auto">
          <ShortStoryWorkspace novelId={novelId} novel={novel} />
        </div>
      ) : (
      /* นิยายยาว → Tabs เดิม */
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="border-b border-border/60 bg-card/40 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 overflow-x-auto">
            <TabsList className="bg-transparent h-auto p-0 gap-0 flex-nowrap whitespace-nowrap">
              {[
                { value: "characters", icon: Users, label: "ตัวละคร" },
                { value: "timeline", icon: Clock, label: "ไทม์ไลน์" },
                { value: "char-timeline", icon: UserCog, label: "ไทม์ไลน์ตัวละคร" },
                { value: "world", icon: Globe, label: "โลก/ฉาก" },
                { value: "writers", icon: Bot, label: "นักเขียน AI" },
                { value: "analysis", icon: Brain, label: "วิเคราะห์พล็อต" },
                { value: "continuity", icon: ShieldCheck, label: "ตรวจความต่อเนื่อง" },
                { value: "writing", icon: PenTool, label: "ห้องเขียน" },
                { value: "publish", icon: Send, label: "เผยแพร่/ส่งออก" },
              ].map(({ value, icon: Icon, label }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-3 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-sm">{label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>

        <div className="flex-1">
          <TabsContent value="writing" className="m-0 h-full">
            <WritingRoom novelId={activeNovelId} novel={novel} pendingOpenChapter={pendingOpenChapter} onPendingOpenChapterConsumed={() => setPendingOpenChapter(null)} />
          </TabsContent>
          <TabsContent value="characters" className="m-0">
            <CharacterBible novelId={activeNovelId} novel={novel} />
          </TabsContent>
          <TabsContent value="world" className="m-0">
            <WorldBible
              novelId={activeNovelId}
              onNavigateToTimeline={(eventId) => setActiveTab("timeline")}
              novel={novel}
            />
          </TabsContent>
          <TabsContent value="timeline" className="m-0">
            <Timeline
              novelId={activeNovelId}
              novel={novel}
              onOpenChapter={(ch) => { setPendingOpenChapter(ch); setActiveTab("writing"); }}
              onNavigateToWorldBible={() => setActiveTab("world")}
            />
          </TabsContent>
          <TabsContent value="writers" className="m-0">
            <WriterManager />
          </TabsContent>
          <TabsContent value="analysis" className="m-0">
            <ContinuityAnalysisPanel novelId={activeNovelId} chapters={chapters || []} novel={novel} />
          </TabsContent>
          <TabsContent value="continuity" className="m-0">
            <ContinuityCheckPanel novelId={activeNovelId} novel={novel} />
          </TabsContent>
          <TabsContent value="char-timeline" className="m-0">
            <CharacterTimelinePanel novelId={activeNovelId} novel={novel} />
          </TabsContent>
          <TabsContent value="publish" className="m-0">
            <PublishExportPanel novel={{ ...novel, id: activeNovelId }} />
          </TabsContent>
        </div>
      </Tabs>
      )}
    </div>
    </>
  );
}