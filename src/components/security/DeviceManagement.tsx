import React, { useState, useEffect } from "react";
import {
  Laptop,
  Smartphone,
  Tablet,
  Shield,
  ShieldAlert,
  CheckCircle,
  Trash2,
  LogOut,
  AlertTriangle,
  Key,
} from "lucide-react";

export interface UserDevice {
  id: string;
  device_id: string;
  is_trusted: boolean;
  is_blocked: boolean;
  login_count: number;
  last_seen: string;
  risk_score: number;
  risk_breakdown: Record<string, number>;
  device?: {
    browser: string;
    os: string;
    device_type: string;
    screen_resolution: string;
  };
}

export const DeviceManagement: React.FC<{ userId?: string }> = ({ userId = "usr_demo" }) => {
  const [devices, setDevices] = useState<UserDevice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulated fetch user devices
    setTimeout(() => {
      setDevices([
        {
          id: "ud_1",
          device_id: "dev_1",
          is_trusted: true,
          is_blocked: false,
          login_count: 42,
          last_seen: new Date().toISOString(),
          risk_score: 10,
          risk_breakdown: { trusted_device: -30 },
          device: {
            browser: "Chrome 122.0",
            os: "macOS 14.3",
            device_type: "desktop",
            screen_resolution: "2560x1440",
          },
        },
        {
          id: "ud_2",
          device_id: "dev_2",
          is_trusted: false,
          is_blocked: false,
          login_count: 3,
          last_seen: new Date(Date.now() - 3600000).toISOString(),
          risk_score: 50,
          risk_breakdown: { new_device: 20, new_country: 30 },
          device: {
            browser: "Safari 17.2",
            os: "iOS 17.3",
            device_type: "mobile",
            screen_resolution: "393x852",
          },
        },
      ]);
      setLoading(false);
    }, 500);
  }, [userId]);

  const handleTrust = (deviceId: string) => {
    setDevices((prev) =>
      prev.map((d) =>
        d.device_id === deviceId
          ? { ...d, is_trusted: true, risk_score: Math.max(0, d.risk_score - 30) }
          : d,
      ),
    );
  };

  const handleBlock = (deviceId: string) => {
    setDevices((prev) =>
      prev.map((d) => (d.device_id === deviceId ? { ...d, is_blocked: true, risk_score: 100 } : d)),
    );
  };

  const handleRemove = (deviceId: string) => {
    setDevices((prev) => prev.filter((d) => d.device_id !== deviceId));
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-slate-100 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-400" />
            Device Security & Active Sessions
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Manage physical devices authorized to access your account and monitor security risk
            scores.
          </p>
        </div>
        <button
          onClick={() => alert("All other sessions revoked successfully.")}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg hover:bg-rose-500/20 transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          Logout All Other Devices
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-400">Loading device registry...</div>
      ) : (
        <div className="space-y-4">
          {devices.map((item) => {
            const isDesktop = item.device?.device_type === "desktop";
            const isMobile = item.device?.device_type === "mobile";

            return (
              <div
                key={item.id}
                className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg border transition-all ${
                  item.is_blocked
                    ? "bg-rose-950/20 border-rose-800/50"
                    : item.is_trusted
                      ? "bg-emerald-950/20 border-emerald-800/40"
                      : "bg-slate-800/50 border-slate-700/60"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-slate-800 rounded-lg border border-slate-700 text-indigo-400">
                    {isDesktop ? (
                      <Laptop className="w-6 h-6" />
                    ) : isMobile ? (
                      <Smartphone className="w-6 h-6" />
                    ) : (
                      <Tablet className="w-6 h-6" />
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-100">{item.device?.browser}</span>
                      <span className="text-xs text-slate-400">on {item.device?.os}</span>

                      {item.is_trusted && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle className="w-3 h-3" /> Trusted
                        </span>
                      )}

                      {item.is_blocked && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <ShieldAlert className="w-3 h-3" /> Blocked
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-400 flex items-center gap-3">
                      <span>Logins: {item.login_count}</span>
                      <span>•</span>
                      <span>Resolution: {item.device?.screen_resolution}</span>
                      <span>•</span>
                      <span>Last seen: {new Date(item.last_seen).toLocaleTimeString()}</span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[11px] text-slate-400 font-mono">Risk Score:</span>
                      <span
                        className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                          item.risk_score >= 71
                            ? "bg-rose-500/20 text-rose-400"
                            : item.risk_score >= 31
                              ? "bg-amber-500/20 text-amber-400"
                              : "bg-emerald-500/20 text-emerald-400"
                        }`}
                      >
                        {item.risk_score} / 100
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4 sm:mt-0 self-end sm:self-center">
                  {!item.is_trusted && !item.is_blocked && (
                    <button
                      onClick={() => handleTrust(item.device_id)}
                      className="px-2.5 py-1 text-xs bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 rounded hover:bg-emerald-600/30 transition-all"
                    >
                      Trust Device
                    </button>
                  )}

                  {!item.is_blocked && (
                    <button
                      onClick={() => handleBlock(item.device_id)}
                      className="px-2.5 py-1 text-xs bg-rose-600/20 text-rose-300 border border-rose-500/30 rounded hover:bg-rose-600/30 transition-all"
                    >
                      Block Device
                    </button>
                  )}

                  <button
                    onClick={() => handleRemove(item.device_id)}
                    className="p-1.5 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition-all"
                    title="Remove Device"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
