import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Megaphone, MessagesSquare, Clapperboard } from "lucide-react";
import PublishKitDialog from "@/components/novel/PublishKitDialog";
import ChatModeDialog from "@/components/novel/ChatModeDialog";
import StoryboardDialog from "@/components/novel/StoryboardDialog";

const TOOLS = [
  {
    key: "publishkit",
    icon: Megaphone,
    title: "ชุดประกาศลงแพลตฟอร์ม",
    desc: "สร้างเรื่องย่อสั้น/กลาง/ยาว คำโปรย และแท็ก แล้วบันทึกลงเล่มได้",
    color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-950/30",
  },
  {
    key: "chatmode",
    icon: MessagesSquare,
    title: "โหมดแชต (จอยลดา)",
    desc: "แปลงตอนเป็นบทสนทนาแชต ปรับฝั่ง/สี/ชื่อ และบันทึกเวอร์ชันแชตลงตอน",
    color: "text-indigo-600 bg-indigo-100 dark:bg-indigo-950/30",
  },
  {
    key: "storyboard",
    icon: Clapperboard,
    title: "สตอรีบอร์ดวิดีโอ",
    desc: "แบ่งฉาก เขียนสคริปต์ มุมกล้อง บทพากย์ และพรอมต์ภาพ AI พร้อม export",
    color: "text-rose-600 bg-rose-100 dark:bg-rose-950/30",
  },
];

export default function PublishExportPanel({ novel }) {
  const [openTool, setOpenTool] = useState(null);
  const novels = novel ? [novel] : [];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h2 className="font-heading font-bold text-xl mb-1">เผยแพร่ / ส่งออก</h2>
      <p className="text-sm text-muted-foreground mb-6">เครื่องมือสำหรับนำนิยายไปลงแพลตฟอร์มและสร้างคอนเทนต์</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TOOLS.map(({ key, icon: Icon, title, desc, color }) => (
          <button
            key={key}
            onClick={() => setOpenTool(key)}
            className="text-left bg-card border border-border/60 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-primary/40 transition-all"
          >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <h3 className="font-heading font-semibold mb-1">{title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
          </button>
        ))}
      </div>

      <PublishKitDialog open={openTool === "publishkit"} onClose={() => setOpenTool(null)} novels={novels} />
      <ChatModeDialog open={openTool === "chatmode"} onClose={() => setOpenTool(null)} novels={novels} />
      <StoryboardDialog open={openTool === "storyboard"} onClose={() => setOpenTool(null)} novels={novels} />
    </div>
  );
}