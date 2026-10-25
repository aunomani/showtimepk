import { Show } from '../types';
import { normalizeDate, normalizeTime } from './normalize';

export interface CinemaMapping {
  id: string;
  filterName: string; // "Name to be shown on Cinema Filter"
  line1: string;      // "Name to be shown on Search results line 1"
  line2: string;      // "Name to be shown on Search results line 2"
  sheetColA: string;  // "Name to be shown on Sheet Column A"
  sheetColB: string;  // "Name to be shown on Sheet Column B"
  city: 'Karachi' | 'Lahore' | 'RWP/ISB';
  brand: 'raiha' | 'arena' | 'cinepax' | 'nueplex' | 'cinestar' | 'other';
}

export const CANONICAL_CINEMAS: CinemaMapping[] = [
  // Raiha CineGold
  {
    id: 'raiha-khi',
    filterName: 'Raiha CineGold KHI',
    line1: 'Raiha CineGold',
    line2: 'Bahria Town Karachi',
    sheetColA: 'Raiha CineGold',
    sheetColB: 'Bahria Town Karachi',
    city: 'Karachi',
    brand: 'raiha'
  },
  {
    id: 'raiha-lhr',
    filterName: 'Raiha CineGold LHR',
    line1: 'Raiha CineGold',
    line2: 'Bahria Town Lahore',
    sheetColA: 'Raiha CineGold',
    sheetColB: 'Bahria Town Lahore',
    city: 'Lahore',
    brand: 'raiha'
  },
  {
    id: 'raiha-isb',
    filterName: 'Raiha CineGold ISB',
    line1: 'Raiha CineGold',
    line2: 'Bahria Town Islamabad',
    sheetColA: 'Raiha CineGold',
    sheetColB: 'Bahria Town Islamabad',
    city: 'RWP/ISB',
    brand: 'raiha'
  },

  // The Arena
  {
    id: 'arena-khi',
    filterName: 'The Arena KHI',
    line1: 'The Arena',
    line2: 'Bahria Icon Tower',
    sheetColA: 'The Arena',
    sheetColB: 'Bahria Icon Tower',
    city: 'Karachi',
    brand: 'arena'
  },
  {
    id: 'arena-lhr',
    filterName: 'The Arena LHR',
    line1: 'The Arena',
    line2: 'Bahria Orchard',
    sheetColA: 'The Arena',
    sheetColB: 'Bahria Orchard',
    city: 'Lahore',
    brand: 'arena'
  },
  {
    id: 'arena-isb',
    filterName: 'The Arena ISB',
    line1: 'The Arena',
    line2: 'Phase IV Bahria Town',
    sheetColA: 'The Arena',
    sheetColB: 'Phase IV Bahria Town',
    city: 'RWP/ISB',
    brand: 'arena'
  },

  // Cinepax
  {
    id: 'cinepax-ocean-khi',
    filterName: 'Cinepax Ocean Mall KHI',
    line1: 'Cinepax',
    line2: 'Ocean Mall Karachi',
    sheetColA: 'Cinepax',
    sheetColB: 'Ocean Mall Karachi',
    city: 'Karachi',
    brand: 'cinepax'
  },
  {
    id: 'cinepax-jinnah-rwp',
    filterName: 'Cinepax Jinnah Park RWP',
    line1: 'Cinepax',
    line2: 'Jinnah Park Rawalpindi',
    sheetColA: 'Cinepax',
    sheetColB: 'Jinnah Park Rawalpindi',
    city: 'RWP/ISB',
    brand: 'cinepax'
  },
  {
    id: 'cinepax-amanah-lhr',
    filterName: 'Cinepax Amanah Mall LHR',
    line1: 'Cinepax',
    line2: 'Amanah Mall Lahore',
    sheetColA: 'Cinepax',
    sheetColB: 'Amanah Mall Lahore',
    city: 'Lahore',
    brand: 'cinepax'
  },
  {
    id: 'cinepax-packages-lhr',
    filterName: 'Cinepax Packages Mall LHR',
    line1: 'Cinepax',
    line2: 'Packages Mall Lahore',
    sheetColA: 'Cinepax',
    sheetColB: 'Packages Mall Lahore',
    city: 'Lahore',
    brand: 'cinepax'
  },
  {
    id: 'cinepax-wtc-isb',
    filterName: 'Cinepax World Trade center ISB',
    line1: 'Cinepax',
    line2: 'World Trade center Islamabad',
    sheetColA: 'Cinepax',
    sheetColB: 'World Trade center Islamabad',
    city: 'RWP/ISB',
    brand: 'cinepax'
  },

  // Nueplex (Karachi)
  {
    id: 'nueplex-askari',
    filterName: 'Nueplex Askari KHI',
    line1: 'Nueplex',
    line2: 'Askari IV',
    sheetColA: 'Nueplex Askari IV',
    sheetColB: 'Askari IV',
    city: 'Karachi',
    brand: 'nueplex'
  },
  {
    id: 'nueplex-dha',
    filterName: 'Nueplex DHA KHI',
    line1: 'Nueplex',
    line2: 'DHA Phase 8',
    sheetColA: 'Nueplex DHA',
    sheetColB: 'DHA Phase 8',
    city: 'Karachi',
    brand: 'nueplex'
  },

  // CineStar (Lahore)
  {
    id: 'cinestar-township-lhr',
    filterName: 'Cinestar Township LHR',
    line1: 'Cinestar',
    line2: 'Township Commercial Area LHR',
    sheetColA: 'Cinestar',
    sheetColB: 'Township Commercial Area LHR',
    city: 'Lahore',
    brand: 'cinestar'
  },
  {
    id: 'cinestar-dha-raya-lhr',
    filterName: 'Cinestar DHA Raya Club LHR',
    line1: 'Cinestar',
    line2: 'Raya Golf Resort DHA Phase 6 LHR',
    sheetColA: 'Cinestar',
    sheetColB: 'Raya Golf Resort DHA Phase 6 LHR',
    city: 'Lahore',
    brand: 'cinestar'
  },
  {
    id: 'cinestar-xinhua-lhr',
    filterName: 'Cinestar Xinhua Mall LHR',
    line1: 'Cinestar',
    line2: 'Xinhua Mall Gulberg III LHR',
    sheetColA: 'Cinestar',
    sheetColB: 'Xinhua Mall Gulberg III LHR',
    city: 'Lahore',
    brand: 'cinestar'
  }
];

