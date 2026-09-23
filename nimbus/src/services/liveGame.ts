import { getAccessToken } from './auth';
import { API_URL } from '../env';

/** Live friend-game state, as published on `game:events:{id}` and returned by `/games/*`. */
export type LiveGameState = {
  game_id: string;
  fen: string;
  move_history: string[];
  status: 'waiting' | 'active' | 'finished';
  side_to_move: 'w' | 'b';
  white_player_id: string | null;
  black_player_id: string | null;
  white_username: string | null;
  black_username: string | null;
  invite_code: string | null;
  result: string | null;
  finished_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type ViewerRole = 'white' | 'black' | 'spectator';

export type WatchGameResponse = {
  state: LiveGameState;
  role: ViewerRole;
  spectator_count: number;
};

export const authHeader = async (): Promise<Record<string, string>> => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not logged in');
  }
  return { Authorization: `Bearer ${token}` };
};

/**
 * Open a live game as a viewer with the invite code players share.
 *
 * Players get their own seat back (`role` is white or black); everyone else is
 * registered as a spectator, which is what lets them read the state and stream updates.
 */
export const watchLiveGame = async (params: {
  inviteCode?: string;
  gameId?: string;
}): Promise<WatchGameResponse> => {
  const body: Record<string, string> = {};
  if (params.inviteCode) {
    body.invite_code = params.inviteCode.trim().toUpperCase();
  }
  if (params.gameId) {
    body.game_id = params.gameId;
  }
  const headers = await authHeader();
  const res = await fetch(`${API_URL}/games/watch`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 404) {
    throw new Error('No live game for that code. It may have finished or expired.');
  }
  if (!res.ok) {
    throw new Error((await res.text()) || 'Could not open that game');
  }
  return (await res.json()) as WatchGameResponse;
};

/** Latest state for a game the caller may view (player or registered spectator). */
export const fetchLiveGame = async (gameId: string): Promise<LiveGameState> => {
  const headers = await authHeader();
  const res = await fetch(`${API_URL}/games/${gameId}`, { headers });
  if (!res.ok) {
    throw new Error((await res.text()) || 'Sync failed');
  }
  return (await res.json()) as LiveGameState;
};

export const liveGameEventsUrl = (gameId: string): string =>
  `${API_URL}/games/${gameId}/events`;

export const gameResultCopy = (
  state: LiveGameState,
): { title: string; subtitle: string } => {
  const reason = (state.finished_reason ?? '').replace(/_/g, ' ');
  const pretty = reason ? reason.charAt(0).toUpperCase() + reason.slice(1) : '';
  if (state.result === '1-0') {
    return { title: 'White wins', subtitle: pretty || 'Game over' };
  }
  if (state.result === '0-1') {
    return { title: 'Black wins', subtitle: pretty || 'Game over' };
  }
  if (state.result === '1/2-1/2') {
    return { title: 'Draw', subtitle: pretty || 'The game is drawn' };
  }
  return { title: 'Game over', subtitle: pretty || 'This match has ended' };
};
