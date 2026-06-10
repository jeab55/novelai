import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Landmark, Plus, Check, TrendingUp, AlertCircle } from "lucide-react";

export default function HistoricalEventSearchDialog({ open, onClose, novelId, onEventsAdded }) {
  const [yearInput, setYearInput] = useState("");
  const [results, setResults] = useState([]);
  const [economicOverview, setEconomicOverview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(new Set());
  const [saveError, setSaveError] = useState("");

  const handleSearch = async () => {
    if (!yearInput.trim()) return;
    setLoading(true);
    setResults([]);
    setEconomicOverview(null);
    setSelected(new Set());
    setSaved(new Set());
    setSaveError("");

    const [rawEvents, rawEcon] = await Promise.all([
      base44.integrations.Core.InvokeLLM({
        prompt: `ค้นหาเหตุการณ์สำคัญทางประวัติศาสตร์ไทยและโลก ในช่วงปี พ.ศ. ${yearInput.trim()} (หรือช่วงใกล้เคียง ±5 ปี หากไม่มีข้อมูลตรง)
ให้ตอบเป็น JSON array ของเหตุการณ์ 6-10 รายการ โดยแต่ละรายการมี:
- title: ชื่อเหตุการณ์ (ภาษาไทย)
- description: คำอธิบายย่อ 1-2 ประโยค
- time_period: ช่วงเวลา เช่น "พ.ศ. 2310" หรือ "พ.ศ. 2310-2315"
- location: สถานที่เกิดเหตุ (ถ้ามี)
- characters_involved: บุคคลสำคัญที่เกี่ยวข้อง (ถ้ามี)
ตอบเฉพาะ JSON array เท่านั้น ไม่ต้องมี code fence`,
        add_context_from_internet: true,
      }),
      base44.integrations.Core.InvokeLLM({
        prompt: `อธิบายภาพรวมเศรษฐกิจและสังคมของยุค พ.ศ. ${yearInput.trim()} ในบริบทไทยและโลก สำหรับนักเขียนนิยายอิงประวัติศาสตร์
ให้ตอบเป็น JSON object มี field ดังนี้:
- economy: สภาพเศรษฐกิจโดยรวม (2-3 ประโยค)
- trade: การค้าและพาณิชย์ (1-2 ประโยค)
- livelihood: ค่าครองชีพและวิถีชีวิต (1-2 ประโยค)
- occupations: อาชีพหลักของคนสามัญ (1-2 ประโยค)
- currency: ระบบเงินตราหรือการแลกเปลี่ยน (1 ประโยค)
ตอบเฉพาะ JSON object เท่านั้น ไม่ต้องมี code fence`,
        add_context_from_internet: true,
      }),
    ]);

    // Parse events
    let parsed = [];
    try {
      const cleaned = rawEvents.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = [];
    }
    setResults(Array.isArray(parsed) ? parsed : []);

    // Parse economic overview
    let econ = null;
    try {
      const cleaned = rawEcon.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      econ = JSON.parse(cleaned);
    } catch {
      econ = null;
    }
    setEconomicOverview(econ);

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
    try {
      const toAdd = [...selected].map((i) => results[i]);
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

      // Verify all records were created
      const failedCount = created.filter((r) => !r || !r.id).length;
      if (failedCount > 0) {
        setSaveError(`บันทึกไม่สำเร็จ ${failedCount} รายการ กรุณาลองใหม่อีกครั้ง`);
        setSaving(false);
        return;
      }

      setSaved(new Set([...saved, ...selected]));
      setSelected(new Set());
      onEventsAdded?.();
    } catch (err) {
      setSaveError(`เกิดข้อผิดพลาด: ${err.message || "ไม่สามารถบันทึกได้"}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setYearInput("");
    setResults([]);
    setEconomicOverview(null);
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
        <div className="flex-1 overflow-y-auto min-h-0 space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
              <p className="text-sm text-muted-foreground">AI กำลังค้นหาเหตุการณ์และวิเคราะห์บริบทยุคสมัย...</p>
            </div>
          )}

          {!loading && results.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-10">ระบุ พ.ศ. ที่ต้องการ แล้วกด "ค้นหา"</p>
          )}

          {/* Economic Overview */}
          {!loading && economicOverview && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-800/40 p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-amber-600" />
                <span className="font-medium text-sm text-amber-800 dark:text-amber-300">บริบทเศรษฐกิจยุค พ.ศ. {yearInput}</span>
              </div>
              <div className="space-y-2 text-sm text-foreground/80">
                {economicOverview.economy && (
                  <div><span className="font-medium text-amber-700 dark:text-amber-400">เศรษฐกิจ: </span>{economicOverview.economy}</div>
                )}
                {economicOverview.trade && (
                  <div><span className="font-medium text-amber-700 dark:text-amber-400">การค้า: </span>{economicOverview.trade}</div>
                )}
                {economicOverview.livelihood && (
                  <div><span className="font-medium text-amber-700 dark:text-amber-400">วิถีชีวิต: </span>{economicOverview.livelihood}</div>
                )}
                {economicOverview.occupations && (
                  <div><span className="font-medium text-amber-700 dark:text-amber-400">อาชีพ: </span>{economicOverview.occupations}</div>
                )}
                {economicOverview.currency && (
                  <div><span className="font-medium text-amber-700 dark:text-amber-400">เงินตรา: </span>{economicOverview.currency}</div>
                )}
              </div>
            </div>
          )}

          {/* Event list */}
          {results.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">พบ {results.length} เหตุการณ์ — เลือกรายการที่ต้องการเพิ่มลงไทม์ไลน์</p>
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

        {/* Error message */}
        {saveError && (
          <div className="shrink-0 flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {saveError}
          </div>
        )}

        {/* Footer */}
        {results.length > 0 && (
          <div className="shrink-0 pt-3 border-t border-border/60 flex items-center justify-between gap-3">
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
        )}
      </DialogContent>
    </Dialog>
  );
}