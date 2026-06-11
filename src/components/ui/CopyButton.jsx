import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Reusable copy-to-clipboard button.
 * Props:
 *   text        — string to copy
 *   label       — optional text label next to icon (default: none)
 *   className   — extra classes
 *   size        — "sm" | "xs" (default "xs")
 */
export default function CopyButton({ text, label, className, size = "xs" }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-3 h-3";
  const padding = size === "sm" ? "px-2.5 py-1" : "px-1.5 py-0.5";

  return (
    <button
      onClick={handleCopy}
      title="คัดลอก"
      className={cn(
        "inline-flex items-center gap-1 rounded-md border transition-all select-none",
        padding,
        copied
          ? "border-emerald-300 bg-emerald-50 text-emerald-600 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
          : "border-border/50 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
        className
      )}
    >
      {copied ? (
        <Check className={iconSize} />
      ) : (
        <Copy className={iconSize} />
      )}
      {label && <span className="text-[11px] font-medium">{copied ? "คัดลอกแล้ว" : label}</span>}
      {!label && copied && <span className="text-[11px] font-medium">คัดลอกแล้ว</span>}
    </button>
  );
}