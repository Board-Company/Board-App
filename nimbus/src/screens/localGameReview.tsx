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
import {
  getCompletedLocalGameById,
  type LocalGameRecord,
} from '../services/localGameHistory';

type RootStackParamList = {
  LocalGameHistory: undefined;
  LocalGameReview: { gameId: string };
};

const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getEvaluationFromChess = (chess: Chess) => {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w'
      ? { score: -100, label: 'M0', advantage: 'Black is winning' }
      : { score: 100, label: 'M0', advantage: 'White is winning' };
  }

  if (chess.isDraw() || chess.isStalemate() || chess.isInsufficientMaterial() || chess.isThreefoldRepetition()) {
    return { score: 0, label: '0.0', advantage: 'Equal position' };
  }

  let score = 0;

  chess.board().forEach(rank => {
    rank.forEach(square => {
      if (!square) {
        return;
      }

      const pieceValue = PIECE_VALUES[square.type] ?? 0;
      score += square.color === 'w' ? pieceValue : -pieceValue;
    });
  });

  const normalizedScore = clamp(score, -12, 12);

  if (normalizedScore === 0) {
    return { score: normalizedScore, label: '0.0', advantage: 'Equal position' };
  }

  return {
    score: normalizedScore,
    label: `${normalizedScore > 0 ? '+' : ''}${normalizedScore.toFixed(1)}`,
    advantage: normalizedScore > 0 ? 'White is better' : 'Black is better',
  };
};

const getEvaluation = (fen: string) => getEvaluationFromChess(new Chess(fen));

/** Single replay pass; material eval runs only for the current ply (not for every move on load). */
const buildFenReplay = (game: LocalGameRecord): string[] => {
  const chess = new Chess(game.initialFen);
  const fens: string[] = [chess.fen()];
  for (const move of game.moves) {
    chess.move(move);
    fens.push(chess.fen());
  }
  return fens;
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

  const fenReplay = useMemo(() => (game ? buildFenReplay(game) : []), [game]);
  const currentFen =
    game && fenReplay.length > 0
      ? (fenReplay[moveIndex] ?? fenReplay[fenReplay.length - 1])
      : (game?.finalFen ?? new Chess().fen());
  const currentMove = game && moveIndex > 0 ? game.moves[moveIndex - 1] : null;
  const evaluation = useMemo(() => getEvaluation(currentFen), [currentFen]);
  const whiteShare = clamp(((evaluation.score + 12) / 24) * 100, 0, 100);

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
            Move {moveIndex} / {game.moves.length}
          </Text>
          <Text style={styles.summaryText}>
            {currentMove ? `Last move: ${currentMove}` : 'Starting position'}
          </Text>
          <View style={styles.evalSummaryRow}>
            <Text style={styles.evalValue}>Eval {evaluation.label}</Text>
            <Text style={styles.evalSummaryText}>{evaluation.advantage}</Text>
          </View>
        </View>

        <View style={styles.boardCard}>
          <View style={styles.boardContainer}>
            {/* Remount per step: react-native-chessboard only reads initial `fen` once (no prop sync). */}
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

        <View style={styles.evalCard}>
          <View style={styles.evalCardHeader}>
            <Text style={styles.evalValue}>Eval {evaluation.label}</Text>
            <Text style={styles.evalSummaryText}>{evaluation.advantage}</Text>
          </View>
          <View style={styles.evalBarLabels}>
            <Text style={styles.evalPlayerLabel}>Black</Text>
            <Text style={styles.evalPlayerLabel}>White</Text>
          </View>
          <View style={styles.evalBarTrack}>
            <View style={[styles.evalBarBlack, { width: `${100 - whiteShare}%` }]} />
            <View style={[styles.evalBarWhite, { width: `${whiteShare}%` }]} />
          </View>
          <Text style={styles.evalHint}>Material-based estimate for quick review</Text>
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
            style={[styles.controlButton, moveIndex === game.moves.length && styles.disabledButton]}
            onPress={() => setMoveIndex(current => Math.min(game.moves.length, current + 1))}
            disabled={moveIndex === game.moves.length}
          >
            <Text style={styles.controlButtonText}>Next</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.controlButton, moveIndex === game.moves.length && styles.disabledButton]}
            onPress={() => setMoveIndex(game.moves.length)}
            disabled={moveIndex === game.moves.length}
          >
            <Text style={styles.controlButtonText}>End</Text>
          </TouchableOpacity>
        </View>
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
