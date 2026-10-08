import { test, expect } from '@playwright/test';

test.describe('Scenario E: Cross-tenant Access Denial', () => {
  test('Clinic A cannot access Clinic B records via HTTP or JWT', async ({ request, page }) => {
    // Note: Requires backend fixture with two clinics, Clinic A and Clinic B, and their respective JWTs
    // Assume JWTs are available via environment or fixture setup

    const clinicAJwt = process.env.CLINIC_A_JWT || 'mock_jwt_a';
    const clinicBPatientId = process.env.CLINIC_B_PATIENT_ID || 'mock_patient_b_id';

    // 1. Direct HTTP API Test
    // Try to fetch Clinic B's patient using Clinic A's token
    const response = await request.get(`/api/v1/patients/${clinicBPatientId}`, {
      headers: {
        'Authorization': `Bearer ${clinicAJwt}`
      }
    });

    // Should return 404 or 403 (RLS usually hides the row resulting in 404, or 403 if explicitly forbidden)
    expect([403, 404]).toContain(response.status());

    // 2. Browser UI Test
    // Login as Clinic A
    await page.goto('/login');
    await page.getByPlaceholder(/email/i).fill('doctor_a@example.com');
    await page.getByPlaceholder(/password/i).fill('TestPassword123!');
    await page.getByRole('button', { name: /login/i }).click();
    await page.waitForURL('**/dashboard');

    // Attempt to navigate to Clinic B's patient directly
    await page.goto(`/dashboard/patients/${clinicBPatientId}`);
    
    // Expect error boundary, not found, or unauthorized
    await expect(page.getByText(/not found|unauthorized|error/i)).toBeVisible();
  });
});
