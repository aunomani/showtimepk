/**
 * Google Sheet used for the hand-edited tabs (prices, rtings, coming soon)
 * and as a manual fallback for showtimes (Sheet1).
 * The sheet must be shared as "Anyone with the link can view".
 * This ID is not a secret: anyone can already see it in the website's code.
 */
export const SPREADSHEET_ID = '1dxvgAYoynFbfuBn4sRRQ98IL4m1EFGrVxNc-zi-1QxM';

export function sheetGvizUrl(sheetName: string): string {
  return `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
}
