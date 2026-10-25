import type { MovieMetadata } from '../../src/types';
import { searchTitle, titleKey } from '../../src/lib/titles';

/**
 * TMDB lookups run only inside the scraper (GitHub Actions), so the token
 * never reaches the website. Set TMDB_ACCESS_TOKEN (preferred, the long
 * "API Read Access Token") or TMDB_API_KEY as a GitHub Actions secret.
 */
const TOKEN = process.env.TMDB_ACCESS_TOKEN?.trim();
const API_KEY = process.env.TMDB_API_KEY?.trim();

export const tmdbEnabled = Boolean(TOKEN || API_KEY);

export interface CacheEntry {
  fetchedAt: string;
  meta: MovieMetadata | null; // null = searched but not found
}
export type TmdbCache = Record<string, CacheEntry>;

const MISS_RETRY_DAYS = 2;   // retry titles we couldn't find
const HIT_REFRESH_DAYS = 30; // refresh posters/trailers occasionally

async function tmdb(path: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL(`https://api.themoviedb.org/3/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (!TOKEN && API_KEY) url.searchParams.set('api_key', API_KEY);
  const res = await fetch(url, {
    headers: { accept: 'application/json', ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) },
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 401) throw new Error('TMDB rejected the token (401). Check the TMDB secret.');
  if (!res.ok) throw new Error(`TMDB HTTP ${res.status}`);
  return res.json();
}

function pickBest(results: any[], query: string): any | null {
  const withPoster = results.filter(r => r.poster_path);
  const pool = withPoster.length ? withPoster : results;
  const q = titleKey(query);
  const exact = pool.filter(r => titleKey(r.title || '') === q || titleKey(r.original_title || '') === q);
  const candidates = exact.length ? exact : pool;
  // Cinemas show new releases, so prefer the most recent match (e.g. 2026's "Street Fighter", not 1994's)
  const latest = new Date();
  latest.setFullYear(latest.getFullYear() + 1);
  const sorted = [...candidates]
    .filter(r => !r.release_date || new Date(r.release_date) <= latest)
    .sort((a, b) => String(b.release_date || '').localeCompare(String(a.release_date || '')));
  return (exact.length ? sorted[0] : candidates[0]) || null;
}

async function lookup(title: string, imdbId?: string): Promise<MovieMetadata | null> {
  let movie: any = null;

  if (imdbId && /^tt\d+$/i.test(imdbId)) {
    const found = await tmdb(`find/${imdbId}`, { external_source: 'imdb_id' });
    movie = found.movie_results?.[0] || null;
  }

  if (!movie) {
    const query = searchTitle(title);
    let data = await tmdb('search/movie', { query, include_adult: 'false', language: 'en-US', page: '1' });
    movie = pickBest(data.results || [], query);
    if (!movie && /\s\d{4}$/.test(query)) {
      const noYear = query.replace(/\s+\d{4}$/, '');
      data = await tmdb('search/movie', { query: noYear, include_adult: 'false', language: 'en-US', page: '1' });
      movie = pickBest(data.results || [], noYear);
    }
  }
  if (!movie) return null;

  const videos = (await tmdb(`movie/${movie.id}/videos`, { language: 'en-US' })).results || [];
  const trailer =
    videos.find((v: any) => v.type === 'Trailer' && v.site === 'YouTube') ||
    videos.find((v: any) => v.type === 'Teaser' && v.site === 'YouTube') ||
    videos.find((v: any) => v.site === 'YouTube');

  return {
    title: movie.title || title,
    posterUrl: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '',
    trailerUrl: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : '',
    trailerId: trailer ? trailer.key : '',
    description: movie.overview || '',
    releaseDate: movie.release_date || '',
  };
}

function isFresh(entry: CacheEntry | undefined): boolean {
  if (!entry) return false;
  const ageDays = (Date.now() - new Date(entry.fetchedAt).getTime()) / 86400000;
  return ageDays < (entry.meta ? HIT_REFRESH_DAYS : MISS_RETRY_DAYS);
}

/**
 * Returns metadata for each title, using/refreshing the on-disk cache.
 * `imdbIds` lets the "coming soon" tab pin an exact movie.
 */
export async function getMetadata(
  titles: string[],
  cache: TmdbCache,
  imdbIds: Record<string, string> = {},
): Promise<Record<string, MovieMetadata | null>> {
  const out: Record<string, MovieMetadata | null> = {};
  for (const title of titles) {
    const imdbId = imdbIds[title];
    const key = imdbId ? imdbId.toLowerCase() : titleKey(searchTitle(title));
    if (!isFresh(cache[key]) && tmdbEnabled) {
      try {
        cache[key] = { fetchedAt: new Date().toISOString(), meta: await lookup(title, imdbId) };
        await new Promise(r => setTimeout(r, 250)); // stay well under TMDB's rate limit
      } catch (err: any) {
        console.warn(`  TMDB lookup failed for "${title}": ${err.message}`);
        if (/401/.test(err.message)) break;
      }
    }
    out[title] = cache[key]?.meta ?? null;
  }
  return out;
}
