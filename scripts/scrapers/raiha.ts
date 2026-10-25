import * as cheerio from 'cheerio';
import type { Show } from '../../src/types';
import { calendarDate, normalizeTime } from '../../src/lib/normalize';
import { requestJson } from '../lib/http';
import { pktDays } from '../lib/dates';

const BRANCHES = [
  {
    branchId: '3', location: 'Bahria Town Karachi', city: 'Karachi',
    lounges: [{ id: '6', name: 'Gold Lounge' }, { id: '7', name: 'Red Lounge' }, { id: '8', name: 'Platinum Lounge' }],
  },
  {
    branchId: '1', location: 'Bahria Town Lahore', city: 'Lahore',
    lounges: [{ id: '1', name: 'Gold Lounge' }, { id: '2', name: 'Red Lounge' }],
  },
  {
    branchId: '2', location: 'Bahria Town Islamabad', city: 'RWP/ISB',
    lounges: [{ id: '3', name: 'Red Lounge' }, { id: '4', name: 'Gold Lounge' }],
  },
];

export async function scrapeRaiha(): Promise<Show[]> {
  const shows: Show[] = [];
  const days = pktDays(7);
  let failures = 0;
  let requests = 0;

  for (const branch of BRANCHES) {
    for (const day of days) {
      for (const lounge of branch.lounges) {
        requests++;
        try {
          const res = await requestJson<{ message?: string }>('https://www.cinegoldplex.com/api/get_schedules', {
            method: 'POST',
            form: { branchId: branch.branchId, loungeId: lounge.id, showDate: day.iso },
            timeoutMs: 15000,
            retries: 1,
          });
          if (!res?.message) continue;

          const $ = cheerio.load(res.message);
          $('.movie-section').each((_, sec) => {
            const titleP = $(sec).find('.show-popup-title p').first();
            if (!titleP.length) return;
            const langText = titleP.find('.watch-lang').text().trim();
            titleP.find('.watch-lang').remove();
            const rawTitle = titleP.text().trim();
            if (!rawTitle) return;

            const is3D = /3D/i.test(langText) || /3D/i.test(rawTitle);
            const movie = /urdu/i.test(langText) ? `${rawTitle} (Urdu Dubbed)`
              : /punjabi/i.test(langText) ? `${rawTitle} (Punjabi)`
              : rawTitle;

            $(sec).find('.showtime-timings a, li').each((_, timeEl) => {
              const timeText = $(timeEl).text().trim();
              const time = normalizeTime(timeText);
              if (!/^\d{2}:\d{2} [AP]M$/.test(time)) return;
              shows.push({
                cinema: 'Raiha CineGold',
                location: branch.location,
                city: branch.city,
                movie,
                format: is3D || /3D/i.test(timeText) ? '3D' : '2D',
                date: calendarDate(day.display, time),
                time,
                screen: lounge.name,
                source: 'raiha',
              });
            });
          });
        } catch {
          failures++;
        }
      }
    }
  }

  if (failures === requests) throw new Error('every Raiha request failed');
  if (failures) console.warn(`  Raiha: ${failures}/${requests} requests failed`);
  return shows;
}
