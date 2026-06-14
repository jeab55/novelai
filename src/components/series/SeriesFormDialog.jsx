import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";

const GENRES = ["โรแมนติก", "แฟนตาซี", "อิงประวัติศาสตร์", "จีนย้อนยุค", "วาย", "สยองขวัญ", "ลึกลับ", "แอ็คชั่น", "ดราม่า", "อื่นๆ"];

export default function SeriesFormDialog({ open, onClose, series, onSaved }) {
  const isEdit = !!series;
  const fileRef = useRef(null);
  const [form, setForm] = useState({
    title: "", description: "", genre: "", status: "ongoing", cover_image_url: "",
  });
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    if (open) {
      setForm({
        title: series?.title || "",
        description: series?.description || "",
        genre: series?.genre || "",
        status: series?.status || "ongoing",
        cover_image_url: series?.cover_image_url || "",
      });
      setPreviewUrl(series?.cover_image_url || "");
    }
  }, [open, series]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (isEdit) return base44.entities.Series.update(series.id, data);
      return base44.entities.Series.create(data);
    },
    onSuccess: () => {
      toast.success(isEdit ? "แก้ไขซีรีส์แล้ว" : "สร้างซีรีส์แล้ว");
      onSaved();
    },
  });

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPreviewUrl(file_url);
      setForm((f) => ({ ...f, cover_image_url: file_url }));
    } catch {
      toast.error("อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = () => {
    if (!form.title.trim()) { toast.error("กรุณาใส่ชื่อซีรีส์"); return; }
    saveMutation.mutate(form);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-0 gap-0 flex flex-col max-h-[90vh]">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/60 shrink-0">
          <DialogTitle className="font-heading">{isEdit ? "แก้ไขซีรีส์" : "สร้างซีรีส์ใหม่"}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Cover upload */}
          <div>
            <label className="text-sm font-medium mb-2 block">รูปปกซีรีส์</label>
            <div
              className="relative w-full h-40 rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer overflow-hidden bg-muted/30"
              onClick={() => fileRef.current?.click()}
            >
              {previewUrl ? (
                <>
                  <img src={previewUrl} alt="ปก" className="w-full h-full object-cover" />
                  <button
                    className="absolute top-2 right-2 w-6 h-6 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-colors"
                    onClick={(e) => { e.stopPropagation(); setPreviewUrl(""); setForm((f) => ({ ...f, cover_image_url: "" })); }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                  {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <ImagePlus className="w-6 h-6" />}
                  <span className="text-sm">{uploading ? "กำลังอัปโหลด..." : "คลิกเพื่ออัปโหลดรูปปก"}</span>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleUpload(e.target.files[0])}
            />
          </div>

          {/* Title */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">ชื่อซีรีส์ <span className="text-destructive">*</span></label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="ชื่อซีรีส์..."
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">คำอธิบาย</label>
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="คำอธิบายซีรีส์..."
            />
          </div>

          {/* Genre */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">ประเภทนิยาย</label>
            <Select value={form.genre} onValueChange={(v) => setForm({ ...form, genre: v })}>
              <SelectTrigger><SelectValue placeholder="เลือกประเภท" /></SelectTrigger>
              <SelectContent>
                {GENRES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">สถานะ</label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ongoing">กำลังเขียน</SelectItem>
                <SelectItem value="completed">จบแล้ว</SelectItem>
                <SelectItem value="hiatus">พักชั่วคราว</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border/60 shrink-0">
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={onClose}>ยกเลิก</Button>
            <Button onClick={handleSubmit} disabled={saveMutation.isPending || uploading}>
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {isEdit ? "บันทึกการเปลี่ยนแปลง" : "สร้างซีรีส์"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}