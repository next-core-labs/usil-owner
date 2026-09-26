import { useMemo, useState, type ReactNode } from 'react';
import { Headset, Mail, MessageCircle, Store } from 'lucide-react';
import { support, users, vendorApplications, vendorSocials } from '../api/endpoints.ts';
import type { SupportMessage, SupportStatus } from '../api/types.ts';
import { errorText } from '../api/client.ts';
import { useResource } from '../lib/useResource.ts';
import { useToast } from '../state/ToastContext.tsx';
import { usePending } from '../state/PendingContext.tsx';
import { count, dateTime, initials } from '../lib/format.ts';
import { SUPPORT_STATUS_LABEL } from '../lib/labels.ts';
import {
  buildVendorContacts,
  fillVendorTemplate,
  supportReplyText,
  USIL_WHATSAPP_DISPLAY,
  VENDOR_TEMPLATES,
  whatsappChatUrl,
  type VendorContact,
  type VendorTemplateId,
} from '../lib/whatsapp.ts';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  PageHeader,
  Select,
  Textarea,
  type Tone,
} from '../components/ui/primitives.tsx';
import { FilterTabs, Toolbar } from '../components/ui/Table.tsx';
import { StatusBadge } from './VendorApplications.tsx';

type View = 'vendors' | 'support';
type VendorFilter = 'all' | 'approved' | 'pending' | 'no_phone';

const PHONE_SOURCE_LABEL: Record<VendorContact['phoneSource'], string> = {
  business_whatsapp: 'واتساب أعمال',
  account: 'جوال الحساب',
  application: 'جوال طلب الانضمام',
  none: 'بدون رقم',
};

const SUPPORT_STATUS_TONE: Record<SupportStatus, Tone> = {
  new: 'warning',
  replied: 'accent',
  closed: 'neutral',
};

const SUPPORT_STATUSES: SupportStatus[] = ['new', 'replied', 'closed'];

const LINK_BASE = 'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-colors';
const WA_LINK = `${LINK_BASE} border-transparent bg-whatsapp text-whatsapp-ink hover:bg-whatsapp-hover`;
const MAIL_LINK = `${LINK_BASE} border-line-strong bg-surface text-ink hover:bg-sunken`;

/** A chat link opens in a new tab so the dashboard stays where the owner left it. */
function WhatsAppLink({ href, onClick, children }: { href: string; onClick?: () => void; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={WA_LINK}>
      <MessageCircle size={15} aria-hidden />
      {children}
    </a>
  );
}

/**
 * The owner's WhatsApp desk: message any vendor with a ready template, and
 * answer support messages from the site's contact form. Chats open in the
 * owner's own WhatsApp via wa.me, so nothing here needs Business API keys.
 */
