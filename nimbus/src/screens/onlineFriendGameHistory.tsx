import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { getAccessToken } from '../services/auth';
import { API_URL } from '../env';
import {
  fetchMyCompletedOnlineGames,
  type OnlineCompletedGame,
} from '../services/onlineGameHistory';
import { colors } from '../theme';

const apiBase = API_URL;

type RootStackParamList = {
  MainTabs: undefined;
  OnlineFriendGameHistory: undefined;
  OnlineFriendGameReview: { gameId: string };
};

const formatFinished = (value: string) =>
  new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const OnlineFriendGameHistoryScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [myId, setMyId] = useState<string | null>(null);
  const [games, setGames] = useState<OnlineCompletedGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const loadGames = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const t = await getAccessToken();
      if (t) {
        const me = await fetch(`${apiBase}/users/me`, {
          headers: { Authorization: `Bearer ${t}` },
        });
        if (me.ok) {
          const u = await me.json();
          if (u?.id) {
            setMyId(String(u.id));
          }
        }
      }
      const rows = await fetchMyCompletedOnlineGames();
      setGames(rows);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to load');
      setGames([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadGames();
    }, [loadGames]),
  );

  const labelOpponents = (g: OnlineCompletedGame) => {
    const w = g.white_username || 'White';
    const b = g.black_username || (g.black_player_id ? 'Black' : '— (no opponent)');
    if (!myId) {
      return `${w} vs ${b}`;
    }
    if (g.white_player_id === myId) {
      return `You (White) vs ${b}`;
    }
    if (g.black_player_id && g.black_player_id === myId) {
      return `${w} vs You (Black)`;
    }
    return `${w} vs ${b}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={colors.accent} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Friend games online</Text>
          <Text style={styles.subtitle}>
            Finished, resigned, or expired lobbies from Play with Friend
          </Text>
        </View>
        <TouchableOpacity style={styles.iconButton} onPress={loadGames} disabled={loading}>
          <Icon name="refresh" size={24} color={loading ? colors.textDisabled : colors.accent} />
        </TouchableOpacity>
      </View>

      {err ? <Text style={styles.error}>{err}</Text> : null}

      {loading && games.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Loading history…</Text>
        </View>
      ) : (
        <FlatList
          data={games}
          keyExtractor={item => item.game_id}
          contentContainerStyle={games.length === 0 ? styles.emptyContainer : styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.gameCard}
              onPress={() =>
                navigation.navigate('OnlineFriendGameReview', { gameId: item.game_id })
              }
            >
              <View style={styles.gameCardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.gameResult}>{item.result}</Text>
                  <Text style={styles.reason}>
                    {item.finished_reason ? item.finished_reason.replace(/_/g, ' ') : '—'}
                  </Text>
                  <Text style={styles.players}>{labelOpponents(item)}</Text>
                </View>
                <Text style={styles.playedAt}>{formatFinished(item.finished_at)}</Text>
              </View>
              <Text style={styles.meta}>
                {item.move_history.length} half-moves • tap to review
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Icon name="cloud-off" size={54} color={colors.textDisabled} />
              <Text style={styles.emptyTitle}>No finished friend games yet</Text>
              <Text style={styles.emptyText}>
                Complete a game from Play with Friend — it will archive here automatically.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: 'bold',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  error: { color: colors.danger, marginBottom: 8, textAlign: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: colors.textFaint, marginTop: 12 },
  listContent: { paddingBottom: 24, gap: 12 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  gameCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  gameCardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  gameResult: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  reason: { color: colors.textMuted, fontSize: 13, marginTop: 4, textTransform: 'capitalize' },
  players: { color: colors.textSecondary, fontSize: 14, marginTop: 8 },
  playedAt: { color: colors.textFaint, fontSize: 12 },
  meta: { color: colors.accent, fontSize: 13, marginTop: 12, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingHorizontal: 24 },
  emptyTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '700', marginTop: 16 },
  emptyText: { color: colors.textSecondary, fontSize: 14, marginTop: 10, textAlign: 'center', lineHeight: 20 },
});

export default OnlineFriendGameHistoryScreen;
