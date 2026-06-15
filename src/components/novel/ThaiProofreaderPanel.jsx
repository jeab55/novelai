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

export default function ThaiProofreaderPanel({ content, onApplySuggestions }) {
  const [checking, setChecking] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState({ spelling: true, spacing: true, style: true });

  const checkThaiProofreading = async () => {
    if (!content?.trim()) {
      toast.error("ไม่มีเนื้อหาให้ตรวจสอบ");
      return;
    }

    setChecking(true);
    try {
      // ใช้ AI ตรวจสอบคำผิดและการเว้นวรรค
      const response = await base44.functions.invoke('checkThaiSpelling', { content });
      
      const foundSuggestions = [];

      // 1. ตรวจสอบคำที่เขียนผิด
      if (response.spelling_errors && response.spelling_errors.length > 0) {
        foundSuggestions.push({
          group: 'spelling',
          title: 'คำที่อาจเขียนผิด',
          icon: AlertTriangle,
          color: 'orange',
          items: response.spelling_errors.slice(0, 10)
        });
      }

      // 2. ตรวจสอบการเว้นวรรค
      if (response.spacing_issues && response.spacing_issues.length > 0) {
        foundSuggestions.push({
          group: 'spacing',
          title: 'การเว้นวรรค',
          icon: AlertTriangle,
          color: 'blue',
          items: response.spacing_issues.slice(0, 10)
        });
      }

      // 3. ตรวจสอบสไตล์การเขียน
      if (response.style_issues && response.style_issues.length > 0) {
        foundSuggestions.push({
          group: 'style',
          title: 'สไตล์การเขียน',
          icon: Sparkles,
          color: 'purple',
          items: response.style_issues.slice(0, 10)
        });
      }

      // Fallback: ตรวจสอบด้วย rule-based ถ้า AI ไม่พบอะไร
      if (foundSuggestions.length === 0) {
        // ตรวจสอบคำที่เขียนผิดแบบ rule-based
        const spellingMistakes = [];
        Object.entries(COMMON_MISTAKES).forEach(([wrong, correct]) => {
          const regex = new RegExp(wrong, 'g');
          const matches = [...content.matchAll(regex)];
          if (matches.length > 0) {
            matches.forEach(match => {
              spellingMistakes.push({
                type: 'spelling',
                wrong: wrong,
                correct: correct,
                position: match.index,
                context: content.slice(Math.max(0, match.index - 20), Math.min(content.length, match.index + wrong.length + 20))
              });
            });
          }
        });

        if (spellingMistakes.length > 0) {
          foundSuggestions.push({
            group: 'spelling',
            title: 'คำที่อาจเขียนผิด',
            icon: AlertTriangle,
            color: 'orange',
            items: spellingMistakes.slice(0, 10)
          });
        }

        // ตรวจสอบการเว้นวรรค
        const spacingIssues = [];
        const multipleSpaces = [...content.matchAll(/\s{2,}/g)];
        if (multipleSpaces.length > 0) {
          spacingIssues.push({
            type: 'spacing',
            issue: 'ช่องว่างเกิน',
            count: multipleSpaces.length,
            suggestion: 'รวมช่องว่างหลายช่องเป็นช่องเดียว'
          });
        }

        SHOULD_SPACE_BEFORE.forEach(word => {
          const regex = new RegExp(`([^\\s])${word}`, 'g');
          const matches = [...content.matchAll(regex)];
          if (matches.length > 0) {
            spacingIssues.push({
              type: 'spacing',
              issue: `อาจต้องเว้นวรรคก่อน "${word}"`,
              count: matches.length,
              suggestion: `เพิ่มช่องว่างก่อน "${word}"`
            });
          }
        });

        if (spacingIssues.length > 0) {
          foundSuggestions.push({
            group: 'spacing',
            title: 'การเว้นวรรค',
            icon: AlertTriangle,
            color: 'blue',
            items: spacingIssues.slice(0, 10)
          });
        }

        // ตรวจสอบสไตล์
        const styleIssues = [];
        const repeatedWords = [...content.matchAll(/(\w+)\s+\1/g)];
        if (repeatedWords.length > 0) {
          styleIssues.push({
            type: 'style',
            issue: 'คำซ้ำ',
            count: repeatedWords.length,
            suggestion: 'ตรวจสอบการใช้คำซ้ำ'
          });
        }

        const longSentences = content.split(/[.!?।]/).filter(s => s.trim().length > 100);
        if (longSentences.length > 0) {
          styleIssues.push({
            type: 'style',
            issue: 'ประโยคยาวเกินไป',
            count: longSentences.length,
            suggestion: 'แบ่งประโยคให้อ่านง่ายขึ้น'
          });
        }

        if (styleIssues.length > 0) {
          foundSuggestions.push({
            group: 'style',
            title: 'สไตล์การเขียน',
            icon: Sparkles,
            color: 'purple',
            items: styleIssues
          });
        }
      }

      setSuggestions(foundSuggestions);
      
      if (foundSuggestions.length === 0) {
        toast.success("ไม่พบข้อผิดพลาด - เนื้อหาดีมาก! ✅");
      } else {
        toast.info(`พบ ${foundSuggestions.reduce((sum, g) => sum + g.items.length, 0)} จุดที่ควรปรับปรุง`);
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
        if (item.type === 'spelling' && item.wrong && item.correct) {
          const regex = new RegExp(item.wrong, 'g');
          updatedContent = updatedContent.replace(regex, item.correct);
        }
      });
    });

    // แก้ไขการเว้นวรรค
    updatedContent = updatedContent.replace(/\s{2,}/g, ' ');
    updatedContent = updatedContent.trim();

    onApplySuggestions(updatedContent);
    toast.success("ใช้คำแนะนำทั้งหมดแล้ว");
  };

  const getColorClasses = (color) => {
    const classes = {
      orange: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400',
      blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400',
      purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-400',
      green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400',
    };
    return classes[color] || classes.orange;
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
                            <div>
                              {item.type === 'spelling' ? (
                                <div>
                                  <span className="line-through text-red-500">{item.wrong}</span>
                                  {" → "}
                                  <span className="text-green-600 font-medium">{item.correct}</span>
                                  {item.context && (
                                    <div className="text-muted-foreground mt-1 truncate">
                                      ...{item.context}...
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div>
                                  <span className="font-medium">{item.issue}</span>
                                  {item.count && (
                                    <span className="text-muted-foreground ml-1">({item.count} จุด)</span>
                                  )}
                                  {item.suggestion && (
                                    <div className="text-muted-foreground mt-0.5">
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