import { useEffect, useRef, useState } from 'react';
import {
  cancelEngineJob,
  createEngineJob,
  describeEngineAdvantage,
  engineEvalWhiteShare,
  formatEngineEval,
  isTerminalEngineStatus,
  subscribeEngineJobEvents,
  type CreateEngineJobParams,
  type EngineJobEvent,
} from '../services/engineAnalysis';

type UseEngineAnalysisOptions = {
  /** Position FEN to analyze (live friend game). Omit when using gameId+ply. */
  fen?: string | null;
  gameId?: string;
  ply?: number;
  depth: number;
  profile?: 'play' | 'analysis';
  enabled?: boolean;
};

type EngineAnalysisState = {
  evalText: string;
  advantage: string;
  whiteShare: number;
  depth: number | null;
  status: EngineJobEvent['status'] | null;
  loading: boolean;
  error: string | null;
  /** True when job stays queued long enough that workers may not be running. */
  waitingForWorker: boolean;
};

const WORKER_WAIT_MS = 10_000;

const initialState: EngineAnalysisState = {
  evalText: '—',
  advantage: 'Analyzing…',
  whiteShare: 50,
  depth: null,
  status: null,
  loading: false,
  error: null,
  waitingForWorker: false,
};

/**
 * Enqueue a Stockfish job when inputs change; stream SSE (or poll fallback).
 * Ignores stale events when event.fen !== requested fen (live play).
 */
export function useEngineAnalysis(options: UseEngineAnalysisOptions): EngineAnalysisState {
  const { fen, gameId, ply, depth, profile = 'play', enabled = true } = options;
  const [state, setState] = useState<EngineAnalysisState>(initialState);
  const jobIdRef = useRef<string | null>(null);
  const targetFenRef = useRef<string | null>(null);
  const targetKeyRef = useRef<string>('');

  useEffect(() => {
    const hasFen = !!fen;
    const hasArchive = gameId != null && ply != null;
    if (!enabled || (!hasFen && !hasArchive)) {
      setState(initialState);
      return;
    }

    const targetKey = hasArchive ? `${gameId}:${ply}:${depth}` : `${fen}:${depth}:${profile}`;
    targetKeyRef.current = targetKey;
    if (hasFen) {
      targetFenRef.current = fen!;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    const previousJobId = jobIdRef.current;

    const run = async () => {
      setState(s => ({ ...s, loading: true, error: null, waitingForWorker: false }));

      if (previousJobId) {
        cancelEngineJob(previousJobId).catch(() => {});
        jobIdRef.current = null;
      }

      try {
        const params: CreateEngineJobParams = {
          depth,
          profile,
          multipv: 1,
        };
        if (hasArchive) {
          params.game_id = gameId;
          params.ply = ply;
        } else {
          params.fen = fen!;
        }

        const { job_id } = await createEngineJob(params);
        if (cancelled || targetKeyRef.current !== targetKey) {
          cancelEngineJob(job_id).catch(() => {});
          return;
        }
        jobIdRef.current = job_id;

        unsubscribe = await subscribeEngineJobEvents(
          job_id,
          evt => {
            if (cancelled || targetKeyRef.current !== targetKey) {
              return;
            }
            if (targetFenRef.current && evt.fen !== targetFenRef.current) {
              return;
            }
            const result = evt.result ?? undefined;
            setState({
              evalText: formatEngineEval(result),
              advantage: describeEngineAdvantage(result),
              whiteShare: engineEvalWhiteShare(result),
              depth: result?.depth ?? null,
              status: evt.status,
              loading: !isTerminalEngineStatus(evt.status),
              error: evt.error,
              waitingForWorker: false,
            });
          },
          err => {
            if (!cancelled && targetKeyRef.current === targetKey) {
              setState(s => ({ ...s, loading: false, error: err.message }));
            }
          },
        );
      } catch (e: unknown) {
        if (!cancelled && targetKeyRef.current === targetKey) {
          setState({
            ...initialState,
            error: e instanceof Error ? e.message : 'Engine unavailable',
          });
        }
      }
    };

    const debounce = setTimeout(run, hasArchive ? 350 : 150);

    return () => {
      cancelled = true;
      clearTimeout(debounce);
      unsubscribe?.();
      const jid = jobIdRef.current;
      if (jid) {
        cancelEngineJob(jid).catch(() => {});
        jobIdRef.current = null;
      }
    };
  }, [enabled, fen, gameId, ply, depth, profile]);

  useEffect(() => {
    if (state.status !== 'queued' || !state.loading) {
      return;
    }

    const timer = setTimeout(() => {
      setState(s =>
        s.status === 'queued' && s.loading ? { ...s, waitingForWorker: true } : s,
      );
    }, WORKER_WAIT_MS);

    return () => clearTimeout(timer);
  }, [state.status, state.loading, fen, gameId, ply, depth, profile]);

  return state;
}
