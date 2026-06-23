import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { generateBlurbs } from "@/lib/synopsisPrompt";

// Hook กลางสำหรับร่างคำโปรยจากพล็อตของนิยายเรื่องที่มีอยู่แล้ว
// ดึงข้อมูลจริงของเรื่อง (แนว, เรื่องย่อเดิม, plot_outline, ยุค/ฉาก, ตัวละครหลัก+ปม)
// แล้วเสนอคำโปรยหลายแบบให้ผู้ใช้เลือก — เก็บผลทุกรอบไว้เปรียบเทียบได้
export function useBlurbDrafter() {
  const [drafting, setDrafting] = useState(false);
  const [blurbs, setBlurbs] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  // novel: object ที่มี id, title, genre, synopsis, era, plot_outline, writer_id
  // overrides: ค่าจากฟอร์มที่กำลังแก้ (title/genre/synopsis/era) + sourceMode ("anchored" | "free")
  const draftFromPlot = async (novel, overrides = {}) => {
    if (!novel?.id) return;
    const sourceMode = overrides.sourceMode || "anchored";
    setDrafting(true);
    try {
      const [characters, writers] = await Promise.all([
        base44.entities.Character.filter({ novel_id: novel.id }),
        novel.writer_id ? base44.entities.Writer.filter({ id: novel.writer_id }) : Promise.resolve([]),
      ]);
      const mainChars = (characters || []).filter((c) => !c.is_deleted);
      const writerSystemPrompt = writers?.[0]?.system_prompt || "";

      const story = {
        title: overrides.title ?? novel.title,
        genre: overrides.genre ?? novel.genre,
        // โหมดแตกแนวอิสระ: ไม่ส่งเรื่องย่อ/พล็อตเดิมเข้าไปผูก
        synopsis: sourceMode === "free" ? "" : (overrides.synopsis ?? novel.synopsis),
        era: overrides.era ?? novel.era,
        plot_outline: sourceMode === "free" ? "" : novel.plot_outline,
        analysis_summary: sourceMode === "free" ? "" : overrides.analysis_summary,
      };

      const result = await generateBlurbs(story, mainChars, { variants: 3, writerSystemPrompt, sourceMode });
      setBlurbs(result);
      setPickerOpen(true);
      return result;
    } catch (err) {
      toast.error(err?.message || "AI ไม่สามารถร่างคำโปรยได้ กรุณาลองใหม่อีกครั้ง");
      return [];
    } finally {
      setDrafting(false);
    }
  };

  const closePicker = () => setPickerOpen(false);

  return { drafting, blurbs, pickerOpen, draftFromPlot, closePicker, setPickerOpen };
}