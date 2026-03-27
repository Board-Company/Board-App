import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCAL_GAME_HISTORY_KEY = 'local_game_history_v1';
const MAX_SAVED_GAMES = 50;

export type LocalGameResultType =
  | 'checkmate'
  | 'stalemate'
  | 'repetition'
  | 'insufficient-material'
  | 'draw'
  | 'timeout';

export type LocalGameRecord = {
  id: string;
  playedAt: string;
  result: string;
  resultType: LocalGameResultType;
  timeControlLabel: string;
  timeControlCategory: string;
  initialFen: string;
  finalFen: string;
  moves: string[];
  pgn: string;
  whiteTimeMs: number;
  blackTimeMs: number;
};

/** Alias for older naming */
export type LocalGameHistoryEntry = LocalGameRecord;

const parseHistory = (value: string | null): LocalGameRecord[] => {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Failed to parse local game history', error);
    return [];
  }
};

const readHistory = async (): Promise<LocalGameRecord[]> => {
  const raw = await AsyncStorage.getItem(LOCAL_GAME_HISTORY_KEY);
  return parseHistory(raw);
};

const writeHistory = async (games: LocalGameRecord[]) => {
  await AsyncStorage.setItem(LOCAL_GAME_HISTORY_KEY, JSON.stringify(games));
};

export const saveCompletedLocalGame = async (game: LocalGameRecord): Promise<void> => {
  const games = await readHistory();
  const nextGames = [game, ...games.filter(existing => existing.id !== game.id)].slice(0, MAX_SAVED_GAMES);
  await writeHistory(nextGames);
};

export const getCompletedLocalGames = async (): Promise<LocalGameRecord[]> => {
  const games = await readHistory();
  return games.sort((a, b) => Date.parse(b.playedAt) - Date.parse(a.playedAt));
};

/** Alias — same as getCompletedLocalGames */
export const getLocalGameHistory = getCompletedLocalGames;

export const getCompletedLocalGameById = async (gameId: string): Promise<LocalGameRecord | null> => {
  const games = await readHistory();
  return games.find(g => g.id === gameId) ?? null;
};

export const clearLocalGameHistory = async (): Promise<void> => {
  await AsyncStorage.removeItem(LOCAL_GAME_HISTORY_KEY);
};
