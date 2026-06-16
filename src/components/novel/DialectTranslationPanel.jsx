import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles, Loader2, Languages } from "lucide-react";
import { toast } from "sonner";

export default function DialectTranslationPanel({ content, novel, onApplyTranslation }) {
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationOpen, setTranslationOpen] = useState(false);
  const [translations, setTranslations] = useState([]);

  const handleTranslate = async () => {
    if (!content) {
      toast.error("ไม่มีเนื้อหาให้แปล");
      return;
    }

    setIsTranslating(true);
    setTranslationOpen(true);

    try {
      // ดึงตัวละครทั้งหมดจากนิยาย
      const characters = await base44.entities.Character.filter({ novel_id: novel.id });
      const dialectChars = characters.filter(c => c.dialect && c.dialect !== "กลาง" && c.dialect_examples);

      if (dialectChars.length === 0) {
        toast.info("ไม่มีตัวละครที่ตั้งค่าภาษาถิ่น");
        setIsTranslating(false);
        return;
      }

      // สร้าง prompt สำหรับแปลภาษาถิ่น
      const dialectContext = dialectChars.map(c => 
        `${c.name} (${c.dialect}): ${c.dialect_examples || ''}`
      ).join('\n');

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `วิเคราะห์เนื้อหาต่อไปนี้อย่างละเอียด โดยค้นหาคำพูดหรือประโยคที่ตัวละครใช้ภาษาถิ่น (อีสาน เหนือ ใต้ ตะวันออก) 

เนื้อหา:
${content}

ข้อมูลตัวละครและภาษาถิ่น:
${dialectContext}

สำหรับแต่ละประโยคที่มีภาษาถิ่น ให้ระบุ:
1. ประโยคต้นฉบับ
2. ภาษาถิ่นที่ใช้
3. คำแปลภาษาไทยกลาง

ส่งผลลัพธ์เป็น JSON array ตามรูปแบบนี้เท่านั้น (ไม่มีข้อความอื่น):
[
  {
    "original": "ประโยคภาษาถิ่น",
    "dialect": "ชื่อภาษาถิ่น",
    "translation": "คำแปลภาษาไทยกลาง"
  }
]

ถ้าไม่มีภาษาถิ่นในเนื้อหา ให้ส่ง array ว่าง []`
      });

      let parsedData = response.data;
      if (typeof parsedData === 'string') {
        try {
          parsedData = JSON.parse(parsedData);
        } catch {
          const jsonMatch = parsedData.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            parsedData = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('No valid JSON found');
          }
        }
      }

      setTranslations(parsedData || []);
      
      if (parsedData.length === 0) {
        toast.info("ไม่พบภาษาถิ่นในเนื้อหา");
      } else {
        toast.success(`พบ ${parsedData.length} ประโยคที่ต้องแปล`);
      }
    } catch (error) {
      console.error("Translation error:", error);
      toast.error("ไม่สามารถแปลภาษาถิ่นได้: " + error.message);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleApplyTranslations = () => {
    if (translations.length === 0) return;

    let newContent = content;
    
    // เพิ่มคำแปลในวงเล็บหลังแต่ละประโยค
    translations.forEach(({ original, translation }) => {
      if (original && translation) {
        // แทนที่ประโยคเดิมด้วยประโยคเดิม + คำแปลในวงเล็บ
        const regex = new RegExp(original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        newContent = newContent.replace(regex, `${original} (${translation})`);
      }
    });

    onApplyTranslation(newContent);
    setTranslationOpen(false);
    toast.success("เพิ่มคำแปลภาษาถิ่นแล้ว");
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 h-8 text-xs border-orange-300 hover:bg-orange-50 text-orange-700"
        onClick={handleTranslate}
        disabled={isTranslating || !content}
        title="แปลภาษาถิ่นเป็นภาษาไทยกลาง"
      >
        <Languages className="w-3.5 h-3.5" />
        แปลภาษาถิ่น
      </Button>

      <Dialog open={translationOpen} onOpenChange={setTranslationOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <Languages className="w-5 h-5 text-orange-600" />
              แปลภาษาถิ่นเป็นภาษาไทยกลาง
            </DialogTitle>
          </DialogHeader>

          {isTranslating ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-orange-600 mb-4" />
              <p className="text-muted-foreground">กำลังวิเคราะห์และแปลภาษาถิ่น...</p>
            </div>
          ) : translations.length > 0 ? (
            <div className="space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-sm text-orange-800 font-medium mb-2">
                  พบ {translations.length} ประโยคที่ใช้ภาษาถิ่น:
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {translations.map((item, idx) => (
                    <div key={idx} className="bg-white rounded p-3 border border-orange-100">
                      <div className="flex items-start gap-2 mb-1">
                        <Badge className="bg-orange-100 text-orange-700 text-xs">
                          {item.dialect}
                        </Badge>
                        <span className="font-medium text-sm">{item.original}</span>
                      </div>
                      <div className="text-sm text-muted-foreground ml-14">
                        → {item.translation}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setTranslationOpen(false)}>
                  ปิด
                </Button>
                <Button onClick={handleApplyTranslations} className="bg-orange-600 hover:bg-orange-700">
                  <Sparkles className="w-4 h-4 mr-2" />
                  เพิ่มคำแปลในเนื้อหา
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Languages className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">ไม่พบภาษาถิ่นในเนื้อหา</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}