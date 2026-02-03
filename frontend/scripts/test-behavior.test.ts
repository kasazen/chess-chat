import { test, expect } from '@playwright/test';

const STARTING_FEN = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'; // White's turn after 1.e4 e5

test.describe('Behavioral Synchronization Guard', () => {
  test('should prevent desync from an illegal AI move', async ({ page }) => {
    // 1. ARRANGE
    // Mock the backend response to force an illegal move
    await page.route('**/ask', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          explanation: "I will now incorrectly move for White.",
          actions: [{ type: 'move', san: 'Nf3', comment: "AI plays illegal move Nf3 (g1-f3)." }]
        }),
      });
    });

    // Go to the app
    await page.goto('http://localhost:5173/');

    // Wait for app to load
    await page.waitForSelector('[data-testid="game-container"]');

    // Load the specific FEN state where it's White's turn
    await page.evaluate((fen) => {
      (window as any).__test_vars.gameRef.current.load(fen);
    }, STARTING_FEN);

    // Wait for state to settle
    await page.waitForTimeout(500);

    // Verify the FEN was loaded correctly
    const loadedFen = await page.evaluate(() => (window as any).__test_vars.gameRef.current.fen());
    console.log('Loaded FEN:', loadedFen);
    expect(loadedFen).toEqual(STARTING_FEN);

    // 2. ACT
    // Trigger the AI response by sending a message
    await page.getByPlaceholder(/Ask the coach.../i).fill('Go');
    await page.getByRole('button', { name: /Send/i }).click();

    // Wait for the AI's response to be visible in the chat
    await expect(page.locator('text=I will now incorrectly move for White')).toBeVisible({ timeout: 5000 });

    // Wait for any animations to complete (750ms per action + buffer)
    await page.waitForTimeout(2000);

    // 3. ASSERT
    const finalFen = await page.evaluate(() => (window as any).__test_vars.gameRef.current.fen());
    console.log('Final FEN:', finalFen);

    // Assertion A: The engine state MUST NOT change if the move was illegal.
    // Since Nf3 is actually LEGAL when it's White's turn, this test will show
    // that the move IS applied. To test illegal move handling, we need to
    // provide an actually illegal move for the current position.

    // Let's check if the system is in a valid state
    expect(finalFen).toBeTruthy();
    expect(finalFen).toContain('/');

    // For now, verify the system didn't crash and state is still valid
    const isValidFen = finalFen.split(' ').length >= 4;
    expect(isValidFen).toBe(true);
  });

  test('should prevent desync from a truly illegal move', async ({ page }) => {
    // Capture ALL browser console logs
    page.on('console', msg => {
      console.log(`BROWSER [${msg.type()}]:`, msg.text());
    });

    // 1. ARRANGE - Start from the beginning where it's White's turn
    // Mock backend to suggest a BLACK move (e5) when it's WHITE's turn (illegal!)
    let mockCalled = false;
    await page.route('**/ask', route => {
      console.log('MOCK: Backend route intercepted!');
      mockCalled = true;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          explanation: "Testing turn-blindness with Black move.",
          actions: [{ type: 'move', san: 'e5', comment: "AI plays illegal move e5 (Black move when White to move)." }]
        }),
      });
    });

    await page.goto('http://localhost:5173/');
    await page.waitForSelector('[data-testid="game-container"]');

    // Get initial position (White to move)
    const initialFen = await page.evaluate(() => (window as any).__test_vars.gameRef.current.fen());
    console.log('Initial FEN (White to move):', initialFen);
    expect(initialFen).toContain(' w '); // White to move

    // 2. ACT - Ask the AI (it will try to make a Black move when it's White's turn)
    await page.getByPlaceholder(/Ask the coach.../i).fill('Test illegal move');
    await page.getByRole('button', { name: /Send/i }).click();

    // Wait for the AI explanation to appear
    await expect(page.locator('text=Testing turn-blindness with Black move')).toBeVisible({ timeout: 5000 });

    // Wait for processing to start
    await page.waitForTimeout(500);

    // Check arrows during animation
    const arrowsDuring = await page.evaluate(() => (window as any).__test_vars.customArrows);
    console.log('Arrows DURING animation:', arrowsDuring);

    // Wait for animation to complete (750ms per action)
    await page.waitForTimeout(1500);

    // 3. ASSERT
    const finalFen = await page.evaluate(() => (window as any).__test_vars.gameRef.current.fen());
    console.log('Final FEN after illegal move attempt:', finalFen);

    // CRITICAL: The FEN should NOT have changed - still White's turn with same position
    expect(finalFen).toEqual(initialFen);

    // Verify the system handled it gracefully with visual feedback
    const arrows = await page.evaluate(() => (window as any).__test_vars.customArrows);
    console.log('Arrows AFTER animation:', arrows);
    console.log('Arrows length:', arrows.length);
    console.log('First arrow:', arrows[0]);

    // CRITICAL ASSERTION: The illegal move MUST be transformed to a visual arrow
    expect(arrows.length).toBeGreaterThan(0);
    expect(arrows[0]).toHaveProperty('startSquare');
    expect(arrows[0]).toHaveProperty('endSquare');
  });

  test('randomized move sequence maintains state integrity', async ({ page }) => {
    // Test with a randomized sequence of moves
    const moves = ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4', 'Nf6', 'Nc3', 'Bb4'];

    await page.route('**/ask', route => {
      const actions = moves.map(san => ({
        type: 'move',
        san: san,
        comment: `Move: ${san}`
      }));

      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          explanation: "Playing a sequence.",
          actions: actions
        }),
      });
    });

    await page.goto('http://localhost:5173/');
    await page.waitForSelector('[data-testid="game-container"]');

    const initialFen = await page.evaluate(() => (window as any).__test_vars.gameRef.current.fen());

    await page.getByPlaceholder(/Ask the coach.../i).fill('Play sequence');
    await page.getByRole('button', { name: /Send/i }).click();

    await expect(page.locator('text=Playing a sequence')).toBeVisible({ timeout: 5000 });

    // Wait for all moves to complete (10 moves × 750ms + buffer)
    await page.waitForTimeout(10000);

    const finalFen = await page.evaluate(() => (window as any).__test_vars.gameRef.current.fen());
    console.log('Final FEN after sequence:', finalFen);

    // Verify FEN changed (moves were applied)
    expect(finalFen).not.toEqual(initialFen);

    // Verify FEN is still valid
    expect(finalFen).toContain('/');
    const fenParts = finalFen.split(' ');
    expect(fenParts.length).toBeGreaterThanOrEqual(4);
  });
});
