import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { Dimensions, Image, StyleSheet, View } from 'react-native';
import Chessboard, { ChessboardRef } from 'react-native-chessboard';
import { PIECES } from 'react-native-chessboard/lib/commonjs/constants';
import type { ChessboardState } from 'react-native-chessboard/lib/typescript/helpers/get-chessboard-state';
import { colors } from '../../theme';

interface ChessBoardProps {
  fen: string;
  onMove: (move: any) => void;
  playerColor: 'w' | 'b';
  gestureEnabled?: boolean;
  /** Piece move animation (ms). Lower = snappier; default tuned for near-instant play. */
  moveAnimationDuration?: number;
  /** Cap board width (e.g. nested padding). Defaults to screen width minus outer margin. */
  maxBoardWidth?: number;
}

const ChessBoard = forwardRef<ChessboardRef, ChessBoardProps>(
  (
    { fen, onMove, playerColor, gestureEnabled = true, moveAnimationDuration = 12, maxBoardWidth },
    ref,
  ) => {
  const internalRef = useRef<ChessboardRef>(null);
  const screenWidth = Dimensions.get('window').width;
  const boardSize = useMemo(() => {
    const defaultOuterMargin = 32;
    const widthBudget = maxBoardWidth ?? screenWidth - defaultOuterMargin;
    const capped = Math.min(screenWidth - defaultOuterMargin, widthBudget);
    return Math.floor(Math.max(capped, 0) / 8) * 8;
  }, [screenWidth, maxBoardWidth]);
  const pieceSize = boardSize / 8;
  const boardColors = useMemo(
    () => ({
      black: colors.boardDark,
      white: colors.boardLight,
      lastMoveHighlight: colors.boardLastMove,
      checkmateHighlight: colors.danger,
      promotionPieceButton: colors.warning,
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

  useImperativeHandle(
    ref,
    (): ChessboardRef => ({
      move: (params) => internalRef.current?.move?.(params),
      highlight: (params) => internalRef.current?.highlight?.(params),
      resetAllHighlightedSquares: () => internalRef.current?.resetAllHighlightedSquares?.(),
      getState: () => internalRef.current?.getState?.() as ChessboardState,
      resetBoard: (nextFen) => internalRef.current?.resetBoard?.(nextFen),
    }),
    [],
  );

  return (
    <View style={playerColor === 'b' ? styles.rotatedBoard : undefined}>
      <Chessboard
        ref={internalRef}
        fen={fen}
        onMove={onMove}
        boardSize={boardSize}
        colors={boardColors}
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
