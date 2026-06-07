import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Feather, PenTool, Users, Globe, Clock, Sparkles, Bot } from "lucide-react";
import WritingRoom from "@/components/novel/WritingRoom";
import CharacterBible from "@/components/novel/CharacterBible";
import WorldBible from "@/components/novel/WorldBible";
import Timeline from "@/components/novel/Timeline";
import AiAssistant from "@/components/novel/AiAssistant";
import WriterManager from "@/components/novel/WriterManager";

export default function NovelWorkspace() {
  const urlParams = new URLSearchParams(window.location.search);
  const novelId = window.location.pathname.split("/novel/")[1];
  const [activeTab, setActiveTab] = useState("writing");

  const { data: novel, isLoading } = useQuery({
    queryKey: ["novel", novelId],
    queryFn: async () => {
      const novels = await base44.entities.Novel.filter({ id: novelId });
      return novels[0];
    },
    enabled: !!novelId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!novel) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">ไม่พบนิยายเรื่องนี้</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/60 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Feather className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="font-heading font-semibold text-base truncate">{novel.title}</h1>
              <p className="text-xs text-muted-foreground truncate">
                {novel.genre}{novel.era ? ` · ${novel.era}` : ""}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="border-b border-border/60 bg-card/30">
          <div className="max-w-7xl mx-auto px-4">
            <TabsList className="bg-transparent h-auto p-0 gap-1">
              <TabsTrigger value="writing" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2.5">
                <PenTool className="w-3.5 h-3.5" />
                <span className="text-sm">ห้องเขียน</span>
              </TabsTrigger>
              <TabsTrigger value="characters" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2.5">
                <Users className="w-3.5 h-3.5" />
                <span className="text-sm">ตัวละคร</span>
              </TabsTrigger>
              <TabsTrigger value="world" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2.5">
                <Globe className="w-3.5 h-3.5" />
                <span className="text-sm">โลก/ฉาก</span>
              </TabsTrigger>
              <TabsTrigger value="timeline" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2.5">
                <Clock className="w-3.5 h-3.5" />
                <span className="text-sm">ไทม์ไลน์</span>
              </TabsTrigger>
              <TabsTrigger value="ai" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span className="text-sm">ผู้ช่วย AI</span>
              </TabsTrigger>
              <TabsTrigger value="writers" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2.5">
                <Bot className="w-3.5 h-3.5" />
                <span className="text-sm">นักเขียน AI</span>
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <div className="flex-1">
          <TabsContent value="writing" className="m-0 h-full">
            <WritingRoom novelId={novelId} novel={novel} />
          </TabsContent>
          <TabsContent value="characters" className="m-0">
            <CharacterBible novelId={novelId} />
          </TabsContent>
          <TabsContent value="world" className="m-0">
            <WorldBible novelId={novelId} />
          </TabsContent>
          <TabsContent value="timeline" className="m-0">
            <Timeline novelId={novelId} />
          </TabsContent>
          <TabsContent value="ai" className="m-0 h-full">
            <AiAssistant novelId={novelId} novel={novel} />
          </TabsContent>
          <TabsContent value="writers" className="m-0">
            <WriterManager />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}