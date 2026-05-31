import { useEffect, useState } from 'react';
import { fetchEngineQueueHealth } from '../services/engineAnalysis';

const POLL_MS = 30_000;

/**
 * Polls GET /health for redis_engine (API ↔ Redis db 1).
 * Does not detect whether engine_worker processes are running.
 */
export function useEngineQueueHealth(enabled = true): { queueAvailable: boolean | null } {
  const [queueAvailable, setQueueAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    if (!enabled) {
      setQueueAvailable(null);
      return;
    }

    let cancelled = false;

    const check = async () => {
      const ok = await fetchEngineQueueHealth();
      if (!cancelled) {
        setQueueAvailable(ok);
      }
    };

    check();
    const timer = setInterval(check, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled]);

  return { queueAvailable };
}
