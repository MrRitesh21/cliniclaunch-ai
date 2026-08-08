# Security Model & 4-Tier Risk Engine

## 🧮 Composite Risk Scoring Formula

```text
Risk Score = Device Risk + Location/IP Risk + Behavior/Travel Risk + Account Risk
```

Score is clamped strictly between **`0` and `100`**.

---

## 📊 Risk Factor Weights

| Risk Tier | Factor | Weight | Description |
| :--- | :--- | :--- | :--- |
| **Device Risk** | Blocked Device | `+100` | Device previously flagged as malicious |
| | New Device | `+20` | First time seeing physical fingerprint for user |
| | Trusted Device | `-30` | Explicitly trusted by user/admin |
| **Location / IP** | New Country | `+30` | Login originating from a new country |
| | VPN Detected | `+20` | IP identified as commercial VPN |
| | Tor Exit Node | `+50` | IP identified as Tor relay |
| | Datacenter IP | `+30` | Non-residential ISP IP |
| **Behavior & Travel** | Impossible Travel | `+50` | Logins across distant countries < 15 min |
| | Failed Logins | `+30` | >5 failed auth attempts prior to login |
| **Account Risk** | Multiple Accounts | `+40` | Fingerprint associated with >1 user |

---

## 🏷️ Risk Classifications

- **LOW (`0-30`)**: Normal login flow, low friction.
- **MEDIUM (`31-70`)**: Elevated risk. Triggers step-up 2FA prompt or email alert.
- **HIGH (`71-100`)**: Suspicious or malicious login attempt. Triggers automatic block or session quarantine.
