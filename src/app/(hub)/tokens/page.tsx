"use client";

import { useEffect, useState, useCallback } from "react";
import { db } from "@/lib/db";
import { fetchMiniMaxQuota, fetchClaudeTokens } from "@/lib/fetch-tokens";
import { RefreshCw, AlertCircle, Zap } from "lucide-react";

interface MiniMaxQuota {
  available_text: number;
  available_speech: number;
  available_video: number;
  total_text: number;
  used_text: number;
}


interface TokenSnapshot {
  id?: number;
  provider: "minimax" | "claude";
  tokens_used: number;
  context_used: number;
  timestamp: number;
}

interface TokenState {
  provider: string;
  emoji: string;
  contextUsed: number;
  contextMax: number;
  quotaUsed?: number;
  quotaTotal?: number;
  lastUpdated: number;
  error?: string;
}

const REFRESH_INTERVAL = 30; // seconds

function CircularMeter({
  percent,
  color,
  size = 120,
}: {
  percent: number;
  color: string;
  size?: number;
}) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ - (Math.min(percent, 100) / 100) * circ;
  const colorClass =
    color === "blue"
      ? "stroke-blue-500"
      : color === "violet"
      ? "stroke-violet-500"
      : "stroke-cyan-500";

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={8}
        className="text-white/10"
      />
      {/* Progress */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={dashOffset}
        className={`${colorClass} transition-[stroke-dashoffset] duration-700 ease-out`}
        style={{ filter: `drop-shadow(0 0 6px currentColor)` }}
      />
    </svg>
  );
}

function Sparkline({
  data,
  color,
}: {
  data: TokenSnapshot[];
  color: "blue" | "violet";
}) {
  const heights = data.map((d) =>
    data.length > 1
      ? Math.max(4, (d.context_used / Math.max(...data.map((x) => x.context_used), 1)) * 40)
      : 40
  );
  const barColor = color === "blue" ? "bg-blue-500/60" : "bg-violet-500/60";
  const glowColor = color === "blue" ? "shadow-blue-500/30" : "shadow-violet-500/30";

  return (
    <div className="flex items-end gap-0.5 h-10">
      {heights.map((h, i) => (
        <div
          key={i}
          className={`flex-1 rounded-sm ${barColor} shadow-sm ${glowColor} transition-all duration-300`}
          style={{ height: `${h}px` }}
        />
      ))}
      {heights.length === 0 &&
        Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`flex-1 rounded-sm ${barColor} opacity-20`}
            style={{ height: "4px" }}
          />
        ))}
    </div>
  );
}

