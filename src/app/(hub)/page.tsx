"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { ArrowRight, RefreshCw, Clock, AlertCircle, CheckCircle2, Plus, X } from "lucide-react";

interface ProjectStatus { title: string; icon: string; status: string; detail: string }
interface StateData { lastUpdated: string; activeNow: string[]; projects: ProjectStatus[]; pending: string[]; decisions: string[] }

const tiles = [
  { href: "/team",     emoji: "🤖", name: "AI 團隊",  color: "violet" },
  { href: "/projects", emoji: "📁", name: "項目",      color: "emerald" },
  { href: "/activity", emoji: "⚡", name: "活動記錄",  color: "amber" },
  { href: "/sessions", emoji: "🗂️", name: "Sessions",  color: "violet" },
  { href: "/messages", emoji: "💬", name: "訊息",      color: "violet" },
  { href: "/notes",    emoji: "📝", name: "筆記",      color: "blue" },
  { href: "/tokens",   emoji: "🔋", name: "Token",     color: "cyan" },
  { href: "/settings", emoji: "⚙️", name: "設定",      color: "slate" },
];

const tileColors: Record<string, string> = {
  violet:  "hover:bg-violet-500/15 hover:border-violet-500/30 hover:text-violet-200",
  emerald: "hover:bg-emerald-500/15 hover:border-emerald-500/30 hover:text-emerald-200",
  amber:   "hover:bg-amber-500/15 hover:border-amber-500/30 hover:text-amber-200",
  blue:    "hover:bg-blue-500/15 hover:border-blue-500/30 hover:text-blue-200",
  cyan:    "hover:bg-cyan-500/15 hover:border-cyan-500/30 hover:text-cyan-200",
  slate:   "hover:bg-slate-500/15 hover:border-slate-500/30 hover:text-slate-200",
};

const statusStyle: Record<string, string> = {
  "維護中": "text-amber-400 bg-amber-500/10 border-amber-500/25",
  "進行中": "text-blue-400 bg-blue-500/10 border-blue-500/25",
  "維護":   "text-slate-400 bg-slate-500/10 border-slate-500/25",
  "完成":   "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
  "已歸檔": "text-slate-500 bg-slate-500/8 border-slate-500/20",
};

