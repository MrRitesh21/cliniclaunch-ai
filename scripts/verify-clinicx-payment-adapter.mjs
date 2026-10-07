// Offline tests exercise actual TypeScript in native Node ESM. Never load .env.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import * as adapter from '../src/lib/razorpay.server.ts';
const denyNetwork = async () => { throw new Error('NETWORK DENIED: no fixture installed'); };
globalThis.fetch = denyNetwork;
process.env.RAZORPAY_KEY_ID = 'rzp_test_fixture';
process.env.RAZORPAY_KEY_SECRET = 'fixture-key-secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'fixture-webhook-secret';
afterEach(() => {
  globalThis.fetch = denyNetwork;
  process.env.RAZORPAY_KEY_SECRET = 'fixture-key-secret';
  process.env.RAZORPAY_WEBHOOK_SECRET = 'fixture-webhook-secret';
});
const canonical = {
  expected: { paymentId: 'pay_one', subscriptionId: 'sub_one', providerPlanId: 'plan_one', amountPaise: 99900, planAmountPaise: 99900, interval: 'monthly', purpose: 'subscription_charge' },
  payment: { id: 'pay_one', status: 'captured', captured: true, currency: 'INR', amount: 99900, subscription_id: 'sub_one', amount_refunded: 0 },
  subscription: { id: 'sub_one', plan_id: 'plan_one', status: 'active' },
  plan: { id: 'plan_one', period: 'monthly', interval: 1, item: { amount: 99900, currency: 'INR' } },
};
test('captured policy binds canonical amount, currency, subscription and provider plan; never mandate/setup', async () => {
  const policy = await import('../src/lib/payment-verification.ts').catch((e) => { if (e.code === 'ERR_MODULE_NOT_FOUND') return {}; throw e; });
  assert.equal(typeof policy.verifyCapturedSubscriptionPayment, 'function');
  const verify = policy.verifyCapturedSubscriptionPayment;
  assert.deepEqual(verify(canonical), { ok: true });
  for (const [section, field, value] of [
    ['payment', 'status', 'authorized'], ['payment', 'captured', false], ['payment', 'amount', 999], ['payment', 'currency', 'USD'],
    ['payment', 'id', 'pay_other'], ['payment', 'subscription_id', 'sub_other'], ['payment', 'amount_refunded', 1],
    ['subscription', 'id', 'sub_other'], ['subscription', 'plan_id', 'plan_other'],
    ['plan', 'id', 'plan_other'], ['plan', 'period', 'yearly'], ['plan', 'interval', 2],
    ['expected', 'amountPaise', NaN], ['expected', 'amountPaise', 1.5], ['expected', 'amountPaise', 0],
    ['expected', 'purpose', 'setup'], ['expected', 'paymentId', '../pay_one'], ['expected', 'interval', 'weekly'],
  ]) {
    const input = structuredClone(canonical); input[section][field] = value;
    assert.equal(verify(input).ok, false, `${section}.${field}=${value}`);
  }
  for (const item of [{ amount: 999, currency: 'INR' }, { amount: 99900, currency: 'USD' }]) {
    assert.equal(verify({ ...canonical, plan: { ...canonical.plan, item } }).ok, false);
  }
  assert.equal(verify({ ...canonical, payment: { ...canonical.payment, subscription_id: undefined } }).ok, false);
  assert.equal(verify({}).ok, false);
  assert.equal(verify(null).ok, false);
});
test('payment without direct subscription linkage requires provider invoice readback, never notes', async () => {
  const { verifyCapturedSubscriptionPayment: verify } = await import('../src/lib/payment-verification.ts');
  const input = structuredClone(canonical);
  delete input.payment.subscription_id;
  input.payment.invoice_id = 'inv_one';
  input.invoice = { id: 'inv_one', payment_id: 'pay_one', subscription_id: 'sub_one' };
  assert.deepEqual(verify(input), { ok: true });
  for (const [field, value] of [['id', 'inv_other'], ['payment_id', 'pay_other'], ['subscription_id', 'sub_other']]) {
    assert.equal(verify({ ...input, invoice: { ...input.invoice, [field]: value } }).ok, false);
  }
  assert.equal(verify({ ...input, invoice: undefined, payment: { ...input.payment, notes: { subscription_id: 'sub_one' } } }).ok, false);
  assert.equal(verify({ ...input, payment: { ...input.payment, subscription_id: 'sub_other' } }).ok, false);
});
const jsonResponse = (value, status = 200) => new Response(JSON.stringify(value), { status });
test('provider failures never return raw provider bodies, parse errors or network secrets', async () => {
  const sensitive = 'fixture-PII-and-secret';
  for (const fixture of [() => jsonResponse({ error: sensitive }, 400), () => new Response(sensitive), () => { throw new Error(sensitive); }]) {
    globalThis.fetch = async () => fixture();
    await assert.rejects(adapter.getPayment('pay_one'), (err) => {
      assert.match(err.message, /^Razorpay/);
      assert.equal(err.message.includes(sensitive), false);
      assert.equal(err.cause, undefined);
      return true;
    });
  }
});
test('GET transient failures retry once; permanent failures and money-changing POST never retry', async () => {
  for (const status of [429, 503]) {
    let calls = 0;
    globalThis.fetch = async () => ++calls === 1 ? jsonResponse({}, status) : jsonResponse({ id: 'pay_one' });
    assert.equal((await adapter.getPayment('pay_one')).id, 'pay_one');
    assert.equal(calls, 2);
  }
  let calls = 0;
  globalThis.fetch = async () => { calls++; return jsonResponse({}, 400); };
  await assert.rejects(adapter.getPayment('pay_one'));
  assert.equal(calls, 1);
  calls = 0;
  globalThis.fetch = async () => { calls++; return jsonResponse({}, 503); };
  await assert.rejects(adapter.cancelSubscription('sub_one'));
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(adapter.createSubscription('plan_one', {}));
  assert.equal(calls, 1);
  calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('fixture-network'); };
  await assert.rejects(adapter.getPayment('pay_one'), /Razorpay transport/);
  assert.equal(calls, 2);
});
test('provider deadline bounds hanging fetch and hanging response body, with abort', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const phase of ['fetch', 'body']) {
    let signal;
    globalThis.fetch = async (_url, init) => {
      signal = init.signal;
      if (phase === 'fetch') return new Promise(() => {});
      return { ok: true, text: () => new Promise(() => {}) };
    };
    const request = adapter.cancelSubscription('sub_one');
    await Promise.resolve(); await Promise.resolve();
    assert.ok(signal instanceof AbortSignal, 'transport must have a finite abort deadline');
    const rejection = assert.rejects(request, /Razorpay transport failure/);
    t.mock.timers.tick(8000);
    await rejection;
    assert.equal(signal.aborted, true);
  }
});
const planParams = { name: 'Starter', amount_paise: 99900, interval: 'monthly' };
const providerPlan = (id = 'plan_one') => ({ ...structuredClone(canonical.plan), id, notes: { digiclini_key: 'starter_monthly' } });
test('marker reuse validates provider item amount/currency/period/interval, refusing mismatches without POST', async () => {
  globalThis.fetch = async () => jsonResponse({ items: [providerPlan()] });
  assert.equal(await adapter.createOrGetPlan('starter_monthly', planParams), 'plan_one');
  for (const change of [{ item: { amount: 49900, currency: 'INR' } }, { item: { amount: 99900, currency: 'USD' } }, { period: 'yearly' }, { interval: 2 }, { id: '../plan_x' }]) {
    let writes = 0;
    globalThis.fetch = async (_url, init) => { if (init.method === 'POST') writes++; return jsonResponse({ items: [{ ...providerPlan(), ...change }] }); };
    await assert.rejects(adapter.createOrGetPlan('starter_monthly', planParams), /Razorpay plan mismatch/);
    assert.equal(writes, 0);
  }
});
for (const [label, items] of [['empty page', []], ['short page with matching marker', [providerPlan()]]]) {
  test(`contradictory collection count rejects ${label} before creation or marker reuse`, async () => {
    const calls = [];
    globalThis.fetch = async (url, init) => {
      calls.push([url, init.method || 'GET']);
      if (init.method === 'POST') return jsonResponse({ id: 'plan_created' });
      return jsonResponse(url.includes('?') ? { entity: 'collection', count: 100, items } : providerPlan('plan_created'));
    };
    const outcome = await adapter.createOrGetPlan('starter_monthly', planParams).then(
      (id) => ({ id }), (error) => ({ error }),
    );
    assert.equal(calls.filter(([, method]) => method === 'POST').length, 0, 'invalid inventory must never POST');
    assert.equal(outcome.id, undefined, 'invalid inventory must never return a mapping');
    assert.match(outcome.error?.message || 'no rejection', /^Razorpay invalid plan collection$/);
    assert.deepEqual(calls, [['https://api.razorpay.com/v1/plans?count=100&skip=0', 'GET']]);
  });
}
test('supplied collection count must be a nonnegative safe integer matching returned items', async () => {
  for (const count of [-1, 0.5, '0', null, false, Number.MAX_SAFE_INTEGER + 1, 0]) {
    let writes = 0;
    globalThis.fetch = async (_url, init) => {
      if (init.method === 'POST') writes++;
      return jsonResponse({ entity: 'collection', count, items: [providerPlan()] });
    };
    const outcome = await adapter.createOrGetPlan('starter_monthly', planParams).then(
      (id) => ({ id }), (error) => ({ error }),
    );
    assert.equal(writes, 0);
    assert.equal(outcome.id, undefined, `count ${JSON.stringify(count)} must reject, not reuse`);
    assert.match(outcome.error?.message || 'no rejection', /^Razorpay invalid plan collection$/);
  }
});
test('supplied collection entity must be exactly collection before creation or marker reuse', async () => {
  for (const entity of ['plan', 'Collection', '', null, 1, {}]) {
    for (const items of [[], [providerPlan()]]) {
      const calls = [];
      globalThis.fetch = async (url, init) => {
        calls.push([url, init.method || 'GET']);
        if (init.method === 'POST') return jsonResponse({ id: 'plan_created' });
        return jsonResponse(url.includes('?') ? { entity, count: items.length, items } : providerPlan('plan_created'));
      };
      const outcome = await adapter.createOrGetPlan('starter_monthly', planParams).then(
        (id) => ({ id }), (error) => ({ error }),
      );
      assert.equal(calls.filter(([, method]) => method === 'POST').length, 0);
      assert.equal(outcome.id, undefined, 'wrong collection entity must not reuse a marker');
      assert.match(outcome.error?.message || 'no rejection', /^Razorpay invalid plan collection$/);
      assert.equal(calls.length, 1);
    }
  }
});
test('absent or consistent collection metadata preserves marker reuse and creation readback', async () => {
  for (const metadata of [() => ({}), (items) => ({ count: items.length }), () => ({ entity: 'collection' }), (items) => ({ entity: 'collection', count: items.length })]) {
    for (const items of [[], [providerPlan()]]) {
      const calls = [];
      globalThis.fetch = async (url, init) => {
        calls.push([url, init.method || 'GET']);
        if (init.method === 'POST') return jsonResponse({ id: 'plan_created' });
        return jsonResponse(url.includes('?') ? { ...metadata(items), items } : providerPlan('plan_created'));
      };
      assert.equal(await adapter.createOrGetPlan('starter_monthly', planParams), items.length ? 'plan_one' : 'plan_created');
      assert.deepEqual(calls, items.length ? [['https://api.razorpay.com/v1/plans?count=100&skip=0', 'GET']] : [
        ['https://api.razorpay.com/v1/plans?count=100&skip=0', 'GET'],
        ['https://api.razorpay.com/v1/plans', 'POST'],
        ['https://api.razorpay.com/v1/plans/plan_created', 'GET'],
      ]);
    }
  }
});
test('consistent per-page collection count preserves pagination through short and empty final pages', async () => {
  for (const last of [[], [providerPlan()]]) {
    const first = Array.from({ length: 100 }, (_, n) => ({ ...providerPlan(`plan_page${n}`), notes: {} }));
    if (!last.length) first[0] = providerPlan();
    const calls = [];
    globalThis.fetch = async (url, init) => {
      calls.push([url, init.method || 'GET']);
      const items = calls.length === 1 ? first : last;
      return jsonResponse({ entity: 'collection', count: items.length, items });
    };
    assert.equal(await adapter.createOrGetPlan('starter_monthly', planParams), 'plan_one');
    assert.deepEqual(calls, [
      ['https://api.razorpay.com/v1/plans?count=100&skip=0', 'GET'],
      ['https://api.razorpay.com/v1/plans?count=100&skip=100', 'GET'],
    ]);
  }
});
test('plan discovery paginates, refuses ambiguous or incomplete scans, and never creates duplicates', async () => {
  const first = Array.from({ length: 100 }, (_, n) => ({ ...providerPlan(`plan_page${n}`), notes: {} }));
  const urls = [];
  globalThis.fetch = async (url, init) => { urls.push(url); assert.notEqual(init.method, 'POST'); return jsonResponse({ items: urls.length === 1 ? first : [providerPlan()] }); };
  assert.equal(await adapter.createOrGetPlan('starter_monthly', planParams), 'plan_one');
  assert.deepEqual(urls.map((url) => new URL(url).searchParams.get('skip')), ['0', '100']);
  for (const items of [null, [providerPlan(), providerPlan('plan_two')], [providerPlan(), { ...providerPlan('plan_two'), item: { amount: 49900, currency: 'INR' } }]]) {
    globalThis.fetch = async (_url, init) => { assert.notEqual(init.method, 'POST'); return jsonResponse({ items }); };
    await assert.rejects(adapter.createOrGetPlan('starter_monthly', planParams), /Razorpay (invalid plan collection|ambiguous plans|plan mismatch)/);
  }
  globalThis.fetch = async (_url, init) => { assert.notEqual(init.method, 'POST'); return jsonResponse({ items: first }); };
  await assert.rejects(adapter.createOrGetPlan('starter_monthly', planParams), /Razorpay incomplete plan scan/);
});
test('explicit existing plan ID is preserved by exact readback, even without marker; mismatch/404 never creates', async () => {
  const yearly = { name: 'Existing annual', amount_paise: 999000, interval: 'yearly' };
  const remote = { ...providerPlan('plan_legacyAnnual'), period: 'yearly', item: { amount: 999000, currency: 'INR' }, notes: {} };
  const urls = [];
  globalThis.fetch = async (url, init) => { urls.push(url); assert.notEqual(init.method, 'POST'); return jsonResponse(remote); };
  assert.equal(await adapter.createOrGetPlan('starter_yearly', yearly, { existingPlanId: 'plan_legacyAnnual', allowCreate: false }), 'plan_legacyAnnual');
  assert.deepEqual(urls, ['https://api.razorpay.com/v1/plans/plan_legacyAnnual']);
  for (const response of [jsonResponse({ ...remote, item: { amount: 499000, currency: 'INR' } }), jsonResponse({ ...remote, id: 'plan_other' }), jsonResponse({}, 404)]) {
    let calls = 0;
    globalThis.fetch = async (url, init) => { calls++; assert.equal(url.endsWith('/plans/plan_legacyAnnual'), true); assert.notEqual(init.method, 'POST'); return response; };
    await assert.rejects(adapter.createOrGetPlan('starter_yearly', yearly, { existingPlanId: 'plan_legacyAnnual' }));
    assert.equal(calls, 1);
  }
  let writes = 0;
  globalThis.fetch = async (_url, init) => { if (init.method === 'POST') writes++; return jsonResponse({ items: [] }); };
  await assert.rejects(adapter.createOrGetPlan('starter_monthly', planParams, { allowCreate: false }), /Razorpay plan creation disabled/);
  assert.equal(writes, 0);
});
test('invalid IDs, unsafe paise, cycle and payment list count fail before any transport', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return jsonResponse({ items: [] }); };
  for (const call of [
    () => adapter.getPayment('../pay_x'), () => adapter.getSubscription('sub_x?leak=y'),
    () => adapter.cancelSubscription('sub_x/cancel'), () => adapter.createSubscription('plan_x/../../payments', {}),
    () => adapter.getPayments(101), () => adapter.getPayments(0), () => adapter.getPayments(1.5),
    () => adapter.createOrGetPlan('starter_monthly', { ...planParams, amount_paise: NaN }),
    () => adapter.createOrGetPlan('starter_monthly', { ...planParams, amount_paise: -1 }),
    () => adapter.createOrGetPlan('starter_monthly', { ...planParams, amount_paise: 1.1 }),
    () => adapter.createOrGetPlan('starter_monthly', { ...planParams, amount_paise: Number.MAX_SAFE_INTEGER + 1 }),
    () => adapter.createOrGetPlan('starter_monthly', { ...planParams, interval: 'weekly' }),
    () => adapter.createOrGetPlan('', planParams),
    () => adapter.createOrGetPlan('starter_monthly', { ...planParams, name: '' }),
    () => adapter.createOrGetPlan('starter_monthly', planParams, { existingPlanId: ' plan_one' }),
  ]) await assert.rejects(call, /Razorpay invalid/);
  assert.equal(calls, 0);
  process.env.RAZORPAY_KEY_SECRET = ' ';
  await assert.rejects(adapter.getPayment('pay_one'), /keys not configured/);
  assert.equal(calls, 0);
});
test('canonical entity reads expose invoice linkage and enforce exact requested provider IDs', async () => {
  assert.equal(typeof adapter.getPlan, 'function');
  assert.equal(typeof adapter.getInvoice, 'function');
  const cases = [
    ['getPayment', 'pay_one', { ...canonical.payment, invoice_id: 'inv_one' }, '/payments/pay_one'],
    ['getSubscription', 'sub_one', canonical.subscription, '/subscriptions/sub_one'],
    ['getPlan', 'plan_one', canonical.plan, '/plans/plan_one'],
    ['getInvoice', 'inv_one', { id: 'inv_one', payment_id: 'pay_one', subscription_id: 'sub_one' }, '/invoices/inv_one'],
  ];
  for (const [method, id, value, path] of cases) {
    globalThis.fetch = async (url) => { assert.equal(url, `https://api.razorpay.com/v1${path}`); return jsonResponse(value); };
    assert.deepEqual(await adapter[method](id), value);
    globalThis.fetch = async () => jsonResponse({ ...value, id: 'other' });
    await assert.rejects(adapter[method](id), /Razorpay entity mismatch/);
    globalThis.fetch = async () => jsonResponse(null);
    await assert.rejects(adapter[method](id), /Razorpay entity mismatch/);
    let calls = 0;
    globalThis.fetch = async () => { calls++; return jsonResponse(value); };
    await assert.rejects(adapter[method](`../${id}`), /Razorpay invalid/);
    assert.equal(calls, 0);
  }
});
test('optional capture metadata and invoice evidence cannot contradict a direct subscription link', async () => {
  const { verifyCapturedSubscriptionPayment: verify } = await import('../src/lib/payment-verification.ts');
  for (const captured of ['true', 1, null]) {
    assert.equal(verify({ ...canonical, payment: { ...canonical.payment, captured } }).ok, false);
  }
  const input = { ...canonical, payment: { ...canonical.payment, invoice_id: 'inv_one' }, invoice: { id: 'inv_one', payment_id: 'pay_one', subscription_id: 'sub_other' } };
  assert.equal(verify(input).ok, false);
  input.invoice.subscription_id = 'sub_one';
  assert.deepEqual(verify(input), { ok: true });
  input.invoice.payment_id = 'pay_other';
  assert.equal(verify(input).ok, false);
});
test('new plan creation is one POST followed by canonical readback; ambiguous POST failure is never retried', async () => {
  for (const readback of [providerPlan('plan_created'), { ...providerPlan('plan_created'), item: { amount: 1, currency: 'INR' } }]) {
    const calls = [];
    globalThis.fetch = async (url, init) => {
      calls.push([url, init.method || 'GET']);
      if (init.method === 'POST') {
        assert.deepEqual(JSON.parse(init.body), { period: 'monthly', interval: 1, item: { name: 'Starter', amount: 99900, currency: 'INR' }, notes: { digiclini_key: 'starter_monthly' } });
        return jsonResponse({ id: 'plan_created' });
      }
      return jsonResponse(url.includes('?') ? { items: [] } : readback);
    };
    if (readback.item.amount === 99900) assert.equal(await adapter.createOrGetPlan('starter_monthly', planParams), 'plan_created');
    else await assert.rejects(adapter.createOrGetPlan('starter_monthly', planParams), /Razorpay plan mismatch/);
    assert.deepEqual(calls, [
      ['https://api.razorpay.com/v1/plans?count=100&skip=0', 'GET'],
      ['https://api.razorpay.com/v1/plans', 'POST'],
      ['https://api.razorpay.com/v1/plans/plan_created', 'GET'],
    ]);
  }
  for (const status of [200, 503]) {
    let writes = 0;
    globalThis.fetch = async (_url, init) => { if (init.method === 'POST') { writes++; return jsonResponse({ id: '../plan_bad' }, status); } return jsonResponse({ items: [] }); };
    await assert.rejects(adapter.createOrGetPlan('starter_monthly', planParams));
    assert.equal(writes, 1);
  }
});
test('an error-response body cancellation cannot hang a provider failure past its deadline', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 400, body: { cancel: () => new Promise(() => {}) } });
  let failure;
  const request = adapter.cancelSubscription('sub_one').catch((error) => { failure = error; });
  await new Promise(setImmediate);
  assert.match(failure?.message || 'still pending', /Razorpay request failed \(HTTP 400\)/);
  await request;
});
test('signature and provider ID formats reject trailing newline rather than silently normalizing', async () => {
  const raw = '{"event":"fixture"}';
  const signature = hmac(raw, process.env.RAZORPAY_WEBHOOK_SECRET);
  assert.equal(adapter.verifyWebhookSignature(raw, `${signature}\n`), false);
  const checkoutSig = hmac('pay_one\n|sub_one', process.env.RAZORPAY_KEY_SECRET);
  assert.equal(adapter.verifySubscriptionCheckoutSignature('pay_one\n', 'sub_one', checkoutSig), false);
  let calls = 0;
  globalThis.fetch = async () => { calls++; return jsonResponse({ id: 'pay_one\n' }); };
  await assert.rejects(adapter.getPayment('pay_one\n'), /Razorpay invalid/);
  assert.equal(calls, 0);
  const { verifyCapturedSubscriptionPayment: verify } = await import('../src/lib/payment-verification.ts');
  const input = structuredClone(canonical);
  input.expected.paymentId = 'pay_one\n'; input.payment.id = 'pay_one\n';
  assert.equal(verify(input).ok, false);
});
test('all four monthly prices and preferred x10 annual amounts reuse explicitly mapped IDs; discounted charge is separate', async () => {
  const { verifyCapturedSubscriptionPayment: verify } = await import('../src/lib/payment-verification.ts');
  let verified = 0;
  for (const [key, rupees] of [['starter', 999], ['growth', 2999], ['professional', 8599], ['enterprise', 19999]]) {
    for (const interval of ['monthly', 'yearly']) {
      const amount = rupees * 100 * (interval === 'yearly' ? 10 : 1);
      const id = `plan_${key}${interval}`;
      const plan = { ...providerPlan(id), period: interval, item: { amount, currency: 'INR' }, notes: {} };
      globalThis.fetch = async (url, init) => { assert.equal(url.endsWith(`/plans/${id}`), true); assert.notEqual(init.method, 'POST'); return jsonResponse(plan); };
      assert.equal(await adapter.createOrGetPlan(`${key}_${interval}`, { name: key, amount_paise: amount, interval }, { existingPlanId: id, allowCreate: false }), id);
      const input = structuredClone(canonical);
      input.expected.providerPlanId = id; input.expected.amountPaise = amount; input.expected.planAmountPaise = amount; input.expected.interval = interval;
      input.payment.amount = amount; input.subscription.plan_id = id; input.plan = plan;
      assert.deepEqual(verify(input), { ok: true }); verified++;
    }
  }
  assert.equal(verified, 8);
  const discounted = structuredClone(canonical);
  discounted.expected.amountPaise = 89900; discounted.payment.amount = 89900;
  assert.deepEqual(verify(discounted), { ok: true });
  discounted.expected.amountPaise = 99900;
  assert.equal(verify(discounted).ok, false);
});
test('bounded plan scan refuses creation after ten full distinct pages', async () => {
  let calls = 0;
  globalThis.fetch = async (_url, init) => {
    assert.notEqual(init.method, 'POST');
    const page = calls++;
    return jsonResponse({ items: Array.from({ length: 100 }, (_, n) => ({ ...providerPlan(`plan_p${page}n${n}`), notes: {} })) });
  };
  await assert.rejects(adapter.createOrGetPlan('starter_monthly', planParams), /Razorpay incomplete plan scan/);
  assert.equal(calls, 10);
});
test('default provider network is denied and missing API credentials do not invoke transport', async () => {
  assert.equal(globalThis.fetch, denyNetwork);
  await assert.rejects(adapter.getPayment('pay_one'), /Razorpay transport failure/);
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('unexpected transport'); };
  delete process.env.RAZORPAY_KEY_SECRET;
  await assert.rejects(adapter.getPayment('pay_one'), /keys not configured/);
  assert.equal(calls, 0);
});
test('read retry honors bounded Retry-After and refuses longer/invalid provider backoff rather than retrying early', async (t) => {
  for (const header of ['30', 'invalid']) {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return new Response('{}', { status: 429, headers: { 'Retry-After': header } }); };
    await assert.rejects(adapter.getPayment('pay_one'), /HTTP 429/);
    assert.equal(calls, 1);
  }
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  globalThis.fetch = async () => ++calls === 1 ? new Response('{}', { status: 429, headers: { 'Retry-After': '1' } }) : jsonResponse({ id: 'pay_one' });
  const request = adapter.getPayment('pay_one');
  await new Promise(setImmediate);
  t.mock.timers.tick(999);
  await new Promise(setImmediate);
  assert.equal(calls, 1);
  t.mock.timers.tick(1);
  assert.equal((await request).id, 'pay_one');
  assert.equal(calls, 2);
});
const hmac = (body, secret) => createHmac('sha256', secret).update(body).digest('hex');
test('checkout binds payment_id|server subscription_id, rejects reversed order and malformed inputs', () => {
  const payment = 'pay_ABC123', subscription = 'sub_XYZ789';
  const signature = hmac(`${payment}|${subscription}`, process.env.RAZORPAY_KEY_SECRET);
  assert.equal(typeof adapter.verifySubscriptionCheckoutSignature, 'function');
  assert.equal(adapter.verifySubscriptionCheckoutSignature(payment, subscription, signature), true);
  assert.equal(adapter.verifySubscriptionCheckoutSignature(payment, subscription, hmac(`${subscription}|${payment}`, process.env.RAZORPAY_KEY_SECRET)), false);
  for (const [p, s, sig] of [[payment, 'sub_other', signature], ['pay_bad|x', subscription, signature], [payment, '../sub_x', signature], [payment, subscription, 'x'.repeat(64)], [null, subscription, signature]]) {
    assert.equal(adapter.verifySubscriptionCheckoutSignature(p, s, sig), false);
  }
  delete process.env.RAZORPAY_KEY_SECRET;
  assert.equal(adapter.verifySubscriptionCheckoutSignature(payment, subscription, signature), false);
});
test('webhook verifies exact raw bytes in native ESM and fails closed', () => {
  const raw = '{ "event": "payment.captured" }\n';
  const signature = hmac(raw, process.env.RAZORPAY_WEBHOOK_SECRET);
  assert.equal(adapter.verifyWebhookSignature(raw, signature), true);
  assert.equal(adapter.verifyWebhookSignature(Buffer.from(raw), signature), true);
  assert.equal(adapter.verifyWebhookSignature(raw.trim(), signature), false);
  for (const invalid of ['', 'a'.repeat(63), 'g'.repeat(64), `${signature}x`, signature.toUpperCase(), null]) {
    assert.equal(adapter.verifyWebhookSignature(raw, invalid), false);
  }
  delete process.env.RAZORPAY_WEBHOOK_SECRET;
  assert.equal(adapter.verifyWebhookSignature(raw, signature), false);
});
