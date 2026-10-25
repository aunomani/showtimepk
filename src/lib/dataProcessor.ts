import { Show } from '../types';
import { normalizeShow, resolveCinemaMapping } from './cinemaMapping';
import { calendarDate, isAfterMidnight } from './normalize';

/**
 * Parses the raw CSV string into Show objects.
 */
export function parseCSV(csv: string): Show[] {
  const lines = csv.split('\n').filter(line => line.trim() !== '');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const show: any = {};
    headers.forEach((header, index) => {
      show[header] = values[index];
    });
    
    return normalizeShow(show);
  });
}

/**
 * Normalizes a date string to DD-MMM-YYYY.
 * Handles month rollovers correctly.
 */
function getShiftedDate(baseDateStr: string, shiftDays: number = 0): string {
  // Expected format: DD-MMM-YYYY (e.g., 16-Apr-2026)
  const parts = baseDateStr.split('-');
  if (parts.length !== 3) return baseDateStr;

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = parseInt(parts[0]);
  const monthIdx = monthNames.indexOf(parts[1]);
  const year = parseInt(parts[2]);

  if (monthIdx === -1) return baseDateStr;

  const dateObj = new Date(year, monthIdx, day);
  dateObj.setDate(dateObj.getDate() + shiftDays);

  const newDay = dateObj.getDate().toString().padStart(2, '0');
  const newMonth = monthNames[dateObj.getMonth()];
  const newYear = dateObj.getFullYear();

  return `${newDay}-${newMonth}-${newYear}`;
}

/**
 * Parses a date separator like "20 Aug", "20th Aug", "20-Aug", "Aug 20", "20 August 2026"
 */
