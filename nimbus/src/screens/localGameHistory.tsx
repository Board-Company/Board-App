import React, { useCallback, useState } from 'react';
import { FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  getCompletedLocalGames,
  type LocalGameRecord,
} from '../services/localGameHistory';

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('LocalGame')}>
          <Icon name="arrow-back" size={24} color="#8CB369" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Local Game History</Text>
          <Text style={styles.subtitle}>Recent pass-and-play games saved on this device</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={games}
        keyExtractor={item => item.id}
        contentContainerStyle={games.length === 0 ? styles.emptyContent : styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('LocalGameReview', { gameId: item.id })}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.result}</Text>
              <Text style={styles.cardTime}>{formatPlayedAt(item.playedAt)}</Text>
            </View>
            <Text style={styles.cardMeta}>
              {item.timeControlCategory} • {item.timeControlLabel}
            </Text>
            <Text style={styles.cardMoves}>{item.moves.length} half-moves recorded</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No saved games yet</Text>
            <Text style={styles.emptySubtitle}>Finish a local game and it will appear here.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
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
  headerSpacer: {
    width: 40,
  },
  title: {
    color: 'white',
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: '#C8D5B9',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 24,
    gap: 12,
  },
  emptyContent: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: 'white',
    fontSize: 22,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: '#C8D5B9',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#333333',
    borderRadius: 14,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  cardTime: {
    color: '#C8D5B9',
    fontSize: 12,
  },
  cardMeta: {
    color: '#8CB369',
    fontSize: 13,
    marginTop: 8,
  },
  cardMoves: {
    color: 'white',
    fontSize: 13,
    marginTop: 6,
  },
});

export default LocalGameHistoryScreen;
