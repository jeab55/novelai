// คำนวณเลขลำดับตอน (order) ถัดไปที่ยังว่าง เพื่อกันลำดับตอนซ้ำกัน
// - รับ list ของตอนที่มีอยู่ (แต่ละตัวมี field `order`)
// - คืนค่า = max(order) + 1 แต่ถ้าเลขนั้นถูกใช้อยู่แล้ว จะเลื่อนไปเลขถัดไปที่ว่าง
export function getNextChapterOrder(chapters = []) {
  const used = new Set(
    (chapters || [])
      .map((c) => Number(c?.order))
      .filter((n) => Number.isFinite(n))
  );
  const maxOrder = used.size > 0 ? Math.max(...used) : 0;
  let next = maxOrder + 1;
  // เผื่อกรณีมีช่องว่าง/ซ้ำผิดปกติ — เลื่อนจนกว่าจะเจอเลขที่ยังไม่ถูกใช้
  while (used.has(next)) next += 1;
  return next;
}