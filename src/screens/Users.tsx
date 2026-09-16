import { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, MailWarning, Pencil, Trash2, UserPlus, Users as UsersIcon } from 'lucide-react';
import { users as api } from '../api/endpoints.ts';
import type { AccountRole, PublicUser } from '../api/types.ts';
import { errorText } from '../api/client.ts';
import { useResource } from '../lib/useResource.ts';
import { useToast } from '../state/ToastContext.tsx';
import { useSession } from '../state/SessionContext.tsx';
import { count, initials } from '../lib/format.ts';
import { ROLE_LABEL, ROLE_OPTIONS } from '../lib/labels.ts';
import { Badge, Button, Card, EmptyState, ErrorNote, Field, Input, PageHeader, Select } from '../components/ui/primitives.tsx';
import { DataTable, FilterTabs, Toolbar, type Column } from '../components/ui/Table.tsx';
import { ConfirmDialog, Modal } from '../components/ui/Modal.tsx';

type Draft = { name: string; email: string; phone: string; password: string; role: AccountRole };

const EMPTY: Draft = { name: '', email: '', phone: '', password: '', role: 'client' };

export function Users() {
  const resource = useResource(() => api.list(), []);
  const toast = useToast();
  const { user: actor } = useSession();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<AccountRole | 'all'>('all');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PublicUser | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [removing, setRemoving] = useState<PublicUser | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = resource.data ?? [];

  useEffect(() => {
    if (creating) setDraft(EMPTY);
  }, [creating]);

  useEffect(() => {
    if (!editing) return;
    // Password stays blank on edit — sending it empty leaves it unchanged.
    setDraft({ name: editing.name, email: editing.email, phone: editing.phone, password: '', role: editing.role });
  }, [editing]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== 'all' && row.role !== filter) return false;
      if (!needle) return true;
      return [row.name, row.email, row.phone].join(' ').toLowerCase().includes(needle);
    });
  }, [rows, search, filter]);

  async function create() {
    setBusy(true);
    try {
      const result = await api.create({
        name: draft.name.trim(),
        email: draft.email.trim(),
        phone: draft.phone.trim(),
        password: draft.password,
        role: draft.role,
      });
      resource.set([...rows, result.user]);
      toast.success(`أُنشئ حساب ${result.user.name}.`);
      setCreating(false);
    } catch (caught) {
      toast.failure(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    try {
      const patch: Parameters<typeof api.update>[1] = {
        name: draft.name.trim(),
        email: draft.email.trim(),
        phone: draft.phone.trim(),
        role: draft.role,
      };
      if (draft.password) patch.password = draft.password;
      const result = await api.update(editing.id, patch);
      resource.set(rows.map((row) => (row.id === editing.id ? result.user : row)));
      toast.success(`حُدّث حساب ${result.user.name}.`);
      setEditing(null);
    } catch (caught) {
      toast.failure(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  async function verifyEmail(row: PublicUser) {
    try {
      const result = await api.update(row.id, { emailVerified: true });
      resource.set(rows.map((item) => (item.id === row.id ? result.user : item)));
      toast.success(`وُثّق بريد ${row.name}.`);
    } catch (caught) {
      toast.failure(errorText(caught));
    }
  }

  async function remove() {
    if (!removing) return;
    setBusy(true);
    try {
      await api.remove(removing.id);
      resource.set(rows.filter((row) => row.id !== removing.id));
      toast.success(`حُذف حساب ${removing.name}.`);
      setRemoving(null);
    } catch (caught) {
      toast.failure(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<PublicUser>[] = [
    {
      key: 'user',
      header: 'الحساب',
      render: (row) => (
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-sunken text-xs font-semibold text-ink-secondary">
            {row.avatarUrl ? <img src={row.avatarUrl} alt="" className="size-full object-cover" /> : initials(row.name)}
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate font-medium text-ink">
              {row.name}
              {row.id === actor?.id ? <Badge tone="accent">أنت</Badge> : null}
            </p>
            <p className="truncate text-xs text-ink-muted" dir="ltr">
              {row.email}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'الجوال',
      render: (row) => (
        <span className="tabular text-[13px] text-ink-secondary" dir="ltr">
          {row.phone}
        </span>
      ),
    },
    { key: 'role', header: 'الصلاحية', render: (row) => <Badge tone={row.role === 'admin' ? 'accent' : 'neutral'}>{ROLE_LABEL[row.role]}</Badge> },
    {
      key: 'verified',
      header: 'البريد',
      render: (row) =>
        row.emailVerified ? (
          <Badge tone="good" icon={<BadgeCheck size={13} />}>
            موثّق
          </Badge>
        ) : (
          <button
            type="button"
            onClick={() => void verifyEmail(row)}
            title="توثيق البريد يدوياً"
            className="cursor-pointer"
          >
            <Badge tone="warning" icon={<MailWarning size={13} />}>
              غير موثّق
            </Badge>
          </button>
        ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" aria-label={`تعديل ${row.name}`} title="تعديل" onClick={() => setEditing(row)} icon={<Pencil size={15} />} />
          <Button
            variant="ghost"
            size="sm"
            aria-label={`حذف ${row.name}`}
            title="حذف"
            disabled={row.id === actor?.id}
            onClick={() => setRemoving(row)}
            icon={<Trash2 size={15} />}
          />
        </div>
      ),
    },
  ];

  const form = (
    <>
      <Field label="الاسم">
        <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
      </Field>
      <Field label="البريد الإلكتروني">
        <Input
          type="email"
          dir="ltr"
          className="text-start"
          value={draft.email}
          onChange={(event) => setDraft({ ...draft, email: event.target.value })}
        />
      </Field>
      <Field label="الجوال" hint="بصيغة 05xxxxxxxx">
        <Input
          dir="ltr"
          className="text-start"
          value={draft.phone}
          onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
        />
      </Field>
      <Field
        label="الرقم السري"
        hint={editing ? 'اتركه فارغاً للإبقاء على الرقم الحالي. الحد الأدنى ٦ خانات.' : 'الحد الأدنى ٦ خانات.'}
      >
        <Input
          type="password"
          value={draft.password}
          onChange={(event) => setDraft({ ...draft, password: event.target.value })}
        />
      </Field>
      <Field label="الصلاحية">
        <Select value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value as AccountRole })}>
          {ROLE_OPTIONS.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABEL[role]}
            </option>
          ))}
        </Select>
      </Field>
    </>
  );

  return (
    <>
      <PageHeader
        title="الحسابات"
        subtitle="كل حسابات يوصل — عملاء ومورّدون ومناديب وإدارة."
        action={
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void resource.reload()} busy={resource.refreshing}>
              تحديث
            </Button>
            <Button size="sm" variant="primary" onClick={() => setCreating(true)} icon={<UserPlus size={15} />}>
              حساب جديد
            </Button>
          </div>
        }
      />

      {resource.error ? <ErrorNote message={resource.error} onRetry={() => void resource.reload()} /> : null}

      <Card padded={false}>
        <Toolbar search={search} onSearch={setSearch} placeholder="ابحث بالاسم أو البريد أو الجوال…">
          <FilterTabs
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'الكل', count: rows.length },
              ...ROLE_OPTIONS.map((role) => ({
                value: role,
                label: ROLE_LABEL[role],
                count: rows.filter((row) => row.role === role).length,
              })),
            ]}
          />
        </Toolbar>
        <DataTable
          columns={columns}
          rows={visible}
          rowKey={(row) => row.id}
          loading={resource.loading}
          empty={<EmptyState icon={<UsersIcon size={22} />} title="لا نتائج مطابقة" />}
        />
        {visible.length ? (
          <p className="border-t border-line px-4 py-3 text-xs text-ink-muted">
            {count(visible.length)} من {count(rows.length)} حساب
          </p>
        ) : null}
      </Card>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="حساب جديد"
        description="يُنشأ الحساب موثّق البريد مباشرة."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)} disabled={busy}>
              إلغاء
            </Button>
            <Button variant="primary" busy={busy} onClick={() => void create()}>
              إنشاء
            </Button>
          </>
        }
      >
        {form}
      </Modal>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.name || ''}
        description="تغيير الرقم السري ينهي كل جلسات هذا الحساب."
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
        {form}
      </Modal>

      <ConfirmDialog
        open={Boolean(removing)}
        title="حذف الحساب؟"
        body={`سيُحذف حساب ${removing?.name ?? ''} نهائياً وتُنهى جلساته. لا يمكن التراجع.`}
        confirmLabel="حذف نهائي"
        danger
        busy={busy}
        onConfirm={() => void remove()}
        onCancel={() => setRemoving(null)}
      />
    </>
  );
}
