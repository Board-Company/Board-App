import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Chess } from 'chess.js';
import ChessBoard from '../components/game/ChessBoard';
import MoveHistory from '../components/game/MoveHistory';
import { getAccessToken } from '../services/auth';
import { fetchCompletedOnlineGame } from '../services/onlineGameHistory';
import { BASE_URL } from '@env';

const API_BASE_URL = BASE_URL.replace(/\/+$/, '');

type RootStackParamList = {
  FriendGame: undefined;
  OnlineFriendGameHistory: undefined;
  OnlineFriendGameReview: { gameId: string };
};

type FriendState = {
  game_id: string;
  fen: string;
  move_history: string[];
  status: 'waiting' | 'active' | 'finished';
  side_to_move: 'w' | 'b';
  white_player_id: string | null;
  black_player_id: string | null;
  white_username: string | null;
  black_username: string | null;
  invite_code: string | null;
  result: string | null;
  finished_reason: string | null;
  created_at: string;
  updated_at: string;
};

type ChessboardMove = {
  from: string;
  to: string;
  promotion?: string;
};

type ChessboardMoveEvent =
  | ChessboardMove
  | {
      move?: ChessboardMove;
    };

const extractMove = (event: ChessboardMoveEvent): ChessboardMove | null => {
  if ('move' in event) {
    return event.move ?? null;
  }
  if ('from' in event && 'to' in event) {
    return event;
  }
  return null;
};

const FriendGameScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [phase, setPhase] = useState<'lobby' | 'play'>('lobby');
  const [inviteInput, setInviteInput] = useState('');
  const [gameId, setGameId] = useState<string | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [state, setState] = useState<FriendState | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const openReview = useCallback(
    (gid: string) => {
      navigation.replace('OnlineFriendGameReview', { gameId: gid });
    },
    [navigation],
  );

  const authHeader = async (): Promise<Record<string, string>> => {
    const t = await getAccessToken();
    if (!t) {
      throw new Error('Not logged in');
    }
    return { Authorization: `Bearer ${t}` };
  };

  const loadMe = useCallback(async () => {
    try {
      const h = await authHeader();
      const r = await fetch(`${API_BASE_URL}/users/me`, { headers: { ...h } });
      if (!r.ok) {
        return;
      }
      const u = await r.json();
      if (u?.id) {
        setMyId(String(u.id));
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const refresh = useCallback(
    async (gid?: string) => {
      const id = gid ?? gameId;
      if (!id) {
        return;
      }
      try {
        const h = await authHeader();
        const r = await fetch(`${API_BASE_URL}/games/${id}`, { headers: { ...h } });
        if (r.status === 404) {
          try {
            await fetchCompletedOnlineGame(id);
            openReview(id);
            return;
          } catch {
            setErr('Game ended, expired, or not found');
          }
          return;
        }
        if (!r.ok) {
          throw new Error(await r.text());
        }
        setState(await r.json());
        setErr(null);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : 'Sync failed');
      }
    },
    [gameId, openReview],
  );

  useEffect(() => {
    if (!gameId || phase !== 'play' || state?.status === 'finished') {
      return;
    }
    refresh(gameId);
    const interval = setInterval(() => refresh(gameId), 2500);
    return () => clearInterval(interval);
  }, [gameId, phase, refresh, state?.status]);

  const createGame = async () => {
    setLoading(true);
    setErr(null);
    try {
      const h = await authHeader();
      const r = await fetch(`${API_BASE_URL}/games`, { method: 'POST', headers: { ...h } });
      if (!r.ok) {
        throw new Error((await r.text()) || 'Create failed');
      }
      const data = (await r.json()) as { game_id: string; invite_code: string };
      setGameId(data.game_id);
      setPhase('play');
      await refresh(data.game_id);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setLoading(false);
    }
  };

  const joinGame = async () => {
    const code = inviteInput.trim().toUpperCase();
    if (!code) {
      setErr('Enter invite code');
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const h = await authHeader();
      const r = await fetch(`${API_BASE_URL}/games/join`, {
        method: 'POST',
        headers: { ...h, 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_code: code }),
      });
      if (!r.ok) {
        throw new Error((await r.text()) || 'Join failed');
      }
      const s = (await r.json()) as FriendState;
      setGameId(s.game_id);
      setPhase('play');
      setState(s);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Join failed');
    } finally {
      setLoading(false);
    }
  };

  const leaveLobby = () => {
    setPhase('lobby');
    setGameId(null);
    setState(null);
    setInviteInput('');
    setErr(null);
  };

  const isMyTurn =
    state &&
    state.status === 'active' &&
    myId &&
    ((state.side_to_move === 'w' && state.white_player_id === myId) ||
      (state.side_to_move === 'b' && state.black_player_id === myId));

  const playerColor: 'w' | 'b' =
    myId && state?.white_player_id === myId ? 'w' : 'b';
  const creatorName = state?.white_username?.trim() || 'Host';
  const isCreatorView = !!(state && myId && state.white_player_id === myId);
  const sessionBannerText = isCreatorView
    ? state?.black_username
      ? `${state.black_username} joined your game session.`
      : 'This is your game session. Share the invite code so a friend can join.'
    : `${creatorName} created this game session.`;

  const handleMove = async (event: ChessboardMoveEvent) => {
    if (!state || !gameId || state.status !== 'active' || !isMyTurn) {
      return;
    }
    const move = extractMove(event);
    if (!move?.from || !move?.to) {
      return;
    }
    const copy = new Chess(state.fen);
    const m = copy.move({
      from: move.from,
      to: move.to,
      promotion: move.promotion ?? 'q',
    });
    if (!m) {
      return;
    }
    try {
      const h = await authHeader();
      const r = await fetch(`${API_BASE_URL}/games/${gameId}/move`, {
        method: 'POST',
        headers: { ...h, 'Content-Type': 'application/json' },
        body: JSON.stringify({ san: m.san }),
      });
      if (!r.ok) {
        const t = await r.text();
        Alert.alert('Move rejected', t);
        refresh(gameId);
        return;
      }
      const next = (await r.json()) as FriendState;
      setState(next);
      if (next.status === 'finished') {
        openReview(next.game_id);
      }
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Move failed');
      refresh(gameId);
    }
  };

  const resign = async () => {
    if (!gameId || !state || state.status !== 'active') {
      return;
    }
    Alert.alert('Resign?', 'You will lose the game.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Resign',
        style: 'destructive',
        onPress: async () => {
          try {
            const h = await authHeader();
            const r = await fetch(`${API_BASE_URL}/games/${gameId}/resign`, {
              method: 'POST',
              headers: { ...h },
            });
            if (!r.ok) {
              Alert.alert('Error', await r.text());
              return;
            }
            const next = (await r.json()) as FriendState;
            setState(next);
            openReview(next.game_id);
          } catch (e: unknown) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Resign failed');
          }
        },
      },
    ]);
  };

  if (phase === 'lobby') {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Play a friend</Text>
          <Text style={styles.hint}>
            Backend needs Redis and the completed_games table in Supabase. Set BASE_URL in .env to your API (e.g. EC2).
          </Text>
          {err ? <Text style={styles.error}>{err}</Text> : null}
          <TouchableOpacity style={styles.btn} onPress={createGame} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create game</Text>}
          </TouchableOpacity>
          <Text style={styles.sub}>Join with invite code</Text>
          <TextInput
            style={styles.input}
            placeholder="INVITE CODE"
            placeholderTextColor="#888"
            autoCapitalize="characters"
            value={inviteInput}
            onChangeText={setInviteInput}
          />
          <TouchableOpacity style={styles.btn} onPress={joinGame} disabled={loading}>
            <Text style={styles.btnText}>Join game</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  if (!state) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#8CB369" />
        <TouchableOpacity style={styles.btn} onPress={leaveLobby}>
          <Text style={styles.btnText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={leaveLobby}>
          <Text style={styles.link}>Leave</Text>
        </TouchableOpacity>
        {state.status === 'active' ? (
          <TouchableOpacity onPress={resign}>
            <Text style={styles.resign}>Resign</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {err ? <Text style={styles.error}>{err}</Text> : null}
      <View style={styles.sessionBanner}>
        <Text style={styles.sessionBannerLabel}>Game Session</Text>
        <Text style={styles.sessionBannerTitle}>{creatorName}</Text>
        <Text style={styles.sessionBannerText}>{sessionBannerText}</Text>
      </View>
      <Text style={styles.status}>
        {state.status === 'waiting' && 'Waiting for opponent — share invite code:'}
        {state.status === 'active' && (isMyTurn ? 'Your turn' : "Opponent's turn")}
        {state.status === 'finished' && `Finished: ${state.result ?? ''} (${state.finished_reason ?? ''})`}
      </Text>
      {state.status === 'waiting' && state.invite_code ? (
        <Text selectable style={styles.code}>
          {state.invite_code}
        </Text>
      ) : null}
      <View style={styles.boardBlock}>
        <ChessBoard
          key={state.fen + state.updated_at}
          fen={state.fen}
          onMove={handleMove}
          playerColor={playerColor}
          gestureEnabled={!!isMyTurn && state.status === 'active'}
          moveAnimationDuration={10}
        />
      </View>
      <MoveHistory moves={state.move_history} variant="dark" layout="inline" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2A2A2A', padding: 12 },
  scroll: { padding: 16, gap: 16 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  hint: { color: '#aaa', fontSize: 14 },
  sub: { color: '#ccc', marginTop: 16 },
  input: {
    backgroundColor: '#3A3A3A',
    color: '#fff',
    padding: 14,
    borderRadius: 8,
    fontSize: 18,
    letterSpacing: 2,
  },
  btn: {
    backgroundColor: '#8CB369',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  error: { color: '#E84855' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sessionBanner: {
    backgroundColor: '#333333',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#435C33',
  },
  sessionBannerLabel: {
    color: '#8CB369',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sessionBannerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 6,
  },
  sessionBannerText: {
    color: '#C8D5B9',
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
  link: { color: '#8CB369', fontSize: 16 },
  resign: { color: '#E84855', fontSize: 16 },
  status: { color: '#eee', marginBottom: 8, textAlign: 'center' },
  code: {
    color: '#8CB369',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  boardBlock: { flex: 1, minHeight: 200, justifyContent: 'center' },
});

export default FriendGameScreen;
