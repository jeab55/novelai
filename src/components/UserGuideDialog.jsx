import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Cat,
  BookOpen,
  Sparkles,
  PenLine,
  Users,
  Clock,
  Globe,
  Bot,
  Network,
  FileEdit,
  ListChecks,
  SpellCheck,
  Download,
  Save,
} from "lucide-react";

const SECTIONS = [
  {
    step: 1,
    icon: BookOpen,
    title: "ชั้นวางหนังสือ (หน้าแรก)",
    points: [
      "หน้าแรกคือ “ชั้นวางหนังสือ” รวมนิยายทุกเรื่องของคุณไว้เป็นการ์ด",
      "กดปุ่ม “สร้างเรื่องใหม่” เพื่อเริ่มนิยายเรื่องใหม่ด้วยตัวช่วย AI",
      "กดปุ่ม “เรื่องสั้น AI” เพื่อให้ AI ช่วยเขียนเรื่องสั้นจบในตอนเดียว",
      "บนการ์ดแต่ละเรื่องมีเมนูสำหรับแก้ไข แชร์ หรือทำเครื่องหมายว่าจบแล้ว",
    ],
  },
  {
    step: 2,
    icon: Sparkles,
    title: "สร้างเรื่องใหม่และกรอกข้อมูลตั้งต้น",
    points: [
      "กรอกชื่อเรื่อง เลือกแนว (โรแมนติก แฟนตาซี ฯลฯ) และเขียนเรื่องย่อ",
      "ระบุยุคสมัย จำนวนตอนเป้าหมาย และจำนวนคำต่อตอนที่ต้องการ",
      "เลือก “นักเขียน AI” เพื่อล็อกสไตล์การเขียนให้คงที่ทั้งเรื่อง",
      "เพิ่มตัวละครหลักได้ตั้งแต่ต้น — AI จะช่วยวางโครงเรื่อง 3 องก์ให้อัตโนมัติ",
    ],
  },
  {
    step: 3,
    icon: Network,
    title: "แท็บต่างๆ ในหน้าเรื่อง",
    points: [
      "ตัวละคร 👥 — สร้างและจัดการตัวละคร พร้อมให้ AI วิเคราะห์มิติตัวละคร",
      "ไทม์ไลน์ ⏰ — เรียงลำดับเหตุการณ์สำคัญและช่วงเวลาของเรื่อง",
      "โลก/ฉาก 🌐 — บันทึกสถานที่ ขนบธรรมเนียม และระบบต่างๆ ในโลกของเรื่อง",
      "นักเขียน AI 🤖 — เลือก/แก้ไขสไตล์นักเขียนที่ใช้สร้างเนื้อหา",
      "วิเคราะห์พล็อต 🔍 — ตรวจความต่อเนื่องและช่องโหว่ของพล็อต",
      "ห้องเขียน ✍️ — ศูนย์รวมการจัดการตอนทั้งหมดของเรื่อง",
    ],
  },
  {
    step: 4,
    icon: PenLine,
    title: "ห้องเขียน",
    points: [
      "สร้างตอน — เพิ่มตอนใหม่ทีละตอนเพื่อเริ่มเขียน",
      "สร้างร่างด้วย AI — ให้ AI ร่างเนื้อหาตอนตามโครงเรื่องและสไตล์นักเขียน",
      "สร้างตอนทั้งหมด — ให้ AI เขียนต่อเนื่องหลายตอนรวด พร้อมบันทึกความคืบหน้า",
      "ตรวจคำผิด — ตรวจการสะกด ไวยากรณ์ และเครื่องหมายภาษาไทย",
      "ส่งออก — ดาวน์โหลดนิยายเป็นไฟล์เพื่อนำไปใช้ต่อ",
    ],
  },
  {
    step: 5,
    icon: FileEdit,
    title: "หน้าเขียนตอนและเครื่องมือ AI",
    points: [
      "เขียนเนื้อหาได้อิสระ พร้อมเครื่องมือ AI ช่วยร่าง ขัดเกลา และตรวจทาน",
      "มีระบบบันทึกอัตโนมัติ — พิมพ์แล้วระบบบันทึกให้เองภายในไม่กี่วินาที",
      "ดูสถานะ “กำลังบันทึก…” และ “บันทึกแล้ว” ที่มุมจอได้ตลอดเวลา",
      "จำนวนคำอัปเดตอัตโนมัติ และมีประวัติเวอร์ชันให้ย้อนกลับได้",
    ],
  },
];

const TAB_ICONS = {
  "ตัวละคร": Users,
  "ไทม์ไลน์": Clock,
  "โลก/ฉาก": Globe,
  "นักเขียน AI": Bot,
  "วิเคราะห์พล็อต": Network,
  "ห้องเขียน": PenLine,
};

const TOOL_ICONS = {
  "สร้างตอน": FileEdit,
  "สร้างร่างด้วย AI": Sparkles,
  "สร้างตอนทั้งหมด": ListChecks,
  "ตรวจคำผิด": SpellCheck,
  "ส่งออก": Download,
};

function PointRow({ text, step }) {
  const label = text.split(" — ")[0].trim();
  let LeadIcon = null;
  if (step === 3) LeadIcon = TAB_ICONS[label] || null;
  if (step === 4) LeadIcon = TOOL_ICONS[label] || null;
  if (step === 5 && text.includes("บันทึกอัตโนมัติ")) LeadIcon = Save;

  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-1.5 shrink-0">
        {LeadIcon ? (
          <LeadIcon className="w-4 h-4 text-orange-500" />
        ) : (
          <span className="block w-1.5 h-1.5 rounded-full bg-orange-400" />
        )}
      </span>
      <span className="text-sm leading-relaxed text-foreground/90">{text}</span>
    </li>
  );
}

export default function UserGuideDialog({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden border-amber-200/60">
        {/* Header */}
        <DialogHeader className="bg-gradient-to-br from-amber-400 via-orange-400 to-orange-500 px-6 py-5 text-left">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/25 border-2 border-white/40 flex items-center justify-center shadow-inner shrink-0">
              <Cat className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-white font-heading text-xl">วิธีการใช้งาน 🐾</DialogTitle>
              <DialogDescription className="text-white/90 text-sm mt-0.5">
                คู่มือทีละขั้น ให้คุณเริ่มเขียนนิยายกับเนโกะ เวลธ์ ได้ทันที
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <ScrollArea className="max-h-[65vh]">
          <div className="px-6 py-5 space-y-5">
            {SECTIONS.map(({ step, icon: Icon, title, points }) => (
              <div
                key={step}
                className="rounded-2xl border border-amber-200/60 bg-amber-50/40 dark:bg-amber-950/10 p-4"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm shrink-0">
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-heading font-bold text-foreground flex items-center gap-2">
                    <span className="text-orange-500">ขั้นที่ {step}</span>
                    <span className="text-muted-foreground/50">·</span>
                    <span>{title}</span>
                  </h3>
                </div>
                <ul className="space-y-2 pl-1">
                  {points.map((p, i) => (
                    <PointRow key={i} text={p} step={step} />
                  ))}
                </ul>
              </div>
            ))}

            <div className="rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200/60 p-4 text-center">
              <p className="text-sm text-foreground/80 font-medium">
                พร้อมแล้ว! เริ่มสร้างเรื่องแรกของคุณได้เลย 🐱✨
              </p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}