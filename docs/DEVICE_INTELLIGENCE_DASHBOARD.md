# Device Intelligence Admin Dashboard Guide

## 🖥️ Overview

The **Admin Device Intelligence Dashboard** (`src/components/admin/DeviceIntelligenceDashboard.tsx`) provides real-time visibility into hardware fingerprints, threat intelligence, and security events across all tenant organizations.

---

## 📊 Dashboard Components

1. **Realtime Banner**: Live indicator showing active background queue processing, active sessions, and high-risk events over the last hour.
2. **Overview Stat Cards**:
   - Total Registered Devices
   - Active Sessions
   - New Devices Today
   - Blocked Devices
   - High Risk Devices (`71+`)
   - Average System Risk Score
3. **Analytics Graphs**:
   - OS & Browser Distribution Progress Bars
   - Real-time Threat Intelligence Callouts (Impossible Travel, Shared Hardware)
4. **Interactive Security Audit Log**:
   - Time, User, Severity, Device, IP Hash, Location, Risk Score.
   - Expandable **Risk Factor Breakdown** modal displaying exact point allocations (`{"new_device": 20, "vpn_detected": 20}`).
