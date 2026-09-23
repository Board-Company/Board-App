import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { resolveEngineStatusLine, REVIEW_ENGINE_DEPTH } from '../services/engineAnalysis';
import { fenReplayFromMoves } from '../services/gameReplay';
import { fetchCompletedOnlineGame, type OnlineCompletedGame } from '../services/onlineGameHistory';
import { colors, radius, spacing } from '../theme';

type RootStackParamList = {
  OnlineFriendGameHistory: undefined;
  OnlineFriendGameReview: { gameId: string };
};

const START = new Chess().fen();

const noopOnMove = () => {};

const OnlineFriendGameReviewScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'OnlineFriendGameReview'>>();
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const maxBoard = Math.max(0, windowWidth - 80);
  const [game, setGame] = useState<OnlineCompletedGame | null>(null);
  const [moveIndex, setMoveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const g = await fetchCompletedOnlineGame(route.params.gameId);
      setGame(g);
      setMoveIndex(g.move_history.length > 0 ? 1 : 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setGame(null);
    } finally {
      setLoading(false);
    }
  }, [route.params.gameId]);

  useEffect(() => {
    load();
  }, [load]);

  const fenReplay = useMemo(
    () => (game ? fenReplayFromMoves(game.move_history) : []),
    [game],
  );
  const lastPly = Math.max(0, fenReplay.length - 1);
  const currentFen =
    game && fenReplay.length > 0
      ? (fenReplay[Math.min(moveIndex, lastPly)] ?? fenReplay[lastPly])
      : START;
  const currentMove =
    game && moveIndex > 0 ? game.move_history[moveIndex - 1] : null;

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

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  if (error || !game) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color={colors.accent} />
          </TouchableOpacity>
          <Text style={styles.title}>Review</Text>
          <View style={styles.iconButton} />
        </View>
        <Text style={styles.error}>{error ?? 'Game not found'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: Math.max(insets.bottom, 12) + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color={colors.accent} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.title}>Friend game</Text>
            <Text style={styles.subtitle}>{game.result}</Text>
          </View>
          <View style={styles.iconButton} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardText}>
            {game.white_username || 'White'} vs{' '}
            {game.black_player_id
              ? game.black_username || 'Black'
              : '— (opponent never joined)'}
          </Text>
          <Text style={styles.cardMeta}>
            Move {moveIndex} / {lastPly}
            {currentMove ? ` · ${currentMove}` : ''}
          </Text>
          {game.finished_reason ? (
            <Text style={styles.cardMeta}>{game.finished_reason.replace(/_/g, ' ')}</Text>
          ) : null}
        </View>

        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={[styles.ctrl, moveIndex === 0 && styles.ctrlDisabled]}
            onPress={() => setMoveIndex(0)}
            disabled={moveIndex === 0}
          >
            <Text style={styles.ctrlText}>Start</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.ctrl, moveIndex === 0 && styles.ctrlDisabled]}
            onPress={() => setMoveIndex(i => Math.max(0, i - 1))}
            disabled={moveIndex === 0}
          >
            <Text style={styles.ctrlText}>Prev</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.ctrl, moveIndex === lastPly && styles.ctrlDisabled]}
            onPress={() => setMoveIndex(i => Math.min(lastPly, i + 1))}
            disabled={moveIndex === lastPly}
          >
            <Text style={styles.ctrlText}>Next</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.ctrl, moveIndex === lastPly && styles.ctrlDisabled]}
            onPress={() => setMoveIndex(lastPly)}
            disabled={moveIndex === lastPly}
          >
            <Text style={styles.ctrlText}>End</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.boardWrap} pointerEvents="none">
          <ChessBoard
            key={`${game.game_id}-${moveIndex}`}
            fen={currentFen}
            onMove={noopOnMove}
            playerColor="w"
            gestureEnabled={false}
            moveAnimationDuration={0}
            maxBoardWidth={maxBoard}
          />
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
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 },
  center: { justifyContent: 'center', alignItems: 'center' },
  scroll: { flexGrow: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
  subtitle: { color: colors.textSecondary, fontSize: 14, marginTop: spacing.xs },
  loadingText: { color: colors.textFaint, marginTop: spacing.md },
  error: { color: colors.danger, textAlign: 'center', marginTop: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 14,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardText: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  cardMeta: { color: colors.textSecondary, fontSize: 13, marginTop: 6 },
  boardWrap: { alignItems: 'center', marginVertical: spacing.sm },
  controlsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center', marginTop: spacing.lg },
  ctrl: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    minWidth: 72,
    alignItems: 'center',
  },
  ctrlDisabled: { opacity: 0.4 },
  ctrlText: { color: colors.backgroundBlack, fontWeight: '800' },
});

export default OnlineFriendGameReviewScreen;
