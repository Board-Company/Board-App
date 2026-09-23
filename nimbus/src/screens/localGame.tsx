import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Chess } from 'chess.js';
import type { ChessboardRef } from 'react-native-chessboard';
import ChessBoard from '../components/game/ChessBoard';
import GameOverOverlay from '../components/game/GameOverOverlay';
import MoveHistory from '../components/game/MoveHistory';
import { saveCompletedLocalGame } from '../services/localGameHistory';
import { colors, radius, spacing } from '../theme';

type TimeControl = {
  label: string;
  minutes: number;
  incrementSeconds: number;
  category: string;             
};

type ChessboardMoveEvent = {
  move: {
    from: string;
    to: string;
    san?: string;
    promotion?: string;
  };
  state: {
    fen: string;
  };
};

type RootStackParamList = {
  MainTabs: undefined;
  LocalGame: undefined;
  LocalGameHistory: undefined;
};

const TIME_CONTROLS: TimeControl[] = [
  { label: 'No Clock', minutes: 0, incrementSeconds: 0, category: 'Casual' },
  { label: '1 | 0', minutes: 1, incrementSeconds: 0, category: 'Bullet' },
  { label: '3 | 2', minutes: 3, incrementSeconds: 2, category: 'Blitz' },
  { label: '5 | 0', minutes: 5, incrementSeconds: 0, category: 'Blitz' },
  { label: '10 | 0', minutes: 10, incrementSeconds: 0, category: 'Rapid' },
  { label: '15 | 10', minutes: 15, incrementSeconds: 10, category: 'Classical' },
];

const STARTING_FEN = new Chess().fen();

