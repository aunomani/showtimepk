export interface Show {
  cinema: string;
  location: string;
  movie: string;
  format: string;
  date: string;
  time: string;
  screen?: string;
  source?: string;
  city?: string;
}

/** Poster/trailer info, fetched from TMDB by scripts/scrape.ts. */
export interface MovieMetadata {
  title: string;
  posterUrl: string;
  trailerUrl: string;
  trailerId: string;
  description?: string;
  releaseDate?: string;
}

/** public/data/status.json, written by every scraper run. */
export interface ScrapeStatus {
  updatedAt: string;
  totalShows: number;
  sources: Record<string, { count: number; from: 'live' | 'sheet' | 'previous' | 'none'; error?: string }>;
}
