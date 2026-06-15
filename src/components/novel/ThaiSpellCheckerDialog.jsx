import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, XCircle, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function ThaiSpellCheckerDialog({ content, novel, onApplyChanges, open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [selectedChanges, setSelectedChanges] = useState([]);

  const handleCheck = async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke("checkThaiSpelling", { content, novel });
      setResults(response.data);
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการตรวจคำผิด");
    } finally {
      setLoading(false);
    }
  };

  const toggleChange = (index, type) => {
    const key = `${type}-${index}`;
    setSelectedChanges(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleApply = async () => {
    if (!results) return;
    
    let updatedContent = content;
    const allErrors = [
      ...(results.spelling_errors || []).map(e => ({ ...e, type: "spelling" })),
      ...(results.word_suggestions || []).map(s => ({ ...s, type: "suggestion" })),
    ];

    // เรียงจากตำแหน่งมากไปน้อย เพื่อไม่ให้ตำแหน่งเลื่อน
    allErrors.sort((a, b) => (b.position || 0) - (a.position || 0));

    allErrors.forEach((item) => {
      const key = `${item.type}-${item.index}`;
      if (selectedChanges.includes(key) && item.position !== undefined) {
        const wrong = item.wrong || item.original;
        const correct = item.correct || item.suggested;
        const idx = updatedContent.indexOf(wrong, item.position);
        if (idx !== -1) {
          updatedContent = updatedContent.slice(0, idx) + correct + updatedContent.slice(idx + wrong.length);
        }
      }
    });

    onApplyChanges(updatedContent);
    toast.success(`แก้ไข ${selectedChanges.length} คำแล้ว`);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            ตรวจคำถูกผิด
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 overflow-hidden">
          {!results && !loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">กดปุ่มด้านล่างเพื่อตรวจคำผิด</p>
              <Button onClick={handleCheck} size="lg">
                เริ่มตรวจคำผิด
              </Button>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">กำลังตรวจคำผิด...</p>
            </div>
          )}

          {results && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    สะกดผิด: {results.spelling_errors?.length || 0}
                  </Badge>
                  <Badge variant="secondary">
                    คำแนะนำ: {results.word_suggestions?.length || 0}
                  </Badge>
                  <Badge variant="secondary">
                    การันต์: {results.garant_issues?.length || 0}
                  </Badge>
                  <Badge variant="secondary">
                    ไม้ยมก: {results.yamok_issues?.length || 0}
                  </Badge>
                  <Badge variant="secondary">
                    วรรณยุกต์: {results.tone_issues?.length || 0}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setSelectedChanges([]); setResults(null); }}>
                    ตรวจใหม่
                  </Button>
                  <Button 
                    onClick={handleApply} 
                    disabled={selectedChanges.length === 0}
                  >
                    แก้ไข {selectedChanges.length} คำที่เลือก
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1 max-h-[50vh]">
                <div className="space-y-4">
                  {results.spelling_errors?.map((error, idx) => (
                    <div
                      key={`spelling-${idx}`}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedChanges.includes(`spelling-${idx}`)
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      }`}
                      onClick={() => toggleChange(idx, "spelling")}
                    >
                      <div className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-destructive shrink-0" />
                        <span className="line-through text-destructive">{error.wrong}</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="font-medium text-emerald-700">{error.correct}</span>
                        {selectedChanges.includes(`spelling-${idx}`) && (
                          <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />
                        )}
                      </div>
                      {error.context && (
                        <p className="text-xs text-muted-foreground mt-2 pl-6">{error.context}</p>
                      )}
                      {error.explanation && (
                        <p className="text-xs text-muted-foreground mt-1 pl-6">{error.explanation}</p>
                      )}
                    </div>
                  ))}

                  {results.word_suggestions?.map((suggestion, idx) => (
                    <div
                      key={`suggestion-${idx}`}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedChanges.includes(`suggestion-${idx}`)
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      }`}
                      onClick={() => toggleChange(idx, "suggestion")}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{suggestion.original}</span>
                        <span className="text-primary font-medium">{suggestion.suggested}</span>
                        {selectedChanges.includes(`suggestion-${idx}`) && (
                          <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />
                        )}
                      </div>
                      {suggestion.context && (
                        <p className="text-xs text-muted-foreground mt-2 pl-6">{suggestion.context}</p>
                      )}
                      {suggestion.reason && (
                        <p className="text-xs text-muted-foreground mt-1 pl-6">{suggestion.reason}</p>
                      )}
                    </div>
                  ))}

                  {results.spacing_issues?.map((issue, idx) => (
                    <div key={`spacing-${idx}`} className="p-3 rounded-lg border bg-muted/30">
                      <p className="font-medium text-sm">{issue.issue}</p>
                      <p className="text-xs text-muted-foreground mt-1">พบ {issue.count} ครั้ง</p>
                      {issue.suggestion && (
                        <p className="text-xs text-muted-foreground mt-1">{issue.suggestion}</p>
                      )}
                      {issue.examples && (
                        <div className="mt-2 space-y-1">
                          {issue.examples.map((ex, i) => (
                            <p key={i} className="text-xs text-destructive">• {ex}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {results.garant_issues?.map((item, idx) => (
                    <div key={`garant-${idx}`} className="p-3 rounded-lg border border-amber-200 bg-amber-50">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-amber-800">{item.word}</span>
                        <span className="text-xs text-amber-600">({item.issue})</span>
                      </div>
                      <p className="text-xs text-amber-700 mt-1">
                        ถูกต้อง: <span className="font-medium">{item.correct}</span>
                      </p>
                      {item.context && (
                        <p className="text-xs text-muted-foreground mt-2">{item.context}</p>
                      )}
                    </div>
                  ))}

                  {results.yamok_issues?.map((item, idx) => (
                    <div key={`yamok-${idx}`} className="p-3 rounded-lg border border-purple-200 bg-purple-50">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-purple-800">{item.word}</span>
                      </div>
                      <p className="text-xs text-purple-700 mt-1">
                        {item.issue}
                      </p>
                      {item.suggestion && (
                        <p className="text-xs text-purple-700 mt-1">
                          แนะนำ: <span className="font-medium">{item.suggestion}</span>
                        </p>
                      )}
                      {item.context && (
                        <p className="text-xs text-muted-foreground mt-2">{item.context}</p>
                      )}
                    </div>
                  ))}

                  {results.tone_issues?.map((item, idx) => (
                    <div key={`tone-${idx}`} className="p-3 rounded-lg border border-blue-200 bg-blue-50">
                      <div className="flex items-center gap-2">
                        <span className="line-through text-blue-600">{item.word}</span>
                        <span className="text-blue-400">→</span>
                        <span className="font-medium text-blue-800">{item.correct}</span>
                      </div>
                      {item.explanation && (
                        <p className="text-xs text-blue-700 mt-1">{item.explanation}</p>
                      )}
                      {item.context && (
                        <p className="text-xs text-muted-foreground mt-2">{item.context}</p>
                      )}
                    </div>
                  ))}

                  {results.anachronistic_words?.map((word, idx) => (
                    <div key={`anachronistic-${idx}`} className="p-3 rounded-lg border bg-amber-50 border-amber-200">
                      <p className="font-medium text-sm text-amber-800">คำไม่สอดคล้องยุค: {word.word}</p>
                      <div className="flex gap-2 mt-2 text-xs">
                        {word.historical_alternative && (
                          <Badge className="bg-amber-100 text-amber-800">
                            ควรใช้: {word.historical_alternative}
                          </Badge>
                        )}
                        {word.modern_alternative && (
                          <Badge variant="outline">
                            หรือ: {word.modern_alternative}
                          </Badge>
                        )}
                      </div>
                      {word.context && (
                        <p className="text-xs text-muted-foreground mt-2">{word.context}</p>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}