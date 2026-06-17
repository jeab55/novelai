import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, X, Check, GripVertical } from "lucide-react";
import { toast } from "sonner";

const PRESET_COLORS = [
  { label: "เขียว", bg: "bg-emerald-100", text: "text-emerald-700", ring: "ring-emerald-400" },
  { label: "ม่วง", bg: "bg-purple-100", text: "text-purple-700", ring: "ring-purple-400" },
  { label: "เหลือง", bg: "bg-amber-100", text: "text-amber-700", ring: "ring-amber-400" },
  { label: "ฟ้า", bg: "bg-sky-100", text: "text-sky-700", ring: "ring-sky-400" },
  { label: "น้ำเงิน", bg: "bg-indigo-100", text: "text-indigo-700", ring: "ring-indigo-400" },
  { label: "ชมพู", bg: "bg-rose-100", text: "text-rose-700", ring: "ring-rose-400" },
  { label: "ส้ม", bg: "bg-orange-100", text: "text-orange-700", ring: "ring-orange-400" },
  { label: "เทา", bg: "bg-gray-100", text: "text-gray-600", ring: "ring-gray-400" },
  { label: "เขียวอ่อน", bg: "bg-teal-100", text: "text-teal-700", ring: "ring-teal-400" },
  { label: "แดง", bg: "bg-red-100", text: "text-red-700", ring: "ring-red-400" },
];

export const getColorClasses = (colorLabel) => {
  const found = PRESET_COLORS.find((c) => c.label === colorLabel);
  return found || PRESET_COLORS[7]; // default gray
};

export default function WorldCategoryManager({ novelId, categories, onClose }) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("เขียว");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["worldCategories", novelId] });

  const addMutation = useMutation({
    mutationFn: () =>
      base44.entities.WorldCategory.create({
        novel_id: novelId,
        name: newName.trim(),
        color: newColor,
        order: categories.length,
      }),
    onSuccess: () => { invalidate(); setNewName(""); setNewColor("เขียว"); toast.success("บันทึกแล้ว"); },
    onError: (err) => toast.error(`บันทึกไม่สำเร็จ: ${err?.message || "กรุณาลองใหม่"}`, {
      action: { label: "ลองใหม่", onClick: () => addMutation.mutate() },
    }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.WorldCategory.update(id, data),
    onSuccess: () => { invalidate(); setEditingId(null); toast.success("บันทึกแล้ว"); },
    onError: (err) => toast.error(`บันทึกไม่สำเร็จ: ${err?.message || "กรุณาลองใหม่"}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.WorldCategory.delete(id),
    onSuccess: () => { invalidate(); toast.success("ลบแล้ว"); },
    onError: (err) => toast.error(`ลบไม่สำเร็จ: ${err?.message || "กรุณาลองใหม่"}`),
  });

  const startEdit = (cat) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditColor(cat.color || "เทา");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-sm">จัดการหมวดหมู่</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}><X className="w-4 h-4" /></Button>
      </div>

      {/* Existing categories */}
      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {categories.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-3">ยังไม่มีหมวดหมู่</p>
        )}
        {categories.map((cat) => {
          const colors = getColorClasses(cat.color);
          return (
            <div key={cat.id} className="flex items-center gap-2 group">
              <GripVertical className="w-3.5 h-3.5 text-muted-foreground/30" />
              {editingId === cat.id ? (
                <>
                  <Input
                    className="h-7 text-sm flex-1"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-1">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c.label}
                        title={c.label}
                        className={`w-4 h-4 rounded-full ${c.bg} border-2 transition-all ${editColor === c.label ? "border-foreground scale-110" : "border-transparent"}`}
                        onClick={() => setEditColor(c.label)}
                      />
                    ))}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-primary"
                    disabled={!editName.trim() || updateMutation.isPending}
                    onClick={() => updateMutation.mutate({ id: cat.id, data: { name: editName.trim(), color: editColor } })}>
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-1 ${colors.bg} ${colors.text}`}>
                    {cat.name}
                  </span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => startEdit(cat)}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive/70 hover:text-destructive"
                    onClick={() => deleteMutation.mutate(cat.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Add new */}
      <div className="border-t border-border/50 pt-3 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">เพิ่มหมวดหมู่ใหม่</p>
        <Input
          className="h-8 text-sm"
          placeholder="ชื่อหมวดหมู่..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && newName.trim() && addMutation.mutate()}
        />
        <div className="flex gap-1.5 flex-wrap">
          {PRESET_COLORS.map((c) => (
            <button
              key={c.label}
              title={c.label}
              className={`w-5 h-5 rounded-full ${c.bg} border-2 transition-all ${newColor === c.label ? "border-foreground scale-110" : "border-transparent hover:border-muted-foreground/40"}`}
              onClick={() => setNewColor(c.label)}
            />
          ))}
        </div>
        <Button
          size="sm"
          className="w-full gap-1.5"
          disabled={!newName.trim() || addMutation.isPending}
          onClick={() => addMutation.mutate()}
        >
          <Plus className="w-3.5 h-3.5" />
          เพิ่มหมวดหมู่
        </Button>
      </div>
    </div>
  );
}