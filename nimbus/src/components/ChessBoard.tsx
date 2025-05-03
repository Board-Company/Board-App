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
  const boardSize = screenWidth - 32; // 32 is the total horizontal padding

  return (
    <Chessboard
      fen={fen}
      onMove={onMove}
      size={boardSize}
      colors={{
        black: '#769656',
        white: '#eeeed2',
      }}
      playerColor={playerColor}
    />
  );
};

export default ChessBoard; 