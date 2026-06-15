import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, XCircle, AlertTriangle, Sparkles, Loader2, ChevronRight, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

// คำที่พบบ่อยที่มักเขียนผิด
const COMMON_MISTAKES = {
  "ครับ": "ค่ะ",
  "ค่ะ": "ครับ",
  "นะค่ะ": "นะคะ",
  "จ๊ะค่ะ": "จ๊ะ",
  "อ่า": "อา",
  "อ่ะ": "อะ",
  "ม่ะ": "มะ",
  "จ้ะค่ะ": "จ้ะ",
  "แล้วก้อ": "แล้วก็",
  "แล้วก็": "แล้วก็",
  "ม่อง": "มอง",
  "งัย": "ไง",
  "จุง": "จัง",
  "อ้ะ": "อะ",
  "เทอ": "เธอ",
  "เขะ": "เขา",
  "เราะ": "เรา",
  "มะไร": "อะไร",
  "ป่ะ": "เปล่า",
  "มะ": "ไม่",
};

// กฎการเว้นวรรคภาษาไทย
const THAI_SPACING_RULES = [
  { pattern: /\s+ก่อน/g, replacement: "ก่อน", description: "ลบช่องว่างเกินก่อนคำ" },
  { pattern: /ก่อน\s+/g, replacement: "ก่อน", description: "ลบช่องว่างเกินหลังคำ" },
  { pattern: /\s+/g, replacement: " ", description: "รวมช่องว่างหลายช่องเป็นช่องเดียว" },
];

// คำที่ควรเว้นวรรค
const SHOULD_SPACE_BEFORE = ["ครับ", "ค่ะ", "นะคะ", "นะครับ", "จ้ะ", "นะ", "หรือ", "แต่", "และ", "ก็", "จึง", "ดังนั้น", "เพราะ", "ถ้า", "เมื่อ", "_while", "แม้"];

