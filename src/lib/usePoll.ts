import { useEffect, useRef } from 'react';

/**
 * Runs `callback` every `ms` while the tab is visible. A hidden tab makes no
 * requests at all, and coming back fires once straight away so the screen
 * catches up instead of waiting out the rest of the interval.
 */
export function usePoll(callback: () => void, ms: number, enabled = true) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (!document.hidden) callbackRef.current();
    };
    const timer = window.setInterval(tick, ms);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [ms, enabled]);
}
