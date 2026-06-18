import React, { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

/**
 * โปรเกรสบาร์แบบประมาณการสำหรับงาน AI ที่ตอบกลับเป็นก้อนเดียว (ไม่ stream)
 * - active=true: เปอร์เซ็นต์จะค่อยๆ ขยับขึ้นตามเวลา (asymptote เข้าใกล้ ~95%)
 * - active=false: กระโดดไป 100% แล้วค้างให้เห็นครู่หนึ่ง
 *
 * @param {boolean} active - กำลังประมวลผลอยู่หรือไม่
 * @param {string} label - ข้อความอธิบายงาน
 * @param {number} expectedMs - เวลาที่คาดว่าจะเสร็จ (ms) ใช้กำหนดความเร็ว (ค่าเริ่ม 45000)
 */
export default function AiProgressBar({ active, label = "กำลังประมวลผลด้วย AI...", expectedMs = 45000 }) {
  const [percent, setPercent] = useState(0);
  const intervalRef = useRef(null);
  const startRef = useRef(null);

  useEffect(() => {
    if (active) {
      setPercent(2);
      startRef.current = Date.now();
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startRef.current;
        // เส้นโค้งเข้าใกล้ 95% แบบ asymptotic — ไม่ถึง 100% จนกว่างานจะเสร็จจริง
        const ratio = 1 - Math.exp(-elapsed / expectedMs);
        const next = Math.min(95, Math.round(ratio * 95));
        setPercent((p) => (next > p ? next : p));
      }, 300);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      // ถ้าเคยเริ่มแล้ว ให้กระโดดไป 100%
      setPercent((p) => (p > 0 ? 100 : 0));
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active, expectedMs]);

  if (!active && percent === 0) return null;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Sparkles className={`w-3.5 h-3.5 text-primary ${active ? "animate-pulse" : ""}`} />
          {percent >= 100 ? "เสร็จสิ้น" : label}
        </span>
        <span className="text-xs font-semibold text-primary tabular-nums">{percent}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-secondary/60 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}