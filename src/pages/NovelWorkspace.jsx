import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Feather, PenTool, Users, Globe, Clock, Bot, Trash2, Share2, History, BookOpen } from "lucide-react";
import VersionHistoryDialog from "@/components/novel/VersionHistoryDialog";
import { saveVersion } from "@/lib/saveVersion";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import DeleteNovelDialog from "@/components/novel/DeleteNovelDialog";
import ShareNovelDialog from "@/components/novel/ShareNovelDialog";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import WritingRoom from "@/components/novel/WritingRoom";
import CharacterBible from "@/components/novel/CharacterBible";
import WorldBible from "@/components/novel/WorldBible";
import Timeline from "@/components/novel/Timeline";
import WriterManager from "@/components/novel/WriterManager";
import NovelHomePage from "@/components/novel/NovelHomePage";

export default function NovelWorkspace() {
  const novelId = window.location.pathname.split("/novel/")[1];
  const [activeTab, setActiveTab] = useState("home");
  const [pendingOpenChapter, setPendingOpenChapter] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [shareDialog, setShareDialog] = useState(false);
  const [novelVersionOpen, setNovelVersionOpen] = useState(false);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: novel, isLoading } = useQuery({
    queryKey: ["novel", novelId],
    queryFn: async () => {
      const all = await base44.entities.Novel.list();
      return all.find((n) => String(n.id) === String(novelId));
    },
    enabled: !!novelId,
  });

  const { data: novelWriter } = useQuery({
    queryKey: ["writers-all"],
    queryFn: () => base44.entities.Writer.list(),
    enabled: !!novel?.writer_id,
    select: (data) => data.find((w) => String(w.id) === String(novel?.writer_id)),
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
  const canAccess = isAdmin || novel?.created_by_id === user?.id || isCollaborator;

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
            <div className="min-w-0">
              <h1 className="font-heading font-semibold text-base truncate">{novel.title}</h1>
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="border-b border-border/60 bg-card/40 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 overflow-x-auto">
            <TabsList className="bg-transparent h-auto p-0 gap-0 flex-nowrap whitespace-nowrap">
              {[
                { value: "home", icon: BookOpen, label: "หน้าแรก" },
                { value: "characters", icon: Users, label: "ตัวละคร" },
                { value: "timeline", icon: Clock, label: "ไทม์ไลน์" },
                { value: "world", icon: Globe, label: "โลก/ฉาก" },
                { value: "writers", icon: Bot, label: "นักเขียน AI" },
                { value: "writing", icon: PenTool, label: "ห้องเขียน" },
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
          <TabsContent value="home" className="m-0">
            <NovelHomePage novel={novel} novelId={novelId} />
          </TabsContent>
          <TabsContent value="writing" className="m-0 h-full">
            <WritingRoom novelId={novelId} novel={novel} pendingOpenChapter={pendingOpenChapter} onPendingOpenChapterConsumed={() => setPendingOpenChapter(null)} />
          </TabsContent>
          <TabsContent value="characters" className="m-0">
            <CharacterBible novelId={novelId} />
          </TabsContent>
          <TabsContent value="world" className="m-0">
            <WorldBible
              novelId={novelId}
              onNavigateToTimeline={(eventId) => setActiveTab("timeline")}
              novel={novel}
            />
          </TabsContent>
          <TabsContent value="timeline" className="m-0">
            <Timeline
              novelId={novelId}
              novel={novel}
              onOpenChapter={(ch) => { setPendingOpenChapter(ch); setActiveTab("writing"); }}
              onNavigateToWorldBible={() => setActiveTab("world")}
            />
          </TabsContent>
          <TabsContent value="writers" className="m-0">
            <WriterManager />
          </TabsContent>
        </div>
      </Tabs>
    </div>
    </>
  );
}