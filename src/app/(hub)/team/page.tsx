"use client";

import { useEffect, useState, useCallback } from "react";
import { getAllAIs, addAI, db } from "@/lib/db";
import { fetchClaudeTokens } from "@/lib/fetch-tokens";
import type { ClaudeUsage } from "@/lib/fetch-tokens";
import type { AI } from "@/types";
import { Plus, Bot, Trash2, X, RefreshCw, Zap } from "lucide-react";

// ─── Real seed data ──────────────────────────────────────────────────────────

const SEED_AGENTS: Omit<AI, "id" | "createdAt">[] = [
  {
    name: "Claude",
    role: "代碼執行官 · Coder",
    emoji: "🧠",
    color: "from-violet-500/20 to-violet-600/20 border-violet-500/30",
    status: "idle",
    provider: "claude",
    model: "claude-sonnet-4-6",
    contextMax: 200000,
    description:
      "Claude Sonnet 4.6，200k context window，Claude Max Plan。擅長寫代碼、debug、讀取本地檔案，解題能力超強，適合複雜架構設計同埋大型代碼庫分析。費用相對高，只用於需要讀本地檔案或寫代碼嘅任務。",
    capabilities: ["寫代碼", "Debug", "讀本地檔案", "架構設計", "代碼審查", "重構"],
  },
  {
    name: "MiniMax",
    role: "分析統籌官 · Analyst",
    emoji: "🤖",
    color: "from-blue-500/20 to-blue-600/20 border-blue-500/30",
    status: "idle",
    provider: "minimax",
    model: "MiniMax-M2.7",
    contextMax: 1000000,
    description:
      "MiniMax M2.7，api.minimaxi.chat，性價比超高。專門做需求分析、總結、問答同埋非代碼任務。日常問答同埋文書工作非常夠用，係慳 Claude token 嘅最佳選擇。",
    capabilities: ["需求分析", "技術解釋", "文檔撰寫", "總結歸納", "翻譯", "問答"],
  },
];

// ─── Compact circular meter ───────────────────────────────────────────────────

