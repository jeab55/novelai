import { useState, useEffect } from "react";
import { getLog, clearLog } from "@/lib/saveLog";
import { CheckCircle2, XCircle, Trash2, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

export default function ActivityLogPanel() {
  const [log, setLog] = useState(getLog);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const refresh = () => setLog(getLog());
    window.addEventListener("actionlog_updated", refresh);
    return () => window.removeEventListener("actionlog_updated", refresh);
  }, []);

  const fmt = (iso) => {
    try { return format(new Date(iso), "d MMM HH:mm:ss", { locale: th }); } catch { return ""; }
  };

  return (
    <div className="border-t border-border/50 bg-card/10">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2 text-xs hover:bg-muted/20 transition-colors"
      >
        <ClipboardList className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="font-medium text-muted-foreground">ประวัติการทำงานล่าสุด</span>
        {log.length > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground text-[10px]">
            {log.length}
          </span>
        )}
        <span className="ml-auto text-muted-foreground/50">{open ? "▲" : "▼"}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-muted-foreground/70">{log.length === 0 ? "ยังไม่มีประวัติ" : `${log.length} รายการล่าสุด`}</span>
                {log.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] px-2 text-muted-foreground/60 hover:text-destructive"
                    onClick={() => { clearLog(); setLog([]); }}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    ล้างประวัติ
                  </Button>
                )}
              </div>

              {log.length === 0 ? (
                <p className="text-xs text-muted-foreground/50 italic py-2">ยังไม่มีประวัติการบันทึก</p>
              ) : (
                <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                  {log.map((entry, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-xs ${
                        entry.success
                          ? "bg-green-50/60 border border-green-100"
                          : "bg-red-50/60 border border-red-100"
                      }`}
                    >
                      {entry.success ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <span className={entry.success ? "text-green-800 font-medium" : "text-red-700 font-medium"}>
                          {entry.action}
                        </span>
                        {!entry.success && entry.error && (
                          <p className="text-red-500/80 text-[10px] mt-0.5 line-clamp-1">{entry.error}</p>
                        )}
                      </div>
                      <span className="text-muted-foreground/50 text-[10px] shrink-0 tabular-nums">{fmt(entry.timestamp)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}