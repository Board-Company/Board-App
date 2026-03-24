import React, { useEffect, useRef, useState } from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Chess } from 'chess.js';
import ChessBoard from '../components/game/ChessBoard';
import MoveHistory from '../components/game/MoveHistory';
import type { ChessboardRef } from 'react-native-chessboard';

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
};

const LocalGameScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const chessRef = useRef(new Chess());
  const boardRef = useRef<ChessboardRef>(null);
  const [fen, setFen] = useState(chessRef.current.fen());
  const [gameStatus, setGameStatus] = useState('White to move');
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [boardOrientation, setBoardOrientation] = useState<'w' | 'b'>(chessRef.current.turn());

  const syncGameState = () => {
    const nextFen = chessRef.current.fen();
    setFen(nextFen);
    setMoveHistory(chessRef.current.history());
    setBoardOrientation(chessRef.current.turn());
  };

  const checkGameStatus = () => {
    if (chessRef.current.isCheckmate()) {
      const winner = chessRef.current.turn() === 'w' ? 'Black' : 'White';
      const message = `Checkmate! ${winner} wins`;
      setGameStatus(message);
      Alert.alert('Game Over', message);
      return;
    }

    if (chessRef.current.isStalemate()) {
      setGameStatus('Stalemate');
      Alert.alert('Game Over', 'Stalemate!');
      return;
    }

    if (chessRef.current.isThreefoldRepetition()) {
      setGameStatus('Draw by repetition');
      Alert.alert('Game Over', 'Draw by repetition!');
      return;
    }

    if (chessRef.current.isInsufficientMaterial()) {
      setGameStatus('Draw by insufficient material');
      Alert.alert('Game Over', 'Draw by insufficient material!');
      return;
    }

    if (chessRef.current.isDraw()) {
      setGameStatus('Draw');
      Alert.alert('Game Over', 'Draw!');
      return;
    }

    if (chessRef.current.isCheck()) {
      setGameStatus(`${chessRef.current.turn() === 'w' ? 'White' : 'Black'} to move - Check!`);
      return;
    }

    setGameStatus(`${chessRef.current.turn() === 'w' ? 'White' : 'Black'} to move`);
  };

  const handleMove = ({ move, state }: ChessboardMoveEvent) => {
    try {
      const result = move.san
        ? chessRef.current.move(move.san)
        : chessRef.current.move({
            from: move.from,
            to: move.to,
            promotion: move.promotion ?? 'q',
          });

      if (!result) {
        chessRef.current.load(state.fen);
      }

      syncGameState();
      checkGameStatus();
    } catch (error) {
      console.log('Invalid local move:', error);
    }
  };

  const startNewGame = () => {
    chessRef.current.reset();
    const nextFen = chessRef.current.fen();
    setFen(nextFen);
    setMoveHistory([]);
    setBoardOrientation(chessRef.current.turn());
    boardRef.current?.resetBoard(nextFen);
    setGameStatus('White to move');
  };

  const undoMove = () => {
    const undoneMove = chessRef.current.undo();
    if (!undoneMove) {
      return;
    }

    const nextFen = chessRef.current.fen();
    setFen(nextFen);
    setMoveHistory(chessRef.current.history());
    setBoardOrientation(chessRef.current.turn());
    boardRef.current?.resetBoard(nextFen);
    checkGameStatus();
  };

  useEffect(() => {
    syncGameState();
    checkGameStatus();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('MainTabs')}>
            <Icon name="arrow-back" size={24} color="#8CB369" />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.title}>Local Game</Text>
            <Text style={styles.subtitle}>Pass and play on one device</Text>
            <Text style={styles.status}>{gameStatus}</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      <View style={styles.boardContainer}>
        <ChessBoard
          ref={boardRef}
          fen={fen}
          onMove={handleMove}
          playerColor={boardOrientation}
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

      <View style={styles.footerSpacer} />
      <MoveHistory moves={moveHistory} />
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
    marginBottom: 16,
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
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#C8D5B9',
    fontSize: 14,
    marginTop: 6,
  },
  status: {
    color: '#8CB369',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 10,
    textAlign: 'center',
  },
  boardContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  button: {
    backgroundColor: '#8CB369',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 8,
  },
  secondaryButton: {
    backgroundColor: '#5D5D5D',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  selectedButton: {
    backgroundColor: '#8CB369',
    borderWidth: 2,
    borderColor: 'white',
  },
  footerSpacer: {
    height: 72,
  },
});

export default LocalGameScreen;
