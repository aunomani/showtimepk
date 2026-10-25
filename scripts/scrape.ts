/**
 * Fetches showtimes from every cinema, cleans them up, adds posters/trailers
 * from TMDB and writes the JSON files the website reads:
 *
 *   public/data/shows.json        all upcoming showtimes
 *   public/data/now-playing.json  poster/trailer info for movies with showtimes
 *   public/data/coming-soon.json  poster/trailer info for the "coming soon" sheet tab
 *   public/data/status.json       when this last ran and what each cinema returned
 *   data/tmdb-cache.json          TMDB results, so we don't look movies up every run
 *
 * Run locally with `npm run scrape`; GitHub Actions runs it every 12 hours.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { MovieMetadata, ScrapeStatus, Show } from '../src/types';
import { normalizeShow, resolveCinemaMapping } from '../src/lib/cinemaMapping';
import { parseDisplayDate } from '../src/lib/normalize';
import { searchTitle, TitleAliases, unifyTitles } from '../src/lib/titles';
import { pktToday } from './lib/dates';
import { readSheetTab } from './lib/sheet';
import { getMetadata, tmdbEnabled, TmdbCache } from './lib/tmdb';
import { scrapeArena } from './scrapers/arena';
import { scrapeCinepax } from './scrapers/cinepax';
import { scrapeCineStar } from './scrapers/cinestar';
import { scrapeNueplex } from './scrapers/nueplex';
import { scrapeRaiha } from './scrapers/raiha';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'data');
const CACHE_FILE = path.join(ROOT, 'data', 'tmdb-cache.json');
const ALIASES_FILE = path.join(ROOT, 'config', 'title-aliases.json');

const SCRAPERS: Record<string, () => Promise<Show[]>> = {
  cinepax: scrapeCinepax,
  cinestar: scrapeCineStar,
  raiha: scrapeRaiha,
  arena: scrapeArena,
  nueplex: scrapeNueplex,
};

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, data: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function isUpcoming(show: Show, today: Date): boolean {
  const d = parseDisplayDate(show.date);
  return d !== null && d >= today;
}

function dedupe(shows: Show[]): Show[] {
  const seen = new Set<string>();
  return shows.filter(s => {
    const key = [s.cinema, s.location, s.movie, s.format, s.date, s.time, s.screen].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Sheet1 rows in the same column order the admin dashboard exports. */
function sheetRowsToShows(rows: string[][]): Show[] {
  if (!rows.length || !/cinema/i.test(rows[0][0] || '')) return [];
  return rows
    .slice(1)
    .map(r => normalizeShow({
      cinema: r[0], location: r[1], movie: r[2], format: r[3],
      date: r[4], time: r[5], screen: r[6], city: r[7] || undefined, source: 'sheet',
    }))
    .filter(s => s.movie && s.time && s.date);
}

