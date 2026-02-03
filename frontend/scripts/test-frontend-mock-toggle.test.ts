import { test, expect } from '@playwright/test';

test('should allow frontend toggle to use mock data for "London System"', async ({ page }) => {
    // ARRANGE: Go to the app
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('[data-testid="game-container"]');

    // Find and click the toggle to activate mock mode
    const mockToggleButton = page.locator('button:has-text("Live API")');
    await mockToggleButton.click();

    // Verify toggle state changed
    await expect(page.locator('button:has-text("Mock Data ON")')).toBeVisible();

    // ACT: Request the mock scenario
    const inputField = page.getByPlaceholder(/Ask the coach.../i);
    await inputField.click();
    await inputField.fill('London System');
    await inputField.press('Enter');

    // ASSERT: Verify mock response is displayed
    await expect(page.locator('text=This is the Jobava London System')).toBeVisible({ timeout: 5000 });

    // Assert no 429 error message appears
    const errorLocator = page.locator('text=429 RESOURCE_EXHAUSTED');
    await expect(errorLocator).toHaveCount(0);
});

test('should allow frontend toggle to use mock data for "Illegal Move Test"', async ({ page }) => {
    // ARRANGE: Go to the app and activate mock mode
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('[data-testid="game-container"]');
    await page.locator('button:has-text("Live API")').click();

    // ACT: Request the mock scenario
    const inputField = page.getByPlaceholder(/Ask the coach.../i);
    await inputField.click();
    await inputField.fill('Illegal Move Test');
    await inputField.press('Enter');

    // ASSERT: Verify mock response is displayed
    await expect(page.locator('text=This illegal move should become a visual arrow')).toBeVisible({ timeout: 5000 });

    // Assert no 429 error message appears
    const errorLocator = page.locator('text=429 RESOURCE_EXHAUSTED');
    await expect(errorLocator).toHaveCount(0);
});

test('should display mock data correctly via prepopulated pills', async ({ page }) => {
    // ARRANGE: Go to the app and activate mock mode.
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('[data-testid="game-container"]');
    await page.locator('button:has-text("Live API")').click(); // Activate mock mode

    // ACT: Click a prepopulated pill (e.g., "Plan for White")
    await page.locator('button:has-text("Plan for White")').click();

    // ASSERT: Verify the mock response from the pill's prompt is displayed.
    await expect(page.locator('text=White should focus on central control')).toBeVisible({ timeout: 5000 });

    // Assert no connection error
    const errorLocator = page.locator('text=I\'m having trouble connecting to my brain');
    await expect(errorLocator).toHaveCount(0);
});
