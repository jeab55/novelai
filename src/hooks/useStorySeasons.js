import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";

/**
 * ค้นหา "เรื่องหลัก (root novel)" และ "ทุกภาคของเรื่อง" จากนิยายเรื่องใดก็ได้
 *
 * - rootNovelId: ไล่ตาม parent_novel_id ขึ้นไปจนถึงนิยายต้นเรื่อง (ภาค 1)
 * - seasonIds:   [root + นิยายลูกทั้งหมดที่ parent_novel_id ชี้มาที่ root เดียวกัน]
 *
 * ใช้สำหรับอ่านข้อมูลร่วมข้ามทุกภาค (Character / WorldEntry / WorldCategory /
 * PlotEvent / CharacterTimeline) โดยไม่ต้องย้ายหรือลบเรคคอร์ดเดิม
 */
export function useStorySeasons(novelId, novel) {
  // ถ้ามี novel แล้ว ใช้ parent_novel_id หา root ได้ทันที (ภาคลูกชี้ขึ้นไปที่ root)
  const directRootId = novel ? (novel.parent_novel_id || novel.id || novelId) : null;

  const { data, isLoading } = useQuery({
    queryKey: ["story-seasons", directRootId || novelId],
    queryFn: async () => {
      const all = await base44.entities.Novel.list();
      const byId = new Map(all.map((n) => [String(n.id), n]));

      // ไล่ parent_novel_id ขึ้นไปจนสุด เผื่อมีลูกของลูก
      let current = byId.get(String(directRootId || novelId)) || null;
      const seen = new Set();
      while (current && current.parent_novel_id && !seen.has(String(current.id))) {
        seen.add(String(current.id));
        const parent = byId.get(String(current.parent_novel_id));
        if (!parent) break;
        current = parent;
      }
      const rootId = String(current?.id || directRootId || novelId);

      const root = byId.get(rootId);
      const children = all.filter(
        (n) => String(n.parent_novel_id) === rootId && !n.is_deleted
      );
      const seasons = [root, ...children]
        .filter((n) => n && !n.is_deleted)
        .sort((a, b) => {
          const sa = a.season_number || 1;
          const sb = b.season_number || 1;
          if (sa !== sb) return sa - sb;
          return new Date(a.created_date || 0) - new Date(b.created_date || 0);
        });

      return {
        rootNovelId: rootId,
        seasonIds: seasons.map((s) => String(s.id)),
        seasons,
      };
    },
    enabled: !!(directRootId || novelId),
    staleTime: 30000,
  });

  // fallback ระหว่างโหลด: ใช้เรื่องปัจจุบันไปก่อน
  const fallbackRoot = String(directRootId || novelId || "");
  return {
    rootNovelId: data?.rootNovelId || fallbackRoot,
    seasonIds: data?.seasonIds || (fallbackRoot ? [fallbackRoot] : []),
    seasons: data?.seasons || [],
    isLoading,
  };
}

/** ดึงเรคคอร์ดของ entity จากทุกภาค (cross-season) แล้วรวมเป็นชุดเดียว */
export async function fetchAcrossSeasons(entityName, seasonIds, sort) {
  const results = await Promise.all(
    seasonIds.map((id) =>
      sort
        ? base44.entities[entityName].filter({ novel_id: id }, sort)
        : base44.entities[entityName].filter({ novel_id: id })
    )
  );
  return results.flat();
}

/**
 * จัดกลุ่มเรคคอร์ดที่ชื่อซ้ำกันข้ามภาค (case-insensitive, trim)
 * คืนค่า: รายการ unique (ตัวแรกของแต่ละชื่อ) พร้อม field _duplicates (เรคคอร์ดอื่นที่ชื่อซ้ำ)
 */
export function dedupeByName(records, nameField = "name") {
  const groups = new Map();
  for (const r of records) {
    const key = (r[nameField] || "").trim().toLowerCase();
    if (!key) {
      groups.set(`__noname_${r.id}`, [r]);
      continue;
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  return Array.from(groups.values()).map((items) => ({
    ...items[0],
    _duplicates: items.slice(1),
    _isDuplicated: items.length > 1,
  }));
}