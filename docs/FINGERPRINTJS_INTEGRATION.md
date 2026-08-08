# FingerprintJS Frontend Integration Guide

## 📌 Overview

The SaaS application integrates `@fingerprintjs/fingerprintjs` for browser and hardware device intelligence. Fingerprint collection executes **only** on authentication entry points (Login, Signup) and sensitive transactional actions (Password Change, Payment, Data Export, Admin Operations).

---

## ⚡ Key Architectural Rules

1. **Async & Silent Failure**: Fingerprint loading runs asynchronously. Network blocks, adblockers, or extension failures fall back silently to synthetic device hashes without interrupting page rendering or authentication.
2. **SHA-256 Hash Stability (`device_hash`)**: Computes `SHA256(visitorId + browser + os + screenResolution)` to maintain device identity stability across browser minor version updates.
3. **Local Storage Caching**: Fingerprints are cached in `localStorage` under `fingerprint_cache_v1` with a 24-hour TTL to prevent unnecessary API generation calls.

---

## 🛠️ Service Usage Example

```typescript
import { fingerprintService } from './services/fingerprint/fingerprint.service';

async function handleLogin(credentials: LoginCredentials) {
  // 1. Collect device fingerprint (cached or freshly generated)
  const fingerprint = await fingerprintService.getFingerprint();

  // 2. Submit to backend verify-login API
  const response = await fetch('/api/devices/verify-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...credentials,
      visitorId: fingerprint.visitorId,
      deviceHash: fingerprint.deviceHash,
      browser: fingerprint.browser,
      os: fingerprint.os,
      deviceType: fingerprint.deviceType,
      screenResolution: fingerprint.screenResolution,
      timezone: fingerprint.timezone,
    }),
  });

  const result = await response.json();
  if (!result.allowed) {
    alert('Login blocked: ' + result.message);
  }
}
```
