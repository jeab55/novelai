import { base44 } from "@/api/base44Client";

/**
 * บันทึก snapshot ของ record ลง Version entity
 * @param {object} params
 * @param {"chapter"|"plot_event"|"character"|"world_entry"|"novel"} params.entityType
 * @param {string} params.entityId
 * @param {string} params.novelId
 * @param {object} params.data - ข้อมูลปัจจุบันที่จะ snapshot
 * @param {string} [params.label] - หัวข้อย่อ
 * @param {string} [params.createdByName] - ชื่อผู้บันทึก
 */
export async function saveVersion({ entityType, entityId, novelId, data, label = "", createdByName = "" }) {
  await base44.entities.Version.create({
    entity_type: entityType,
    entity_id: entityId,
    novel_id: novelId,
    snapshot: JSON.stringify(data),
    label: label || "",
    created_by_name: createdByName || "",
  });
}