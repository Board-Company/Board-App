import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCAL_GAME_HISTORY_KEY = 'local_game_history_v1';

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

const readHistory = async (): Promise<LocalGameRecord[]> => {
  const raw = await AsyncStorage.getItem(LOCAL_GAME_HISTORY_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as LocalGameRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeHistory = async (games: LocalGameRecord[]) => {
  await AsyncStorage.setItem(LOCAL_GAME_HISTORY_KEY, JSON.stringify(games));
};

export const saveCompletedLocalGame = async (game: LocalGameRecord) => {
  const games = await readHistory();
  const nextGames = [game, ...games.filter(existing => existing.id !== game.id)];
  await writeHistory(nextGames);
};

export const getCompletedLocalGames = async () => {
  const games = await readHistory();
  return games.sort((a, b) => Date.parse(b.playedAt) - Date.parse(a.playedAt));
};

export const getCompletedLocalGameById = async (gameId: string) => {
  const games = await readHistory();
  return games.find(game => game.id === gameId) ?? null;
};
