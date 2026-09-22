import React, { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  clearLocalGameHistory,
  getCompletedLocalGames,
  type LocalGameRecord,
} from '../services/localGameHistory';
import { colors } from '../theme';

type RootStackParamList = {
  LocalGame: undefined;
  LocalGameHistory: undefined;
  LocalGameReview: { gameId: string };
};

const formatPlayedAt = (value: string) =>
  new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const LocalGameHistoryScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [games, setGames] = useState<LocalGameRecord[]>([]);

  const loadGames = useCallback(async () => {
    const nextGames = await getCompletedLocalGames();
    setGames(nextGames);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadGames();
    }, [loadGames]),
  );

  const handleClearHistory = () => {
    Alert.alert('Clear History', 'Remove all saved local games?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await clearLocalGameHistory();
          setGames([]);
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('LocalGame')}>
          <Icon name="arrow-back" size={24} color={colors.accent} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Local Game History</Text>
          <Text style={styles.subtitle}>Review your completed pass-and-play games</Text>
        </View>
        <TouchableOpacity style={styles.iconButton} onPress={handleClearHistory} disabled={games.length === 0}>
          <Icon name="delete-outline" size={24} color={games.length === 0 ? colors.textDisabled : colors.dangerMuted} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={games}
        keyExtractor={item => item.id}
        contentContainerStyle={games.length === 0 ? styles.emptyContainer : styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.gameCard}
            onPress={() => navigation.navigate('LocalGameReview', { gameId: item.id })}
          >
            <View style={styles.gameCardTop}>
              <View>
                <Text style={styles.gameResult}>{item.result}</Text>
                <Text style={styles.gameMeta}>
                  {item.timeControlLabel} • {item.timeControlCategory}
                </Text>
              </View>
              <Text style={styles.playedAt}>{formatPlayedAt(item.playedAt)}</Text>
            </View>
            <Text style={styles.gameDetails}>
              {item.moves.length} half-moves • {Math.ceil(item.moves.length / 2)} turns
            </Text>
            <Text style={styles.reviewPrompt}>Tap to review move by move</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="history" size={54} color={colors.textDisabled} />
            <Text style={styles.emptyTitle}>No saved games yet</Text>
            <Text style={styles.emptyText}>Finished local games will show up here automatically.</Text>
          </View>
        }
      />
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
    marginBottom: 20,
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
    fontSize: 28,
    fontWeight: 'bold',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 24,
    gap: 12,
  },
  gameCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  gameCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  gameResult: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  gameMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 6,
  },
  playedAt: {
    color: colors.textFaint,
    fontSize: 12,
  },
  gameDetails: {
    color: colors.textPrimary,
    fontSize: 14,
    marginTop: 14,
  },
  reviewPrompt: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 10,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 16,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 15,
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default LocalGameHistoryScreen;
