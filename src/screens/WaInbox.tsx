import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Check,
  CheckCheck,
  Clock,
  Copy,
  FileText,
  Lock,
  MapPin,
  MessageSquareText,
  Search,
  Send,
  Settings,
  SquarePen,
  TriangleAlert,
  Unlock,
} from 'lucide-react';
import { whatsapp } from '../api/endpoints.ts';
import type { WaConversation, WaMessage, WaSettings, WaSettingsDraft, WaTemplate } from '../api/types.ts';
import { errorText } from '../api/client.ts';
import { useResource } from '../lib/useResource.ts';
import { usePoll } from '../lib/usePoll.ts';
import { usePending } from '../state/PendingContext.tsx';
import { useSession } from '../state/SessionContext.tsx';
import { useToast } from '../state/ToastContext.tsx';
import { clockTime, count, dayHeading, dayKey, initials, parseServerDate, shortWhen } from '../lib/format.ts';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Textarea,
} from '../components/ui/primitives.tsx';
import { FilterTabs } from '../components/ui/Table.tsx';
import { Modal } from '../components/ui/Modal.tsx';

/** WhatsApp's own cap on a text message. */
const MAX_TEXT = 4096;
const LIST_POLL_MS = 10_000;
const THREAD_POLL_MS = 5_000;

type Filter = 'all' | 'unread' | 'mine' | 'closed';

function mergeMessages(current: WaMessage[], incoming: WaMessage[]): WaMessage[] {
  const byId = new Map(current.map((message) => [message.id, message]));
  // Re-fetched rows carry fresh delivery status, so they replace what is on screen.
  for (const message of incoming) byId.set(message.id, message);
  return Array.from(byId.values()).sort((a, b) => a.at.localeCompare(b.at));
}

function typeLabel(type: string): string {
  return (
    {
      image: '📷 صورة',
      video: '🎬 فيديو',
      audio: '🎤 رسالة صوتية',
      document: '📄 ملف',
      sticker: 'ملصق',
      location: '📍 موقع',
      template: 'قالب',
      reaction: 'تفاعل',
      unsupported: 'رسالة غير مدعومة',
    } as Record<string, string>
  )[type] || '';
}

function lastPreview(row: WaConversation): string {
  const last = row.lastMessage;
  if (!last) return '';
  const body = last.text || typeLabel(last.type);
  return last.direction === 'out' ? `أنت: ${body}` : body;
}

/** Fills {{1}}, {{2}}… with the parameters, leaving any missing ones visible. */
function fillTemplate(body: string, params: string[]): string {
  return body.replace(/\{\{(\d+)\}\}/g, (match, n) => params[Number(n) - 1] || match);
}

/**
 * صندوق واتساب — Usil's single WhatsApp number on the official Cloud API.
 * Every admin and accounts manager sees the same conversations and replies
 * from here as Usil; the reply shows which teammate sent it.
 */
export function WaInbox() {
  const { user } = useSession();
  const isOwnerAdmin = user?.role === 'admin';
  const settings = useResource(() => whatsapp.settings(), []);
  const [showSettings, setShowSettings] = useState(false);
  const configured = Boolean(settings.data?.configured);

  return (
    <>
      <PageHeader
        title="صندوق واتساب"
        subtitle={
          settings.data?.displayPhone
            ? `رقم يوصل ${settings.data.displayPhone} — كل الفريق يشوف نفس المحادثات ويرد منها.`
            : 'رقم واتساب يوصل الرسمي — كل الفريق يشوف نفس المحادثات ويرد منها.'
        }
        action={
          isOwnerAdmin ? (
            <Button size="sm" icon={<Settings size={15} />} onClick={() => setShowSettings(true)}>
              إعدادات الربط
            </Button>
          ) : undefined
        }
      />

      {settings.error ? <ErrorNote message={settings.error} onRetry={() => void settings.reload()} /> : null}

      {settings.loading ? (
        <Card>
          <Skeleton className="h-24 w-full" />
        </Card>
      ) : !configured ? (
        <SetupCard settings={settings.data} canEdit={isOwnerAdmin} onOpen={() => setShowSettings(true)} />
      ) : (
        <Inbox currentUserId={user?.id || ''} />
      )}

      {showSettings && settings.data ? (
        <SettingsModal
          settings={settings.data}
          onClose={() => setShowSettings(false)}
          onSaved={(next) => {
            settings.set(next);
            setShowSettings(false);
          }}
        />
      ) : null}
    </>
  );
}

