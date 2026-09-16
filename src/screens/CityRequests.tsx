import { useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';
import { cityRequests as api } from '../api/endpoints.ts';
import type { CityRequest, DemandStatus } from '../api/types.ts';
import { errorText } from '../api/client.ts';
import { useResource } from '../lib/useResource.ts';
import { useToast } from '../state/ToastContext.tsx';
import { count, dateTime, shortDate } from '../lib/format.ts';
import { DEMAND_STATUSES, DEMAND_STATUS_LABEL } from '../lib/labels.ts';
import { Button, Card, EmptyState, ErrorNote, PageHeader, Select } from '../components/ui/primitives.tsx';
import { DataTable, FilterTabs, Toolbar, type Column } from '../components/ui/Table.tsx';

export function CityRequests() {
  const resource = useResource(() => api.list(), []);
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<DemandStatus | 'all'>('all');
  const [saving, setSaving] = useState<string | null>(null);

  const rows = resource.data ?? [];

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== 'all' && row.status !== filter) return false;
      if (!needle) return true;
      return [row.name, row.city, row.phone, row.occasion].join(' ').toLowerCase().includes(needle);
    });
  }, [rows, search, filter]);

  /** Which cities are asking loudest — the reason this screen exists. */
  const topCities = useMemo(() => {
    const tally = new Map<string, number>();
    for (const row of rows) tally.set(row.city, (tally.get(row.city) || 0) + 1);
    return Array.from(tally.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [rows]);

  async function changeStatus(row: CityRequest, status: DemandStatus) {
    setSaving(row.id);
    try {
      const result = await api.setStatus(row.id, status);
      resource.set(rows.map((item) => (item.id === row.id ? result.data : item)));
      toast.success(`حُدّث طلب ${row.city}.`);
    } catch (caught) {
      toast.failure(errorText(caught));
    } finally {
      setSaving(null);
    }
  }

  const columns: Column<CityRequest>[] = [
    {
      key: 'city',
      header: 'المدينة',
      render: (row) => (
        <div>
          <p className="font-medium text-ink">{row.city}</p>
          <p className="text-xs text-ink-muted">{row.occasion}</p>
        </div>
      ),
    },
    {
      key: 'requester',
      header: 'الطالب',
      render: (row) => (
        <div>
          <p className="text-ink">{row.name}</p>
          <p className="tabular text-xs text-ink-muted" dir="ltr">
            {row.phone}
          </p>
        </div>
      ),
    },
    { key: 'eventDate', header: 'موعد المناسبة', render: (row) => <span className="text-[13px] text-ink-secondary">{row.eventDate ? shortDate(row.eventDate) : '—'}</span> },
    { key: 'created', header: 'أُرسل', render: (row) => <span className="text-[13px] text-ink-secondary">{dateTime(row.createdAt)}</span> },
    {
      key: 'notes',
      header: 'ملاحظات',
      render: (row) => (
        <p className="max-w-[240px] truncate text-[13px] text-ink-secondary" title={row.notes}>
          {row.notes || '—'}
        </p>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      width: '160px',
      render: (row) => (
        <Select
          value={row.status}
          disabled={saving === row.id}
          onChange={(event) => void changeStatus(row, event.target.value as DemandStatus)}
          className="h-8 text-[13px]"
          aria-label={`حالة طلب ${row.city}`}
        >
          {DEMAND_STATUSES.map((status) => (
            <option key={status} value={status}>
              {DEMAND_STATUS_LABEL[status]}
            </option>
          ))}
        </Select>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="طلبات المدن"
        subtitle="أين يطلب الناس يوصل قبل أن نصل — مصدر قرار التوسّع."
        action={
          <Button size="sm" onClick={() => void resource.reload()} busy={resource.refreshing}>
            تحديث
          </Button>
        }
      />

      {resource.error ? <ErrorNote message={resource.error} onRetry={() => void resource.reload()} /> : null}

      {topCities.length ? (
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-ink">أكثر المدن طلباً</h2>
          <ul className="flex flex-wrap gap-2">
            {topCities.map(([city, total]) => (
              <li
                key={city}
                className="flex items-center gap-2 rounded-lg border border-line bg-sunken px-3 py-1.5 text-[13px]"
              >
                <span className="text-ink">{city}</span>
                <span className="tabular font-semibold text-ink-secondary">{count(total)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card padded={false}>
        <Toolbar search={search} onSearch={setSearch} placeholder="ابحث بالمدينة أو الاسم…">
          <FilterTabs
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'الكل', count: rows.length },
              ...DEMAND_STATUSES.map((status) => ({
                value: status,
                label: DEMAND_STATUS_LABEL[status],
                count: rows.filter((row) => row.status === status).length,
              })),
            ]}
          />
        </Toolbar>
        <DataTable
          columns={columns}
          rows={visible}
          rowKey={(row) => row.id}
          loading={resource.loading}
          empty={
            <EmptyState
              icon={<MapPin size={22} />}
              title={rows.length ? 'لا نتائج مطابقة' : 'لا توجد طلبات مدن'}
              body={rows.length ? undefined : 'يظهر هنا كل من طلب يوصل في مدينته من الموقع.'}
            />
          }
        />
      </Card>
    </>
  );
}
