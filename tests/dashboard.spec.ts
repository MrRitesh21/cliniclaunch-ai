import { test, expect } from '@playwright/test';

test.describe('Dashboard Authentication & Core Features', () => {
  test('unauthenticated users are redirected to login', async ({ page }) => {
    // Attempt to access dashboard directly
    await page.goto('/dashboard');
    
    // The router should redirect to /login
    await page.waitForURL('**/login*');
    expect(page.url()).toContain('/login');
  });
});
