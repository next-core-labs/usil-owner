import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { chats, couriers, support, vendorApplications, whatsapp } from '../api/endpoints.ts';
import { usePoll } from '../lib/usePoll.ts';

/**
 * The "what needs me" counts behind the sidebar badges. Kept in one place so
 * approving an application updates the badge without every screen refetching.
 */
/** `whatsapp` = WhatsApp conversations with unread customer messages. */
export type PendingCounts = { vendors: number; couriers: number; support: number; chats: number; whatsapp: number };

type PendingApi = PendingCounts & {
  refresh: () => void;
  /** Just the chat badge — the chat screen calls it after every read. */
  refreshChats: () => void;
  /** Just the WhatsApp badge — the inbox calls it after reading a conversation. */
  refreshWhatsApp: () => void;
};

const PendingContext = createContext<PendingApi | null>(null);

const POLL_MS = 60_000;
// Chats are a conversation, so their badge polls faster; the endpoint is a count.
const CHAT_POLL_MS = 15_000;

export function PendingProvider({ children }: { children: ReactNode }) {
  const [counts, setCounts] = useState<Omit<PendingCounts, 'chats' | 'whatsapp'>>({ vendors: 0, couriers: 0, support: 0 });
  const [chatUnread, setChatUnread] = useState(0);
  const [waUnread, setWaUnread] = useState(0);

  const load = useCallback(async () => {
    // A failure here is invisible on purpose: a stale badge must never take the
    // dashboard down, and the screen itself reports the real error.
    const [vendorRows, courierRows, supportRows] = await Promise.all([
      vendorApplications.list().catch(() => []),
      couriers.list().catch(() => []),
      support.list().catch(() => []),
    ]);
    setCounts({
      vendors: vendorRows.filter((row) => row.status === 'pending').length,
      couriers: courierRows.filter((row) => row.status === 'pending').length,
      support: supportRows.filter((row) => row.status === 'new').length,
    });
  }, []);

  const loadChats = useCallback(async () => {
    setChatUnread(await chats.unread().catch(() => 0));
  }, []);

  const loadWhatsApp = useCallback(async () => {
    setWaUnread(await whatsapp.unread().catch(() => 0));
  }, []);

  useEffect(() => {
    void load();
    void loadChats();
    void loadWhatsApp();
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [load, loadChats, loadWhatsApp]);

  usePoll(() => void loadChats(), CHAT_POLL_MS);
  usePoll(() => void loadWhatsApp(), CHAT_POLL_MS);

  // Stable, because the chat screen's read handler depends on it.
  const refreshChats = useCallback(() => void loadChats(), [loadChats]);
  const refreshWhatsApp = useCallback(() => void loadWhatsApp(), [loadWhatsApp]);

  const value = useMemo<PendingApi>(
    () => ({
      ...counts,
      chats: chatUnread,
      whatsapp: waUnread,
      refresh: () => {
        void load();
        void loadChats();
        void loadWhatsApp();
      },
      refreshChats,
      refreshWhatsApp,
    }),
    [counts, chatUnread, waUnread, load, loadChats, loadWhatsApp, refreshChats, refreshWhatsApp],
  );

  return <PendingContext.Provider value={value}>{children}</PendingContext.Provider>;
}

export function usePending(): PendingApi {
  const api = useContext(PendingContext);
  if (!api) throw new Error('usePending must be used inside <PendingProvider>');
  return api;
}
