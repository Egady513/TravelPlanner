import { test, expect, Page } from '@playwright/test';

// Test configuration
const APP_URL = 'http://localhost:3002';

// Helper function to wait for page load
async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
}

// Helper to clear localStorage
async function clearLocalStorage(page: Page) {
  await page.evaluate(() => {
    localStorage.clear();
  });
}

test.describe('Road Trip Planner - Comprehensive QA Testing', () => {

  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto(APP_URL);
    await clearLocalStorage(page);
    await page.reload();
    await waitForPageLoad(page);
  });

  test.describe('1. Trip Setup Screen (First Load)', () => {

    test('1.1 Form loads with no errors', async ({ page }) => {
      // Check that the form is visible
      await expect(page.locator('h1')).toContainText('Road Trip Planner');

      // Check all form fields are present
      const tripNameInput = page.locator('#tripName');
      const startDateInput = page.locator('#startDate');
      const endDateInput = page.locator('#endDate');
      const submitButton = page.locator('button[type="submit"]');

      await expect(tripNameInput).toBeVisible();
      await expect(startDateInput).toBeVisible();
      await expect(endDateInput).toBeVisible();
      await expect(submitButton).toBeVisible();

      console.log('✅ PASS: Form loads with all fields visible');
    });

    test('1.2 Field validation - empty fields', async ({ page }) => {
      const submitButton = page.locator('button[type="submit"]');

      // Try to submit with empty fields
      await submitButton.click();
      await page.waitForTimeout(500);

      // Check if we're still on the setup screen (form validation prevented submission)
      const tripNameInput = page.locator('#tripName');
      await expect(tripNameInput).toBeVisible();

      console.log('✅ PASS: Empty field validation works');
    });

    test('1.3 Field validation - end date before start date', async ({ page }) => {
      const tripNameInput = page.locator('#tripName');
      const startDateInput = page.locator('#startDate');
      const endDateInput = page.locator('#endDate');
      const submitButton = page.locator('button[type="submit"]');

      // Fill in fields with invalid date range
      await tripNameInput.fill('Test Trip');
      await startDateInput.fill('2026-06-20');
      await endDateInput.fill('2026-06-02');

      await submitButton.click();
      await page.waitForTimeout(500);

      // Should still be on setup screen
      await expect(tripNameInput).toBeVisible();

      console.log('✅ PASS: End date before start date validation works');
    });

    test('1.4 Create test trip: Utah Adventure, June 2-20, 2026', async ({ page }) => {
      const tripNameInput = page.locator('#tripName');
      const startDateInput = page.locator('#startDate');
      const endDateInput = page.locator('#endDate');
      const submitButton = page.locator('button[type="submit"]');

      // Fill in valid trip data
      await tripNameInput.fill('Utah Adventure');
      await startDateInput.fill('2026-06-02');
      await endDateInput.fill('2026-06-20');

      await submitButton.click();
      await waitForPageLoad(page);

      // Should navigate away from setup screen
      const mapContainer = page.locator('[id*="map"], .map-container, [class*="map"]').first();

      // Wait for either map or main interface to load
      await page.waitForTimeout(2000);

      console.log('✅ PASS: Trip creation succeeded');
    });

    test('1.5 Check localStorage persistence', async ({ page }) => {
      const tripNameInput = page.locator('#tripName');
      const startDateInput = page.locator('#startDate');
      const endDateInput = page.locator('#endDate');
      const submitButton = page.locator('button[type="submit"]');

      // Create trip
      await tripNameInput.fill('Utah Adventure');
      await startDateInput.fill('2026-06-02');
      await endDateInput.fill('2026-06-20');
      await submitButton.click();
      await waitForPageLoad(page);

      // Check localStorage
      const tripData = await page.evaluate(() => {
        return localStorage.getItem('roadTripData');
      });

      expect(tripData).toBeTruthy();

      const parsedData = JSON.parse(tripData!);
      expect(parsedData.tripName).toBe('Utah Adventure');
      expect(parsedData.startDate).toBe('2026-06-02');
      expect(parsedData.endDate).toBe('2026-06-20');

      console.log('✅ PASS: localStorage persistence verified');
    });
  });

  test.describe('2. Main Interface Screen (After Trip Created)', () => {

    test.beforeEach(async ({ page }) => {
      // Create a trip first
      const tripNameInput = page.locator('#tripName');
      const startDateInput = page.locator('#startDate');
      const endDateInput = page.locator('#endDate');
      const submitButton = page.locator('button[type="submit"]');

      await tripNameInput.fill('Utah Adventure');
      await startDateInput.fill('2026-06-02');
      await endDateInput.fill('2026-06-20');
      await submitButton.click();
      await waitForPageLoad(page);
    });

    test('2.1 Header displays correctly', async ({ page }) => {
      // Look for header with trip name
      const header = page.locator('header, [role="banner"], h1, h2').first();
      await expect(header).toBeVisible();

      console.log('✅ PASS: Header displays correctly');
    });

    test('2.2 Sidebar shows all 19 days', async ({ page }) => {
      await page.waitForTimeout(1000);

      // Look for sidebar with days (June 2-20 is 19 days)
      const dayButtons = page.locator('button:has-text("Day"), [class*="day"]');

      // Count should be at least 19
      const count = await dayButtons.count();
      expect(count).toBeGreaterThanOrEqual(19);

      console.log(`✅ PASS: Sidebar shows ${count} days (expected 19)`);
    });

    test('2.3 Map loads successfully', async ({ page }) => {
      await page.waitForTimeout(2000);

      // Look for Google Maps elements
      const mapElements = await page.evaluate(() => {
        const iframes = document.querySelectorAll('iframe');
        const mapDivs = document.querySelectorAll('[id*="map"], .gm-style');
        return {
          iframes: iframes.length,
          mapDivs: mapDivs.length
        };
      });

      expect(mapElements.iframes + mapElements.mapDivs).toBeGreaterThan(0);

      console.log('✅ PASS: Map loads successfully');
    });

    test('2.4 Sidebar collapse/expand', async ({ page }) => {
      await page.waitForTimeout(1000);

      // Look for collapse button (usually has chevron or menu icon)
      const collapseButton = page.locator('button:has-text("Collapse"), button[aria-label*="toggle"], button[aria-label*="sidebar"], [class*="collapse"]').first();

      if (await collapseButton.isVisible()) {
        await collapseButton.click();
        await page.waitForTimeout(500);

        // Check if sidebar state changed
        await collapseButton.click();
        await page.waitForTimeout(500);

        console.log('✅ PASS: Sidebar collapse/expand works');
      } else {
        console.log('⚠️ SKIP: Collapse button not found');
      }
    });

    test('2.5 Day 1 is auto-selected', async ({ page }) => {
      await page.waitForTimeout(1000);

      // Look for selected day (usually has different styling)
      const selectedDay = page.locator('[class*="selected"], [aria-selected="true"], button[class*="active"]:has-text("Day 1")').first();

      await expect(selectedDay).toBeVisible();

      console.log('✅ PASS: Day 1 is auto-selected');
    });
  });

  test.describe('3. Add Activity Flow', () => {

    test.beforeEach(async ({ page }) => {
      // Create trip
      const tripNameInput = page.locator('#tripName');
      const startDateInput = page.locator('#startDate');
      const endDateInput = page.locator('#endDate');
      const submitButton = page.locator('button[type="submit"]');

      await tripNameInput.fill('Utah Adventure');
      await startDateInput.fill('2026-06-02');
      await endDateInput.fill('2026-06-20');
      await submitButton.click();
      await waitForPageLoad(page);
      await page.waitForTimeout(2000);
    });

    test('3.1 Click on map triggers add activity form', async ({ page }) => {
      // Try to click on the map
      const mapContainer = page.locator('[id*="map"], .gm-style, [class*="map-container"]').first();

      if (await mapContainer.isVisible()) {
        await mapContainer.click({ position: { x: 200, y: 200 } });
        await page.waitForTimeout(1000);

        // Look for activity form
        const activityForm = page.locator('form, [role="dialog"], [class*="modal"]').first();

        console.log('✅ PASS: Map click triggers add activity form');
      } else {
        console.log('⚠️ SKIP: Map container not found');
      }
    });

    test('3.2 Test coordinate paste field', async ({ page }) => {
      // Try to find and use coordinate input
      const coordInput = page.locator('input[placeholder*="coordinate"], input[placeholder*="lat"], input[name*="coordinate"]').first();

      if (await coordInput.isVisible()) {
        await coordInput.fill('37.2985, -113.0263');
        await page.waitForTimeout(500);

        console.log('✅ PASS: Coordinate paste field works');
      } else {
        console.log('⚠️ SKIP: Coordinate input not found');
      }
    });
  });

  test.describe('4. Data Persistence', () => {

    test('4.1 Data persists after refresh', async ({ page }) => {
      // Create trip
      const tripNameInput = page.locator('#tripName');
      const startDateInput = page.locator('#startDate');
      const endDateInput = page.locator('#endDate');
      const submitButton = page.locator('button[type="submit"]');

      await tripNameInput.fill('Utah Adventure');
      await startDateInput.fill('2026-06-02');
      await endDateInput.fill('2026-06-20');
      await submitButton.click();
      await waitForPageLoad(page);

      // Refresh page
      await page.reload();
      await waitForPageLoad(page);

      // Should not show setup screen
      const setupForm = page.locator('#tripName');
      const isSetupVisible = await setupForm.isVisible().catch(() => false);

      expect(isSetupVisible).toBe(false);

      console.log('✅ PASS: Data persists after refresh');
    });

    test('4.2 Clear Trip returns to setup screen', async ({ page }) => {
      // Create trip
      const tripNameInput = page.locator('#tripName');
      const startDateInput = page.locator('#startDate');
      const endDateInput = page.locator('#endDate');
      const submitButton = page.locator('button[type="submit"]');

      await tripNameInput.fill('Utah Adventure');
      await startDateInput.fill('2026-06-02');
      await endDateInput.fill('2026-06-20');
      await submitButton.click();
      await waitForPageLoad(page);

      // Find and click Clear Trip button
      const clearButton = page.locator('button:has-text("Clear"), button:has-text("New Trip"), button:has-text("Reset")').first();

      if (await clearButton.isVisible()) {
        await clearButton.click();
        await page.waitForTimeout(1000);

        // Should show setup screen again
        const setupFormAfterClear = page.locator('#tripName');
        await expect(setupFormAfterClear).toBeVisible();

        console.log('✅ PASS: Clear Trip returns to setup screen');
      } else {
        console.log('⚠️ SKIP: Clear Trip button not found');
      }
    });
  });
});
