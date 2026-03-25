import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { Dimensions, Image, StyleSheet, View } from 'react-native';
import Chessboard, { ChessboardRef } from 'react-native-chessboard';
import { PIECES } from 'react-native-chessboard/lib/commonjs/constants';

interface ChessBoardProps {
  fen: string;
  onMove: (move: any) => void;
  playerColor: 'w' | 'b';
  gestureEnabled?: boolean;
  moveAnimationDuration?: number;
}

const ChessBoard = forwardRef<ChessboardRef, ChessBoardProps>(
  ({ fen, onMove, playerColor, gestureEnabled = true, moveAnimationDuration = 90 }, ref) => {
  const internalRef = useRef<ChessboardRef>(null);
  const screenWidth = Dimensions.get('window').width;
  const boardSize = useMemo(() => Math.floor((screenWidth - 32) / 8) * 8, [screenWidth]);
  const pieceSize = boardSize / 8;
  const colors = useMemo(
    () => ({
      black: '#769656',
      white: '#eeeed2',
      lastMoveHighlight: 'rgba(255,255,0, 0.5)',
      checkmateHighlight: '#E84855',
      promotionPieceButton: '#FF9B71',
    }),
    [],
  );
  const durations = useMemo(() => ({ move: moveAnimationDuration }), [moveAnimationDuration]);
  const renderPiece = useCallback(
    (piece: string) => (
      <Image
        source={PIECES[piece]}
        resizeMode="contain"
        style={[
          styles.piece,
          { width: pieceSize, height: pieceSize },
          playerColor === 'b' && styles.uprightPiece,
        ]}
      />
    ),
    [pieceSize, playerColor],
  );

  useImperativeHandle(ref, () => internalRef.current as ChessboardRef, []);

  return (
    <View style={playerColor === 'b' ? styles.rotatedBoard : undefined}>
      <Chessboard
        ref={internalRef}
        fen={fen}
        onMove={onMove}
        boardSize={boardSize}
        colors={colors}
        gestureEnabled={gestureEnabled}
        durations={durations}
        withLetters={true}
        withNumbers={true}
        renderPiece={renderPiece}
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
