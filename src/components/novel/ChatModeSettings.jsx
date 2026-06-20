import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Settings2 } from "lucide-react";

const BUBBLE_COLORS = [
  { key: "primary", label: "ส้มทอง", cls: "bg-primary text-primary-foreground" },
  { key: "rose", label: "ชมพู", cls: "bg-rose-500 text-white" },
  { key: "sky", label: "ฟ้า", cls: "bg-sky-500 text-white" },
  { key: "emerald", label: "เขียว", cls: "bg-emerald-500 text-white" },
  { key: "violet", label: "ม่วง", cls: "bg-violet-500 text-white" },
  { key: "card", label: "ขาว/เทา", cls: "bg-card border border-border text-foreground" },
];

export { BUBBLE_COLORS };

export default function ChatModeSettings({
  speakers, rightSpeaker, setRightSpeaker,
  showNarration, setShowNarration,
  rightColor, setRightColor, leftColor, setLeftColor,
  nameMap, setName,
}) {
  return (
    <div className="bg-secondary/30 rounded-xl border border-border/50 p-4 space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Settings2 className="w-4 h-4 text-primary" />ตั้งค่าการแสดงผล
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">ตัวละครฝั่งขวา (มุมมองหลัก)</label>
          <Select value={rightSpeaker} onValueChange={setRightSpeaker}>
            <SelectTrigger className="h-9"><SelectValue placeholder="เลือกตัวละคร" /></SelectTrigger>
            <SelectContent>
              {speakers.map((s) => <SelectItem key={s} value={s}>{nameMap[s] || s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <label className="flex items-center justify-between w-full bg-background rounded-lg border border-border/60 px-3 h-9">
            <span className="text-xs">แสดงคำบรรยาย</span>
            <Switch checked={showNarration} onCheckedChange={setShowNarration} />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ColorPicker label="สีบับเบิลฝั่งขวา" value={rightColor} onChange={setRightColor} />
        <ColorPicker label="สีบับเบิลฝั่งซ้าย" value={leftColor} onChange={setLeftColor} />
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block">แก้ไขชื่อตัวละครที่แสดงในแชต</label>
        <div className="space-y-2">
          {speakers.map((s) => (
            <div key={s} className="flex items-center gap-2">
              <Badge variant="outline" className="font-normal shrink-0 max-w-[40%] truncate">{s}</Badge>
              <span className="text-muted-foreground text-xs">→</span>
              <Input
                value={nameMap[s] ?? s}
                onChange={(e) => setName(s, e.target.value)}
                className="h-8 text-sm"
                placeholder="ชื่อที่จะแสดง"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ColorPicker({ label, value, onChange }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {BUBBLE_COLORS.map((c) => (
          <button
            key={c.key}
            onClick={() => onChange(c.key)}
            title={c.label}
            className={`w-7 h-7 rounded-full ${c.cls} transition-transform ${value === c.key ? "ring-2 ring-offset-2 ring-foreground/40 scale-110" : "hover:scale-105"}`}
          />
        ))}
      </div>
    </div>
  );
}