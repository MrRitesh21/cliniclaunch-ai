const test = require('node:test');
const assert = require('node:assert/strict');

function evaluateHasCachedSession(storageMap) {
  try {
    const keys = Object.keys(storageMap);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (
        key &&
        ((key.startsWith('sb-') && key.endsWith('-auth-token')) ||
          key === 'sb-cliniclaunch-auth-token' ||
          key === 'supabase.auth.token')
      ) {
        const raw = storageMap[key];
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.access_token) {
            return true;
          }
        }
      }
    }
  } catch {
    // Ignore
  }
  return false;
}

test('auth cache detection > detects standard Supabase project auth token', () => {
  const mockStorage = {
    'sb-wqhfxwewqfscuhgupcbi-auth-token': JSON.stringify({
      access_token: 'fake-jwt-token-123',
      refresh_token: 'fake-refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    }),
  };
  assert.equal(evaluateHasCachedSession(mockStorage), true);
});

test('auth cache detection > detects legacy sb-cliniclaunch-auth-token', () => {
  const mockStorage = {
    'sb-cliniclaunch-auth-token': JSON.stringify({
      access_token: 'legacy-token',
    }),
  };
  assert.equal(evaluateHasCachedSession(mockStorage), true);
});

test('auth cache detection > returns false when storage is empty', () => {
  assert.equal(evaluateHasCachedSession({}), false);
});

test('auth cache detection > returns false when token has no access_token', () => {
  const mockStorage = {
    'sb-project-auth-token': JSON.stringify({ user: null }),
  };
  assert.equal(evaluateHasCachedSession(mockStorage), false);
});

test('auth cache detection > safely handles malformed JSON without throwing', () => {
  const mockStorage = {
    'sb-project-auth-token': '{not-valid-json',
  };
  assert.equal(evaluateHasCachedSession(mockStorage), false);
});
