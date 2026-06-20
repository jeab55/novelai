import React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, Cell } from "recharts";

export default function DailyWordsChart({ data, goal }) {
  return (
    <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm">
      <h3 className="font-heading font-semibold mb-4">คำที่เขียนรายวัน (14 วันล่าสุด)</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
              contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }}
              formatter={(v) => [`${v.toLocaleString()} คำ`, "เขียน"]}
            />
            {goal > 0 && <ReferenceLine y={goal} stroke="hsl(var(--primary))" strokeDasharray="4 4" />}
            <Bar dataKey="words" radius={[6, 6, 0, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={goal > 0 && d.words >= goal ? "hsl(var(--primary))" : "hsl(var(--chart-3))"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {goal > 0 && <p className="text-xs text-muted-foreground mt-2">เส้นประ = เป้าหมาย {goal.toLocaleString()} คำ/วัน · แท่งเข้มคือวันที่ถึงเป้า</p>}
    </div>
  );
}