import React, { useState } from "react";
import {
  Activity,
  Cpu,
  Database,
  Globe,
  HardDrive,
  Heart,
  Laptop,
  Lock,
  RefreshCw,
  Server,
  Shield,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Terminal,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { DeviceIntelligenceDashboard } from "./DeviceIntelligenceDashboard";

export const AdminMonitoringDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"system" | "api" | "security" | "devices">("system");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  return (
    <div className="space-y-6 text-slate-100 p-6 bg-slate-950 rounded-xl border border-slate-800">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
              <Server className="w-7 h-7 text-indigo-400" />
              SaaS Observability & Monitoring Dashboard
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full">
              Production Stack
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Real-time memory budget, Prometheus metrics, Pino logger streams, security audit trails,
            and device intelligence.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-emerald-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Render Free (512MB RAM Budget) Healthy
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 space-x-2">
        <button
          onClick={() => setActiveTab("system")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "system"
              ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
          }`}
        >
          <Cpu className="w-4 h-4" />
          System Health & Process
        </button>

        <button
          onClick={() => setActiveTab("api")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "api"
              ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
          }`}
        >
          <Zap className="w-4 h-4" />
          API Performance & Latency
        </button>

        <button
          onClick={() => setActiveTab("security")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "security"
              ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
          }`}
        >
          <Shield className="w-4 h-4" />
          Security Monitoring & Audit
        </button>

        <button
          onClick={() => setActiveTab("devices")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "devices"
              ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
          }`}
        >
          <Laptop className="w-4 h-4" />
          Device Intelligence
        </button>
      </div>

      {/* Tab 1: System Health */}
      {activeTab === "system" && (
        <div className="space-y-6">
          {/* Health Endpoints Status Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-mono font-semibold">GET /health</span>
                <p className="text-xs text-slate-300 mt-0.5">Render Cloud Health Probe</p>
                <div className="text-xs text-emerald-400 font-bold mt-1">200 OK (&lt;1ms)</div>
              </div>
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-mono font-semibold">GET /ready</span>
                <p className="text-xs text-slate-300 mt-0.5">Redis &amp; Supabase DB Probe</p>
                <div className="text-xs text-emerald-400 font-bold mt-1">200 OK (4ms)</div>
              </div>
              <Database className="w-6 h-6 text-emerald-400" />
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-mono font-semibold">GET /live</span>
                <p className="text-xs text-slate-300 mt-0.5">Node Runtime Liveness</p>
                <div className="text-xs text-emerald-400 font-bold mt-1">Alive (142h Uptime)</div>
              </div>
              <Heart className="w-6 h-6 text-emerald-400" />
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-mono font-semibold">GET /ping</span>
                <p className="text-xs text-slate-300 mt-0.5">External Cron Monitor SLA</p>
                <div className="text-xs text-emerald-400 font-bold mt-1">200 OK (&lt;3ms SLA)</div>
              </div>
              <Zap className="w-6 h-6 text-emerald-400" />
            </div>
          </div>

          {/* Process Memory Budget & Event Loop */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-indigo-400" />
                Render Free Memory Allocation (512 MB Hard Limit)
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Process Resident Memory (RSS)</span>
                    <span className="font-mono font-bold text-indigo-400">
                      145 MB / 512 MB (28.3%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-indigo-500 h-full rounded-full" style={{ width: "28.3%" }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Node Heap Used</span>
                    <span className="font-mono font-bold text-emerald-400">
                      56 MB / 82 MB Heap Total
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full"
                      style={{ width: "68.2%" }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Monitoring Stack (Prometheus + Grafana + Alertmanager)</span>
                    <span className="font-mono font-bold text-blue-400">
                      280 MB Allocated in Docker
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-blue-500 h-full rounded-full" style={{ width: "54.6%" }} />
                  </div>
                </div>
              </div>

              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded text-[11px] text-indigo-300">
                💡 Memory safe: Total monitoring footprint strictly constrained under 350 MB RAM
                budget.
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-indigo-400" />
                CPU &amp; Event Loop Lag Diagnostics
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-800/60 rounded border border-slate-700/60">
                  <span className="text-[11px] text-slate-400">CPU Utilization</span>
                  <div className="text-xl font-extrabold text-slate-100 mt-1">12.4%</div>
                  <span className="text-[10px] text-emerald-400 font-semibold">
                    Overhead &lt;1%
                  </span>
                </div>

                <div className="p-3 bg-slate-800/60 rounded border border-slate-700/60">
                  <span className="text-[11px] text-slate-400">Event Loop Lag</span>
                  <div className="text-xl font-extrabold text-emerald-400 mt-1">1.2 ms</div>
                  <span className="text-[10px] text-slate-400">Optimal &lt;10ms</span>
                </div>
              </div>

              <div className="space-y-2 text-xs text-slate-300 border-t border-slate-800 pt-3">
                <div className="flex justify-between">
                  <span>Node Runtime Version</span>
                  <span className="font-mono text-slate-400">v20.11.0</span>
                </div>
                <div className="flex justify-between">
                  <span>App Version / Build</span>
                  <span className="font-mono text-slate-400">v1.0.0 (Build #101)</span>
                </div>
                <div className="flex justify-between">
                  <span>Container Restarts</span>
                  <span className="font-mono text-emerald-400">0 restarts</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: API Performance */}
      {activeTab === "api" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <span className="text-xs text-slate-400">Throughput (RPS)</span>
              <div className="text-2xl font-bold text-slate-100 mt-1">124 req/s</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <span className="text-xs text-slate-400">P50 Latency</span>
              <div className="text-2xl font-bold text-emerald-400 mt-1">14 ms</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <span className="text-xs text-slate-400">P95 Latency</span>
              <div className="text-2xl font-bold text-blue-400 mt-1">42 ms</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <span className="text-xs text-slate-400">5xx Server Error Rate</span>
              <div className="text-2xl font-bold text-emerald-400 mt-1">0.04%</div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              HTTP Status Code Distribution
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <span className="text-xs text-emerald-400 font-bold">2xx Success</span>
                <div className="text-lg font-extrabold text-slate-100 mt-1">98.4%</div>
              </div>
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <span className="text-xs text-blue-400 font-bold">3xx Redirect</span>
                <div className="text-lg font-extrabold text-slate-100 mt-1">0.3%</div>
              </div>
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <span className="text-xs text-amber-400 font-bold">4xx Client Error</span>
                <div className="text-lg font-extrabold text-slate-100 mt-1">1.2%</div>
              </div>
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                <span className="text-xs text-rose-400 font-bold">5xx Server Error</span>
                <div className="text-lg font-extrabold text-slate-100 mt-1">0.04%</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Security & Audit Monitoring */}
      {activeTab === "security" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <span className="text-xs text-slate-400">Active Rate Limiters</span>
              <div className="text-2xl font-bold text-slate-100 mt-1">28 blocked IPs</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <span className="text-xs text-slate-400">Failed Auth Attempts (1h)</span>
              <div className="text-2xl font-bold text-amber-400 mt-1">14 attempts</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <span className="text-xs text-slate-400">Security Threat Level</span>
              <div className="text-2xl font-bold text-emerald-400 mt-1">LOW / SAFE</div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-400" />
              Enterprise Audit Trail (`audit_logs`)
            </h3>
            <div className="space-y-2 text-xs font-mono">
              <div className="p-2.5 bg-slate-950 border border-slate-800 rounded flex justify-between">
                <div>
                  <span className="text-indigo-400 font-bold">[BLOCK_DEVICE]</span> Admin blocked
                  device dev_981
                </div>
                <span className="text-slate-500">2 mins ago</span>
              </div>
              <div className="p-2.5 bg-slate-950 border border-slate-800 rounded flex justify-between">
                <div>
                  <span className="text-emerald-400 font-bold">[TRUST_DEVICE]</span> User trusted
                  device dev_102
                </div>
                <span className="text-slate-500">14 mins ago</span>
              </div>
              <div className="p-2.5 bg-slate-950 border border-slate-800 rounded flex justify-between">
                <div>
                  <span className="text-amber-400 font-bold">[REVOKE_SESSION]</span> Revoked token
                  family fam_331
                </div>
                <span className="text-slate-500">40 mins ago</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Device Intelligence */}
      {activeTab === "devices" && <DeviceIntelligenceDashboard />}
    </div>
  );
};