function parseSeparatorDate(text: string): string | null {
  const cleaned = text.replace(/----/g, ' ').replace(/-/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const monthRegex = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
  
  const pattern1 = new RegExp(`^(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthRegex})(?:\\s+(\\d{4}))?$`, "i");
  const pattern2 = new RegExp(`^(${monthRegex})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+(\\d{4}))?$`, "i");
  const pattern3 = new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthRegex})(?:\\s+(\\d{4}))?`, "i");
  
  const match = cleaned.match(pattern1) || cleaned.match(pattern2) || cleaned.match(pattern3);
  if (match) {
    let day, monthStr, year;
    if (isNaN(parseInt(match[1]))) {
      monthStr = match[1];
      day = match[2].padStart(2, '0');
      year = match[3] || new Date().getFullYear().toString();
    } else {
      day = match[1].padStart(2, '0');
      monthStr = match[2];
      year = match[3] || new Date().getFullYear().toString();
    }
    const m3 = monthStr.substring(0, 3);
    const month = m3.charAt(0).toUpperCase() + m3.slice(1).toLowerCase();
    return `${day}-${month}-${year}`;
  }
  return null;
}

/**
 * Robust Processor for text with custom separators.
 */
export function processRawNetworkData(raw: string, defaultCinema: string, defaultDate: string): Show[] {
  const allShows: Show[] = [];
  
  // Split into lines to scan for separators
  const lines = raw.split('\n');
  let currentCinema = defaultCinema;
  let currentBaseDate = defaultDate;
  let currentChunk = "";

  const flushChunk = () => {
    const content = currentChunk.trim();
    if (!content) return;

    const currentMapping = resolveCinemaMapping(currentCinema);

    // More robust JSON detection: look for the first { and last }
    const startIdx = content.indexOf('{');
    const endIdx = content.lastIndexOf('}');
    
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      const jsonStrCandidate = content.substring(startIdx, endIdx + 1);
      
      try {
        const json = JSON.parse(jsonStrCandidate);
        // Arena structure usually has the HTML in the 'message' field
        const htmlContent = json.message || json.html || json.data;
        
        if (htmlContent && typeof htmlContent === 'string') {
          // Some structures have double-escaped HTML
          const cleanHtml = htmlContent
            .replace(/\\"/g, '"')
            .replace(/\\\//g, '/')
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r');

          const parsed = parseArenaHTML(cleanHtml, currentBaseDate, currentCinema);
          if (parsed.length > 0) {
            allShows.push(...parsed.map(s => normalizeShow({
              ...s,
              cinema: currentMapping.sheetColA,
              location: currentMapping.sheetColB,
              city: currentMapping.city
            })));
            currentChunk = "";
            return;
          }
        }
      } catch (e) {
        // Not a perfect JSON, fallback to regex for message if it looks like one
        const messageMatch = content.match(/"message"\s*:\s*"((?:\\"|[^"])*)"/s);
        if (messageMatch) {
          try {
             const rawHtml = messageMatch[1]
              .replace(/\\"/g, '"')
              .replace(/\\\//g, '/')
              .replace(/\\n/g, '\n');
            
            const parsed = parseArenaHTML(rawHtml, currentBaseDate, currentCinema);
            if (parsed.length > 0) {
              allShows.push(...parsed.map(s => normalizeShow({
                ...s,
                cinema: currentMapping.sheetColA,
                location: currentMapping.sheetColB,
                city: currentMapping.city
              })));
              currentChunk = "";
              return;
            }
          } catch (innerE) {}
        }
      }
    }

    if (content.includes('<')) {
      const parsed = currentCinema.toLowerCase().includes('arena') 
        ? parseArenaHTML(content, currentBaseDate, currentCinema)
        : parseNueplexHTML(content, currentBaseDate);

      allShows.push(...parsed.map(s => normalizeShow({
        ...s,
        cinema: currentMapping.sheetColA,
        location: currentMapping.sheetColB,
        city: currentMapping.city
      })));
    } else {
      // Robust Fallback: Handle plain text that isn't HTML or JSON
      const parsed = parseGenericText(content, currentBaseDate, currentCinema);
      allShows.push(...parsed.map(s => normalizeShow({
        ...s,
        cinema: currentMapping.sheetColA,
        location: currentMapping.sheetColB,
        city: currentMapping.city
      })));
    }

    currentChunk = "";
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect Cinema name separator: ----The Arena Karachi----, ----The Arena LHR----, ----The Arena ISB----, ----nueplex askari IV----
    const isCinemaHeader = trimmed.startsWith('----') && (
      trimmed.toLowerCase().includes('nueplex') ||
      trimmed.toLowerCase().includes('arena') ||
      trimmed.toLowerCase().includes('raiha') ||
      trimmed.toLowerCase().includes('cinepax')
    );

    if (isCinemaHeader) {
      flushChunk();
      const rawCinema = trimmed.replace(/----/g, '').trim();
      const mapping = resolveCinemaMapping(rawCinema);
      currentCinema = mapping.filterName;
      continue;
    }

    // Detect Date separator: ----20 Aug----, ----20-Aug----, ----16th Apr----
    const sepDate = parseSeparatorDate(trimmed);
    if (trimmed.startsWith('----') && sepDate) {
      flushChunk();
      currentBaseDate = sepDate;
      continue;
    }

    // Otherwise collector HTML/Text
    currentChunk += line + "\n";
  }

  // Final flush and deduplication
  flushChunk();

  // Deduplicate results in case of overlapping markers or repeated pastes
  const uniqueShows = allShows.filter((show, index, self) =>
    index === self.findIndex((t) => (
      t.time === show.time && 
      t.date === show.date && 
      t.movie === show.movie && 
      t.cinema === show.cinema &&
      t.location === show.location &&
      t.screen === show.screen
    ))
  );

  return uniqueShows;
}

/**
 * Parses generic text when no HTML or JSON structure is detected.
 */
function parseGenericText(text: string, baseDate: string, cinema: string): Show[] {
  const shows: Show[] = [];
  const lines = text.split('\n');
  let currentMovie = "";
  
  const mapping = resolveCinemaMapping(cinema);
  const location = mapping.sheetColB;
  const city = mapping.city;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 3) continue;

    // Try to find time patterns
    const timeMatches = trimmed.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/gi);
    
    if (timeMatches) {
      // If we found times, the rest of the line (or previous lines) might be the movie
      const timeStr = timeMatches[0];
      const movieCandidate = trimmed.replace(timeStr, '').replace(/[,|]/g, '').trim();
      
      if (movieCandidate.length > 2) {
        // Keep language tag if present, but normalize English
        currentMovie = movieCandidate
          .replace(/[-–]\s*(2D|3D)\s*(English|Urdu)?/gi, (match, p1, p2) => p2 ? `(${p2.trim()})` : '')
          .replace(/\s*(?:2D|3D)\s*/gi, '')
          .trim();
      }
      
      if (currentMovie) {
        timeMatches.forEach(t => {
          shows.push({
            cinema: mapping.sheetColA,
            location,
            movie: currentMovie,
            format: movieCandidate.includes('3D') || trimmed.includes('3D') ? '3D' : '2D',
            date: baseDate,
            time: t.toUpperCase().trim(),
            screen: '',
            city
          });
        });
      }
    } else {
      // No times found, might be a movie title line
      if (trimmed.length > 4 && trimmed.length < 100 && !trimmed.includes('---')) {
        currentMovie = trimmed;
      }
    }
  }
  return shows;
}

/**
 * Parses raw HTML from Nueplex Network response.
 */
export function parseNueplexHTML(html: string, baseDate: string): Show[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const shows: Show[] = [];

  // Get all cinema headings and show time list items in document order
  const items = doc.querySelectorAll('.cinema-heading, .show-time-li');
  
  let currentScreen = '';
  
  items.forEach(el => {
    // If it's a heading container, update the current screen name
    if (el.classList.contains('cinema-heading')) {
      const heading = el.querySelector('h5, h4, h3');
      if (heading) {
        currentScreen = heading.textContent?.trim() || '';
      }
    } 
    // If it's a show item, extract data using the most recent screen name
    else if (el.classList.contains('show-time-li')) {
      const movie = el.querySelector('.eq-height')?.textContent?.trim();
      const timeRaw = el.querySelector('.time')?.textContent?.trim() || '';
      
      // The format is the .bg_blue label that is NOT inside the .status div
      const bgBlueLabels = Array.from(el.querySelectorAll('.bg_blue'));
      const formatSpan = bgBlueLabels.find(l => !l.closest('.status'));
      const formatText = formatSpan?.textContent?.trim() || '2D';
      
      if (movie && timeRaw) {
        // Clean text and remove asterisks from time
        const time = timeRaw.replace(/\s+/g, ' ').split('*')[0].trim();
        
        let finalDate = baseDate;
        const crossDayLabel = el.querySelector('.movie_day')?.textContent?.trim();
        
        if (crossDayLabel) {
          const match = crossDayLabel.match(/(\d+)(?:st|nd|rd|th)\s+([a-zA-Z]+)\s+(\d{4})/);
          if (match) {
            const day = match[1];
            const month = match[2];
            const year = match[3];
            const m = month.substring(0, 3);
            const mNorm = m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
            finalDate = `${day.padStart(2, '0')}-${mNorm}-${year}`;
          }
        } else if (isAfterMidnight(time)) {
          // Shows between 12 AM and 6 AM are technically next day,
          // but Nueplex lists them under the previous day's schedule.
          // (Previously any "AM" time was shifted, which moved 11:00 AM shows to the wrong day.)
          finalDate = getShiftedDate(baseDate, 1);
        }

        shows.push({
          cinema: 'Nueplex',
          location: 'DHA',
          movie,
          format: formatText.replace('Digital ', ''),
          date: finalDate,
          time,
          screen: currentScreen
        });
      }
    }
  });

  return shows;
}

/**
 * Parses Arena's JSON/HTML response structure.
 */
export function parseArenaHTML(html: string, baseDate: string, cinemaContext: string = 'The Arena'): Show[] {
  const parser = new DOMParser();
  // Clean up some common escaping issues before parsing
  const cleanHtml = html
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\//g, '/')
    .trim();
    
  const doc = parser.parseFromString(cleanHtml, 'text/html');
  const shows: Show[] = [];
  const mapping = resolveCinemaMapping(cinemaContext);

  // Selector 1: Standard Table Row or items
  const rows = doc.querySelectorAll('.showtime-item, tr.showtime-item, .movie_description');
  
  rows.forEach(row => {
    const movieHeading = row.querySelector('h3, h4, .movie-title');
    const movieFullText = movieHeading?.textContent?.trim() || row.textContent?.trim()?.split('\n')[0]?.trim() || '';
    if (!movieFullText || movieFullText.length < 3) return;

    let movie = movieFullText;
    let format = '2D';

    const formatMatch = movieFullText.match(/[-–]\s*(2D|3D)\s*(.*)/i);
    if (formatMatch) {
      format = formatMatch[1].toUpperCase();
      const language = formatMatch[2]?.trim();
      const baseTitle = movieFullText.split(/[-–]\s*(?:2D|3D)/i)[0].trim();
      movie = language ? `${baseTitle} (${language})` : baseTitle;
    }

    // Look for times in typical classes or siblings
    const timeSpans = row.querySelectorAll('.movie_times span, td.movie_times span, .time-item, span');
    timeSpans.forEach(span => {
      const timeText = span.textContent?.trim() || '';
      // Support 12:00 PM, 12:00PM, 12:00 am etc
      const timeMatch = timeText.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)/i);
      if (timeMatch && timeMatch[1].length > 4) {
        // Prevent adding the same show twice
        if (!shows.some(s => s.movie === movie && s.time === timeMatch[1].toUpperCase().trim())) {
          shows.push({
            cinema: mapping.sheetColA,
            location: mapping.sheetColB,
            movie,
            format,
            date: calendarDate(baseDate, timeMatch[1]),
            time: timeMatch[1].toUpperCase().trim(),
            screen: '',
            city: mapping.city
          });
        }
      }
    });
  });

  // Fallback Selector: If no rows found, search for headings globally
  if (shows.length === 0) {
    const titles = doc.querySelectorAll('h3, h4');
    titles.forEach(t => {
      const text = t.textContent?.trim() || '';
      if (!text || text.length < 3) return;
      
      const parent = t.closest('tr, div, li') || t.parentElement;
      if (!parent) return;
      
      const movieParts = text.split('-');
      const movie = movieParts[0].trim();
      const format = text.toUpperCase().includes('3D') ? '3D' : '2D';
      
      const times = parent.querySelectorAll('span, p, td');
      times.forEach(tm => {
        const tmText = tm.textContent?.trim() || '';
        const tmMatch = tmText.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)/i);
        if (tmMatch && tmMatch[1].length > 4 && !shows.some(s => s.movie === movie && s.time === tmMatch[1].toUpperCase())) {
          shows.push({
            cinema: mapping.sheetColA,
            location: mapping.sheetColB,
            movie,
            format,
            date: calendarDate(baseDate, tmMatch[1]),
            time: tmMatch[1].toUpperCase().trim(),
            screen: '',
            city: mapping.city
          });
        }
      });
    });
  }

  return shows;
}
