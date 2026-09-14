import { Chess } from 'chess.js';

/** Replay SANs into FENs. Skips illegal moves so review still loads. */
export function fenReplayFromMoves(moves: string[], initialFen?: string): string[] {
  const chess = initialFen ? new Chess(initialFen) : new Chess();
  const fens: string[] = [chess.fen()];
  for (const move of moves) {
    if (!move) {
      continue;
    }
    try {
      const result = chess.move(move);
      if (result) {
        fens.push(chess.fen());
      }
    } catch {
      /* skip unparsable / illegal SAN */
    }
  }
  return fens;
}
