import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, XCircle, Loader2, Sparkles, Wand2, ArrowRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

// แก้เฉพาะข้อผิดพลาดเชิงกลไกเท่านั้น (ตัวสะกด/วรรคตอน/อักขระเพี้ยน)
// ไม่รวม word_suggestions และ anachronistic_words ซึ่งเป็นเรื่องสำนวน/การเลือกใช้คำ
const MECHANICAL_TYPES = ["spelling", "garant", "tone"];

export default function ThaiSpellCheckerDialog({ content, novel, onApplyChanges, onAutoFixSave, open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [selectedChanges, setSelectedChanges] = useState([]);
  const [autoFixPreview, setAutoFixPreview] = useState(null); // { items: [{wrong, correct, category}], updatedContent }
  const [autoFixSaving, setAutoFixSaving] = useState(false);
  const [fixingAll, setFixingAll] = useState(false);

  const handleCheck = async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke("checkThaiSpelling", { content, novel });
      setResults(response.data);
      
      // แจ้งเตือนถ้าไม่พบคำผิด แต่ตรวจครบแล้ว
      if (response.data.total_errors_found === 0) {
        toast.success(`ตรวจครบ ${response.data.total_chunks_checked} ช่วง (${response.data.total_words_checked?.toLocaleString() || '0'} คำ) ไม่พบคำผิด`);
      } else {
        toast.success(`ตรวจพบ ${response.data.total_errors_found} คำผิด`);
      }
    } catch (error) {
      console.error('Spell check error:', error);
      toast.error(error.message || "เกิดข้อผิดพลาดในการตรวจคำผิด กรุณาลองใหม่อีกครั้ง");
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
      ...(results.spelling_errors || []).map(e => ({ ...e, type: "spelling", index: results.spelling_errors.indexOf(e) })),
      ...(results.garant_issues || []).map(e => ({ ...e, type: "garant", index: results.garant_issues.indexOf(e) })),
      ...(results.tone_issues || []).map(e => ({ ...e, type: "tone", index: results.tone_issues.indexOf(e) })),
      ...(results.word_suggestions || []).map(s => ({ ...s, type: "suggestion", index: results.word_suggestions.indexOf(s) })),
    ];

    // เรียงจากตำแหน่งมากไปน้อย เพื่อไม่ให้ตำแหน่งเลื่อน
    allErrors.sort((a, b) => (b.globalPosition || 0) - (a.globalPosition || 0));

    allErrors.forEach((item) => {
      const key = `${item.type}-${item.index}`;
      if (selectedChanges.includes(key) && item.globalPosition !== undefined) {
        const wrong = item.wrong || item.original;
        const correct = item.correct || item.suggested;
        // ใช้ globalPosition เพื่อหาตำแหน่งที่ถูกต้องใน content ฉบับเต็ม
        const idx = updatedContent.indexOf(wrong, Math.max(0, item.globalPosition - 10));
        if (idx !== -1) {
          updatedContent = updatedContent.slice(0, idx) + correct + updatedContent.slice(idx + wrong.length);
        }
      }
    });

    onApplyChanges(updatedContent);
    toast.success(`แก้ไข ${selectedChanges.length} คำแล้ว`);
    onClose();
  };

  // รวมเฉพาะข้อผิดพลาดเชิงกลไกที่แก้ได้จริง (มีคู่ wrong→correct และพบ wrong ในเนื้อหา)
  const collectMechanicalFixes = () => {
    if (!results) return [];
    const buckets = [
      { arr: results.spelling_errors, category: "ตัวสะกดผิด" },
      { arr: results.garant_issues, category: "การันต์" },
      { arr: results.tone_issues, category: "สระ/วรรณยุกต์" },
    ];
    const fixes = [];
    buckets.forEach(({ arr, category }) => {
      (arr || []).forEach((e) => {
        const wrong = e.wrong || e.word || e.original;
        const correct = e.correct || e.suggested;
        if (wrong && correct && wrong !== correct && content.includes(wrong)) {
          fixes.push({ wrong, correct, category, globalPosition: e.globalPosition, context: e.context });
        }
      });
    });
    return fixes;
  };

  // แก้คำผิดทั้งหมดในคลิกเดียว — แก้ทุกจุดเชิงกลไกทันที ไม่ต้องยืนยันทีละคำ + สำรอง previous_content
  const handleFixAll = async () => {
    const fixes = collectMechanicalFixes();
    if (fixes.length === 0) {
      toast.info("ไม่พบข้อผิดพลาดเชิงกลไกที่แก้อัตโนมัติได้");
      return;
    }
    setFixingAll(true);
    try {
      // เรียงตำแหน่งมากไปน้อยเพื่อไม่ให้ตำแหน่งเลื่อนระหว่างแก้
      const sorted = [...fixes].sort((a, b) => (b.globalPosition || 0) - (a.globalPosition || 0));
      let updatedContent = content;
      sorted.forEach((f) => {
        const start = f.globalPosition !== undefined ? Math.max(0, f.globalPosition - 10) : 0;
        const idx = updatedContent.indexOf(f.wrong, start);
        const realIdx = idx !== -1 ? idx : updatedContent.indexOf(f.wrong);
        if (realIdx !== -1) {
          updatedContent = updatedContent.slice(0, realIdx) + f.correct + updatedContent.slice(realIdx + f.wrong.length);
        }
      });
      await onAutoFixSave({ updatedContent, originalContent: content });
      toast.success(`แก้คำผิดทั้งหมด ${fixes.length} จุดแล้ว — เนื้อหาเดิมถูกสำรองไว้ ย้อนกลับได้`);
      onClose();
    } catch (err) {
      console.error("Fix-all save error:", err);
      toast.error("บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setFixingAll(false);
    }
  };

  // สร้างตัวอย่าง "ก่อน → หลัง" ให้ผู้ใช้ตรวจก่อนยืนยัน
  const handlePrepareAutoFix = () => {
    const fixes = collectMechanicalFixes();
    if (fixes.length === 0) {
      toast.info("ไม่พบข้อผิดพลาดเชิงกลไกที่แก้อัตโนมัติได้");
      return;
    }
    // เรียงตำแหน่งมากไปน้อยเพื่อไม่ให้ตำแหน่งเลื่อนระหว่างแก้
    const sorted = [...fixes].sort((a, b) => (b.globalPosition || 0) - (a.globalPosition || 0));
    let updatedContent = content;
    sorted.forEach((f) => {
      const start = f.globalPosition !== undefined ? Math.max(0, f.globalPosition - 10) : 0;
      const idx = updatedContent.indexOf(f.wrong, start);
      const realIdx = idx !== -1 ? idx : updatedContent.indexOf(f.wrong);
      if (realIdx !== -1) {
        updatedContent = updatedContent.slice(0, realIdx) + f.correct + updatedContent.slice(realIdx + f.wrong.length);
      }
    });
    setAutoFixPreview({ items: fixes, updatedContent });
  };

  // ยืนยัน → สำรองเนื้อหาเดิม + บันทึก (ผ่าน onAutoFixSave ที่รู้จัก chapter)
  const handleConfirmAutoFix = async () => {
    if (!autoFixPreview) return;
    setAutoFixSaving(true);
    try {
      await onAutoFixSave({ updatedContent: autoFixPreview.updatedContent, originalContent: content });
      toast.success(`แก้คำผิดอัตโนมัติ ${autoFixPreview.items.length} จุด — เนื้อหาเดิมถูกสำรองไว้แล้ว ย้อนกลับได้`);
      setAutoFixPreview(null);
      onClose();
    } catch (err) {
      console.error("Auto-fix save error:", err);
      toast.error("บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setAutoFixSaving(false);
    }
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
          {autoFixPreview && (
            <div className="flex flex-col gap-3 flex-1 overflow-hidden">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-start gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-sm text-emerald-800">
                  <p className="font-semibold">ตรวจรายการก่อนแก้จริง — {autoFixPreview.items.length} จุด</p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    แก้เฉพาะตัวสะกด/วรรคตอน/อักขระเพี้ยนเท่านั้น ไม่แตะสำนวน เรียงประโยค หรือเนื้อหา • เนื้อหาเดิมจะถูกสำรองไว้ ย้อนกลับได้
                  </p>
                </div>
              </div>

              <ScrollArea className="flex-1 max-h-[55vh]">
                <div className="space-y-2">
                  {autoFixPreview.items.map((item, idx) => (
                    <div key={`fix-${idx}`} className="p-3 rounded-lg border border-border bg-muted/30">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">{item.category}</Badge>
                        <span className="line-through text-destructive">{item.wrong}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium text-emerald-700">{item.correct}</span>
                      </div>
                      {item.context && (
                        <p className="text-xs text-muted-foreground mt-1.5">{item.context}</p>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex gap-2 pt-1 border-t border-border/60">
                <Button variant="outline" className="flex-1" onClick={() => setAutoFixPreview(null)} disabled={autoFixSaving}>
                  ย้อนกลับไปดูผลตรวจ
                </Button>
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                  onClick={handleConfirmAutoFix}
                  disabled={autoFixSaving}
                >
                  {autoFixSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  {autoFixSaving ? "กำลังแก้และสำรอง..." : `ยืนยันแก้ ${autoFixPreview.items.length} จุด`}
                </Button>
              </div>
            </div>
          )}

          {!autoFixPreview && !results && !loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">กดปุ่มด้านล่างเพื่อตรวจคำผิด</p>
              <Button onClick={handleCheck} size="lg">
                เริ่มตรวจคำผิด
              </Button>
            </div>
          )}

          {!autoFixPreview && loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">กำลังตรวจคำผิด...</p>
            </div>
          )}

          {!autoFixPreview && results && (
            <>
              {results.total_errors_found === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-600 mb-3" />
                  <h3 className="font-heading font-semibold text-lg mb-1">ไม่พบคำผิด</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    ตรวจครบทุกช่วงแล้ว ({results.total_chunks_checked} ช่วง, ประมาณ {results.total_words_checked?.toLocaleString() || '0'} คำ) 
                    <br />
                    เนื้อหาของคุณถูกต้องตามหลักภาษาไทย
                  </p>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-2">
                  <p className="text-sm text-amber-800">
                    <span className="font-semibold">ตรวจพบ {results.total_errors_found} คำผิด</span>
                    {' '}จาก {results.total_chunks_checked} ช่วง ({results.total_words_checked?.toLocaleString() || '0'} คำ)
                  </p>
                </div>
              )}

              {results.total_errors_found > 0 && (
                <>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Badge variant="secondary">
                      ตรวจ: {results.total_chunks_checked || 0} ช่วง
                    </Badge>
                    <Badge variant="secondary">
                      ~{results.total_words_checked?.toLocaleString() || '0'} คำ
                    </Badge>
                    <Badge variant="secondary" className={results.total_errors_found > 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}>
                      พบ: {results.total_errors_found || 0} คำ
                    </Badge>
                    <div className="w-px h-6 bg-border mx-1" />
                    <Badge variant="outline" className={results.spelling_errors?.length > 0 ? "border-destructive text-destructive" : ""}>
                      สะกดผิด: {results.spelling_errors?.length || 0}
                    </Badge>
                    <Badge variant="outline" className={results.garant_issues?.length > 0 ? "border-amber-500 text-amber-700" : ""}>
                      การันต์: {results.garant_issues?.length || 0}
                    </Badge>
                    <Badge variant="outline" className={results.tone_issues?.length > 0 ? "border-blue-500 text-blue-700" : ""}>
                      วรรณยุกต์: {results.tone_issues?.length || 0}
                    </Badge>
                    <Badge variant="outline" className={results.spacing_issues?.length > 0 ? "border-purple-500 text-purple-700" : ""}>
                      เว้นวรรค: {results.spacing_issues?.reduce((sum, i) => sum + i.count, 0) || 0}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Button variant="outline" onClick={() => { setSelectedChanges([]); setResults(null); setAutoFixPreview(null); }}>
                      ตรวจใหม่
                    </Button>
                    <Button 
                      onClick={handleApply} 
                      disabled={selectedChanges.length === 0}
                      className="bg-primary hover:bg-primary/90"
                    >
                      แก้ไข {selectedChanges.length} คำที่เลือก
                    </Button>
                    {onAutoFixSave && (
                      <>
                        <Button
                          onClick={handleFixAll}
                          disabled={fixingAll}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                        >
                          {fixingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                          {fixingAll ? "กำลังแก้และสำรอง..." : "แก้คำผิดทั้งหมด"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handlePrepareAutoFix}
                          disabled={fixingAll}
                          className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                        >
                          ดูรายการก่อนแก้
                        </Button>
                      </>
                    )}
                  </div>
                </>
              )}

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