// @ts-ignore: No types for rn-eventsource
import EventSource from 'rn-eventsource';
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useLichessAuth } from '../contexts/LichessAuthContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Chess } from 'chess.js';
import ChessBoard from '../components/game/ChessBoard';
import MoveHistory from '../components/game/MoveHistory';

type RootStackParamList = {
  PlayMenu: undefined;
  OnlineGame: { gameType: string; timeControl: string };
};

type Props = NativeStackScreenProps<RootStackParamList, 'OnlineGame'>;

const OnlineGameScreen = ({ navigation: _navigation, route }: Props) => {
  const { gameType, timeControl } = route.params;
  const { lichessInfo } = useLichessAuth();
  const [game, setGame] = useState<Chess>(() => new Chess());
  const [gameId, setGameId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<'waiting' | 'playing' | 'finished'>('waiting');
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<EventSource | null>(null);

  useEffect(() => {
    createGame();
    return () => {
      if (stream) {
        stream.close();
      }
    };
  }, []);

  const createGame = async () => {
    try {
      if (!lichessInfo?.access_token) {
        setError('Not authenticated');
        return;
      }

      const response = await fetch('https://lichess.org/api/challenge/ai', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${lichessInfo.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          level: 8,
          clock: {
            limit: parseInt(timeControl, 10),
            increment: 0,
          },
          variant: gameType === 'chess960' ? 'chess960' : 'standard',
          color: 'white',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log('Lichess API error:', errorText);
        throw new Error('Failed to create game: ' + errorText);
      }

      const data = await response.json();
      setGameId(data.id);
      setGameState('waiting');
      startStreaming(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create game');
    }
  };

  const startStreaming = (id: string) => {
    const newStream = new EventSource(`https://lichess.org/api/board/game/stream/${id}`, {
      withCredentials: true,
    });

    newStream.onmessage = (event: { data?: string } | string) => {
      const rawData = event && typeof event === 'object' && 'data' in event ? event.data : event;
      try {
        const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
        if (data.type === 'gameFull') {
          setGameState('playing');
          if (data.state && data.state.moves) {
            const next = new Chess();
            next.loadPgn(data.state.moves);
            setGame(next);
          }
        } else if (data.type === 'gameState') {
          if (data.moves) {
            const next = new Chess();
            next.loadPgn(data.moves);
            setGame(next);
          }
          if (data.status) {
            setGameState('finished');
            newStream.close();
          }
        }
      } catch (err) {
        console.error('Error parsing game data:', err, rawData);
      }
    };

    newStream.onerror = (err: unknown) => {
      console.error('Stream error:', err);
      setError('Lost connection to game');
      newStream.close();
    };

    setStream(newStream);
  };

  const handleMove = async (evt: { move?: { from: string; to: string; promotion?: string } }) => {
    if (!gameId || !lichessInfo?.access_token) {
      return;
    }
    const m = evt?.move;
    if (!m?.from || !m?.to) {
      return;
    }
    if (game.turn() !== 'w') {
      return;
    }

    let uci = `${m.from}${m.to}`;
    if (m.promotion && typeof m.promotion === 'string') {
      uci += m.promotion.toLowerCase();
    }

    try {
      const response = await fetch(`https://lichess.org/api/board/game/${gameId}/move/${uci}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${lichessInfo.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to make move');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to make move');
    }
  };

  if (error) {
    return (
      <View style={styles.centerWrap}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={createGame}>
          <Text style={styles.primaryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {gameState === 'waiting' ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color="#8CB369" />
          <Text style={styles.statusText}>Waiting for opponent...</Text>
        </View>
      ) : gameState === 'playing' ? (
        <View style={styles.playWrap}>
          <Text style={styles.statusText}>
            {game.turn() === 'w' ? 'Your turn' : "Opponent's turn"}
          </Text>
          <View style={styles.boardBlock}>
            <ChessBoard
              fen={game.fen()}
              onMove={handleMove}
              playerColor="w"
              gestureEnabled={game.turn() === 'w'}
            />
          </View>
          <MoveHistory moves={game.history()} variant="dark" layout="inline" />
        </View>
      ) : (
        <View style={styles.centerWrap}>
          <Text style={styles.finishedText}>
            Game finished!{' '}
            {game.isCheckmate()
              ? 'Checkmate!'
              : game.isDraw()
                ? 'Draw!'
                : game.isStalemate()
                  ? 'Stalemate!'
                  : 'Game over!'}
          </Text>
          <MoveHistory moves={game.history()} variant="dark" layout="inline" />
          <TouchableOpacity style={styles.primaryBtn} onPress={createGame}>
            <Text style={styles.primaryBtnText}>Play Again</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    padding: 12,
  },
  playWrap: {
    flex: 1,
  },
  boardBlock: {
    flex: 1,
    minHeight: 200,
    justifyContent: 'center',
  },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  statusText: {
    color: '#EEEEEE',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 8,
  },
  finishedText: {
    color: '#EEEEEE',
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  errorText: {
    color: '#E84855',
    textAlign: 'center',
    marginBottom: 16,
  },
  primaryBtn: {
    backgroundColor: '#8CB369',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  primaryBtnText: {
    color: '#111',
    fontSize: 17,
    fontWeight: '800',
  },
});

export default OnlineGameScreen;
