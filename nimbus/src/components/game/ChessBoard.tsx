import React, { forwardRef } from 'react';
import { Dimensions, Image, StyleSheet, View } from 'react-native';
import Chessboard, { ChessboardRef } from 'react-native-chessboard';
import { PIECES } from 'react-native-chessboard/lib/commonjs/constants';

interface ChessBoardProps {
  fen: string;
  onMove: (move: any) => void;
  playerColor: 'w' | 'b';
}

const ChessBoard = forwardRef<ChessboardRef, ChessBoardProps>(({ fen, onMove, playerColor }, ref) => {
  const screenWidth = Dimensions.get('window').width;
  const boardSize = Math.floor((screenWidth - 32) / 8) * 8; // Ensure board size is divisible by 8
  const pieceSize = boardSize / 8;

  return (
    <View style={playerColor === 'b' ? styles.rotatedBoard : undefined}>
      <Chessboard
        ref={ref}
        fen={fen}
        onMove={onMove}
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
        renderPiece={piece => (
          <Image
            source={PIECES[piece]}
            resizeMode="contain"
            style={[
              styles.piece,
              { width: pieceSize, height: pieceSize },
              playerColor === 'b' && styles.uprightPiece,
            ]}
          />
        )}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  rotatedBoard: {
    transform: [{ rotate: '180deg' }],
  },
  piece: {
    alignSelf: 'center',
  },
  uprightPiece: {
    transform: [{ rotate: '180deg' }],
  },
});

export default React.memo(ChessBoard); 
