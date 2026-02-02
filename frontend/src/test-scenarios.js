// @/frontend/src/test-scenarios.js

/**
 * This file contains test scenarios for validating the state management
 * of the chess application. It is intended to be used by developers or
 * automated testing tools to ensure that the board state remains consistent
 * during complex sequences of moves, undos, and redos.
 */

export const butterflyEffectScenario = {
  name: "Butterfly Effect Test",
  description: "A complex scenario involving branching and returning to the main line to test state integrity.",
  // State after 1. e4 e5
  initialFen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
  steps: [
    { type: 'action', action: { type: 'move', lan: 'g1f3' }, comment: "Play 2. Nf3" },
    { type: 'action', action: { type: 'move', lan: 'b8c6' }, comment: "Play 2... Nc6" },
    { type: 'action', action: { type: 'move', lan: 'f1c4' }, comment: "Play 3. Bc4. This is the Italian Game main line." },
    { type: 'comment', text: "Now, we'll undo the last 3 moves to explore a different path." },
    { type: 'action', action: { type: 'undo' }, comment: "Undo 3. Bc4" },
    { type: 'action', action: { type: 'undo' }, comment: "Undo 2... Nc6" },
    { type: 'action', action: { type: 'undo' }, comment: "Undo 2. Nf3" },
    { type: 'comment', text: "We are back to the state after 1... e5. Now for the alternative line (Scotch Game)." },
    { type: 'action', action: { type: 'move', lan: 'd2d4' }, comment: "Play alternative move 2. d4" },
    { type: 'action', action: { type: 'move', lan: 'e5d4' }, comment: "Play 2... exd4" },
    { type: 'comment', text: "This was the Scotch Game. Now let's return to the main state we were exploring." },
    { type: 'action', action: { type: 'undo' }, comment: "Undo 2... exd4" },
    { type: 'action', action: { type: 'undo' }, comment: "Undo 2. d4" },
    { type: 'comment', text: "Finally, replay the original moves to ensure the board state is restored correctly." },
    { type: 'action', action: { type: 'move', lan: 'g1f3' }, comment: "Replay 2. Nf3" },
    { type: 'action', action: { type: 'move', lan: 'b8c6' }, comment: "Replay 2... Nc6" },
    { type: 'action', action: { type: 'move', lan: 'f1c4' }, comment: "Replay 3. Bc4. The board should now be back in the Italian Game position, perfectly in sync." },
  ]
};

// You can add more scenarios here for different testing needs.
export const promotionScenario = {
    name: "Underpromotion Test",
    description: "Tests if the board can handle pawn promotion to a piece other than a Queen.",
    initialFen: "rnbq1bnr/1P2kppp/8/p7/8/8/1PPPPPPP/RNBQKBNR w KQ - 0 1", // Custom position with a white pawn on b7
    steps: [
        { type: 'action', action: {type: 'move', lan: 'b7a8n'}, comment: "White pawn promotes to a Knight with check." },
        { type: 'comment', text: "The board should show a Knight on a8, not a Queen."}
    ]
}
