import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, MessagesSquare, Search, Send, SquarePen } from 'lucide-react';
import { chats, users, vendorHubs } from '../api/endpoints.ts';
import type { ChatMessage, Conversation, ConversationSummary } from '../api/types.ts';
import { errorText } from '../api/client.ts';
import { useResource } from '../lib/useResource.ts';
import { usePoll } from '../lib/usePoll.ts';
import { usePending } from '../state/PendingContext.tsx';
import { clockTime, count, dayHeading, dayKey, initials, parseServerDate, shortWhen } from '../lib/format.ts';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  PageHeader,
  Select,
  Skeleton,
  Textarea,
} from '../components/ui/primitives.tsx';
import { Modal } from '../components/ui/Modal.tsx';

/** Mirrors `MAX_CHAT_BODY` in `server/chat/chat-store.ts`. */
const MAX_BODY = 2000;
const LIST_POLL_MS = 15_000;
const THREAD_POLL_MS = 5_000;

/** Adds messages not already on screen, in thread order. A poll and a send can both return the same one. */
function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const seen = new Set(current.map((message) => message.id));
  const fresh = incoming.filter((message) => !seen.has(message.id));
  if (!fresh.length) return current;
  return [...current, ...fresh].sort((a, b) => a.seq - b.seq);
}

function preview(row: ConversationSummary): string {
  const last = row.lastMessage;
  if (!last) return '';
  // Shared inbox: naming who answered tells the team whether a vendor is still waiting.
  return last.side === 'owner' ? `${last.senderName}: ${last.body}` : last.body;
}

/**
 * In-app chat with vendors. The owner side is one shared inbox: every admin
 * and accounts manager reads and answers the same thread per vendor, so
 * opening a thread clears its unread count for the whole team.
 */
