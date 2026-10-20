import { useMemo, useState } from 'react';
import { BadgeCheck, Banknote, Check, Copy, Info, X } from 'lucide-react';
import { payouts as api } from '../api/endpoints.ts';
import type { PayoutRequest, PayoutStatus } from '../api/types.ts';
import { errorText } from '../api/client.ts';
import { useResource } from '../lib/useResource.ts';
import { usePoll } from '../lib/usePoll.ts';
import { useToast } from '../state/ToastContext.tsx';
import { dateTime } from '../lib/format.ts';
import { Badge, Button, Card, EmptyState, ErrorNote, Field, Input, PageHeader, Textarea, type Tone } from '../components/ui/primitives.tsx';
import { DataTable, FilterTabs, Toolbar, type Column } from '../components/ui/Table.tsx';
import { Modal } from '../components/ui/Modal.tsx';

const STATUS_LABEL: Record<PayoutStatus, string> = {
  requested: 'بانتظار المراجعة',
  approved: 'معتمد — بانتظار التحويل',
  paid: 'تم التحويل',
  rejected: 'مرفوض',
};

const STATUS_TONE: Record<PayoutStatus, Tone> = {
  requested: 'warning',
  approved: 'accent',
  paid: 'good',
  rejected: 'critical',
};

type Filter = PayoutStatus | 'all';
type Decision = 'approved' | 'paid' | 'rejected';

