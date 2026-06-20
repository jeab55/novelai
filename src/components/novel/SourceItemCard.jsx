import React from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Link2, Upload, Loader2, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const MODES = [
  { v: "text", icon: FileText, label: "วางข้อความ" },
  { v: "url", icon: Link2, label: "ลิงก์ URL" },
  { v: "file", icon: Upload, label: "อัปโหลดไฟล์" },
];

export default function SourceItemCard({ source, index, total, onChange, onRemove, disabled }) {
  const [fetching, setFetching] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

  const update = (patch) => onChange({ ...source, ...patch });

  const handleFetchUrl = async () => {
    if (!source.url?.trim()) return;
    setFetching(true);
    try {
      const res = await base44.functions.invoke("fetchUrlContent", { url: source.url.trim() });
      const data = res.data;
      if (!data || data.error) throw new Error(data?.error || "ดึงเนื้อหาไม่สำเร็จ");
      update({ text: data.text, title: source.title || data.title || "" });
      toast.success(`ดึงเนื้อหาสำเร็จ: ${data.character_count.toLocaleString()} ตัวอักษร`);
    } catch (e) {
      toast.error(e.message || "ดึงเนื้อหาจากลิงก์ไม่สำเร็จ");
    } finally {
      setFetching(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = [".txt", ".md", ".docx", ".pdf"];
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!validTypes.includes(ext)) {
      toast.error("รองรับ: TXT, MD, DOCX, PDF");
      e.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("ไฟล์ใหญ่เกินไป (สูงสุด 5MB)");
      e.target.value = "";
      return;
    }
    setUploading(true);
    try {
      const reader = new FileReader();
      const b64 = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await base44.functions.invoke("extractTextFromFile", {
        file_name: file.name,
        file_type: file.type,
        file_data: b64,
      });
      const data = res.data;
      if (!data || data.error) throw new Error(data?.error || "อ่านไฟล์ไม่สำเร็จ");
      update({ text: data.text, title: source.title || file.name.replace(/\.[^.]+$/, "") });
      toast.success(`อ่านไฟล์สำเร็จ: ${data.character_count.toLocaleString()} ตัวอักษร`);
      e.target.value = "";
    } catch (err) {
      toast.error(err.message || "อ่านไฟล์ไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-semibold">
            {index + 1}
          </span>
          แหล่งเนื้อหาที่ {index + 1}
          {source.text?.trim() && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
        </span>
        {total > 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
            disabled={disabled}
            title="ลบแหล่งนี้"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {MODES.map(({ v, icon: Icon, label }) => (
          <Button
            key={v}
            variant={source.mode === v ? "default" : "outline"}
            size="sm"
            className="h-9 gap-1 text-xs"
            onClick={() => update({ mode: v })}
            disabled={disabled}
          >
            <Icon className="w-3.5 h-3.5" />{label}
          </Button>
        ))}
      </div>

      {source.mode === "url" && (
        <div className="flex gap-2">
          <Input
            value={source.url || ""}
            onChange={(e) => update({ url: e.target.value })}
            placeholder="https://..."
            className="flex-1 h-9 text-sm"
            disabled={disabled}
          />
          <Button onClick={handleFetchUrl} disabled={disabled || fetching || !source.url?.trim()} size="sm" className="h-9">
            {fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : "ดึง"}
          </Button>
        </div>
      )}

      {source.mode === "file" && (
        <div className="flex items-center gap-2">
          <Input type="file" accept=".txt,.md,.docx,.pdf" onChange={handleFileUpload} disabled={disabled || uploading} className="flex-1 text-sm h-9" />
          {uploading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
        </div>
      )}

      <Textarea
        value={source.text || ""}
        onChange={(e) => update({ text: e.target.value })}
        placeholder="วางเนื้อเพลงหรือบทความภาษาใดก็ได้... ระบบจะตรวจจับภาษาและแปลเป็นไทยอัตโนมัติ"
        className="min-h-[110px] text-sm resize-none"
        disabled={disabled}
      />

      <div className="flex items-center gap-2">
        <Input
          value={source.title || ""}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="ชื่อต้นฉบับ (ไม่บังคับ)"
          className="flex-1 h-8 text-xs"
          disabled={disabled}
        />
        {source.text?.trim() && <Badge variant="outline" className="text-xs whitespace-nowrap">{source.text.length.toLocaleString()} ตัวอักษร</Badge>}
      </div>
    </div>
  );
}