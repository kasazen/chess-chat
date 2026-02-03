import { test, expect } from '@playwright/test';
import { Chess } from 'chess.js';

// Generate a random sequence of legal moves
function generateRandomMoveSequence(minMoves: number): string[] {
  const game = new Chess();
  const moves: string[] = [];

  for (let i = 0; i < minMoves; i++) {
    const legalMoves = game.moves();
    if (legalMoves.length === 0) break; // Game over

    // Pick a random legal move
    const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
    game.move(randomMove);
    moves.push(randomMove);
  }

  return moves;
}

test.describe('Behavioral Synchronization Guard - Randomized Validation', () => {
  test('should maintain state integrity through randomized 10-move sequence', async ({ page }) => {
    // Generate a random sequence of 10 moves
    const moveSequence = generateRandomMoveSequence(10);
    console.log('Random move sequence:', moveSequence.join(', '));

    // Mock backend to return this sequence
    await page.route('**/ask', route => {
      const actions = moveSequence.map(san => ({
        type: 'move',
        san: san,
        comment: `Move: ${san}`
      }));

      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          explanation: `Playing random sequence of ${moveSequence.length} moves.`,
          actions: actions
        }),
      });
    });

    await page.goto('http://localhost:5173/');
    await page.waitForSelector('[data-testid="game-container"]');

    const initialFen = await page.evaluate(() => (window as any).__test_vars.gameRef.current.fen());
    console.log('Initial FEN:', initialFen);

    // Send message to trigger the sequence
    await page.getByPlaceholder(/Ask the coach.../i).fill('Play random moves');
    await page.getByRole('button', { name: /Send/i }).click();

    // Wait for explanation
    await expect(page.locator(`text=Playing random sequence`)).toBeVisible({ timeout: 5000 });

    // Wait for all moves to complete (10 moves × 750ms + buffer = 9000ms)
    await page.waitForTimeout(10000);

    // Verify final state
    const finalFen = await page.evaluate(() => (window as any).__test_vars.gameRef.current.fen());
    console.log('Final FEN:', finalFen);

    // Assertions
    expect(finalFen).not.toEqual(initialFen); // Position changed
    expect(finalFen).toContain('/'); // Still valid FEN
    const fenParts = finalFen.split(' ');
    expect(fenParts.length).toBeGreaterThanOrEqual(4); // Valid FEN structure

    // Verify no desync - check that FEN is parseable
    const testFen = await page.evaluate((fen) => {
      try {
        const testGame = new (window as any).Chess(fen);
        return testGame.fen() === fen;
      } catch (e) {
        return false;
      }
    }, finalFen);

    expect(testFen).toBe(true); // FEN is valid and parseable
  });

  test('should handle illegal move in middle of randomized sequence', async ({ page }) => {
    // Generate first half of sequence (5 moves)
    const firstHalf = generateRandomMoveSequence(5);

    // Add an illegal move (wrong turn)
    const illegalMove = 'e5'; // This might be illegal depending on position

    // Generate second half (3 more moves)
    // We need to continue from where first half ended
    const game = new Chess();
    firstHalf.forEach(m => game.move(m));

    const secondHalf: string[] = [];
    for (let i = 0; i < 3; i++) {
      const moves = game.moves();
      if (moves.length === 0) break;
      const move = moves[Math.floor(Math.random() * moves.length)];
      game.move(move);
      secondHalf.push(move);
    }

    console.log('Move sequence with injected illegal move:',
      [...firstHalf, illegalMove, ...secondHalf].join(', '));

    // Mock backend
    await page.route('**/ask', route => {
      const actions = [
        ...firstHalf.map(san => ({ type: 'move', san, comment: `Move: ${san}` })),
        { type: 'move', san: illegalMove, comment: `Illegal move: ${illegalMove}` },
        ...secondHalf.map(san => ({ type: 'move', san, comment: `Move: ${san}` })),
      ];

      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          explanation: "Mixed sequence with illegal move.",
          actions: actions
        }),
      });
    });

    await page.goto('http://localhost:5173/');
    await page.waitForSelector('[data-testid="game-container"]');

    await page.getByPlaceholder(/Ask the coach.../i).fill('Test mixed sequence');
    await page.getByRole('button', { name: /Send/i }).click();

    await expect(page.locator('text=Mixed sequence')).toBeVisible({ timeout: 5000 });

    // Wait for all actions (at least 8 × 750ms = 6000ms)
    await page.waitForTimeout(8000);

    // Verify state is still valid
    const finalFen = await page.evaluate(() => (window as any).__test_vars.gameRef.current.fen());
    expect(finalFen).toContain('/');

    // Check if any arrows were created (from illegal move)
    const arrows = await page.evaluate(() => (window as any).__test_vars.customArrows);
    console.log('Arrows created:', arrows.length);

    // System should still be stable
    const isValidState = await page.evaluate(() => {
      try {
        const fen = (window as any).__test_vars.gameRef.current.fen();
        const testGame = new (window as any).Chess(fen);
        return testGame.fen() === fen;
      } catch (e) {
        return false;
      }
    });

    expect(isValidState).toBe(true);
  });
});
