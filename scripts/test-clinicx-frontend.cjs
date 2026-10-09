const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const source = p => fs.readFileSync(path.join(root, p), 'utf8');
function load(p, doubles = {}, extra = '') {
  const m = { exports: {} };
  const code = ts.transpileModule(source(p), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const transportRequire = name => Object.prototype.hasOwnProperty.call(doubles, name) ? doubles[name] : name === './AuthorityBoundary' ? load('src/components/app/AuthorityBoundary.tsx', doubles) : name === '@/lib/persist-cache' ? load('src/lib/persist-cache.ts') : require(name);
  new Function('require', 'module', 'exports', code + '\n' + extra)(transportRequire, m, m.exports);
  return m.exports;
}
test('trial checkpoints use server UTC time for copy, never access', () => {
  const { trialMessage, recoveryRoute } = load('src/components/billing/clinicx-ux.ts');
  const start = '2026-10-01T00:00:00.000Z';
  for (const [day, text] of [[0, 'Welcome'], [7, 'first week'], [15, 'halfway'], [21, '9 days'], [25, '5 days'], [28, '2 days']]) {
    const snap = { effective_state: 'trialing', server_now: new Date(Date.parse(start) + day * 86400000).toISOString(), subscription: { trial_started_at: start, trial_ends_at: '2026-10-31T00:00:00Z' } };
    assert.ok(trialMessage(snap).includes(text), `day ${day}`);
  }
  assert.match(trialMessage({ effective_state: 'grace_period', subscription: {} }), /read.only/i);
  assert.match(trialMessage({ effective_state: 'suspended', subscription: {} }), /export/i);
  assert.equal(recoveryRoute('/dashboard/billing'), true);
  assert.equal(recoveryRoute('/dashboard/settings'), true);
  assert.equal(recoveryRoute('/dashboard/settings-bypass'), false);
  assert.equal(recoveryRoute('/dashboard/patients'), false);
});
test('trial and grace guards respect platform-wide unavailable modules', () => {
  for (const can_write of [true, false]) {
    const ctx = { org: { id: 'clinic' }, installedModuleIds: ['prescriptions'], planModuleIds: ['prescriptions'], unavailableModuleIds: ['prescriptions'], entitlement: { can_read: true, can_write }, authorityError: null, refresh: async () => {} };
    const { AppGuard } = load('src/components/app/AppGuard.tsx', { ...uiDoubles, '@/hooks/useOrganization': { useOrganization: () => ctx }, './AppNotInstalled': { AppNotInstalled: () => null } });
    const html = renderToStaticMarkup(React.createElement(AppGuard, { appKey: 'prescriptions' }, 'Protected records'));
    assert.equal(html.includes('Protected records'), false);
    assert.match(html, /unavailable/);
  }
});
test('shared hook enables authoritative trial features and rejects transport failures', async () => {
  let authorityFails = false;
  let grace = false;
  const responses = {
    organization_members: [{ organization_id: 'org', role: 'owner' }], organizations: { id: 'org' },
    organization_modules: [], subscriptions: null, modules: [{ id: 'inventory' }],
    organization_module_overrides: [{ module_id: 'inventory', enabled: true }],
    clinicx_feature_aliases: [{ alias: 'staff', feature: 'staff' }, { alias: 'billing', feature: 'billing' }],
  };
  const transport = { from(table) {
    const result = { data: responses[table], error: null };
    const chain = { select: () => chain, eq: () => chain, order: () => chain, limit: () => chain, maybeSingle: () => chain, then: (resolve, reject) => Promise.resolve(result).then(resolve, reject) };
    return chain;
  } };
  const mod = load('src/hooks/useOrganization.ts', {
    '@/integrations/supabase/client': { supabase: transport }, '@/hooks/useAuthReady': { useAuthReady: () => ({}) },
    '@/lib/subscription.functions': { getClinicSubscription: async () => { if (authorityFails) throw new Error('unavailable'); return { ...fixture, features: grace ? [] : ['staff','billing','inventory'], role: 'owner', ...(grace ? {effective_state:'grace_period',can_write:false} : {}) }; } },
  }, ';module.exports.loadShared = loadShared;');
  const trial = await mod.loadShared('owner');
  assert.ok(trial.installedModuleIds.includes('staff')); assert.ok(trial.installedModuleIds.includes('billing'));
  assert.equal(trial.installedModuleIds.includes('inventory'), false); assert.ok(trial.unavailableModuleIds.includes('inventory'));
  grace = true;
  const readonly = await mod.loadShared('owner', true);
  assert.ok(readonly.installedModuleIds.includes('patients')); assert.ok(readonly.installedModuleIds.includes('billing')); assert.deepEqual(readonly.planModuleIds, []);
  authorityFails = true;
  const failed = await mod.loadShared('owner', true);
  assert.equal(failed.entitlement, null); assert.equal(failed.isSubscriptionExpired, true); assert.deepEqual(failed.planModuleIds, []); assert.match(failed.authorityError, /verified/);
});
test('shared hook never returns prior-user grants before its account-change effect runs', () => {
  const oldSnapshot = { org: { id: 'prior-clinic' }, role: 'owner', entitlement: fixture, installedModuleIds: ['billing'], planModuleIds: ['billing'] };
  for (const user of [{ id: 'new-owner' }, null]) {
    const { useOrganization } = load('src/hooks/useOrganization.ts', {
      react: { useState: () => [oldSnapshot, () => {}], useEffect: () => {}, useCallback: fn => fn },
      '@/integrations/supabase/client': { supabase: {} }, '@/hooks/useAuthReady': { useAuthReady: () => ({ isReady: true, user }) },
      '@/lib/subscription.functions': { getClinicSubscription: () => assert.fail('no network during render') },
    });
    const ctx = useOrganization(); assert.equal(ctx.entitlement, null); assert.equal(ctx.role, null); assert.deepEqual(ctx.planModuleIds, []);
  }
});
test('organization overrides cannot turn off platform-wide safety switches', () => {
  assert.doesNotMatch(source('src/hooks/useOrganization.ts'), /disabled\.delete/);
});
test('shared entitlements fail closed without Enterprise fallbacks or persisted grants', () => {
  const s = source('src/hooks/useOrganization.ts');
  assert.match(s, /getClinicSubscription/);
  assert.match(s, /authorityError/);
  assert.doesNotMatch(s, /ALL_KNOWN_MODULES|periodElapsed|activePlanId/);
  // Shell metadata may persist; authority must be live and bound to the caller.
  assert.match(s, /authorityUserId/);
  assert.match(s, /writeCache\(`org_snapshot:\$\{cacheUserId\}`, \{ org: s.org \}\)/);
  const guard = source('src/components/app/AppGuard.tsx');
  assert.match(guard, /planModuleIds.includes/);
  assert.doesNotMatch(guard, /CORE_ACTIVE_APPS/);
});
test('journey separates trial-window activity from all-time quota activation checks', () => {
  const { activationSteps } = load('src/components/billing/clinicx-ux.ts');
  const steps = activationSteps({ patients: 0, doctors: 1, staff: 0, appointments: 0, prescriptions: 0, invoices: 0 }, { clinic_name: 'Clinic', doctor_name: 'Doctor', specialization: 'GP', working_hours: {} });
  assert.equal(steps.length, 9);
  assert.equal(steps.filter(s => s.done).length, 2);
  assert.equal(steps.find(s => s.key === 'billing').done, false);
  assert.equal(steps.find(s => s.key === 'booking').done, false);
  const card = source('src/components/billing/ClinicTrialJourney.tsx');
  assert.match(card, /Trial-window activity/);
  assert.doesNotMatch(card, /22%|hours saved|revenue generated/i);
  const shell = source('src/routes/_authenticated/dashboard.tsx');
  assert.match(shell, /recoveryRoute\(pathname\)/);
  assert.match(shell, /entitlement\.can_write/);
});
test('catalog pricing and unlimited limits never invent discounts or utilization', () => {
  const { pricePresentation, limitPresentation } = load('src/components/billing/clinicx-ux.ts');
  assert.deepEqual(limitPresentation(340, null), { text: '340 / Unlimited', percent: null });
  assert.equal(limitPresentation(0, undefined).text, '0 / Not configured');
  assert.equal(limitPresentation(150, 100).percent, 100);
  const p = { monthly_price: 999, yearly_price: 9990, discounted_monthly_price: null, discounted_yearly_price: null };
  assert.equal(pricePresentation(p, 'yearly').total, 9990);
  assert.equal(pricePresentation(p, 'yearly').savings, 1998);
  assert.equal(pricePresentation({ ...p, discounted_yearly_price: 12000 }, 'yearly').discounted, false);
  assert.equal(pricePresentation({ ...p, discounted_monthly_price: 800, discounted_yearly_price: 9990 }, 'yearly').savings, 0);
});
test('clinic backup paginates every allowed table and deduplicates IDs', async () => {
  const { collectClinicBackup, CLINIC_EXPORT_TABLES } = load('src/components/billing/clinicx-ux.ts');
  const calls = [];
  const result = await collectClinicBackup('org', async req => {
    calls.push(req);
    return req.cursor ? { table: req.table, records: [{ id: 'b' }], next_cursor: null, has_more: false } : { table: req.table, records: [{ id: 'a' }, { id: 'a' }], next_cursor: 'a', has_more: true };
  });
  assert.equal(calls.length, CLINIC_EXPORT_TABLES.length * 2);
  assert.equal(result.total_records, CLINIC_EXPORT_TABLES.length * 2);
  for (const table of CLINIC_EXPORT_TABLES) assert.equal(result.tables[table].length, 2);
  await assert.rejects(() => collectClinicBackup('org', async req => ({ table: req.table, records: [], next_cursor: null, has_more: true })), /cursor/);
  await assert.rejects(() => collectClinicBackup('org', async () => ({ table: 'wrong', records: [], next_cursor: null, has_more: false })), /table/);
});
test('checkout preserves signatures and never locally activates a paid plan', () => {
  const s = source('src/routes/_authenticated/dashboard.billing.tsx');
  assert.doesNotMatch(s, /setSub\(|Date\.now\(\)\s*\+|CANCEL MY PRACTICE|22%|permanently\s+deleted|ValueReceiptCard|patient_phone/);
  assert.match(s, /razorpay_signature/);
  assert.match(s, /attempt_id: res.attempt_id/);
  assert.match(s, /checkSubscriptionDowngrade/);
  assert.match(s, /collectClinicBackup/);
  assert.match(s, /listSubscriptionBillingPage/);
});
test('comparison uses server catalog limits and features, not tier constants', () => {
  const s = source('src/components/billing/PlanCompareTable.tsx');
  assert.doesNotMatch(s, /PLAN_LIMITS|module_ids|Math.round/);
  assert.match(s, /planLimits/);
  assert.match(s, /planFeatures/);
  assert.match(s, /pricePresentation/);
});
test('billing composite pages reject nonadvancing cursors and preserve tied timestamps', () => {
  const { mergeBillingPage } = load('src/components/billing/clinicx-ux.ts');
  const first = { kind: 'payments', currency: 'INR', amount_unit: 'paise', entries: [{ id: 'b' }], has_more: true, next_cursor: { created_at: '2026-01-01T00:00:00Z', id: 'b' } };
  assert.deepEqual(mergeBillingPage(first, { ...first, entries: [{ id: 'a' }], next_cursor: { ...first.next_cursor, id: 'a' } }).entries.map(r => r.id), ['b', 'a']);
  assert.throws(() => mergeBillingPage(first, first), /cursor/i);
  assert.throws(() => mergeBillingPage(null, { ...first, next_cursor: null }), /cursor/i);
  assert.throws(() => mergeBillingPage(null, { ...first, amount_unit: 'unclassified' }), /unit/i);
});

const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const primitive = tag => ({ children, variant, size, asChild, ...props }) => React.createElement(tag, props, children);
const uiDoubles = {
  '@/components/ui/card': { Card: primitive('section') },
  '@/components/ui/badge': { Badge: primitive('span') },
  '@/components/ui/button': { Button: primitive('button') },
  '@/components/ui/skeleton': { Skeleton: primitive('div') },
  '@tanstack/react-router': { Link: ({ to, children, ...props }) => React.createElement('a', { href: to, ...props }, children) },
  '@tanstack/react-query': { useQuery: () => ({ data: undefined, isError: false }) },
  '@/lib/trial-engagement.functions': { getClinicTrialEngagement: async () => assert.fail('SSR must not query') },
  '@/lib/trial-engagement': load('src/lib/trial-engagement.ts'),
};
const fixture = {
  organization_id: '11111111-1111-4111-8111-111111111111', role: 'owner', server_now: '2026-10-22T00:00:00Z',
  effective_state: 'trialing', can_read: true, can_write: true, can_export: true,
  subscription: { trial_started_at: '2026-10-01T00:00:00Z', trial_ends_at: '2026-10-31T00:00:00Z', plan_id: 'growth' },
  usage: { patients: 32, appointments: 47, completed_appointments: 19, visits: 12, prescriptions: 9, invoices: 3, doctors: 1, staff: 0, pending_staff_invites: 0, invoiced_inr: 24500, collected_inr: 12000, features_used: [], window: 'all_time' },
  recommendation: { plan_id: 'growth' },
};
const engagement = { organization_id: fixture.organization_id, server_now: fixture.server_now, activation: [], checkpoints: [], usage: { window: 'trial', window_started_at: fixture.subscription.trial_started_at, window_ended_at: fixture.server_now, currency: 'INR', patients: 7, appointments: 9, completed_appointments: 4, visits: 3, completed_visits: null, prescriptions: 2, invoices: 1, invoiced_inr: 1250, collected_inr: 500, days_active: 3, days_active_basis: 'UTC recorded activity', completed_visits_unavailable_reason: 'EMR does not track completion' } };
test('grace guard preserves archived clinical reads without installation or premium grants', () => {
  const ctx = { org: { id: 'clinic' }, installedModuleIds: [], planModuleIds: [], entitlement: { can_read: true, can_write: false }, authorityError: null, refresh: async () => {} };
  const { AppGuard } = load('src/components/app/AppGuard.tsx', { ...uiDoubles, '@/hooks/useOrganization': { useOrganization: () => ctx }, './AppNotInstalled': { AppNotInstalled: () => React.createElement('div', null, 'Not installed') } });
  const html = renderToStaticMarkup(React.createElement(AppGuard, { appKey: 'prescriptions' }, React.createElement('p', null, 'Archived prescription')));
  assert.ok(html.includes('Archived prescription'));
});
test('journey component renders real counters and honest pending billing configuration', () => {
  const { ClinicTrialJourney } = load('src/components/billing/ClinicTrialJourney.tsx', { ...uiDoubles, './clinicx-ux': load('src/components/billing/clinicx-ux.ts') });
  const html = renderToStaticMarkup(React.createElement(ClinicTrialJourney, { snapshot: fixture, engagement, clinic: { clinic_name: 'Clinic', doctor_name: 'Doctor', specialization: 'GP' }, checklist: true }));
  assert.ok(html.includes('9 days'));
  assert.ok(html.includes('₹1,250')); assert.equal(html.includes('₹24,500'), false);
  assert.ok(html.includes('Trial-window activity')); assert.ok(html.includes('Not tracked'));
  assert.ok(html.includes('configuration not yet tracked'));
  assert.ok(html.includes('/9 completed'));
});
test('unknown and suspended access do not render protected clinical children', () => {
  for (const entitlement of [null, { can_read: false, can_write: false }]) {
    const { AppGuard } = load('src/components/app/AppGuard.tsx', { ...uiDoubles, '@/hooks/useOrganization': { useOrganization: () => ({ org: { id: 'clinic' }, installedModuleIds: ['patients'], planModuleIds: ['patients'], entitlement, authorityError: null, refresh: async () => {} }) }, './AppNotInstalled': { AppNotInstalled: () => null } });
    const html = renderToStaticMarkup(React.createElement(AppGuard, { appKey: 'patients' }, React.createElement('p', null, 'Sensitive child')));
    assert.equal(html.includes('Sensitive child'), false);
  }
});
test('paid plan changes use durable schedule and independent renewal readback, never checkout', async () => {
  let starts = 0, changes = 0;
  const messages = [], successes = [];
  const command = { id: 'command', state: 'scheduled', plan_id: 'professional', billing_cycle: 'yearly', amount_paise: 8599000, effective_at: '2030-01-01T00:00:00Z' };
  const f = closureFunction('src/routes/_authenticated/dashboard.billing.tsx', 'confirmUpgrade', {
    org: { id: 'org' }, pendingPlan: { id: 'professional', name: 'Professional' }, canManageBilling: true,
    entitlement: { ...fixture, subscription: { access_source: 'verified_payment' } }, cycle: 'yearly',
    replacementPaused: true, processing: false, setRenewal: () => {}, setRenewalError: () => {}, paidMandate: true, recurringBlocked: false, workspace: { current: { id: 'org', epoch: 1 } },
    setProcessing: () => {}, setCheckoutMessage: m => messages.push(m), setPendingPlan: () => {},
    z: require('zod').z, downgradeFn: async () => ({ allowed: true, violations: [] }),
    changeFn: async ({ data }) => { changes++; assert.deepEqual(data, { organization_id: 'org', plan_id: 'professional', billing_cycle: 'yearly' }); return command; },
    startFn: async () => { starts++; }, refresh: async () => {},
    refreshBilling: async () => ({ available: true, pending_change: command }),
    getClinicSubscription: async () => ({ ...fixture, organization_id: 'org' }),
    toast: { success: m => successes.push(m), error: m => messages.push(m), info: m => messages.push(m) },
  });
  await f();
  assert.equal(changes, 1); assert.equal(starts, 0);
  assert.match(messages.join(' '), /scheduled.*not.*active/i);
  assert.equal(successes.length, 0);
});
test('cancellation submits optional reason and confirms stopped mandate plus retained paid period', async () => {
  let payload;
  const successes = [], errors = [];
  const f = closureFunction('src/routes/_authenticated/dashboard.billing.tsx', 'confirmCancelPlan', {
    org: { id: 'org' }, canManageBilling: true, cancelling: false, cancelReason: 'Too expensive', workspace: { current: { id: 'org' } },
    setCancelling: () => {}, setShowCancelDialog: () => {}, setCheckoutMessage: () => {},
    cancelFn: async ({ data }) => { payload = data; return { ok: true, mandate_stopped: true, paid_through: '2030-01-01T00:00:00Z' }; },
    refresh: async () => {}, getClinicSubscription: async () => ({ organization_id: 'org', subscription: { cancel_at_period_end: true, current_period_end: '2030-01-01T00:00:00Z' } }),
    refreshBilling: async () => ({ available: true, provider_status: 'cancelled', will_renew: false }),
    toast: { success: m => successes.push(m), error: m => errors.push(m) },
  });
  await f(); assert.deepEqual(payload, { organization_id: 'org', reason: 'Too expensive' }); assert.equal(errors.length, 0); assert.equal(successes.length, 1);
});

test('notification settings offers separate owner lifecycle email consent, default off', () => {
  const Card = primitive('section');
  const { NotificationSettingsCard } = load('src/components/app/NotificationSettingsCard.tsx', {
    ...uiDoubles, '@/components/ui/card': { Card, CardContent: primitive('div'), CardDescription: primitive('p'), CardHeader: primitive('header'), CardTitle: primitive('h2') },
    '@/hooks/useOrganization': { useOrganization: () => ({ org: { id: 'org' }, role: 'owner' }) },
    '@tanstack/react-start': { useServerFn: f => f },
    '@/lib/trial-engagement.functions': { setClinicTrialEmailConsent: async () => assert.fail('no consent writes during render') },
    '@/lib/push-client': { usePushNotifications: () => ({ devices: [], supported: false }) },
  });
  const html = renderToStaticMarkup(React.createElement(NotificationSettingsCard));
  assert.match(html, /Trial and subscription emails/);
  assert.match(html, /Save email preference/);
  assert.doesNotMatch(html, /checked=""/);
  assert.match(html, /not patient messaging consent/);
});

function closureFunction(file, name, bindings) {
  const s = source(file);
  const ast = ts.createSourceFile(file, s, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found;
  function visit(node) { if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node; ts.forEachChild(node, visit); }
  visit(ast);
  assert.ok(found, `missing source function ${name}`);
  const code = ts.transpileModule(found.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(bindings), code + `; return ${name};`)(...Object.values(bindings));
}
test('real checkout handler submits all signed fields and leaves authorization-only access pending', async () => {
  let options, payload;
  const messages = [], success = [];
  const f = closureFunction('src/routes/_authenticated/dashboard.billing.tsx', 'confirmUpgrade', {
    paidMandate: false, recurringBlocked: false, processing: false, workspace: { current: { id: 'org' } }, org: { id: 'org' }, pendingPlan: { id: 'growth', name: 'Growth' }, canManageBilling: true, entitlement: fixture, cycle: 'monthly',
    setProcessing: () => {}, setCheckoutMessage: message => messages.push(message), setPendingPlan: () => {},
    z: require('zod').z, downgradeFn: async () => ({ allowed: true, violations: [] }),
    startFn: async () => ({ key_id: 'isolated-key', subscription_id: 'sub_fixture', attempt_id: 'attempt-fixture' }),
    loadRazorpayScript: async () => true,
    window: { Razorpay: class { constructor(opts) { options = opts; } open() {} on() {} } },
    activateFn: async ({ data }) => { payload = data; return { success: false, pending: true }; },
    refresh: async () => {}, getClinicSubscription: async () => fixture, refreshBilling: async () => {},
    toast: { success: m => success.push(m), error: m => messages.push(m) },
  });
  await f();
  await options.handler({ razorpay_payment_id: 'pay_fixture', razorpay_subscription_id: 'sub_fixture', razorpay_signature: 'signature-fixture' });
  assert.deepEqual(payload, { subscription_id: 'sub_fixture', payment_id: 'pay_fixture', signature: 'signature-fixture', organization_id: 'org', attempt_id: 'attempt-fixture' });
  assert.equal(success.length, 0);
  assert.match(messages.at(-1), /pending/);
});
test('real checkout blocks a capacity violation before provider loading or checkout', async () => {
  let providerCalls = 0;
  const messages = [];
  const f = closureFunction('src/routes/_authenticated/dashboard.billing.tsx', 'confirmUpgrade', {
    paidMandate: false, recurringBlocked: false, processing: false, workspace: { current: { id: 'org' } }, org: { id: 'org' }, pendingPlan: { id: 'starter' }, canManageBilling: true, entitlement: fixture,
    setProcessing: () => {}, setCheckoutMessage: () => {}, z: require('zod').z,
    downgradeFn: async () => ({ allowed: false, violations: [{ limit: 'staff', used: 4, maximum: 1 }] }),
    startFn: async () => { providerCalls++; }, loadRazorpayScript: async () => { providerCalls++; },
    toast: { error: message => messages.push(message) },
  });
  await f(); assert.equal(providerCalls, 0); assert.match(messages[0], /4 used.*supports 1/);
});
test('real onboarding keeps the provisioned workspace after configuration failure without fabricating completion', async () => {
  let provisions = 0;
  const destinations = [], errors = [], removed = [];
  const f = closureFunction('src/routes/_authenticated/onboarding.tsx', 'finish', {
    user: { id: 'owner', email: 'owner@example.test' }, businessType: 'doctor', doctorName: 'Doctor', orgName: 'Clinic', orgSlug: 'clinic', specialization: 'GP', experienceYears: '5', consultationFee: '500',
    setSaving: () => {}, resolveAvailableOrgSlug: async () => ({ slug: 'clinic' }),
    provisionClinicTrial: async ({ data }) => { provisions++; assert.deepEqual(Object.keys(data).sort(), ['businessType','doctorName','name','slug']); return { organization_id: 'org', clinic_id: 'clinic' }; },
    supabase: { from: () => ({ update: () => ({ eq: () => ({ eq: async () => ({ error: { message: 'denied' } }) }) }) }) },
    toast: { error: m => errors.push(m), success: () => assert.fail('partial setup must not claim completed launch') },
    navigate: ({ to }) => destinations.push(to), localStorage: { removeItem: key => removed.push(key) },
  });
  await f(); assert.equal(provisions, 1); assert.deepEqual(destinations, ['/dashboard/settings']); assert.equal(removed.length, 0); assert.match(errors[0], /trial started.*could not be saved/i);
});
test('comparison component renders four configured yearly totals and unlimited limits', () => {
  const { PlanCompareTable } = load('src/components/billing/PlanCompareTable.tsx', { ...uiDoubles, './clinicx-ux': load('src/components/billing/clinicx-ux.ts') });
  const plans = ['starter','growth','professional','enterprise'].map((id, i) => ({ id, name: id, monthly_price: [999,2999,8599,19999][i], yearly_price: [9990,29990,85990,199990][i], is_popular: id === 'growth' }));
  const html = renderToStaticMarkup(React.createElement(PlanCompareTable, { plans, modules: [], planLimits: Object.fromEntries(plans.map(p => [p.id, { patients: null, staff: null, doctors: null }])), billingCycle: 'yearly' }));
  assert.ok(html.includes('₹9,990')); assert.ok(html.includes('/year')); assert.ok(html.includes('Unlimited')); assert.ok(html.includes('Popular'));
  assert.equal((html.match(/<th\s/g) ?? []).length, 5);
  if (process.env.CLINICX_ISOLATED_ARTIFACT_DIR) {
    const { ClinicTrialJourney } = load('src/components/billing/ClinicTrialJourney.tsx', { ...uiDoubles, './clinicx-ux': load('src/components/billing/clinicx-ux.ts') });
    const journey = renderToStaticMarkup(React.createElement(ClinicTrialJourney, { snapshot: fixture, engagement, checklist: true }));
    fs.mkdirSync(process.env.CLINICX_ISOLATED_ARTIFACT_DIR, { recursive: true });
    fs.writeFileSync(path.join(process.env.CLINICX_ISOLATED_ARTIFACT_DIR, 'index.html'), `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Isolated ClinicX component fixtures — synthetic data</title></head><body><h1>Isolated component fixtures — synthetic data</h1>${journey}${html}</body></html>`);
  }
});
test('onboarding reads profile and authority back before declaring trial launch successful', () => {
  const s = source('src/routes/_authenticated/onboarding.tsx');
  assert.match(s, /await getClinicSubscription/);
  assert.match(s, /Profile configuration readback failed/);
});
test('free onboarding app preferences do not impose selected paid-tier restrictions', () => {
  const s = source('src/routes/_authenticated/onboarding.tsx');
  assert.doesNotMatch(s, /currentPlan\??\.module_ids|2 mo free|Math.round\(p.yearly_price/);
});
test('dashboard reads never auto-provision or redirect expired organizations into onboarding', () => {
  const s = source('src/routes/_authenticated/dashboard.tsx');
  assert.doesNotMatch(s, /Medical Clinic Workspace|Auto-provision default clinic|My Medical Clinic|14-day free trial/);
  assert.match(s, /clinic === null && org === null && !authorityError/);
});
test('onboarding refuses launch while membership or invite discovery is unverified', () => {
  const s = source('src/routes/_authenticated/onboarding.tsx');
  assert.match(s, /if \(membershipError\)/); assert.match(s, /if \(inviteError\)/); assert.match(s, /Retry workspace check/);
});
test('onboarding launches an atomic free trial, not a provider mandate or browser-owned subscription', () => {
  const s = source('src/routes/_authenticated/onboarding.tsx');
  assert.match(s, /await provisionClinicTrial/);
  assert.doesNotMatch(s, /Razorpay|startOnboardingTrialSubscription|\.from\("organizations"\)\s*\.insert|completed: true|14.day|₹1/);
  assert.match(s, /organization_invites/);
  assert.match(s, /onboarding_draft_/);
});