/**
 * Resolves any show or raw cinema/location input to its canonical CinemaMapping metadata.
 */
export function resolveCinemaMapping(
  cinemaRaw?: string,
  locationRaw?: string,
  cityRaw?: string
): CinemaMapping {
  const combined = `${cinemaRaw || ''} ${locationRaw || ''} ${cityRaw || ''}`.toLowerCase();

  // 1. CineStar Branches
  if (combined.includes('cinestar') || combined.includes('cine star')) {
    if (combined.includes('township')) {
      return CANONICAL_CINEMAS.find(c => c.id === 'cinestar-township-lhr')!;
    }
    if (combined.includes('raya') || /\bdha\b/.test(combined) || combined.includes('phase 6') || combined.includes('phase-6')) {
      return CANONICAL_CINEMAS.find(c => c.id === 'cinestar-dha-raya-lhr')!;
    }
    if (combined.includes('xinhua') || combined.includes('gulberg')) {
      return CANONICAL_CINEMAS.find(c => c.id === 'cinestar-xinhua-lhr')!;
    }
    return CANONICAL_CINEMAS.find(c => c.id === 'cinestar-township-lhr')!;
  }

  if (combined.includes('township')) {
    return CANONICAL_CINEMAS.find(c => c.id === 'cinestar-township-lhr')!;
  }
  if (combined.includes('xinhua')) {
    return CANONICAL_CINEMAS.find(c => c.id === 'cinestar-xinhua-lhr')!;
  }
  if (combined.includes('raya') || (combined.includes('dha') && (combined.includes('lahore') || combined.includes('lhr')))) {
    return CANONICAL_CINEMAS.find(c => c.id === 'cinestar-dha-raya-lhr')!;
  }

  // 1. Cinepax Branches
  if (combined.includes('cinepax')) {
    if (combined.includes('jinnah') || combined.includes('rawalpindi') || combined.includes('rwp')) {
      return CANONICAL_CINEMAS.find(c => c.id === 'cinepax-jinnah-rwp')!;
    }
    if (combined.includes('amanah')) {
      return CANONICAL_CINEMAS.find(c => c.id === 'cinepax-amanah-lhr')!;
    }
    if (combined.includes('packages')) {
      return CANONICAL_CINEMAS.find(c => c.id === 'cinepax-packages-lhr')!;
    }
    if (combined.includes('world trade') || combined.includes('wtc') || combined.includes('giga') || combined.includes('islamabad') || combined.includes('isb')) {
      return CANONICAL_CINEMAS.find(c => c.id === 'cinepax-wtc-isb')!;
    }
    if (combined.includes('ocean') || combined.includes('clifton') || combined.includes('karachi') || combined.includes('khi')) {
      return CANONICAL_CINEMAS.find(c => c.id === 'cinepax-ocean-khi')!;
    }
  }

  if (combined.includes('jinnah')) {
    return CANONICAL_CINEMAS.find(c => c.id === 'cinepax-jinnah-rwp')!;
  }
  if (combined.includes('amanah')) {
    return CANONICAL_CINEMAS.find(c => c.id === 'cinepax-amanah-lhr')!;
  }
  if (combined.includes('packages')) {
    return CANONICAL_CINEMAS.find(c => c.id === 'cinepax-packages-lhr')!;
  }
  if (combined.includes('world trade') || combined.includes('wtc')) {
    return CANONICAL_CINEMAS.find(c => c.id === 'cinepax-wtc-isb')!;
  }
  if (combined.includes('ocean mall')) {
    return CANONICAL_CINEMAS.find(c => c.id === 'cinepax-ocean-khi')!;
  }

  // 2. The Arena Branches
  if (combined.includes('arena')) {
    if (combined.includes('orchard') || combined.includes('lahore') || combined.includes('lhr')) {
      return CANONICAL_CINEMAS.find(c => c.id === 'arena-lhr')!;
    }
    if (combined.includes('phase iv') || combined.includes('phase 4') || combined.includes('phase-iv') || combined.includes('phase-4') || combined.includes('islamabad') || combined.includes('rawalpindi') || combined.includes('isb') || combined.includes('rwp')) {
      return CANONICAL_CINEMAS.find(c => c.id === 'arena-isb')!;
    }
    if (combined.includes('icon') || combined.includes('karachi') || combined.includes('khi')) {
      return CANONICAL_CINEMAS.find(c => c.id === 'arena-khi')!;
    }
    return CANONICAL_CINEMAS.find(c => c.id === 'arena-khi')!;
  }

  // 3. Raiha CineGold Branches
  if (combined.includes('raiha') || combined.includes('cinegold') || combined.includes('cine gold')) {
    if (combined.includes('lahore') || combined.includes('lhr') || combined.includes('orchard')) {
      return CANONICAL_CINEMAS.find(c => c.id === 'raiha-lhr')!;
    }
    if (combined.includes('islamabad') || combined.includes('rawalpindi') || combined.includes('isb') || combined.includes('rwp') || combined.includes('phase 7') || combined.includes('phase vii')) {
      return CANONICAL_CINEMAS.find(c => c.id === 'raiha-isb')!;
    }
    return CANONICAL_CINEMAS.find(c => c.id === 'raiha-khi')!;
  }

  // 4. Nueplex Branches
  if (combined.includes('askari')) {
    return CANONICAL_CINEMAS.find(c => c.id === 'nueplex-askari')!;
  }
  if (combined.includes('dha') || combined.includes('the place') || combined.includes('nueplex')) {
    return CANONICAL_CINEMAS.find(c => c.id === 'nueplex-dha')!;
  }

  // Fallback generic mapping if entirely unknown
  const city = (cityRaw?.toLowerCase().includes('lahore') || combined.includes('lahore') || combined.includes('lhr') ? 'Lahore' :
                cityRaw?.toLowerCase().includes('islamabad') || cityRaw?.toLowerCase().includes('rawalpindi') || combined.includes('isb') || combined.includes('rwp') || combined.includes('islamabad') || combined.includes('rawalpindi') ? 'RWP/ISB' : 'Karachi') as 'Karachi' | 'Lahore' | 'RWP/ISB';

  const cleanCinema = (cinemaRaw || 'Cinema').trim();
  const cleanLoc = (locationRaw || cleanCinema).trim();

  return {
    id: `custom-${cleanCinema.toLowerCase().replace(/\s+/g, '-')}`,
    filterName: `${cleanCinema} ${cleanLoc}`,
    line1: cleanCinema,
    line2: cleanLoc,
    sheetColA: cleanCinema,
    sheetColB: cleanLoc,
    city,
    brand: 'other'
  };
}

/**
 * Normalizes a Show object strictly to the canonical names defined in the mapping table.
 */
export function normalizeShow(show: Partial<Show>): Show {
  const mapping = resolveCinemaMapping(show.cinema, show.location, show.city);

  return {
    cinema: mapping.sheetColA,
    location: mapping.sheetColB,
    movie: (show.movie || '').trim(),
    format: show.format ? (show.format.toUpperCase().includes('3D') ? '3D' : '2D') : '2D',
    date: normalizeDate(show.date),
    time: normalizeTime(show.time),
    screen: show.screen || '',
    city: mapping.city,
    source: show.source
  };
}