const formatClock = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const LocalGameScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const chessRef = useRef(new Chess());
  const chessboardRef = useRef<ChessboardRef>(null);
  const clockHistoryRef = useRef<Array<{ white: number; black: number }>>([]);
  const lastTickTimestampRef = useRef<number | null>(null);
  const whiteTimeRef = useRef(0);
  const blackTimeRef = useRef(0);
  const [fen, setFen] = useState(chessRef.current.fen());
  const [gameStatus, setGameStatus] = useState('White to move');
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [currentTurn, setCurrentTurn] = useState<'w' | 'b'>(chessRef.current.turn());
  const [boardOrientation, setBoardOrientation] = useState<'w' | 'b'>(chessRef.current.turn());
  const [selectedTimeControl, setSelectedTimeControl] = useState<TimeControl>(TIME_CONTROLS[0]);
  const [whiteTimeMs, setWhiteTimeMs] = useState(0);
  const [blackTimeMs, setBlackTimeMs] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isSetupScreen, setIsSetupScreen] = useState(true);
  const hasSavedCurrentGameRef = useRef(false);

  const persistCompletedGame = useCallback(
    async (
      result: string,
      resultType: 'checkmate' | 'stalemate' | 'repetition' | 'insufficient-material' | 'draw' | 'timeout',
    ) => {
      if (hasSavedCurrentGameRef.current || chessRef.current.history().length === 0) {
        return;
      }

      hasSavedCurrentGameRef.current = true;

      try {
        await saveCompletedLocalGame({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          playedAt: new Date().toISOString(),
          result,
          resultType,
          timeControlLabel: selectedTimeControl.label,
          timeControlCategory: selectedTimeControl.category,
          initialFen: STARTING_FEN,
          finalFen: chessRef.current.fen(),
          moves: chessRef.current.history(),
          pgn: chessRef.current.pgn(),
          whiteTimeMs: whiteTimeRef.current,
          blackTimeMs: blackTimeRef.current,
        });
      } catch (error) {
        hasSavedCurrentGameRef.current = false;
        console.warn('Failed to save completed local game', error);
      }
    },
    [selectedTimeControl],
  );

  const syncGameState = useCallback((options?: { syncHistory?: boolean; syncFen?: boolean }) => {
    const shouldSyncHistory = options?.syncHistory ?? true;
    const shouldSyncFen = options?.syncFen ?? true;
    const nextTurn = chessRef.current.turn();
    if (shouldSyncFen) {
      setFen(chessRef.current.fen());
    }
    if (shouldSyncHistory) {
      setMoveHistory(chessRef.current.history());
    }
    setCurrentTurn(nextTurn);
    setBoardOrientation(nextTurn);
  }, []);

  const checkGameStatus = useCallback((_options?: { showAlert?: boolean }) => {
    if (chessRef.current.isCheckmate()) {
      const winner = chessRef.current.turn() === 'w' ? 'Black' : 'White';
      const message = `Checkmate! ${winner} wins`;
      setIsGameOver(true);
      setGameStatus(message);
      persistCompletedGame(message, 'checkmate');
      return;
    }

    if (chessRef.current.isStalemate()) {
      setIsGameOver(true);
      setGameStatus('Stalemate');
      persistCompletedGame('Stalemate', 'stalemate');
      return;
    }

    if (chessRef.current.isThreefoldRepetition()) {
      setIsGameOver(true);
      setGameStatus('Draw by repetition');
      persistCompletedGame('Draw by repetition', 'repetition');
      return;
    }

    if (chessRef.current.isInsufficientMaterial()) {
      setIsGameOver(true);
      setGameStatus('Draw by insufficient material');
      persistCompletedGame('Draw by insufficient material', 'insufficient-material');
      return;
    }

    if (chessRef.current.isDraw()) {
      setIsGameOver(true);
      setGameStatus('Draw');
      persistCompletedGame('Draw', 'draw');
      return;
    }

    setIsGameOver(false);

    if (chessRef.current.isCheck()) {
      setGameStatus(`${chessRef.current.turn() === 'w' ? 'White' : 'Black'} to move - Check!`);
      return;
    }

    setGameStatus(`${chessRef.current.turn() === 'w' ? 'White' : 'Black'} to move`);
  }, [persistCompletedGame]);

  const handleMove = useCallback(({ move, state }: ChessboardMoveEvent) => {
    try {
      const movingColor = chessRef.current.turn();
      const result = move.san
        ? chessRef.current.move(move.san)
        : chessRef.current.move({
            from: move.from,
            to: move.to,
            promotion: move.promotion ?? 'q',
          });

      if (!result) {
        chessRef.current.load(state.fen);
        setMoveHistory(chessRef.current.history());
        chessboardRef.current?.resetBoard(state.fen);
        syncGameState({ syncHistory: false, syncFen: true });
      } else {
        setMoveHistory(previous => [...previous, result.san]);
        clockHistoryRef.current.push({
          white: whiteTimeRef.current,
          black: blackTimeRef.current,
        });

        if (selectedTimeControl.minutes > 0 && selectedTimeControl.incrementSeconds > 0) {
          const incrementMs = selectedTimeControl.incrementSeconds * 1000;
          if (movingColor === 'w') {
            const nextWhiteTime = whiteTimeRef.current + incrementMs;
            whiteTimeRef.current = nextWhiteTime;
            setWhiteTimeMs(nextWhiteTime);
          } else {
            const nextBlackTime = blackTimeRef.current + incrementMs;
            blackTimeRef.current = nextBlackTime;
            setBlackTimeMs(nextBlackTime);
          }
        }

        // Library board already updated; skip setFen so ChessBoard memo does not re-render the tree.
        syncGameState({ syncHistory: false, syncFen: false });
      }

      checkGameStatus();
    } catch (error) {
      console.log('Invalid local move:', error);
    }
  }, [checkGameStatus, selectedTimeControl, syncGameState]);

  const resetClocks = useCallback((timeControl: TimeControl) => {
    const startingTime = timeControl.minutes * 60 * 1000;
    whiteTimeRef.current = startingTime;
    blackTimeRef.current = startingTime;
    lastTickTimestampRef.current = null;
    setWhiteTimeMs(startingTime);
    setBlackTimeMs(startingTime);
    clockHistoryRef.current = [];
  }, []);

  const applyTimeControl = useCallback((timeControl: TimeControl) => {
    setSelectedTimeControl(timeControl);
    resetClocks(timeControl);
    chessRef.current.reset();
    hasSavedCurrentGameRef.current = false;
    syncGameState();
    chessboardRef.current?.resetBoard(chessRef.current.fen());
    setIsGameOver(false);
    setGameStatus('White to move');
    setIsSetupScreen(false);
    checkGameStatus({ showAlert: false });
  }, [checkGameStatus, resetClocks, syncGameState]);

  const startNewGame = useCallback(() => {
    chessRef.current.reset();
    hasSavedCurrentGameRef.current = false;
    const nextFen = chessRef.current.fen();
    setFen(nextFen);
    setMoveHistory([]);
    setBoardOrientation(chessRef.current.turn());
    setCurrentTurn(chessRef.current.turn());
    chessboardRef.current?.resetBoard(nextFen);
    resetClocks(selectedTimeControl);
    setIsGameOver(false);
    setGameStatus('White to move');
    checkGameStatus({ showAlert: false });
  }, [checkGameStatus, resetClocks, selectedTimeControl]);

  const returnToSetup = useCallback(() => {
    chessRef.current.reset();
    hasSavedCurrentGameRef.current = false;
    syncGameState();
    resetClocks(selectedTimeControl);
    chessboardRef.current?.resetBoard(chessRef.current.fen());
    setIsGameOver(false);
    setGameStatus('White to move');
    setIsSetupScreen(true);
    checkGameStatus({ showAlert: false });
  }, [checkGameStatus, resetClocks, selectedTimeControl, syncGameState]);

  const undoMove = useCallback(() => {
    const undoneMove = chessRef.current.undo();
    if (!undoneMove) {
      return;
    }

    const nextFen = chessRef.current.fen();
    setFen(nextFen);
    setMoveHistory(chessRef.current.history());
    setBoardOrientation(chessRef.current.turn());
    setCurrentTurn(chessRef.current.turn());
    chessboardRef.current?.resetBoard(nextFen);
    const previousClockState = clockHistoryRef.current.pop();
    if (previousClockState) {
      whiteTimeRef.current = previousClockState.white;
      blackTimeRef.current = previousClockState.black;
      lastTickTimestampRef.current = Date.now();
      setWhiteTimeMs(previousClockState.white);
      setBlackTimeMs(previousClockState.black);
    }
    setIsGameOver(false);
    hasSavedCurrentGameRef.current = false;
    checkGameStatus({ showAlert: false });
  }, [checkGameStatus]);

  useEffect(() => {
    syncGameState();
    checkGameStatus({ showAlert: false });
    resetClocks(selectedTimeControl);
  }, [checkGameStatus, resetClocks, selectedTimeControl, syncGameState]);

  useEffect(() => {
    if (selectedTimeControl.minutes === 0 || isGameOver) {
      return;
    }

    lastTickTimestampRef.current = Date.now();

    const interval = setInterval(() => {
      const activeColor = chessRef.current.turn();
      const now = Date.now();
      const previousTick = lastTickTimestampRef.current ?? now;
      const elapsed = now - previousTick;
      lastTickTimestampRef.current = now;

      if (activeColor === 'w') {
        const nextWhiteTime = Math.max(0, whiteTimeRef.current - elapsed);
        whiteTimeRef.current = nextWhiteTime;
        setWhiteTimeMs(nextWhiteTime);

        if (nextWhiteTime === 0) {
          setIsGameOver(true);
          setGameStatus('White flagged - Black wins');
          persistCompletedGame('White flagged - Black wins', 'timeout');
        }
      } else {
        const nextBlackTime = Math.max(0, blackTimeRef.current - elapsed);
        blackTimeRef.current = nextBlackTime;
        setBlackTimeMs(nextBlackTime);

        if (nextBlackTime === 0) {
          setIsGameOver(true);
          setGameStatus('Black flagged - White wins');
          persistCompletedGame('Black flagged - White wins', 'timeout');
        }
      }
    }, 1000);

    return () => clearInterval(interval);
    // `persistCompletedGame` is intentionally not a dependency: it changes identity as
    // the game progresses, and restarting this 1s interval on each change would drift
    // the clock. It is only called on a flag, at which point the effect is torn down.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGameOver, selectedTimeControl]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('MainTabs')}>
            <Icon name="arrow-back" size={24} color={colors.accent} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.title}>Local Game</Text>
            <Text style={styles.subtitle}>
              {isSetupScreen ? 'Choose a mode and start a pass-and-play game' : 'Pass and play on one device'}
            </Text>
            {!isSetupScreen && <Text style={styles.status}>{gameStatus}</Text>}
          </View>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('LocalGameHistory')}>
            <Icon name="history" size={24} color={colors.accent} />
          </TouchableOpacity>
        </View>
      </View>

      {isSetupScreen ? (
        <View style={styles.setupScreen}>
          <View style={styles.selectedModeSummary}>
            <Text style={styles.selectedModeSummaryLabel}>Selected Mode</Text>
            <Text style={styles.selectedModeSummaryValue}>{selectedTimeControl.label}</Text>
            <Text style={styles.selectedModeSummaryMeta}>
              {selectedTimeControl.minutes === 0
                ? 'Untimed local play'
                : `${selectedTimeControl.category} • ${selectedTimeControl.minutes} min${selectedTimeControl.incrementSeconds ? ` + ${selectedTimeControl.incrementSeconds}s increment` : ''}`}
            </Text>
          </View>

          <View style={styles.modeBanner}>
            <View style={styles.modeBannerHeader}>
              <Text style={styles.modeBannerTitle}>Game Mode</Text>
              <Text style={styles.modeBannerSubtitle}>Pick a time control, then start the game</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.modeBannerScroll}
            >
              {TIME_CONTROLS.map(timeControl => (
                <TouchableOpacity
                  key={timeControl.label}
                  style={[
                    styles.modeCard,
                    selectedTimeControl.label === timeControl.label && styles.selectedModeCard,
                  ]}
                  onPress={() => setSelectedTimeControl(timeControl)}
                >
                  <Text style={styles.modeCategory}>{timeControl.category}</Text>
                  <Text style={styles.modeLabel}>{timeControl.label}</Text>
                  <Text style={styles.modeMeta}>
                    {timeControl.minutes === 0 ? 'Untimed local play' : `${timeControl.minutes} min${timeControl.incrementSeconds ? ` + ${timeControl.incrementSeconds}s` : ''}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <TouchableOpacity style={styles.startGameButton} onPress={() => applyTimeControl(selectedTimeControl)}>
            <Text style={styles.startGameButtonText}>Start Game</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
      <View style={styles.clockRow}>
        <View style={[styles.clockCard, currentTurn === 'w' && !isGameOver && styles.activeClockCard]}>
          <Text style={styles.clockLabel}>White</Text>
          <Text style={styles.clockValue}>{selectedTimeControl.minutes === 0 ? 'No clock' : formatClock(whiteTimeMs)}</Text>
        </View>
        <View style={[styles.clockCard, currentTurn === 'b' && !isGameOver && styles.activeClockCard]}>
          <Text style={styles.clockLabel}>Black</Text>
          <Text style={styles.clockValue}>{selectedTimeControl.minutes === 0 ? 'No clock' : formatClock(blackTimeMs)}</Text>
        </View>
      </View>

      <View style={styles.boardContainer}>
        <ChessBoard
          ref={chessboardRef}
          fen={fen}
          onMove={handleMove}
          playerColor={boardOrientation}
          gestureEnabled={!isGameOver}
          moveAnimationDuration={0}
        />
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.button} onPress={startNewGame}>
          <Text style={styles.buttonText}>New Game</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={undoMove}>
          <Text style={styles.buttonText}>Undo</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.modeActionsRow}>
        <TouchableOpacity style={styles.secondaryButton} onPress={returnToSetup}>
          <Text style={styles.buttonText}>Change Mode</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footerSpacer} />
      <MoveHistory moves={moveHistory} />
      <GameOverOverlay
        visible={isGameOver}
        title={gameStatus.includes('Checkmate') ? 'Checkmate' : gameStatus.split(' - ')[0] || 'Game over'}
        subtitle={gameStatus}
        primaryLabel="New game"
        onPrimary={startNewGame}
        secondaryLabel="History"
        onSecondary={() => navigation.navigate('LocalGameHistory')}
      />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  header: {
    marginBottom: 20,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
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
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: 'bold',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 6,
  },
  status: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 10,
    textAlign: 'center',
  },
  boardContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupScreen: {
    flex: 1,
    justifyContent: 'center',
  },
  selectedModeSummary: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 18,
    marginBottom: 18,
  },
  selectedModeSummaryLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  selectedModeSummaryValue: {
    color: colors.textPrimary,
    fontSize: 30,
    fontWeight: '800',
    marginTop: spacing.sm,
  },
  selectedModeSummaryMeta: {
    color: colors.textPrimary,
    fontSize: 14,
    marginTop: spacing.sm,
  },
  clockRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: 14,
  },
  clockCard: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  activeClockCard: {
    borderWidth: 2,
    borderColor: colors.accent,
  },
  clockLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  clockValue: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: 'bold',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 22,
    flexWrap: 'wrap',
  },
  modeActionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 14,
    marginBottom: 6,


  },
  modeBanner: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: 14,
  },
  modeBannerHeader: {
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  modeBannerTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  modeBannerSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  modeBannerScroll: {
    paddingHorizontal: 14,
    gap: 10,
  },
  modeCard: {
    width: 118,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  selectedModeCard: {
    backgroundColor: colors.accent,
  },
  modeCategory: {
    color: colors.textSecondary,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  modeLabel: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    marginTop: spacing.sm,
  },
  modeMeta: {
    color: colors.textPrimary,
    fontSize: 12,
    marginTop: 18,
  },
  startGameButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
  },
  startGameButtonText: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  button: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    marginHorizontal: spacing.sm,
  },
  secondaryButton: {
    backgroundColor: colors.textDisabled,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    marginHorizontal: spacing.sm,
  },
  buttonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  selectedButton: {
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.textPrimary,
  },
  footerSpacer: {
    height: 72,
  },
});

export default LocalGameScreen;
