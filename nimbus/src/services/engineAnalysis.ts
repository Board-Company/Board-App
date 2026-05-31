import { BASE_URL } from '@env';
import { getAccessToken } from './auth';

// @ts-ignore rn-eventsource has no types
import EventSource from 'rn-eventsource';

const apiBase = BASE_URL.replace(/\/+$/, '');

export type EngineJobStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';

export type EngineAnalysisLine = {
  uci_pv: string[];
  score_cp: number | null;
  score_mate: number | null;
};

export type EngineJobResult = {
  job_id: string;
  fen: string;
  status: EngineJobStatus;
  depth?: number | null;
  multipv?: number | null;
  lines: EngineAnalysisLine[];
  bestmove_uci?: string | null;
  engine_time_ms?: number | null;
  error?: string | null;
};

export type EngineJobEvent = {
  job_id: string;
  fen: string;
  status: EngineJobStatus;
  result: EngineJobResult | null;
  error: string | null;
  updated_at: string;
};

export type CreateEngineJobParams = {
  fen?: string;
  game_id?: string;
  ply?: number;
  depth: number;
  multipv?: number;
  profile?: 'play' | 'analysis';
  movetime_ms?: number;
  idempotencyKey?: string;
};

export const LIVE_ENGINE_DEPTH = 12;
export const REVIEW_ENGINE_DEPTH = 20;

export type EngineStatusTone = 'ok' | 'warn' | 'error' | 'neutral';

/** True when API can reach Redis db 1 (engine job queue). Does not prove workers are running. */
export async function fetchEngineQueueHealth(): Promise<boolean> {
  try {
    const r = await fetch(`${apiBase}/health`);
    if (!r.ok) {
      return false;
    }
    const data = (await r.json()) as { redis_engine?: boolean };
    return data.redis_engine === true;
  } catch {
    return false;
  }
}

export function resolveEngineStatusLine(opts: {
  queueAvailable: boolean | null;
  status: EngineJobStatus | null;
  loading: boolean;
  error: string | null;
  waitingForWorker: boolean;
}): { line: string; tone: EngineStatusTone } {
  const { queueAvailable, status, loading, error, waitingForWorker } = opts;

  if (error) {
    return { line: 'Engine unavailable — check API and worker', tone: 'error' };
  }
  if (queueAvailable === null) {
    return { line: 'Checking engine queue…', tone: 'neutral' };
  }
  if (!queueAvailable) {
    return {
      line: 'Engine queue offline — start Redis and set REDIS_ENGINE_URL on the API',
      tone: 'error',
    };
  }
  if (waitingForWorker) {
    return {
      line: 'Waiting for engine worker — run python -m engine_worker or ./scripts/docker-stack.sh up',
      tone: 'warn',
    };
  }
  if (status === 'queued' && loading) {
    return { line: 'Job queued…', tone: 'warn' };
  }
  if (status === 'running' && loading) {
    return { line: 'Stockfish analyzing this position…', tone: 'ok' };
  }
  if (status === 'done' && !loading) {
    return { line: 'Analysis ready · worker queue connected', tone: 'ok' };
  }
  if (status === 'failed') {
    return { line: 'Analysis failed', tone: 'error' };
  }
  if (status === 'cancelled') {
    return { line: 'Analysis cancelled', tone: 'neutral' };
  }
  return { line: 'Worker queue connected', tone: 'ok' };
}

async function authHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const t = await getAccessToken();
  if (!t) {
    throw new Error('Not logged in');
  }
  return { Authorization: `Bearer ${t}`, ...extra };
}

export function isTerminalEngineStatus(status: EngineJobStatus): boolean {
  return status === 'done' || status === 'failed' || status === 'cancelled';
}

export function formatEngineEval(result: EngineJobResult | null | undefined): string {
  const line = result?.lines?.[0];
  if (!line) {
    return '—';
  }
  if (line.score_mate != null) {
    const sign = line.score_mate > 0 ? '+' : '';
    return `M${sign}${line.score_mate}`;
  }
  if (line.score_cp != null) {
    const pawns = line.score_cp / 100;
    return `${pawns > 0 ? '+' : ''}${pawns.toFixed(2)}`;
  }
  return '—';
}

/** 0–100 share for a white/black eval bar (50 = equal). */
export function engineEvalWhiteShare(result: EngineJobResult | null | undefined): number {
  const line = result?.lines?.[0];
  if (!line) {
    return 50;
  }
  if (line.score_mate != null) {
    if (line.score_mate > 0) {
      return 95;
    }
    if (line.score_mate < 0) {
      return 5;
    }
    return 50;
  }
  if (line.score_cp != null) {
    const pawns = Math.max(-8, Math.min(8, line.score_cp / 100));
    return ((pawns + 8) / 16) * 100;
  }
  return 50;
}

