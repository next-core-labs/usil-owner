import { useMemo, useRef, useState } from 'react';
import { Contact, Download, FileSpreadsheet, MessageCircle, Plus, Trash2, Upload } from 'lucide-react';
import { vendorLeads as api } from '../api/endpoints.ts';
import type { LeadDraft, LeadImportResult, LeadStatus, VendorLead } from '../api/types.ts';
import { errorText } from '../api/client.ts';
import { useResource } from '../lib/useResource.ts';
import { useToast } from '../state/ToastContext.tsx';
import { count } from '../lib/format.ts';
import { LEAD_STATUSES, LEAD_STATUS_LABEL } from '../lib/labels.ts';
import { whatsappChatUrl } from '../lib/whatsapp.ts';
import {
  detectColumns,
  looksLikePhone,
  readSpreadsheet,
  rowsToLeads,
  type ColumnMap,
  type LeadField,
} from '../lib/sheet.ts';
import { Badge, Button, Card, EmptyState, ErrorNote, Field, Input, PageHeader, Select } from '../components/ui/primitives.tsx';
import { DataTable, FilterTabs, Toolbar, type Column } from '../components/ui/Table.tsx';
import { ConfirmDialog, Modal } from '../components/ui/Modal.tsx';

const VENDOR_SIGNUP_URL = 'https://vendor.usil.app';
const TEMPLATE_CSV = 'الاسم,الجوال,المدينة,النشاط,ملاحظة\r\nقهوة المثال,0501234567,الرياض,ضيافة وقهوة,\r\n';

const FIELD_LABEL: Record<LeadField, string> = {
  phone: 'الجوال',
  name: 'الاسم',
  city: 'المدينة',
  activity: 'النشاط',
  note: 'ملاحظة',
};
const FIELDS: LeadField[] = ['phone', 'name', 'city', 'activity', 'note'];

function inviteText(lead: VendorLead): string {
  const hello = lead.name ? `السلام عليكم ${lead.name}،` : 'السلام عليكم،';
  return `${hello} معك فريق يوصل — منصة لحجز خدمات وتجهيزات المناسبات في السعودية. نحب نضمّك كمورّد في يوصل ونوصلك بعملاء أكثر. التسجيل مجاني وسريع: ${VENDOR_SIGNUP_URL}`;
}

