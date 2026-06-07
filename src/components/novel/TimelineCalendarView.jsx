import React, { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Users, BookOpen, Landmark, Edit2, Trash2, History } from "lucide-react";

// Try to extract a year-like number from a text label
function extractYear(text) {
  if (!text) return null;
  const m = text.match(/(\d{3,4})/);
  return m ? parseInt(m[1]) : null;
}

// Try to extract a month-like number from a text label
function extractMonth(text) {
  if (!text) return null;
  const monthThai = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  const found = monthThai.findIndex((m) => text.includes(m));
  if (found !== -1) return found + 1;
  const m = text.match(/เดือนที่\s*(\d+)|month\s*(\d+)/i);
  return m ? parseInt(m[1] || m[2]) : null;
}

// Group events by time_period label (preserving order)
function groupByLabel(events) {
  const groups = [];
  const seen = new Map();
  for (const ev of events) {
    const key = ev.time_period?.trim() || "ไม่ระบุช่วงเวลา";
    if (!seen.has(key)) {
      seen.set(key, groups.length);
      groups.push({ label: key, events: [ev] });
    } else {
      groups[seen.get(key)].events.push(ev);
    }
  }
  return groups;
}

// Group events by extracted year
function groupByYear(events) {
  const groups = new Map();
  for (const ev of events) {
    const y = extractYear(ev.time_period);
    const key = y ? `ปี ${y}` : (ev.time_period?.trim() || "ไม่ระบุปี");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(ev);
  }
  return Array.from(groups.entries()).map(([label, evs]) => ({ label, events: evs }));
}

// Group events by extracted month+year or just month label
function groupByMonth(events) {
  const groups = new Map();
  for (const ev of events) {
    const y = extractYear(ev.time_period);
    const mo = extractMonth(ev.time_period);
    let key;
    if (mo && y) key = `ปี ${y} เดือนที่ ${mo}`;
    else if (mo) key = `เดือนที่ ${mo}`;
    else key = ev.time_period?.trim() || "ไม่ระบุ";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(ev);
  }
  return Array.from(groups.entries()).map(([label, evs]) => ({ label, events: evs }));
}

function canGroupByYear(events) {
  return events.some((e) => extractYear(e.time_period));
}

function canGroupByMonth(events) {
  return events.some((e) => extractMonth(e.time_period));
}

export default function TimelineCalendarView({ events, linkedChaptersByEvent, onEdit, onDelete, onVersionHistory }) {
  const [groupMode, setGroupMode] = React.useState("label"); // label | year | month

  const hasYear = canGroupByYear(events);
  const hasMonth = canGroupByMonth(events);

  const groups = useMemo(() => {
    if (groupMode === "year" && hasYear) return groupByYear(events);
    if (groupMode === "month" && (hasMonth || hasYear)) return groupByMonth(events);
    return groupByLabel(events);
  }, [events, groupMode, hasYear, hasMonth]);

  return (
    <div>
      {/* Group mode selector */}
      <div className="flex items-center gap-1 mb-5">
        <span className="text-xs text-muted-foreground mr-1">จัดกลุ่มตาม:</span>
        {[
          { key: "label", label: "ป้ายช่วงเวลา" },
          ...(hasYear ? [{ key: "year", label: "รายปี" }] : []),
          ...(hasMonth ? [{ key: "month", label: "รายเดือน" }] : []),
        ].map((opt) => (
          <Button
            key={opt.key}
            variant={groupMode === opt.key ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs px-2.5"
            onClick={() => setGroupMode(opt.key)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {/* Vertical timeline groups */}
      <div className="relative pl-4">
        <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-border" />

        {groups.map((group, gi) => (
          <div key={gi} className="mb-8">
            {/* Group header */}
            <div className="relative flex items-center gap-3 mb-4 -ml-4">
              <div className="w-3 h-3 rounded-full bg-primary border-2 border-primary-foreground shadow-sm shrink-0" />
              <div className="bg-primary/10 border border-primary/20 rounded-lg px-3 py-1">
                <span className="text-sm font-semibold text-primary font-heading">{group.label}</span>
                <span className="text-xs text-muted-foreground ml-2">({group.events.length} เหตุการณ์)</span>
              </div>
            </div>

            {/* Events in group */}
            <div className="space-y-3 ml-4">
              {group.events.map((ev, ei) => {
                const linkedChapter = linkedChaptersByEvent?.[ev.id];
                return (
                  <div
                    key={ev.id}
                    className="relative group border border-border/60 rounded-xl p-4 bg-card/60 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer"
                    onClick={() => onEdit(ev)}
                  >
                    {/* Left accent line per event */}
                    <div className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-full ${ev.is_historical ? "bg-amber-400" : "bg-primary/40"}`} />

                    <div className="flex items-start justify-between pl-2">
                      <div className="flex-1 min-w-0">
                        {/* Title row */}
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-mono text-muted-foreground">#{ev.order}</span>
                          <h3 className="font-medium text-sm leading-snug">{ev.title}</h3>
                          {ev.is_historical && (
                            <Badge className="bg-amber-100 text-amber-700 text-xs gap-1 py-0">
                              <Landmark className="w-3 h-3" />ประวัติศาสตร์จริง
                            </Badge>
                          )}
                        </div>

                        {/* Meta row */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                          {ev.time_period && (
                            <span className="text-primary/70 font-medium">{ev.time_period}</span>
                          )}
                          {ev.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />{ev.location}
                            </span>
                          )}
                          {ev.characters_involved && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />{ev.characters_involved}
                            </span>
                          )}
                          {linkedChapter && (
                            <span className="flex items-center gap-1 text-primary/80">
                              <BookOpen className="w-3 h-3" />ตอนที่ {linkedChapter.order}: {linkedChapter.title}
                            </span>
                          )}
                        </div>

                        {/* Description */}
                        {ev.description && (
                          <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                            {ev.description}
                          </p>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div
                        className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" title="ประวัติเวอร์ชัน" onClick={() => onVersionHistory(ev)}>
                          <History className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(ev)}>
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onDelete(ev.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}