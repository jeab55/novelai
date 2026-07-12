import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Download, Check } from "lucide-react";
import { toast } from "sonner";
import { downloadBlob } from "@/lib/bookExport";

// การ์ดส่งออก 1 รูปแบบ: preview สั้น + copy + download
export default function ExportButton({ label, icon: Icon, filename, content, mimeType, description }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success(`คัดลอก ${label} แล้ว`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("คัดลอกไม่สำเร็จ");
    }
  };

  const handleDownload = () => {
    downloadBlob(filename, content, mimeType);
    toast.success(`ดาวน์โหลด ${filename} แล้ว`);
  };

  const size = new Blob([content || ""]).size;
  const sizeLabel = size > 1024 ? `${(size / 1024).toFixed(1)} KB` : `${size} B`;

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-950/30 text-amber-600 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm">{label}</p>
          <p className="text-xs text-muted-foreground truncate">{description}</p>
          <p className="text-[11px] text-muted-foreground/70 mt-0.5">{filename} · {sizeLabel}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 gap-1.5 h-8 text-xs" onClick={handleCopy}>
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          คัดลอก
        </Button>
        <Button size="sm" className="flex-1 gap-1.5 h-8 text-xs bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white border-0" onClick={handleDownload}>
          <Download className="w-3.5 h-3.5" />
          ดาวน์โหลด
        </Button>
      </div>
    </div>
  );
}