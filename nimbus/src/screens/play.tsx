import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator, Dimensions } from 'react-native';
import { Chess } from 'chess.js';
import ChessBoard from '../components/game/ChessBoard';
import GameOverOverlay from '../components/game/GameOverOverlay';
import MoveHistory from '../components/game/MoveHistory';
import { colors } from '../theme';

const PlayScreen = () => {
  // Create a reference to the chess.js instance
  const chessRef = useRef(new Chess());
  const [fen, setFen] = useState(chessRef.current.fen());
  const [playerColor, setPlayerColor] = useState<'w' | 'b'>('w');
  const [gameStatus, setGameStatus] = useState('');
  const [isGameOver, setIsGameOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);

  const screenWidth = Dimensions.get('window').width;
  const boardSize = Math.floor((screenWidth - 32) / 8) * 8;
  const squareSize = boardSize / 8;

  // Helper to convert square like 'e4' to (x, y) index
  const squareToPosition = (square: string) => {
    const file = square.charCodeAt(0) - 'a'.charCodeAt(0); // 0-7
    const rank = 8 - parseInt(square[1]); // 0-7 (top to bottom)
    return { x: file, y: rank };
  };

  // Calculate capturable squares
  const getCapturableSquares = () => {
    const moves = chessRef.current.moves({ verbose: true });
    return moves.filter(m => m.captured).map(m => m.to);
  };
  const capturableSquares = getCapturableSquares();

  // Check the status of the game
  const checkGameStatus = () => {
    if (chessRef.current.isCheckmate()) {
      const winner = chessRef.current.turn() === 'w' ? 'Black' : 'White';
      setIsGameOver(true);
      setGameStatus(`Checkmate! ${winner} wins`);
    } else if (chessRef.current.isStalemate()) {
      setIsGameOver(true);
      setGameStatus('Stalemate');
    } else if (chessRef.current.isThreefoldRepetition()) {
      setIsGameOver(true);
      setGameStatus('Draw by repetition');
    } else if (chessRef.current.isInsufficientMaterial()) {
      setIsGameOver(true);
      setGameStatus('Draw by insufficient material');
    } else if (chessRef.current.isDraw()) {
      setIsGameOver(true);
      setGameStatus('Draw');
    } else if (chessRef.current.isCheck()) {
      setIsGameOver(false);
      setGameStatus('Check!');
    } else {
      setIsGameOver(false);
      setGameStatus(`${chessRef.current.turn() === 'w' ? 'White' : 'Black'} to move`);
    }
  };

  // Update the move history display
  const updateMoveHistory = () => {
    const history = chessRef.current.history();
    setMoveHistory(history);
  };

  // Get a move from the computer
  const getComputerMove = async () => {
    setIsLoading(true);
    try {
      setTimeout(() => {
        makeRandomMove();
        setIsLoading(false);
      }, 500);
    } catch (error) {
      console.error('Error getting computer move:', error);
      setIsLoading(false);
    }
  };

  // Make a random legal move
  const makeRandomMove = () => {
    const moves = chessRef.current.moves({ verbose: true });
    if (moves.length > 0) {
      const randomMove = moves[Math.floor(Math.random() * moves.length)];
      chessRef.current.move(randomMove);
      setFen(chessRef.current.fen());
      updateMoveHistory();
      checkGameStatus();
    }
  };

  // Start a new game
  const startNewGame = () => {
    chessRef.current.reset();
    setFen(chessRef.current.fen());
    setMoveHistory([]);
    setIsGameOver(false);
    setGameStatus('White to move');
  };

  // Undo the last move (both player and computer moves)
  const undoMove = () => {
    chessRef.current.undo();
    chessRef.current.undo();
    setFen(chessRef.current.fen());
    updateMoveHistory();
    checkGameStatus();
  };

  // Set player color preference
  const handleColorChange = (color: 'w' | 'b') => {
    setPlayerColor(color);
    setFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    setGameStatus('playing');
    setIsGameOver(false);
    setMoveHistory([]);
    if (color === 'b') {
      // If player chooses black, computer (white) goes first
      getComputerMove();
    }
  };

  // Handle player move
  const handleMove = (event: { move?: { from: string; to: string; promotion?: string }; from?: string; to?: string }) => {
    const move = event?.move ?? event;
    if (!move?.from || !move?.to) {
      return;
    }
    try {
      const result = chessRef.current.move({
        from: move.from,
        to: move.to,
        promotion: 'q',
      });

      if (result) {
        setFen(chessRef.current.fen());
        updateMoveHistory();
        checkGameStatus();

        if (!chessRef.current.isGameOver()) {
          getComputerMove();
        }
      }
    } catch (e) {
      console.log('Invalid move:', e);
    }
  };

  useEffect(() => {
    setGameStatus('White to move');
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Nimbus Chess</Text>
        <Text style={styles.status}>{gameStatus}</Text>
      </View>

      <View style={styles.boardContainer}>
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Thinking...</Text>
          </View>
        )}
        <View style={{ width: boardSize, height: boardSize }}>
          <ChessBoard
            fen={fen}
            onMove={handleMove}
            playerColor={playerColor}
            gestureEnabled={!isGameOver}
            moveAnimationDuration={10}
          />
          {/* Overlay capturable circles using View */}
          {capturableSquares.map((sq, idx) => {
            const { x, y } = squareToPosition(sq);
            return (
              <View
                key={sq + idx}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: x * squareSize + 6,
                  top: y * squareSize + 6,
                  width: squareSize - 12,
                  height: squareSize - 12,
                  borderRadius: (squareSize - 12) / 2,
                  borderWidth: 3,
                  borderColor: colors.textFaint,
                  zIndex: 10,
                }}
              />
            );
          })}
        </View>
      </View>

      <View style={styles.controlsContainer}>
        <View style={styles.buttonsRow}>
          <TouchableOpacity style={styles.button} onPress={startNewGame}>
            <Text style={styles.buttonText}>New Game</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={undoMove}>
            <Text style={styles.buttonText}>Undo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.colorSelection}>
          <Text style={styles.colorText}>Play as:</Text>
          <View style={styles.buttonsRow}>
            <TouchableOpacity 
              style={[styles.colorButton, playerColor === 'w' && styles.selectedButton]} 
              onPress={() => handleColorChange('w')}
            >
              <Text style={styles.buttonText}>White</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.colorButton, playerColor === 'b' && styles.selectedButton]} 
              onPress={() => handleColorChange('b')}
            >
              <Text style={styles.buttonText}>Black</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <MoveHistory moves={moveHistory} />
      <GameOverOverlay
        visible={isGameOver}
        title={gameStatus.includes('Checkmate') ? 'Checkmate' : gameStatus || 'Game over'}
        subtitle={gameStatus}
        primaryLabel="New game"
        onPrimary={startNewGame}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  status: {
    fontSize: 18,
    color: colors.accent,
    marginBottom: 8,
  },
  boardContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    position: 'relative',
  },
  loadingOverlay: {
    position: 'absolute',
    zIndex: 1,
    backgroundColor: colors.overlayStrong,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textPrimary,
    marginTop: 10,
    fontSize: 16,
  },
  controlsContainer: {
    marginTop: 20,
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginHorizontal: 8,
  },
  colorButton: {
    backgroundColor: colors.textDisabled,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginHorizontal: 8,
  },
  selectedButton: {
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.textPrimary,
  },
  buttonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  colorSelection: {
    alignItems: 'center',
    marginTop: 8,
  },
  colorText: {
    color: colors.textPrimary,
    fontSize: 16,
    marginBottom: 8,
  },
});

export default PlayScreen;
