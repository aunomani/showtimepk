import type { Show } from '../../src/types';
import { calendarDate, normalizeDate, normalizeTime } from '../../src/lib/normalize';
import { requestJson } from '../lib/http';

const BRANCHES = [
  { cinemaId: '0000000002', location: 'Ocean Mall Karachi', city: 'Karachi' },
  { cinemaId: '0000000012', location: 'Amanah Mall Lahore', city: 'Lahore' },
  { cinemaId: '0000000014', location: 'Packages Mall Lahore', city: 'Lahore' },
  { cinemaId: '0000000003', location: 'Jinnah Park Rawalpindi', city: 'RWP/ISB' },
  { cinemaId: '0000000011', location: 'World Trade center Islamabad', city: 'RWP/ISB' },
];

const HEADERS = { Referer: 'https://web.cinepax.com/pages/movies.html' };

async function getList(url: string): Promise<any[]> {
  try {
    const data = await requestJson(url, { headers: HEADERS });
    return Array.isArray(data) ? data : [];
  } catch (err: any) {
    console.warn(`  Cinepax: ${url} failed: ${err.message}`);
    return [];
  }
}

export async function scrapeCinepax(): Promise<Show[]> {
  const shows: Show[] = [];

  for (const branch of BRANCHES) {
    const [nowShowing, advance] = await Promise.all([
      getList(`https://web.cinepax.com/api/movies?cinemaId=${branch.cinemaId}`),
      getList(`https://web.cinepax.com/api/advance-booking?cinemaId=${branch.cinemaId}`),
    ]);

    for (const film of [...nowShowing, ...advance]) {
      const title = String(film?.title || '').trim();
      if (!title || !film?.screens || typeof film.screens !== 'object') continue;
      const titleIs3D = /3D/i.test(title);

      for (const [screenKey, screen] of Object.entries(film.screens as Record<string, any>)) {
        const screenIs3D =
          /3D/i.test(String(screen?.type || '')) ||
          (Array.isArray(screen?.features) && screen.features.some((f: any) => /3D/i.test(String(f))));

        for (const sess of Array.isArray(screen?.sessions) ? screen.sessions : []) {
          const time = normalizeTime(String(sess?.displayTime || ''));
          if (!/^\d{2}:\d{2} [AP]M$/.test(time)) continue;

          // `showtime` is the real start time; `businessDate` lumps after-midnight shows into the day before.
          let date = '';
          if (sess?.showtime) date = normalizeDate(String(sess.showtime));
          else if (sess?.businessDate) date = calendarDate(String(sess.businessDate), time);
          if (!/^\d{2}-[A-Z][a-z]{2}-\d{4}$/.test(date)) continue;

          const attrIs3D = Array.isArray(sess?.attributes) && sess.attributes.some((a: any) => /3D/i.test(String(a)));

          shows.push({
            cinema: 'Cinepax',
            location: branch.location,
            city: branch.city,
            movie: title,
            format: titleIs3D || screenIs3D || attrIs3D ? '3D' : '2D',
            date,
            time,
            screen: String(sess?.screenName || screenKey || '').trim(),
            source: 'cinepax',
          });
        }
      }
    }
  }
  return shows;
}
