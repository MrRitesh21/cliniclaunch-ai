import React, { useState } from "react";
import {
  Shield,
  ShieldAlert,
  Cpu,
  Activity,
  Globe,
  Lock,
  AlertTriangle,
  Users,
  Terminal,
} from "lucide-react";

export const DeviceIntelligenceDashboard: React.FC = () => {
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);

  const mockStats = {
    totalDevices: 1248,
    activeSessions: 842,
    newToday: 45,
    blockedDevices: 12,
    highRiskDevices: 18,
    averageRiskScore: 22,
  };

  const mockEvents = [
    {
      id: "evt_101",
      time: "10 mins ago",
      user: "alice@clinic.com",
      event: "SUSPICIOUS_LOGIN",
      severity: "HIGH",
      device: "Chrome 122 / Windows",
      ipHash: "a7f3e82...b91c",
      location: "India / New Delhi",
      riskScore: 80,
      riskBreakdown: { new_device: 20, vpn_detected: 20, new_country: 30, failed_attempts: 10 },
    },
    {
      id: "evt_102",
      time: "25 mins ago",
      user: "bob@clinic.com",
      event: "NEW_DEVICE_LOGIN",
      severity: "MEDIUM",
      device: "Safari 17 / iOS",
      ipHash: "f49c12a...e042",
      location: "USA / San Francisco",
      riskScore: 50,
      riskBreakdown: { new_device: 20, new_country: 30 },
    },
    {
      id: "evt_103",
      time: "1 hour ago",
      user: "charlie@clinic.com",
      event: "DEVICE_BLOCKED",
      severity: "CRITICAL",
      device: "Firefox 120 / Linux",
      ipHash: "3819df4...8a21",
      location: "Unknown Tor Node",
      riskScore: 100,
      riskBreakdown: { blocked_device: 100, tor_detected: 50 },
    },
  ];

  return (
    <div className="space-y-6 text-slate-100 p-6 bg-slate-950 rounded-xl border border-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2 text-indigo-400">
            <Cpu className="w-6 h-6" />
            Device Intelligence & Security Analytics
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time fraud prevention, hardware fingerprint tracking, and multi-tenant security
            event monitoring.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-emerald-400 text-xs font-semibold">
          <Activity className="w-4 h-4 animate-pulse" />
          Realtime Security Engine Active
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <span className="text-xs text-slate-400">Total Registered</span>
          <div className="text-2xl font-bold mt-1 text-slate-100">{mockStats.totalDevices}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <span className="text-xs text-slate-400">Active Sessions</span>
          <div className="text-2xl font-bold mt-1 text-emerald-400">{mockStats.activeSessions}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <span className="text-xs text-slate-400">New Today</span>
          <div className="text-2xl font-bold mt-1 text-blue-400">+{mockStats.newToday}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <span className="text-xs text-slate-400">Blocked Devices</span>
          <div className="text-2xl font-bold mt-1 text-rose-400">{mockStats.blockedDevices}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <span className="text-xs text-slate-400">High Risk (71+)</span>
          <div className="text-2xl font-bold mt-1 text-amber-400">{mockStats.highRiskDevices}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <span className="text-xs text-slate-400">Avg Risk Score</span>
          <div className="text-2xl font-bold mt-1 text-slate-100">
            {mockStats.averageRiskScore} / 100
          </div>
        </div>
      </div>

      {/* Analytics Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
            <Globe className="w-4 h-4 text-indigo-400" /> OS Distribution
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Windows</span>
              <span>52%</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded">
              <div className="bg-indigo-500 h-1.5 rounded" style={{ width: "52%" }} />
            </div>
            <div className="flex justify-between text-slate-400">
              <span>macOS</span>
              <span>31%</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded">
              <div className="bg-blue-500 h-1.5 rounded" style={{ width: "31%" }} />
            </div>
            <div className="flex justify-between text-slate-400">
              <span>iOS / Android</span>
              <span>17%</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded">
              <div className="bg-emerald-500 h-1.5 rounded" style={{ width: "17%" }} />
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-400" /> Browser Distribution
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Chrome</span>
              <span>64%</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded">
              <div className="bg-emerald-500 h-1.5 rounded" style={{ width: "64%" }} />
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Safari</span>
              <span>22%</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded">
              <div className="bg-blue-500 h-1.5 rounded" style={{ width: "22%" }} />
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Firefox & Edge</span>
              <span>14%</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded">
              <div className="bg-amber-500 h-1.5 rounded" style={{ width: "14%" }} />
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" /> Threat Intelligence
          </h3>
          <div className="space-y-2 text-xs">
            <div className="p-2 bg-slate-800/80 rounded border border-slate-700">
              <span className="text-slate-300 font-semibold">Impossible Travel Detected</span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                2 events flagged across distant geographies within 15 min.
              </p>
            </div>
            <div className="p-2 bg-slate-800/80 rounded border border-slate-700">
              <span className="text-slate-300 font-semibold">
                Multiple Accounts Shared Hardware
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                1 physical fingerprint associated with 3 user accounts.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Security Audit Trail Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-4">
        <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
          <Lock className="w-4 h-4 text-indigo-400" /> Real-time Security Events Log
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                <th className="p-2.5">Time</th>
                <th className="p-2.5">User</th>
                <th className="p-2.5">Event</th>
                <th className="p-2.5">Device</th>
                <th className="p-2.5">IP Hash</th>
                <th className="p-2.5">Location</th>
                <th className="p-2.5">Risk Score</th>
                <th className="p-2.5">Risk Factors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {mockEvents.map((evt) => (
                <tr key={evt.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-2.5 text-slate-400 whitespace-nowrap">{evt.time}</td>
                  <td className="p-2.5 font-medium text-slate-200">{evt.user}</td>
                  <td className="p-2.5">
                    <span
                      className={`font-semibold px-2 py-0.5 rounded text-[10px] ${
                        evt.severity === "CRITICAL"
                          ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          : evt.severity === "HIGH"
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      }`}
                    >
                      {evt.event}
                    </span>
                  </td>
                  <td className="p-2.5 text-slate-300">{evt.device}</td>
                  <td className="p-2.5 font-mono text-slate-400">{evt.ipHash}</td>
                  <td className="p-2.5 text-slate-300">{evt.location}</td>
                  <td className="p-2.5 font-bold">
                    <span
                      className={`px-2 py-0.5 rounded ${
                        evt.riskScore >= 71
                          ? "bg-rose-500/20 text-rose-400"
                          : "bg-amber-500/20 text-amber-400"
                      }`}
                    >
                      {evt.riskScore}
                    </span>
                  </td>
                  <td className="p-2.5">
                    <button
                      onClick={() => setSelectedEvent(selectedEvent?.id === evt.id ? null : evt)}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 underline font-mono"
                    >
                      View Factor Breakdown ({Object.keys(evt.riskBreakdown).length})
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Risk Factor Breakdown Details Modal / Banner */}
        {selectedEvent && (
          <div className="p-4 bg-slate-950 border border-indigo-500/30 rounded-lg space-y-2 mt-4">
            <h4 className="text-xs font-bold text-indigo-300">
              Risk Breakdown Factors for Event {selectedEvent.id} ({selectedEvent.user})
            </h4>
            <div className="flex flex-wrap gap-2 text-xs font-mono">
              {Object.entries(selectedEvent.riskBreakdown).map(([factor, val]) => (
                <span
                  key={factor}
                  className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded text-slate-300"
                >
                  {factor}: <strong className="text-amber-400">+{val as number}</strong>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
