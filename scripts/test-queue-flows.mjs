import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('dashboard.queue.tsx exports Route and renders without redirection', () => {
  const code = source('src/routes/_authenticated/dashboard.queue.tsx');
  assert.ok(code.includes('export const Route = createFileRoute("/_authenticated/dashboard/queue")'));
  // Must NOT redirect away to /dashboard/consult
  assert.ok(!code.includes('<Navigate to="/dashboard/consult" replace />'), 'Queue route must not immediately navigate away');
  assert.ok(code.includes('<QueuePage />'), 'Route must render QueuePage');
});

test('dashboard.walkins.tsx exports Route and has rapid registration desk', () => {
  const code = source('src/routes/_authenticated/dashboard.walkins.tsx');
  assert.ok(code.includes('export const Route = createFileRoute("/_authenticated/dashboard/walkins")'));
  // Must NOT be a redirect stub
  assert.ok(!code.includes('throw redirect({ to: "/dashboard/qr"'), 'Walkins route must not throw redirect to qr');
  assert.ok(code.includes('WalkinDeskPage'), 'Walkins must render WalkinDeskPage');
  assert.ok(code.includes('Rapid Walk-in Check-in'), 'Walkins must have rapid walk-in registration');
});

test('OPD queue statuses include all 5 required states', () => {
  const queueCode = source('src/routes/_authenticated/dashboard.queue.tsx');
  assert.ok(queueCode.includes('waiting: {'), 'Must have Waiting status config');
  assert.ok(queueCode.includes('serving: {'), 'Must have In Consultation status config');
  assert.ok(queueCode.includes('completed: {'), 'Must have Completed status config');
  assert.ok(queueCode.includes('no_show: {'), 'Must have No Show status config');
  assert.ok(queueCode.includes('emergency: {'), 'Must have Emergency status config');
});

test('1-click Call Next Patient button and wait time calculation exist', () => {
  const queueCode = source('src/routes/_authenticated/dashboard.queue.tsx');
  assert.ok(queueCode.includes('Call Next Patient'), 'Must have 1-click Call Next Patient button');
  assert.ok(queueCode.includes('calculateWaitTime'), 'Must calculate wait time estimate');
  assert.ok(queueCode.includes('handleCallNext'), 'Must have handleCallNext action');
  assert.ok(queueCode.includes('playCallChime'), 'Must play audio chime on call');
});

test('Walk-in rapid registration issues token and creates appointment entry', () => {
  const queueCode = source('src/routes/_authenticated/dashboard.queue.tsx');
  assert.ok(queueCode.includes('Rapid Walk-in Check-in') || queueCode.includes('RapidWalkinDialog'));
  assert.ok(queueCode.includes('.from("queue_tokens").insert'));
  assert.ok(queueCode.includes('Flame'), 'Must have Emergency triage toggle');
});

test('Queue transition seamlessly navigates to consult with appointmentId', () => {
  const queueCode = source('src/routes/_authenticated/dashboard.queue.tsx');
  assert.ok(queueCode.includes('/dashboard/consult'));
  assert.ok(queueCode.includes('appointmentId'));
});

test('Appointments page integrates with Live OPD Queue', () => {
  const apptCode = source('src/routes/_authenticated/dashboard.appointments.tsx');
  assert.ok(apptCode.includes('Check-in to Queue'), 'Appointments must have 1-click check-in to OPD queue');
  assert.ok(apptCode.includes('/dashboard/queue'), 'Appointments must link to Live OPD Queue');
  assert.ok(apptCode.includes('Waiting in OPD'), 'Appointments must support Waiting in OPD tab');
});