export default function ThaiProofreaderPanel({ content, onApplySuggestions, novel }) {
  const [checking, setChecking] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState({ spelling: true, words: true, spacing: true, anachronistic: true });

  const checkThaiProofreading = async () => {
    if (!content?.trim()) {
      toast.error("ไม่มีเนื้อหาให้ตรวจสอบ");
      return;
    }

    setChecking(true);
    try {
      // ใช้ AI ตรวจสอบคำผิดและการเว้นวรรค
      const response = await base44.functions.invoke('checkThaiSpelling', { content, novel });
      
      const foundSuggestions = [];

      // 1. ตรวจสอบคำที่เขียนผิด
      if (response.spelling_errors && response.spelling_errors.length > 0) {
        foundSuggestions.push({
          group: 'spelling',
          title: 'คำที่สะกดผิด',
          icon: AlertTriangle,
          color: 'red',
          items: response.spelling_errors.slice(0, 15)
        });
      }

      // 2. คำแนะนำคำที่เหมาะสม
      if (response.word_suggestions && response.word_suggestions.length > 0) {
        foundSuggestions.push({
          group: 'words',
          title: 'คำแนะนำคำที่เหมาะสม',
          icon: Sparkles,
          color: 'green',
          items: response.word_suggestions.slice(0, 15)
        });
      }

      // 3. คำที่ไม่สอดคล้องกับยุคสมัย (สำหรับนิยายอิงประวัติศาสตร์)
      if (response.anachronistic_words && response.anachronistic_words.length > 0) {
        foundSuggestions.push({
          group: 'anachronistic',
          title: 'คำที่ไม่สอดคล้องกับยุคสมัย',
          icon: AlertTriangle,
          color: 'purple',
          items: response.anachronistic_words.slice(0, 15)
        });
      }

      // 4. ตรวจสอบการเว้นวรรค
      if (response.spacing_issues && response.spacing_issues.length > 0) {
        foundSuggestions.push({
          group: 'spacing',
          title: 'การเว้นวรรค',
          icon: AlertTriangle,
          color: 'blue',
          items: response.spacing_issues.slice(0, 10)
        });
      }

      setSuggestions(foundSuggestions);
      
      if (foundSuggestions.length === 0) {
        toast.success("ไม่พบข้อผิดพลาด - เนื้อหาดีมาก! ✅");
      } else {
        const totalIssues = foundSuggestions.reduce((sum, g) => sum + g.items.length, 0);
        toast.info(`พบ ${totalIssues} จุดที่ควรปรับปรุง`);
      }
    } catch (err) {
      console.error('Proofreading error:', err);
      toast.error("เกิดข้อผิดพลาดในการตรวจสอบ");
    } finally {
      setChecking(false);
    }
  };

  const toggleGroup = (group) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const applyAllSuggestions = () => {
    let updatedContent = content;

    suggestions.forEach(group => {
      group.items.forEach(item => {
        // แก้คำผิด
        if (item.wrong && item.correct) {
          const regex = new RegExp(item.wrong, 'g');
          updatedContent = updatedContent.replace(regex, item.correct);
        }
        // แก้ไขตามคำแนะนำ
        if (item.original && item.suggestion) {
          const regex = new RegExp(item.original, 'g');
          updatedContent = updatedContent.replace(regex, item.suggestion);
        }
      });
    });

    onApplySuggestions(updatedContent);
    toast.success("ใช้คำแนะนำทั้งหมดแล้ว");
  };

  const getColorClasses = (color) => {
    const classes = {
      red: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400',
      orange: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400',
      blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400',
      purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-400',
      green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400',
    };
    return classes[color] || classes.red;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          ตรวจคำผิดและการเว้นวรรค
        </h3>
        <div className="flex gap-2">
          {suggestions.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={applyAllSuggestions}
              className="text-xs h-7"
            >
              ใช้ทั้งหมด
            </Button>
          )}
          <Button
            size="sm"
            onClick={checkThaiProofreading}
            disabled={checking}
            className="text-xs h-7 gap-1"
          >
            {checking ? (
              <><Loader2 className="w-3 h-3 animate-spin" />กำลังตรวจสอบ...</>
            ) : (
              <><Sparkles className="w-3 h-3" />ตรวจสอบ</>
            )}
          </Button>
        </div>
      </div>

      {suggestions.length > 0 && (
        <ScrollArea className="h-[300px] w-full rounded-md border p-3">
          <div className="space-y-3">
            {suggestions.map((group) => {
              const Icon = group.icon;
              const isExpanded = expandedGroups[group.group];
              
              return (
                <div key={group.group} className="space-y-2">
                  <button
                    onClick={() => toggleGroup(group.group)}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 text-${group.color}-600`} />
                      <span className="text-sm font-medium">{group.title}</span>
                      <Badge variant="secondary" className="text-xs">
                        {group.items.length}
                      </Badge>
                    </div>
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>

                  {isExpanded && (
                    <div className={`ml-4 p-3 rounded-lg border ${getColorClasses(group.color)}`}>
                      <div className="space-y-2 text-xs">
                        {group.items.map((item, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                            <div className="flex-1">
                              {/* คำผิด */}
                              {item.wrong && item.correct && (
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="line-through text-red-500 font-medium">{item.wrong}</span>
                                    <span className="text-muted-foreground">→</span>
                                    <span className="text-green-600 font-semibold">{item.correct}</span>
                                  </div>
                                  {item.explanation && (
                                    <div className="text-muted-foreground mt-1 text-[11px]">
                                      💡 {item.explanation}
                                    </div>
                                  )}
                                  {item.context && (
                                    <div className="text-muted-foreground/60 mt-1 text-[11px] truncate bg-muted/30 px-2 py-1 rounded">
                                      ...{item.context}...
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {/* คำแนะนำ */}
                              {item.original && item.suggested && (
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-orange-600">{item.original}</span>
                                    <span className="text-muted-foreground">→</span>
                                    <span className="text-green-600 font-semibold">{item.suggested}</span>
                                  </div>
                                  {item.reason && (
                                    <div className="text-muted-foreground mt-1 text-[11px]">
                                      💡 {item.reason}
                                    </div>
                                  )}
                                  {item.context && (
                                    <div className="text-muted-foreground/60 mt-1 text-[11px] truncate bg-muted/30 px-2 py-1 rounded">
                                      ...{item.context}...
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {/* คำที่ไม่สอดคล้องยุคสมัย */}
                              {item.word && (
                                <div>
                                  <div className="font-medium text-purple-700 dark:text-purple-400">
                                    ⚠️ {item.word}
                                  </div>
                                  {item.historical_alternative && (
                                    <div className="mt-1">
                                      <span className="text-muted-foreground">แนะนำใช้: </span>
                                      <span className="text-green-600 font-semibold">{item.historical_alternative}</span>
                                    </div>
                                  )}
                                  {item.context && (
                                    <div className="text-muted-foreground/60 mt-1 text-[11px] truncate bg-muted/30 px-2 py-1 rounded">
                                      ...{item.context}...
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {/* ปัญหาการเว้นวรรค */}
                              {item.issue && (
                                <div>
                                  <div className="font-medium">{item.issue}</div>
                                  {item.count && (
                                    <span className="text-muted-foreground ml-1">({item.count} จุด)</span>
                                  )}
                                  {item.suggestion && (
                                    <div className="text-muted-foreground mt-0.5 text-[11px]">
                                      💡 {item.suggestion}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {suggestions.length === 0 && !checking && content?.trim() && (
        <div className="p-3 rounded-lg border bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            <span>เนื้อหาผ่านการตรวจสอบ - ไม่พบข้อผิดพลาด</span>
          </div>
        </div>
      )}
    </div>
  );
}