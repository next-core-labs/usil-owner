import { useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { count } from '../../lib/format.ts';
import { clampPage, pageWindow, PAGE_SIZES } from '../../lib/pagination.ts';
import { TableSkeleton } from './primitives.tsx';

export type Column<T> = {
  key: string;
  header: string;
  /** Cells are right-aligned by default (RTL); numbers opt into tabular figures. */
  numeric?: boolean;
  width?: string;
  render: (row: T) => ReactNode;
};

/**
 * One table for every list in the dashboard. It scrolls horizontally inside its
 * own container so a wide row never makes the page scroll sideways, and pages
 * long lists. `resetKey` names the screen's search and filters: when it
 * changes the table goes back to page 1. Edits and deletes keep the page.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  empty,
  resetKey = '',
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  empty: ReactNode;
  resetKey?: string;
}) {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState<number>(PAGE_SIZES[0]);
  const [seenKey, setSeenKey] = useState(resetKey);
  const top = useRef<HTMLDivElement>(null);

  if (seenKey !== resetKey) {
    setSeenKey(resetKey);
    setPage(1);
  }

  if (loading) return <TableSkeleton />;
  if (!rows.length) return <>{empty}</>;

  const current = clampPage(page, rows.length, size);
  const shown = rows.length > size ? rows.slice((current - 1) * size, current * size) : rows;

  function goTo(next: number) {
    setPage(next);
    // Back to the table's head when the new page starts above the screen.
    const box = top.current?.getBoundingClientRect();
    if (box && box.top < 0) top.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  return (
    <div ref={top} className="scroll-mt-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  style={column.width ? { width: column.width } : undefined}
                  className="whitespace-nowrap px-4 py-3 text-start text-xs font-semibold tracking-wide text-ink-muted"
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr
                key={rowKey(row)}
                className="border-b border-line last:border-0 transition-colors hover:bg-sunken/60"
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-4 py-3 align-middle text-ink ${column.numeric ? 'tabular' : ''}`}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > PAGE_SIZES[0] ? (
        <Pager
          page={current}
          size={size}
          total={rows.length}
          onPage={goTo}
          onSize={(next) => {
            setSize(next);
            goTo(1);
          }}
        />
      ) : null}
    </div>
  );
}

/** Under the table: which rows show, the page buttons, and how many per page. */
function Pager({
  page,
  size,
  total,
  onPage,
  onSize,
}: {
  page: number;
  size: number;
  total: number;
  onPage: (page: number) => void;
  onSize: (size: number) => void;
}) {
  const pages = Math.ceil(total / size);
  const first = (page - 1) * size + 1;
  const last = Math.min(page * size, total);
  const step =
    'inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-[13px] transition-colors disabled:pointer-events-none disabled:opacity-40';

  return (
    <nav aria-label="صفحات الجدول" className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
      <p className="tabular text-xs text-ink-muted">
        {count(first)}–{count(last)} من {count(total)}
      </p>

      <div className="flex items-center gap-1">
        {/* RTL: the previous page sits on the right, so its arrow points right. */}
        <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="الصفحة السابقة" className={`${step} text-ink-secondary hover:bg-sunken`}>
          <ChevronRight size={16} />
        </button>
        {pageWindow(page, pages).map((item, index) =>
          item === null ? (
            <span key={`gap-${index}`} className="px-1 text-xs text-ink-muted" aria-hidden>
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPage(item)}
              aria-current={item === page ? 'page' : undefined}
              aria-label={`الصفحة ${count(item)}`}
              className={`${step} tabular ${
                item === page ? 'bg-[var(--accent-wash)] font-semibold text-accent' : 'text-ink-secondary hover:bg-sunken'
              }`}
            >
              {count(item)}
            </button>
          ),
        )}
        <button type="button" onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="الصفحة التالية" className={`${step} text-ink-secondary hover:bg-sunken`}>
          <ChevronLeft size={16} />
        </button>
      </div>

      <label className="flex items-center gap-2 text-xs text-ink-muted">
        لكل صفحة
        <select
          value={size}
          onChange={(event) => onSize(Number(event.target.value))}
          className="h-8 rounded-lg border border-line-strong bg-surface px-2 text-[13px] text-ink focus:border-accent focus:outline-none"
        >
          {PAGE_SIZES.map((option) => (
            <option key={option} value={option}>
              {count(option)}
            </option>
          ))}
        </select>
      </label>
    </nav>
  );
}

/** Filters live in one row above the table — never inside it. */
export function Toolbar({
  search,
  onSearch,
  placeholder = 'ابحث…',
  children,
}: {
  search: string;
  onSearch: (value: string) => void;
  placeholder?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
      <div className="relative min-w-[200px] flex-1">
        <Search
          size={15}
          className="pointer-events-none absolute inset-y-0 start-3 my-auto text-ink-muted"
          aria-hidden
        />
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-9 w-full rounded-lg border border-line-strong bg-surface ps-9 pe-3 text-sm text-ink placeholder:text-ink-muted transition-colors hover:border-[var(--axis)] focus:border-accent focus:outline-none"
        />
      </div>
      {children}
    </div>
  );
}

/** A segmented status filter. Counts sit in the pill so the operator can triage. */
export function FilterTabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (next: T) => void;
  options: Array<{ value: T; label: string; count?: number }>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg bg-sunken p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
              active ? 'bg-surface text-ink shadow-[var(--shadow-card)]' : 'text-ink-secondary hover:text-ink'
            }`}
          >
            {option.label}
            {typeof option.count === 'number' ? (
              <span className="tabular text-xs text-ink-muted">{count(option.count)}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
