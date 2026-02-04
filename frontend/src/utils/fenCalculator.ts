import { Chess } from 'chess.js';

/**
 * Calculate FENs for a sequence of moves from a starting position
 * @param moves Array of SAN move strings ["e4", "e5", "Nf3"]
 * @param startingFen Starting FEN position (defaults to starting position)
 * @returns Array of objects with san and fen properties
 */
export function calculateFensForSequence(
  moves: string[],
  startingFen: string = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
): Array<{ san: string; fen: string }> {
  const game = new Chess(startingFen);
  const result: Array<{ san: string; fen: string }> = [];

  for (const san of moves) {
    try {
      const move = game.move(san);
      if (move) {
        result.push({
          san: move.san,  // Use normalized SAN from chess.js
          fen: game.fen()
        });
      } else {
        console.error(`[FEN Calculator] Invalid move: ${san}`);
        // Skip invalid moves
      }
    } catch (error) {
      console.error(`[FEN Calculator] Error processing move ${san}:`, error);
      // Skip error moves
    }
  }

  return result;
}