/* ── Not connected yet ──────────────────────────────────────────────── */

function SetupCard({ settings, canEdit, onOpen }: { settings: WaSettings | null; canEdit: boolean; onOpen: () => void }) {
  return (
    <Card>
      <div className="flex flex-col items-start gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-[var(--accent-wash)] text-accent">
          <MessageSquareText size={22} />
        </span>
        <h2 className="text-base font-semibold text-ink">صندوق واتساب غير مربوط بعد</h2>
        <p className="max-w-2xl text-[13px] leading-7 text-ink-secondary">
          الربط يتم عبر واتساب الرسمي (WhatsApp Cloud API) من Meta. بعد الربط تظهر هنا كل رسائل رقم يوصل، ويرد عليها أي
          شخص من الفريق من داخل اللوحة. مع ميزة «Coexistence» يظل الرقم شغّال في تطبيق واتساب للأعمال على الجوال كمان.
        </p>
        {canEdit ? (
          <>
            <ol className="list-decimal space-y-1 ps-5 text-[13px] leading-7 text-ink-secondary">
              <li>أنشئ تطبيقاً من نوع Business في developers.facebook.com وأضف له منتج WhatsApp.</li>
              <li>اربط رقم يوصل بحساب WhatsApp Business (ومع Coexistence اختر ربط رقم تطبيق واتساب للأعمال الحالي).</li>
              <li>أنشئ System User دائم في إعدادات الأعمال وأعطه صلاحية whatsapp_business_messaging وانسخ الـ Access Token.</li>
              <li>الصق هنا: Access Token وPhone number ID وWhatsApp Business Account ID وApp Secret.</li>
              <li>في إعدادات Webhook في Meta الصق رابط الـ Webhook ورمز التحقق، واشترك في: messages وsmb_message_echoes.</li>
            </ol>
            <Button variant="primary" icon={<Settings size={15} />} onClick={onOpen}>
              ابدأ الربط
            </Button>
          </>
        ) : (
          <p className="text-[13px] text-ink-secondary">اطلب من «مدير كل الحسابات» إكمال الربط من هذه الصفحة.</p>
        )}
        {settings?.webhookUrl ? (
          <p className="text-xs text-ink-muted" dir="ltr">
            {settings.webhookUrl}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const toast = useToast();
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <Input readOnly value={value} dir="ltr" className="font-mono text-xs" />
        <Button
          size="sm"
          aria-label={`نسخ ${label}`}
          icon={<Copy size={14} />}
          onClick={() =>
            void navigator.clipboard.writeText(value).then(
              () => toast.success('انسخ.'),
              () => toast.failure('تعذّر النسخ — انسخه يدوياً.'),
            )
          }
        />
      </div>
    </Field>
  );
}

function SettingsModal({
  settings,
  onClose,
  onSaved,
}: {
  settings: WaSettings;
  onClose: () => void;
  onSaved: (next: WaSettings) => void;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState<WaSettingsDraft>({
    phoneNumberId: settings.phoneNumberId,
    businessAccountId: settings.businessAccountId,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      // Blank secrets keep the saved ones.
      const body: WaSettingsDraft = {
        phoneNumberId: draft.phoneNumberId?.trim(),
        businessAccountId: draft.businessAccountId?.trim(),
        ...(draft.accessToken?.trim() ? { accessToken: draft.accessToken.trim() } : {}),
        ...(draft.appSecret?.trim() ? { appSecret: draft.appSecret.trim() } : {}),
      };
      const next = await whatsapp.saveSettings(body);
      toast.success(next.displayPhone ? `تم الربط بالرقم ${next.displayPhone}.` : 'حُفظت الإعدادات.');
      onSaved(next);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => (busy ? undefined : onClose())}
      title="إعدادات ربط واتساب"
      description="المفاتيح تُحفظ على السيرفر فقط ولا تظهر كاملة مرة ثانية. اترك خانة المفتاح فاضية للإبقاء على المحفوظ."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            إلغاء
          </Button>
          <Button variant="primary" busy={busy} onClick={() => void save()}>
            حفظ واختبار الربط
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <ErrorNote message={error} /> : null}
        {settings.displayPhone ? (
          <p className="rounded-lg border border-line bg-sunken px-3 py-2 text-[13px] text-ink-secondary">
            مربوط حالياً بـ <span dir="ltr">{settings.displayPhone}</span>
            {settings.verifiedName ? ` — ${settings.verifiedName}` : ''}
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Access Token (System User)" hint={settings.tokenMasked ? `المحفوظ: ${settings.tokenMasked}` : undefined}>
            <Input
              type="password"
              dir="ltr"
              autoComplete="off"
              placeholder={settings.tokenMasked ? '•••••• (بدون تغيير)' : 'EAAG…'}
              value={draft.accessToken || ''}
              onChange={(e) => setDraft({ ...draft, accessToken: e.target.value })}
            />
          </Field>
          <Field label="App Secret" hint={settings.appSecretSet ? 'محفوظ' : 'من إعدادات التطبيق ← Basic'}>
            <Input
              type="password"
              dir="ltr"
              autoComplete="off"
              placeholder={settings.appSecretSet ? '•••••• (بدون تغيير)' : ''}
              value={draft.appSecret || ''}
              onChange={(e) => setDraft({ ...draft, appSecret: e.target.value })}
            />
          </Field>
          <Field label="Phone number ID">
            <Input dir="ltr" value={draft.phoneNumberId || ''} onChange={(e) => setDraft({ ...draft, phoneNumberId: e.target.value })} />
          </Field>
          <Field label="WhatsApp Business Account ID" hint="لازم لقائمة القوالب المعتمدة">
            <Input
              dir="ltr"
              value={draft.businessAccountId || ''}
              onChange={(e) => setDraft({ ...draft, businessAccountId: e.target.value })}
            />
          </Field>
        </div>
        <div className="space-y-3 rounded-lg border border-line p-3">
          <p className="text-[13px] font-medium text-ink">الصقها في Meta ← WhatsApp ← Configuration ← Webhook</p>
          <CopyField label="Callback URL" value={settings.webhookUrl} />
          <CopyField label="Verify token" value={settings.verifyToken} />
          <p className="text-xs text-ink-muted">اشترك في الحقلين: messages و smb_message_echoes.</p>
        </div>
      </div>
    </Modal>
  );
}

/* ── The inbox ──────────────────────────────────────────────────────── */

function Inbox({ currentUserId }: { currentUserId: string }) {
  const pending = usePending();
  const resource = useResource(() => whatsapp.conversations(), []);
  usePoll(() => void resource.reload(), LIST_POLL_MS);
  const team = useResource(() => whatsapp.team().catch(() => []), []);

  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [starting, setStarting] = useState(false);
  const drafts = useRef(new Map<string, string>()).current;

  const rows = useMemo(() => resource.data ?? [], [resource.data]);
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === 'unread' && !row.unread) return false;
      if (filter === 'mine' && row.assignedTo?.id !== currentUserId) return false;
      if (filter === 'closed' ? row.status !== 'closed' : filter !== 'all' && row.status === 'closed') return false;
      if (!needle) return true;
      return [row.name, row.phone, row.waId].join(' ').toLowerCase().includes(needle);
    });
  }, [rows, search, filter, currentUserId]);

  const setRows = resource.set;
  const { refreshWhatsApp } = pending;

  const onChanged = useCallback(
    (row: WaConversation) => {
      setRows((current) => {
        const others = (current ?? []).filter((item) => item.waId !== row.waId);
        return [row, ...others].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      });
    },
    [setRows],
  );

  const onRead = useCallback(
    (waId: string) => {
      setRows((current) => current?.map((row) => (row.waId === waId ? { ...row, unread: 0 } : row)) ?? current);
      refreshWhatsApp();
    },
    [setRows, refreshWhatsApp],
  );

  const newButton = (
    <Button variant="primary" size="sm" icon={<SquarePen size={15} />} onClick={() => setStarting(true)}>
      محادثة جديدة
    </Button>
  );

  return (
    <>
      {resource.error ? <ErrorNote message={resource.error} onRetry={() => void resource.reload()} /> : null}
      <Card padded={false} className="flex h-[calc(100dvh-14rem)] min-h-[28rem] overflow-hidden">
        <div className={`flex w-full min-w-0 flex-col lg:w-96 lg:shrink-0 lg:border-e lg:border-line ${selected ? 'max-lg:hidden' : ''}`}>
          <div className="space-y-2 border-b border-line p-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={15} className="pointer-events-none absolute inset-y-0 start-3 my-auto text-ink-muted" aria-hidden />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="ابحث بالاسم أو الرقم…"
                  aria-label="ابحث في محادثات واتساب"
                  className="h-9 w-full rounded-lg border border-line-strong bg-surface ps-9 pe-3 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
                />
              </div>
              {newButton}
            </div>
            <FilterTabs<Filter>
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'المفتوحة', count: rows.filter((r) => r.status !== 'closed').length },
                { value: 'unread', label: 'غير مقروءة', count: rows.filter((r) => r.unread > 0).length },
                { value: 'mine', label: 'المسندة لي', count: rows.filter((r) => r.assignedTo?.id === currentUserId).length },
                { value: 'closed', label: 'المغلقة', count: rows.filter((r) => r.status === 'closed').length },
              ]}
            />
          </div>
          {resource.loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : visible.length ? (
            <ul className="min-h-0 flex-1 divide-y divide-[var(--line)] overflow-y-auto" aria-label="محادثات واتساب">
              {visible.map((row) => (
                <ConversationRow key={row.waId} row={row} active={row.waId === selected} onOpen={() => setSelected(row.waId)} />
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<MessageSquareText size={22} />}
              title={rows.length ? 'لا نتائج مطابقة' : 'ما وصلت رسائل بعد'}
              body={rows.length ? undefined : 'أول ما يراسل أحد رقم يوصل تظهر محادثته هنا. أو ابدأ محادثة جديدة بقالب معتمد.'}
            />
          )}
        </div>

        <div className={`min-w-0 flex-1 flex-col ${selected ? 'flex' : 'hidden lg:flex'}`}>
          {selected ? (
            <Thread
              key={selected}
              waId={selected}
              summary={rows.find((row) => row.waId === selected) ?? null}
              team={team.data ?? []}
              drafts={drafts}
              onBack={() => setSelected(null)}
              onChanged={onChanged}
              onRead={onRead}
            />
          ) : (
            <div className="grid flex-1 place-items-center">
              <EmptyState icon={<MessageSquareText size={22} />} title="اختر محادثة" body="افتح محادثة لقراءتها والرد باسم يوصل." />
            </div>
          )}
        </div>
      </Card>

      {starting ? (
        <TemplateModal
          mode="start"
          onClose={() => setStarting(false)}
          onDone={(conversation) => {
            setStarting(false);
            onChanged(conversation);
            setSelected(conversation.waId);
          }}
        />
      ) : null}
    </>
  );
}

