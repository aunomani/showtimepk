import { formatDate } from '../../src/lib/normalize';

/** Pakistan is UTC+5 all year (no daylight saving). GitHub's servers run on UTC. */
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

export interface DayInfo {
  iso: string;      // 2026-10-25 (what cinema APIs expect)
  display: string;  // 25-Oct-2026 (what the website uses)
}

/** Today and the following days, in Pakistan time. */
export function pktDays(count: number): DayInfo[] {
  const days: DayInfo[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.now() + PKT_OFFSET_MS);
    d.setUTCDate(d.getUTCDate() + i);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const day = d.getUTCDate();
    days.push({
      iso: `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      display: formatDate(y, m, day),
    });
  }
  return days;
}

export function pktToday(): DayInfo {
  return pktDays(1)[0];
}
