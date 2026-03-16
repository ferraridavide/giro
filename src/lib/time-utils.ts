/**
 * Round a time slot to whole hours.
 *
 * - Start time rounds DOWN to the nearest hour
 * - End time rounds UP to the nearest hour
 *
 * Example: started 12:10, ended 12:49 → 12:00 to 13:00 (1 hour)
 */
export function roundTimeSlot(startMs: number, endMs: number): { startDate: string; startTime: string; durationSeconds: number } {
  const start = new Date(startMs);
  const end = new Date(endMs);

  // Round start DOWN to nearest hour
  const roundedStart = new Date(start);
  roundedStart.setMinutes(0, 0, 0);

  // Round end UP to nearest hour
  const roundedEnd = new Date(end);
  if (roundedEnd.getMinutes() > 0 || roundedEnd.getSeconds() > 0 || roundedEnd.getMilliseconds() > 0) {
    roundedEnd.setHours(roundedEnd.getHours() + 1, 0, 0, 0);
  }

  const durationMs = roundedEnd.getTime() - roundedStart.getTime();
  const durationSeconds = Math.max(Math.round(durationMs / 1000), 3600); // minimum 1 hour

  const startDate = formatDate(roundedStart);
  const startTime = formatTime(roundedStart);

  return { startDate, startTime, durationSeconds };
}

/** Format as YYYY-MM-DD */
function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Format as HH:mm:ss */
function formatTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}
