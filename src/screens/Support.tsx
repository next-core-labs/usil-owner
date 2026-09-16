import { useMemo, useState } from 'react';
import { LifeBuoy, Mail, Phone } from 'lucide-react';
import { support as api } from '../api/endpoints.ts';
import { useResource } from '../lib/useResource.ts';
import { count, dateTime, initials } from '../lib/format.ts';
import { Button, Card, EmptyState, ErrorNote, PageHeader } from '../components/ui/primitives.tsx';
import { Toolbar } from '../components/ui/Table.tsx';

/**
 * Read-only: the backend exposes no write route for support messages, so this
 * screen shows them and hands the operator a way to reply out-of-band.
 */
export function Support() {
  const resource = useResource(() => api.list(), []);
  const [search, setSearch] = useState('');
  const rows = resource.data ?? [];

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.name, row.email, row.phone, row.message].join(' ').toLowerCase().includes(needle),
    );
  }, [rows, search]);

  return (
    <>
      <PageHeader
        title="رسائل الدعم"
        subtitle="ما يصل من نموذج «تواصل معنا» في الموقع."
        action={
          <Button size="sm" onClick={() => void resource.reload()} busy={resource.refreshing}>
            تحديث
          </Button>
        }
      />

      {resource.error ? <ErrorNote message={resource.error} onRetry={() => void resource.reload()} /> : null}

      <Card padded={false}>
        <Toolbar search={search} onSearch={setSearch} placeholder="ابحث في الرسائل…" />

        {resource.loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="pulse h-24 rounded-lg bg-sunken" />
            ))}
          </div>
        ) : visible.length ? (
          <ul className="divide-y divide-[var(--line)]">
            {visible.map((row) => (
              <li key={row.id} className="flex gap-3 p-4 transition-colors hover:bg-sunken/50">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sunken text-xs font-semibold text-ink-secondary">
                  {initials(row.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium text-ink">{row.name}</p>
                    <p className="text-xs text-ink-muted">{dateTime(row.createdAt)}</p>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-[13px] leading-6 text-ink-secondary">{row.message}</p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {row.email ? (
                      <a
                        href={`mailto:${row.email}`}
                        className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
                        dir="ltr"
                      >
                        <Mail size={13} />
                        {row.email}
                      </a>
                    ) : null}
                    {row.phone ? (
                      <a
                        href={`tel:${row.phone}`}
                        className="tabular inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
                        dir="ltr"
                      >
                        <Phone size={13} />
                        {row.phone}
                      </a>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<LifeBuoy size={22} />}
            title={rows.length ? 'لا نتائج مطابقة' : 'لا توجد رسائل'}
            body={rows.length ? undefined : 'رسائل نموذج الدعم تظهر هنا، الأحدث أولاً.'}
          />
        )}

        {visible.length ? (
          <p className="border-t border-line px-4 py-3 text-xs text-ink-muted">
            {count(visible.length)} من {count(rows.length)} رسالة
          </p>
        ) : null}
      </Card>
    </>
  );
}
