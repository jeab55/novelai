import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveVersion } from "@/lib/saveVersion";

const ROLES = ["ตัวเอก", "ตัวรอง", "ตัวร้าย", "ตัวประกอบ"];

export default function CharacterForm({ novelId, character, onDone, novelIdForVersion }) {
  const [form, setForm] = useState({
    name: character?.name || "",
    role: character?.role || "",
    age: character?.age || "",
    appearance: character?.appearance || "",
    personality: character?.personality || "",
    background: character?.background || "",
    desire: character?.desire || "",
    wound: character?.wound || "",
    relationships: character?.relationships || "",
  });
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data) => {
      if (character) {
        await saveVersion({
          entityType: "character",
          entityId: character.id,
          novelId: novelIdForVersion || novelId,
          data: character,
          label: `แก้ไขตัวละคร: ${character.name}`,
        });
        return base44.entities.Character.update(character.id, data);
      } else {
        return base44.entities.Character.create({ ...data, novel_id: novelId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["characters", novelId] });
      onDone();
    },
  });

  const set = (field, value) => setForm((p) => ({ ...p, [field]: value }));

  const fields = [
    { key: "name", label: "ชื่อตัวละคร", type: "input", placeholder: "เช่น เจ้าพระยาวิชาเยนทร์" },
    { key: "role", label: "บทบาท", type: "select", options: ROLES },
    { key: "age", label: "อายุ", type: "input", placeholder: "เช่น 28" },
    { key: "appearance", label: "ลักษณะภายนอก", type: "textarea", placeholder: "รูปร่าง หน้าตา การแต่งกาย..." },
    { key: "personality", label: "นิสัยและบุคลิก", type: "textarea", placeholder: "นิสัย อุปนิสัย พฤติกรรม..." },
    { key: "background", label: "ปูมหลัง", type: "textarea", placeholder: "ที่มา ครอบครัว ประวัติ..." },
    { key: "desire", label: "สิ่งที่ต้องการ", type: "textarea", placeholder: "แรงจูงใจ เป้าหมาย..." },
    { key: "wound", label: "ปม/บาดแผลทางใจ", type: "textarea", placeholder: "ความเจ็บปวด ความกลัว..." },
    { key: "relationships", label: "ความสัมพันธ์", type: "textarea", placeholder: "ความสัมพันธ์กับตัวละครอื่น..." },
  ];

  return (
    <div className="space-y-4 mt-2">
      {fields.map((f) => (
        <div key={f.key}>
          <label className="text-sm font-medium mb-1.5 block">{f.label}</label>
          {f.type === "input" && (
            <Input value={form[f.key]} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} />
          )}
          {f.type === "select" && (
            <Select value={form[f.key]} onValueChange={(v) => set(f.key, v)}>
              <SelectTrigger><SelectValue placeholder="เลือก" /></SelectTrigger>
              <SelectContent>
                {f.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {f.type === "textarea" && (
            <Textarea value={form[f.key]} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} rows={2} />
          )}
        </div>
      ))}
      <Button className="w-full" onClick={() => mutation.mutate(form)} disabled={!form.name || mutation.isPending}>
        {mutation.isPending ? "กำลังบันทึก..." : character ? "อัปเดต" : "เพิ่มตัวละคร"}
      </Button>
    </div>
  );
}