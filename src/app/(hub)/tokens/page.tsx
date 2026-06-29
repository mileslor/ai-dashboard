"use client";

import { useEffect, useState, useCallback } from "react";
import { ExternalLink, Loader2, RefreshCw, Zap, Clock, TrendingUp, Battery } from "lucide-react";

interface UsageData {
  today_total: number;
  today_input: number;
  today_output: number;
  today_cache_create: number;
  today_cache_read: number;
  today_cost_usd: number;
  session_total: number;
  session_elapsed_min: number;
  burn_rate_per_hour: number;
  session_cost_usd: number;
  five_hour_utilization: number | null;
  five_hour_resets_at: string | null;
  seven_day_utilization: number | null;
  seven_day_resets_at: string | null;
  extra_enabled: boolean;
  extra_used_usd: number | null;
  extra_limit_usd: number | null;
  extra_utilization: number | null;
  timestamp: number;
  error?: string;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

function fmtResetTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diffMin = Math.round((d.getTime() - Date.now()) / 60000);
  if (diffMin <= 0) return "Soon";
  if (diffMin < 60) return `${diffMin}m`;
  return `${Math.floor(diffMin / 60)}h ${diffMin % 60}m`;
}

function QuotaBar({ label, utilization, resetsAt, color }: {
  label: string;
  utilization: number | null;
  resetsAt: string | null;
  color: string;
}) {
  const pct = utilization != null ? Math.min(utilization * 100, 100) : null;
  const danger = pct != null && pct > 80;
  const warn = pct != null && pct > 60;

  return (
    <div className="rounded-xl border border-white/8 bg-white/4 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-300">{label}</span>
        <span className={`text-sm font-bold ${pct == null ? "text-slate-600" : danger ? "text-red-400" : warn ? "text-amber-400" : "text-cyan-400"}`}>
          {pct != null ? `${pct.toFixed(1)}%` : "無資料"}
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/8 overflow-hidden mb-2">
        {pct != null && (
          <div
            className={`h-full rounded-full transition-all duration-500 ${danger ? "bg-red-500" : warn ? "bg-amber-500" : color}`}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
      <div className="flex justify-between text-xs text-slate-600">
        <span>重置倒數</span>
        <span className="text-slate-500">{fmtResetTime(resetsAt)}</span>
      </div>
    </div>
  );
}

export default function TokensPage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [launchResult, setLaunchResult] = useState<"ok" | "error" | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/claude-usage");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  async function openTokenMonitor() {
    setLaunching(true);
    setLaunchResult(null);
    try {
      const res = await fetch("/api/focus-token-monitor", { method: "POST" });
      const d = await res.json();
      setLaunchResult(d.ok ? "ok" : "error");
    } catch {
      setLaunchResult("error");
    } finally {
      setLaunching(false);
      setTimeout(() => setLaunchResult(null), 2000);
    }
  }

  return (
    <div className="min-h-screen px-8 pt-8 pb-12">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[10%] right-[10%] w-[400px] h-[400px] rounded-full bg-cyan-600/8 blur-[100px]" />
      </div>

      <div className="relative max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Battery className="w-5 h-5 text-cyan-400" /> Token Monitor
            </h2>
            <p className="text-slate-500 text-sm mt-0.5">Claude 用量 · 每分鐘更新</p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} disabled={loading}
              className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors disabled:opacity-40">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={openTokenMonitor} disabled={launching}
              className="h-8 px-3 rounded-lg bg-cyan-500/15 border border-cyan-500/25 text-cyan-300 hover:bg-cyan-500/25 text-sm flex items-center gap-1.5 transition-all disabled:opacity-50">
              {launching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
              {launching ? "開緊…" : "完整監控"}
            </button>
          </div>
        </div>

        {loading && !data && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-cyan-500/50 animate-spin" />
          </div>
        )}

        {data?.error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400 mb-4">
            載入失敗：{data.error}
          </div>
        )}

        {data && !data.error && (
          <div className="space-y-4">
            {/* Quota bars */}
            <QuotaBar
              label="5小時配額"
              utilization={data.five_hour_utilization}
              resetsAt={data.five_hour_resets_at}
              color="bg-cyan-500"
            />
            <QuotaBar
              label="7日配額"
              utilization={data.seven_day_utilization}
              resetsAt={data.seven_day_resets_at}
              color="bg-blue-500"
            />

            {/* Extra usage */}
            {data.extra_enabled && data.extra_used_usd != null && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-amber-300">Extra Usage</span>
                  <span className="text-sm font-bold text-amber-400">
                    ${data.extra_used_usd.toFixed(2)} / ${(data.extra_limit_usd ?? 0).toFixed(0)}
                  </span>
                </div>
                {data.extra_utilization != null && (
                  <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-500 transition-all duration-500"
                      style={{ width: `${Math.min(data.extra_utilization * 100, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Today stats */}
            <div className="rounded-xl border border-white/8 bg-white/4 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-medium text-slate-300">今日用量</span>
                <span className="text-xs text-slate-600 ml-auto">${data.today_cost_usd.toFixed(3)} USD</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-600 mb-0.5">總 Tokens</p>
                  <p className="text-lg font-bold text-white">{fmt(data.today_total)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 mb-0.5">輸出</p>
                  <p className="text-lg font-bold text-white">{fmt(data.today_output)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 mb-0.5">Cache 建立</p>
                  <p className="text-sm font-medium text-slate-400">{fmt(data.today_cache_create)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 mb-0.5">Cache 讀取</p>
                  <p className="text-sm font-medium text-slate-400">{fmt(data.today_cache_read)}</p>
                </div>
              </div>
            </div>

            {/* Session stats */}
            {data.session_total > 0 && (
              <div className="rounded-xl border border-white/8 bg-white/4 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-violet-400" />
                  <span className="text-sm font-medium text-slate-300">當前 Session</span>
                  <span className="text-xs text-slate-600 ml-auto">${data.session_cost_usd.toFixed(3)} USD</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-600 mb-0.5">Session Tokens</p>
                    <p className="text-lg font-bold text-white">{fmt(data.session_total)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 mb-0.5">Burn Rate</p>
                    <p className="text-lg font-bold text-white">
                      {fmt(data.burn_rate_per_hour)}<span className="text-xs text-slate-500 ml-1">/hr</span>
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-slate-600 mb-0.5 flex items-center gap-1"><Clock className="w-3 h-3" /> 已用時間</p>
                    <p className="text-sm font-medium text-slate-400">
                      {data.session_elapsed_min >= 60
                        ? `${Math.floor(data.session_elapsed_min / 60)}h ${data.session_elapsed_min % 60}m`
                        : `${data.session_elapsed_min}m`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {data.timestamp && (
              <p className="text-xs text-slate-700 text-right">
                更新：{new Date(data.timestamp).toLocaleTimeString("zh-HK", { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>
        )}

        {launchResult === "ok" && <p className="text-xs text-emerald-500 mt-3">✓ 已切換到 Token Monitor</p>}
        {launchResult === "error" && <p className="text-xs text-red-400 mt-3">未能開啟，請點擊 Tray 圖示</p>}
      </div>
    </div>
  );
}