export function describeEngineAdvantage(result: EngineJobResult | null | undefined): string {
  const line = result?.lines?.[0];
  if (!line) {
    return 'Analyzing…';
  }
  if (line.score_mate != null) {
    if (line.score_mate > 0) {
      return 'White is winning';
    }
    if (line.score_mate < 0) {
      return 'Black is winning';
    }
    return 'Checkmate';
  }
  if (line.score_cp != null) {
    if (Math.abs(line.score_cp) < 25) {
      return 'Equal position';
    }
    return line.score_cp > 0 ? 'White is better' : 'Black is better';
  }
  return '—';
}

export async function createEngineJob(params: CreateEngineJobParams): Promise<{ job_id: string }> {
  const h = await authHeaders({ 'Content-Type': 'application/json' });
  const headers = { ...h };
  if (params.idempotencyKey) {
    headers['Idempotency-Key'] = params.idempotencyKey;
  }
  const body: Record<string, unknown> = {
    depth: params.depth,
    multipv: params.multipv ?? 1,
    profile: params.profile ?? 'analysis',
  };
  if (params.fen) {
    body.fen = params.fen;
  }
  if (params.game_id != null && params.ply != null) {
    body.game_id = params.game_id;
    body.ply = params.ply;
  }
  if (params.movetime_ms != null) {
    body.movetime_ms = params.movetime_ms;
  }
  const r = await fetch(`${apiBase}/engine/jobs`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    throw new Error((await r.text()) || 'Engine job failed');
  }
  const data = (await r.json()) as { job_id: string };
  return { job_id: data.job_id };
}

export async function fetchEngineJob(jobId: string): Promise<EngineJobEvent> {
  const h = await authHeaders();
  const r = await fetch(`${apiBase}/engine/jobs/${encodeURIComponent(jobId)}`, { headers: h });
  if (!r.ok) {
    throw new Error((await r.text()) || 'Failed to load engine job');
  }
  const data = await r.json();
  return {
    job_id: data.job_id,
    fen: data.fen,
    status: data.status,
    result: data.result ?? null,
    error: data.error ?? null,
    updated_at: data.updated_at,
  };
}

export async function cancelEngineJob(jobId: string): Promise<void> {
  const h = await authHeaders();
  await fetch(`${apiBase}/engine/jobs/${encodeURIComponent(jobId)}/cancel`, {
    method: 'POST',
    headers: h,
  });
}

function parseSseData(raw: string): EngineJobEvent | null {
  try {
    return JSON.parse(raw) as EngineJobEvent;
  } catch {
    return null;
  }
}

/** Poll job hash until terminal (fallback when SSE unavailable). */
export function pollEngineJob(
  jobId: string,
  onEvent: (event: EngineJobEvent) => void,
  onError: (err: Error) => void,
): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const tick = async () => {
    if (stopped) {
      return;
    }
    try {
      const evt = await fetchEngineJob(jobId);
      if (stopped) {
        return;
      }
      onEvent(evt);
      if (isTerminalEngineStatus(evt.status)) {
        return;
      }
      timer = setTimeout(tick, 450);
    } catch (e: unknown) {
      if (!stopped) {
        onError(e instanceof Error ? e : new Error('Engine poll failed'));
      }
    }
  };

  tick();

  return () => {
    stopped = true;
    if (timer) {
      clearTimeout(timer);
    }
  };
}

/**
 * Subscribe to GET /engine/jobs/{id}/events (SSE). Falls back to polling on stream error.
 */
export async function subscribeEngineJobEvents(
  jobId: string,
  onEvent: (event: EngineJobEvent) => void,
  onError: (err: Error) => void,
): Promise<() => void> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not logged in');
  }

  const url = `${apiBase}/engine/jobs/${encodeURIComponent(jobId)}/events`;
  let stopped = false;
  let pollStop: (() => void) | null = null;
  let es: EventSource | null = null;

  const startPoll = () => {
    if (stopped || pollStop) {
      return;
    }
    pollStop = pollEngineJob(jobId, onEvent, onError);
  };

  try {
    es = new EventSource(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    es.onmessage = (message: { data?: string }) => {
      if (stopped || !message?.data) {
        return;
      }
      const evt = parseSseData(message.data);
      if (evt) {
        onEvent(evt);
      }
    };

    es.onerror = () => {
      if (stopped) {
        return;
      }
      es?.close();
      es = null;
      startPoll();
    };
  } catch {
    startPoll();
  }

  return () => {
    stopped = true;
    es?.close();
    pollStop?.();
  };
}