function ConversationRow({ row, active, onOpen }: { row: WaConversation; active: boolean; onOpen: () => void }) {
  const unread = active ? 0 : row.unread;
  const when = row.lastMessage?.at ?? row.updatedAt;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-current={active ? 'true' : undefined}
        className={`flex w-full items-start gap-3 px-4 py-3 text-start transition-colors ${active ? 'bg-[var(--accent-wash)]' : 'hover:bg-sunken/60'}`}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#25D366]/15 text-xs font-semibold text-[#128C7E]">
          {initials(row.name || row.phone)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className={`truncate text-sm text-ink ${unread ? 'font-semibold' : 'font-medium'}`}>{row.name || row.phone}</span>
            <time dateTime={when} className="tabular shrink-0 text-[11px] text-ink-muted">
              {shortWhen(when)}
            </time>
          </span>
          <span className="mt-0.5 flex items-center justify-between gap-2">
            <span className={`truncate text-[13px] ${unread ? 'text-ink' : 'text-ink-secondary'}`} dir="auto">
              {lastPreview(row)}
            </span>
            {unread ? (
              <Badge tone="good">
                <span className="tabular">{count(unread)}</span>
                <span className="sr-only">رسائل غير مقروءة</span>
              </Badge>
            ) : null}
          </span>
          {row.assignedTo || row.status === 'closed' ? (
            <span className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-ink-muted">
              {row.assignedTo ? <span>مسندة: {row.assignedTo.name}</span> : null}
              {row.status === 'closed' ? <span>· مغلقة</span> : null}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

/* ── One conversation ───────────────────────────────────────────────── */

function Thread({
  waId,
  summary,
  team,
  drafts,
  onBack,
  onChanged,
  onRead,
}: {
  waId: string;
  summary: WaConversation | null;
  team: Array<{ id: string; name: string }>;
  drafts: Map<string, string>;
  onBack: () => void;
  onChanged: (row: WaConversation) => void;
  onRead: (waId: string) => void;
}) {
  const toast = useToast();
  const [conversation, setConversation] = useState<WaConversation | null>(summary);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(() => drafts.get(waId) ?? '');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [templating, setTemplating] = useState(false);
  const [updating, setUpdating] = useState(false);

  const alive = useRef(true);
  const events = useRef({ onChanged, onRead });
  events.current = { onChanged, onRead };
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const polling = useRef(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const markRead = useCallback(() => {
    whatsapp
      .markRead(waId)
      .then(() => alive.current && events.current.onRead(waId))
      .catch(() => undefined);
  }, [waId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await whatsapp.messages(waId);
      if (!alive.current) return;
      setConversation(data.conversation);
      setMessages(data.messages);
      if (data.conversation.unread) markRead();
    } catch (caught) {
      if (alive.current) setError(errorText(caught));
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [waId, markRead]);

  useEffect(() => {
    void load();
  }, [load]);

  // Polls the whole thread: delivery ticks change on messages already on screen.
  async function poll() {
    if (polling.current || loading) return;
    polling.current = true;
    try {
      const data = await whatsapp.messages(waId);
      if (!alive.current) return;
      const before = new Set(messages.map((m) => m.id));
      const fresh = data.messages.filter((m) => !before.has(m.id));
      setMessages((current) => mergeMessages(current, data.messages));
      setConversation(data.conversation);
      if (fresh.some((m) => m.direction === 'in')) markRead();
    } catch {
      // The next poll catches up.
    } finally {
      polling.current = false;
    }
  }
  usePoll(() => void poll(), THREAD_POLL_MS, !loading && !error);

  useLayoutEffect(() => {
    const node = scroller.current;
    if (node && pinned.current) node.scrollTop = node.scrollHeight;
  }, [messages.length]);

  function updateDraft(value: string) {
    setDraft(value);
    if (value) drafts.set(waId, value);
    else drafts.delete(waId);
  }

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || text.length > MAX_TEXT || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const message = await whatsapp.send(waId, text);
      if (!alive.current) return;
      pinned.current = true;
      setMessages((current) => mergeMessages(current, [message]));
      updateDraft('');
      if (conversation) {
        const next = { ...conversation, lastMessage: { text, type: 'text', direction: 'out' as const, at: message.at }, updatedAt: message.at };
        setConversation(next);
        events.current.onChanged(next);
      }
    } catch (caught) {
      if (alive.current) setSendError(errorText(caught));
      // The window may have just closed on the server: refresh its state.
      void whatsapp.messages(waId).then((data) => alive.current && setConversation(data.conversation)).catch(() => undefined);
    } finally {
      if (alive.current) setSending(false);
    }
  }

  async function update(patch: { assignedTo?: string | null; status?: 'open' | 'closed' }) {
    setUpdating(true);
    try {
      const next = await whatsapp.update(waId, patch);
      setConversation(next);
      events.current.onChanged(next);
      toast.success(patch.status === 'closed' ? 'أُغلقت المحادثة.' : patch.status === 'open' ? 'أُعيد فتح المحادثة.' : 'حُدّث الإسناد.');
    } catch (caught) {
      toast.failure(errorText(caught));
    } finally {
      setUpdating(false);
    }
  }

  const name = conversation?.name || conversation?.phone || waId;
  const windowOpen = Boolean(conversation?.windowOpen);
  const windowEnds = conversation?.lastInboundAt
    ? clockTime(new Date(new Date(conversation.lastInboundAt).getTime() + 24 * 3600_000).toISOString())
    : '';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-3 py-2.5 sm:px-4">
        <Button variant="ghost" size="sm" className="lg:hidden" aria-label="رجوع إلى المحادثات" onClick={onBack} icon={<ArrowRight size={18} />} />
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#25D366]/15 text-xs font-semibold text-[#128C7E]">
          {initials(name)}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-ink">{name}</h2>
          <p className="tabular text-[11px] text-ink-muted" dir="ltr">
            {conversation?.phone}
          </p>
        </div>
        {conversation ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={windowOpen ? 'good' : 'warning'} icon={<Clock size={12} />}>
              {windowOpen ? `الرد الحر متاح حتى ${windowEnds}` : 'خارج نافذة 24 ساعة'}
            </Badge>
            <Select
              aria-label="إسناد المحادثة"
              className="h-8 w-40 text-[13px]"
              value={conversation.assignedTo?.id || ''}
              disabled={updating}
              onChange={(event) => void update({ assignedTo: event.target.value || null })}
            >
              <option value="">بدون إسناد</option>
              {team.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </Select>
            <Button
              size="sm"
              busy={updating}
              icon={conversation.status === 'closed' ? <Unlock size={14} /> : <Lock size={14} />}
              onClick={() => void update({ status: conversation.status === 'closed' ? 'open' : 'closed' })}
            >
              {conversation.status === 'closed' ? 'إعادة فتح' : 'إغلاق'}
            </Button>
          </div>
        ) : null}
      </header>

      <div
        ref={scroller}
        onScroll={(event) => {
          const node = event.currentTarget;
          pinned.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80;
        }}
        role="log"
        aria-live="polite"
        aria-label={`الرسائل مع ${name}`}
        tabIndex={0}
        className="min-h-0 flex-1 overflow-y-auto bg-[color-mix(in_srgb,var(--sunken)_55%,transparent)] px-3 py-4 sm:px-5"
      >
        {loading ? (
          <div className="space-y-3">
            {['w-2/3', 'ms-auto w-1/2', 'w-3/5'].map((width, i) => (
              <Skeleton key={i} className={`h-14 rounded-2xl ${width}`} />
            ))}
          </div>
        ) : error ? (
          <ErrorNote message={error} onRetry={() => void load()} />
        ) : messages.length ? (
          <MessageList messages={messages} />
        ) : (
          <EmptyState title="لا توجد رسائل في هذه المحادثة" />
        )}
      </div>

      <div className="space-y-2 border-t border-line p-3">
        {sendError ? <ErrorNote message={sendError} /> : null}
        {windowOpen ? (
          <form onSubmit={(event) => void send(event)} className="flex items-end gap-2">
            <Textarea
              rows={2}
              value={draft}
              maxLength={MAX_TEXT}
              readOnly={sending}
              aria-label={`رسالة واتساب إلى ${name}`}
              placeholder="اكتب ردك باسم يوصل… (Enter للإرسال، Shift+Enter لسطر جديد)"
              onChange={(event) => updateDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void send();
                }
              }}
              className="max-h-40 min-h-11 resize-none"
            />
            <div className="flex shrink-0 flex-col gap-1.5">
              <Button type="submit" variant="primary" busy={sending} disabled={!draft.trim()} icon={<Send size={16} className="rtl:-scale-x-100" />}>
                إرسال
              </Button>
              <Button size="sm" variant="ghost" icon={<FileText size={14} />} onClick={() => setTemplating(true)}>
                قالب
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color-mix(in_srgb,var(--warning)_40%,transparent)] bg-[var(--warning-wash)] px-3 py-2.5">
            <p className="text-[13px] leading-6 text-ink">
              مرّ أكثر من 24 ساعة على آخر رسالة من العميل، وواتساب يسمح الحين فقط برسالة قالب معتمدة. أول ما يرد العميل ترجع
              الكتابة الحرة.
            </p>
            <Button variant="primary" size="sm" icon={<FileText size={14} />} onClick={() => setTemplating(true)}>
              إرسال قالب
            </Button>
          </div>
        )}
      </div>

      {templating ? (
        <TemplateModal
          mode="reply"
          waId={waId}
          name={name}
          onClose={() => setTemplating(false)}
          onSent={(message) => {
            setTemplating(false);
            pinned.current = true;
            setMessages((current) => mergeMessages(current, [message]));
          }}
        />
      ) : null}
    </div>
  );
}

