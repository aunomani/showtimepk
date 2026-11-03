/**
 * Movie title clean-up (replaces the old Gemini-based standardisation).
 *
 * 1. cleanTitle() strips format/language noise:
 *      "Clayface- 2D English"        -> "Clayface"
 *      "PG-13 Street Fighter (3D)"   -> "Street Fighter"
 *      "Clayface- 2D Urdu"           -> "Clayface (Urdu Dubbed)"
 *      "Ghost School Pakistani"      -> "Ghost School (Pakistani)"
 * 2. unifyTitles() merges spellings that only differ by case/punctuation
 *    ("CLAYFACE" vs "Clayface"), merges every version of a "(Pakistani)" film,
 *    and applies config/title-aliases.json.
 */

export type TitleAliases = Record<string, string>;

const LANG_URDU = '(Urdu Dubbed)';
const LANG_PUNJABI = '(Punjabi)';
const LANG_PAKISTANI = '(Pakistani)';

export function cleanTitle(raw: string): string {
  let t = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';

  let lang = '';
  if (/pakistani/i.test(t)) lang = LANG_PAKISTANI; // a Pakistani film: Urdu or Punjabi, audiences know which
  else if (/urdu/i.test(t)) lang = LANG_URDU;
  else if (/punjabi/i.test(t)) lang = LANG_PUNJABI;

  t = t
    // Leading age ratings: "18+Clayface", "PG-13 Verity", "U/A Hope"
    .replace(/^(?:18|15|12)\+\s*/, '')
    .replace(/^(?:PG-1[35]|PG|TBC|U\/A|NC-17|R)\s+/i, '')
    // Language words in any form: "(Urdu Dubbed)", "- 2D English", "(2D Eng)", "English DUbbed", "Mango Jutt Punjabi"
    .replace(/[-–]?\s*\b(?:english|eng|urdu|punjabi|pakistani)\b(?:\s*dubbed)?/gi, ' ')
    .replace(/\bdubbed\b/gi, ' ')
    // Original-language notes in brackets: "Cahim 2 (Turkish Urdu Dubbed)" -> "Cahim 2"
    .replace(/\(\s*(?:turkish|korean|chinese|japanese|hindi|spanish|french)\s*\)/gi, ' ')
    // Format tokens
    .replace(/\b(?:digital|imax)?\s*[23]d\b/gi, ' ')
    .replace(/\bdigital\b/gi, ' ')
    // Empty brackets and leftover separators
    .replace(/\(\s*\)|\[\s*\]/g, ' ')
    .replace(/\s+[-–:]+\s*$/g, '')
    .replace(/^\s*[-–:]+\s+/g, '')
    .replace(/[-–]+\s*$/g, '')
    .replace(/\.+$/, '')
    .replace(/\s+/g, ' ')
    .trim();

  return lang ? `${t} ${lang}` : t;
}

/** Key used to decide that two titles are the same movie. */
export function titleKey(title: string): string {
  return title.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9()]+/g, '');
}

/**
 * Like titleKey, but ignores "(Punjabi)": Punjabi films are made in Punjabi,
 * so "Mango Jutt" and "Mango Jutt (Punjabi)" are the same show.
 * "(Urdu Dubbed)" stays significant because it's a different version of the film.
 */
function mergeKey(title: string): string {
  return titleKey(title.replace(/\(punjabi\)/i, ''));
}

function isAllCaps(s: string): boolean {
  const letters = s.replace(/\([^)]*\)/g, '').replace(/[^A-Za-z]/g, '');
  return letters.length > 1 && letters === letters.toUpperCase();
}

function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s\-:(])([a-z])/g, (_, p, c) => p + c.toUpperCase());
}

function lookupAlias(title: string, aliases: TitleAliases): string | undefined {
  const key = titleKey(title);
  for (const [from, to] of Object.entries(aliases)) {
    if (from.startsWith('_')) continue; // allow "_comment" keys in the JSON file
    if (titleKey(from) === key) return to;
  }
  return undefined;
}

/**
 * Returns a map of raw title -> final display title.
 * Pass every occurrence (duplicates included) so the most common spelling wins.
 */
export function unifyTitles(rawTitles: string[], aliases: TitleAliases = {}): Record<string, string> {
  const cleanedByRaw: Record<string, string> = {};
  const variantsByKey: Record<string, Record<string, number>> = {};

  for (const raw of rawTitles) {
    if (!raw || cleanedByRaw[raw] !== undefined) continue;
    const cleaned = lookupAlias(raw, aliases) ?? cleanTitle(raw);
    cleanedByRaw[raw] = lookupAlias(cleaned, aliases) ?? cleaned;
  }

  // Rule: if any cinema labels a film "(Pakistani)", every version of it becomes "Title (Pakistani)".
  // "Ghost School", "Ghost School (Urdu Dubbed)", "Ghost School (Pakistani)" -> "Ghost School (Pakistani)".
  // International films (Hope, Street Fighter) keep "(Urdu Dubbed)" separate: they also play in English.
  const pakistaniFilms = new Set(
    Object.values(cleanedByRaw).filter(t => t.includes(LANG_PAKISTANI)).map(t => titleKey(stripLanguageTags(t))),
  );
  for (const [raw, cleaned] of Object.entries(cleanedByRaw)) {
    if (pakistaniFilms.has(titleKey(stripLanguageTags(cleaned)))) {
      cleanedByRaw[raw] = `${stripLanguageTags(cleaned)} ${LANG_PAKISTANI}`;
    }
  }

  for (const raw of rawTitles) {
    if (!raw) continue;
    const cleaned = cleanedByRaw[raw];
    const key = mergeKey(cleaned);
    variantsByKey[key] = variantsByKey[key] || {};
    variantsByKey[key][cleaned] = (variantsByKey[key][cleaned] || 0) + 1;
  }

  const displayByKey: Record<string, string> = {};
  for (const [key, variants] of Object.entries(variantsByKey)) {
    const ranked = Object.entries(variants).sort((a, b) => {
      const capsA = isAllCaps(a[0]) ? 1 : 0;
      const capsB = isAllCaps(b[0]) ? 1 : 0;
      if (capsA !== capsB) return capsA - capsB; // prefer normal casing over ALL CAPS
      const tagA = /\(punjabi\)/i.test(a[0]) ? 0 : 1;
      const tagB = /\(punjabi\)/i.test(b[0]) ? 0 : 1;
      if (tagA !== tagB) return tagA - tagB;     // keep the "(Punjabi)" label if any cinema uses it
      return b[1] - a[1];                        // then the most common spelling
    });
    const best = ranked[0][0];
    displayByKey[key] = isAllCaps(best) ? toTitleCase(best) : best;
  }

  const result: Record<string, string> = {};
  for (const [raw, cleaned] of Object.entries(cleanedByRaw)) {
    result[raw] = displayByKey[mergeKey(cleaned)] || cleaned;
  }
  return result;
}

/** "Ghost School (Urdu Dubbed)" -> "Ghost School". */
function stripLanguageTags(title: string): string {
  return title.replace(/\((?:urdu dubbed|punjabi|pakistani)\)/gi, '').replace(/\s+/g, ' ').trim();
}

/** Title without the language tag, used for poster/trailer lookups and the Now Playing cards. */
export function searchTitle(title: string): string {
  return stripLanguageTags(title);
}
