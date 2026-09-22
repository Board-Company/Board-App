
import React from 'react';
import { Dimensions } from 'react-native';
import Chessboard from 'react-native-chessboard';
import { colors } from '../theme';

interface ChessBoardProps {
  fen: string;
  onMove: (move: any) => void;
  playerColor: 'w' | 'b';
}

const ChessBoard: React.FC<ChessBoardProps> = ({ fen, onMove, playerColor }) => {
  const screenWidth = Dimensions.get('window').width;
  const boardSize = Math.floor((screenWidth - 32) / 8) * 8; // Ensure board size is divisible by 8

  return (
    <Chessboard
      fen={fen}
      onMove={onMove}
      boardSize={boardSize}
      colors={{
        black: colors.boardDark,
        white: colors.boardLight,
        lastMoveHighlight: colors.boardLastMove,
        checkmateHighlight: colors.danger,
        promotionPieceButton: colors.warning
      }}
      gestureEnabled={true}
      withLetters={true}
      withNumbers={true}
    />
  );
};

export default ChessBoard; 