import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCAL_GAME_HISTORY_KEY = 'local_game_history_v1';
const MAX_SAVED_GAMES = 50;

export type LocalGameHistoryEntry = {
  id: string;
  playedAt: string;
  result: string;
  resultType: 'checkmate' | 'stalemate' | 'repetition' | 'insufficient-material' | 'draw' | 'timeout';
  timeControlLabel: string;
  timeControlCategory: string;
  initialFen: string;
  finalFen: string;
  moves: string[];
  pgn: string;
  whiteTimeMs: number;
  blackTimeMs: number;
};

const parseHistory = (value: string | null): LocalGameHistoryEntry[] => {
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

export const getLocalGameHistory = async (): Promise<LocalGameHistoryEntry[]> => {
  const storedValue = await AsyncStorage.getItem(LOCAL_GAME_HISTORY_KEY);
  return parseHistory(storedValue);
};

export const saveCompletedLocalGame = async (entry: LocalGameHistoryEntry): Promise<void> => {
  const existingHistory = await getLocalGameHistory();
  const nextHistory = [entry, ...existingHistory].slice(0, MAX_SAVED_GAMES);
  await AsyncStorage.setItem(LOCAL_GAME_HISTORY_KEY, JSON.stringify(nextHistory));
};

export const clearLocalGameHistory = async (): Promise<void> => {
  await AsyncStorage.removeItem(LOCAL_GAME_HISTORY_KEY);
};
