import { useMemo, useState } from 'react';
import { CalendarCheck, CheckCircle2, CircleAlert, ExternalLink, Trash2 } from 'lucide-react';
import { bookings as bookingsApi } from '../api/endpoints.ts';
import type { PlatformBooking } from '../api/types.ts';
import { errorText } from '../api/client.ts';
import { useResource } from '../lib/useResource.ts';
import { useToast } from '../state/ToastContext.tsx';
import { count, dateTime, sar } from '../lib/format.ts';
import { BOOKING_MODE_LABEL, labelFor } from '../lib/labels.ts';
import { Badge, Button, Card, EmptyState, ErrorNote, PageHeader, Select } from '../components/ui/primitives.tsx';
import { DataTable, FilterTabs, Toolbar, type Column } from '../components/ui/Table.tsx';
import { ConfirmDialog } from '../components/ui/Modal.tsx';

/**
 * Platform bookings carry a free-text Arabic status, so these are offered as a
 * shortlist rather than enforced — the server accepts whatever it is sent.
 */
const STATUS_OPTIONS = [
  'جديد',
  'بانتظار موافقة المورّد',
  'مؤكد',
  'قيد التنفيذ',
  'مكتمل',
  'ملغي',
  'مرفوض من المورّد',
];

type PayFilter = 'all' | 'paid' | 'unpaid';

export function Bookings() {
  const resource = useResource(() => bookingsApi.list(), []);
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<PayFilter>('all');
  const [saving, setSaving] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PlatformBooking | null>(null);
  const [deleting, setDeleting] = useState(false);

  const rows = resource.data ?? [];

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === 'paid' && row.paymentStatus !== 'paid') return false;
      if (filter === 'unpaid' && row.paymentStatus === 'paid') return false;
      if (!needle) return true;
      return [row.id, row.name, row.phone, row.serviceName, row.city, row.email]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [rows, search, filter]);

  const paidCount = rows.filter((row) => row.paymentStatus === 'paid').length;

  async function changeStatus(row: PlatformBooking, status: string) {
    setSaving(row.id);
    try {
      const result = await bookingsApi.setStatus(row.id, status);
      resource.set(rows.map((item) => (item.id === row.id ? result.booking : item)));
      toast.success(`حُدّثت حالة الحجز ${row.id}.`);
    } catch (caught) {
      toast.failure(errorText(caught));
    } finally {
      setSaving(null);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await bookingsApi.remove(pendingDelete.id);
      resource.set(rows.filter((item) => item.id !== pendingDelete.id));
      toast.success(`حُذف الحجز ${pendingDelete.id}.`);
      setPendingDelete(null);
    } catch (caught) {
      toast.failure(errorText(caught));
    } finally {
      setDeleting(false);
    }
  }

  const columns: Column<PlatformBooking>[] = [
    {
      key: 'id',
      header: 'الحجز',
      render: (row) => (
        <div>
          <p className="tabular font-medium text-ink">{row.id}</p>
          <p className="text-xs text-ink-muted">{dateTime(row.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'العميل',
      render: (row) => (
        <div>
          <p className="text-ink">{row.name}</p>
          <p className="tabular text-xs text-ink-muted" dir="ltr">
            {row.phone}
          </p>
        </div>
      ),
    },
    {
      key: 'service',
      header: 'الخدمة',
      render: (row) => (
        <div className="max-w-[220px]">
          <p className="truncate text-ink">{row.serviceName}</p>
          <p className="text-xs text-ink-muted">
            {row.city || '—'} · {labelFor(BOOKING_MODE_LABEL, row.bookingMode)}
          </p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'المبلغ',
      numeric: true,
      render: (row) => <span className="font-medium">{sar(row.totalAmount)}</span>,
    },
    {
      key: 'payment',
      header: 'الدفع',
      render: (row) =>
        row.paymentStatus === 'paid' ? (
          <Badge tone="good" icon={<CheckCircle2 size={13} />}>
            مدفوع
          </Badge>
        ) : (
          <Badge tone="warning" icon={<CircleAlert size={13} />}>
            غير مدفوع
          </Badge>
        ),
    },
    {
      key: 'status',
      header: 'الحالة',
      width: '190px',
      render: (row) => (
        <Select
          value={STATUS_OPTIONS.includes(row.status) ? row.status : ''}
          disabled={saving === row.id}
          onChange={(event) => void changeStatus(row, event.target.value)}
          className="h-8 text-[13px]"
          aria-label={`حالة الحجز ${row.id}`}
        >
          {!STATUS_OPTIONS.includes(row.status) ? <option value="">{row.status || '—'}</option> : null}
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          {row.paymentUrl ? (
            <a
              href={row.paymentUrl}
              target="_blank"
              rel="noreferrer noopener"
              title="فتح فاتورة ميسر"
              aria-label={`فتح فاتورة الحجز ${row.id}`}
              className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-sunken hover:text-ink"
            >
              <ExternalLink size={15} />
            </a>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            aria-label={`حذف الحجز ${row.id}`}
            title="حذف"
            onClick={() => setPendingDelete(row)}
            icon={<Trash2 size={15} />}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="الحجوزات"
        subtitle="طلبات متجر يوصل التي تُسوّى عبر ميسر."
        action={
          <Button size="sm" onClick={() => void resource.reload()} busy={resource.refreshing}>
            تحديث
          </Button>
        }
      />

      {resource.error ? <ErrorNote message={resource.error} onRetry={() => void resource.reload()} /> : null}

      <Card padded={false}>
        <Toolbar search={search} onSearch={setSearch} placeholder="ابحث برقم الحجز أو الاسم أو الجوال…">
          <FilterTabs
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'الكل', count: rows.length },
              { value: 'paid', label: 'مدفوع', count: paidCount },
              { value: 'unpaid', label: 'غير مدفوع', count: rows.length - paidCount },
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
              icon={<CalendarCheck size={22} />}
              title={rows.length ? 'لا نتائج مطابقة' : 'لا توجد حجوزات بعد'}
              body={rows.length ? 'جرّب كلمة بحث أو مرشّحاً آخر.' : 'أول حجز من المتجر يظهر هنا مباشرة.'}
            />
          }
        />

        {visible.length ? (
          <p className="border-t border-line px-4 py-3 text-xs text-ink-muted">
            {count(visible.length)} من {count(rows.length)} حجز
          </p>
        ) : null}
      </Card>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="حذف الحجز؟"
        body={`سيُحذف الحجز ${pendingDelete?.id ?? ''} نهائياً من سجلات يوصل. لا يمكن التراجع، والفاتورة في ميسر لا تتأثر.`}
        confirmLabel="حذف نهائي"
        danger
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
