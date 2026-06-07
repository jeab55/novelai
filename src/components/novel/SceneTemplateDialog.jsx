import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MapPin, Cloud, Heart, Users, Clock, BookOpen, Sparkles, Loader2, Sun, Moon, CloudRain, Wind } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SceneTemplateDialog({ novelId, chapter, onTemplateComplete, onClose }) {
  const [templateData, setTemplateData] = useState({
    location: "",
    time_of_day: "day",
    weather: "",
    characters_present: "",
    mood: "",
    character_emotions: "",
    sensory_details: "",
    plot_purpose: "",
    conflicts: "",
    historical_context: "",
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const characters = await base44.entities.Character.filter({ novel_id: novelId });
      const plotEvents = await base44.entities.PlotEvent.filter({ novel_id: novelId });
      
      const timeLabels = {
        day: "กลางวัน",
        morning: "เช้า",
        afternoon: "บ่าย",
        evening: "เย็น",
        night: "คืน",
        midnight: "ดึก",
      };

      const prompt = `สร้างฉากนิยายอิงประวัติศาสตร์อยุธยาจากข้อมูลเทมเพลตนี้:

[ข้อมูลฉาก]
- สถานที่: ${templateData.location}
- เวลา: ${timeLabels[templateData.time_of_day]}
- สภาพอากาศ: ${templateData.weather}
- ตัวละครที่อยู่ในฉาก: ${templateData.characters_present}
- อารมณ์/บรรยากาศฉาก: ${templateData.mood}
- ความรู้สึกตัวละคร: ${templateData.character_emotions}
- รายละเอียดประสาทสัมผัส (ภาพ/เสียง/กลิ่น/สัมผัส): ${templateData.sensory_details}
- จุดประสงค์ในพล็อต: ${templateData.plot_purpose}
- ความขัดแย้งในฉาก: ${templateData.conflicts}
- บริบทประวัติศาสตร์ที่ควรอ้างถึง: ${templateData.historical_context}

[ตัวละครที่มีในเรื่อง]
${characters.map(c => `- ${c.name} (${c.role}): อายุ ${c.age}, ${c.personality}, ${c.background}`).join("\n")}

[เหตุการณ์ไทม์ไลน์ที่เกี่ยวข้อง]
${plotEvents.map(e => `- ${e.title} (ลำดับที่ ${e.order}): ${e.description}`).join("\n")}

จงเขียนฉากนี้โดย:
1. ใช้ชื่อตัวละครตรงตามคลังตัวละครเสมอ (มินตรา, คุณหลวงเทพ, อีพลับ, คุณหญิงเรือง, ขุนเดช, หลวงตา)
2. บรรยายสถานที่และสภาพอากาศให้ชัดเจนตั้งแต่เปิดฉาก
3. แสดงอารมณ์ตัวละครผ่าน Show don't tell ไม่บอกตรงๆ
4. สอดแทรกบริบทประวัติศาสตร์อยุธยาอย่างเป็นธรรมชาติ
5. มีความยาวประมาณ 800-1200 คำ
6. ใช้ภาษาไทยโทนซีเปีย เหมาะกับยุคอยุธยา
7. จบฉากด้วย hook ที่ดึงให้อยากอ่านต่อ`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        model: "claude_sonnet_4_6",
      });

      onTemplateComplete(response, templateData);
    } catch (error) {
      console.error("Error generating scene:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const timeOptions = [
    { value: "morning", label: "เช้า", icon: Sun },
    { value: "day", label: "กลางวัน", icon: Sun },
    { value: "afternoon", label: "บ่าย", icon: Sun },
    { value: "evening", label: "เย็น", icon: Sun },
    { value: "night", label: "คืน", icon: Moon },
    { value: "midnight", label: "ดึก", icon: Moon },
  ];

  const weatherOptions = [
    { value: "sunny", label: "แดดจ้า", icon: Sun },
    { value: "cloudy", label: "ครึ้มฟ้าครึ้มฝน", icon: Cloud },
    { value: "rainy", label: "ฝนตก", icon: CloudRain },
    { value: "windy", label: "ลมแรง", icon: Wind },
    { value: "clear", label: "ท้องฟ้าแจ่มใส", icon: Sun },
    { value: "foggy", label: "หมอกจัด", icon: Cloud },
  ];

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            เทมเพลตเขียนฉาก - ตอนที่ {chapter?.order}: {chapter?.title}
          </DialogTitle>
          <DialogDescription className="text-xs">
            กรอกข้อมูลฉากให้ครบถ้วน เพื่อให้ AI ร่างเนื้อหาได้ละเอียดและสอดคล้องกับโครงเรื่อง
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">ข้อมูลพื้นฐาน</TabsTrigger>
            <TabsTrigger value="characters">ตัวละครและอารมณ์</TabsTrigger>
            <TabsTrigger value="plot">พล็อตและบริบท</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  สถานที่ *
                </Label>
                <Input
                  placeholder="เช่น ในจวนคุณหลวงเทพ, วัดนิลกาญจน์, ตลาดท่าน้ำอยุธยา"
                  value={templateData.location}
                  onChange={(e) => setTemplateData({...templateData, location: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    เวลา *
                  </Label>
                  <Select
                    value={templateData.time_of_day}
                    onValueChange={(value) => setTemplateData({...templateData, time_of_day: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกเวลา" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-primary" />
                    สภาพอากาศ *
                  </Label>
                  <Select
                    value={templateData.weather}
                    onValueChange={(value) => setTemplateData({...templateData, weather: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกสภาพอากาศ" />
                    </SelectTrigger>
                    <SelectContent>
                      {weatherOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>รายละเอียดประสาทสัมผัส</Label>
                <Textarea
                  placeholder="อธิบาย ภาพที่ได้เห็น, เสียงที่ได้ยิน, กลิ่น, สัมผัส (เช่น กลิ่นธูปหอมในวัด, เสียงระฆังดังไกล, แสงแดดลอดผ่านใบไม้)"
                  value={templateData.sensory_details}
                  onChange={(e) => setTemplateData({...templateData, sensory_details: e.target.value})}
                  className="min-h-[80px]"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="characters" className="space-y-4 mt-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  ตัวละครที่อยู่ในฉาก *
                </Label>
                <Textarea
                  placeholder="ระบุชื่อตัวละครและบทบาทในฉากนี้ (เช่น มินตราและอีพลับกำลังพูดคุยกัน, คุณหลวงเทพสังเกตมินตราจากระยะไกล)"
                  value={templateData.characters_present}
                  onChange={(e) => setTemplateData({...templateData, characters_present: e.target.value})}
                  className="min-h-[60px]"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-primary" />
                  ความรู้สึกของตัวละคร *
                </Label>
                <Textarea
                  placeholder="อารมณ์และความรู้สึกของตัวละครแต่ละตัวในฉากนี้ (เช่น มินตรากังวลแต่พยายามซ่อน, คุณหลวงเทพสงสัยแต่สนใจ)"
                  value={templateData.character_emotions}
                  onChange={(e) => setTemplateData({...templateData, character_emotions: e.target.value})}
                  className="min-h-[60px]"
                />
              </div>

              <div className="space-y-2">
                <Label>อารมณ์/บรรยากาศฉาก</Label>
                <Select
                  value={templateData.mood}
                  onValueChange={(value) => setTemplateData({...templateData, mood: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกอารมณ์ฉาก" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tense">ตึงเครียด</SelectItem>
                    <SelectItem value="romantic">โรแมนติก</SelectItem>
                    <SelectItem value="mysterious">ลึกลับ</SelectItem>
                    <SelectItem value="peaceful">สงบสุข</SelectItem>
                    <SelectItem value="sad">เศร้า</SelectItem>
                    <SelectItem value="hopeful">มีความหวัง</SelectItem>
                    <SelectItem value="dramatic">ดราม่า</SelectItem>
                    <SelectItem value="lighthearted">เบาสมอง</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="plot" className="space-y-4 mt-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>จุดประสงค์ในพล็อต</Label>
                <Textarea
                  placeholder="ฉากนี้ต้องการขับเคลื่อนเรื่องอย่างไร (เช่น เปิดปมใหม่, พัฒนาความสัมพันธ์, เผยความลับ)"
                  value={templateData.plot_purpose}
                  onChange={(e) => setTemplateData({...templateData, plot_purpose: e.target.value})}
                  className="min-h-[60px]"
                />
              </div>

              <div className="space-y-2">
                <Label>ความขัดแย้งในฉาก</Label>
                <Textarea
                  placeholder="ความขัดแย้งหรืออุปสรรคในฉากนี้ (เช่น มินตราถูกถามจนมุม, คุณหญิงเรืองเผชิญหน้า)"
                  value={templateData.conflicts}
                  onChange={(e) => setTemplateData({...templateData, conflicts: e.target.value})}
                  className="min-h-[60px]"
                />
              </div>

              <div className="space-y-2">
                <Label>บริบทประวัติศาสตร์ที่ควรอ้างถึง</Label>
                <Textarea
                  placeholder="ข้อมูลประวัติศาสตร์ที่ควรแทรก (เช่น งานเทศกาล, ขนบธรรมเนียม, การเมืองยุคอยุธยา)"
                  value={templateData.historical_context}
                  onChange={(e) => setTemplateData({...templateData, historical_context: e.target.value})}
                  className="min-h-[60px]"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onClose()} disabled={isGenerating}>
            ยกเลิก
          </Button>
          <Button 
            onClick={handleGenerate} 
            disabled={isGenerating || !templateData.location || !templateData.time_of_day || !templateData.weather}
            className="gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                กำลังสร้าง...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                สร้างฉากจากเทมเพลต
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}