/** Riyals with halalas — the shared `sar()` rounds to whole riyals. */
const exact = new Intl.NumberFormat('ar-SA-u-nu-latn', {
  style: 'currency',
  currency: 'SAR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const money = (value: number) => exact.format(Number.isFinite(value) ? value : 0);

/** `SA03 8000 0000 …` — groups of four, as a bank form shows it. */
const groupIban = (iban: string) => String(iban || '').replace(/(.{4})/g, '$1 ').trim();

const DECISION: Record<Decision, { title: string; body: (row: PayoutRequest) => string; label: string; danger: boolean }> = {
  approved: {
    title: 'اعتماد طلب السحب',
    body: (row) =>
      `بتعتمد سحب ${money(row.amount)} لـ«${row.vendorName}». الاعتماد لا يحوّل شيئاً: حوّل المبلغ يدوياً من البنك ثم سجّله «تم التحويل» برقم المرجع. يصل المورّد بريد بالاعتماد.`,
    label: 'اعتماد',
    danger: false,
  },
  paid: {
    title: 'تسجيل التحويل',
    body: (row) =>
      `سجّل هذا فقط بعد ما تحوّل ${money(row.amount)} فعلاً من البنك إلى آيبان «${row.vendorName}». يصل المورّد بريد برقم المرجع، ولا يمكن التراجع.`,
    label: 'تم التحويل',
    danger: false,
  },
  rejected: {
    title: 'رفض طلب السحب',
    body: (row) =>
      `بترفض طلب «${row.vendorName}» بمبلغ ${money(row.amount)}. يرجع المبلغ إلى رصيده المتاح، ويصله بريد بالرفض وسببه.`,
    label: 'رفض الطلب',
    danger: true,
  },
};

/**
 * طلبات السحب — vendors ask for their available balance (completed orders
 * minus Usil's 15%). Approving does not move money: the owner transfers by
 * hand in the bank, then marks the request paid with the transfer reference.
 */
export function Payouts() {
  const resource = useResource(() => api.list(), []);
  usePoll(() => void resource.reload(), 120_000);
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('requested');
  const [acting, setActing] = useState<{ row: PayoutRequest; decision: Decision } | null>(null);
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => resource.data ?? [], [resource.data]);
  const tally = (status: PayoutStatus) => rows.filter((row) => row.status === status).length;

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== 'all' && row.status !== filter) return false;
      if (!needle) return true;
      return [row.id, row.vendorName, row.vendorEmail, row.iban, row.accountHolder, row.bankName, row.reference]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [rows, search, filter]);

  function open(row: PayoutRequest, decision: Decision) {
    setReference('');
    setNote(row.adminNote || '');
    setActing({ row, decision });
  }

  async function copy(value: string, what: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`نُسخ ${what}.`);
    } catch {
      toast.failure('المتصفح منع النسخ. انسخه يدوياً.');
    }
  }

  async function decide() {
    if (!acting) return;
    const { row, decision } = acting;
    if (decision === 'paid' && !reference.trim()) {
      toast.failure('اكتب رقم مرجع التحويل البنكي.');
      return;
    }
    setBusy(true);
    try {
      const saved = await api.decide(row.id, {
        status: decision,
        ...(decision === 'paid' ? { reference: reference.trim() } : {}),
        adminNote: note.trim(),
      });
      resource.set((current) => (current ?? []).map((item) => (item.id === saved.id ? { ...item, ...saved } : item)));
      toast.success(
        decision === 'approved'
          ? `اعتُمد طلب ${row.vendorName}. حوّل المبلغ من البنك ثم سجّله.`
          : decision === 'paid'
            ? `سُجّل تحويل ${money(row.amount)} لـ${row.vendorName}.`
            : `رُفض طلب ${row.vendorName}.`,
      );
      setActing(null);
    } catch (caught) {
      toast.failure(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<PayoutRequest>[] = [
    {
      key: 'vendor',
      header: 'المورّد',
      render: (row) => (
        <div className="min-w-0">
          <p className="font-medium text-ink">{row.vendorName || '—'}</p>
          <p className="text-xs text-ink-muted">{row.vendorEmail || row.id}</p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'المبلغ',
      numeric: true,
      render: (row) => <span className="font-semibold text-ink">{money(row.amount)}</span>,
    },
    {
      key: 'bank',
      header: 'الحساب البنكي',
      render: (row) => (
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-1">
            <span dir="ltr" className="tabular text-[13px] text-ink">
              {groupIban(row.iban)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="!h-7 !px-1.5"
              aria-label="نسخ الآيبان"
              title="نسخ الآيبان"
              icon={<Copy size={14} />}
              onClick={() => void copy(row.iban, 'الآيبان')}
            />
          </div>
          <p className="text-xs text-ink-muted">
            {row.accountHolder} · {row.bankName}
          </p>
        </div>
      ),
    },
    {
      key: 'created',
      header: 'التاريخ',
      render: (row) => <span className="text-[13px] text-ink-secondary">{dateTime(row.createdAt)}</span>,
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (row) => (
        <div className="space-y-1">
          <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
          {row.reference ? (
            <p className="text-xs text-ink-muted">
              مرجع: <span dir="ltr" className="tabular">{row.reference}</span>
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'notes',
      header: 'ملاحظات',
      render: (row) =>
        row.note || row.adminNote ? (
          <div className="max-w-[240px] space-y-0.5 text-xs leading-5">
            {row.note ? <p className="text-ink-secondary">المورّد: {row.note}</p> : null}
            {row.adminNote ? <p className="text-ink-muted">الإدارة: {row.adminNote}</p> : null}
          </div>
        ) : (
          <span className="text-ink-muted">—</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        row.status === 'requested' ? (
          <div className="flex items-center justify-end gap-1">
            <Button variant="secondary" size="sm" icon={<Check size={15} />} onClick={() => open(row, 'approved')}>
              اعتماد
            </Button>
            <Button variant="danger" size="sm" icon={<X size={15} />} onClick={() => open(row, 'rejected')}>
              رفض
            </Button>
          </div>
        ) : row.status === 'approved' ? (
          <div className="flex items-center justify-end gap-1">
            <Button variant="primary" size="sm" icon={<BadgeCheck size={15} />} onClick={() => open(row, 'paid')}>
              تم التحويل
            </Button>
            <Button variant="danger" size="sm" icon={<X size={15} />} onClick={() => open(row, 'rejected')}>
              رفض
            </Button>
          </div>
        ) : row.decidedBy ? (
          <p className="text-end text-xs text-ink-muted">بواسطة {row.decidedBy}</p>
        ) : null,
    },
  ];

  const config = acting ? DECISION[acting.decision] : null;

  return (
    <>
      <PageHeader
        title="طلبات السحب"
        subtitle="سحب أرباح المورّدين من طلباتهم المكتملة بعد عمولة يوصل."
        action={
          <Button size="sm" onClick={() => void resource.reload()} busy={resource.refreshing}>
            تحديث
          </Button>
        }
      />

      <p className="flex items-start gap-2 rounded-lg border border-line bg-sunken px-4 py-3 text-[13px] leading-6 text-ink-secondary">
        <Info size={15} className="mt-1 shrink-0" aria-hidden />
        لا يتحرّك أي مبلغ تلقائياً من هنا. اعتمد الطلب، حوّل المبلغ يدوياً من حساب يوصل البنكي إلى آيبان المورّد، ثم
        سجّله «تم التحويل» مع رقم مرجع التحويل.
      </p>

      {resource.error ? <ErrorNote message={resource.error} onRetry={() => void resource.reload()} /> : null}

      <Card padded={false}>
        <Toolbar search={search} onSearch={setSearch} placeholder="ابحث بالمورّد أو الآيبان أو المرجع…">
          <FilterTabs
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'requested', label: 'بانتظار المراجعة', count: tally('requested') },
              { value: 'approved', label: 'بانتظار التحويل', count: tally('approved') },
              { value: 'paid', label: 'محوّلة', count: tally('paid') },
              { value: 'rejected', label: 'مرفوضة', count: tally('rejected') },
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
              icon={<Banknote size={22} />}
              title={filter === 'requested' ? 'لا توجد طلبات سحب تنتظر' : 'لا نتائج'}
            />
          }
        />
      </Card>

      <Modal
        open={Boolean(acting)}
        onClose={() => (busy ? undefined : setActing(null))}
        title={config?.title || ''}
        description={acting && config ? config.body(acting.row) : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setActing(null)} disabled={busy}>
              إلغاء
            </Button>
            <Button
              variant={config?.danger ? 'danger' : 'primary'}
              busy={busy}
              disabled={acting?.decision === 'paid' && !reference.trim()}
              onClick={() => void decide()}
            >
              {config?.label}
            </Button>
          </>
        }
      >
        {acting ? (
          <>
            <div className="rounded-lg border border-line bg-sunken/60 p-3 text-[13px] leading-6">
              <p>
                <span className="text-ink-muted">المبلغ: </span>
                <span className="font-semibold">{money(acting.row.amount)}</span>
              </p>
              <p className="flex flex-wrap items-center gap-1">
                <span className="text-ink-muted">الآيبان: </span>
                <span dir="ltr" className="tabular">
                  {groupIban(acting.row.iban)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="!h-7 !px-1.5"
                  aria-label="نسخ الآيبان"
                  icon={<Copy size={14} />}
                  onClick={() => void copy(acting.row.iban, 'الآيبان')}
                />
              </p>
              <p>
                <span className="text-ink-muted">صاحب الحساب: </span>
                {acting.row.accountHolder} · {acting.row.bankName}
              </p>
            </div>
            {acting.decision === 'paid' ? (
              <Field label="رقم مرجع التحويل البنكي" hint="كما يظهر في إيصال التحويل — يصل للمورّد.">
                <Input dir="ltr" className="tabular text-end" value={reference} onChange={(event) => setReference(event.target.value)} />
              </Field>
            ) : null}
            <Field label={acting.decision === 'rejected' ? 'سبب الرفض (يصل للمورّد)' : 'ملاحظة للمورّد (اختياري)'}>
              <Textarea rows={2} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
            </Field>
          </>
        ) : null}
      </Modal>
    </>
  );
}
