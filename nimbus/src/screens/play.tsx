import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert, SafeAreaView, ActivityIndicator } from 'react-native';
import Chessboard from 'react-native-chessboard';
import { Chess } from 'chess.js';

// Define proper types for move parameters
type Square = string;
type Piece = string;
type ChessMove = {
  from: Square;
  to: Square;
  promotion?: string;
};

const PlayScreen = () => {
  // Create a reference to the chess.js instance
  const chessRef = useRef(new Chess());
  const [position, setPosition] = useState('start');
  const [playerColor, setPlayerColor] = useState('w'); // 'w' for white, 'b' for black
  const [gameStatus, setGameStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);

  // Handle the player's move
  const handleMove = (move: ChessMove) => {
    try {
      // Try to make the move in the chess game
      const result = chessRef.current.move({
        from: move.from,
        to: move.to,
        promotion: move.promotion || undefined
      });
      
      if (result) {
        // If move was valid, update the position FEN
        setPosition(chessRef.current.fen());
        updateMoveHistory();
        
        // Check for game over conditions
        checkGameStatus();
        
        // If game is not over, get the computer's move
        if (!chessRef.current.isGameOver()) {
          getComputerMove();
        }
      }
    } catch (e) {
      console.log('Invalid move', e);
    }
  };

  // Update the move history display
  const updateMoveHistory = () => {
    const history = chessRef.current.history();
    setMoveHistory(history);
  };

  // Check the status of the game
  const checkGameStatus = () => {
    if (chessRef.current.isCheckmate()) {
      const winner = chessRef.current.turn() === 'w' ? 'Black' : 'White';
      setGameStatus(`Checkmate! ${winner} wins`);
      Alert.alert('Game Over', `Checkmate! ${winner} wins`);
    } else if (chessRef.current.isDraw()) {
      setGameStatus('Draw');
      Alert.alert('Game Over', 'Draw!');
    } else if (chessRef.current.isStalemate()) {
      setGameStatus('Stalemate');
      Alert.alert('Game Over', 'Stalemate!');
    } else if (chessRef.current.isThreefoldRepetition()) {
      setGameStatus('Draw by repetition');
      Alert.alert('Game Over', 'Draw by repetition!');
    } else if (chessRef.current.isInsufficientMaterial()) {
      setGameStatus('Draw by insufficient material');
      Alert.alert('Game Over', 'Draw by insufficient material!');
    } else if (chessRef.current.isCheck()) {
      setGameStatus('Check!');
    } else {
      setGameStatus(`${chessRef.current.turn() === 'w' ? 'White' : 'Black'} to move`);
    }
  };

  // Get a move from the computer (this would call your API)
  const getComputerMove = async () => {
    setIsLoading(true);
    try {
      // Here you would make an actual API call
      // For now, we'll simulate a delay and make a random move
      setTimeout(() => {
        makeRandomMove();
        setIsLoading(false);
      }, 500);

      // Example of how the actual API call might look:
      // const response = await fetch('https://your-chess-api.com/move', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({ 
      //     fen: chessRef.current.fen(),
      //     level: 3 // difficulty level
      //   }),
      // });
      // const data = await response.json();
      // if (data.move) {
      //   chessRef.current.move(data.move);
      //   setPosition(chessRef.current.fen());
      //   updateMoveHistory();
      //   checkGameStatus();
      // }
    } catch (error) {
      console.error('Error getting computer move:', error);
      setIsLoading(false);
    }
  };

  // Make a random legal move (temporary function until API is connected)
  const makeRandomMove = () => {
    const moves = chessRef.current.moves({ verbose: true });
    if (moves.length > 0) {
      const randomMove = moves[Math.floor(Math.random() * moves.length)];
      chessRef.current.move(randomMove);
      setPosition(chessRef.current.fen());
      updateMoveHistory();
      checkGameStatus();
    }
  };

  // Start a new game
  const startNewGame = () => {
    chessRef.current.reset();
    setPosition('start');
    setMoveHistory([]);
    setGameStatus('White to move');
  };

  // Undo the last move (both player and computer moves)
  const undoMove = () => {
    // Undo twice to undo both computer and player moves
    chessRef.current.undo();
    chessRef.current.undo();
    setPosition(chessRef.current.fen());
    updateMoveHistory();
    checkGameStatus();
  };

  // Set player color preference
  const setColor = (color: 'w' | 'b') => {
    setPlayerColor(color);
    startNewGame();
    if (color === 'b') {
      // If player chooses black, computer (white) goes first
      getComputerMove();
    }
  };

  useEffect(() => {
    // Initialize game status
    setGameStatus('White to move');
  }, []);

  // Render the move history list
  const renderMoveHistory = () => {
    const moves = [];
    for (let i = 0; i < moveHistory.length; i += 2) {
      const moveNumber = Math.floor(i / 2) + 1;
      const whiteMove = moveHistory[i];
      const blackMove = moveHistory[i + 1] || '';
      moves.push(
        <Text key={i} style={styles.moveHistoryText}>
          {moveNumber}. {whiteMove} {blackMove}
        </Text>
      );
    }
    return moves;
  };

  // Handle when a piece is moved on the board
  const onMove = (move: any) => {
    // Extract from and to squares from the move info
    const { from, to } = move;
    
    const moveAttempt = {
      from,
      to,
      promotion: 'q' // Default to queen for simplicity
    };
    
    handleMove(moveAttempt);
    return true;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Nimbus Chess</Text>
        <Text style={styles.status}>{gameStatus}</Text>
      </View>

      <View style={styles.boardContainer}>
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#8CB369" />
            <Text style={styles.loadingText}>Thinking...</Text>
          </View>
        )}
        <Chessboard />
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
              onPress={() => setColor('w')}
            >
              <Text style={styles.buttonText}>White</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.colorButton, playerColor === 'b' && styles.selectedButton]} 
              onPress={() => setColor('b')}
            >
              <Text style={styles.buttonText}>Black</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.historyContainer}>
        <Text style={styles.historyTitle}>Move History</Text>
        <View style={styles.movesList}>
          {renderMoveHistory()}
        </View>
      </View>
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
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  status: {
    fontSize: 18,
    color: '#8CB369',
    marginBottom: 8,
  },
  boardContainer: {
    width: '100%',
    aspectRatio: 1,
    alignSelf: 'center',
    position: 'relative',
  },
  board: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    position: 'absolute',
    zIndex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
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
    backgroundColor: '#8CB369',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginHorizontal: 8,
  },
  colorButton: {
    backgroundColor: '#5D5D5D',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginHorizontal: 8,
  },
  selectedButton: {
    backgroundColor: '#8CB369',
    borderWidth: 2,
    borderColor: 'white',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  colorSelection: {
    alignItems: 'center',
    marginTop: 8,
  },
  colorText: {
    color: 'white',
    fontSize: 16,
    marginBottom: 8,
  },
  historyContainer: {
    marginTop: 20,
    flex: 1,
  },
  historyTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  movesList: {
    backgroundColor: '#3A3A3A',
    borderRadius: 8,
    padding: 12,
    flex: 1,
  },
  moveHistoryText: {
    color: 'white',
    fontSize: 14,
    marginBottom: 4,
  },
});

export default PlayScreen;
