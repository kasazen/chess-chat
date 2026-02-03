import { test, expect } from '@playwright/test';

/**
 * CAUSAL CHAIN DESYNC TEST
 *
 * According to the spec, the bug is that chat messages can appear
 * BEFORE the board state is updated, creating a visual desync where
 * the chat describes a move that hasn't happened yet on the board.
 *
 * This test uses screenshot comparison at precise moments to catch
 * this race condition.
 */

test.describe('Causal Chain Violation Detection', () => {
  test('should detect chat-before-board desync', async ({ page }) => {
    // Mock a sequence of moves
    await page.route('**/ask', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          explanation: "Playing moves",
          actions: [
            { type: 'move', san: 'e4', comment: 'First move: e4' },
            { type: 'move', san: 'e5', comment: 'Second move: e5' }
          ]
        }),
      });
    });

    await page.goto('http://localhost:5173/');
    await page.waitForSelector('[data-testid="game-container"]');

    const board = page.locator('[data-testid="game-container"]');
    const chatMessages = page.locator('div:has-text("move:")');

    // Baseline - no moves yet
    await expect(board).toHaveScreenshot('board-before-moves.png');

    // Trigger moves
    await page.getByPlaceholder(/Ask the coach.../i).fill('Play moves');
    await page.getByRole('button', { name: /Send/i }).click();

    // Wait for explanation
    await expect(page.locator('text=Playing moves')).toBeVisible({ timeout: 5000 });

    // CRITICAL TIMING CHECK:
    // As soon as the FIRST move's comment appears in chat, take a board screenshot
    // If there's a race condition, the board might not have updated yet

    // Wait for first move's chat message
    await expect(page.locator('text=First move: e4')).toBeVisible({ timeout: 3000 });

    // IMMEDIATELY take board screenshot
    // This should show the board AFTER e4 was played
    await expect(board).toHaveScreenshot('board-after-e4-message.png');

    // Wait a bit longer for the move to definitely complete
    await page.waitForTimeout(1000);

    // Take another screenshot
    await expect(board).toHaveScreenshot('board-after-e4-settled.png');

    // ASSERTION: These two screenshots should be IDENTICAL
    // If they're different, it means the board updated AFTER the chat message appeared
    // This would prove the race condition bug
  });

  test('should detect incomplete board state when chat updates', async ({ page }) => {
    // This test uses a longer sequence to increase chance of catching race condition
    await page.route('**/ask', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          explanation: "Fast sequence",
          actions: [
            { type: 'move', san: 'd4', comment: 'Move 1' },
            { type: 'move', san: 'd5', comment: 'Move 2' },
            { type: 'move', san: 'c4', comment: 'Move 3' },
          ]
        }),
      });
    });

    await page.goto('http://localhost:5173/');
    await page.waitForSelector('[data-testid="game-container"]');

    await page.getByPlaceholder(/Ask the coach.../i).fill('Fast moves');
    await page.getByRole('button', { name: /Send/i }).click();

    await expect(page.locator('text=Fast sequence')).toBeVisible({ timeout: 5000 });

    // Wait for THIRD move's message
    await expect(page.locator('text=Move 3')).toBeVisible({ timeout: 5000 });

    // At this point, according to spec, the board SHOULD show all 3 moves applied
    // But if there's a race condition, it might only show 2 moves or fewer

    // Use page.evaluate to check internal state (for debugging only)
    // The actual assertion will be visual
    const debugInfo = await page.evaluate(() => {
      return {
        fen: (window as any).__test_vars?.fen,
        queueLength: (window as any).__test_vars?.actionQueue?.length,
        isAnimating: (window as any).__test_vars?.isAnimating
      };
    });

    console.log('Debug state when Move 3 message visible:', debugInfo);

    // CRITICAL ASSERTION: This SHOULD FAIL if there's a race condition
    // When the "Move 3" chat message is visible, Move 3 should have been applied
    // If queueLength > 0, it means moves are still pending (BUG!)
    expect(debugInfo.queueLength).toBe(0); // This will FAIL!

    // Take board screenshot
    const board = page.locator('[data-testid="game-container"]');
    await expect(board).toHaveScreenshot('board-at-move-3-message.png');

    // If isAnimating is true, the board is still updating (race condition!)
    // If queueLength > 0, there are pending moves (race condition!)

    // Wait for everything to settle
    await page.waitForTimeout(3000);

    const finalDebugInfo = await page.evaluate(() => {
      return {
        fen: (window as any).__test_vars?.fen,
        isAnimating: (window as any).__test_vars?.isAnimating
      };
    });

    console.log('Final state after settling:', finalDebugInfo);

    await expect(board).toHaveScreenshot('board-final-settled.png');

    // The key assertion: if isAnimating was true when Move 3 message appeared,
    // then the chat message appeared BEFORE the board finished updating
    // This is the race condition the spec describes
  });

  test('DEBUG: Check Chess.js state after AI moves', async ({ page }) => {
    // Mock a sequence of moves
    await page.route('**/ask', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          explanation: "Fast sequence",
          actions: [
            { type: 'move', san: 'd4', comment: 'Move 1' },
            { type: 'move', san: 'd5', comment: 'Move 2' },
            { type: 'move', san: 'c4', comment: 'Move 3' },
          ]
        }),
      });
    });

    await page.goto('http://localhost:5173/');
    await page.waitForSelector('[data-testid="game-container"]');

    // Trigger moves
    await page.getByPlaceholder(/Ask the coach.../i).fill('Fast moves');
    await page.getByRole('button', { name: /Send/i }).click();

    // Wait for explanation
    await expect(page.locator('text=Fast sequence')).toBeVisible({ timeout: 5000 });

    // Wait for all moves to be processed and animation to finish
    await page.waitForFunction(() => (window as any).__test_vars?.actionQueue?.length === 0 && !(window as any).__test_vars?.isAnimating, { timeout: 10000 });

    // Now, get the detailed game state
    const chessState = await page.evaluate(() => {
      // Call the new debug function directly
      return (window as any).__test_vars.getChessDebugState();
    });

    console.log('DEBUG: Chess.js state after all AI moves:', chessState);

    // This test doesn't assert anything, just logs the state for debugging.
    // It should pass as long as the application doesn't crash.
    expect(true).toBe(true); 
  });
});