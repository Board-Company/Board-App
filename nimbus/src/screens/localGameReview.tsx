import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Chess } from 'chess.js';
import ChessBoard from '../components/game/ChessBoard';
import EngineEvalBar from '../components/game/EngineEvalBar';
import { useEngineAnalysis } from '../hooks/useEngineAnalysis';
import { useEngineQueueHealth } from '../hooks/useEngineQueueHealth';
import { fenReplayFromMoves } from '../services/gameReplay';
import { resolveEngineStatusLine, REVIEW_ENGINE_DEPTH } from '../services/engineAnalysis';
import {
  getCompletedLocalGameById,
  type LocalGameRecord,
} from '../services/localGameHistory';

type RootStackParamList = {
  LocalGameHistory: undefined;
  LocalGameReview: { gameId: string };
};

const noopOnMove = () => {};

const LocalGameReviewScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'LocalGameReview'>>();
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  /** Smaller than full-width board: matches nested padding so it does not overflow safe layout. */
  const reviewBoardMaxWidth = Math.max(0, windowWidth - 80);
  const [game, setGame] = useState<LocalGameRecord | null>(null);
  const [moveIndex, setMoveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getCompletedLocalGameById(route.params.gameId).then(next => {
      if (cancelled) {
        return;
      }
      setGame(next);
      if (next) {
        setMoveIndex(next.moves.length > 0 ? 1 : 0);
      } else {
        setMoveIndex(0);
      }
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [route.params.gameId]);

  const fenReplay = useMemo(
    () => (game ? fenReplayFromMoves(game.moves, game.initialFen) : []),
    [game],
  );
  const lastPly = Math.max(0, fenReplay.length - 1);
  const currentFen =
    game && fenReplay.length > 0
      ? (fenReplay[Math.min(moveIndex, lastPly)] ?? fenReplay[lastPly])
      : (game?.finalFen ?? new Chess().fen());
  const currentMove = game && moveIndex > 0 ? game.moves[moveIndex - 1] : null;
  const { queueAvailable } = useEngineQueueHealth(!!game);
  const engineEval = useEngineAnalysis({
    fen: game ? currentFen : null,
    depth: REVIEW_ENGINE_DEPTH,
    profile: 'analysis',
    enabled: !!game,
  });
  const engineStatus = resolveEngineStatusLine({
    queueAvailable,
    status: engineEval.status,
    loading: engineEval.loading,
    error: engineEval.error,
    waitingForWorker: engineEval.waitingForWorker,
  });

  if (isLoading) {
    return (
      <View style={styles.container}>
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
          <View style={styles.iconButton} />
        </View>
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#8CB369" />
          <Text style={styles.loadingText}>Loading game review...</Text>
        </View>
      </View>
    );
  }

  if (!game) {
    return (
      <View style={styles.container}>
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
          <View style={styles.iconButton} />
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Game not found</Text>
          <Text style={styles.emptySubtitle}>This saved game may have been removed from storage.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 12) + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('LocalGameHistory')}>
            <Icon name="arrow-back" size={24} color="#8CB369" />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.title}>Game Review</Text>
            <Text style={styles.subtitle}>{game.result}</Text>
          </View>
          <View style={styles.iconButton} />
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryMode}>
            {game.timeControlLabel} • {game.timeControlCategory}
          </Text>
          <Text style={styles.summaryText}>
            Move {moveIndex} / {lastPly}
          </Text>
          <Text style={styles.summaryText}>
            {currentMove ? `Last move: ${currentMove}` : 'Starting position'}
          </Text>
        </View>

        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={[styles.controlButton, moveIndex === 0 && styles.disabledButton]}
            onPress={() => setMoveIndex(0)}
            disabled={moveIndex === 0}
          >
            <Text style={styles.controlButtonText}>Start</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.controlButton, moveIndex === 0 && styles.disabledButton]}
            onPress={() => setMoveIndex(current => Math.max(0, current - 1))}
            disabled={moveIndex === 0}
          >
            <Text style={styles.controlButtonText}>Previous</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.controlButton, moveIndex === lastPly && styles.disabledButton]}
            onPress={() => setMoveIndex(current => Math.min(lastPly, current + 1))}
            disabled={moveIndex === lastPly}
          >
            <Text style={styles.controlButtonText}>Next</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.controlButton, moveIndex === lastPly && styles.disabledButton]}
            onPress={() => setMoveIndex(lastPly)}
            disabled={moveIndex === lastPly}
          >
            <Text style={styles.controlButtonText}>End</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.boardCard}>
          <View style={styles.boardContainer} pointerEvents="none">
            <ChessBoard
              key={`${game.id}-${moveIndex}`}
              fen={currentFen}
              onMove={noopOnMove}
              playerColor="w"
              gestureEnabled={false}
              moveAnimationDuration={0}
              maxBoardWidth={reviewBoardMaxWidth}
            />
          </View>
        </View>

        <EngineEvalBar
          variant="review"
          evalText={engineEval.evalText}
          advantage={engineEval.advantage}
          whiteShare={engineEval.whiteShare}
          depth={engineEval.depth}
          targetDepth={REVIEW_ENGINE_DEPTH}
          loading={engineEval.loading}
          error={engineEval.error}
          label={`Stockfish · depth ${REVIEW_ENGINE_DEPTH}`}
          statusLine={engineStatus.line}
          statusTone={engineStatus.tone}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 20,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
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
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#8CB369',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: '#333333',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  summaryMode: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  summaryText: {
    color: '#C8D5B9',
    fontSize: 14,
    marginTop: 8,
  },
  evalSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    gap: 12,
  },
  evalValue: {
    color: 'white',
    fontSize: 18,
    fontWeight: '800',
  },
  evalSummaryText: {
    color: '#8CB369',
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  boardCard: {
    backgroundColor: '#333333',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginBottom: 12,
    alignSelf: 'center',
    maxWidth: '100%',
  },
  boardContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  evalCard: {
    backgroundColor: '#333333',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  evalCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  evalBarLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 8,
  },
  evalBarTrack: {
    width: '100%',
    height: 18,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#4A4A4A',
    flexDirection: 'row',
  },
  evalBarWhite: {
    height: '100%',
    backgroundColor: '#F2F2F2',
  },
  evalBarBlack: {
    height: '100%',
    backgroundColor: '#1A1A1A',
  },
  evalPlayerLabel: {
    color: '#C8D5B9',
    fontSize: 12,
    fontWeight: '700',
  },
  evalHint: {
    color: '#AAB79B',
    fontSize: 12,
    marginTop: 10,
    textAlign: 'center',
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  controlButton: {
    backgroundColor: '#8CB369',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  disabledButton: {
    backgroundColor: '#5D5D5D',
  },
  controlButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
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
  loadingText: {
    color: '#C8D5B9',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
});

export default LocalGameReviewScreen;
