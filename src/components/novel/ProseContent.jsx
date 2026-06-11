import React from "react";

/**
 * แสดงเนื้อหานิยายให้สวยงาม:
 * - ย่อหน้าเว้นช่องชัดเจน
 * - บทสนทนาขึ้นบรรทัดใหม่
 * - ความกว้างอ่านสบาย
 */
export default function ProseContent({ content, fontSizePx = 18, fontCss, lineHeight = "1.8", maxWidth = 680 }) {
  if (!content) return <p className="text-muted-foreground italic text-sm">(ไม่มีเนื้อหา)</p>;

  // แยกเป็น paragraph โดย \n\n หรือ \n
  const paragraphs = content.split(/\n\n+/).flatMap((block) => {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    return lines.length > 1 ? lines : [block.trim()];
  }).filter(Boolean);

  return (
    <div
      className="mx-auto"
      style={{
        maxWidth: `${maxWidth}px`,
        fontFamily: fontCss || "'Sarabun', 'Noto Sans Thai', sans-serif",
        fontSize: `${fontSizePx}px`,
        lineHeight: lineHeight,
        color: "hsl(var(--foreground))",
      }}
    >
      {paragraphs.map((para, i) => {
        const trimmed = para.trim();
        if (!trimmed) return null;

        // บทสนทนา: ขึ้นต้นด้วย " หรือ ' หรือ "
        const isDialogue = /^["'"\u201C\u201D\u2018\u2019]/.test(trimmed);

        return (
          <p
            key={i}
            className={isDialogue ? "mb-3" : "mb-4"}
            style={{
              textIndent: isDialogue ? "0" : "2em",
              paddingLeft: isDialogue ? "1em" : "0",
              borderLeft: isDialogue ? "2px solid hsl(var(--primary) / 0.2)" : "none",
            }}
          >
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}