function MiniMeter({ percent, color }: { percent: number; color: "violet" | "blue" }) {
  const size = 80;
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(percent, 100) / 100) * circ;
  const strokeClass = color === "violet" ? "stroke-violet-500" : "stroke-blue-500";
  const textClass = color === "violet" ? "text-violet-400" : "text-blue-400";
  return (
    <div className="relative flex-shrink-0">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={7} className="text-white/10" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={7} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          className={`${strokeClass} transition-[stroke-dashoffset] duration-700`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-base font-bold ${textClass}`}>{Math.min(Math.round(percent), 100)}</span>
        <span className="text-slate-600 text-xs">%</span>
      </div>
    </div>
  );
}

// ─── Token panel (shown inside agent detail) ─────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return n.toString();
}

function fmtMinutes(min: number): string {
  if (min < 60) return `${min}分鐘`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}小時${m}分` : `${h}小時`;
}

interface MmLiveData {
  window_used: number;
  window_calls: number;
  window_end: number;
  window_reset_min: number;
  today_total: number;
  last_call_ts: number | null;
  has_data: boolean;
}

const MM_WINDOW_LIMIT = 1500;

function TokenPanel({ ai }: { ai: AI }) {
  const [claudeData, setClaudeData] = useState<ClaudeUsage | null>(null);
  const [mmLive, setMmLive] = useState<MmLiveData | null>(null);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Tick every 30s to update countdown
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      if (ai.provider === "claude") {
        const data = await fetchClaudeTokens();
        if (data) setClaudeData(data);
        else setError("無法讀取 ~/.claude/projects 日誌");
      } else if (ai.provider === "minimax") {
        const res = await fetch("/api/minimax-usage");
        if (res.ok) setMmLive(await res.json());
      }
    } catch {
      setError("讀取失敗");
    }
    setRefreshing(false);
  }, [ai.provider]);

  useEffect(() => { refresh(); }, [refresh]);

  if (!ai.provider || ai.provider === "other") return null;

  const refreshBtn = (
    <button onClick={refresh} className={`w-6 h-6 rounded-md hover:bg-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-colors ${refreshing ? "animate-spin" : ""}`}>
      <RefreshCw className="w-3 h-3" />
    </button>
  );

  // ── Claude ────────────────────────────────────────────────────────────────
  if (ai.provider === "claude") {
    const fiveHourPct = claudeData?.five_hour_utilization ?? 0;
    const sevenDayPct = claudeData?.seven_day_utilization ?? 0;
    const fiveHourBar = fiveHourPct >= 90 ? "bg-red-500" : fiveHourPct >= 70 ? "bg-amber-500" : "bg-violet-500";
    const fiveHourTxt = fiveHourPct >= 90 ? "text-red-400" : fiveHourPct >= 70 ? "text-amber-400" : "text-violet-400";
    const sevenDayBar = sevenDayPct >= 90 ? "bg-red-500" : sevenDayPct >= 70 ? "bg-amber-500" : "bg-indigo-500";

    const fiveHourResetMin = claudeData?.five_hour_resets_at
      ? Math.max(0, Math.round((new Date(claudeData.five_hour_resets_at).getTime() - now) / 60000))
      : null;
    const sevenDayResetMin = claudeData?.seven_day_resets_at
      ? Math.max(0, Math.round((new Date(claudeData.seven_day_resets_at).getTime() - now) / 60000))
      : null;

    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Token 用量</span>
          </div>
          {refreshBtn}
        </div>

        {error && <p className="text-red-400/70 text-xs">{error}</p>}

        {claudeData && (
          <>
            {/* 5-hour quota bar — cross-machine accurate */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-500">5小時配額（跨設備）</span>
                <span className={`text-sm font-bold ${fiveHourTxt}`}>{fiveHourPct}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${fiveHourBar}`}
                  style={{ width: `${Math.min(fiveHourPct, 100)}%` }} />
              </div>
              {fiveHourResetMin !== null && (
                <p className="text-xs text-slate-600 mt-1 text-right">
                  {fiveHourResetMin > 0 ? `${fmtMinutes(fiveHourResetMin)}後重置` : "已重置"}
                </p>
              )}
            </div>

            {/* 7-day quota bar */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-500">7日配額</span>
                <span className={`text-sm font-bold ${sevenDayPct >= 90 ? "text-red-400" : sevenDayPct >= 70 ? "text-amber-400" : "text-indigo-400"}`}>{sevenDayPct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${sevenDayBar}`}
                  style={{ width: `${Math.min(sevenDayPct, 100)}%` }} />
              </div>
              {sevenDayResetMin !== null && (
                <p className="text-xs text-slate-600 mt-1 text-right">
                  {sevenDayResetMin > 0 ? `${fmtMinutes(sevenDayResetMin)}後重置` : "已重置"}
                </p>
              )}
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-white/5 border border-white/8 p-2.5">
                <p className="text-xs text-slate-500 mb-1">Burn rate</p>
                <p className="text-sm font-bold text-white">
                  {fmt(claudeData.burn_rate_per_hour)}<span className="text-xs text-slate-500 font-normal">/hr</span>
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{claudeData.session_elapsed_min}分鐘 session</p>
              </div>
              <div className="rounded-lg bg-white/5 border border-white/8 p-2.5">
                <p className="text-xs text-slate-500 mb-1">今日費用</p>
                <p className="text-sm font-bold text-white">${claudeData.today_cost_usd.toFixed(2)}</p>
                {claudeData.extra_enabled && claudeData.extra_limit_usd && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Extra: ${claudeData.extra_used_usd?.toFixed(0) ?? 0}/${claudeData.extra_limit_usd}
                  </p>
                )}
              </div>
            </div>

            {/* Collapsible today breakdown */}
            <details className="group">
              <summary className="text-xs text-slate-600 cursor-pointer hover:text-slate-400 transition-colors select-none list-none flex items-center gap-1">
                <span className="group-open:rotate-90 transition-transform inline-block text-[10px]">▶</span>
                今日詳細分佈（本機）
              </summary>
              <div className="mt-2 space-y-1.5 pl-2 border-l border-white/5">
                {[
                  { label: "Input", val: claudeData.today_input, c: "bg-violet-500" },
                  { label: "Output", val: claudeData.today_output, c: "bg-fuchsia-500" },
                  { label: "Cache Create", val: claudeData.today_cache_create, c: "bg-blue-500" },
                  { label: "Cache Read", val: claudeData.today_cache_read, c: "bg-cyan-500" },
                ].map(({ label, val, c }) => (
                  <div key={label} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${c}`} />
                      <span className="text-slate-500">{label}</span>
                    </div>
                    <span className="text-slate-300 font-mono">{val.toLocaleString()}</span>
                  </div>
                ))}
                <div className="pt-1 border-t border-white/5 flex justify-between text-xs">
                  <span className="text-slate-500">今日合計</span>
                  <span className="text-white font-mono">{claudeData.today_total.toLocaleString()}</span>
                </div>
              </div>
            </details>
          </>
        )}
      </div>
    );
  }

  // ── MiniMax ───────────────────────────────────────────────────────────────
  const mmPct = mmLive ? Math.min((mmLive.window_used / MM_WINDOW_LIMIT) * 100, 100) : 0;
  const mmResetMin = mmLive ? Math.max(0, Math.round((mmLive.window_end - now) / 60000)) : 0;
  const mmBarColor = mmPct >= 90 ? "bg-red-500" : mmPct >= 70 ? "bg-amber-500" : "bg-blue-500";
  const mmPctColor = mmPct >= 90 ? "text-red-400" : mmPct >= 70 ? "text-amber-400" : "text-blue-400";

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Token 用量（5小時窗口）</span>
        </div>
        {refreshBtn}
      </div>

      {error && <p className="text-red-400/70 text-xs">{error}</p>}

      {mmLive?.has_data ? (
        <>
          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-slate-500">本窗口用量</span>
              <span className={`text-sm font-bold ${mmPctColor}`}>{Math.round(mmPct)}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${mmBarColor}`}
                style={{ width: `${mmPct}%` }} />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-slate-600">{mmLive.window_used.toLocaleString()} 已用</span>
              <span className="text-xs text-slate-600">{MM_WINDOW_LIMIT.toLocaleString()} 上限</span>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white/5 border border-white/8 p-2.5">
              <p className="text-xs text-slate-500 mb-1">仍可用</p>
              <p className="text-sm font-bold text-white">{Math.max(0, MM_WINDOW_LIMIT - mmLive.window_used).toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-0.5">{mmLive.window_calls} 次呼叫</p>
            </div>
            <div className="rounded-lg bg-white/5 border border-white/8 p-2.5">
              <p className="text-xs text-slate-500 mb-1">窗口重置</p>
              <p className="text-sm font-bold text-white">
                {new Date(mmLive.window_end).toLocaleTimeString("zh-HK", { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className={`text-xs mt-0.5 ${mmResetMin < 30 ? "text-amber-400" : "text-slate-500"}`}>
                {mmResetMin > 0 ? fmtMinutes(mmResetMin) : "已重置"}
              </p>
            </div>
          </div>

          {/* Today total */}
          <div className="flex justify-between text-xs">
            <span className="text-slate-600">今日總用量</span>
            <span className="text-slate-400 font-mono">{mmLive.today_total.toLocaleString()} tokens</span>
          </div>

          {mmLive.last_call_ts && (
            <p className="text-xs text-slate-700">
              最後呼叫 {new Date(mmLive.last_call_ts).toLocaleTimeString("zh-HK", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
          )}
        </>
      ) : (
        <div className="rounded-lg bg-blue-500/5 border border-blue-500/15 px-3 py-3 text-center">
          <p className="text-slate-500 text-xs mb-1">尚未有記錄</p>
          <p className="text-slate-600 text-xs">用 <span className="font-mono text-slate-400">mx</span> 問問題後，用量會自動顯示</p>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  active: { dot: "bg-green-400", label: "Active" },
  idle: { dot: "bg-slate-500", label: "Idle" },
  busy: { dot: "bg-amber-400 animate-pulse", label: "Busy" },
};

export default function TeamPage() {
  const [agents, setAgents] = useState<AI[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [seeded, setSeeded] = useState(false);

  const selected = agents.find((a) => a.id === selectedId) ?? null;

  async function load() {
    const data = await getAllAIs();
    setAgents(data);
    return data;
  }

  // Auto-seed real data if empty
  useEffect(() => {
    load().then(async (data) => {
      if (data.length === 0 && !seeded) {
        for (const agent of SEED_AGENTS) {
          await addAI(agent);
        }
        setSeeded(true);
        const fresh = await load();
        if (fresh.length > 0) setSelectedId(fresh[0].id);
      } else if (data.length > 0 && !selectedId) {
        setSelectedId(data[0].id);
      }
    });
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const colors = [
      "from-red-500/20 to-red-600/20 border-red-500/30",
      "from-green-500/20 to-green-600/20 border-green-500/30",
      "from-amber-500/20 to-amber-600/20 border-amber-500/30",
    ];
    const id = await addAI({
      name: newName.trim(),
      role: newRole.trim() || "Assistant",
      status: "idle",
      color: colors[agents.length % colors.length],
      provider: "other",
    });
    setNewName(""); setNewRole(""); setShowAdd(false);
    await load();
    setSelectedId(id);
  }

  async function handleDelete(id: string) {
    await db.ais.delete(id);
    if (selectedId === id) setSelectedId(null);
    load();
  }

  async function cycleStatus(agent: AI) {
    const cycle: AI["status"][] = ["idle", "active", "busy"];
    const next = cycle[(cycle.indexOf(agent.status) + 1) % cycle.length];
    await db.ais.update(agent.id, { status: next });
    load();
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left panel — agent list */}
      <aside className="w-56 flex-shrink-0 border-r border-white/10 flex flex-col bg-black/20">
        <div className="p-3 border-b border-white/10 flex items-center justify-between flex-shrink-0">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            AI 團隊 <span className="text-slate-700 normal-case">({agents.length})</span>
          </span>
          <button
            onClick={() => setShowAdd(true)}
            className="w-6 h-6 rounded-md hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            title="Add AI"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {agents.length === 0 && (
            <div className="text-center py-10">
              <Bot className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <p className="text-slate-700 text-xs">載入中...</p>
            </div>
          )}
          {agents.map((agent) => {
            const sc = STATUS_CONFIG[agent.status];
            return (
              <button
                key={agent.id}
                onClick={() => setSelectedId(agent.id)}
                className={`w-full text-left px-3 py-2.5 transition-colors border-r-2 ${
                  selectedId === agent.id
                    ? "bg-white/8 border-white/30"
                    : "border-transparent hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg leading-none">{agent.emoji ?? agent.name[0]}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${selectedId === agent.id ? "text-white" : "text-slate-300"}`}>
                      {agent.name}
                    </p>
                    <p className="text-xs text-slate-600 truncate">{agent.model ?? agent.role}</p>
                  </div>
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sc.dot}`} />
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Right panel — agent detail */}
      {selected ? (
        <div className="flex-1 flex flex-col min-w-0 overflow-auto">
          {/* Header */}
          <div className="border-b border-white/10 px-8 py-5 flex items-start justify-between flex-shrink-0">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${selected.color} border flex items-center justify-center text-2xl shadow-sm flex-shrink-0`}>
                {selected.emoji ?? selected.name[0].toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{selected.name}</h2>
                <p className="text-slate-400 text-sm">{selected.role}</p>
                {selected.model && (
                  <span className="inline-block mt-1 text-xs text-slate-500 bg-white/5 border border-white/10 rounded-full px-2.5 py-0.5 font-mono">
                    {selected.model}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => cycleStatus(selected)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all hover:opacity-80 ${
                  selected.status === "active"
                    ? "bg-green-500/15 text-green-400 border-green-500/30"
                    : selected.status === "busy"
                    ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                    : "bg-slate-700/50 text-slate-400 border-slate-600/50"
                }`}
                title="Click to cycle status"
              >
                <div className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[selected.status].dot}`} />
                {STATUS_CONFIG[selected.status].label}
              </button>
              <button
                onClick={() => handleDelete(selected.id)}
                className="p-1.5 rounded-md text-slate-700 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="px-8 py-6 space-y-6">
            {/* Token usage */}
            <TokenPanel ai={selected} />

            {/* Description */}
            {selected.description && (
              <div>
                <p className="text-xs text-slate-600 uppercase tracking-wider mb-2">簡介</p>
                <p className="text-slate-300 text-sm leading-relaxed">{selected.description}</p>
              </div>
            )}

            {/* Capabilities */}
            {selected.capabilities && selected.capabilities.length > 0 && (
              <div>
                <p className="text-xs text-slate-600 uppercase tracking-wider mb-2.5">能力</p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.capabilities.map((cap) => (
                    <span
                      key={cap}
                      className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Context window info */}
            {selected.contextMax && (
              <div>
                <p className="text-xs text-slate-600 uppercase tracking-wider mb-2">Context Window</p>
                <p className="text-slate-400 text-sm font-mono">{selected.contextMax.toLocaleString()} tokens</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Bot className="w-16 h-16 text-slate-800 mx-auto mb-4" />
            <p className="text-slate-600 text-sm">選擇 AI 成員查看詳情</p>
          </div>
        </div>
      )}

      {/* Add AI modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-800/95 backdrop-blur-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-semibold">Add AI Agent</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="text-slate-400 text-xs font-medium mb-1.5 block">Name</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Gemini, GPT-4" required autoFocus
                  className="w-full h-10 rounded-lg bg-white/8 border border-white/15 text-white placeholder:text-slate-600 px-3 text-sm outline-none focus:border-blue-500/50 transition-colors" />
              </div>
              <div>
                <label className="text-slate-400 text-xs font-medium mb-1.5 block">Role</label>
                <input value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder="e.g. Image Gen, Research"
                  className="w-full h-10 rounded-lg bg-white/8 border border-white/15 text-white placeholder:text-slate-600 px-3 text-sm outline-none focus:border-blue-500/50 transition-colors" />
              </div>
              <button type="submit"
                className="w-full h-10 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 hover:opacity-90 text-white text-sm font-medium transition-opacity">
                Add Agent
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
