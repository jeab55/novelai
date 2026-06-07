import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Sparkles, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// วิเคราะห์สมดุล 4 ส่วน
function analyzeBalance(content) {
  if (!content) return { dialogue: 0, description: 0, action: 0, exposition: 0, total: 0 };
  
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim());
  let dialogue = 0, description = 0, action = 0, exposition = 0;
  
  paragraphs.forEach(p => {
    const text = p.trim();
    // บทสนทนา: มีเครื่องหมายคำพูด
    if (text.includes('"') || text.includes('“') || text.includes('”') || text.includes('\'')) {
      dialogue += 1;
    }
    // บทบรรยาย: มีคำกริยาเกี่ยวกับความรู้สึก/ภาพ
    else if (/\ มอง\ |\ เห็น\ |\ รู้สึก\ |\ ได้กลิ่น\ |\ สัมผัส\ |\ ฟัง\ |\ Appears\ |\ looks\ |\ feels\ |/.test(text)) {
      description += 1;
    }
    // บทดำเนินเรื่อง: มีกริยาเคลื่อนไหว
    else if (/\ เดิน\ |\ วิ่ง\ |\ ทำ\ |\ พูด\ |\ จับ\ |\ ยก\ |\ หัน\ |\ ก้าว\ |\ move\ |walk\ |run\ |do\ |say\ /.test(text)) {
      action += 1;
    }
    // บทอธิบาย: ยาวและมีข้อมูล
    else if (text.length > 80 || /\ เพราะ\ |\ เนื่องจาก\ |\ ซึ่ง\ |\ ที่\ |\ ซึ่งหมายถึง\ |\ known\ |because\ |which\ /.test(text)) {
      exposition += 1;
    } else {
      action += 1; // default
    }
  });
  
  const total = dialogue + description + action + exposition;
  return { dialogue, description, action, exposition, total };
}

function getRecommendations(balance) {
  const recs = [];
  if (balance.total === 0) return recs;
  
  const pct = {
    dialogue: (balance.dialogue / balance.total) * 100,
    description: (balance.description / balance.total) * 100,
    action: (balance.action / balance.total) * 100,
    exposition: (balance.exposition / balance.total) * 100,
  };
  
  if (pct.dialogue < 15) recs.push({ type: "low", part: "บทสนทนา", msg: "เพิ่มบทสนทนาเพื่อให้ตัวละครมีชีวิตชีวา" });
  if (pct.dialogue > 40) recs.push({ type: "high", part: "บทสนทนา", msg: "ลดบทสนทนา เพิ่มบทบรรยายหรือการกระทำ" });
  
  if (pct.description < 15) recs.push({ type: "low", part: "บทบรรยาย", msg: "เพิ่มรายละเอียดภาพ/บรรยากาศ/ประสาทสัมผัส" });
  if (pct.description > 35) recs.push({ type: "high", part: "บทบรรยาย", msg: "ลดบทบรรยาย เพิ่มการดำเนินเรื่อง" });
  
  if (pct.action < 20) recs.push({ type: "low", part: "บทดำเนินเรื่อง", msg: "เพิ่มการกระทำที่พาเรื่องไปข้างหน้า" });
  if (pct.action > 45) recs.push({ type: "high", part: "บทดำเนินเรื่อง", msg: "ลดการกระทำ เพิ่มบทบรรยายหรือสนทนา" });
  
  if (pct.exposition < 10) recs.push({ type: "low", part: "บทอธิบาย", msg: "เพิ่มข้อมูลปูมหลังหรือบริบทอย่างธรรมชาติ" });
  if (pct.exposition > 25) recs.push({ type: "high", part: "บทอธิบาย", msg: "ลดบทอธิบาย ใช้ Show don't tell แทน" });
  
  return recs;
}

export default function ChapterBalanceMeter({ content, onClose }) {
  const [balance, setBalance] = useState({ dialogue: 0, description: 0, action: 0, exposition: 0, total: 0 });
  const [recs, setRecs] = useState([]);
  const [open, setOpen] = useState(true);
  
  useEffect(() => {
    const b = analyzeBalance(content);
    setBalance(b);
    setRecs(getRecommendations(b));
  }, [content]);
  
  const pct = balance.total > 0 ? {
    dialogue: Math.round((balance.dialogue / balance.total) * 100),
    description: Math.round((balance.description / balance.total) * 100),
    action: Math.round((balance.action / balance.total) * 100),
    exposition: Math.round((balance.exposition / balance.total) * 100),
  } : { dialogue: 0, description: 0, action: 0, exposition: 0 };
  
  const ideal = { dialogue: 25, description: 25, action: 30, exposition: 20 };
  
  const handleClose = () => {
    setOpen(false);
    if (onClose) onClose();
  };
  
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            มิเตอร์สมดุลเนื้อหา
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            วิเคราะห์สัดส่วน 4 ส่วนของตอน พร้อมคำแนะนำ
          </p>
        </DialogHeader>
        
        <div className="space-y-4 mt-2">
          {/* สถานะสมดุล */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">บทสนทนา</span>
                <span className="font-medium">{pct.dialogue}%</span>
              </div>
              <Progress value={pct.dialogue} className="h-2" />
              <p className="text-[10px] text-muted-foreground">เหมาะ: ~{ideal.dialogue}%</p>
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">บทบรรยาย</span>
                <span className="font-medium">{pct.description}%</span>
              </div>
              <Progress value={pct.description} className="h-2" />
              <p className="text-[10px] text-muted-foreground">เหมาะ: ~{ideal.description}%</p>
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">บทดำเนินเรื่อง</span>
                <span className="font-medium">{pct.action}%</span>
              </div>
              <Progress value={pct.action} className="h-2" />
              <p className="text-[10px] text-muted-foreground">เหมาะ: ~{ideal.action}%</p>
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">บทอธิบาย</span>
                <span className="font-medium">{pct.exposition}%</span>
              </div>
              <Progress value={pct.exposition} className="h-2" />
              <p className="text-[10px] text-muted-foreground">เหมาะ: ~{ideal.exposition}%</p>
            </div>
          </div>
          
          {/* คำแนะนำ */}
          {recs.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-1.5 text-amber-800">
                  <AlertCircle className="w-3.5 h-3.5" />
                  คำแนะนำ
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 pt-0">
                {recs.map((r, i) => (
                  <div key={i} className="text-xs flex items-start gap-1.5">
                    {r.type === "low" ? (
                      <span className="text-amber-600">↓</span>
                    ) : (
                      <span className="text-red-600">↑</span>
                    )}
                    <span>
                      <span className="font-medium">{r.part}:</span> {r.msg}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          
          {recs.length === 0 && balance.total > 0 && (
            <Card className="border-emerald-200 bg-emerald-50/50">
              <CardContent className="py-3">
                <div className="flex items-center gap-2 text-xs text-emerald-800">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>สมดุลดี! เนื้อหามีความหลากหลายของ 4 ส่วน</span>
                </div>
              </CardContent>
            </Card>
          )}
          
          <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/40">
            <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              การวิเคราะห์ใช้ฮิวริสติกจากโครงสร้างประโยคและคำสำคัญ ผลลัพธ์เป็นค่าประมาณเพื่อใช้เป็นแนวทาง
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}