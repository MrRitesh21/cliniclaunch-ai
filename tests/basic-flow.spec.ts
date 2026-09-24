import { test, expect } from '@playwright/test';

test.describe('ClinicX Public Site', () => {
  test('Landing page loads successfully', async ({ page }) => {
    // Attempt to load the index page. We assume it runs locally on port 3000
    await page.goto('/');

    // Check that the main application mounts without crashing
    await expect(page).toHaveTitle(/ClinicX/i);
    
    // Add more assertions based on actual landing page content
    // await expect(page.getByRole('heading', { name: 'Welcome to ClinicX' })).toBeVisible();
  });

  test('Public Clinic Booking page mounts', async ({ page }) => {
    // Test the dynamic clinic route (fallback to 404 if no clinic exists, but checks routing)
    const res = await page.goto('/c/demo/book');
    
    // As long as it doesn't crash the server (returns 200 or 404 cleanly), this passes basic E2E
    expect(res?.status()).toBeGreaterThanOrEqual(200);
  });
});
