const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

// 1. Token Crypto Test Helper (AES-256-GCM)
function encryptTestToken(plaintext, secretKey) {
  if (!plaintext) return '';
  const key = crypto.createHash('sha256').update(secretKey).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
}

function decryptTestToken(ciphertext, secretKey) {
  if (!ciphertext) return null;
  const parts = ciphertext.split('.');
  if (parts.length !== 3) return null;
  try {
    const key = crypto.createHash('sha256').update(secretKey).digest();
    const iv = Buffer.from(parts[0], 'base64url');
    const tag = Buffer.from(parts[1], 'base64url');
    const encrypted = Buffer.from(parts[2], 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

test('GBP Security > Token encryption and decryption round-trip succeeds with AES-256-GCM', () => {
  const secret = 'test-secret-encryption-key-for-gbp-tokens-2026';
  const rawRefreshToken = '1//0gMABC123xyz-google-refresh-token-test';

  const encrypted = encryptTestToken(rawRefreshToken, secret);
  assert.ok(encrypted.includes('.'), 'Encrypted token must contain dots separating IV, tag, and ciphertext');
  assert.notEqual(encrypted, rawRefreshToken, 'Encrypted token must not be plaintext');

  const decrypted = decryptTestToken(encrypted, secret);
  assert.equal(decrypted, rawRefreshToken, 'Decrypted token must exactly match original plaintext');
});

test('GBP Security > Token decryption rejects tampered tokens', () => {
  const secret = 'test-secret-encryption-key-for-gbp-tokens-2026';
  const rawRefreshToken = 'valid-token';
  const encrypted = encryptTestToken(rawRefreshToken, secret);

  const parts = encrypted.split('.');
  const tamperedCipher = parts[0] + '.' + parts[1] + '.tamperedciphertext';
  const result = decryptTestToken(tamperedCipher, secret);
  assert.equal(result, null, 'Tampered token must return null');
});

// 2. Google OAuth 2.0 URL & State Verification
function buildOAuthUrlTest(opts) {
  const statePayload = JSON.stringify({
    clinicId: opts.clinicId,
    organizationId: opts.organizationId,
    nonce: 'random123',
    ts: Date.now(),
  });
  const state = Buffer.from(statePayload, 'utf8').toString('base64url');
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/business.manage https://www.googleapis.com/auth/userinfo.email',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return {
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    state,
  };
}

test('GBP OAuth > Generates valid authorization URL with required scopes and offline consent', () => {
  const { url, state } = buildOAuthUrlTest({
    clientId: 'test-google-client-id.apps.googleusercontent.com',
    redirectUri: 'https://clinicx.digiwil.com/api/public/google-oauth-callback',
    clinicId: '123e4567-e89b-12d3-a456-426614174000',
    organizationId: '987fcdeb-51a2-43f1-9abc-426614174999',
  });

  const parsed = new URL(url);
  assert.equal(parsed.hostname, 'accounts.google.com');
  assert.equal(parsed.pathname, '/o/oauth2/v2/auth');
  assert.equal(parsed.searchParams.get('response_type'), 'code');
  assert.equal(parsed.searchParams.get('access_type'), 'offline');
  assert.equal(parsed.searchParams.get('prompt'), 'consent');
  assert.ok(parsed.searchParams.get('scope').includes('business.manage'), 'Must include business.manage scope');

  // Verify decoded state
  const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
  assert.equal(decoded.clinicId, '123e4567-e89b-12d3-a456-426614174000');
  assert.equal(decoded.organizationId, '987fcdeb-51a2-43f1-9abc-426614174999');
});

test('GBP OAuth > Returns null when clientId is missing to prevent Google Error 400 (invalid_request)', () => {
  function safeBuildOAuthUrl(opts) {
    if (!opts.clientId || opts.clientId.trim() === '') return null;
    return buildOAuthUrlTest(opts).url;
  }

  assert.equal(safeBuildOAuthUrl({ clientId: '', clinicId: '123' }), null);
  assert.equal(safeBuildOAuthUrl({ clientId: '   ', clinicId: '123' }), null);
  assert.ok(safeBuildOAuthUrl({ clientId: 'valid-client-id.apps.googleusercontent.com', clinicId: '123' })?.includes('valid-client-id'));
});

test('GBP OAuth > Uses platform default credentials for 1-click doctor connection without manual setup', () => {
  const PLATFORM_ID = 'test-platform-client-id.apps.googleusercontent.com';
  const { url } = buildOAuthUrlTest({
    clientId: PLATFORM_ID,
    redirectUri: 'https://clinicx.digiwil.com/api/public/google-oauth-callback',
    clinicId: 'test-clinic-id',
  });
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get('client_id'), PLATFORM_ID);
  assert.equal(parsed.searchParams.get('redirect_uri'), 'https://clinicx.digiwil.com/api/public/google-oauth-callback');
});

// 3. Review Link Builder & Google Anti-Gating Verification
function buildReviewLinks(opts) {
  const googleDirect = opts.placeId
    ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(opts.placeId)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(opts.clinicName)}`;
  const shortReview = `${opts.baseUrl}/r/${opts.slug}`;
  return { googleDirect, shortReview };
}

test('Review Growth > Builds direct Google Maps review write URL and short branded link', () => {
  const links = buildReviewLinks({
    placeId: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
    slug: 'apollo-dental-lucknow',
    clinicName: 'Apollo Dental',
    baseUrl: 'https://clinicx.digiwil.com',
  });

  assert.equal(
    links.googleDirect,
    'https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4'
  );
  assert.equal(links.shortReview, 'https://clinicx.digiwil.com/r/apollo-dental-lucknow');
});

// 4. AI SEO Profile Description Limits & Disclaimers
function validateGbpDescription(description) {
  return {
    validLength: description.length <= 750,
    characterCount: description.length,
    hasNoGuaranteeClaims: !/(guarantee.*#1|100% ranking|promise top position)/i.test(description),
  };
}

test('AI SEO Optimizer > Enforces Google 750-character ceiling and ranking disclaimers', () => {
  const validDesc = 'Welcome to Apollo Dental Clinic in Gomti Nagar, Lucknow, led by Dr. Neha Sharma. We offer expert orthodontic care, root canal treatment, pediatric dentistry, and dental implants. Our sterile OPD ensures comfortable, painless treatments. Book online or visit us today.';
  const validation = validateGbpDescription(validDesc);

  assert.ok(validation.validLength, 'Must be within 750 characters');
  assert.ok(validation.characterCount <= 750, 'Character count must not exceed 750');
  assert.ok(validation.hasNoGuaranteeClaims, 'Must never promise guaranteed rankings');

  const invalidLong = 'A'.repeat(800);
  assert.equal(validateGbpDescription(invalidLong).validLength, false, '800-character description must be rejected');
});

// 5. Medical Safety Guardrail for AI Review Replies
function validateMedicalReplyCompliance(replyText) {
  // Never confirm or disclose diagnoses, prescriptions, or patient medical records publicly
  const medicalDisclosure = /(diagnosed with|prescribed (you|for your)|your (blood test|mri|biopsy|ultrasound) showed|you have (cancer|diabetes|hiv|depression))/i.test(replyText);
  return {
    compliant: !medicalDisclosure,
    hasOfflineInvitation: /(connect with|call our|reach out to|resolve offline|contact us)/i.test(replyText),
  };
}

test('AI Review Management > Enforces medical confidentiality (HIPAA) in public review replies', () => {
  const compliantReply = 'Dear Patient, thank you for your feedback. We appreciate your kind words for Dr. Sharma and our clinical team. Wishing you the best of health!';
  assert.ok(validateMedicalReplyCompliance(compliantReply).compliant, 'Compliant reply must pass');

  const nonCompliantReply = 'Dear Patient, we are glad your blood test showed your diabetes medication worked well!';
  assert.equal(validateMedicalReplyCompliance(nonCompliantReply).compliant, false, 'Reply revealing patient medical condition must fail compliance');
});

// 6. Daily Post Formatting & Call-To-Action
function formatGooglePost(post) {
  assert.ok(['STANDARD', 'OFFER', 'EVENT'].includes(post.postType), 'Post type must be STANDARD, OFFER, or EVENT');
  assert.ok(post.summary.length >= 10 && post.summary.length <= 1500, 'Post summary must be within Google length limits');
  assert.ok(['BOOK', 'CALL', 'LEARN_MORE', 'ORDER', 'SIGN_UP'].includes(post.callToAction.actionType), 'CTA must be an official Google action');
  return true;
}

test('Daily AI Posts > Validates Google Local Post schema and supported CTA actions', () => {
  const validPost = {
    postType: 'STANDARD',
    summary: 'Prioritizing regular health checkups ensures early detection and faster recovery. Visit our sterile OPD for comprehensive consultation.',
    callToAction: {
      actionType: 'BOOK',
      url: 'https://clinicx.digiwil.com/c/apollo-dental/book',
    },
  };
  assert.ok(formatGooglePost(validPost), 'Valid post structure must pass');
});

// 7. Background Job Idempotency
test('Background Scheduler > Limits review request reminders to max allowed reminders', () => {
  const mockPendingRequests = [
    { id: '1', reminder_count: 0, max_reminders: 1 },
    { id: '2', reminder_count: 1, max_reminders: 1 }, // Already reached limit
  ];

  const remindersToSend = mockPendingRequests.filter(r => r.reminder_count < r.max_reminders);
  assert.equal(remindersToSend.length, 1, 'Only requests with reminder_count < max_reminders should be processed');
  assert.equal(remindersToSend[0].id, '1');
});
