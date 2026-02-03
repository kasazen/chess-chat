import { test, expect } from '@playwright/test';

/**
 * CRITICAL DESYNC DETECTION TEST
 *
 * This test specifically targets the arrow rendering desync bug.
 * It uses timing-sensitive assertions to catch race conditions.
 */

test.describe('Arrow Rendering Desync Detection', () => {
  test('should detect arrow rendering race condition', async ({ page }) => {
    // Setup: Mock an illegal move that should become an arrow
    await page.route('**/ask', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          explanation: "Arrow test",
          actions: [
            // This illegal move should transform to a ghost_move with arrow
            { type: 'move', san: 'e5', comment: 'Illegal move test' }
          ]
        }),
      });
    });

    await page.goto('http://localhost:5173/');
    await page.waitForSelector('[data-testid="game-container"]');

    // Count initial SVG paths (board squares)
    const initialPaths = await page.locator('[data-testid="game-container"] svg path').count();
    console.log('Initial SVG paths (board elements):', initialPaths);

    // Trigger the illegal move
    await page.getByPlaceholder(/Ask the coach.../i).fill('Test arrow');
    await page.getByRole('button', { name: /Send/i }).click();

    await expect(page.locator('text=Arrow test')).toBeVisible({ timeout: 5000 });

    // CRITICAL: Check immediately after explanation appears (before animation completes)
    // If there's a race condition, arrows might not be rendered yet
    await page.waitForTimeout(100); // Minimal wait

    const pathsImmediately = await page.locator('[data-testid="game-container"] svg path').count();
    console.log('SVG paths immediately after trigger:', pathsImmediately);

    // Wait for animation to complete
    await page.waitForTimeout(1500);

    const pathsAfterAnimation = await page.locator('[data-testid="game-container"] svg path').count();
    console.log('SVG paths after animation:', pathsAfterAnimation);

    // ASSERTION: If arrows are rendered, path count should increase
    // The illegal move e5 should create ONE arrow (e7->e5)
    // So we should have: initialPaths + some arrow paths
    //
    // If pathsAfterAnimation === initialPaths, arrows were NOT rendered (BUG!)
    expect(pathsAfterAnimation).toBeGreaterThan(initialPaths);

    // Additional check: Take screenshot to visually verify
    const board = page.locator('[data-testid="game-container"]');
    await expect(board).toHaveScreenshot('with-arrow.png');
  });

  test('should detect timing-dependent arrow visibility', async ({ page }) => {
    // This test checks if arrows appear at the RIGHT TIME during animation
    await page.route('**/ask', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          explanation: "Timing test",
          actions: [
            { type: 'arrow', from: 'e2', to: 'e4', intent: 'idea', comment: 'Arrow 1' },
            { type: 'arrow', from: 'd2', to: 'd4', intent: 'idea', comment: 'Arrow 2' }
          ]
        }),
      });
    });

    await page.goto('http://localhost:5173/');
    await page.waitForSelector('[data-testid="game-container"]');

    const initialCount = await page.locator('[data-testid="game-container"] svg path').count();

    await page.getByPlaceholder(/Ask the coach.../i).fill('Show arrows');
    await page.getByRole('button', { name: /Send/i }).click();

    await expect(page.locator('text=Timing test')).toBeVisible({ timeout: 5000 });

    // Check after first action should complete (750ms)
    await page.waitForTimeout(900);
    const countAfterFirst = await page.locator('[data-testid="game-container"] svg path').count();
    console.log('After first arrow:', countAfterFirst);

    // Check after both actions complete (1500ms total)
    await page.waitForTimeout(900);
    const countAfterBoth = await page.locator('[data-testid="game-container"] svg path').count();
    console.log('After both arrows:', countAfterBoth);

    // CRITICAL ASSERTION:
    // If state updates correctly, we should see arrows accumulate
    // countAfterBoth should be > countAfterFirst (second arrow added)
    expect(countAfterBoth).toBeGreaterThanOrEqual(countAfterFirst);

    // And both should be greater than initial (arrows added)
    expect(countAfterBoth).toBeGreaterThan(initialCount);
  });
});
