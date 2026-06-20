import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// สำรองข้อมูลตอนอัตโนมัติเมื่อสถานะเปลี่ยนเป็น "เขียนเสร็จ"
// ถูกเรียกโดย entity automation (Chapter update)
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const event = body?.event || {};
    let data = body?.data || null;
    const oldData = body?.old_data || null;
    const entityId = event?.entity_id;

    if (!entityId) {
      return Response.json({ skipped: true, reason: 'no entity id' });
    }

    // ถ้า payload ใหญ่เกินไป ให้ดึงข้อมูลตอนเอง
    if (body?.payload_too_large || !data) {
      data = await base44.asServiceRole.entities.Chapter.get(entityId);
    }

    if (!data) {
      return Response.json({ skipped: true, reason: 'no chapter data' });
    }

    // สำรองเฉพาะตอนที่ "เพิ่ง" เปลี่ยนเป็นเขียนเสร็จ (กันบันทึกซ้ำทุกครั้งที่แก้ตอนที่เสร็จแล้ว)
    const becameDone = data.status === 'เขียนเสร็จ' && oldData?.status !== 'เขียนเสร็จ';
    if (!becameDone) {
      return Response.json({ skipped: true, reason: 'status not newly completed' });
    }

    const now = new Date();
    const timeLabel = now.toLocaleString('th-TH', {
      timeZone: 'Asia/Bangkok',
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    await base44.asServiceRole.entities.Version.create({
      entity_type: 'chapter',
      entity_id: entityId,
      novel_id: data.novel_id,
      snapshot: JSON.stringify(data),
      label: `สำรองอัตโนมัติเมื่อเขียนเสร็จ · ${timeLabel}`,
      created_by_name: 'ระบบสำรองอัตโนมัติ',
    });

    return Response.json({ success: true, chapterId: entityId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});