async function main() {
  const startedAt = Date.now();
  const todayInfo = pktToday();
  const today = parseDisplayDate(todayInfo.display)!;
  console.log(`ShowtimePK scrape — Pakistan date ${todayInfo.display}`);

  const aliases = await readJson<TitleAliases>(ALIASES_FILE, {});
  const previous = await readJson<Show[]>(path.join(OUT_DIR, 'shows.json'), []);
  const status: ScrapeStatus = { updatedAt: new Date().toISOString(), totalShows: 0, sources: {} };

  // 1. Run every scraper; one failing doesn't stop the others.
  const scraped: Show[] = [];
  await Promise.all(
    Object.entries(SCRAPERS).map(async ([name, scrape]) => {
      const t0 = Date.now();
      try {
        const shows = (await scrape()).map(normalizeShow).filter(s => isUpcoming(s, today));
        scraped.push(...shows);
        status.sources[name] = { count: shows.length, from: shows.length ? 'live' : 'none' };
        console.log(`✓ ${name}: ${shows.length} shows (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
      } catch (err: any) {
        status.sources[name] = { count: 0, from: 'none', error: String(err?.message || err) };
        console.error(`✗ ${name}: ${err?.message || err}`);
      }
    }),
  );

  // 2. Any branch that came back empty: use Sheet1 (manual fallback), else keep the last good data.
  const liveBranches = new Set(scraped.map(s => resolveCinemaMapping(s.cinema, s.location, s.city).id));
  const sheetShows = sheetRowsToShows(await readSheetTab('Sheet1')).filter(s => isUpcoming(s, today));
  const fallbackShows: Show[] = [];
  const branchIds = new Set([...sheetShows, ...previous].map(s => resolveCinemaMapping(s.cinema, s.location, s.city).id));

  for (const id of branchIds) {
    if (liveBranches.has(id)) continue;
    const fromSheet = sheetShows.filter(s => resolveCinemaMapping(s.cinema, s.location, s.city).id === id);
    const fromPrevious = previous
      .map(normalizeShow)
      .filter(s => isUpcoming(s, today) && resolveCinemaMapping(s.cinema, s.location, s.city).id === id);
    const picked = fromSheet.length ? fromSheet : fromPrevious;
    if (!picked.length) continue;
    fallbackShows.push(...picked);
    status.sources[`fallback:${id}`] = { count: picked.length, from: fromSheet.length ? 'sheet' : 'previous' };
    console.log(`↺ ${id}: no live data, using ${picked.length} shows from ${fromSheet.length ? 'Sheet1' : 'the previous run'}`);
  }

  // 3. Merge spellings ("CLAYFACE", "Clayface- 2D English" -> "Clayface") and apply config/title-aliases.json.
  let shows = dedupe([...scraped, ...fallbackShows]);
  const titleMap = unifyTitles(shows.map(s => s.movie), aliases);
  shows = dedupe(shows.map(s => ({ ...s, movie: titleMap[s.movie] || s.movie })));
  shows.sort((a, b) =>
    (parseDisplayDate(a.date)!.getTime() - parseDisplayDate(b.date)!.getTime()) ||
    a.cinema.localeCompare(b.cinema) || a.location.localeCompare(b.location) || a.movie.localeCompare(b.movie));
  status.totalShows = shows.length;

  if (shows.length === 0) {
    // Never wipe the live site because every source failed at once.
    console.error('No shows from any source — leaving existing data untouched.');
    process.exitCode = 1;
    return;
  }

  // 4. Posters & trailers.
  const cache = await readJson<TmdbCache>(CACHE_FILE, {});
  if (!tmdbEnabled) console.warn('TMDB_ACCESS_TOKEN not set — using cached posters only.');

  // Now Playing shows one card per film: "Clayface" and "Clayface (Urdu Dubbed)" become one "Clayface" card.
  const nowTitles = [...new Set(shows.map(s => searchTitle(s.movie)))].sort();
  const nowMeta = await getMetadata(nowTitles, cache);
  const nowPlaying: Record<string, MovieMetadata> = {};
  for (const t of nowTitles) {
    nowPlaying[t.toUpperCase()] = nowMeta[t] ? { ...nowMeta[t]!, title: t } : { title: t, posterUrl: '', trailerUrl: '', trailerId: '' };
  }

  // "coming soon" tab: column A = movie name, B = IMDb ID (optional), C = release date text (optional)
  const comingRows = await readSheetTab('coming soon');
  const comingSoon: Record<string, MovieMetadata> = {};
  if (comingRows.length > 1 && !/cinema/i.test(comingRows[0][0] || '')) {
    const entries = comingRows.slice(1).filter(r => r[0]).map(r => ({ name: r[0], imdbId: r[1] || '', release: r[2] || '' }));
    const ids = Object.fromEntries(entries.filter(e => e.imdbId).map(e => [e.name, e.imdbId]));
    const meta = await getMetadata(entries.map(e => e.name), cache, ids);
    for (const e of entries) {
      const m = meta[e.name];
      comingSoon[e.name.toUpperCase()] = {
        title: m?.title || e.name,
        posterUrl: m?.posterUrl || '',
        trailerUrl: m?.trailerUrl || '',
        trailerId: m?.trailerId || '',
        description: m?.description || '',
        releaseDate: e.release || m?.releaseDate || '',
      };
    }
  }

  // 5. Write everything.
  await writeJson(path.join(OUT_DIR, 'shows.json'), shows);
  await writeJson(path.join(OUT_DIR, 'now-playing.json'), nowPlaying);
  await writeJson(path.join(OUT_DIR, 'coming-soon.json'), comingSoon);
  await writeJson(path.join(OUT_DIR, 'status.json'), status);
  await writeJson(CACHE_FILE, cache);

  const missingPosters = nowTitles.filter(t => !nowPlaying[t.toUpperCase()].posterUrl);
  console.log(`\nWrote ${shows.length} shows, ${nowTitles.length} movies, ${Object.keys(comingSoon).length} coming soon in ${((Date.now() - startedAt) / 1000).toFixed(0)}s.`);
  if (missingPosters.length) console.log(`No poster found for: ${missingPosters.join(', ')} (add an alias in config/title-aliases.json if the name is wrong)`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
