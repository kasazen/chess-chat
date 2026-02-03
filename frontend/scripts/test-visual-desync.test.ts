import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mockResponses = JSON.parse(fs.readFileSync(path.join(__dirname, '../tests/mocks/responses.json'), 'utf-8'));

test('should VISUALLY PROVE the desync from a mock illegal move', async ({ page }) => {
    // ARRANGE: Intercept network calls to use local mock data.
    await page.route('**/ask', (route, request) => {
        const requestBody = request.postDataJSON();
        const scenarioKey = requestBody?.message;
        if (mockResponses[scenarioKey]) {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(mockResponses[scenarioKey])
            });
        }
        return route.fulfill({ status: 404 });
    });

    const STARTING_FEN = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'; // Black's turn

    // Go to the app and establish the baseline state.
    await page.goto('http://localhost:5173/');
    await page.locator('button:has-text("Live API")').click(); // Activate mock mode
    await page.waitForSelector('[data-testid="game-container"]');
    await page.evaluate((fen) => {
        (window as any).__test_vars.gameRef.current.load(fen);
    }, STARTING_FEN);

    // Give board time to render
    await page.waitForTimeout(500);

    // ACT: Trigger the "Illegal Move Test" scenario using the new, reliable test hook.
    await page.evaluate(() => (window as any).__test_vars.sendMessage('Illegal Move Test'));

    // Wait for the UI to settle by waiting for the AI's comment to appear.
    await expect(page.locator('text=I will now demonstrate the illegal move Nf3.')).toBeVisible({ timeout: 5000 });

    // ASSERT: This assertion MUST FAIL on the current build.
    // It compares the final board state to a "golden" snapshot that contains the correctly rendered arrow.
    // The current bug will produce a board with NO arrow, causing a visual diff failure.
    await expect(page.locator('[data-testid="game-container"]')).toHaveScreenshot('board-with-illegal-move-arrow.png');
});
