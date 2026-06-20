import React from "react";
import { Loader2, CheckCircle2, AlertCircle, RotateCcw } from "lucide-react";

/**
 * AutosaveStatus — ตัวบ่งชี้สถานะการบันทึกอัตโนมัติ (ใช้ร่วมกันทุกฟอร์ม)
 * props: status ("idle"|"saving"|"saved"|"error"), lastSavedAt (Date|null), onRetry (fn)
 */
export default function AutosaveStatus({ status, lastSavedAt, onRetry, className = "" }) {
  if (status === "idle") return null;

  if (status === "saving") {
    return (
      <span className={`text-xs flex items-center gap-1 text-amber-500 ${className}`}>
        <Loader2 className="w-3 h-3 animate-spin" />
        กำลังบันทึก…
      </span>
    );
  }

  if (status === "error") {
    return (
      <span className={`text-xs flex items-center gap-1 text-destructive ${className}`}>
        <AlertCircle className="w-3 h-3" />
        บันทึกไม่สำเร็จ
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="ml-0.5 inline-flex items-center gap-0.5 underline hover:no-underline font-medium"
          >
            <RotateCcw className="w-3 h-3" />
            ลองใหม่
          </button>
        )}
      </span>
    );
  }

  // saved
  return (
    <span className={`text-xs flex items-center gap-1 text-emerald-600 ${className}`}>
      <CheckCircle2 className="w-3 h-3" />
      บันทึกแล้ว ✓
      {lastSavedAt && (
        <span className="text-muted-foreground/70 ml-0.5">
          {lastSavedAt.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.
        </span>
      )}
    </span>
  );
}