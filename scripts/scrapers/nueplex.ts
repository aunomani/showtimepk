import * as cheerio from 'cheerio';
import type { Show } from '../../src/types';
import { calendarDate, normalizeDate, normalizeTime } from '../../src/lib/normalize';
import { CookieJar, request } from '../lib/http';
import { pktDays } from '../lib/dates';

const BASE = 'https://www.nueplex.com/';

// The site stores the chosen branch in a PHP session cookie.
const BRANCHES = [
  { id: '1', cinema: 'Nueplex DHA', location: 'DHA Phase 8' },
  { id: '2', cinema: 'Nueplex Askari IV', location: 'Askari IV' },
];

/** Parses the HTML returned by POST /showtime.html (the same HTML you used to copy from DevTools). */
export function parseNueplexShowtimes(html: string, businessDate: string): Omit<Show, 'cinema' | 'location' | 'city'>[] {
  const $ = cheerio.load(html);
  const shows: Omit<Show, 'cinema' | 'location' | 'city'>[] = [];
  let screen = '';

  $('.cinema-heading, .show-time-li').each((_, el) => {
    const $el = $(el);
    if ($el.hasClass('cinema-heading')) {
      screen = $el.find('h5, h4, h3').first().text().trim();
      return;
    }

    const movie = $el.find('.eq-height').first().text().trim();
    // ".time" contains a nested "*" marker for after-midnight shows
    const time = normalizeTime($el.find('.time').first().text().replace(/\*/g, ''));
    if (!movie || !/^\d{2}:\d{2} [AP]M$/.test(time)) return;

    const formatLabel = $el
      .find('.bg_blue')
      .filter((_, l) => $(l).closest('.status').length === 0)
      .first()
      .text()
      .trim();

    // After-midnight shows carry an explicit label like "*Mon 26th October 2026"
    const dayLabel = $el.find('.movie_day').text().replace(/\*/g, '').trim();
    const labelled = dayLabel ? normalizeDate(dayLabel) : '';
    const date = /^\d{2}-[A-Z][a-z]{2}-\d{4}$/.test(labelled) ? labelled : calendarDate(businessDate, time);

    shows.push({
      movie,
      format: /3D/i.test(formatLabel) ? '3D' : '2D',
      date,
      time,
      screen,
      source: 'nueplex',
    });
  });
  return shows;
}

export async function scrapeNueplex(): Promise<Show[]> {
  const shows: Show[] = [];
  const days = pktDays(7);

  for (const branch of BRANCHES) {
    const jar = new CookieJar();
    await request(BASE, { cookies: jar });
    await request(`${BASE}branch`, { method: 'POST', form: { branch: branch.id }, cookies: jar });

    for (const day of days) {
      try {
        const html = await request(`${BASE}showtime.html`, {
          method: 'POST',
          form: { showDateTime: day.iso, showMovie: 'All', showCinema: 'All' },
          cookies: jar,
          headers: { 'X-Requested-With': 'XMLHttpRequest', Referer: BASE },
        });
        for (const s of parseNueplexShowtimes(html, day.display)) {
          shows.push({ ...s, cinema: branch.cinema, location: branch.location, city: 'Karachi' });
        }
      } catch (err: any) {
        console.warn(`  Nueplex: ${branch.cinema} ${day.iso} failed: ${err.message}`);
      }
    }
  }
  return shows;
}
