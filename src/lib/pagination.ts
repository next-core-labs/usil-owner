export const PAGE_SIZES = [25, 50, 100] as const;

/** Clamps a 1-based page into the pages that `total` rows fill. */
export function clampPage(page: number, total: number, size: number): number {
  const pages = Math.max(1, Math.ceil(total / size));
  return Math.min(Math.max(1, Math.floor(page) || 1), pages);
}

/**
 * The page buttons to show: always the first and last, the current page with
 * one neighbour each side, and `null` where a run of pages is skipped.
 * 10 pages on page 5 → 1 … 4 5 6 … 10.
 */
export function pageWindow(current: number, pages: number): Array<number | null> {
  if (pages <= 7) return Array.from({ length: pages }, (_, index) => index + 1);
  const wanted = new Set([1, pages, current - 1, current, current + 1]);
  // Near either end, keep five in a row so the bar does not jump in width.
  if (current <= 3) [2, 3, 4, 5].forEach((page) => wanted.add(page));
  if (current >= pages - 2) [pages - 4, pages - 3, pages - 2, pages - 1].forEach((page) => wanted.add(page));
  const sorted = [...wanted].filter((page) => page >= 1 && page <= pages).sort((a, b) => a - b);
  const out: Array<number | null> = [];
  for (const page of sorted) {
    const last = out[out.length - 1];
    if (typeof last === 'number' && page - last > 1) out.push(null);
    out.push(page);
  }
  return out;
}
