import { sheetGvizUrl } from '../../src/config';
import { request } from './http';

export type SheetRow = string[];

/**
 * Reads one tab of the public Google Sheet. Returns [] if the tab doesn't exist
 * or the sheet isn't shared publicly. Uses formatted values where available.
 */
export async function readSheetTab(tab: string): Promise<SheetRow[]> {
  try {
    const text = await request(sheetGvizUrl(tab), { retries: 1 });
    const match = text.match(/setResponse\(([\s\S]*)\);?\s*$/);
    if (!match) return [];
    const json = JSON.parse(match[1]);
    if (json.status === 'error') return [];
    // Note: gviz may return the FIRST tab when the requested one is missing,
    // so callers check the header row (rows[0]) before trusting the data.
    const rows: SheetRow[] = (json.table?.rows || []).map((r: any) =>
      (r.c || []).map((cell: any) => (cell == null ? '' : String(cell.f ?? cell.v ?? '').trim())),
    );
    const labels: string[] = (json.table?.cols || []).map((c: any) => String(c.label || '').trim());
    if (labels.some(l => l)) rows.unshift(labels);
    return rows;
  } catch (err: any) {
    console.warn(`  Sheet tab "${tab}" could not be read: ${err.message}`);
    return [];
  }
}
