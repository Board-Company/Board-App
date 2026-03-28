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
import { Chess } from 'chess.js';
import ChessBoard from '../components/game/ChessBoard';
import { getAccessToken } from '../services/auth';
import { BASE_URL } from '@env';

const API_BASE_URL = BASE_URL.replace(/\/+$/, '');

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

const FriendGameScreen = () => {
  const [phase, setPhase] = useState<'lobby' | 'play'>('lobby');
  const [inviteInput, setInviteInput] = useState('');
  const [gameId, setGameId] = useState<string | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [state, setState] = useState<FriendState | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
          setErr('Game ended, expired, or not found');
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
    [gameId],
  );

  useEffect(() => {
    if (!gameId || phase !== 'play') {
      return;
    }
    refresh(gameId);
    const interval = setInterval(() => refresh(gameId), 2500);
    return () => clearInterval(interval);
  }, [gameId, phase, refresh]);

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

  const handleMove = async (move: { from: string; to: string }) => {
    if (!state || !gameId || state.status !== 'active' || !isMyTurn) {
      return;
    }
    const copy = new Chess(state.fen);
    const m = copy.move({ from: move.from, to: move.to, promotion: 'q' });
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
      setState(await r.json());
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
            setState(await r.json());
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
      <ChessBoard
        key={state.fen + state.updated_at}
        fen={state.fen}
        onMove={handleMove}
        playerColor={playerColor}
        moveAnimationDuration={10}
      />
      <Text style={styles.moves}>{state.move_history.join(' ')}</Text>
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
  moves: { color: '#888', fontSize: 12, marginTop: 8 },
});

export default FriendGameScreen;