export function Chats() {
  const pending = usePending();
  const resource = useResource(() => chats.list(), []);
  usePoll(() => void resource.reload(), LIST_POLL_MS);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [composing, setComposing] = useState(false);
  // Drafts outlive switching threads, so a half-written reply is not lost.
  const drafts = useRef(new Map<string, string>()).current;

  const rows = useMemo(() => resource.data ?? [], [resource.data]);
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => row.vendorName.toLowerCase().includes(needle));
  }, [rows, search]);

  const setRows = resource.set;
  const { refreshChats } = pending;

  // A message sent or received moves its thread to the top, as the server would order it.
  const onActivity = useCallback(
    (id: string, message: ChatMessage) =>
      setRows((current) => {
        const row = current?.find((item) => item.id === id);
        if (!current || !row || (row.lastMessage && row.lastMessage.seq >= message.seq)) return current;
        const next = { ...row, lastMessage: message, updatedAt: message.createdAt, unread: 0 };
        return [next, ...current.filter((item) => item.id !== id)];
      }),
    [setRows],
  );

  const onRead = useCallback(
    (id: string) => {
      setRows((current) => current?.map((row) => (row.id === id ? { ...row, unread: 0 } : row)) ?? current);
      refreshChats();
    },
    [setRows, refreshChats],
  );

  function openThread(id: string) {
    setComposing(false);
    setSelectedId(id);
  }

  const newButton = (
    <Button variant="primary" className="max-lg:h-11" icon={<SquarePen size={16} />} onClick={() => setComposing(true)}>
      محادثة جديدة
    </Button>
  );

  return (
    <>
      <PageHeader
        title="المحادثات"
        subtitle="صندوق مشترك لفريق يوصل — كل مشرف يشوف نفس المحادثة مع كل مورّد ويرد فيها."
        action={newButton}
      />

      {resource.error ? <ErrorNote message={resource.error} onRetry={() => void resource.reload()} /> : null}

      {resource.error && !resource.data ? null : (
        <Card padded={false} className="flex h-[calc(100dvh-14rem)] min-h-[26rem] overflow-hidden">
          {resource.loading ? (
            <ListSkeleton />
          ) : !rows.length && !selectedId ? (
            <div className="grid flex-1 place-items-center">
              <EmptyState
                icon={<MessagesSquare size={22} />}
                title="لا توجد محادثات بعد"
                body="ابدأ محادثة مع أي مورّد معتمد، وتظهر هنا أيضاً الرسائل اللي يرسلها المورّدون لفريق يوصل."
                action={newButton}
              />
            </div>
          ) : (
            <>
              <div
                className={`flex w-full min-w-0 flex-col lg:w-80 lg:shrink-0 lg:border-e lg:border-line ${
                  selectedId ? 'max-lg:hidden' : ''
                }`}
              >
                <div className="border-b border-line p-3">
                  <div className="relative">
                    <Search
                      size={15}
                      className="pointer-events-none absolute inset-y-0 start-3 my-auto text-ink-muted"
                      aria-hidden
                    />
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="ابحث باسم المورّد…"
                      aria-label="ابحث باسم المورّد"
                      className="h-11 w-full rounded-lg border border-line-strong bg-surface ps-9 pe-3 text-base text-ink placeholder:text-ink-muted transition-colors hover:border-[var(--axis)] focus:border-accent focus:outline-none sm:text-sm lg:h-9"
                    />
                  </div>
                </div>
                {visible.length ? (
                  <ul className="min-h-0 flex-1 divide-y divide-[var(--line)] overflow-y-auto" aria-label="المحادثات">
                    {visible.map((row) => (
                      <ThreadRow
                        key={row.id}
                        row={row}
                        active={row.id === selectedId}
                        onOpen={() => openThread(row.id)}
                      />
                    ))}
                  </ul>
                ) : (
                  <EmptyState title="لا نتائج مطابقة" />
                )}
              </div>

              <div className={`min-w-0 flex-1 flex-col ${selectedId ? 'flex' : 'hidden lg:flex'}`}>
                {selectedId ? (
                  <ThreadPane
                    key={selectedId}
                    id={selectedId}
                    summary={rows.find((row) => row.id === selectedId) ?? null}
                    drafts={drafts}
                    onBack={() => setSelectedId(null)}
                    onActivity={onActivity}
                    onRead={onRead}
                  />
                ) : (
                  <div className="grid flex-1 place-items-center">
                    <EmptyState
                      icon={<MessagesSquare size={22} />}
                      title="اختر محادثة"
                      body="افتح محادثة من القائمة لقراءتها والرد على المورّد."
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </Card>
      )}

      {composing ? (
        <NewChatModal
          threads={rows}
          onClose={() => setComposing(false)}
          onOpenExisting={openThread}
          onStarted={(conversation) => {
            openThread(conversation.id);
            void resource.reload();
          }}
        />
      ) : null}
    </>
  );
}

/* ── Thread list ────────────────────────────────────────────────────── */

function ThreadRow({ row, active, onOpen }: { row: ConversationSummary; active: boolean; onOpen: () => void }) {
  // The open thread is being read right now; a list poll landing before the
  // read marker must not flash a badge on it.
  const unread = active ? 0 : row.unread;
  const when = row.lastMessage?.createdAt ?? row.updatedAt;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-current={active ? 'true' : undefined}
        className={`flex w-full items-start gap-3 px-4 py-3 text-start transition-colors focus-visible:outline-offset-[-2px] ${
          active ? 'bg-[var(--accent-wash)]' : 'hover:bg-sunken/60'
        }`}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sunken text-xs font-semibold text-ink-secondary">
          {initials(row.vendorName)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className={`truncate text-sm text-ink ${unread ? 'font-semibold' : 'font-medium'}`}>
              {row.vendorName}
            </span>
            <time dateTime={when} className="tabular shrink-0 text-[11px] text-ink-muted">
              {shortWhen(when)}
            </time>
          </span>
          <span className="mt-0.5 flex items-center justify-between gap-2">
            <span className={`truncate text-[13px] ${unread ? 'text-ink' : 'text-ink-secondary'}`} dir="auto">
              {preview(row)}
            </span>
            {unread ? (
              <Badge tone="accent">
                <span className="tabular">{count(unread)}</span>
                <span className="sr-only">رسائل غير مقروءة</span>
              </Badge>
            ) : null}
          </span>
        </span>
      </button>
    </li>
  );
}

/* ── Open thread ────────────────────────────────────────────────────── */

function ThreadPane({
  id,
  summary,
  drafts,
  onBack,
  onActivity,
  onRead,
}: {
  id: string;
  summary: ConversationSummary | null;
  drafts: Map<string, string>;
  onBack: () => void;
  onActivity: (id: string, message: ChatMessage) => void;
  onRead: (id: string) => void;
}) {
  const [thread, setThread] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(() => drafts.get(id) ?? '');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const alive = useRef(true);
  // Read through a ref so a new callback identity from the parent never refetches the thread.
  const events = useRef({ onActivity, onRead });
  events.current = { onActivity, onRead };
  const polling = useRef(false);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  // Follow new messages only while the admin is already at the bottom, so a
  // poll never yanks them away from something older they are reading.
  const pinned = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const markRead = useCallback(() => {
    chats
      .markRead(id)
      .then(() => {
        if (alive.current) events.current.onRead(id);
      })
      .catch(() => {
        // The next poll or open retries; a stale badge is not worth an error.
      });
  }, [id]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const row = await chats.get(id);
      if (!alive.current) return;
      setThread(row);
      markRead();
    } catch (caught) {
      if (alive.current) setError(errorText(caught));
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [id, markRead]);

  useEffect(() => {
    void load();
  }, [load]);

  async function poll() {
    if (!thread || polling.current) return;
    polling.current = true;
    try {
      const seen = new Set(thread.messages.map((message) => message.id));
      const row = await chats.get(id, thread.messages[thread.messages.length - 1]?.id);
      if (!alive.current) return;
      const fresh = row.messages.filter((message) => !seen.has(message.id));
      setThread((current) => ({ ...row, messages: mergeMessages(current?.messages ?? [], row.messages) }));
      if (fresh.length) {
        events.current.onActivity(id, fresh[fresh.length - 1]);
        if (fresh.some((message) => message.side !== 'owner')) markRead();
      }
    } catch {
      // A missed poll is caught up by the next one.
    } finally {
      polling.current = false;
    }
  }

  usePoll(() => void poll(), THREAD_POLL_MS, Boolean(thread));

  const messageCount = thread?.messages.length ?? 0;
  useLayoutEffect(() => {
    const node = scroller.current;
    if (node && pinned.current) node.scrollTop = node.scrollHeight;
  }, [messageCount]);

  function updateDraft(value: string) {
    setDraft(value);
    if (value) drafts.set(id, value);
    else drafts.delete(id);
  }

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const body = draft.trim();
    if (!body || body.length > MAX_BODY || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const message = await chats.send(id, body);
      if (!alive.current) return;
      pinned.current = true;
      setThread((current) => (current ? { ...current, messages: mergeMessages(current.messages, [message]) } : current));
      updateDraft('');
      events.current.onActivity(id, message);
    } catch (caught) {
      // The draft stays put so nothing typed is lost; 429 carries the server's own wording.
      if (alive.current) setSendError(errorText(caught));
    } finally {
      if (alive.current) {
        setSending(false);
        input.current?.focus();
      }
    }
  }

  const name = thread?.vendorName || summary?.vendorName || 'المورّد';
  const trimmed = draft.trim();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-line px-3 py-2.5 sm:px-4">
        <Button
          variant="ghost"
          size="sm"
          className="max-lg:size-11 lg:hidden"
          aria-label="رجوع إلى المحادثات"
          onClick={onBack}
          icon={<ArrowRight size={18} />}
        />
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sunken text-xs font-semibold text-ink-secondary">
          {initials(name)}
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-ink">{name}</h2>
          <p className="text-[11px] text-ink-muted">مورّد · يرى ردود فريق يوصل باسم المشرف</p>
        </div>
      </header>

      <div
        ref={scroller}
        onScroll={(event) => {
          const node = event.currentTarget;
          pinned.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80;
        }}
        role="log"
        aria-live="polite"
        aria-busy={loading}
        aria-label={`الرسائل مع ${name}`}
        tabIndex={0}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-4 focus-visible:outline-offset-[-2px] sm:px-5"
      >
        {loading ? (
          <ThreadSkeleton />
        ) : error ? (
          <ErrorNote message={error} onRetry={() => void load()} />
        ) : thread?.messages.length ? (
          <MessageList messages={thread.messages} vendorName={name} />
        ) : (
          <EmptyState title="لا توجد رسائل في هذه المحادثة" />
        )}
      </div>

      <form onSubmit={(event) => void send(event)} className="space-y-2 border-t border-line p-3">
        {sendError ? <ErrorNote message={sendError} /> : null}
        <div className="flex items-end gap-2">
          <Textarea
            ref={input}
            rows={2}
            value={draft}
            maxLength={MAX_BODY}
            readOnly={sending}
            aria-label={`رسالة إلى ${name}`}
            placeholder="اكتب ردك… (Enter للإرسال، Shift+Enter لسطر جديد)"
            onChange={(event) => updateDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void send();
              }
            }}
            className="max-h-40 min-h-11 resize-none"
            disabled={Boolean(error) && !thread}
          />
          <Button
            type="submit"
            variant="primary"
            className="shrink-0 max-lg:size-11 max-lg:px-0"
            busy={sending}
            disabled={!trimmed || !thread}
            icon={<Send size={16} className="rtl:-scale-x-100" />}
          >
            <span className="max-lg:sr-only">إرسال</span>
          </Button>
        </div>
        <p className={`tabular text-end text-[11px] ${draft.length >= MAX_BODY ? 'text-[var(--critical)]' : 'text-ink-muted'}`}>
          {count(draft.length)} / {count(MAX_BODY)}
        </p>
      </form>
    </div>
  );
}

