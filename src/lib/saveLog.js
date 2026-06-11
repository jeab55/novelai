/**
 * Centralized save/action log stored in localStorage.
 * Keeps the last MAX_LOG entries for debugging and UX display.
 */

const STORAGE_KEY = "novel_app_action_log";
const MAX_LOG = 20;

export function getLog() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function appendLog(entry) {
  // entry: { action, entity, label, success, error, timestamp }
  const log = getLog();
  log.unshift({ ...entry, timestamp: new Date().toISOString() });
  const trimmed = log.slice(0, MAX_LOG);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {}
  // Dispatch custom event so subscribers can update
  window.dispatchEvent(new Event("actionlog_updated"));
}

export function clearLog() {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event("actionlog_updated"));
}