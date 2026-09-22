// @ts-expect-error No types for rn-eventsource
import EventSource from 'rn-eventsource';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ChessBoard from '../components/game/ChessBoard';
import EngineEvalBar from '../components/game/EngineEvalBar';
import MoveHistory from '../components/game/MoveHistory';
import { useEngineAnalysis } from '../hooks/useEngineAnalysis';
import { getAccessToken } from '../services/auth';
import { LIVE_ENGINE_DEPTH } from '../services/engineAnalysis';
import {
  fetchLiveGame,
  gameResultCopy,
  liveGameEventsUrl,
  watchLiveGame,
  type LiveGameState,
  type ViewerRole,
} from '../services/liveGame';
import { colors } from '../theme';

const SIDE_EVAL_WIDTH = 28;
const SIDE_EVAL_GAP = 8;
const CONTAINER_PAD = 12;
const POLL_INTERVAL_MS = 2500;

type RootStackParamList = {
  SpectateGame: { gameId?: string; inviteCode?: string } | undefined;
  FriendGame: { gameId?: string } | undefined;
};

/** Spectator boards are read-only; ChessBoard still requires a move handler. */
const noop = () => {};

const playerLabel = (name: string | null, fallback: string) =>
  name?.trim() ? name.trim() : fallback;

const SpectateGameScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'SpectateGame'>>();

  const [codeInput, setCodeInput] = useState(route.params?.inviteCode ?? '');
  const [gameId, setGameId] = useState<string | null>(null);
  const [state, setState] = useState<LiveGameState | null>(null);
  const [role, setRole] = useState<ViewerRole>('spectator');
  const [spectators, setSpectators] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [live, setLive] = useState(false);
  const streamRef = useRef<InstanceType<typeof EventSource> | null>(null);
  const pollingRef = useRef(false);

  const engineEval = useEngineAnalysis({
    fen: state?.fen ?? null,
    depth: LIVE_ENGINE_DEPTH,
    profile: 'play',
    enabled: !!state && state.status === 'active',
  });

  const openGame = useCallback(
    async (params: { inviteCode?: string; gameId?: string }) => {
      setLoading(true);
      setErr(null);
      try {
        const watched = await watchLiveGame(params);
        setState(watched.state);
        setRole(watched.role);
        setSpectators(watched.spectator_count);
        setGameId(watched.state.game_id);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : 'Could not open that game');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Deep link or navigation params: open straight away.
  useEffect(() => {
    const { gameId: paramGameId, inviteCode } = route.params ?? {};
    if (paramGameId || inviteCode) {
      void openGame({ gameId: paramGameId, inviteCode });
    }
  }, [openGame, route.params]);

  const refresh = useCallback(async () => {
    if (!gameId) {
      return;
    }
    try {
      setState(await fetchLiveGame(gameId));
      setErr(null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Sync failed');
    }
  }, [gameId]);

  /** Same SSE stream the players use; falls back to polling if it errors. */
  useEffect(() => {
    if (!gameId || state?.status === 'finished') {
      return;
    }
    let cancelled = false;
    pollingRef.current = false;

    const connect = async () => {
      try {
        const token = await getAccessToken();
        if (!token || cancelled) {
          pollingRef.current = true;
          return;
        }
        const es = new EventSource(liveGameEventsUrl(gameId), {
          headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
        });
        streamRef.current = es;
        es.onmessage = (event: { data?: string } | string) => {
          const raw = event && typeof event === 'object' && 'data' in event ? event.data : event;
          try {
            const parsed = (typeof raw === 'string' ? JSON.parse(raw) : raw) as LiveGameState;
            setState(parsed);
            setLive(true);
            setErr(null);
            if (parsed.status === 'finished') {
              try {
                es.close();
              } catch {
                /* ignore */
              }
              if (streamRef.current === es) {
                streamRef.current = null;
              }
            }
          } catch {
            /* ignore malformed chunk */
          }
        };
        es.onerror = () => {
          try {
            es.close();
          } catch {
            /* ignore */
          }
          if (streamRef.current === es) {
            streamRef.current = null;
          }
          setLive(false);
          if (!cancelled) {
            pollingRef.current = true;
          }
        };
      } catch {
        if (!cancelled) {
          pollingRef.current = true;
        }
      }
    };

    void connect();
    return () => {
      cancelled = true;
      const current = streamRef.current;
      streamRef.current = null;
      setLive(false);
      try {
        current?.close();
      } catch {
        /* ignore */
      }
    };
  }, [gameId, state?.status]);

  useEffect(() => {
    if (!gameId || !pollingRef.current || state?.status === 'finished') {
      return;
    }
    void refresh();
    const interval = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [gameId, refresh, state?.status]);

  const leave = () => {
    setGameId(null);
    setState(null);
    setErr(null);
    setCodeInput('');
    navigation.setParams({ gameId: undefined, inviteCode: undefined });
  };

  if (!gameId || !state) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Watch a game</Text>
          <Text style={styles.hint}>
            Enter the invite code the players are using. You will see every move as it happens.
          </Text>
          {err ? <Text style={styles.error}>{err}</Text> : null}
          <TextInput
            style={styles.input}
            placeholder="INVITE CODE"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
            value={codeInput}
            onChangeText={setCodeInput}
            onSubmitEditing={() => void openGame({ inviteCode: codeInput })}
            returnKeyType="go"
          />
          <TouchableOpacity
            style={[styles.btn, (!codeInput.trim() || loading) && styles.btnDisabled]}
            onPress={() => void openGame({ inviteCode: codeInput })}
            disabled={!codeInput.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <Text style={styles.btnText}>Watch game</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  const isPlayer = role !== 'spectator';
  const showEval = state.status === 'active';
  const boardMaxWidth =
    Dimensions.get('window').width - CONTAINER_PAD * 2 - SIDE_EVAL_WIDTH - SIDE_EVAL_GAP;
  const boardSize = Math.floor(Math.max(boardMaxWidth, 0) / 8) * 8;
  const white = playerLabel(state.white_username, 'White');
  const black = playerLabel(state.black_username, 'Black');
  const toMove = state.side_to_move === 'w' ? white : black;
  const result = gameResultCopy(state);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={leave} hitSlop={8}>
          <Text style={styles.link}>Back</Text>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <View style={[styles.liveDot, live ? styles.liveDotOn : styles.liveDotOff]} />
          <Text style={styles.headerMeta}>
            {live ? 'Live' : 'Reconnecting'}
            {spectators > 0 ? ` · ${spectators} watching` : ''}
          </Text>
          <TouchableOpacity onPress={() => setFlipped(f => !f)} hitSlop={8}>
            <Text style={styles.link}>Flip</Text>
          </TouchableOpacity>
        </View>
      </View>

      {err ? <Text style={styles.error}>{err}</Text> : null}

      {isPlayer ? (
        <TouchableOpacity
          style={styles.ownGameBanner}
          onPress={() => navigation.navigate('FriendGame', { gameId: state.game_id })}
        >
          <Text style={styles.ownGameText}>
            You are playing as {role}. Tap to open the game and move.
          </Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.playersRow}>
        <View style={styles.playerCell}>
          <Text style={styles.playerName} numberOfLines={1}>
            {white}
          </Text>
          <Text style={styles.playerSide}>White</Text>
        </View>
        <Text style={styles.versus}>vs</Text>
        <View style={[styles.playerCell, styles.playerCellRight]}>
          <Text style={styles.playerName} numberOfLines={1}>
            {black}
          </Text>
          <Text style={styles.playerSide}>Black</Text>
        </View>
      </View>

      <Text style={styles.status}>
        {state.status === 'waiting' && 'Waiting for an opponent to join'}
        {state.status === 'active' && `${toMove} to move`}
        {state.status === 'finished' && `${result.title} — ${result.subtitle}`}
      </Text>

      <View style={styles.boardRow}>
        {showEval ? (
          <EngineEvalBar
            variant="side"
            evalText={engineEval.evalText}
            whiteShare={engineEval.whiteShare}
            depth={engineEval.depth}
            targetDepth={LIVE_ENGINE_DEPTH}
            loading={engineEval.loading}
            error={engineEval.error}
            flipped={flipped}
            barHeight={boardSize}
          />
        ) : null}
        <View style={styles.boardBlock}>
          <ChessBoard
            key={state.fen + state.updated_at}
            fen={state.fen}
            onMove={noop}
            playerColor={flipped ? 'b' : 'w'}
            gestureEnabled={false}
            moveAnimationDuration={10}
            maxBoardWidth={showEval ? boardMaxWidth : undefined}
          />
        </View>
      </View>

      <MoveHistory moves={state.move_history} variant="dark" layout="inline" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: CONTAINER_PAD },
  scroll: { padding: 16, gap: 16 },
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: 'bold' },
  hint: { color: colors.textFaint, fontSize: 14, lineHeight: 20 },
  input: {
    backgroundColor: colors.surfaceRaised,
    color: colors.textPrimary,
    padding: 14,
    borderRadius: 8,
    fontSize: 18,
    letterSpacing: 2,
  },
  btn: { backgroundColor: colors.accent, padding: 16, borderRadius: 10, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: colors.textPrimary, fontSize: 18, fontWeight: 'bold' },
  error: { color: colors.danger, marginBottom: 8 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerMeta: { color: colors.textFaint, fontSize: 13 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveDotOn: { backgroundColor: colors.accent },
  liveDotOff: { backgroundColor: colors.textFaint },
  link: { color: colors.accent, fontSize: 16 },
  ownGameBanner: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  ownGameText: { color: colors.textSecondary, fontSize: 13 },
  playersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
  },
  playerCell: { flex: 1, minWidth: 0 },
  playerCellRight: { alignItems: 'flex-end' },
  playerName: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  playerSide: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  versus: { color: colors.textFaint, fontSize: 12, fontWeight: '700' },
  status: { color: colors.textPrimary, textAlign: 'center', marginVertical: 8 },
  boardRow: {
    flex: 1,
    minHeight: 200,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIDE_EVAL_GAP,
  },
  boardBlock: { flex: 1, minHeight: 200, justifyContent: 'center' },
});

export default SpectateGameScreen;
