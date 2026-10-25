import * as cheerio from 'cheerio';
import type { Show } from '../../src/types';
import { resolveCinemaMapping } from '../../src/lib/cinemaMapping';
import { calendarDate, normalizeDate, normalizeTime } from '../../src/lib/normalize';
import { request, requestJson } from '../lib/http';
import { pktDays } from '../lib/dates';

const BASE = 'https://www.thearena.com.pk/';

// Used if the weekly schedule page can't be read. Matches the site as of Oct 2026.
const FALLBACK_BRANCHES = [
  { id: '1', name: 'Arena Islamabad' },
  { id: '2', name: 'Arena Lahore' },
  { id: '3', name: 'Arena Karachi' },
];

/** Reads branch IDs and available dates from the weekly schedule page (same data the site's own JS uses). */
async function discover(): Promise<{ branches: { id: string; name: string }[]; dates: string[] }> {
  try {
    const $ = cheerio.load(await request(`${BASE}weekly_schedule`));
    const branches = $('.loc_item')
      .map((_, el) => ({ id: String($(el).attr('data-loc') || ''), name: $(el).text().trim() }))
      .get()
      .filter(b => b.id);
    const dates = $('.date_item')
      .map((_, el) => String($(el).attr('data-date') || ''))
      .get()
      .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
    return {
      branches: branches.length ? branches : FALLBACK_BRANCHES,
      dates: dates.length ? dates : pktDays(7).map(d => d.iso),
    };
  } catch {
    return { branches: FALLBACK_BRANCHES, dates: pktDays(7).map(d => d.iso) };
  }
}

export async function scrapeArena(): Promise<Show[]> {
  const { branches, dates } = await discover();
  const shows: Show[] = [];
  let failures = 0;

  for (const branch of branches) {
    const mapping = resolveCinemaMapping(`The ${branch.name}`);
    for (const isoDate of dates) {
      try {
        const res = await requestJson<{ status?: string; message?: string }>(`${BASE}api/get_schedules`, {
          method: 'POST',
          form: { branchId: branch.id, showDate: isoDate },
        });
        if (res?.status !== 'success' || !res.message) continue;

        const $ = cheerio.load(res.message);
        $('tr.showtime-item').each((_, row) => {
          // e.g. "Clayface- 2D Urdu"; cleanTitle() later turns this into "Clayface (Urdu Dubbed)"
          const heading = $(row).find('.movie_description h3, .movie_description h4').first().text().trim();
          if (!heading) return;
          const format = /3D/i.test(heading) ? '3D' : '2D';

          $(row).find('.movie_times span').each((_, span) => {
            const time = normalizeTime($(span).text());
            if (!/^\d{2}:\d{2} [AP]M$/.test(time)) return;
            shows.push({
              cinema: mapping.sheetColA,
              location: mapping.sheetColB,
              city: mapping.city,
              movie: heading,
              format,
              date: calendarDate(normalizeDate(isoDate), time),
              time,
              screen: '',
              source: 'arena',
            });
          });
        });
      } catch (err: any) {
        failures++;
        console.warn(`  Arena: ${branch.name} ${isoDate} failed: ${err.message}`);
      }
    }
  }

  if (failures && failures === branches.length * dates.length) throw new Error('every Arena request failed');
  return shows;
}
