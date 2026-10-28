import * as React from 'react';
import { useState, useEffect, useMemo, ReactNode, Component, ErrorInfo } from 'react';
import { format } from 'date-fns';
import { 
  Search, 
  RefreshCcw, 
  Trash2, 
  Database, 
  Activity, 
  ChevronRight, 
  Info, 
  Ticket,
  Film,
  Layers,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Wand2,
  Edit3,
  Loader2,
  Download,
  Copy,
  Cloud,
  CloudUpload,
  User,
  Play,
  Instagram,
  Star,
  Award,
  XCircle,
  Volume2,
  Tv,
  Utensils,
  CreditCard,
  Car,
  Smartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Show, MovieMetadata, ScrapeStatus } from './types';
import { processRawNetworkData } from './lib/dataProcessor';
import { unifyTitles, searchTitle, TitleAliases } from './lib/titles';
import { resolveCinemaMapping, normalizeShow, CANONICAL_CINEMAS } from './lib/cinemaMapping';
import { sheetGvizUrl, DATA_BASE_URL } from './config';
import titleAliases from '../config/title-aliases.json';

/**
 * Fetches one of the JSON files written by scripts/scrape.ts: first from GitHub
 * (always the latest), then from the copy bundled with the site. Returns null if
 * neither has usable data.
 */
async function loadDataFile<T>(name: string): Promise<T | null> {
  for (const url of [`${DATA_BASE_URL}/${name}`, `/data/${name}`]) {
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) continue;
      // GitHub serves these as text/plain, and a missing local file returns index.html, so parse defensively
      const data = JSON.parse(await res.text());
      if (Array.isArray(data) ? data.length === 0 : !data || Object.keys(data).length === 0) continue;
      return data as T;
    } catch {
      // try the next source
    }
  }
  return null;
}

/**
 * Robust JSON parsing with multi-row support and cleaning
 */
function safeJsonParse(text: string, defaultValue: any = {}): any {
  if (!text || typeof text !== 'string') return defaultValue;
  const clean = text.trim();
  if (!clean) return defaultValue;

  try {
    // 1. Try direct parse
    return JSON.parse(clean);
  } catch (e) {
    try {
      // 2. Find JSON structure { ... } or [ ... ]
      const sArr = clean.indexOf('[');
      const sObj = clean.indexOf('{');
      const startIdx = (sArr === -1) ? sObj : (sObj === -1) ? sArr : Math.min(sArr, sObj);
      
      const eArr = clean.lastIndexOf(']');
      const eObj = clean.lastIndexOf('}');
      const endIdx = Math.max(eArr, eObj);
      
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        const potential = clean.substring(startIdx, endIdx + 1);
        
        // Clean whitespace/control characters from Sheets
        const normalized = potential
          .replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, ' ')
          .replace(/\r?\n/g, ' ')
          .trim();
          
        return JSON.parse(normalized);
      }
    } catch (innerE) {
      // 3. Last resort: very aggressive fixing for common quote/key issues
      try {
        let fixed = clean
          .replace(/'/g, '"')
          .replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3');
        
        const sArr = fixed.indexOf('[');
        const sObj = fixed.indexOf('{');
        const sIdx = (sArr === -1) ? sObj : (sObj === -1) ? sArr : Math.min(sArr, sObj);
        const eIdx = Math.max(fixed.lastIndexOf(']'), fixed.lastIndexOf('}'));

        if (sIdx !== -1 && eIdx !== -1 && eIdx > sIdx) {
          return JSON.parse(fixed.substring(sIdx, eIdx + 1));
        }
      } catch (finalE) {}
    }
  }
  return defaultValue;
}

/**
 * Simple Error Boundary to prevent black screen on runtime errors
 */
class ErrorBoundary extends React.Component<any, any> {
  state = { hasError: false, error: null };

  constructor(props: { children: React.ReactNode }) {
    super(props);
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("App Crash:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-bg-main flex items-center justify-center p-8 text-center">
          <div className="max-w-md space-y-4">
            <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="text-accent" size={32} />
            </div>
            <h1 className="text-2xl font-display uppercase tracking-widest text-white">Application Error</h1>
            <p className="text-gray-400 text-sm leading-relaxed">
              Something went wrong while loading the movies. This usually happens if the spreadsheet data format changes.
            </p>
            <div className="p-4 bg-bg-secondary rounded-xl text-left overflow-auto max-h-40">
              <code className="text-[10px] text-accent/70 font-mono break-all">
                {this.state.error?.message}
              </code>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-accent text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-accent-hover transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

function MovieCard({ movie, idx, type, onTrailerSelect }: { movie: any, idx: number, type: 'playing' | 'comingsoon', onTrailerSelect: (id: string) => void, key?: any }) {
  const meta = movie.metadata;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: idx * 0.05 }}
      className="group relative flex flex-col gap-3"
    >
      <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-bg-secondary border border-border-subtle shadow-lg group-hover:border-accent transition-all">
        {meta?.posterUrl ? (
          <img 
            src={meta.posterUrl} 
            alt={movie.movieName}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center text-gray-600 bg-bg-tertiary">
            <Film size={32} className="mb-2 opacity-20" />
            <span className="text-[10px] font-bold uppercase opacity-40">No Poster Found</span>
          </div>
        )}
        
        {meta?.trailerId && (
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none sm:pointer-events-auto">
            <button 
              onClick={() => onTrailerSelect(meta.trailerId)}
              className="w-12 h-12 rounded-full bg-accent text-white flex items-center justify-center hover:scale-110 transition-transform shadow-xl"
            >
              <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-white border-b-[6px] border-b-transparent ml-1" />
            </button>
          </div>
        )}
      </div>
      
      <div className="space-y-1">
        <h4 className="text-[11px] font-bold uppercase tracking-tight leading-tight line-clamp-2 text-white">
          {meta?.title || movie.movieName}
        </h4>
        {type === 'comingsoon' && meta?.releaseDate && (
          <div className="text-[9px] font-bold text-accent uppercase tracking-widest bg-accent/10 py-1 rounded-md mt-1 text-center">
            {meta.releaseDate}
          </div>
        )}
        {meta?.trailerId && (
          <button 
            onClick={() => onTrailerSelect(meta.trailerId)}
            className="sm:hidden flex items-center gap-1.5 text-[9px] font-bold text-accent uppercase tracking-widest mt-1"
          >
            <Film size={10} />
            Watch Trailer
          </button>
        )}
      </div>
    </motion.div>
  );
}

