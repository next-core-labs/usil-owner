import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { couriers, support, vendorApplications } from '../api/endpoints.ts';

/**
 * The "what needs me" counts behind the sidebar badges. Kept in one place so
 * approving an application updates the badge without every screen refetching.
 */
export type PendingCounts = { vendors: number; couriers: number; support: number };

type PendingApi = PendingCounts & { refresh: () => void };

const PendingContext = createContext<PendingApi | null>(null);

const POLL_MS = 60_000;

export function PendingProvider({ children }: { children: ReactNode }) {
  const [counts, setCounts] = useState<PendingCounts>({ vendors: 0, couriers: 0, support: 0 });

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

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const value = useMemo<PendingApi>(() => ({ ...counts, refresh: () => void load() }), [counts, load]);

  return <PendingContext.Provider value={value}>{children}</PendingContext.Provider>;
}

export function usePending(): PendingApi {
  const api = useContext(PendingContext);
  if (!api) throw new Error('usePending must be used inside <PendingProvider>');
  return api;
}
