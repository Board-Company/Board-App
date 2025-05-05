import React from 'react';
import { Dimensions } from 'react-native';
import Chessboard from 'react-native-chessboard';

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
  );
};

export default ChessBoard; 