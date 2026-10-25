/**
 * Date/time helpers shared by the website and the scraper script.
 * Canonical formats: date "DD-Mon-YYYY" (e.g. 05-Oct-2026), time "hh:mm AM" (e.g. 07:30 PM).
 */

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(year: number, monthIdx: number, day: number): string {
  return `${String(day).padStart(2, '0')}-${MONTHS[monthIdx]}-${year}`;
}

function monthIndex(name: string): number {
  return MONTHS.findIndex(m => m.toLowerCase() === name.substring(0, 3).toLowerCase());
}

/**
 * Converts the many date shapes we see (25-Oct-2026, 5-Oct-2026, 2026-10-25,
 * "Sun, 25-Oct-2026", "25 October 2026", "Mon 26th October 2026", "Date(2026,9,25)")
 * into "DD-Mon-YYYY". Returns the input unchanged if it can't be understood.
 */
export function normalizeDate(raw: string | undefined | null): string {
  if (!raw) return '';
  const s = String(raw).trim();

  // Google Sheets gviz raw date value: Date(2026,9,25)
  let m = s.match(/^Date\((\d{4}),(\d{1,2}),(\d{1,2})/);
  if (m) return formatDate(+m[1], +m[2], +m[3]);

  // ISO: 2026-10-25 or 2026-10-25T...
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return formatDate(+m[1], +m[2] - 1, +m[3]);

  // 25-Oct-2026 / 25 October 2026 / 26th October 2026 (optionally prefixed by weekday)
  m = s.match(/(\d{1,2})(?:st|nd|rd|th)?[\s\-\/]+([A-Za-z]{3,9})[\s\-\/,]+(\d{4})/);
  if (m && monthIndex(m[2]) !== -1) return formatDate(+m[3], monthIndex(m[2]), +m[1]);

  // Oct 25 2026 / October 25, 2026
  m = s.match(/([A-Za-z]{3,9})[\s\-]+(\d{1,2})(?:st|nd|rd|th)?,?[\s\-]+(\d{4})/);
  if (m && monthIndex(m[1]) !== -1) return formatDate(+m[3], monthIndex(m[1]), +m[2]);

  return s;
}

/** "7:5 pm" / "07:05PM" / "19:05" -> "07:05 PM". Returns input unchanged if unrecognised. */
export function normalizeTime(raw: string | undefined | null): string {
  if (!raw) return '';
  const s = String(raw).trim();
  const m = s.match(/(\d{1,2}):(\d{2})\s*([AaPp][Mm])?/);
  if (!m) return s;
  let hour = parseInt(m[1], 10);
  const minute = m[2];
  let suffix = m[3]?.toUpperCase();
  if (!suffix) {
    suffix = hour >= 12 ? 'PM' : 'AM';
    if (hour > 12) hour -= 12;
    if (hour === 0) hour = 12;
  }
  return `${String(hour).padStart(2, '0')}:${minute} ${suffix}`;
}

/** True for shows between 12:00 AM and 5:59 AM, which cinemas list under the previous day. */
export function isAfterMidnight(time: string): boolean {
  const m = normalizeTime(time).match(/^(\d{2}):\d{2} (AM|PM)$/);
  if (!m || m[2] !== 'AM') return false;
  const hour = parseInt(m[1], 10);
  return hour === 12 || hour < 6;
}

/** Adds days to a "DD-Mon-YYYY" date. */
export function addDays(date: string, days: number): string {
  const parts = normalizeDate(date).split('-');
  if (parts.length !== 3) return date;
  const monthIdx = monthIndex(parts[1]);
  if (monthIdx === -1) return date;
  const d = new Date(Date.UTC(+parts[2], monthIdx, +parts[0]));
  d.setUTCDate(d.getUTCDate() + days);
  return formatDate(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Cinemas group late-night shows under the "business day" they started on.
 * We list them on the real calendar day instead, so a 12:30 AM show
 * on the 25th's schedule appears on the 26th.
 */
export function calendarDate(businessDate: string, time: string): string {
  return isAfterMidnight(time) ? addDays(businessDate, 1) : normalizeDate(businessDate);
}

/** Parses "DD-Mon-YYYY" into a local Date (midnight), or null. */
export function parseDisplayDate(date: string): Date | null {
  const parts = normalizeDate(date).split('-');
  if (parts.length !== 3) return null;
  const monthIdx = monthIndex(parts[1]);
  if (monthIdx === -1) return null;
  return new Date(+parts[2], monthIdx, +parts[0]);
}
