import { useCallback, useEffect, useRef, useState } from "react";
import { debounce } from "lodash";
import isEqual from "lodash/isEqual";

/**
 * useAutosave — บันทึกข้อมูลอัตโนมัติแบบ debounce เมื่อข้อมูลเปลี่ยนจริง
 *
 * @param {Object}   opts
 * @param {*}        opts.data       ข้อมูลปัจจุบันที่จะถูกบันทึก (object/string/...)
 * @param {Function} opts.onSave     async (data) => void — ฟังก์ชันบันทึกจริง (โยน error ได้)
 * @param {boolean}  [opts.enabled]  เปิด/ปิด autosave (เช่น ปิดตอนสร้างเรคคอร์ดใหม่) ค่าเริ่มต้น true
 * @param {number}   [opts.delay]    เวลา debounce (ms) ค่าเริ่มต้น 2500
 *
 * @returns {{ status: "idle"|"saving"|"saved"|"error", lastSavedAt: Date|null,
 *            error: any, isDirty: boolean, flush: Function, retry: Function }}
 */
export function useAutosave({ data, onSave, enabled = true, delay = 2500 }) {
  const [status, setStatus] = useState("idle"); // idle | saving | saved | error
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [error, setError] = useState(null);

  // เก็บค่าล่าสุดไว้ใน ref เพื่อกัน stale closure ใน debounce
  const dataRef = useRef(data);
  const onSaveRef = useRef(onSave);
  const lastSavedDataRef = useRef(data); // ค่าที่บันทึกสำเร็จล่าสุด (ใช้เทียบว่ามีการเปลี่ยนจริงไหม)
  const isDirtyRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => { dataRef.current = data; }, [data]);
  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);

  const doSave = useCallback(async () => {
    const current = dataRef.current;
    // ไม่บันทึกถ้าไม่มีการเปลี่ยนแปลงจริง
    if (isEqual(current, lastSavedDataRef.current)) {
      isDirtyRef.current = false;
      if (mountedRef.current) setStatus((s) => (s === "saving" ? "saved" : s));
      return;
    }
    if (mountedRef.current) { setStatus("saving"); setError(null); }
    try {
      await onSaveRef.current(current);
      lastSavedDataRef.current = current;
      isDirtyRef.current = false;
      if (mountedRef.current) { setStatus("saved"); setLastSavedAt(new Date()); }
    } catch (e) {
      if (mountedRef.current) { setStatus("error"); setError(e); }
    }
  }, []);

  // debounce สร้างครั้งเดียว
  const debouncedSave = useRef(debounce(() => { doSave(); }, delay)).current;

  // ปรับ delay ถ้าเปลี่ยน (rare) — ไม่จำเป็นต่อ recreate แต่กันค้าง
  useEffect(() => () => debouncedSave.cancel(), [debouncedSave]);

  // เมื่อ data เปลี่ยนและ enabled → ตั้ง dirty + หน่วงบันทึก
  useEffect(() => {
    if (!enabled) return;
    if (isEqual(data, lastSavedDataRef.current)) return; // ไม่เปลี่ยนจริง
    isDirtyRef.current = true;
    setStatus("saving");
    debouncedSave();
  }, [data, enabled, debouncedSave]);

  // บันทึกทันที (เช่น ก่อนปิดหน้า/สลับตอน หรือกดเอง)
  const flush = useCallback(async () => {
    debouncedSave.cancel();
    await doSave();
  }, [debouncedSave, doSave]);

  const retry = useCallback(() => { debouncedSave.cancel(); doSave(); }, [debouncedSave, doSave]);

  // เตือนก่อนปิด/รีเฟรชหน้าถ้ายังมีงานค้าง
  useEffect(() => {
    const handler = (e) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // flush เมื่อ unmount ถ้ายังมีงานค้าง
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (isDirtyRef.current && enabled) {
        debouncedSave.cancel();
        // ยิงบันทึกแบบ fire-and-forget (component กำลัง unmount)
        Promise.resolve(onSaveRef.current(dataRef.current)).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, lastSavedAt, error, isDirty: isDirtyRef.current, flush, retry };
}