function dayOf(raw: string): string {
  const parsed = parseServerDate(raw);
  return parsed ? dayKey(parsed) : '';
}

function MessageList({ messages }: { messages: WaMessage[] }) {
  return (
    <ol className="space-y-1.5">
      {messages.map((message, index) => {
        const previous = messages[index - 1];
        const newDay = !previous || dayOf(previous.at) !== dayOf(message.at);
        const newRun =
          newDay ||
          previous.direction !== message.direction ||
          previous.sentBy?.id !== message.sentBy?.id ||
          previous.via !== message.via;
        return (
          <li key={message.id}>
            {newDay ? (
              <p className="my-3 flex items-center gap-3 text-[11px] font-medium text-ink-muted" role="separator">
                <span className="h-px flex-1 bg-[var(--line)]" aria-hidden />
                {dayHeading(message.at)}
                <span className="h-px flex-1 bg-[var(--line)]" aria-hidden />
              </p>
            ) : null}
            <Bubble message={message} showSender={newRun} />
          </li>
        );
      })}
    </ol>
  );
}

function StatusTick({ message }: { message: WaMessage }) {
  if (message.direction !== 'out') return null;
  if (message.status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 text-[var(--critical)]" title={message.error || undefined}>
        <TriangleAlert size={12} />
        لم تُرسل
      </span>
    );
  }
  if (message.status === 'read') return <CheckCheck size={14} className="text-[#34B7F1]" aria-label="مقروءة" />;
  if (message.status === 'delivered') return <CheckCheck size={14} aria-label="وصلت" />;
  if (message.status === 'sent') return <Check size={14} aria-label="أُرسلت" />;
  return <Clock size={12} aria-label="قيد الإرسال" />;
}

