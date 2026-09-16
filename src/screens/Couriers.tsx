import { useMemo, useState } from 'react';
import { Check, Truck, X } from 'lucide-react';
import { couriers as api } from '../api/endpoints.ts';
import type { ApplicationStatus, CourierApplication } from '../api/types.ts';
import { errorText } from '../api/client.ts';
import { useResource } from '../lib/useResource.ts';
import { useToast } from '../state/ToastContext.tsx';
import { usePending } from '../state/PendingContext.tsx';
import { dateTime } from '../lib/format.ts';
import { FULFILLMENT_LABEL, labelFor } from '../lib/labels.ts';
import { Badge, Button, Card, EmptyState, ErrorNote, Field, PageHeader, Textarea } from '../components/ui/primitives.tsx';
import { DataTable, FilterTabs, Toolbar, type Column } from '../components/ui/Table.tsx';
import { ConfirmDialog, Modal } from '../components/ui/Modal.tsx';
import { StatusBadge } from './VendorApplications.tsx';

function courierName(row: CourierApplication): string {
  return `${row.firstName} ${row.familyName}`.trim();
}

export function Couriers() {
  const resource = useResource(() => api.list(), []);
  const toast = useToast();
  const pending = usePending();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ApplicationStatus | 'all'>('pending');
  const [approving, setApproving] = useState<CourierApplication | null>(null);
  const [rejecting, setRejecting] = useState<CourierApplication | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const rows = resource.data ?? [];

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== 'all' && row.status !== filter) return false;
      if (!needle) return true;
      return [courierName(row), row.plateLetters, row.plateNumbers, row.carType]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [rows, search, filter]);

  const tally = (status: ApplicationStatus) => rows.filter((row) => row.status === status).length;

  function replace(next: CourierApplication) {
    resource.set(rows.map((row) => (row.id === next.id ? next : row)));
    pending.refresh();
  }

  async function approve() {
    if (!approving) return;
    setBusy(true);
    try {
      const result = await api.approve(approving.id);
      replace(result.application);
      toast.success(`اعتُمد المندوب ${courierName(approving)}.`);
      setApproving(null);
    } catch (caught) {
      toast.failure(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!rejecting) return;
    setBusy(true);
    try {
      const result = await api.reject(rejecting.id, reason.trim() || 'رفض إداري');
      replace(result.application);
      toast.success(`رُفض طلب ${courierName(rejecting)}.`);
      setRejecting(null);
      setReason('');
    } catch (caught) {
      toast.failure(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<CourierApplication>[] = [
    {
      key: 'name',
      header: 'المندوب',
      render: (row) => (
        <div>
          <p className="font-medium text-ink">{courierName(row)}</p>
          {/* The API masks the national id for non-admins; here it arrives whole. */}
          <p className="tabular text-xs text-ink-muted" dir="ltr">
            {row.nationalId}
          </p>
        </div>
      ),
    },
    {
      key: 'vehicle',
      header: 'المركبة',
      render: (row) => (
        <div>
          <p className="text-[13px] text-ink">{row.carType === 'أخرى' ? row.carTypeOther || 'أخرى' : row.carType}</p>
          <p className="tabular text-xs text-ink-muted">
            {row.plateLetters} · {row.plateNumbers}
          </p>
        </div>
      ),
    },
    {
      key: 'lanes',
      header: 'المسارات',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {(row.fulfillment || []).length
            ? row.fulfillment.map((lane) => <Badge key={lane}>{labelFor(FULFILLMENT_LABEL, lane)}</Badge>)
            : <span className="text-ink-muted">—</span>}
        </div>
      ),
    },
    {
      key: 'products',
      header: 'المنتجات',
      numeric: true,
      render: (row) => <span>{(row.products || []).length || '—'}</span>,
    },
    { key: 'created', header: 'التاريخ', render: (row) => <span className="text-[13px] text-ink-secondary">{dateTime(row.createdAt)}</span> },
    { key: 'status', header: 'الحالة', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        row.status === 'pending' ? (
          <div className="flex items-center justify-end gap-1">
            <Button variant="secondary" size="sm" onClick={() => setApproving(row)} icon={<Check size={15} />}>
              اعتماد
            </Button>
            <Button variant="danger" size="sm" onClick={() => setRejecting(row)} icon={<X size={15} />}>
              رفض
            </Button>
          </div>
        ) : row.rejectReason ? (
          <p className="text-end text-xs text-ink-muted">{row.rejectReason}</p>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="طلبات المناديب"
        subtitle="المندوب المعتمد يقدر يسجّل حجوزات خارجية باسمه."
        action={
          <Button size="sm" onClick={() => void resource.reload()} busy={resource.refreshing}>
            تحديث
          </Button>
        }
      />

      {resource.error ? <ErrorNote message={resource.error} onRetry={() => void resource.reload()} /> : null}

      <Card padded={false}>
        <Toolbar search={search} onSearch={setSearch} placeholder="ابحث بالاسم أو رقم اللوحة…">
          <FilterTabs
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'pending', label: 'قيد المراجعة', count: tally('pending') },
              { value: 'approved', label: 'معتمد', count: tally('approved') },
              { value: 'rejected', label: 'مرفوض', count: tally('rejected') },
              { value: 'all', label: 'الكل', count: rows.length },
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
              icon={<Truck size={22} />}
              title={filter === 'pending' ? 'لا توجد طلبات مناديب تنتظر' : 'لا نتائج'}
            />
          }
        />
      </Card>

      <ConfirmDialog
        open={Boolean(approving)}
        title="اعتماد المندوب؟"
        body={`سيصبح ${approving ? courierName(approving) : ''} مندوباً معتمداً، ويظهر في قائمة المناديب عند تسجيل الحجوزات الخارجية.`}
        confirmLabel="اعتماد"
        busy={busy}
        onConfirm={() => void approve()}
        onCancel={() => setApproving(null)}
      />

      <Modal
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title="رفض الطلب"
        description={`سيُسجَّل رفض طلب ${rejecting ? courierName(rejecting) : ''}.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejecting(null)} disabled={busy}>
              إلغاء
            </Button>
            <Button variant="danger" busy={busy} onClick={() => void reject()}>
              رفض الطلب
            </Button>
          </>
        }
      >
        <Field label="سبب الرفض">
          <Textarea
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="مثال: بيانات المركبة غير مكتملة."
          />
        </Field>
      </Modal>
    </>
  );
}
