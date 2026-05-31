import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'nimbus_active_friend_game_id';

export async function getActiveFriendGameId(): Promise<string | null> {
  const v = await AsyncStorage.getItem(KEY);
  const t = v?.trim();
  return t || null;
}

export async function setActiveFriendGameId(gameId: string): Promise<void> {
  await AsyncStorage.setItem(KEY, gameId.trim());
}

export async function clearActiveFriendGameId(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
