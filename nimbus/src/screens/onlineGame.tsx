// @ts-ignore: No types for rn-eventsource
import EventSource from 'rn-eventsource';
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Dimensions } from 'react-native';
import { useLichessAuth } from '../contexts/LichessAuthContext';
import { Text, YStack, Button } from 'tamagui';
import { Chess } from 'chess.js';
import Chessboard from 'react-native-chessboard';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type RootStackParamList = {
  PlayMenu: undefined;
  OnlineGame: { gameType: string; timeControl: string };
};

type Props = NativeStackScreenProps<RootStackParamList, 'OnlineGame'>;

interface Move {
  from: string;
  to: string;
}

const OnlineGameScreen = ({ navigation, route }: Props) => {
  const { gameType, timeControl } = route.params;
  const { lichessInfo } = useLichessAuth();
  const [game, setGame] = useState<Chess>(new Chess());
  const [gameId, setGameId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<'waiting' | 'playing' | 'finished'>('waiting');
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<EventSource | null>(null);

  const screenWidth = Dimensions.get('window').width;
  const boardSize = Math.floor((screenWidth - 32) / 8) * 8; // Ensure board size is divisible by 8

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
          'Authorization': `Bearer ${lichessInfo.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          level: 8,
          clock: {
            limit: parseInt(timeControl),
            increment: 0
          },
          variant: gameType === 'chess960' ? 'chess960' : 'standard',
          color: 'white'
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
      withCredentials: true
    });

    newStream.onmessage = (event: any) => {
      let rawData = event && event.data ? event.data : event;
      try {
        const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
        if (data.type === 'gameFull') {
          setGameState('playing');
          if (data.state && data.state.moves) {
            const newGame = new Chess();
            newGame.loadPgn(data.state.moves);
            setGame(newGame);
          }
        } else if (data.type === 'gameState') {
          if (data.moves) {
            const newGame = new Chess();
            newGame.loadPgn(data.moves);
            setGame(newGame);
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

    newStream.onerror = (err: any) => {
      console.error('Stream error:', err);
      setError('Lost connection to game');
      newStream.close();
    };

    setStream(newStream);
  };

  const handleMove = async (move: any) => {
    if (!gameId || !lichessInfo?.access_token) return;

    try {
      const response = await fetch(`https://lichess.org/api/board/game/${gameId}/move/${move.from}${move.to}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lichessInfo.access_token}`
        }
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
      <YStack style={{ flex: 1, backgroundColor: '$background', justifyContent: 'center', alignItems: 'center', padding: '$4' }}>
        <Text style={{ color: '$red10', textAlign: 'center', marginBottom: '$4' }}>{error}</Text>
        <Button style={{ backgroundColor: '$green10' }} onPress={createGame}>
          <Text style={{ color: 'white', fontSize: 24 }}>Retry</Text>
        </Button>
      </YStack>
    );
  }

  return (
    <YStack style={{ flex: 1, backgroundColor: '$background', padding: '$4' }}>
      {gameState === 'waiting' ? (
        <YStack style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={{ color: '$color', marginTop: 16, fontSize: 24 }}>Waiting for opponent...</Text>
        </YStack>
      ) : gameState === 'playing' ? (
        <YStack style={{ flex: 1, alignItems: 'center' }}>
          <View style={{ width: '100%', aspectRatio: 1, maxWidth: 400 }}>
            <Chessboard
              fen={game.fen()}
              onMove={handleMove}
              boardSize={boardSize}
              colors={{
                black: '#769656',
                white: '#eeeed2',
                lastMoveHighlight: 'rgba(255,255,0, 0.5)',
                checkmateHighlight: '#E84855',
                promotionPieceButton: '#FF9B71'
              }}
              gestureEnabled={true}
              withLetters={true}
              withNumbers={true}
            />
          </View>
          <Text style={{ color: '$color', marginTop: 16, fontSize: 24 }}>
            {game.turn() === 'w' ? 'Your turn' : 'Opponent\'s turn'}
          </Text>
        </YStack>
      ) : (
        <YStack style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '$color', fontSize: 24, textAlign: 'center' }}>
            Game finished! {game.isCheckmate() ? 'Checkmate!' : 
              game.isDraw() ? 'Draw!' : 
              game.isStalemate() ? 'Stalemate!' : 'Game over!'}
          </Text>
          <Button style={{ backgroundColor: '$green10', marginTop: '$4' }} onPress={createGame}>
            <Text style={{ color: 'white', fontSize: 24 }}>Play Again</Text>
          </Button>
        </YStack>
      )}
    </YStack>
  );
};

export default OnlineGameScreen; 