function columnName(index: number): string {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function downloadTemplate() {
  // BOM so Excel opens the Arabic headings correctly.
  const blob = new Blob(['﻿' + TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'نموذج-أرقام-المورّدين.csv';
  link.click();
  URL.revokeObjectURL(url);
}

type Preview = { fileName: string; rows: string[][]; map: ColumnMap; headerRow: boolean };

/**
 * أرقام المورّدين — suppliers the owner wants on Usil. Import a sheet of
 * numbers, then invite each one over WhatsApp and track where they stand.
 * A lead is a contact, not an account: nothing here creates a login.
 */
export function VendorLeads() {
  const resource = useResource(() => api.list(), []);
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<LeadStatus | 'all'>('all');
  const [saving, setSaving] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<LeadImportResult | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<LeadDraft>({ phone: '' });
  const [addBusy, setAddBusy] = useState(false);
  const [removing, setRemoving] = useState<VendorLead | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  const rows = resource.data ?? [];

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== 'all' && row.status !== filter) return false;
      if (!needle) return true;
      return [row.name, row.phone, row.city, row.activity, row.note].join(' ').toLowerCase().includes(needle);
    });
  }, [rows, search, filter]);

  /* ── import ── */

  async function pickFile(file: File | undefined) {
    if (!file) return;
    setReading(true);
    setResult(null);
    try {
      const sheet = await readSpreadsheet(file);
      if (!sheet.some((row) => row.some((cell) => cell.trim()))) throw new Error('الملف فاضي.');
      const { map, headerRow } = detectColumns(sheet);
      setPreview({ fileName: file.name, rows: sheet, map, headerRow });
    } catch (caught) {
      toast.failure(errorText(caught));
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const previewLeads = useMemo(
    () => (preview ? rowsToLeads(preview.rows, preview.map, preview.headerRow) : []),
    [preview],
  );
  const validCount = previewLeads.filter((lead) => looksLikePhone(lead.phone)).length;
  const columnOptions = useMemo(() => {
    if (!preview) return [];
    const width = Math.max(0, ...preview.rows.slice(0, 50).map((row) => row.length));
    const header = preview.headerRow ? preview.rows.find((row) => row.some((cell) => cell.trim())) || [] : [];
    return Array.from({ length: width }, (_, index) => ({
      index,
      label: header[index] ? `${columnName(index)} — ${header[index]}` : `العمود ${columnName(index)}`,
    }));
  }, [preview]);

  async function runImport() {
    if (!preview) return;
    setImporting(true);
    try {
      const outcome = await api.importRows(previewLeads);
      setResult(outcome);
      setPreview(null);
      await resource.reload();
      toast.success(
        `أُضيف ${count(outcome.added)} رقم` +
          (outcome.duplicates ? ` · ${count(outcome.duplicates)} مكرر` : '') +
          (outcome.invalid.length ? ` · ${count(outcome.invalid.length)} غير صالح` : ''),
      );
    } catch (caught) {
      toast.failure(errorText(caught));
    } finally {
      setImporting(false);
    }
  }

  /* ── single lead actions ── */

  async function addOne() {
    setAddBusy(true);
    try {
      const lead = await api.add(draft);
      resource.set((current) => [{ ...lead, alreadyVendor: false }, ...(current ?? [])]);
      toast.success('أُضيف الرقم.');
      setAdding(false);
      setDraft({ phone: '' });
    } catch (caught) {
      toast.failure(errorText(caught));
    } finally {
      setAddBusy(false);
    }
  }

  async function update(row: VendorLead, patch: { status?: LeadStatus; note?: string }, quiet = false) {
    setSaving(row.id);
    try {
      const saved = await api.update(row.id, patch);
      resource.set((current) => (current ?? []).map((item) => (item.id === row.id ? { ...item, ...saved } : item)));
      if (!quiet) toast.success('حُدّث الرقم.');
    } catch (caught) {
      toast.failure(errorText(caught));
    } finally {
      setSaving(null);
    }
  }

  async function remove() {
    if (!removing) return;
    setRemoveBusy(true);
    try {
      await api.remove(removing.id);
      resource.set((current) => (current ?? []).filter((item) => item.id !== removing.id));
      toast.success('حُذف الرقم من القائمة.');
      setRemoving(null);
    } catch (caught) {
      toast.failure(errorText(caught));
    } finally {
      setRemoveBusy(false);
    }
  }

  const columns: Column<VendorLead>[] = [
    {
      key: 'lead',
      header: 'المورّد',
      render: (row) => (
        <div>
          <p className="font-medium text-ink">{row.name || '—'}</p>
          {row.activity ? <p className="text-xs text-ink-muted">{row.activity}</p> : null}
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'الجوال',
      render: (row) => (
        <div className="space-y-1">
          <p className="tabular text-[13px] text-ink" dir="ltr">
            {row.phone}
          </p>
          {row.alreadyVendor ? <Badge tone="good">مسجّل في يوصل</Badge> : null}
        </div>
      ),
    },
    { key: 'city', header: 'المدينة', render: (row) => <span className="text-[13px] text-ink-secondary">{row.city || '—'}</span> },
    {
      key: 'note',
      header: 'ملاحظة',
      render: (row) => (
        <p className="max-w-[220px] truncate text-[13px] text-ink-secondary" title={row.note}>
          {row.note || '—'}
        </p>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      width: '150px',
      render: (row) => (
        <Select
          value={row.status}
          disabled={saving === row.id}
          onChange={(event) => void update(row, { status: event.target.value as LeadStatus })}
          className="h-8 text-[13px]"
          aria-label={`حالة ${row.name || row.phone}`}
        >
          {LEAD_STATUSES.map((status) => (
            <option key={status} value={status}>
              {LEAD_STATUS_LABEL[status]}
            </option>
          ))}
        </Select>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '200px',
      render: (row) => {
        const wa = whatsappChatUrl(row.phone, inviteText(row));
        return (
          <div className="flex items-center gap-1.5">
            {wa ? (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                // Inviting moves a new lead to «تم التواصل»; any later status is the owner's call.
                onClick={() => (row.status === 'new' ? void update(row, { status: 'contacted' }, true) : undefined)}
                className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-line-strong px-2.5 text-[13px] font-medium text-ink hover:bg-sunken"
              >
                <MessageCircle size={14} />
                دعوة واتساب
              </a>
            ) : null}
            <Button size="sm" variant="ghost" aria-label={`حذف ${row.name || row.phone}`} onClick={() => setRemoving(row)}>
              <Trash2 size={14} />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="أرقام المورّدين"
        subtitle="ارفع ملف إكسل بأرقام مورّدين محتملين، وادعهم واتساب ينضمون ليوصل. هذي قائمة تواصل — ما تنشئ حسابات."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="ghost" icon={<Download size={15} />} onClick={downloadTemplate}>
              تنزيل نموذج
            </Button>
            <Button size="sm" icon={<Plus size={15} />} onClick={() => setAdding(true)}>
              إضافة رقم
            </Button>
            <Button size="sm" variant="primary" icon={<Upload size={15} />} busy={reading} onClick={() => fileRef.current?.click()}>
              استيراد ملف إكسل
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              className="hidden"
              onChange={(event) => void pickFile(event.target.files?.[0])}
            />
          </div>
        }
      />

      {resource.error ? <ErrorNote message={resource.error} onRetry={() => void resource.reload()} /> : null}

      {result && result.invalid.length ? (
        <Card>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink">صفوف ما انضافت ({count(result.invalid.length)})</h2>
            <Button size="sm" variant="ghost" onClick={() => setResult(null)}>
              إخفاء
            </Button>
          </div>
          <ul className="max-h-48 space-y-1 overflow-y-auto text-[13px] text-ink-secondary">
            {result.invalid.slice(0, 50).map((row) => (
              <li key={row.row}>
                صف {count(row.row)}: <span dir="ltr">{row.phone || '—'}</span> — {row.error}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card padded={false}>
        <Toolbar search={search} onSearch={setSearch} placeholder="ابحث بالاسم أو الجوال أو المدينة…">
          <FilterTabs
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'الكل', count: rows.length },
              ...LEAD_STATUSES.map((status) => ({
                value: status,
                label: LEAD_STATUS_LABEL[status],
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
              icon={<Contact size={22} />}
              title={rows.length ? 'لا نتائج مطابقة' : 'ما فيه أرقام بعد'}
              body={
                rows.length
                  ? undefined
                  : 'ارفع ملف إكسل فيه عمود للجوال (والاسم والمدينة إن وجدت)، أو نزّل النموذج واملأه.'
              }
            />
          }
        />
      </Card>

      {/* Import preview: confirm what was read before anything is saved. */}
      <Modal
        open={Boolean(preview)}
        onClose={() => (importing ? undefined : setPreview(null))}
        title="معاينة الملف قبل الاستيراد"
        description={preview ? `${preview.fileName} — ${count(previewLeads.length)} صف، منها ${count(validCount)} رقم جوال صالح.` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPreview(null)} disabled={importing}>
              إلغاء
            </Button>
            <Button
              variant="primary"
              icon={<FileSpreadsheet size={15} />}
              busy={importing}
              disabled={!validCount || preview?.map.phone === undefined}
              onClick={() => void runImport()}
            >
              استيراد {count(validCount)} رقم
            </Button>
          </>
        }
      >
        {preview ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {FIELDS.map((field) => (
                <Field key={field} label={field === 'phone' ? `${FIELD_LABEL[field]} *` : FIELD_LABEL[field]}>
                  <Select
                    value={preview.map[field] === undefined ? '' : String(preview.map[field])}
                    onChange={(event) =>
                      setPreview((current) =>
                        current
                          ? {
                              ...current,
                              map: { ...current.map, [field]: event.target.value === '' ? undefined : Number(event.target.value) },
                            }
                          : current,
                      )
                    }
                  >
                    <option value="">{field === 'phone' ? 'اختر عمود الجوال' : 'بدون'}</option>
                    {columnOptions.map((option) => (
                      <option key={option.index} value={option.index}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              ))}
            </div>
            <label className="flex items-center gap-2 text-[13px] text-ink-secondary">
              <input
                type="checkbox"
                checked={preview.headerRow}
                onChange={(event) => setPreview((current) => (current ? { ...current, headerRow: event.target.checked } : current))}
              />
              أول صف في الملف عناوين أعمدة (ما يُستورد)
            </label>
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-line bg-sunken">
                    {FIELDS.map((field) => (
                      <th key={field} className="px-3 py-2 text-start font-semibold text-ink-muted">
                        {FIELD_LABEL[field]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewLeads.slice(0, 6).map((lead, index) => (
                    <tr key={index} className="border-b border-line last:border-0">
                      {FIELDS.map((field) => (
                        <td
                          key={field}
                          className={`px-3 py-2 ${field === 'phone' && !looksLikePhone(lead.phone) ? 'text-[var(--critical)]' : 'text-ink'}`}
                          dir={field === 'phone' ? 'ltr' : undefined}
                        >
                          {lead[field] || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-ink-muted">
              الأرقام المكررة (الموجودة في القائمة أو المكررة داخل الملف) تُتجاهل تلقائياً. الصيغ المقبولة: ‎05xxxxxxxx أو ‎+9665xxxxxxxx.
            </p>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={adding}
        onClose={() => (addBusy ? undefined : setAdding(false))}
        title="إضافة رقم مورّد"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(false)} disabled={addBusy}>
              إلغاء
            </Button>
            <Button variant="primary" busy={addBusy} disabled={!draft.phone.trim()} onClick={() => void addOne()}>
              إضافة
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="الجوال *">
            <Input dir="ltr" inputMode="tel" placeholder="05xxxxxxxx" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
          </Field>
          <Field label="الاسم">
            <Input value={draft.name || ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
          <Field label="المدينة">
            <Input value={draft.city || ''} onChange={(e) => setDraft({ ...draft, city: e.target.value })} />
          </Field>
          <Field label="النشاط">
            <Input placeholder="قهوة، خيام، تصوير…" value={draft.activity || ''} onChange={(e) => setDraft({ ...draft, activity: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="ملاحظة">
              <Input value={draft.note || ''} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
            </Field>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(removing)}
        title="حذف الرقم"
        body={removing ? `بتحذف ${removing.name || removing.phone} من قائمة أرقام المورّدين.` : ''}
        confirmLabel="حذف"
        danger
        busy={removeBusy}
        onConfirm={() => void remove()}
        onCancel={() => setRemoving(null)}
      />
    </>
  );
}