export function WhatsApp() {
  const [view, setView] = useState<View>('vendors');

  const contactsResource = useResource(async () => {
    const [accountRows, applicationRows, socialRows] = await Promise.all([
      users.list(),
      vendorApplications.list(),
      // Socials only upgrade a number to the business line, so losing them is not fatal.
      vendorSocials.list().catch(() => []),
    ]);
    return buildVendorContacts({ users: accountRows, applications: applicationRows, socials: socialRows });
  }, []);
  const supportResource = useResource(() => support.list(), []);

  const contacts = contactsResource.data ?? [];
  const messages = supportResource.data ?? [];
  const newCount = messages.filter((row) => row.status === 'new').length;

  return (
    <>
      <PageHeader
        title="واتساب يوصل"
        subtitle="تواصل مع المورّدين ورد على رسائل الدعم — الرسالة تنفتح في واتساب جاهزة وتقدر تعدّلها قبل الإرسال."
        action={
          <Button
            size="sm"
            busy={contactsResource.refreshing || supportResource.refreshing}
            onClick={() => {
              void contactsResource.reload();
              void supportResource.reload();
            }}
          >
            تحديث
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-[var(--shadow-card)]">
        <p className="flex items-center gap-2 text-[13px] text-ink-secondary">
          <MessageCircle size={15} className="shrink-0 text-whatsapp" aria-hidden />
          أرسل من رقم يوصل الرسمي
          <span className="tabular font-semibold text-ink" dir="ltr">
            {USIL_WHATSAPP_DISPLAY}
          </span>
          — هو الرقم اللي يشوفه المورّدون والعملاء في صفحة الدعم.
        </p>
        <FilterTabs<View>
          value={view}
          onChange={setView}
          options={[
            { value: 'vendors', label: 'المورّدون', count: contacts.length },
            { value: 'support', label: 'الدعم', count: newCount },
          ]}
        />
      </div>

      {view === 'vendors' ? (
        <VendorsDesk
          contacts={contacts}
          loading={contactsResource.loading}
          error={contactsResource.error}
          onRetry={() => void contactsResource.reload()}
        />
      ) : (
        <SupportDesk
          messages={messages}
          loading={supportResource.loading}
          error={supportResource.error}
          onRetry={() => void supportResource.reload()}
          onUpdate={(row) =>
            supportResource.set((current) => current?.map((item) => (item.id === row.id ? row : item)) ?? current)
          }
        />
      )}
    </>
  );
}

/* ── Vendors ────────────────────────────────────────────────────────── */

function VendorsDesk({
  contacts,
  loading,
  error,
  onRetry,
}: {
  contacts: VendorContact[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<VendorFilter>('all');
  const [templateId, setTemplateId] = useState<VendorTemplateId>('greeting');
  const [body, setBody] = useState(VENDOR_TEMPLATES[0].body);

  function pickTemplate(id: VendorTemplateId) {
    setTemplateId(id);
    setBody(VENDOR_TEMPLATES.find((item) => item.id === id)?.body ?? '');
  }

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return contacts.filter((contact) => {
      if (filter === 'approved' && contact.applicationStatus !== 'approved' && !contact.userId) return false;
      if (filter === 'pending' && contact.applicationStatus !== 'pending') return false;
      if (filter === 'no_phone' && whatsappChatUrl(contact.phone)) return false;
      if (!needle) return true;
      return [contact.name, contact.projectName, contact.email, contact.phone].join(' ').toLowerCase().includes(needle);
    });
  }, [contacts, filter, search]);

  return (
    <>
      {error ? <ErrorNote message={error} onRetry={onRetry} /> : null}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="h-fit lg:col-span-2">
          <div className="space-y-4">
            <Field label="قالب الرسالة">
              <Select value={templateId} onChange={(event) => pickTemplate(event.target.value as VendorTemplateId)}>
                {VENDOR_TEMPLATES.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="نص الرسالة">
              <Textarea
                rows={7}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="اكتب رسالتك للمورّد…"
              />
            </Field>
            <p className="text-xs leading-5 text-ink-muted">
              استخدم <span dir="ltr">{'{name}'}</span> لاسم المورّد و<span dir="ltr">{'{project}'}</span> لاسم
              المتجر — تتعبأ تلقائياً لكل مورّد.
            </p>
          </div>
        </Card>

        <Card padded={false} className="lg:col-span-3">
          <Toolbar search={search} onSearch={setSearch} placeholder="ابحث بالاسم أو المتجر أو الجوال…">
            <div className="w-44">
              <Select
                aria-label="تصفية المورّدين"
                value={filter}
                onChange={(event) => setFilter(event.target.value as VendorFilter)}
                className="h-9"
              >
                <option value="all">كل المورّدين</option>
                <option value="approved">المعتمدون</option>
                <option value="pending">طلبات معلّقة</option>
                <option value="no_phone">بدون رقم واتساب</option>
              </Select>
            </div>
          </Toolbar>

          {loading ? (
            <ListSkeleton />
          ) : visible.length ? (
            <ul className="divide-y divide-[var(--line)]">
              {visible.map((contact) => {
                const url = whatsappChatUrl(contact.phone, fillVendorTemplate(body, contact));
                return (
                  <li key={contact.key} className="flex flex-wrap items-center gap-3 p-4 transition-colors hover:bg-sunken/50">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sunken text-xs font-semibold text-ink-secondary">
                      {initials(contact.projectName || contact.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">{contact.projectName || contact.name}</p>
                      <p className="truncate text-xs text-ink-muted">
                        {contact.projectName ? `${contact.name} · ` : ''}
                        <span dir="ltr">{contact.email}</span>
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {contact.applicationStatus ? <StatusBadge status={contact.applicationStatus} /> : null}
                        <Badge tone={contact.phoneSource === 'business_whatsapp' ? 'good' : 'neutral'}>
                          {PHONE_SOURCE_LABEL[contact.phoneSource]}
                        </Badge>
                        {contact.phone ? (
                          <span className="tabular text-xs text-ink-secondary" dir="ltr">
                            {contact.phone}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {url ? (
                      <WhatsAppLink href={url}>واتساب</WhatsAppLink>
                    ) : contact.email ? (
                      <a href={`mailto:${contact.email}`} className={MAIL_LINK}>
                        <Mail size={15} aria-hidden />
                        بريد
                      </a>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              icon={<Store size={22} />}
              title={contacts.length ? 'لا نتائج مطابقة' : 'لا يوجد مورّدون بعد'}
              body={contacts.length ? undefined : 'يظهر هنا كل مورّد له حساب أو طلب انضمام، مع رقم واتساب جاهز للتواصل.'}
            />
          )}

          {visible.length ? (
            <p className="border-t border-line px-4 py-3 text-xs text-ink-muted">
              {count(visible.length)} من {count(contacts.length)} مورّد
            </p>
          ) : null}
        </Card>
      </div>
    </>
  );
}

/* ── Support ────────────────────────────────────────────────────────── */

function SupportDesk({
  messages,
  loading,
  error,
  onRetry,
  onUpdate,
}: {
  messages: SupportMessage[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onUpdate: (row: SupportMessage) => void;
}) {
  const toast = useToast();
  const pending = usePending();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<SupportStatus | 'all'>('new');
  const [saving, setSaving] = useState<string | null>(null);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return messages.filter((row) => {
      if (filter !== 'all' && row.status !== filter) return false;
      if (!needle) return true;
      return [row.name, row.email, row.phone, row.message].join(' ').toLowerCase().includes(needle);
    });
  }, [messages, filter, search]);

  async function setStatus(row: SupportMessage, status: SupportStatus, quiet = false) {
    setSaving(row.id);
    try {
      onUpdate(await support.setStatus(row.id, status));
      pending.refresh();
      if (!quiet) toast.success(`الرسالة الآن «${SUPPORT_STATUS_LABEL[status]}».`);
    } catch (caught) {
      toast.failure(errorText(caught));
    } finally {
      setSaving(null);
    }
  }

  // Opening a reply is the owner answering, so a new message moves to "replied".
  const markRepliedIfNew = (row: SupportMessage) => {
    if (row.status === 'new') void setStatus(row, 'replied', true);
  };

  return (
    <>
      {error ? <ErrorNote message={error} onRetry={onRetry} /> : null}

      <Card padded={false}>
        <Toolbar search={search} onSearch={setSearch} placeholder="ابحث في رسائل الدعم…">
          <FilterTabs
            value={filter}
            onChange={setFilter}
            options={[
              ...SUPPORT_STATUSES.map((status) => ({
                value: status,
                label: SUPPORT_STATUS_LABEL[status],
                count: messages.filter((row) => row.status === status).length,
              })),
              { value: 'all' as const, label: 'الكل', count: messages.length },
            ]}
          />
        </Toolbar>

        {loading ? (
          <ListSkeleton />
        ) : visible.length ? (
          <ul className="divide-y divide-[var(--line)]">
            {visible.map((row) => {
              const reply = supportReplyText(row.name, row.message);
              const waUrl = whatsappChatUrl(row.phone, reply);
              const mailUrl = row.email
                ? `mailto:${row.email}?subject=${encodeURIComponent('رد دعم يوصل')}&body=${encodeURIComponent(reply)}`
                : '';
              return (
                <li key={row.id} className="flex gap-3 p-4 transition-colors hover:bg-sunken/50">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sunken text-xs font-semibold text-ink-secondary">
                    {initials(row.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-ink">{row.name}</p>
                        <p className="tabular truncate text-xs text-ink-muted" dir="ltr">
                          {[row.phone, row.email].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-ink-muted">{dateTime(row.createdAt)}</span>
                        <Badge tone={SUPPORT_STATUS_TONE[row.status]}>{SUPPORT_STATUS_LABEL[row.status]}</Badge>
                      </div>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-[13px] leading-6 text-ink-secondary">{row.message}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {waUrl ? (
                        <WhatsAppLink href={waUrl} onClick={() => markRepliedIfNew(row)}>
                          رد عبر واتساب
                        </WhatsAppLink>
                      ) : null}
                      {mailUrl ? (
                        <a href={mailUrl} onClick={() => markRepliedIfNew(row)} className={MAIL_LINK}>
                          <Mail size={15} aria-hidden />
                          رد بالبريد
                        </a>
                      ) : null}
                      {row.status === 'closed' ? (
                        <Button size="sm" variant="ghost" busy={saving === row.id} onClick={() => void setStatus(row, 'new')}>
                          إعادة فتح
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" busy={saving === row.id} onClick={() => void setStatus(row, 'closed')}>
                          إغلاق
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={<Headset size={22} />}
            title={messages.length ? 'لا رسائل بهذه الحالة' : 'لا توجد رسائل دعم'}
            body={messages.length ? undefined : 'تظهر هنا الرسائل اللي يرسلها العملاء والمورّدون من صفحة الدعم.'}
          />
        )}
      </Card>
    </>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="pulse h-20 rounded-lg bg-sunken" />
      ))}
    </div>
  );
}
