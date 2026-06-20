import React from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Clapperboard, Mic, MessageSquare, ImageIcon } from "lucide-react";

export default function StoryboardSceneEditor({ scene, index, onChange }) {
  const set = (field, value) => onChange({ ...scene, [field]: value });

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <div className="flex items-center justify-between bg-secondary/50 px-3.5 py-2 border-b border-border/50">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
            {scene.scene_number || index + 1}
          </span>
          ฉากที่ {scene.scene_number || index + 1}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">~</span>
          <Input
            type="number"
            value={scene.duration || ""}
            onChange={(e) => set("duration", e.target.value === "" ? "" : Number(e.target.value))}
            className="h-7 w-16 text-xs"
          />
          <Badge variant="outline" className="text-xs">วิ</Badge>
        </div>
      </div>

      <div className="p-3.5 space-y-2.5">
        <EditField icon={Clapperboard} label="มุมกล้อง / อารมณ์" color="text-amber-600">
          <Input value={scene.shot || ""} onChange={(e) => set("shot", e.target.value)} className="h-8 text-sm" />
        </EditField>
        <EditField icon={Mic} label="บทพากย์ (Voiceover)" color="text-sky-600">
          <Textarea value={scene.voiceover || ""} onChange={(e) => set("voiceover", e.target.value)} rows={2} className="text-sm" />
        </EditField>
        <EditField icon={MessageSquare} label="บทสนทนา" color="text-violet-600">
          <Textarea value={scene.dialogue || ""} onChange={(e) => set("dialogue", e.target.value)} rows={2} className="text-sm" />
        </EditField>
        <EditField icon={ImageIcon} label="พรอมต์ภาพ AI" color="text-emerald-600">
          <Textarea value={scene.image_prompt || ""} onChange={(e) => set("image_prompt", e.target.value)} rows={2} className="text-sm" />
        </EditField>
      </div>
    </div>
  );
}

function EditField({ icon: Icon, label, color, children }) {
  return (
    <div>
      <span className={`flex items-center gap-1.5 text-xs font-medium mb-1 ${color}`}>
        <Icon className="w-3.5 h-3.5" />{label}
      </span>
      {children}
    </div>
  );
}