import { useMemo, useState } from 'react';
import { Store } from 'lucide-react';
import { vendorHubs as api } from '../api/endpoints.ts';
import type { VendorHub } from '../api/types.ts';
import { useResource } from '../lib/useResource.ts';
import { count } from '../lib/format.ts';
import { Badge, Button, Card, EmptyState, ErrorNote, PageHeader } from '../components/ui/primitives.tsx';
import { DataTable, Toolbar, type Column } from '../components/ui/Table.tsx';
import { StatusBadge } from './VendorApplications.tsx';

export function Vendors() {
  const resource = useResource(() => api.list(), []);
  const [search, setSearch] = useState('');
  const rows = resource.data ?? [];

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.name, row.projectName, row.email].join(' ').toLowerCase().includes(needle),
    );
  }, [rows, search]);

  const columns: Column<VendorHub>[] = [
    {
      key: 'vendor',
      header: 'المورّد',
      render: (row) => (
        <div className="min-w-0">
          <p className="flex items-center gap-2 truncate font-medium text-ink">
            {row.projectName || row.name}
            {row.isOwn ? <Badge tone="accent">حسابك</Badge> : null}
          </p>
          <p className="truncate text-xs text-ink-muted">{row.name}</p>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'البريد',
      render: (row) => (
        <span className="text-[13px] text-ink-secondary" dir="ltr">
          {row.email || '—'}
        </span>
      ),
    },
    { key: 'listings', header: 'المنتجات', numeric: true, render: (row) => <span>{count(row.listingCount)}</span> },
    { key: 'bookings', header: 'الحجوزات', numeric: true, render: (row) => <span>{count(row.bookingCount)}</span> },
    { key: 'status', header: 'الحالة', render: (row) => <StatusBadge status={row.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="ملفات المورّدين"
        subtitle="كل مورّد وما نشره وما وصله من حجوزات."
        action={
          <Button size="sm" onClick={() => void resource.reload()} busy={resource.refreshing}>
            تحديث
          </Button>
        }
      />

      {resource.error ? <ErrorNote message={resource.error} onRetry={() => void resource.reload()} /> : null}

      <Card padded={false}>
        <Toolbar search={search} onSearch={setSearch} placeholder="ابحث باسم المشروع أو البريد…" />
        <DataTable
          columns={columns}
          rows={visible}
          rowKey={(row) => row.vendorId}
          loading={resource.loading}
          empty={
            <EmptyState
              icon={<Store size={22} />}
              title={rows.length ? 'لا نتائج مطابقة' : 'لا يوجد مورّدون معتمدون'}
              body={rows.length ? undefined : 'اعتمد طلب مورّد ليظهر ملفه هنا.'}
            />
          }
        />
      </Card>
    </>
  );
}
