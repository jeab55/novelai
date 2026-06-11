/**
 * useSafeAction — wraps any async entity mutation with:
 *   - Loading state / button disable
 *   - 1 automatic retry on failure
 *   - Verify that returned object has an `id`
 *   - Success / failure toast
 *   - Append to activity log
 */
import { useState } from "react";
import { toast } from "sonner";
import { appendLog } from "@/lib/saveLog";

/**
 * @param {object} options
 * @param {string} options.action  — human label e.g. "สร้างตัวละคร"
 * @param {string} options.entity  — entity name e.g. "Character"
 * @param {Function} options.fn    — async function that does the work; should return the saved object (with .id) or throw
 * @param {Function} [options.onSuccess] — called after verified success
 * @param {Function} [options.onError]   — called after final failure
 * @param {number}  [options.maxRetries=1]
 */
export function useSafeAction({ action, entity, fn, onSuccess, onError, maxRetries = 1 }) {
  const [isPending, setIsPending] = useState(false);

  const run = async (...args) => {
    if (isPending) return;
    setIsPending(true);

    let lastError = null;
    let result = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        result = await fn(...args);

        // Verify: result must be an object with id OR be a non-null truthy value
        const hasId = result && (typeof result === "object" ? !!result.id : true);
        if (!hasId && result !== undefined && result !== null) {
          throw new Error("ข้อมูลที่บันทึกไม่มี ID กลับมา — อาจบันทึกไม่สำเร็จ");
        }

        // SUCCESS
        appendLog({ action, entity, label: action, success: true, error: null });
        toast.success(`${action} สำเร็จ`, { duration: 2500 });
        if (onSuccess) onSuccess(result);
        setIsPending(false);
        return result;
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries) {
          // Wait a bit before retry
          await new Promise((r) => setTimeout(r, 800));
        }
      }
    }

    // FAILURE after all retries
    appendLog({ action, entity, label: action, success: false, error: lastError?.message || "ไม่ทราบสาเหตุ" });

    toast.error(`${action} ไม่สำเร็จ — ${lastError?.message || "ลองใหม่อีกครั้ง"}`, {
      duration: 5000,
      action: {
        label: "ลองใหม่",
        onClick: () => run(...args),
      },
    });

    if (onError) onError(lastError);
    setIsPending(false);
    return null;
  };

  return { run, isPending };
}