function dayOf(raw: string): string {
  const parsed = parseServerDate(raw);
  return parsed ? dayKey(parsed) : '';
}

function MessageList({ messages, vendorName }: { messages: ChatMessage[]; vendorName: string }) {
  return (
    <ol className="space-y-1.5">
      {messages.map((message, index) => {
        const previous = messages[index - 1];
        const newDay = !previous || dayOf(previous.createdAt) !== dayOf(message.createdAt);
        // A name above each run of messages, so the team can see which admin answered.
        const newRun = newDay || previous.side !== message.side || previous.senderId !== message.senderId;
        return (
          <li key={message.id}>
            {newDay ? (
              <p className="my-3 flex items-center gap-3 text-[11px] font-medium text-ink-muted" role="separator">
                <span className="h-px flex-1 bg-[var(--line)]" aria-hidden />
                {dayHeading(message.createdAt)}
                <span className="h-px flex-1 bg-[var(--line)]" aria-hidden />
              </p>
            ) : null}
            <Bubble message={message} vendorName={vendorName} showSender={newRun} spaced={newRun && !newDay} />
          </li>
        );
      })}
    </ol>
  );
}

function Bubble({
  message,
  vendorName,
  showSender,
  spaced,
}: {
  message: ChatMessage;
  vendorName: string;
  showSender: boolean;
  spaced: boolean;
}) {
  const mine = message.side === 'owner';
  const sender = mine ? message.senderName : vendorName;
  return (
    // Owner replies sit at the inline end (left under RTL), the vendor at the start.
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'} ${spaced ? 'pt-2' : ''}`}>
      <div className={`flex max-w-[85%] flex-col sm:max-w-[70%] ${mine ? 'items-end' : 'items-start'}`}>
        {showSender && mine ? (
          <p className="mb-1 px-1 text-[11px] font-medium text-ink-muted">{sender}</p>
        ) : (
          <span className="sr-only">{sender}:</span>
        )}
        <div
          className={`rounded-2xl border px-3.5 py-2 ${
            mine
              ? 'rounded-ee-md border-[color-mix(in_srgb,var(--accent)_24%,transparent)] bg-[var(--accent-wash)]'
              : 'rounded-es-md border-line bg-sunken'
          }`}
        >
          {message.context ? (
            <p className="mb-1 text-[12px] font-medium text-ink-secondary">
              بخصوص: {message.context.title || message.context.id}
            </p>
          ) : null}
          <p className="whitespace-pre-wrap break-words text-sm leading-6 text-ink" dir="auto">
            {message.body}
          </p>
          <p className="tabular mt-0.5 text-end text-[11px] text-ink-muted">
            <time dateTime={message.createdAt}>{clockTime(message.createdAt)}</time>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── New conversation ───────────────────────────────────────────────── */

type VendorOption = { id: string; name: string; person: string };

/**
 * Only vendor accounts: the server opens threads with approved vendors by
 * account id, which pending applicants in `vendor-hubs` do not have. Hubs only
 * supply the project name the storefront shows.
 */
async function loadVendors(): Promise<VendorOption[]> {
  const [accounts, hubs] = await Promise.all([users.list(), vendorHubs.list().catch(() => [])]);
  const projectById = new Map(hubs.map((hub) => [hub.vendorId, hub.projectName]));
  return accounts
    .filter((user) => user.role === 'vendor')
    .map((user) => ({ id: user.id, name: projectById.get(user.id) || user.name, person: user.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
}

function NewChatModal({
  threads,
  onClose,
  onOpenExisting,
  onStarted,
}: {
  threads: ConversationSummary[];
  onClose: () => void;
  onOpenExisting: (id: string) => void;
  onStarted: (conversation: Conversation) => void;
}) {
  const vendors = useResource(loadVendors, []);
  const [vendorId, setVendorId] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existing = vendorId ? threads.find((row) => row.vendorId === vendorId) : undefined;
  const options = vendors.data ?? [];

  async function start() {
    if (existing) {
      onOpenExisting(existing.id);
      return;
    }
    const text = body.trim();
    if (!vendorId || !text) return;
    setBusy(true);
    setError(null);
    try {
      onStarted(await chats.start(vendorId, text));
    } catch (caught) {
      setError(errorText(caught));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="محادثة جديدة"
      description="اختر المورّد واكتب أول رسالة — المحادثة تبدأ مع أول رسالة ويشوفها كل فريق يوصل."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            إلغاء
          </Button>
          <Button
            variant="primary"
            busy={busy}
            disabled={!vendorId || (!existing && !body.trim())}
            onClick={() => void start()}
          >
            {existing ? 'فتح المحادثة' : 'إرسال'}
          </Button>
        </>
      }
    >
      {vendors.error ? <ErrorNote message={vendors.error} onRetry={() => void vendors.reload()} /> : null}
      {error ? <ErrorNote message={error} /> : null}

      {vendors.loading ? (
        <Skeleton className="h-10 w-full" />
      ) : vendors.data && !options.length ? (
        <p className="text-[13px] text-ink-secondary">لا يوجد مورّدون معتمدون بعد.</p>
      ) : (
        <Field label="المورّد">
          <Select value={vendorId} onChange={(event) => setVendorId(event.target.value)} disabled={!options.length}>
            <option value="">اختر مورّداً…</option>
            {options.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name !== vendor.person && vendor.person ? `${vendor.name} — ${vendor.person}` : vendor.name}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {existing ? (
        <p className="rounded-lg border border-line bg-sunken px-3 py-2.5 text-[13px] leading-6 text-ink-secondary">
          عند الفريق محادثة مع هذا المورّد من قبل — تنفتح وتكمل فيها.
        </p>
      ) : (
        <Field label="الرسالة" hint={`${count(body.length)} / ${count(MAX_BODY)}`}>
          <Textarea
            rows={5}
            value={body}
            maxLength={MAX_BODY}
            onChange={(event) => setBody(event.target.value)}
            placeholder="اكتب رسالتك للمورّد…"
          />
        </Field>
      )}
    </Modal>
  );
}

/* ── Skeletons ──────────────────────────────────────────────────────── */

function ListSkeleton() {
  return (
    <div className="w-full space-y-2 p-4 lg:w-80 lg:border-e lg:border-line">
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton key={index} className="h-16 w-full" />
      ))}
    </div>
  );
}

function ThreadSkeleton() {
  return (
    <div className="space-y-3">
      {['w-2/3', 'ms-auto w-1/2', 'w-3/5', 'ms-auto w-2/5'].map((width, index) => (
        <Skeleton key={index} className={`h-14 rounded-2xl ${width}`} />
      ))}
    </div>
  );
}
