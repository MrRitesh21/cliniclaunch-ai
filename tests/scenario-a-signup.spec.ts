import { test, expect } from '@playwright/test';

test.describe('Scenario A: Doctor Signup and Clinical Activation', () => {
  test('Complete signup flow and basic usage', async ({ page }) => {
    // 1. Signup / Setup
    await page.goto('/login');
    await page.getByRole('button', { name: /sign up/i }).click();
    await page.getByPlaceholder(/email/i).fill('doctor_a@example.com');
    await page.getByPlaceholder(/password/i).fill('TestPassword123!');
    await page.getByRole('button', { name: /create account/i }).click();

    // 2. Profile Setup
    // Assume redirect to onboarding
    await page.waitForURL('**/onboarding*');
    await page.getByPlaceholder(/clinic name/i).fill('Demo Clinic A');
    await page.getByRole('button', { name: /continue/i }).click();

    // 3. Dashboard and Staff
    await page.waitForURL('**/dashboard');
    await expect(page.getByRole('heading', { name: /Demo Clinic A/i })).toBeVisible();

    // 4. Create Patient
    await page.getByRole('link', { name: /patients/i }).click();
    await page.getByRole('button', { name: /new patient/i }).click();
    await page.getByLabel(/name/i).fill('John Doe');
    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.getByText('John Doe')).toBeVisible();

    // 5. Create Appointment
    await page.getByRole('link', { name: /appointments/i }).click();
    await page.getByRole('button', { name: /new appointment/i }).click();
    await page.getByLabel(/patient/i).fill('John Doe');
    // Select from dropdown would go here
    await page.getByRole('button', { name: /schedule/i }).click();

    // 6. Visit / Prescription
    await page.getByRole('link', { name: /prescriptions/i }).click();
    await page.getByRole('button', { name: /new prescription/i }).click();
    await page.getByLabel(/patient/i).fill('John Doe');
    await page.getByRole('button', { name: /save/i }).click();

    // 7. Invoice
    await page.getByRole('link', { name: /billing/i }).click();
    await page.getByRole('button', { name: /new invoice/i }).click();
    await page.getByLabel(/patient/i).fill('John Doe');
    await page.getByLabel(/amount/i).fill('500');
    await page.getByRole('button', { name: /create/i }).click();

    // 8. Verify Dashboard real usage
    await page.getByRole('link', { name: /dashboard/i }).click();
    await expect(page.getByText('John Doe')).toBeVisible();
    await expect(page.getByText('₹500')).toBeVisible();
  });
});
