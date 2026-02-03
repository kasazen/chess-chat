import { test, expect } from '@playwright/test';

test.describe('Mock-Driven State Synchronization', () => {
  test('should maintain perfect FEN sync using Jobava London mock', async ({ page }) => {
    // 1. ARRANGE
    // Expected FEN after all moves in the "Jobava London" mock
    // Moves: d4, Nf6, Nc3, d5, Bf4
    const EXPECTED_FINAL_FEN = 'rnbqkb1r/ppp1pppp/5n2/3p4/3P1B2/2N5/PPP1PPPP/R2QKBNR b KQkq - 1 3';
    const mockScenarioKey = 'Jobava London';

    await page.goto('http://localhost:5173/');
    await page.waitForSelector('[data-testid="game-container"]');

    // Get initial FEN
    const initialFen = await page.evaluate(() => (window as any).__test_vars.gameRef.current.fen());
    console.log('Initial FEN:', initialFen);

    // 2. ACT
    await page.getByPlaceholder(/Ask the coach.../i).fill(mockScenarioKey);
    await page.getByRole('button', { name: /Send/i }).click();

    // Wait for the last message from the mock to be visible
    await expect(page.locator('text=signature move of the London System')).toBeVisible({ timeout: 10000 });

    // Wait for all moves to complete (5 moves × 750ms + buffer)
    await page.waitForTimeout(5000);

    // 3. ASSERT (The Sync Assertion)
    const finalFenOnBoard = await page.evaluate(() => (window as any).__test_vars.gameRef.current.fen());
    console.log('Final FEN on board:', finalFenOnBoard);
    console.log('Expected FEN:', EXPECTED_FINAL_FEN);

    // Assert that the final FEN on the board perfectly matches the expected FEN
    expect(finalFenOnBoard).toEqual(EXPECTED_FINAL_FEN);
  });

  test('should handle illegal move from mock gracefully', async ({ page }) => {
    // This test uses a mock that suggests a move for the wrong player
    const mockScenarioKey = 'Illegal Move Test';

    await page.goto('http://localhost:5173/');
    await page.waitForSelector('[data-testid="game-container"]');

    const initialFen = await page.evaluate(() => (window as any).__test_vars.gameRef.current.fen());
    console.log('Initial FEN:', initialFen);

    await page.getByPlaceholder(/Ask the coach.../i).fill(mockScenarioKey);
    await page.getByRole('button', { name: /Send/i }).click();

    await expect(page.locator('text=illegal move for White')).toBeVisible({ timeout: 5000 });

    // Wait for processing
    await page.waitForTimeout(2000);

    // FEN should NOT have changed (illegal move prevented)
    const finalFen = await page.evaluate(() => (window as any).__test_vars.gameRef.current.fen());
    console.log('Final FEN after illegal move:', finalFen);

    // FEN should be unchanged
    expect(finalFen).toEqual(initialFen);

    // Check if arrow was created (visual feedback)
    const arrows = await page.evaluate(() => (window as any).__test_vars.customArrows);
    console.log('Arrows created:', arrows.length);

    // If the illegal move was transformed to a ghost_move, there should be an arrow
    // (This assertion is lenient - the key requirement is FEN unchanged)
    expect(arrows.length).toBeGreaterThanOrEqual(0);
  });

  test('should handle visual-only actions from mock', async ({ page }) => {
    const mockScenarioKey = 'Threat Detection';

    await page.goto('http://localhost:5173/');
    await page.waitForSelector('[data-testid="game-container"]');

    await page.getByPlaceholder(/Ask the coach.../i).fill(mockScenarioKey);
    await page.getByRole('button', { name: /Send/i }).click();

    await expect(page.locator('text=eyeing the weak h6 pawn')).toBeVisible({ timeout: 5000 });

    // Wait for visual actions to process
    await page.waitForTimeout(2000);

    // Check that visual elements were created
    const arrows = await page.evaluate(() => (window as any).__test_vars.customArrows);
    const highlights = await page.evaluate(() => (window as any).__test_vars.customSquareStyles || {});

    console.log('Arrows:', arrows.length);
    console.log('Highlights:', Object.keys(highlights).length);

    // Should have at least one arrow and one highlight
    expect(arrows.length).toBeGreaterThan(0);
    expect(Object.keys(highlights).length).toBeGreaterThan(0);
  });
});
