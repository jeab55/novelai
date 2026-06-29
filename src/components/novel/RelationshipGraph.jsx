import React, { useMemo, useState } from "react";

const relTypeStyle = {
  รัก: { stroke: "#ec4899", label: "รัก" },
  ศัตรู: { stroke: "#ef4444", label: "ศัตรู" },
  เพื่อน: { stroke: "#3b82f6", label: "เพื่อน" },
  คู่แข่ง: { stroke: "#f97316", label: "คู่แข่ง" },
  มิตร: { stroke: "#22c55e", label: "มิตร" },
  อื่นๆ: { stroke: "#94a3b8", label: "เกี่ยวข้อง" },
};

const roleFill = {
  "ตัวเอก": "#f59e0b",
  "ตัวรอง": "#0ea5e9",
  "ตัวร้าย": "#ef4444",
  "ตัวประกอบ": "#94a3b8",
};

// แผนผังโหนด-เส้นเชื่อมโยง วางตัวละครเป็นวงกลม แล้วลากเส้นตามความสัมพันธ์
export default function RelationshipGraph({ characters, edges }) {
  const [hoverId, setHoverId] = useState(null);

  const W = 720;
  const H = 720;
  const cx = W / 2;
  const cy = H / 2;
  const radius = Math.min(W, H) / 2 - 110;

  // วางตำแหน่งโหนดเป็นวงกลม
  const nodes = useMemo(() => {
    const n = characters.length;
    return characters.map((c, i) => {
      if (n === 1) return { ...c, x: cx, y: cy };
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      return { ...c, x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
    });
  }, [characters, cx, cy, radius]);

  const nodeById = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);

  const isEdgeActive = (e) => !hoverId || e.from === hoverId || e.to === hoverId;
  const isNodeDim = (id) => {
    if (!hoverId) return false;
    if (id === hoverId) return false;
    return !edges.some((e) => (e.from === hoverId && e.to === id) || (e.to === hoverId && e.from === id));
  };

  return (
    <div className="w-full overflow-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-3xl mx-auto" style={{ minWidth: 480 }}>
        {/* เส้นเชื่อมโยง */}
        {edges.map((e, idx) => {
          const a = nodeById[e.from];
          const b = nodeById[e.to];
          if (!a || !b) return null;
          const style = relTypeStyle[e.type] || relTypeStyle["อื่นๆ"];
          const active = isEdgeActive(e);
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          return (
            <g key={idx} opacity={active ? 1 : 0.12} style={{ transition: "opacity 0.2s" }}>
              <line
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={style.stroke}
                strokeWidth={hoverId && active ? 2.5 : 1.6}
                strokeDasharray={e.source === "event" ? "5 4" : undefined}
              />
              {hoverId && active && (
                <>
                  <rect x={mx - 26} y={my - 10} width={52} height={18} rx={6} fill="white" stroke={style.stroke} strokeWidth={0.8} />
                  <text x={mx} y={my + 3} textAnchor="middle" fontSize={10} fill={style.stroke} fontWeight={600}>
                    {style.label}
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* โหนดตัวละคร */}
        {nodes.map((node) => {
          const dim = isNodeDim(node.id);
          const fill = roleFill[node.role] || roleFill["ตัวประกอบ"];
          const r = node.role === "ตัวเอก" ? 26 : 20;
          return (
            <g
              key={node.id}
              opacity={dim ? 0.25 : 1}
              style={{ transition: "opacity 0.2s", cursor: "pointer" }}
              onMouseEnter={() => setHoverId(node.id)}
              onMouseLeave={() => setHoverId(null)}
              onClick={() => setHoverId((p) => (p === node.id ? null : node.id))}
            >
              <circle cx={node.x} cy={node.y} r={r + 4} fill={fill} opacity={0.15} />
              <circle cx={node.x} cy={node.y} r={r} fill={fill} stroke="white" strokeWidth={2.5} />
              <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize={r > 22 ? 13 : 11} fill="white" fontWeight={700}>
                {node.name.slice(0, 2)}
              </text>
              <text x={node.x} y={node.y + r + 16} textAnchor="middle" fontSize={12} fill="currentColor" fontWeight={600} className="fill-foreground">
                {node.name.length > 12 ? node.name.slice(0, 12) + "…" : node.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}