export default function App() {
  const [shows, setShows] = useState<Show[]>(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('showtimepk_data');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map(normalizeShow);
          }
        }
      }
      return [];
    } catch (e) {
      console.error("Failed to parse local storage", e);
      return [];
    }
  });
  const [selectedCity, setSelectedCity] = useState<string>('All');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedCinema, setSelectedCinema] = useState<string>('All');
  const [selectedFormat, setSelectedFormat] = useState<string>('All');
  const [selectedMovie, setSelectedMovie] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'showtimes' | 'nowplaying' | 'prices' | 'comingsoon' | 'ratings'>('showtimes');
  const [isPricesEnabled, setIsPricesEnabled] = useState<boolean>(true);
  const [isRatingsEnabled, setIsRatingsEnabled] = useState<boolean>(true);
  const [cinemaRatingsHeaders, setCinemaRatingsHeaders] = useState<string[]>([
    'Cinema', 'Online tickets booking', 'Parking', 'Food Quality & Prices', 'Card payments', 'Audio Quality', 'Video Quality'
  ]);
  const [cinemaRatingsData, setCinemaRatingsData] = useState<any[]>([
    { Cinema: 'The Arena', 'Online tickets booking': '2/5 Stars', Parking: 'NA', 'Food Quality & Prices': '2/5 Stars', 'Card payments': 'Available', 'Audio Quality': '4/5 stars', 'Video Quality': '5 Stars' },
    { Cinema: 'Raiha Gold', 'Online tickets booking': '1/5 Stars', Parking: 'Available', 'Food Quality & Prices': '2/5 Stars', 'Card payments': 'Available', 'Audio Quality': '4/5 stars', 'Video Quality': '4/5 stars' },
    { Cinema: 'Cinepax', 'Online tickets booking': '3/5 Stars', Parking: 'Available', 'Food Quality & Prices': '2/5 Stars', 'Card payments': 'Available', 'Audio Quality': '3/5 stars', 'Video Quality': '3/5 stars' },
    { Cinema: 'Nueplex', 'Online tickets booking': 'NA', Parking: 'Available', 'Food Quality & Prices': '1/5 Stars', 'Card payments': 'NA', 'Audio Quality': '2/5 stars', 'Video Quality': '1/5 stars' }
  ]);

  useEffect(() => {
    if (activeTab === 'prices' && !isPricesEnabled) {
      setActiveTab('showtimes');
    }
    if (activeTab === 'ratings' && !isRatingsEnabled) {
      setActiveTab('showtimes');
    }
  }, [activeTab, isPricesEnabled, isRatingsEnabled]);
  const [mode, setMode] = useState<'live' | 'sync'>('live');
  
  const [loading, setLoading] = useState(false);
  const [isSyncOpen, setIsSyncOpen] = useState(false);
  const [syncCinema, setSyncCinema] = useState('Nueplex DHA');
  const [syncData, setSyncData] = useState('');
  const [visitorCount, setVisitorCount] = useState<number | null>(null);

  // Movie Metadata for "Now Playing"
  const [movieMetadata, setMovieMetadata] = useState<Record<string, MovieMetadata>>({});
  const [isNowPlayingLoading, setIsNowPlayingLoading] = useState(false);
  const [selectedTrailer, setSelectedTrailer] = useState<string | null>(null);

  // Sync Preview State
  const [pendingShows, setPendingShows] = useState<Show[]>(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('showtimepk_staging');
        return saved ? JSON.parse(saved) : [];
      }
      return [];
    } catch (e) {
      return [];
    }
  });
  const [isCleaning, setIsCleaning] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [scrapeStatus, setScrapeStatus] = useState<ScrapeStatus | null>(null);
  const [ticketPrices, setTicketPrices] = useState<any[]>([]);
  const [priceHeaders, setPriceHeaders] = useState<string[]>(['Cinema', 'Type', 'Price (PKR)']);
  const [priceNote, setPriceNote] = useState<string>('Note: Prices are subject to change by cinema management. 3D glasses charges may be separate (usually Rs. 150-250) and are often non-refundable. Check official cinema apps for most recent updates.');
  const [isComingSoonLoading, setIsComingSoonLoading] = useState(false);
  const [metadataCache, setMetadataCache] = useState<Record<string, MovieMetadata>>({});
  const [playingCache, setPlayingCache] = useState<Record<string, MovieMetadata>>({});

  // Initial load: JSON files from the scraper first, Google Sheet for prices/ratings and as a fallback
  useEffect(() => {
    // Check if user is admin
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('admin') === 'true') {
      setIsAdmin(true);
      // We still open it, but let's make sure it's initialized correctly
      setIsSyncOpen(true); 
    }

    const loadData = async () => {
      setLoading(true);
      setIsNowPlayingLoading(true);
      setIsComingSoonLoading(true);

      try {
        // 1. Data written by the scheduled scraper (scripts/scrape.ts)
        const [jsonShows, jsonNowPlaying, jsonComingSoon, jsonStatus] = await Promise.all([
          loadDataFile<Show[]>('shows.json'),
          loadDataFile<Record<string, MovieMetadata>>('now-playing.json'),
          loadDataFile<Record<string, MovieMetadata>>('coming-soon.json'),
          loadDataFile<ScrapeStatus>('status.json'),
        ]);
        if (jsonShows) setShows(jsonShows.map(normalizeShow));
        if (jsonNowPlaying) {
          setPlayingCache(jsonNowPlaying);
          setMovieMetadata(prev => ({ ...prev, ...jsonNowPlaying }));
        }
        if (jsonComingSoon) {
          setMetadataCache(jsonComingSoon);
          setMovieMetadata(prev => ({ ...jsonComingSoon, ...prev }));
        }
        if (jsonStatus) setScrapeStatus(jsonStatus);

        // 2. Google Sheet: prices & ratings always; shows/metadata only if the JSON files are missing
        const skipIfJson: Record<string, boolean> = {
          'Shows': Boolean(jsonShows),
          'Playing Cache': Boolean(jsonNowPlaying),
          'Metadata Cache': Boolean(jsonComingSoon),
        };

        const endpoints = [
          {
            name: 'Playing Cache',
            url: sheetGvizUrl('metadata_playing'),
            isMetadata: true,
            setter: (data: any) => { 
              if (data && typeof data === 'object' && !data.table) {
                const asRecord: Record<string, any> = {};
                if (Array.isArray(data)) {
                  data.forEach((item: any) => {
                    const title = item.movieName || item.title;
                    if (title) {
                      asRecord[String(title).toUpperCase()] = item.metadata || item;
                    }
                  });
                } else {
                  Object.keys(data).forEach(title => {
                    asRecord[String(title).toUpperCase()] = data[title];
                  });
                }
                if (Object.keys(asRecord).length > 0) {
                  setPlayingCache(asRecord);
                  setMovieMetadata(prev => {
                    const next = { ...prev };
                    Object.entries(asRecord).forEach(([k, v]) => { 
                      next[k] = { ...(next[k] || {}), ...(v || {}) }; 
                    });
                    return next;
                  });
                }
              }
            } 
          },
          { 
            name: 'Metadata Cache', 
            url: sheetGvizUrl('metadata_cache'), 
            isMetadata: true,
            setter: (data: any) => { 
              if (data && typeof data === 'object' && !data.table) {
                const asRecord: Record<string, any> = {};
                if (Array.isArray(data)) {
                  data.forEach((item: any) => {
                    const title = item.movieName || item.title;
                    if (title) {
                      asRecord[String(title).toUpperCase()] = item.metadata || item;
                    }
                  });
                } else {
                  Object.keys(data).forEach(title => {
                    asRecord[String(title).toUpperCase()] = data[title];
                  });
                }
                if (Object.keys(asRecord).length > 0) {
                  setMetadataCache(asRecord);
                  setMovieMetadata(prev => {
                    const next = { ...prev };
                    Object.entries(asRecord).forEach(([k, v]) => { 
                      next[k] = { ...(next[k] || {}), ...(v || {}) }; 
                    });
                    return next;
                  });
                }
              }
            } 
          },
          { 
            name: 'Prices', 
            url: sheetGvizUrl('prices'), 
            setter: (d: any) => {
              if (d?.table?.rows) {
                const rows = d.table.rows;
                const cols = d.table.cols;

                // Check Column K (index 10) for OFF toggle
                let pricesOff = false;
                for (let r = 0; r < rows.length; r++) {
                  const cellK = rows[r]?.c?.[10]?.v || rows[r]?.c?.[10]?.f;
                  if (cellK && String(cellK).trim().toUpperCase() === 'OFF') {
                    pricesOff = true;
                    break;
                  }
                }
                setIsPricesEnabled(!pricesOff);

                let h0 = cols?.[0]?.label || 'Cinema';
                let h1 = cols?.[1]?.label || 'Type';
                let h2 = cols?.[2]?.label || 'Price (PKR)';

                let startIdx = 0;
                const firstRowCol0 = String(rows[0]?.c?.[0]?.v || '').trim();
                if (firstRowCol0.toLowerCase() === 'cinema') {
                  h0 = rows[0]?.c?.[0]?.v || h0;
                  h1 = rows[0]?.c?.[1]?.v || h1;
                  h2 = rows[0]?.c?.[2]?.v || h2;
                  startIdx = 1;
                }

                setPriceHeaders([h0, h1, h2]);

                // Extract Note from Column D (index 3) row 0/1 or anywhere in Column D
                let foundNote = '';
                for (let r = 0; r < rows.length; r++) {
                  const cellD = rows[r]?.c?.[3]?.v || rows[r]?.c?.[3]?.f;
                  if (cellD && String(cellD).trim()) {
                    const textD = String(cellD).trim();
                    if (textD.toLowerCase() !== 'note') {
                      foundNote = textD;
                      break;
                    }
                  }
                }
                if (foundNote) {
                  setPriceNote(foundNote);
                }

                const sheetPrices = rows.slice(startIdx).map((row: any) => {
                  const cinema = row.c?.[0]?.v || row.c?.[0]?.f || '';
                  const typeVal = (row.c?.[1]?.v !== null && row.c?.[1]?.v !== undefined) ? String(row.c?.[1]?.v) : '';
                  const priceVal = row.c?.[2]?.f || row.c?.[2]?.v || row.c?.[1]?.f || row.c?.[1]?.v || '';
                  return {
                    cinema,
                    type: typeVal,
                    price: priceVal
                  };
                }).filter((p: any) => p.cinema && p.cinema.toLowerCase() !== 'cinema');

                if (sheetPrices.length > 0) setTicketPrices(sheetPrices);
              }
            }
          },
          { 
            name: 'Ratings', 
            url: sheetGvizUrl('rtings'), 
            setter: (d: any) => {
              if (d?.table?.rows && d.table.rows.length > 0) {
                const rows = d.table.rows;

                // Check Column K (index 10) for OFF toggle
                let ratingsOff = false;
                for (let r = 0; r < rows.length; r++) {
                  const cellK = rows[r]?.c?.[10]?.v || rows[r]?.c?.[10]?.f;
                  if (cellK && String(cellK).trim().toUpperCase() === 'OFF') {
                    ratingsOff = true;
                    break;
                  }
                }
                setIsRatingsEnabled(!ratingsOff);

                const headerRow = rows[0]?.c || [];
                const headers = headerRow.map((c: any) => String(c?.v || c?.f || '').trim()).filter((h: string) => h !== '');
                if (headers.length > 0) {
                  setCinemaRatingsHeaders(headers);
                }

                const ratingRows = rows.slice(1).map((row: any) => {
                  const cells = row?.c || [];
                  const obj: Record<string, string> = {};
                  headers.forEach((h: string, idx: number) => {
                    const val = cells[idx]?.v || cells[idx]?.f || '';
                    obj[h] = String(val).trim();
                  });
                  return obj;
                }).filter((r: any) => r['Cinema'] || r[headers[0]]);

                if (ratingRows.length > 0) {
                  setCinemaRatingsData(ratingRows);
                }
              }
            }
          },
          { 
            name: 'Shows', 
            url: sheetGvizUrl('Sheet1'), 
            setter: (d: any) => {
              if (d?.table?.rows) {
                const rows = d.table.rows;
                const startIndex = (rows[0]?.c?.[0]?.v === 'Cinema') ? 1 : 0;
                const sheetShows: Show[] = rows.slice(startIndex).map((row: any) => {
                  const rawCity = String(row.c?.[7]?.v || row.c?.[7]?.f || '').trim();
                  let city = rawCity;
                  if (rawCity) {
                    const lower = rawCity.toLowerCase();
                    if (lower.includes('lahore')) city = 'Lahore';
                    else if (lower.includes('rwp') || lower.includes('isb') || lower.includes('islamabad') || lower.includes('rawalpindi')) city = 'RWP/ISB';
                    else if (lower.includes('karachi')) city = 'Karachi';
                  }

                  const rawShow: Partial<Show> = {
                    cinema: row.c?.[0]?.v || '',
                    location: row.c?.[1]?.v || '',
                    movie: row.c?.[2]?.v || '',
                    format: row.c?.[3]?.v || '',
                    date: row.c?.[4]?.f || row.c?.[4]?.v || '',
                    time: row.c?.[5]?.f || row.c?.[5]?.v || '',
                    screen: row.c?.[6]?.v || '',
                    city: city || undefined
                  };

                  return normalizeShow(rawShow);
                }).filter((s: Show) => s.movie && s.time);
                if (sheetShows.length > 0) setShows(sheetShows);
              }
            }
          }
        ];

        // Fetch each endpoint with safety
        await Promise.all(endpoints.filter(ep => !skipIfJson[ep.name]).map(async (ep) => {
          try {
            console.log(`Fetching ${ep.name}...`);
            const res = await fetch(ep.url);
            if (!res.ok) throw new Error(`HTTP error ${res.status}`);
            
            const text = await res.text();
            const match = text.match(/setResponse\((.*)\);/);
            if (match && match[1]) {
              const json = JSON.parse(match[1]);
              
              if ((ep as any).isMetadata && json.table?.rows) {
                const fullStream = json.table.rows.map((r: any) => {
                  if (!r.c) return '';
                  return r.c.map((cell: any) => (cell && cell.v !== null) ? String(cell.v) : '').join('');
                }).join('\n');
                
                let parsed = null;
                if (fullStream.trim()) {
                  parsed = safeJsonParse(fullStream, null);
                }

                if (!parsed && json.table.rows) {
                   for (const r of json.table.rows) {
                     if (!r.c) continue;
                     for (const cell of r.c) {
                       if (cell && cell.v && typeof cell.v === 'string' && cell.v.includes('{')) {
                         const cellParsed = safeJsonParse(cell.v, null);
                         if (cellParsed && Object.keys(cellParsed).length > 0) {
                           parsed = cellParsed;
                           break;
                         }
                       }
                     }
                     if (parsed) break;
                   }
                }

                if (parsed && Object.keys(parsed).length > 0) {
                  ep.setter(parsed);
                } else {
                  console.log(`JSON parse fallback for ${ep.name}, trying table parse...`);
                  const tableRows = json.table.rows;
                  if (tableRows.length > 0) {
                    const headers = tableRows[0].c?.map((cell: any) => String(cell?.v || '').toLowerCase()) || [];
                    const titleIdx = headers.indexOf('movie');
                    const posterIdx = headers.indexOf('poster');
                    const trailerIdx = headers.indexOf('trailer');
                    const releaseIdx = headers.indexOf('release');

                    if (titleIdx !== -1) {
                      const record: Record<string, any> = {};
                      tableRows.slice(1).forEach((r: any) => {
                        const title = r.c?.[titleIdx]?.v;
                        if (title) {
                          record[String(title).toUpperCase()] = {
                            title: title,
                            posterUrl: r.c?.[posterIdx]?.v || '',
                            trailerId: r.c?.[trailerIdx]?.v || '',
                            releaseDate: r.c?.[releaseIdx]?.v || ''
                          };
                        }
                      });
                      if (Object.keys(record).length > 0) {
                        ep.setter(record);
                      }
                    }
                  }
                }
              } else {
                ep.setter(json);
              }
            }
          } catch (e) {
            console.warn(`Fetch ${ep.name} failed:`, e);
          } finally {
            if (ep.name === 'Playing Cache') setIsNowPlayingLoading(false);
            if (ep.name === 'Metadata Cache') setIsComingSoonLoading(false);
          }
        }));
      } catch (err) {
        console.error('Data loading error:', err);
      } finally {
        setLoading(false);
        setIsNowPlayingLoading(false);
        setIsComingSoonLoading(false);
      }
    };
    loadData();
  }, []);

  // Save to LocalStorage for offline/interim use (can throw in private browsing or when storage is full)
  useEffect(() => {
    try { localStorage.setItem('showtimepk_data', JSON.stringify(shows)); } catch { /* ignore */ }
  }, [shows]);

  useEffect(() => {
    try { localStorage.setItem('showtimepk_staging', JSON.stringify(pendingShows)); } catch { /* ignore */ }
  }, [pendingShows]);

  // Fetch visitor count
  useEffect(() => {
    const fetchVisitors = async () => {
      // 1. Try CounterAPI
      try {
        const cRes = await fetch('https://counterapi.com/api/v1/counter/up?name=showtimepk_visits');
        if (cRes.ok) {
          const cData = await cRes.json();
          if (cData && typeof cData.value === 'number') {
            setVisitorCount(cData.value);
            return;
          }
        }
      } catch (e) {
        // ignore
      }

      // 2. Robust LocalStorage Fallback Counter
      try {
        const stored = localStorage.getItem('showtimepk_visit_count');
        let count = stored ? parseInt(stored, 10) : 3840;
        if (isNaN(count)) count = 3840;
        if (!sessionStorage.getItem('showtimepk_visited_session')) {
          count += 1;
          sessionStorage.setItem('showtimepk_visited_session', 'true');
          localStorage.setItem('showtimepk_visit_count', String(count));
        }
        setVisitorCount(count);
      } catch (e) {
        setVisitorCount(3840);
      }
    };

    fetchVisitors();
  }, []);

  // Grouped and filtered data
  const availableDates = useMemo(() => {
    try {
      if (!shows || !Array.isArray(shows)) return [];
      const dates = Array.from(new Set(shows.map(s => s?.date).filter(Boolean))) as string[];
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      
      // Get start of yesterday (Requested: "prior 1 day prior date" / "1 day older date")
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 1); 
      startDate.setHours(0, 0, 0, 0);

      const parseDateStr = (pI: string) => {
        if (!pI) return null;
        let dObj = new Date(pI);
        if (isNaN(dObj.getTime())) {
          const parts = pI.split('-');
          if (parts.length === 3) {
            dObj = new Date(parseInt(parts[2]), monthNames.indexOf(parts[1]), parseInt(parts[0]));
          }
        }
        return dObj;
      };

      return dates
        .filter(dateStr => {
          const dObj = parseDateStr(dateStr);
          return dObj && dObj >= startDate;
        })
        .sort((a, b) => {
          const aObj = parseDateStr(a);
          const bObj = parseDateStr(b);
          return (aObj ? aObj.getTime() : 0) - (bObj ? bObj.getTime() : 0);
        });
    } catch (e) {
      console.error("availableDates calculation failed", e);
      return [];
    }
  }, [shows]);

  useEffect(() => {
    if (availableDates.length > 0 && !selectedDate) {
      setSelectedDate(availableDates[0]);
    }
  }, [availableDates]);

  const availableCities = useMemo(() => {
    if (!shows || !Array.isArray(shows)) return [];
    const uniqueCities = Array.from(new Set(shows.map(s => s?.city || 'Karachi').filter(Boolean))) as string[];
    const priority = ['Karachi', 'Lahore', 'RWP/ISB'];
    return uniqueCities.sort((a, b) => {
      const idxA = priority.indexOf(a);
      const idxB = priority.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [shows]);

  useEffect(() => {
    if (selectedCity !== 'All' && availableCities.length > 0 && !availableCities.includes(selectedCity)) {
      setSelectedCity('All');
    }
  }, [availableCities, selectedCity]);

  const handleCityChange = (cityName: string) => {
    setSelectedCity(cityName);
    setSelectedFormat('All');
    setSelectedCinema('All');
    setSelectedMovie('All');
  };

  const cityFilteredShows = useMemo(() => {
    if (!shows || !Array.isArray(shows)) return [];
    if (selectedCity === 'All') return shows;
    return shows.filter(s => (s?.city || 'Karachi') === selectedCity);
  }, [shows, selectedCity]);

  const availableCinemaOptions = useMemo(() => {
    if (!cityFilteredShows || cityFilteredShows.length === 0) return [];
    const mappings = cityFilteredShows.map(s => resolveCinemaMapping(s.cinema, s.location, s.city));
    const uniqueFilterNames = Array.from(new Set(mappings.map(m => m.filterName))) as string[];
    
    return uniqueFilterNames.sort((a, b) => {
      const idxA = CANONICAL_CINEMAS.findIndex(c => c.filterName === a);
      const idxB = CANONICAL_CINEMAS.findIndex(c => c.filterName === b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [cityFilteredShows]);

  useEffect(() => {
    if (selectedCinema !== 'All' && availableCinemaOptions.length > 0 && !availableCinemaOptions.includes(selectedCinema)) {
      setSelectedCinema('All');
    }
  }, [availableCinemaOptions, selectedCinema]);

  const formats = useMemo(() => ['All', ...Array.from(new Set(cityFilteredShows.map(s => s?.format).filter(Boolean)))], [cityFilteredShows]);

  useEffect(() => {
    if (selectedFormat !== 'All' && formats.length > 0 && !formats.includes(selectedFormat)) {
      setSelectedFormat('All');
    }
  }, [formats, selectedFormat]);

  const cleanMovieName = (name: string) => {
    if (!name) return '';
    return name.replace(/2D|3D/gi, '').replace(/Cinepax|Nueplex|The Arena|Raiha Gold|Raiha CineGold|Ocean Mall|Bahria Icon|Clifton|Askari|DHA|Royal Cinema|Gholam|Tower|Karachi|Cinema|Theater/gi, '').replace(/\s+/g, ' ').trim();
  };

  const movieTitles = useMemo(() => {
    const titles = Array.from(new Set(cityFilteredShows.map(s => cleanMovieName(s?.movie)).filter(Boolean))).sort();
    return ['All', ...titles];
  }, [cityFilteredShows]);

  useEffect(() => {
    if (selectedMovie !== 'All' && movieTitles.length > 0 && !movieTitles.includes(selectedMovie)) {
      setSelectedMovie('All');
    }
  }, [movieTitles, selectedMovie]);

  const filteredShows = useMemo(() => {
    if (!shows || !Array.isArray(shows)) return [];
    return shows.filter(s => {
      if (!s) return false;
      const mapping = resolveCinemaMapping(s.cinema, s.location, s.city);
      const cityMatch = selectedCity === 'All' || mapping.city === selectedCity;
      if (!cityMatch) return false;
      const dateMatch = !selectedDate || s.date === selectedDate;
      const cinemaMatch = selectedCinema === 'All' || 
                          mapping.filterName === selectedCinema || 
                          mapping.line1 === selectedCinema || 
                          mapping.line2 === selectedCinema ||
                          s.cinema === selectedCinema || 
                          s.location === selectedCinema;
      const formatMatch = selectedFormat === 'All' || s.format === selectedFormat;
      const movieFilterMatch = selectedMovie === 'All' || 
                               cleanMovieName(s.movie) === selectedMovie || 
                               (s.movie && s.movie.trim().toLowerCase() === selectedMovie.trim().toLowerCase());
      const searchMatch = !searchQuery || 
                          (s.movie && s.movie.toLowerCase().includes(searchQuery.toLowerCase())) || 
                          (mapping.line1.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (mapping.line2.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (mapping.filterName.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (mapping.city.toLowerCase().includes(searchQuery.toLowerCase()));
      return dateMatch && cinemaMatch && formatMatch && movieFilterMatch && searchMatch;
    });
  }, [shows, selectedCity, selectedDate, selectedCinema, selectedFormat, selectedMovie, searchQuery]);

  const groupedByMovie = useMemo(() => {
    const groups: Record<string, Record<string, Show[]>> = {};
    filteredShows.forEach(show => {
      const mapping = resolveCinemaMapping(show.cinema, show.location, show.city);
      const branchKey = mapping.id;
      if (!groups[show.movie]) groups[show.movie] = {};
      if (!groups[show.movie][branchKey]) groups[show.movie][branchKey] = [];
      groups[show.movie][branchKey].push(show);
    });
    return groups;
  }, [filteredShows]);

  const handlePreviewSync = async () => {
    if (!syncData) return;
    setIsCleaning(true);
    try {
      console.log("Starting sync for " + syncCinema + "...");
      const today = format(new Date(), 'dd-MMM-yyyy');
      
      // 1. Initial Parse (Regex/HTML/JSON)
      let parsed: Show[] = [];
      try {
        parsed = processRawNetworkData(syncData, syncCinema, selectedDate || today);
      } catch (parseErr) {
        console.error('Data processing failed:', parseErr);
        alert("Failed to read the data format. Make sure you've copied the right content.");
        return;
      }
      
      console.log("Parsed " + parsed.length + " shows.");
      
      if (parsed.length === 0) {
        alert("We couldn't find any movie shows in that text. Please make sure you've copied the right content from the network log or showtime page.");
        return;
      }

      // 2. Title clean-up (same rules the scraper uses), merged with titles already on the site
      const titleMap = unifyTitles(
        [...parsed.map(s => s.movie), ...shows.map(s => s.movie)],
        titleAliases as TitleAliases
      );
      
      // 3. Map Titles & Update State
      const cleanedValues = parsed.map(s => ({
        ...s,
        movie: (titleMap && titleMap[s.movie]) || s.movie
      }));
      
      setPendingShows(prev => {
        const currentPending = Array.isArray(prev) ? prev : [];
        const newKeys = new Set(cleanedValues.map(s => {
          const m = resolveCinemaMapping(s.cinema, s.location, s.city);
          return `${s.date}_${m.id}`;
        }));
        const filteredPrev = currentPending.filter(s => {
          const m = resolveCinemaMapping(s.cinema, s.location, s.city);
          return !newKeys.has(`${s.date}_${m.id}`);
        });
        return [...filteredPrev, ...cleanedValues];
      });
      setSyncData(''); // Clear after successful staging
    } catch (err) {
      console.error('Final sync stage failure:', err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      alert("A system error occurred: " + msg + ". Please try smaller chunks of data.");
    } finally {
      setIsCleaning(false);
    }
  };

  const downloadCSV = () => {
    if (shows.length === 0) {
      alert("No data available to export. Fetch or sync some shows first!");
      return;
    }
    
    const displayHeaders = ['Cinema', 'Location', 'Movie', 'Format', 'Date', 'Time', 'Screen', 'City Name'];
    
    const csvContent = [
      displayHeaders.join(','),
      ...shows.map(show => {
        const mapping = resolveCinemaMapping(show.cinema, show.location, show.city);
        const row = [
          mapping.sheetColA,
          mapping.sheetColB,
          show.movie,
          show.format || '2D',
          show.date,
          show.time,
          show.screen || '',
          mapping.city
        ];
        return row.map(val => "\"" + (val || '').toString().replace(/"/g, '""') + "\"").join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', "showtimes_combined_" + format(new Date(), 'yyyy-MM-dd') + ".csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Derive lists strictly from the metadata sheets as per user request
  const nowPlayingMoviesComputed = useMemo(() => {
    try {
      const pC = playingCache || {};
      const mC = metadataCache || {};
      const mM = movieMetadata || {};

      // 1. Start with titles explicitly in the playingCache (metadata_playing sheet)
      const explicitTitles = Object.keys(pC);
      
      // 2. Fallback: If no explicit titles, show movies that have active showtimes
      const activeShows = shows || [];
      const showTitles = explicitTitles.length === 0 
        ? Array.from(new Set(activeShows.map(s => s?.movie && searchTitle(s.movie)).filter((n): n is string => Boolean(n))))
        : [];
      
      // EXCLUDE any titles that are strictly marked as "Coming Soon" in the other cache if they aren't in shows
      const comingSoonKeys = new Set(Object.keys(mC).map(k => String(k).toUpperCase()));
      
      const allTitles = Array.from(new Set([...explicitTitles, ...showTitles]))
        .filter(t => {
          const sT = String(t);
          return explicitTitles.includes(sT) || !comingSoonKeys.has(sT.toUpperCase());
        });
      
      return allTitles.map(title => {
        const sTitle = String(title);
        const upperTitle = sTitle.toUpperCase();
        const pMeta = (pC as any)[upperTitle] || (pC as any)[sTitle] || {};
        const gMeta = (mM as any)[upperTitle] || (mM as any)[sTitle] || {};
        const meta = { ...gMeta, ...pMeta };
        
        const displayName = meta.title || sTitle;
        
        return {
          movieName: displayName,
          rawTitle: sTitle,
          metadata: meta
        };
      }).filter(m => m && m.movieName);
    } catch (e) {
      console.error("nowPlayingMoviesComputed failed", e);
      return [];
    }
  }, [playingCache, metadataCache, shows, movieMetadata]);

  const comingSoonMoviesComputed = useMemo(() => {
    try {
      const mC = metadataCache || {};
      const mM = movieMetadata || {};
      const keys = Object.keys(mC);
      return keys.map(title => {
        const sTitle = String(title);
        const upperTitle = sTitle.toUpperCase();
        const cMeta = (mC as any)[upperTitle] || (mC as any)[sTitle] || {};
        const gMeta = (mM as any)[upperTitle] || (mM as any)[sTitle] || {};
        const meta = { ...gMeta, ...cMeta };
        
        const displayName = meta.title || sTitle;
        
        return {
          movieName: displayName,
          rawTitle: sTitle,
          metadata: meta
        };
      }).filter(m => m && m.movieName);
    } catch (e) {
      console.error("comingSoonMoviesComputed failed", e);
      return [];
    }
  }, [metadataCache, movieMetadata]);
  const copyDataForGoogleSheet = (dataToCopy: Show[], label = "data") => {
    if (!dataToCopy || dataToCopy.length === 0) {
      alert("No " + label + " to copy!");
      return;
    }
    const header = "Cinema\tLocation\tMovie\tFormat\tDate\tTime\tScreen\tCity Name";
    const rows = dataToCopy.map(s => {
      const mapping = resolveCinemaMapping(s.cinema, s.location, s.city);
      return (
        (mapping.sheetColA || s.cinema || "") + "\t" + 
        (mapping.sheetColB || s.location || "") + "\t" + 
        (s.movie || "") + "\t" + 
        (s.format || "2D") + "\t" + 
        (s.date || "") + "\t" + 
        (s.time || "") + "\t" + 
        (s.screen || "") + "\t" + 
        mapping.city
      );
    }).join("\n");
    
    navigator.clipboard.writeText(header + "\n" + rows);
    alert(`Copied ${dataToCopy.length} rows (including Column H City Name)!\n\nPaste this directly into cell A1 of your Google Sheet (Sheet1).`);
  };

  const copyForGoogleSheet = () => {
    copyDataForGoogleSheet(shows, "shows");
  };

  const copyStagingForGoogleSheet = () => {
    copyDataForGoogleSheet(pendingShows, "staging shows");
  };

  const handleCommitSync = () => {
    setShows(prev => {
      const newDates = new Set(pendingShows.map(s => s.date));
      const newCinemas = new Set(pendingShows.map(s => s.cinema));
      const filteredPrev = prev.filter(s => !(newDates.has(s.date) && newCinemas.has(s.cinema)));
      return [...filteredPrev, ...pendingShows];
    });

    setPendingShows([]);
    setSyncData('');
    setIsSyncOpen(false);
  };

  const updatePendingTitle = (oldTitle: string, newTitle: string) => {
    setPendingShows(prev => prev.map(s => s.movie === oldTitle ? { ...s, movie: newTitle } : s));
  };

  const formatDateWeekday = (dateStr: string) => {
    if (!dateStr) return '---';
    const parts = dateStr.split('-');
    if (parts.length < 3) return '---';
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = parseInt(parts[0]);
    const month = monthNames.indexOf(parts[1]);
    const year = parseInt(parts[2]);
    if (month === -1) return '---';
    const dt = new Date(year, month, day);
    if (isNaN(dt.getTime())) return '---';
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[dt.getDay()];
  };

  const formatDateDayMonth = (dateStr: string) => {
    if (!dateStr) return '---';
    const parts = dateStr.split('-');
    if (parts.length < 3) return '---';
    return parts[1] + ' ' + parts[0];
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen selection:bg-accent selection:text-white">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-bg-main border-b border-border-subtle h-16 flex items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-3xl tracking-wider uppercase">
            Showtime<span className="text-accent">PK</span>
          </h1>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-xs text-gray-500 font-medium bg-bg-secondary px-3 py-1.5 rounded-full border border-border-subtle">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
            <span>{visitorCount ? visitorCount.toLocaleString() : '...'} VISITORS</span>
          </div>
          
          {isAdmin && (
            <button 
              onClick={() => setIsSyncOpen(true)}
              className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg text-xs font-bold transition-all"
            >
              <RefreshCcw size={14} />
              <span className="hidden sm:inline">SYNC LIVE DATA</span>
            </button>
          )}
        </div>
      </header>

      {/* SUB-BAR: MODE & LEGEND (Only show legend to users, hide dashboard banner unless admin) */}
      <div className="bg-bg-secondary border-b border-border-subtle py-3 px-6 flex flex-wrap items-center justify-between gap-4">
        {isAdmin ? (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-green-500 animate-pulse" />
              <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Live Showtimes Dashboard</span>
            </div>
            <span className="bg-green-500/10 text-green-500 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter">
              ONLINE
            </span>
          </div>
        ) : <div /> }

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-[10px] text-gray-500">
            <div className="w-2 h-2 rounded-full bg-nueplex"></div>
            <span>NUEPLEX</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-gray-500">
            <div className="w-2 h-2 rounded-full bg-arena"></div>
            <span>THE ARENA</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-gray-500">
            <div className="w-2 h-2 rounded-full bg-cinepax"></div>
            <span>CINEPAX</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-gray-500">
            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
            <span>RAIHA GOLD</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-gray-500">
            <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
            <span>CINESTAR</span>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="bg-bg-secondary border-b border-border-subtle flex px-6">
        <button 
          onClick={() => setActiveTab('showtimes')}
          className={"px-6 py-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all " + (activeTab === 'showtimes' ? 'border-accent text-accent' : 'border-transparent text-gray-500 hover:text-gray-300')}
        >
          🎬 Showtimes
        </button>
        <button 
          onClick={() => setActiveTab('nowplaying')}
          className={"px-6 py-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all " + (activeTab === 'nowplaying' ? 'border-accent text-accent' : 'border-transparent text-gray-500 hover:text-gray-300')}
        >
          📽️ Now Playing
        </button>
        <button 
          onClick={() => setActiveTab('comingsoon')}
          className={"px-6 py-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all " + (activeTab === 'comingsoon' ? 'border-accent text-accent' : 'border-transparent text-gray-500 hover:text-gray-300')}
        >
          🔜 Coming Soon
        </button>
        {isPricesEnabled && (
          <button 
            onClick={() => setActiveTab('prices')}
            className={"px-6 py-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all " + (activeTab === 'prices' ? 'border-accent text-accent' : 'border-transparent text-gray-500 hover:text-gray-300')}
          >
            🎟️ Ticket Prices
          </button>
        )}
        {isRatingsEnabled && (
          <button 
            onClick={() => setActiveTab('ratings')}
            className={"px-6 py-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all flex items-center gap-1.5 " + (activeTab === 'ratings' ? 'border-accent text-accent' : 'border-transparent text-gray-500 hover:text-gray-300')}
          >
            <Star size={14} className={activeTab === 'ratings' ? 'text-accent fill-accent/20' : ''} />
            <span>Cinema Ratings</span>
          </button>
        )}
      </div>

      {activeTab === 'showtimes' ? (
        <>
          {/* DYNAMIC CITY SELECTOR BAR */}
          {availableCities.length > 0 && (
            <section className="bg-bg-secondary/70 border-b border-border-subtle/80 py-2.5 px-6 flex items-center justify-between gap-4 overflow-x-auto hide-scrollbar">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider flex items-center gap-1.5 mr-1">
                  <MapPin size={12} className="text-accent" />
                  City:
                </span>
                <div className="flex items-center gap-1.5 p-1 bg-bg-tertiary border border-border-subtle rounded-xl">
                  <button
                    onClick={() => handleCityChange('All')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                      selectedCity === 'All'
                        ? 'bg-accent text-white shadow-md shadow-accent/20'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    All Cities ({shows.length})
                  </button>
                  {availableCities.map((cityName) => {
                    const count = shows.filter(s => (s.city || 'Karachi') === cityName).length;
                    return (
                      <button
                        key={cityName}
                        onClick={() => handleCityChange(cityName)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                          selectedCity === cityName
                            ? 'bg-accent text-white shadow-md shadow-accent/20'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <span>{cityName}</span>
                        <span className="text-[8px] px-1 py-0.5 rounded bg-black/40 font-semibold text-gray-300">
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {selectedCity !== 'All' && (
                <span className="text-[9px] font-bold uppercase tracking-widest text-accent bg-accent/10 px-2.5 py-1 rounded-md border border-accent/20">
                  Showing {selectedCity} Only
                </span>
              )}
            </section>
          )}

          {/* DATE BAR */}
          <section className="bg-bg-secondary border-b border-border-subtle py-4 px-6 overflow-x-auto hide-scrollbar">
            <div className="flex gap-2">
              {availableDates.map(date => {
                const weekday = formatDateWeekday(date);
                const dayMonth = formatDateDayMonth(date);
                
                return (
                  <button
                    key={date}
                    onClick={() => setSelectedDate(date)}
                    className={
                      "flex-shrink-0 px-6 py-3 rounded-xl border text-center transition-all " + 
                      (selectedDate === date 
                      ? "bg-accent border-accent text-white shadow-lg shadow-accent/20" 
                      : "bg-bg-tertiary border-border-subtle text-gray-400 hover:border-gray-500")
                    }
                  >
                    <div className="text-[10px] uppercase font-bold opacity-70 mb-0.5">{weekday}</div>
                    <div className="text-sm font-bold">{dayMonth}</div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* FILTERS */}
          <section className="p-6 grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4 items-end">
            <div className="md:col-span-2 relative">
              <label className="text-[10px] uppercase font-bold text-gray-500 mb-2 block">Search Movie</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={14} />
                <input 
                  type="text"
                  placeholder="Universal, Gladiator II, Joker..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-bg-tertiary border border-border-subtle rounded-xl py-3 pl-10 pr-4 text-xs focus:outline-none focus:border-accent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-gray-500 mb-2 block">Format</label>
              <select 
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value)}
                className="w-full bg-bg-tertiary border border-border-subtle rounded-xl py-3 px-4 text-xs focus:outline-none focus:border-accent appearance-none"
              >
                {formats.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-gray-500 mb-2 block">Cinema</label>
              <select 
                value={selectedCinema}
                onChange={(e) => setSelectedCinema(e.target.value)}
                className="w-full bg-bg-tertiary border border-border-subtle rounded-xl py-3 px-4 text-xs focus:outline-none focus:border-accent appearance-none"
              >
                <option value="All">All Cinemas</option>
                {availableCinemaOptions.map(fName => (
                  <option key={fName} value={fName}>{fName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-gray-500 mb-2 block">Movie</label>
              <select 
                value={selectedMovie}
                onChange={(e) => setSelectedMovie(e.target.value)}
                className="w-full bg-bg-tertiary border border-border-subtle rounded-xl py-3 px-4 text-xs focus:outline-none focus:border-accent appearance-none"
              >
                {movieTitles.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2 pb-1 text-xs text-gray-500 font-bold ml-auto">
              <span>{filteredShows.length} SHOWS FOUND</span>
            </div>
          </section>

          {/* MAIN LIST */}
          <main className="px-6 pb-20 max-w-6xl mx-auto">
            {loading ? (
              <div className="py-20 flex flex-col items-center gap-4 text-gray-500">
                <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs font-bold uppercase tracking-widest">Updating Dashboard...</p>
              </div>
            ) : Object.keys(groupedByMovie).length > 0 ? (
              <div className="flex flex-col gap-6">
                <AnimatePresence mode="popLayout">
                  {Object.entries(groupedByMovie).map(([movie, cinemas], idx) => (
                    <motion.div
                      key={movie}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="bg-bg-secondary border border-border-subtle rounded-3xl overflow-hidden hover:border-gray-800 transition-all shadow-sm"
                    >
                      {/* Movie Header */}
                      <div className="p-6 border-b border-border-subtle flex flex-col sm:flex-row items-start justify-between gap-4">
                        <div>
                          <h3 className="font-display text-2xl tracking-wide uppercase leading-tight mb-2">
                            {cleanMovieName(movie)}
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {Array.from(new Set(Object.values(cinemas).flat().map(s => s.format)))
                              .filter(f => f.toUpperCase() === '2D' || f.toUpperCase() === '3D')
                              .map(f => (
                                <span key={f} className="px-3 py-1 bg-white/5 rounded-md text-[9px] font-bold text-gray-400 uppercase tracking-widest">{f}</span>
                              ))}
                          </div>
                        </div>
                      </div>

                      {/* Cinema Rows */}
                      <div className="divide-y divide-border-subtle">
                        {Object.entries(cinemas).map(([branchKey, cinemaShows]) => {
                          const firstShow = cinemaShows[0];
                          const mapping = resolveCinemaMapping(firstShow?.cinema, firstShow?.location, firstShow?.city);
                          
                          const color = mapping.brand === 'nueplex' ? 'bg-nueplex' : 
                                        mapping.brand === 'arena' ? 'bg-arena' : 
                                        mapping.brand === 'cinepax' ? 'bg-cinepax' : 
                                        mapping.brand === 'raiha' ? 'bg-amber-500' :
                                        mapping.brand === 'cinestar' ? 'bg-emerald-400' : 'bg-gray-500';

                          return (
                            <div key={branchKey} className="p-6 flex flex-col md:flex-row gap-6 md:items-center">
                              <div className="md:w-64 flex-shrink-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <div className={"w-1.5 h-1.5 rounded-full " + color}></div>
                                  <span className="text-xs font-bold uppercase tracking-wide">
                                    {mapping.line1}
                                  </span>
                                </div>
                                <div className="text-[10px] text-gray-400 font-medium pl-3.5">
                                  {mapping.line2}
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-2 flex-grow">
                                {cinemaShows.map((show, i) => {
                                  const isAM = show.time.toUpperCase().includes('AM');
                                  const hasScreen = Boolean(show.screen && show.screen.trim() !== '');
                                  return (
                                    <button 
                                      key={i}
                                      type="button"
                                      title={hasScreen ? show.screen : undefined}
                                      onClick={() => {
                                        if (hasScreen) {
                                          alert(show.screen);
                                        }
                                      }}
                                      className={"px-4 py-2 rounded-xl border text-sm font-bold transition-all " + (hasScreen ? 'cursor-help' : 'cursor-default') + " flex flex-col items-center justify-center gap-0.5 min-w-[70px] appearance-none " + (
                                        isAM 
                                        ? 'bg-gold/10 border-gold/20 text-gold shadow-sm shadow-gold/5 hover:bg-accent hover:text-white hover:border-accent' 
                                        : 'bg-bg-quaternary border-border-subtle text-white hover:bg-accent hover:border-accent hover:text-white'
                                      )}
                                    >
                                      <div className="flex items-center gap-1.5">
                                        {show.time.replace(/2D/gi, '').trim()}
                                        {show.format.toUpperCase().includes('3D') && (
                                          <span className={"text-[10px] uppercase tracking-tighter opacity-80 font-black " + (isAM ? 'text-gold' : 'text-accent')}>
                                            3D
                                          </span>
                                        )}
                                      </div>
                                      {hasScreen && (
                                        <span className="text-[7px] opacity-40 uppercase tracking-[0.1em] font-medium leading-none">
                                          {show.screen?.replace(/Cinema|Lounge/gi, '').trim()}
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="py-20 flex flex-col items-center justify-center text-gray-600 border-2 border-dashed border-border-subtle rounded-3xl">
                <Film size={48} className="mb-4 opacity-10" />
                <p className="text-sm font-bold uppercase tracking-widest">No matching showtimes found</p>
              </div>
            )}
          </main>
        </>
      ) : activeTab === 'nowplaying' ? (
        <main className="p-6 max-w-7xl mx-auto">
          {isNowPlayingLoading ? (
            <div className="py-20 flex flex-col items-center gap-4 text-gray-500">
              <Loader2 className="animate-spin text-accent" size={40} />
              <p className="text-sm font-bold uppercase tracking-widest animate-pulse">Loading...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {nowPlayingMoviesComputed.map((movie, idx) => (
                <MovieCard 
                  key={movie.movieName} 
                  movie={movie} 
                  idx={idx} 
                  type="playing" 
                  onTrailerSelect={setSelectedTrailer} 
                />
              ))}
              {nowPlayingMoviesComputed.length === 0 && (
                <div className="col-span-full py-20 text-center text-gray-500 font-mono text-sm">
                  <Film className="w-8 h-8 mx-auto mb-4 opacity-20" />
                  NO MOVIES FOUND
                </div>
              )}
            </div>
          )}
        </main>
      ) : activeTab === 'comingsoon' ? (
        <main className="p-6 max-w-7xl mx-auto">
          {isComingSoonLoading ? (
            <div className="py-20 flex flex-col items-center gap-4 text-gray-500">
              <Loader2 className="animate-spin text-accent" size={40} />
              <p className="text-sm font-bold uppercase tracking-widest animate-pulse">Loading Coming Soon...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {comingSoonMoviesComputed.map((movie, idx) => (
                <MovieCard 
                  key={movie.movieName} 
                  movie={movie} 
                  idx={idx} 
                  type="comingsoon" 
                  onTrailerSelect={setSelectedTrailer} 
                />
              ))}
              {comingSoonMoviesComputed.length === 0 && (
                <div className="col-span-full py-20 text-center text-gray-500 font-mono text-sm">
                  <Film className="w-8 h-8 mx-auto mb-4 opacity-20" />
                  NO MOVIES FOUND
                </div>
              )}
            </div>
          )}
        </main>
      ) : activeTab === 'prices' ? (
        <main className="p-6 max-w-4xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-bg-secondary border border-border-subtle rounded-3xl overflow-hidden shadow-xl"
          >
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-bg-tertiary">
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">{priceHeaders[0] || 'Cinema'}</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">{priceHeaders[1] || 'Type'}</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-right">{priceHeaders[2] || 'Price (PKR)'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {(ticketPrices && ticketPrices.length > 0) ? ticketPrices.map((item, idx) => {
                  const cinemaName = item?.cinema || item?.name || (Array.isArray(item) ? item[0] : '') || 'Unknown Cinema';
                  const typeVal = item?.type !== undefined && item?.type !== null ? item.type : (item?.Type || (Array.isArray(item) ? item[1] : ''));
                  const priceVal = item?.price || item?.Price || item?.Rate || (Array.isArray(item) ? item[2] : '') || 'N/A';
                  return (
                    <tr key={idx} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <Ticket size={14} className="text-accent" />
                          <span className="text-sm font-bold">{cinemaName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-xs text-gray-400 font-medium">
                        {typeVal}
                      </td>
                      <td className="px-6 py-5 text-sm font-bold text-accent text-right">
                        {priceVal}
                      </td>
                    </tr>
                  );
                }) : [
                  { cinema: 'Nueplex DHA & Askari IV Standard', type: '', price: '1200' },
                  { cinema: 'Nueplex DHA Royal', type: '', price: '1500' },
                  { cinema: 'Cinepax Gold', type: '', price: '1000' },
                  { cinema: 'Cinepax Platinum', type: '', price: '1500' },
                  { cinema: 'The Arena', type: '', price: '1000' },
                  { cinema: 'Raiha Red Lounge', type: '', price: '1000' },
                  { cinema: 'Raiha Gold Lounge', type: '', price: '1400' },
                  { cinema: 'Raiha Platinum Lounge', type: '', price: '1600' },
                  { cinema: 'Raiha Gold VIP Box 7 seater', type: '', price: '12000' },
                  { cinema: 'Raiha Platinum VIP Box 7 seater', type: '', price: '15000' },
                ].map((item, idx) => (
                  <tr key={idx} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <Ticket size={14} className="text-accent" />
                        <span className="text-sm font-bold">{item.cinema}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-xs text-gray-400 font-medium">{item.type}</td>
                    <td className="px-6 py-5 text-sm font-bold text-accent text-right">{item.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
          {priceNote && (
            <div className="mt-8 p-6 bg-accent/10 border border-accent/20 rounded-2xl flex items-start gap-4">
              <Info className="text-accent flex-shrink-0" size={20} />
              <p className="text-xs leading-relaxed text-gray-400">
                {priceNote.toLowerCase().startsWith('note:') ? (
                  <>
                    <span className="text-white font-bold uppercase">Note:</span>
                    {priceNote.slice(5)}
                  </>
                ) : (
                  priceNote
                )}
              </p>
            </div>
          )}
        </main>
      ) : activeTab === 'ratings' ? (
        <main className="max-w-7xl mx-auto px-6 py-8">
          {/* HEADER & SEARCH BAR */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-bold uppercase tracking-wider text-white">
                Cinema Facilities comparision and Ratings
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Ratings and insights based on Google reviews, social media feedback, and user experiences across cinemas.
              </p>
            </div>

            <div className="relative min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
              <input
                type="text"
                placeholder="Search cinema or facility..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-bg-tertiary border border-border-subtle rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-accent transition-all"
              />
            </div>
          </div>

          {/* HIGHLIGHT STATS CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-bg-secondary border border-border-subtle p-5 rounded-2xl flex items-center gap-4 hover:border-accent/40 transition-all">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 flex-shrink-0">
                <Tv size={20} />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Top Video Quality</span>
                <h3 className="text-sm font-bold text-white mt-0.5">The Arena (5/5 ★)</h3>
              </div>
            </div>

            <div className="bg-bg-secondary border border-border-subtle p-5 rounded-2xl flex items-center gap-4 hover:border-accent/40 transition-all">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 flex-shrink-0">
                <Volume2 size={20} />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Top Audio Quality</span>
                <h3 className="text-sm font-bold text-white mt-0.5">The Arena & Raiha (4/5 ★)</h3>
              </div>
            </div>

            <div className="bg-bg-secondary border border-border-subtle p-5 rounded-2xl flex items-center gap-4 hover:border-accent/40 transition-all">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
                <CreditCard size={20} />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Card Payments</span>
                <h3 className="text-sm font-bold text-emerald-400 mt-0.5">3 of 4 Cinemas</h3>
                <span className="text-[10px] text-gray-400">Arena, Raiha, Cinepax</span>
              </div>
            </div>
          </div>

          {/* DYNAMIC RATINGS TABLE */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-bg-secondary border border-border-subtle rounded-2xl overflow-hidden shadow-2xl"
          >
            <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between bg-bg-tertiary/50">
              <div className="flex items-center gap-2">
                <Star size={16} className="text-amber-400 fill-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
                  Facility Ratings Comparison Matrix
                </span>
              </div>
              <span className="text-[10px] text-gray-500 font-mono">
                {cinemaRatingsData.length} Cinemas Listed
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-bg-tertiary border-b border-border-subtle">
                    {cinemaRatingsHeaders.map((header, idx) => (
                      <th key={idx} className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                        <div className="flex items-center gap-2">
                          {(() => {
                            const h = header.toLowerCase();
                            if (h.includes('cinema')) return <Film size={14} className="text-accent" />;
                            if (h.includes('ticket') || h.includes('online') || h.includes('booking')) return <Smartphone size={14} className="text-blue-400" />;
                            if (h.includes('parking')) return <Car size={14} className="text-purple-400" />;
                            if (h.includes('food')) return <Utensils size={14} className="text-amber-400" />;
                            if (h.includes('card') || h.includes('payment')) return <CreditCard size={14} className="text-emerald-400" />;
                            if (h.includes('audio')) return <Volume2 size={14} className="text-cyan-400" />;
                            if (h.includes('video')) return <Tv size={14} className="text-rose-400" />;
                            return <Award size={14} className="text-accent" />;
                          })()}
                          <span>{header}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {cinemaRatingsData
                    .filter(row => {
                      if (!searchQuery) return true;
                      const q = searchQuery.toLowerCase();
                      return Object.values(row).some(v => String(v).toLowerCase().includes(q));
                    })
                    .map((row, rowIdx) => {
                      const cinemaName = row['Cinema'] || row[cinemaRatingsHeaders[0]] || 'Cinema';
                      const lowerName = String(cinemaName).toLowerCase();
                      const dotColor = lowerName.includes('arena') ? 'bg-cyan-400' : lowerName.includes('raiha') ? 'bg-amber-400' : lowerName.includes('cinepax') ? 'bg-blue-400' : lowerName.includes('nueplex') ? 'bg-red-400' : lowerName.includes('cinestar') ? 'bg-emerald-400' : 'bg-accent';

                      return (
                        <tr key={rowIdx} className="hover:bg-white/5 transition-colors">
                          {cinemaRatingsHeaders.map((header, colIdx) => {
                            const val = row[header] || '';
                            const isCinemaCol = colIdx === 0 || header.toLowerCase() === 'cinema';

                            if (isCinemaCol) {
                              return (
                                <td key={colIdx} className="px-6 py-5">
                                  <div className="flex items-center gap-2.5">
                                    <div className={`w-2 h-2 rounded-full ${dotColor}`} />
                                    <span className="text-sm font-bold text-white">{cinemaName}</span>
                                  </div>
                                </td>
                              );
                            }

                            const str = String(val).trim();
                            const lower = str.toLowerCase();
                            const starMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:\/\s*5)?\s*stars?/i) || str.match(/(\d+(?:\.\d+)?)\s*\/\s*5/i);

                            return (
                              <td key={colIdx} className="px-6 py-5">
                                {!str ? (
                                  <span className="text-gray-600 font-mono text-xs">-</span>
                                ) : starMatch ? (
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-0.5">
                                      {[1, 2, 3, 4, 5].map(starIndex => (
                                        <Star
                                          key={starIndex}
                                          size={12}
                                          className={starIndex <= Math.round(parseFloat(starMatch[1])) 
                                            ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_3px_rgba(251,191,36,0.6)]" 
                                            : "text-gray-700"
                                          }
                                        />
                                      ))}
                                    </div>
                                    <span className="text-xs font-bold text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                      {parseFloat(starMatch[1])}/5
                                    </span>
                                  </div>
                                ) : (lower === 'available' || lower === 'yes') ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                                    <CheckCircle2 size={12} />
                                    Available
                                  </span>
                                ) : (lower === 'na' || lower === 'n/a' || lower === 'not available' || lower === 'no') ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400/80 text-xs font-medium">
                                    <XCircle size={12} />
                                    N/A
                                  </span>
                                ) : (
                                  <span className="text-xs font-medium text-gray-300">{str}</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  }
                </tbody>
              </table>
            </div>
          </motion.div>
        </main>
      ) : null}

      {/* FOOTER */}
      <footer className="py-12 px-6 border-t border-border-subtle text-center flex flex-col items-center justify-center gap-4">
        <div className="font-display text-2xl tracking-wider uppercase">
          Showtime<span className="text-accent">PK</span>
        </div>
        <a 
          href="https://www.instagram.com/show.timepk?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-amber-500/20 border border-pink-500/30 text-pink-400 hover:text-white hover:border-pink-500 text-xs font-bold transition-all shadow-lg hover:shadow-pink-500/10 group"
        >
          <Instagram size={16} className="text-pink-500 group-hover:scale-110 transition-transform" />
          <span>@show.timepk</span>
        </a>
        <p className="text-[10px] text-gray-600 font-medium tracking-widest uppercase">© 2026 K-TOWN CINEMA HUB. ALL RIGHTS RESERVED.</p>
      </footer>

      {/* SYNC MODAL */}
      <AnimatePresence>
        {isSyncOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSyncOpen(false)}
              className="fixed inset-0 bg-black/90 backdrop-blur-lg z-[100]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-bg-main border-l border-border-subtle z-[101] flex flex-col p-8"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-accent rounded-2xl shadow-lg shadow-accent/20">
                    <Database className="text-white" size={24} />
                  </div>
                  <div>
                    <h2 className="font-display text-2xl tracking-wide uppercase">Workspace Console</h2>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Manual Data Normalization</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsSyncOpen(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-bg-secondary hover:bg-bg-tertiary transition-all"
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              <div className="space-y-8 flex-grow overflow-y-auto pr-2 custom-scrollbar">
                {/* AUTOMATIC UPDATES STATUS */}
                <div className="bg-blue-600/10 border border-blue-500/30 rounded-3xl p-6 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <CloudUpload size={18} className="text-blue-400" />
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-400">Automatic Updates</h3>
                  </div>
                  {scrapeStatus ? (
                    <>
                      <p className="text-[10px] text-gray-400 leading-relaxed">
                        Last run: <span className="text-white font-bold">{new Date(scrapeStatus.updatedAt).toLocaleString()}</span> · {scrapeStatus.totalShows} shows
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(scrapeStatus.sources).map(([name, src]) => (
                          <div key={name} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[9px] font-bold uppercase" title={src.error || ''}>
                            <span className="text-gray-300 truncate">{name.replace('fallback:', '↺ ')}</span>
                            <span className={src.from === 'live' ? 'text-green-400' : src.from === 'none' ? 'text-red-400' : 'text-amber-400'}>
                              {src.from === 'none' ? 'failed' : `${src.count} ${src.from === 'live' ? '' : src.from}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-[10px] text-gray-500">No scraper data found yet (public/data/status.json).</p>
                  )}
                  <p className="text-[9px] text-gray-500 leading-relaxed italic">
                    Showtimes, posters and trailers update by themselves every 12 hours (GitHub Actions). To update now: GitHub → Actions → "Update showtimes" → Run workflow.
                    If a cinema fails, paste its data below, copy it into Sheet1, and the next run will use it for that cinema.
                  </p>
                  <button
                    onClick={copyForGoogleSheet}
                    className="w-full flex items-center justify-center gap-2 p-3 bg-white/5 border border-white/10 rounded-2xl hover:border-green-500 hover:bg-green-500/10 transition-all group"
                  >
                    <Layers size={16} className="text-gray-400 group-hover:text-green-400" />
                    <span className="text-[9px] font-bold uppercase text-gray-400 group-hover:text-white">Copy All Shows for Sheet1</span>
                  </button>
                </div>

                {/* 1. MANUAL DATA INPUT (fallback when a cinema can't be fetched automatically) */}
                <div className="space-y-6 bg-bg-secondary p-6 rounded-3xl border border-border-subtle shadow-inner">
                  <div className="pb-4 border-b border-white/5">
                    <span className="text-[11px] uppercase tracking-widest font-bold text-gray-200 block">Manual Data Ingestion</span>
                    <span className="text-[10px] text-gray-500 block">Paste raw HTML/JSON copied from a cinema website (DevTools → Network)</span>
                  </div>
                  {/* Manual Pasting Target Cinema Selection */}
                  <div className="pt-2 border-t border-white/5 space-y-4">
                    <div>
                      <label className="text-[9px] uppercase tracking-widest font-bold text-gray-400 block mb-2 ml-0.5">
                        Manual Text Sync (Select Cinema)
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {['Nueplex DHA', 'Nueplex Askari IV', 'The Arena Karachi', 'The Arena LHR', 'The Arena ISB'].map(cin => (
                          <button 
                            key={cin}
                            onClick={() => setSyncCinema(cin)}
                            className={"py-2.5 px-2 rounded-xl border text-[9px] font-bold uppercase tracking-wider transition-all text-center " + (
                              syncCinema === cin ? 'bg-accent border-accent text-white shadow-lg' : 'bg-bg-tertiary border-border-subtle text-gray-500 hover:text-white hover:border-gray-700'
                            )}
                          >
                            {cin}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="relative">
                      <textarea 
                        value={syncData}
                        onChange={(e) => setSyncData(e.target.value)}
                        placeholder={"Paste raw " + syncCinema + " data here..."}
                        className="w-full h-32 bg-bg-tertiary border border-border-subtle rounded-2xl p-4 text-[11px] font-mono focus:outline-none focus:border-accent transition-all resize-none mb-3"
                      />
                      <button 
                        onClick={handlePreviewSync}
                        disabled={!syncData || isCleaning}
                        className="w-full py-3 bg-white text-black rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-accent hover:text-white transition-all disabled:opacity-30 disabled:pointer-events-none uppercase tracking-widest text-[10px]"
                      >
                        {isCleaning ? <Loader2 className="animate-spin" size={14} /> : <Layers size={14} />}
                        {isCleaning ? 'Processing...' : "Add " + syncCinema + " to Staging"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. STAGING & REVIEW AREA */}
                {pendingShows.length > 0 && (
                  <div className="space-y-6 pt-4">
                    <div className="flex items-center justify-between border-b border-border-subtle pb-4">
                      <div className="flex flex-col">
                        <label className="text-[10px] uppercase tracking-widest font-bold text-accent flex items-center gap-2">
                          <CheckCircle2 size={12} />
                          Staging Area (All Sources)
                        </label>
                        <span className="text-[9px] text-gray-500 font-bold uppercase mt-1">
                          {Array.from(new Set(pendingShows.map(s => s.cinema))).length} Sources • {pendingShows.length} Total Shows • {Array.from(new Set(pendingShows.map(s => s.city || 'Karachi'))).join(', ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={copyStagingForGoogleSheet}
                          className="text-[10px] font-bold text-accent uppercase tracking-widest hover:underline flex items-center gap-1 bg-accent/10 px-3 py-1.5 rounded-lg border border-accent/20 hover:bg-accent hover:text-white transition-all"
                        >
                          <Copy size={11} />
                          Copy Staging (Col H)
                        </button>
                        <button 
                          onClick={() => setPendingShows([])}
                          className="text-[10px] font-bold text-red-500 uppercase tracking-widest hover:underline flex items-center gap-1"
                        >
                          <Trash2 size={10} />
                          Clear Staging
                        </button>
                      </div>
                    </div>

                    <div className="bg-bg-tertiary border border-border-subtle rounded-2xl overflow-hidden shadow-xl">
                      <div className="p-3 border-b border-border-subtle bg-bg-quaternary flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Movie Dictionary (A-Z)</span>
                        <div className="flex items-center gap-1 text-[9px] text-gray-500 font-bold uppercase">
                          <Wand2 size={10} className="text-accent" />
                          Auto-cleaned
                        </div>
                      </div>
                      <div className="max-h-[400px] overflow-y-auto custom-scrollbar divide-y divide-border-subtle/50">
                        {(Array.from(new Set(pendingShows.map(s => s.movie))) as string[]).sort().map((title, idx) => {
                          const showsForMovie = pendingShows.filter(s => s.movie === title);
                          
                          return (
                            <div key={idx} className="p-4 flex items-center justify-between group hover:bg-white/5 transition-all">
                              <div className="flex flex-col gap-1.5 flex-grow">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-white uppercase tracking-tight">{title}</span>
                                  <span className="text-[8px] bg-accent/20 text-accent px-1.5 py-0.5 rounded font-black tracking-tighter">
                                    {showsForMovie.length}x
                                  </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {Array.from(new Set(showsForMovie.map(s => {
                                    const mapping = resolveCinemaMapping(s.cinema, s.location, s.city);
                                    const isNue = mapping.brand === 'nueplex';
                                    const isStar = mapping.brand === 'cinestar';
                                    const hasScr = (isNue || isStar) && s.screen && s.screen.trim() !== '';
                                    return hasScr ? `${mapping.filterName}|${s.screen}|${mapping.brand}` : `${mapping.filterName}||${mapping.brand}`;
                                  }))).sort().map((groupKey: string, gIdx) => {
                                    const [filterName, scr, brand] = groupKey.split('|');
                                    const isNue = brand === 'nueplex';
                                    const isArena = brand === 'arena';
                                    const isPax = brand === 'cinepax';
                                    const isRaiha = brand === 'raiha';
                                    const isStar = brand === 'cinestar';
                                    const color = isNue ? 'bg-nueplex/20 text-nueplex' : isArena ? 'bg-arena/20 text-arena' : isPax ? 'bg-cinepax/20 text-cinepax' : isRaiha ? 'bg-amber-500/20 text-amber-400' : isStar ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400';
                                    
                                    return (
                                      <button 
                                        key={gIdx} 
                                        type="button" 
                                        title={scr || undefined} 
                                        onClick={() => {
                                          if ((isNue || isStar) && scr) {
                                            alert(scr);
                                          }
                                        }}
                                        className={"px-2.5 py-0.5 rounded text-[8px] font-bold uppercase flex items-center gap-1.5 appearance-none " + ((isNue || isStar) && scr ? 'cursor-help' : 'cursor-default') + " " + color}
                                      >
                                        <span>{filterName}</span>
                                        {scr && (
                                          <>
                                            <span className="opacity-50">•</span>
                                            <span className="text-white/70">{scr.replace('Cinema', '').trim()}</span>
                                          </>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                              </div>
                              <button 
                                onClick={() => {
                                  const newTitle = prompt('Rename this movie to merge with others:', title);
                                  if (newTitle) updatePendingTitle(title, newTitle.trim());
                                }}
                                className="p-2.5 bg-bg-quaternary border border-border-subtle rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-accent hover:border-accent text-white shadow-xl"
                              >
                                <Edit3 size={12} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="p-4 bg-accent/5 border border-accent/20 rounded-2xl flex items-start gap-3">
                      <Info className="text-accent flex-shrink-0 mt-0.5" size={14} />
                      <p className="text-[10px] text-gray-500 leading-relaxed font-medium">
                        <span className="text-white font-bold uppercase mr-1">Merging Logic:</span> 
                        Fetch all cinemas one by one. If movie names look different (e.g. "AAG" vs "Aag"), 
                        rename them to be identical and they will automatically merge under one listing.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-8 border-t border-border-subtle mt-4">
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <button 
                      onClick={downloadCSV}
                      disabled={shows.length === 0}
                      className="py-3 bg-blue-500/5 border border-blue-500/10 text-blue-400 rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-30"
                    >
                      <Download size={10} />
                      Export CSV
                    </button>
                    <button 
                      onClick={() => {
                        if(confirm('Wipe dashboard data? (Manual staging will be preserved)')) {
                          setShows([]);
                          localStorage.removeItem('showtimepk_data');
                        }
                      }}
                      className="py-3 bg-red-500/5 border border-red-500/10 text-red-500/50 rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white active:scale-95 transition-all"
                    >
                      Wipe Dashboard
                    </button>
                  </div>

                  <button 
                    onClick={handleCommitSync}
                    disabled={pendingShows.length === 0}
                    className="w-full mt-4 py-5 bg-green-600 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-green-500 active:scale-[0.98] transition-all uppercase tracking-widest text-xs shadow-xl shadow-green-900/20 disabled:opacity-30 disabled:pointer-events-none"
                  >
                    <CheckCircle2 size={18} />
                    Finalize & Merge into Database
                  </button>
                </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* TRAILER MODAL */}
      <AnimatePresence>
        {selectedTrailer && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTrailer(null)}
              className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-0 flex items-center justify-center z-[201] p-4 pointer-events-none"
            >
              <div className="w-full max-w-4xl aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl relative pointer-events-auto">
                <button 
                  onClick={() => setSelectedTrailer(null)}
                  className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-all z-10 text-white"
                >
                  <RefreshCcw size={18} className="rotate-45" />
                </button>
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://www.youtube.com/embed/${selectedTrailer}?autoplay=1`}
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                ></iframe>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}