export default function HubPage() {
  const [state, setState] = useState<StateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pendingInput, setPendingInput] = useState("");
  const [showPendingAdd, setShowPendingAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const res = await fetch("/api/current-state");
      if (res.ok) setState(await res.json());
      else setError(true);
    } catch { setError(true); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function checkOffItem(item: string) {
    setSaving(true);
    try {
      await fetch("/api/sync-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingRemove: item }),
      });
      await load();
    } finally { setSaving(false); }
  }

  async function addPendingItem(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingInput.trim() || saving) return;
    setSaving(true);
    try {
      await fetch("/api/sync-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingAdd: pendingInput.trim() }),
      });
      setPendingInput(""); setShowPendingAdd(false);
      await load();
    } finally { setSaving(false); }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-6 space-y-4 max-w-2xl">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">工作總覽</h2>
            {state?.lastUpdated && (
              <p className="text-xs text-slate-600 flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3" /> {state.lastUpdated}
              </p>
            )}
          </div>
          <button onClick={load} disabled={loading}
            className="w-7 h-7 rounded-md hover:bg-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-colors disabled:opacity-40">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3.5 py-2.5 flex items-center gap-2 text-xs text-amber-400">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            無法讀取 current-state.md。去 Settings → 重新生成狀態檔。
          </div>
        )}

        {state && (
          <>
            {/* Row 1: Active Now + Pending */}
            <div className="grid grid-cols-2 gap-3">

              {/* Active Now */}
              <div className="rounded-xl border border-violet-500/25 bg-violet-500/8 p-3.5">
                <p className="text-xs font-semibold text-violet-400 uppercase tracking-widest mb-2">🔴 宜家做緊</p>
                {state.activeNow.length === 0
                  ? <p className="text-xs text-slate-600">未有記錄</p>
                  : <div className="space-y-1.5">
                      {state.activeNow.map((item, i) => (
                        <p key={i} className="text-xs text-slate-300 leading-relaxed line-clamp-3">{item}</p>
                      ))}
                    </div>
                }
              </div>

              {/* Pending — interactive */}
              <div className="rounded-xl border border-white/8 bg-white/3 p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">⏳ 等待處理</p>
                  <button onClick={() => setShowPendingAdd((v) => !v)}
                    className="w-5 h-5 rounded flex items-center justify-center text-slate-600 hover:text-slate-300 hover:bg-white/10 transition-colors">
                    {showPendingAdd ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                  </button>
                </div>

                {showPendingAdd && (
                  <form onSubmit={addPendingItem} className="mb-2 flex gap-1">
                    <input autoFocus value={pendingInput} onChange={(e) => setPendingInput(e.target.value)}
                      placeholder="新增跟進事項..."
                      className="flex-1 h-6 rounded bg-white/8 border border-white/15 text-white placeholder:text-slate-600 px-2 text-xs outline-none focus:border-violet-500/40 transition-colors" />
                    <button type="submit" disabled={saving}
                      className="h-6 px-2 rounded bg-violet-600/40 hover:bg-violet-600/60 text-violet-300 text-xs transition-colors disabled:opacity-40">
                      ＋
                    </button>
                  </form>
                )}

                {state.pending.length === 0
                  ? <p className="text-xs text-slate-600">全部清晒 ✓</p>
                  : <div className="space-y-1">
                      {state.pending.slice(0, 6).map((item, i) => (
                        <button key={i} onClick={() => checkOffItem(item)} disabled={saving}
                          className="w-full flex items-start gap-1.5 group text-left hover:opacity-80 transition-opacity">
                          <div className="w-3.5 h-3.5 rounded border border-slate-700 group-hover:border-emerald-500/60 group-hover:bg-emerald-500/10 flex-shrink-0 mt-0.5 transition-colors" />
                          <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 group-hover:line-through group-hover:text-slate-600 transition-all">{item}</p>
                        </button>
                      ))}
                      {state.pending.length > 6 && (
                        <p className="text-xs text-slate-700 pl-5">+{state.pending.length - 6} 項</p>
                      )}
                    </div>
                }
              </div>
            </div>

            {/* Row 2: Projects */}
            {state.projects.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-1.5">項目狀態</p>
                <div className="space-y-1">
                  {state.projects.map((p, i) => {
                    const cls = statusStyle[p.status] ?? "text-slate-400 bg-white/5 border-white/10";
                    return (
                      <Link key={i} href="/projects">
                        <div className="rounded-lg border border-white/6 bg-white/3 hover:bg-white/6 hover:border-white/12 transition-colors px-3 py-2 flex items-center gap-2.5 group">
                          <span className="text-sm leading-none flex-shrink-0">{p.icon}</span>
                          <p className="text-sm text-slate-200 group-hover:text-white transition-colors flex-1 min-w-0 truncate">{p.title}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${cls}`}>{p.status}</span>
                          <ArrowRight className="w-3 h-3 text-slate-700 group-hover:text-slate-400 flex-shrink-0 transition-colors" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Row 3: Recent decisions */}
            {state.decisions.length > 0 && (
              <div className="rounded-xl border border-white/6 bg-white/3 p-3.5">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-2">🗒️ 最近決定</p>
                <div className="space-y-1.5">
                  {state.decisions.map((d, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-slate-700 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-slate-500 leading-relaxed">{d}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Nav tiles */}
        <div>
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-widest mb-1.5">導航</p>
          <div className="grid grid-cols-3 gap-1.5">
            {tiles.map((tile) => (
              <Link key={tile.href} href={tile.href}>
                <div className={`rounded-lg border border-white/8 bg-white/3 px-3 py-2 flex items-center gap-2 text-slate-500 text-sm transition-colors group ${tileColors[tile.color]}`}>
                  <span className="text-base leading-none">{tile.emoji}</span>
                  <span className="font-medium truncate text-xs">{tile.name}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
