import { useEffect, useMemo, useState } from 'react';
import { ImageOff, Package, Pencil } from 'lucide-react';
import { listings as api } from '../api/endpoints.ts';
import type { VendorListing } from '../api/types.ts';
import { errorText } from '../api/client.ts';
import { useResource } from '../lib/useResource.ts';
import { useToast } from '../state/ToastContext.tsx';
import { count, sar } from '../lib/format.ts';
import { BOOKING_MODE_LABEL, CATEGORY_LABEL, FULFILLMENT_LABEL, labelFor } from '../lib/labels.ts';
import { Badge, Button, Card, EmptyState, ErrorNote, Field, Input, PageHeader, Select } from '../components/ui/primitives.tsx';
import { DataTable, Toolbar, type Column } from '../components/ui/Table.tsx';
import { Modal } from '../components/ui/Modal.tsx';

const LANES = ['hour', 'same_day', 'tomorrow', 'instant'];

type Draft = { price: string; bookingMode: 'instant' | 'approval'; fulfillment: string[] };

export function Listings() {
  const resource = useResource(() => api.list(), []);
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<VendorListing | null>(null);
  const [draft, setDraft] = useState<Draft>({ price: '', bookingMode: 'approval', fulfillment: [] });
  const [busy, setBusy] = useState(false);

  const rows = resource.data ?? [];

  // Reset the draft whenever a different listing opens.
  useEffect(() => {
    if (!editing) return;
    setDraft({
      price: String(editing.price ?? ''),
      bookingMode: editing.bookingMode === 'instant' ? 'instant' : 'approval',
      fulfillment: [...(editing.fulfillment || [])],
    });
  }, [editing]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.title, row.vendorName, row.category, (row.cities || []).join(' ')]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [rows, search]);

  async function save() {
    if (!editing) return;
    const price = Number(draft.price);
    if (!Number.isFinite(price) || price <= 0) {
      toast.failure('أدخل سعراً أكبر من صفر.');
      return;
    }
    if (!draft.fulfillment.length) {
      toast.failure('اختر مساراً واحداً على الأقل في «مسار يوصل».');
      return;
    }
    setBusy(true);
    try {
      const result = await api.update(editing.id, {
        price,
        bookingMode: draft.bookingMode,
        fulfillment: draft.fulfillment,
      });
      resource.set(rows.map((row) => (row.id === editing.id ? result.listing : row)));
      toast.success(`حُدّث «${editing.title}».`);
      setEditing(null);
    } catch (caught) {
      toast.failure(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  function toggleLane(lane: string) {
    setDraft((current) => ({
      ...current,
      fulfillment: current.fulfillment.includes(lane)
        ? current.fulfillment.filter((item) => item !== lane)
        : [...current.fulfillment, lane],
    }));
  }

  const columns: Column<VendorListing>[] = [
    {
      key: 'title',
      header: 'المنتج',
      render: (row) => (
        <div className="flex items-center gap-3">
          {row.images?.[0] ? (
            <img src={row.images[0]} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
          ) : (
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-sunken text-ink-muted">
              <ImageOff size={16} />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{row.title}</p>
            <p className="truncate text-xs text-ink-muted">{row.vendorName || '—'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'القسم',
      render: (row) => <span className="text-[13px] text-ink-secondary">{labelFor(CATEGORY_LABEL, row.category)}</span>,
    },
    {
      key: 'price',
      header: 'السعر',
      numeric: true,
      render: (row) => (
        <div>
          <p className="font-medium text-ink">{sar(row.price)}</p>
          <p className="text-xs text-ink-muted">{row.priceUnit}</p>
        </div>
      ),
    },
    {
      key: 'cities',
      header: 'المدن',
      render: (row) => (
        <span className="text-[13px] text-ink-secondary">
          {(row.cities || []).slice(0, 2).join('، ') || '—'}
          {(row.cities || []).length > 2 ? ` +${row.cities.length - 2}` : ''}
        </span>
      ),
    },
    {
      key: 'lanes',
      header: 'المسارات',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {(row.fulfillment || []).map((lane) => (
            <Badge key={lane}>{labelFor(FULFILLMENT_LABEL, lane)}</Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'mode',
      header: 'التأكيد',
      render: (row) => (
        <Badge tone={row.bookingMode === 'instant' ? 'accent' : 'neutral'}>
          {labelFor(BOOKING_MODE_LABEL, row.bookingMode)}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" aria-label={`تعديل ${row.title}`} title="تعديل" onClick={() => setEditing(row)} icon={<Pencil size={15} />} />
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="المنتجات"
        subtitle="كل منتجات المورّدين في السوق. التعديل هنا يطبّق مباشرة على ما يراه العميل."
        action={
          <Button size="sm" onClick={() => void resource.reload()} busy={resource.refreshing}>
            تحديث
          </Button>
        }
      />

      {resource.error ? <ErrorNote message={resource.error} onRetry={() => void resource.reload()} /> : null}

      <Card padded={false}>
        <Toolbar search={search} onSearch={setSearch} placeholder="ابحث باسم المنتج أو المورّد أو المدينة…" />
        <DataTable
          columns={columns}
          rows={visible}
          rowKey={(row) => row.id}
          loading={resource.loading}
          empty={<EmptyState icon={<Package size={22} />} title={rows.length ? 'لا نتائج مطابقة' : 'لا توجد منتجات بعد'} />}
        />
        {visible.length ? (
          <p className="border-t border-line px-4 py-3 text-xs text-ink-muted">
            {count(visible.length)} من {count(rows.length)} منتج
          </p>
        ) : null}
      </Card>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.title || ''}
        description="السعر ومسار التوصيل وطريقة تأكيد الحجز."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={busy}>
              إلغاء
            </Button>
            <Button variant="primary" busy={busy} onClick={() => void save()}>
              حفظ
            </Button>
          </>
        }
      >
        <Field label="السعر" hint={`الوحدة: ${editing?.priceUnit || '—'}`}>
          <Input
            type="number"
            min={1}
            value={draft.price}
            onChange={(event) => setDraft((current) => ({ ...current, price: event.target.value }))}
          />
        </Field>

        <Field label="طريقة تأكيد الحجز" hint="«حجز فوري» يؤكّد للعميل مباشرة دون انتظار المورّد.">
          <Select
            value={draft.bookingMode}
            onChange={(event) =>
              setDraft((current) => ({ ...current, bookingMode: event.target.value as 'instant' | 'approval' }))
            }
          >
            <option value="approval">بموافقة المورّد</option>
            <option value="instant">حجز فوري</option>
          </Select>
        </Field>

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-ink-secondary">مسار يوصل</legend>
          <div className="flex flex-wrap gap-2">
            {LANES.map((lane) => {
              const on = draft.fulfillment.includes(lane);
              return (
                <button
                  key={lane}
                  type="button"
                  onClick={() => toggleLane(lane)}
                  aria-pressed={on}
                  className={`rounded-lg border px-3 py-1.5 text-[13px] transition-colors ${
                    on
                      ? 'border-accent bg-[var(--accent-wash)] font-medium text-accent'
                      : 'border-line-strong text-ink-secondary hover:bg-sunken'
                  }`}
                >
                  {labelFor(FULFILLMENT_LABEL, lane)}
                </button>
              );
            })}
          </div>
        </fieldset>
      </Modal>
    </>
  );
}
