import { BASE_URL } from '@env';
import { getAccessToken } from './auth';

const apiBase = BASE_URL.replace(/\/+$/, '');

export type OnlineCompletedGame = {
  id: string;
  game_id: string;
  white_player_id: string;
  /** Null if the lobby expired before an opponent joined (abandoned). */
  black_player_id: string | null;
  white_username: string | null;
  black_username: string | null;
  move_history: string[];
  final_fen: string;
  result: string;
  finished_reason: string | null;
  started_at: string;
  finished_at: string;
};

async function authHeaders(): Promise<Record<string, string>> {
  const t = await getAccessToken();
  if (!t) {
    throw new Error('Not logged in');
  }
  return { Authorization: `Bearer ${t}` };
}

export async function fetchMyCompletedOnlineGames(): Promise<OnlineCompletedGame[]> {
  const h = await authHeaders();
  const r = await fetch(`${apiBase}/games/me/completed`, { headers: { ...h } });
  if (!r.ok) {
    throw new Error((await r.text()) || 'Failed to load online game history');
  }
  return r.json();
}

export async function fetchCompletedOnlineGame(gameId: string): Promise<OnlineCompletedGame> {
  const h = await authHeaders();
  const r = await fetch(`${apiBase}/games/me/completed/${encodeURIComponent(gameId)}`, {
    headers: { ...h },
  });
  if (!r.ok) {
    throw new Error((await r.text()) || 'Failed to load game');
  }
  return r.json();
}
