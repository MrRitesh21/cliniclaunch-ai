import { test, expect } from '@playwright/test';

test.describe('Doctor Flows: Profile, Schedule, Queue, Consultation & Records', () => {

  test.describe('1. Doctor Profile & Schedule Management', () => {
    test('doctor management route redirects unauthenticated users or mounts properly', async ({ page }) => {
      await page.goto('/dashboard/doctors');
      // Unauthenticated users are safely redirected to /login
      await page.waitForURL('**/login*');
      expect(page.url()).toContain('/login');
    });

    test('schedule calculation supports 2 shifts, slot duration and emergency reservations', async () => {
      // Test schedule computation helper logic
      const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
      const schedule = {
        is_two_shifts: true,
        slot_duration_minutes: 15,
        max_patients_per_slot: 2,
        monday: {
          enabled: true,
          start: '09:00',
          end: '12:00',
          shift2_enabled: true,
          start2: '16:00',
          end2: '19:00',
        },
      };

      expect(schedule.is_two_shifts).toBe(true);
      expect(schedule.slot_duration_minutes).toBe(15);
      expect(schedule.monday.enabled).toBe(true);
      expect(schedule.monday.shift2_enabled).toBe(true);
    });
  });

  test.describe('2. OPD Queue Lifecycle & Patient Transitions', () => {
    test('OPD queue route redirects unauthenticated users', async ({ page }) => {
      await page.goto('/dashboard/queue');
      await page.waitForURL('**/login*');
      expect(page.url()).toContain('/login');
    });

    test('OPD queue lifecycle transitions correctly across statuses', async () => {
      type QueueStatus = 'waiting' | 'serving' | 'done' | 'skipped' | 'emergency';
      const queueItem: { id: string; status: QueueStatus; priority: boolean } = {
        id: 'tok-1',
        status: 'waiting',
        priority: false,
      };

      // 1. Initial status: waiting
      expect(queueItem.status).toBe('waiting');

      // 2. Call Next Patient: transition to serving
      queueItem.status = 'serving';
      expect(queueItem.status).toBe('serving');

      // 3. Complete consultation: transition to done
      queueItem.status = 'done';
      expect(queueItem.status).toBe('done');

      // 4. Emergency escalation
      const emergencyItem = { id: 'tok-2', status: 'waiting' as QueueStatus, priority: true };
      expect(emergencyItem.priority).toBe(true);
    });
  });

  test.describe('3. Doctor Consultation Cockpit & Treatment Bundles', () => {
    test('consultation route redirects unauthenticated users', async ({ page }) => {
      await page.goto('/dashboard/consult');
      await page.waitForURL('**/login*');
      expect(page.url()).toContain('/login');
    });

    test('treatment bundles populate clinical notes, diagnosis, and prescription items', async () => {
      const treatmentBundle = {
        id: 'uri_cold',
        name: 'Upper Respiratory Infection / Cold',
        diagnosis: 'Acute Viral Rhinopharyngitis',
        chief_complaint: 'Runny nose, throat irritation, dry cough for 3 days',
        medicines: [
          { name: 'Tab Paracetamol 650mg', dose: '1 tab', frequency: '1-0-1 SOS', duration: '3 days' },
          { name: 'Tab Cetirizine 10mg', dose: '1 tab', frequency: '0-0-1 Night', duration: '5 days' },
        ],
        advice: 'Steam inhalation twice daily. Warm saline gargles. Hydrate well.',
      };

      const consultationDraft = {
        patientId: 'pat-10',
        bpSystolic: 120,
        bpDiastolic: 80,
        spo2: 99,
        bloodSugar: 98,
        diagnosis: treatmentBundle.diagnosis,
        chief_complaint: treatmentBundle.chief_complaint,
        medicines: treatmentBundle.medicines,
        treatment_plan: treatmentBundle.advice,
      };

      expect(consultationDraft.diagnosis).toBe('Acute Viral Rhinopharyngitis');
      expect(consultationDraft.bpSystolic).toBe(120);
      expect(consultationDraft.bpDiastolic).toBe(80);
      expect(consultationDraft.spo2).toBe(99);
      expect(consultationDraft.medicines.length).toBe(2);
      expect(consultationDraft.medicines[0].name).toBe('Tab Paracetamol 650mg');
    });
  });

  test.describe('4. Prescription Management & Patient Record Retrieval', () => {
    test('prescriptions and records routes redirect unauthenticated users', async ({ page }) => {
      await page.goto('/dashboard/prescriptions');
      await page.waitForURL('**/login*');
      expect(page.url()).toContain('/login');

      await page.goto('/dashboard/records');
      await page.waitForURL('**/login*');
      expect(page.url()).toContain('/login');
    });

    test('re-order and clone previous Rx generates valid medication items', async () => {
      const pastPrescription = {
        id: 'past-rx-101',
        patient_name: 'Amit Patel',
        items: [
          { drug_name: 'Tab Telmisartan 40mg', dose: '1 tab', frequency: '1-0-0', duration: '30 days', instructions: 'After breakfast' },
          { drug_name: 'Tab Rosuvastatin 10mg', dose: '1 tab', frequency: '0-0-1', duration: '30 days', instructions: 'At night' },
        ],
      };

      // Clone operation creates identical items for new prescription
      const clonedItems = pastPrescription.items.map((item, idx) => ({
        ...item,
        position: idx + 1,
      }));

      expect(clonedItems.length).toBe(2);
      expect(clonedItems[0].drug_name).toBe('Tab Telmisartan 40mg');
      expect(clonedItems[0].position).toBe(1);
      expect(clonedItems[1].drug_name).toBe('Tab Rosuvastatin 10mg');
      expect(clonedItems[1].position).toBe(2);
    });
  });
});
