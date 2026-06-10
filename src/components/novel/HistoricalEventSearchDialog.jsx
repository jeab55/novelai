import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Landmark, Plus, Check, AlertCircle } from "lucide-react";

export default function HistoricalEventSearchDialog({ open, onClose, novelId, onEventsAdded }) {
  const [yearInput, setYearInput] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(new Set());
  const [saveError, setSaveError] = useState("");

  const handleSearch = async () => {
    if (!yearInput.trim()) return;
    setLoading(true);
    setResults([]);
    setSelected(new Set());
    setSaved(new Set());

    const prompt = `ค้นหาเหตุการณ์สำคัญทางประวัติศาสตร์ไทยและโลก ในช่วงปี พ.ศ. ${yearInput.trim()} (หรือช่วงใกล้เคียง ±5 ปี หากไม่มีข้อมูลตรง)
ให้ตอบเป็น JSON array ของเหตุการณ์ 6-10 รายการ โดยแต่ละรายการมี:
- title: ชื่อเหตุการณ์ (ภาษาไทย)
- description: คำอธิบายย่อ 1-2 ประโยค
- time_period: ช่วงเวลา เช่น "พ.ศ. 2310" หรือ "พ.ศ. 2310-2315"
- location: สถานที่เกิดเหตุ (ถ้ามี)
- characters_involved: บุคคลสำคัญที่เกี่ยวข้อง (ถ้ามี)
ตอบเฉพาะ JSON array เท่านั้น ไม่ต้องมี code fence`;

    const raw = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
    });

    let parsed = [];
    try {
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = [];
    }

    setResults(Array.isArray(parsed) ? parsed : []);
    setLoading(false);
  };

  const toggleSelect = (i) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const handleAddSelected = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    setSaveError("");
    const toAdd = [...selected].map((i) => results[i]);
    try {
      const created = await Promise.all(
        toAdd.map((ev) =>
          base44.entities.PlotEvent.create({
            novel_id: novelId,
            title: String(ev.title || ""),
            description: String(ev.description || ""),
            time_period: String(ev.time_period || ""),
            location: String(ev.location || ""),
            characters_involved: String(ev.characters_involved || ""),
            is_historical: true,
            order: 0,
          })
        )
      );
      // Verify all records were actually created
      const failedCount = created.filter((r) => !r || !r.id).length;
      if (failedCount > 0) {
        setSaveError(`บันทึกไม่สำเร็จ ${failedCount} รายการ — กรุณาลองใหม่อีกครั้ง`);
        setSaving(false);
        return;
      }
      setSaved(new Set([...saved, ...selected]));
      setSelected(new Set());
      onEventsAdded?.();
    } catch (err) {
      setSaveError(`เกิดข้อผิดพลาด: ${err?.message || "ไม่ทราบสาเหตุ"}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setYearInput("");
    setResults([]);
    setSelected(new Set());
    setSaved(new Set());
    setSaveError("");
    setLoading(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="font-heading flex items-center gap-2">
            <Landmark className="w-4 h-4 text-amber-600" />
            ค้นหาเหตุการณ์ประวัติศาสตร์
          </DialogTitle>
        </DialogHeader>

        {/* Search bar */}
        <div className="flex gap-2 shrink-0">
          <Input
            placeholder="ระบุ พ.ศ. เช่น 2310, 2475, 2400-2450"
            value={yearInput}
            onChange={(e) => setYearInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1"
          />
          <Button onClick={handleSearch} disabled={!yearInput.trim() || loading} className="gap-1.5 shrink-0">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Landmark className="w-4 h-4" />}
            ค้นหา
          </Button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
              <p className="text-sm text-muted-foreground">AI กำลังค้นหาเหตุการณ์...</p>
            </div>
          )}

          {!loading && results.length === 0 && yearInput && !loading && (
            <p className="text-center text-sm text-muted-foreground py-10">ระบุ พ.ศ. แล้วกด "ค้นหา"</p>
          )}

          {!loading && results.length === 0 && !yearInput && (
            <p className="text-center text-sm text-muted-foreground py-10">ระบุ พ.ศ. ที่ต้องการ แล้วกด "ค้นหา"</p>
          )}

          {results.length > 0 && (
            <div className="space-y-2 py-1">
              <p className="text-xs text-muted-foreground mb-3">พบ {results.length} เหตุการณ์ — เลือกรายการที่ต้องการเพิ่มลงไทม์ไลน์</p>
              {results.map((ev, i) => {
                const isSaved = saved.has(i);
                const isSelected = selected.has(i);
                return (
                  <div
                    key={i}
                    onClick={() => !isSaved && toggleSelect(i)}
                    className={`border rounded-xl p-3 cursor-pointer transition-all ${
                      isSaved
                        ? "border-green-300 bg-green-50 dark:bg-green-950/20 opacity-60 cursor-default"
                        : isSelected
                        ? "border-amber-400 bg-amber-50 dark:bg-amber-950/20"
                        : "border-border/60 hover:border-amber-300 hover:bg-amber-50/30 dark:hover:bg-amber-950/10"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                        isSaved ? "border-green-400 bg-green-400" : isSelected ? "border-amber-500 bg-amber-500" : "border-muted-foreground/30"
                      }`}>
                        {(isSelected || isSaved) && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-medium text-sm">{ev.title}</span>
                          <Badge className="bg-amber-100 text-amber-700 text-xs gap-1 shrink-0">
                            <Landmark className="w-3 h-3" />
                            ประวัติศาสตร์จริง
                          </Badge>
                          {isSaved && <Badge className="bg-green-100 text-green-700 text-xs shrink-0">เพิ่มแล้ว</Badge>}
                        </div>
                        {ev.time_period && <p className="text-xs text-primary/70 mb-0.5">{ev.time_period}</p>}
                        {ev.location && <p className="text-xs text-muted-foreground mb-0.5">📍 {ev.location}</p>}
                        {ev.description && <p className="text-sm text-muted-foreground leading-relaxed">{ev.description}</p>}
                        {ev.characters_involved && (
                          <p className="text-xs text-muted-foreground mt-1">
                            <span className="font-medium">บุคคลสำคัญ:</span> {ev.characters_involved}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div className="shrink-0 pt-3 border-t border-border/60 space-y-2">
            {saveError && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {saveError}
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {selected.size > 0 ? `เลือก ${selected.size} รายการ` : "คลิกเลือกรายการที่ต้องการ"}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleClose}>ปิด</Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={handleAddSelected}
                disabled={selected.size === 0 || saving}
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                เพิ่มลงไทม์ไลน์ ({selected.size})
              </Button>
            </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}