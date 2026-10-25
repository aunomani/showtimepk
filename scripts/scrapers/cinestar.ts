import * as cheerio from 'cheerio';
import type { Show } from '../../src/types';
import { calendarDate, normalizeDate, normalizeTime } from '../../src/lib/normalize';
import { request } from '../lib/http';

const BASE = 'https://cinestar.pk';

function branchLocation(header: string, $item: cheerio.Cheerio<any>): string | null {
  const h = header.toUpperCase();
  if (h.includes('SARGODHA')) return null; // not a city we list
  if (h.includes('TOWNSHIP') || $item.find('a[href*="cinemacode=0005"]').length) return 'Township Commercial Area LHR';
  if (h.includes('XINHUA') || h.includes('GULBERG') || $item.find('a[href*="cinemacode=0001"]').length) return 'Xinhua Mall Gulberg III LHR';
  if (h.includes('RAYA') || /\bDHA\b/.test(h) || $item.find('a[href*="cinemacode=0002"]').length) return 'Raya Golf Resort DHA Phase 6 LHR';
  return null;
}

export async function scrapeCineStar(): Promise<Show[]> {
  const listHtml = await request(`${BASE}/Browsing/Movies/NowShowing`);
  const $list = cheerio.load(listHtml);
  const movieLinks = new Set<string>();
  $list('a[href*="/Browsing/Movies/Details/"]').each((_, el) => {
    let href = $list(el).attr('href') || '';
    if (href.startsWith('//')) href = 'https:' + href;
    else if (href.startsWith('/')) href = BASE + href;
    if (href) movieLinks.add(href);
  });

  const shows: Show[] = [];
  for (const url of movieLinks) {
    try {
      const $ = cheerio.load(await request(url));
      const title =
        $('div.film-info div.film-header h3, div.film-info h1, h3.boxout-title').first().text().trim() ||
        $('h2:contains("Show Times")').text().replace(/Show Times/gi, '').trim();
      if (!title) continue;

      $('.film-item').each((_, filmItem) => {
        const $item = $(filmItem);
        const location = branchLocation($item.find('h3.film-title').text().trim(), $item);
        if (!location) return;

        $item.find('.session').each((_, sessionEl) => {
          const dateText = $(sessionEl).find('.session-date').text().trim() || $(sessionEl).find('h4').text().trim();
          const businessDate = normalizeDate(dateText);
          if (!/^\d{2}-[A-Z][a-z]{2}-\d{4}$/.test(businessDate)) return;

          $(sessionEl).find('a.session-time').each((_, timeEl) => {
            const timeText = $(timeEl).find('time').text().trim() || $(timeEl).text().trim();
            const time = normalizeTime(timeText);
            if (!/^\d{2}:\d{2} [AP]M$/.test(time)) return;

            const tags = $(timeEl).find('img').map((_, img) => ($(img).attr('alt') || '').trim()).get();
            const isUrdu = tags.some(t => t.toUpperCase() === 'URDU');

            shows.push({
              cinema: 'Cinestar',
              location,
              city: 'Lahore',
              movie: isUrdu ? `${title} (Urdu Dubbed)` : title,
              format: tags.some(t => t.toUpperCase() === '3D') || /3D/i.test(timeText) ? '3D' : '2D',
              date: calendarDate(businessDate, time),
              time,
              screen: tags.find(t => /^screen\s*\d+/i.test(t)) || '',
              source: 'cinestar',
            });
          });
        });
      });
    } catch (err: any) {
      console.warn(`  CineStar: ${url} failed: ${err.message}`);
    }
  }
  return shows;
}