function TokenCard({
  state,
  history,
  onRefresh,
  refreshing,
  accentColor,
}: {
  state: TokenState;
  history: TokenSnapshot[];
  onRefresh: () => void;
  refreshing: boolean;
  accentColor: "blue" | "violet";
}) {
  const percent =
    state.quotaTotal != null
      ? (state.quotaUsed ?? 0) / state.quotaTotal * 100
      : state.contextMax > 0
      ? (state.contextUsed / state.contextMax) * 100
      : 0;

  const usedDisplay =
    state.quotaTotal != null
      ? state.quotaUsed?.toLocaleString()
      : state.contextUsed.toLocaleString();

  const totalDisplay =
    state.quotaTotal != null
      ? state.quotaTotal.toLocaleString()
      : state.contextMax.toLocaleString();

  const label =
    state.provider === "MiniMax"
      ? "Token Quota Used"
      : "Context Window Used";

  const accentClasses =
    accentColor === "blue"
      ? { ring: "ring-blue-500/30", text: "text-blue-400", glow: "shadow-blue-500/20" }
      : { ring: "ring-violet-500/30", text: "text-violet-400", glow: "shadow-violet-500/20" };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{state.emoji}</span>
            <h3 className="text-white font-semibold text-lg">{state.provider}</h3>
          </div>
          {state.error ? (
            <div className="flex items-center gap-1.5 mt-2 text-red-400 text-xs">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{state.error}</span>
            </div>
          ) : (
            <p className="text-slate-400 text-xs mt-1">{label}</p>
          )}
        </div>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className={`w-8 h-8 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all ${refreshing ? "animate-spin" : ""}`}
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Meter */}
      <div className="flex justify-center py-2 relative">
        <div className="relative flex items-center justify-center">
          <CircularMeter percent={percent} color={accentColor} size={120} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-2xl font-bold ${accentClasses.text}`}>
              {Math.min(Math.round(percent), 100)}
            </span>
            <span className="text-slate-500 text-xs">%</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-medium text-sm">
              {usedDisplay} <span className="text-slate-500 font-normal">/ {totalDisplay}</span>
            </p>
            <p className="text-slate-500 text-xs mt-0.5">
              {state.lastUpdated > 0
                ? `Updated ${new Date(state.lastUpdated).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
                : "No data yet"}
            </p>
          </div>
          {state.error && (
            <div className="text-red-400/60 text-xs">API unreachable</div>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${accentColor === "blue" ? "bg-gradient-to-r from-blue-500 to-cyan-400" : "bg-gradient-to-r from-violet-500 to-fuchsia-400"}`}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>

        {/* Sparkline */}
        <div className="mt-4">
          <p className="text-slate-500 text-xs mb-2 uppercase tracking-wider font-medium">History</p>
          <Sparkline data={history} color={accentColor} />
        </div>
      </div>
    </div>
  );
}

export default function TokensPage() {
  const [minimaxState, setMinimaxState] = useState<TokenState>({
    provider: "MiniMax",
    emoji: "🤖",
    contextUsed: 0,
    contextMax: 100_000,
    lastUpdated: 0,
  });
  const [claudeState, setClaudeState] = useState<TokenState>({
    provider: "Claude",
    emoji: "🧠",
    contextUsed: 0,
    contextMax: 200_000,
    lastUpdated: 0,
  });
  const [minimaxHistory, setMinimaxHistory] = useState<TokenSnapshot[]>([]);
  const [claudeHistory, setClaudeHistory] = useState<TokenSnapshot[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);

  const fetchTokens = useCallback(async () => {
    setRefreshing(true);

    // ── MiniMax ──────────────────────────────────────────────
    try {
      const quota: MiniMaxQuota | null = await fetchMiniMaxQuota("");
      if (quota) {
        const used = quota.used_text ?? 0;
        const total = quota.total_text ?? 0;
        setMinimaxState((prev) => ({
          ...prev,
          quotaUsed: used,
          quotaTotal: total,
          lastUpdated: Date.now(),
          error: undefined,
        }));
        await db.tokenHistory.add({
          provider: "minimax",
          tokens_used: used,
          context_used: used,
          timestamp: Date.now(),
        });
      } else {
        setMinimaxState((prev) => ({ ...prev, error: "API error", lastUpdated: Date.now() }));
      }
    } catch {
      setMinimaxState((prev) => ({ ...prev, error: "Request failed", lastUpdated: Date.now() }));
    }

    // ── Claude ───────────────────────────────────────────────
    try {
      const data = await fetchClaudeTokens();
      if (data) {
        const total = data.today_total;
        setClaudeState((prev) => ({
          ...prev,
          contextUsed: total,
          lastUpdated: Date.now(),
          error: undefined,
        }));
        await db.tokenHistory.add({
          provider: "claude",
          tokens_used: data.today_input + data.today_output,
          context_used: total,
          timestamp: Date.now(),
        });
      } else {
        setClaudeState((prev) => ({ ...prev, error: "Gateway unreachable", lastUpdated: Date.now() }));
      }
    } catch {
      setClaudeState((prev) => ({ ...prev, error: "Request failed", lastUpdated: Date.now() }));
    }

    setRefreshing(false);
    setCountdown(REFRESH_INTERVAL);
  }, []);

  // Load history from Dexie
  async function loadHistory() {
    try {
      const mini = await db.tokenHistory
        .where("provider")
        .equals("minimax")
        .reverse()
        .limit(10)
        .sortBy("timestamp");
      const cla = await db.tokenHistory
        .where("provider")
        .equals("claude")
        .reverse()
        .limit(10)
        .sortBy("timestamp");
      setMinimaxHistory(mini.reverse());
      setClaudeHistory(cla.reverse());
    } catch {
      // table may not exist yet
    }
  }

  useEffect(() => {
    fetchTokens();
    loadHistory();
  }, [fetchTokens]);

  // Countdown + auto-refresh
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          fetchTokens();
          return REFRESH_INTERVAL;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [fetchTokens]);

  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[10%] right-[10%] w-[400px] h-[400px] rounded-full bg-blue-600/8 blur-[100px]" />
        <div className="absolute bottom-[10%] left-[10%] w-[300px] h-[300px] rounded-full bg-violet-600/8 blur-[100px]" />
      </div>

      {/* Page header */}
      <div className="relative px-8 pt-8 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-400" />
              <h2 className="text-xl font-bold text-white">AI Token Dashboard</h2>
            </div>
            <p className="text-slate-400 text-sm mt-0.5">Real-time token & context usage</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
              <div className={`w-1.5 h-1.5 rounded-full ${refreshing ? "bg-amber-400 animate-pulse" : "bg-green-400"}`} />
              <span className="text-slate-400 text-xs">
                {refreshing ? "Refreshing…" : `Next in ${countdown}s`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="relative px-8 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
          <TokenCard
            state={minimaxState}
            history={minimaxHistory}
            onRefresh={fetchTokens}
            refreshing={refreshing}
            accentColor="blue"
          />
          <TokenCard
            state={claudeState}
            history={claudeHistory}
            onRefresh={fetchTokens}
            refreshing={refreshing}
            accentColor="violet"
          />
        </div>

        <p className="text-slate-600 text-xs mt-6 text-center">
          MiniMax context: 100k &nbsp;·&nbsp; Claude context: 200k &nbsp;·&nbsp; Auto-refresh every {REFRESH_INTERVAL}s
        </p>
      </div>
    </div>
  );
}