function MediaBody({ message }: { message: WaMessage }) {
  const src = message.mediaId ? whatsapp.mediaUrl(message.mediaId) : '';
  if (message.type === 'image' || message.type === 'sticker') {
    return src ? (
      <a href={src} target="_blank" rel="noopener noreferrer">
        <img src={src} alt={message.caption || 'صورة'} loading="lazy" className="max-h-64 max-w-full rounded-lg" />
      </a>
    ) : null;
  }
  if (message.type === 'audio') return src ? <audio controls src={src} className="max-w-full" /> : null;
  if (message.type === 'video') return src ? <video controls src={src} className="max-h-64 max-w-full rounded-lg" /> : null;
  if (message.type === 'document') {
    return src ? (
      <a href={src} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-accent underline">
        <FileText size={15} />
        {message.fileName || 'ملف'}
      </a>
    ) : null;
  }
  if (message.type === 'location' && message.location) {
    const { latitude, longitude, name, address } = message.location;
    return (
      <a
        href={`https://www.google.com/maps?q=${latitude},${longitude}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm text-accent underline"
      >
        <MapPin size={15} />
        {name || address || 'موقع على الخريطة'}
      </a>
    );
  }
  return null;
}

function Bubble({ message, showSender }: { message: WaMessage; showSender: boolean }) {
  const mine = message.direction === 'out';
  const sender = mine
    ? message.via === 'phone'
      ? 'من جوال يوصل'
      : message.sentBy?.name || 'فريق يوصل'
    : '';
  const text = message.type === 'template' || message.type === 'text' || message.type === 'reaction' || message.type === 'unsupported'
    ? message.text || typeLabel(message.type)
    : message.caption || '';
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'} ${showSender ? 'pt-2' : ''}`}>
      <div className={`flex max-w-[85%] flex-col sm:max-w-[70%] ${mine ? 'items-end' : 'items-start'}`}>
        {showSender && mine ? <p className="mb-1 px-1 text-[11px] font-medium text-ink-muted">{sender}</p> : null}
        <div
          className={`space-y-1.5 rounded-2xl border px-3.5 py-2 ${
            mine
              ? `rounded-ee-md ${message.status === 'failed' ? 'border-[color-mix(in_srgb,var(--critical)_40%,transparent)]' : 'border-[#25D366]/30'} bg-[#DCF8C6] dark:bg-[#1f3a2a]`
              : 'rounded-es-md border-line bg-surface'
          }`}
        >
          {message.template ? <p className="text-[11px] font-medium text-ink-muted">قالب: {message.template.name}</p> : null}
          <MediaBody message={message} />
          {text ? (
            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-ink" dir="auto">
              {text}
            </p>
          ) : null}
          <p className="tabular flex items-center justify-end gap-1 text-[11px] text-ink-muted">
            <time dateTime={message.at}>{clockTime(message.at)}</time>
            <StatusTick message={message} />
          </p>
          {message.status === 'failed' && message.error ? (
            <p className="text-[11px] text-[var(--critical)]">{message.error}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ── Templates: replies outside the 24h window, and new conversations ── */

type TemplateModalProps =
  | { mode: 'reply'; waId: string; name: string; onClose: () => void; onSent: (message: WaMessage) => void }
  | { mode: 'start'; onClose: () => void; onDone: (conversation: WaConversation) => void };

function TemplateModal(props: TemplateModalProps) {
  const toast = useToast();
  const templates = useResource(() => whatsapp.templates(), []);
  const [key, setKey] = useState('');
  const [params, setParams] = useState<string[]>([]);
  const [phone, setPhone] = useState('');
  const [contactName, setContactName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = templates.data ?? [];
  const chosen: WaTemplate | undefined = list.find((t) => `${t.name}|${t.language}` === key);

  useEffect(() => {
    setParams(Array.from({ length: chosen?.paramCount || 0 }, () => ''));
  }, [chosen?.name, chosen?.language, chosen?.paramCount]);

  const ready = Boolean(chosen) && params.every((p) => p.trim()) && (props.mode === 'reply' || phone.trim());

  async function submit() {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      if (props.mode === 'reply') {
        const message = await whatsapp.sendTemplate(props.waId, chosen.name, chosen.language, params.map((p) => p.trim()));
        toast.success('أُرسل القالب.');
        props.onSent(message);
      } else {
        const result = await whatsapp.start({
          phone: phone.trim(),
          name: contactName.trim() || undefined,
          template: chosen.name,
          language: chosen.language,
          params: params.map((p) => p.trim()),
        });
        toast.success('بدأت المحادثة وأُرسل القالب.');
        props.onDone(result.conversation);
      }
    } catch (caught) {
      setError(errorText(caught));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => (busy ? undefined : props.onClose())}
      title={props.mode === 'reply' ? `إرسال قالب إلى ${props.name}` : 'محادثة واتساب جديدة'}
      description="واتساب يسمح ببدء المحادثة أو الرد بعد 24 ساعة فقط بقالب وافقت عليه Meta. القوالب تُنشأ من WhatsApp Manager."
      footer={
        <>
          <Button variant="ghost" onClick={props.onClose} disabled={busy}>
            إلغاء
          </Button>
          <Button variant="primary" busy={busy} disabled={!ready} onClick={() => void submit()}>
            إرسال
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error ? <ErrorNote message={error} /> : null}
        {templates.error ? <ErrorNote message={templates.error} onRetry={() => void templates.reload()} /> : null}
        {props.mode === 'start' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="رقم الجوال *">
              <Input dir="ltr" inputMode="tel" placeholder="05xxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Field label="الاسم">
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </Field>
          </div>
        ) : null}
        {templates.loading ? (
          <Skeleton className="h-10 w-full" />
        ) : list.length ? (
          <Field label="القالب">
            <Select value={key} onChange={(e) => setKey(e.target.value)}>
              <option value="">اختر قالباً معتمداً…</option>
              {list.map((t) => (
                <option key={`${t.name}|${t.language}`} value={`${t.name}|${t.language}`}>
                  {t.name} ({t.language})
                </option>
              ))}
            </Select>
          </Field>
        ) : !templates.error ? (
          <p className="text-[13px] text-ink-secondary">ما فيه قوالب معتمدة بعد. أنشئ قالباً من WhatsApp Manager وانتظر موافقة Meta.</p>
        ) : null}
        {chosen
          ? params.map((value, index) => (
              <Field key={index} label={`المتغيّر {{${index + 1}}}`}>
                <Input
                  value={value}
                  onChange={(e) => setParams((current) => current.map((p, i) => (i === index ? e.target.value : p)))}
                />
              </Field>
            ))
          : null}
        {chosen ? (
          <div className="rounded-lg border border-line bg-[#DCF8C6] px-3 py-2 text-sm leading-6 text-ink dark:bg-[#1f3a2a]" dir="auto">
            {fillTemplate(chosen.body, params) || `[قالب: ${chosen.name}]`}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
