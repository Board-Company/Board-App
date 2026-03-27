import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  getCompletedLocalGameById,
  type LocalGameRecord,
} from '../services/localGameHistory';

type RootStackParamList = {
  LocalGameHistory: undefined;
  LocalGameReview: { gameId: string };
};

const LocalGameReviewScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'LocalGameReview'>>();
  const [game, setGame] = useState<LocalGameRecord | null>(null);

  useEffect(() => {
    getCompletedLocalGameById(route.params.gameId).then(setGame);
  }, [route.params.gameId]);

  if (!game) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate('LocalGameHistory')}
          >
            <Icon name="arrow-back" size={24} color="#8CB369" />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.title}>Game Review</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Game not found</Text>
          <Text style={styles.emptySubtitle}>This saved game may have been removed from storage.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('LocalGameHistory')}>
          <Icon name="arrow-back" size={24} color="#8CB369" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Game Review</Text>
          <Text style={styles.subtitle}>{game.result}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <Text style={styles.summaryLine}>Played: {new Date(game.playedAt).toLocaleString()}</Text>
          <Text style={styles.summaryLine}>
            Time control: {game.timeControlCategory} • {game.timeControlLabel}
          </Text>
          <Text style={styles.summaryLine}>Result type: {game.resultType}</Text>
          <Text style={styles.summaryLine}>Final FEN: {game.finalFen}</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Moves</Text>
          <Text style={styles.movesText}>
            {game.moves.length > 0 ? game.moves.join(' ') : 'No moves recorded'}
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>PGN</Text>
          <Text style={styles.movesText}>{game.pgn || 'No PGN recorded'}</Text>
        </View>
      </ScrollView>
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
    color: '#8CB369',
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  content: {
    paddingBottom: 24,
    gap: 14,
  },
  summaryCard: {
    backgroundColor: '#333333',
    borderRadius: 14,
    padding: 16,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  summaryLine: {
    color: '#C8D5B9',
    fontSize: 14,
    marginBottom: 8,
  },
  movesText: {
    color: 'white',
    fontSize: 14,
    lineHeight: 22,
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
});

export default LocalGameReviewScreen;
