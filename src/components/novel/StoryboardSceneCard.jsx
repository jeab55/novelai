import React from "react";
import { Badge } from "@/components/ui/badge";
import { Video, Mic, MessageSquare, ImageIcon, Clapperboard } from "lucide-react";

export default function StoryboardSceneCard({ scene, index }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <div className="flex items-center justify-between bg-secondary/50 px-3.5 py-2 border-b border-border/50">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
            {scene.scene_number || index + 1}
          </span>
          ฉากที่ {scene.scene_number || index + 1}
        </span>
        {scene.duration && <Badge variant="outline" className="text-xs">~{scene.duration} วิ</Badge>}
      </div>

      <div className="p-3.5 space-y-2.5 text-sm">
        {scene.shot && (
          <Field icon={Clapperboard} label="มุมกล้อง / อารมณ์" color="text-amber-600">{scene.shot}</Field>
        )}
        {scene.voiceover && (
          <Field icon={Mic} label="บทพากย์ (Voiceover)" color="text-sky-600">{scene.voiceover}</Field>
        )}
        {scene.dialogue && (
          <Field icon={MessageSquare} label="บทสนทนา" color="text-violet-600">{scene.dialogue}</Field>
        )}
        {scene.image_prompt && (
          <Field icon={ImageIcon} label="พรอมต์ภาพ AI" color="text-emerald-600">
            <span className="italic text-muted-foreground">{scene.image_prompt}</span>
          </Field>
        )}
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, color, children }) {
  return (
    <div>
      <span className={`flex items-center gap-1.5 text-xs font-medium mb-0.5 ${color}`}>
        <Icon className="w-3.5 h-3.5" />{label}
      </span>
      <p className="leading-relaxed pl-5">{children}</p>
    </div>
  );
}