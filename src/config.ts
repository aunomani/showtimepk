/**
 * Google Sheet used for the hand-edited tabs (prices, rtings, coming soon)
 * and as a manual fallback for showtimes (Sheet1).
 * The sheet must be shared as "Anyone with the link can view".
 * This ID is not a secret: anyone can already see it in the website's code.
 */
export const SPREADSHEET_ID = '1dxvgAYoynFbfuBn4sRRQ98IL4m1EFGrVxNc-zi-1QxM';

/**
 * Where visitors' browsers load the showtime data from: the public GitHub repo.
 * The scraper commits fresh files there every 12 hours, so the site shows new
 * data without a Netlify deploy (deploys cost Netlify credits). If GitHub can't
 * be reached, the site falls back to the copy bundled at /data/.
 * GitHub caches these files for up to 5 minutes.
 */
export const DATA_BASE_URL = 'https://raw.githubusercontent.com/aunomani/showtimepk/main/public/data';

export function sheetGvizUrl(sheetName: string): string {
  return `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
}
