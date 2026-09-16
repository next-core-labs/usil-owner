import { useMemo, useState } from 'react';
import { Building2, Check, CheckCircle2, CircleAlert, Eye, X } from 'lucide-react';
import { vendorApplications as api } from '../api/endpoints.ts';
import type { ApplicationStatus, VendorApplication } from '../api/types.ts';
import { errorText } from '../api/client.ts';
import { useResource } from '../lib/useResource.ts';
import { useToast } from '../state/ToastContext.tsx';
import { usePending } from '../state/PendingContext.tsx';
import { dateTime } from '../lib/format.ts';
import { APPLICATION_STATUS_LABEL, FULFILLMENT_LABEL, labelFor } from '../lib/labels.ts';
import { Badge, Button, Card, EmptyState, ErrorNote, Field, PageHeader, Textarea, type Tone } from '../components/ui/primitives.tsx';
import { DataTable, FilterTabs, Toolbar, type Column } from '../components/ui/Table.tsx';
import { ConfirmDialog, Modal } from '../components/ui/Modal.tsx';

const TONE: Record<ApplicationStatus, Tone> = {
  pending: 'warning',
  approved: 'good',
  rejected: 'critical',
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <Badge tone={TONE[status]} icon={status === 'approved' ? <CheckCircle2 size={13} /> : <CircleAlert size={13} />}>
      {APPLICATION_STATUS_LABEL[status]}
    </Badge>
  );
}

export function VendorApplications() {
  const resource = useResource(() => api.list(), []);
  const toast = useToast();
  const pending = usePending();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ApplicationStatus | 'all'>('pending');
  const [detail, setDetail] = useState<VendorApplication | null>(null);
  const [approving, setApproving] = useState<VendorApplication | null>(null);
  const [rejecting, setRejecting] = useState<VendorApplication | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const rows = resource.data ?? [];

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== 'all' && row.status !== filter) return false;
      if (!needle) return true;
      return [row.projectName, row.firstName, row.familyName, row.email, row.phone]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [rows, search, filter]);

  const tally = (status: ApplicationStatus) => rows.filter((row) => row.status === status).length;

  function replace(next: VendorApplication) {
    resource.set(rows.map((row) => (row.id === next.id ? next : row)));
    pending.refresh();
  }

  async function approve() {
    if (!approving) return;
    setBusy(true);
    try {
      const result = await api.approve(approving.id);
      replace(result.application);
      toast.success(`اعتُمد ${approving.projectName}، وأُنشئ حساب المورّد ومساحة عمله.`);
      setApproving(null);
      setDetail(null);
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
      toast.success(`رُفض طلب ${rejecting.projectName}.`);
      setRejecting(null);
      setReason('');
      setDetail(null);
    } catch (caught) {
      toast.failure(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<VendorApplication>[] = [
    {
      key: 'project',
      header: 'المشروع',
      render: (row) => (
        <div className="flex items-center gap-3">
          {row.logoUrl ? (
            <img src={row.logoUrl} alt="" className="size-9 shrink-0 rounded-lg object-cover" />
          ) : (
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sunken text-ink-muted">
              <Building2 size={16} />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{row.projectName}</p>
            <p className="truncate text-xs text-ink-muted">
              {`${row.firstName} ${row.familyName}`.trim()}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'التواصل',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] text-ink" dir="ltr">
            {row.email}
          </p>
          <p className="tabular text-xs text-ink-muted" dir="ltr">
            {row.phone}
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
            ? row.fulfillment.map((lane) => (
                <Badge key={lane}>{labelFor(FULFILLMENT_LABEL, lane)}</Badge>
              ))
            : <span className="text-ink-muted">—</span>}
        </div>
      ),
    },
    { key: 'created', header: 'التاريخ', render: (row) => <span className="text-[13px] text-ink-secondary">{dateTime(row.createdAt)}</span> },
    { key: 'status', header: 'الحالة', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" aria-label="عرض التفاصيل" title="تفاصيل" onClick={() => setDetail(row)} icon={<Eye size={15} />} />
          {row.status === 'pending' ? (
            <>
              <Button variant="secondary" size="sm" onClick={() => setApproving(row)} icon={<Check size={15} />}>
                اعتماد
              </Button>
              <Button variant="danger" size="sm" onClick={() => setRejecting(row)} icon={<X size={15} />}>
                رفض
              </Button>
            </>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="طلبات المورّدين"
        subtitle="اعتماد الطلب ينشئ حساب المورّد ومساحة عمله وينشر منتجه في السوق."
        action={
          <Button size="sm" onClick={() => void resource.reload()} busy={resource.refreshing}>
            تحديث
          </Button>
        }
      />

      {resource.error ? <ErrorNote message={resource.error} onRetry={() => void resource.reload()} /> : null}

      <Card padded={false}>
        <Toolbar search={search} onSearch={setSearch} placeholder="ابحث باسم المشروع أو البريد…">
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
              icon={<Building2 size={22} />}
              title={filter === 'pending' ? 'لا توجد طلبات تنتظر المراجعة' : 'لا نتائج'}
              body={filter === 'pending' ? 'كل طلبات المورّدين مراجَعة.' : 'جرّب مرشّحاً آخر.'}
            />
          }
        />
      </Card>

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.projectName || ''}
        description="بيانات الطلب كما أرسلها المورّد."
      >
        {detail ? (
          <dl className="space-y-3 text-sm">
            {[
              ['مقدّم الطلب', `${detail.firstName} ${detail.fatherName} ${detail.familyName}`.trim()],
              ['نوع النشاط', detail.projectType],
              ['البريد', detail.email],
              ['الجوال', detail.phone],
              ['السجل التجاري', detail.commercialRegister || '—'],
              ['الهوية الوطنية', detail.nationalId],
              ['البنك', detail.bankName],
              ['الآيبان', detail.iban],
              ['اسم صاحب الحساب', detail.accountHolderName],
              ['تاريخ الطلب', dateTime(detail.createdAt)],
              detail.reviewedBy ? ['روجع بواسطة', `${detail.reviewedBy} — ${dateTime(detail.reviewedAt)}`] : null,
              detail.rejectReason ? ['سبب الرفض', detail.rejectReason] : null,
            ]
              .filter((entry): entry is [string, string] => Array.isArray(entry))
              .map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-4 border-b border-line pb-2 last:border-0">
                  <dt className="shrink-0 text-ink-secondary">{label}</dt>
                  <dd className="text-end text-ink" dir={/[A-Za-z0-9@]/.test(value) && !/[؀-ۿ]/.test(value) ? 'ltr' : 'rtl'}>
                    {value}
                  </dd>
                </div>
              ))}
          </dl>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(approving)}
        title="اعتماد المورّد؟"
        body={`سيُنشأ حساب مورّد لـ ${approving?.projectName ?? ''} بالبريد ${approving?.email ?? ''}، وتُفتح مساحة عمله، ويظهر منتجه في السوق للعملاء.`}
        confirmLabel="اعتماد"
        busy={busy}
        onConfirm={() => void approve()}
        onCancel={() => setApproving(null)}
      />

      <Modal
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title="رفض الطلب"
        description={`سيُبلَّغ ${rejecting?.projectName ?? ''} بأن طلبه مرفوض، ولن يتمكن من الدخول.`}
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
        <Field label="سبب الرفض" hint="يُحفظ مع الطلب في سجل المراجعة.">
          <Textarea
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="مثال: السجل التجاري غير مطابق لاسم المشروع."
          />
        </Field>
      </Modal>
    </>
  );
}
