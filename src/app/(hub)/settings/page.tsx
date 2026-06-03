"use client";

import { useEffect, useState } from "react";
import { getPendingSyncs, db } from "@/lib/db";
import type { SyncQueueItem } from "@/types";
import { Database, Cloud, Trash2, Shield, Download, CheckCircle, AlertCircle, Loader2, RefreshCw, FileText } from "lucide-react";

export default function SettingsPage() {
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([]);
  const [dbStats, setDbStats] = useState({ ais: 0, projects: 0, activities: 0, messages: 0 });
  const [seedState, setSeedState] = useState<"idle" | "loading" | "preview" | "importing" | "done" | "error">("idle");
  const [seedPreview, setSeedPreview] = useState<{ projects: number; activities: number; notes: number } | null>(null);
  const [seedData, setSeedData] = useState<{ projects: object[]; activities: object[]; notes: object[] } | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);

  // State sync
  const [syncStateStatus, setSyncStateStatus] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [syncStateError, setSyncStateError] = useState<string | null>(null);
  const [activeNow, setActiveNow] = useState("");
  const [newDecision, setNewDecision] = useState("");
  const [showStateEdit, setShowStateEdit] = useState(false);

  async function loadStats() {
    getPendingSyncs().then(setSyncQueue);
    setDbStats({ ais: await db.ais.count(), projects: await db.projects.count(), activities: await db.activities.count(), messages: await db.messages.count() });
  }
  useEffect(() => { loadStats(); }, []);

  async function handleSyncState() {
    setSyncStateStatus("syncing");
    setSyncStateError(null);
    try {
      const res = await fetch("/api/sync-state");
      if (!res.ok) throw new Error(await res.text());
      setSyncStateStatus("done");
      setTimeout(() => setSyncStateStatus("idle"), 3000);
    } catch (err) {
      setSyncStateError(String(err));
      setSyncStateStatus("error");
    }
  }

  async function handleUpdateState(e: React.FormEvent) {
    e.preventDefault();
    setSyncStateStatus("syncing");
    try {
      const body: Record<string, string> = {};
      if (activeNow.trim()) body.activeNow = activeNow.trim();
      if (newDecision.trim()) body.decisions = newDecision.trim();
      const res = await fetch("/api/sync-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      setActiveNow(""); setNewDecision(""); setShowStateEdit(false);
      setSyncStateStatus("done");
      setTimeout(() => setSyncStateStatus("idle"), 2000);
    } catch (err) {
      setSyncStateError(String(err));
      setSyncStateStatus("error");
    }
  }

  async function handleFetchSeed() {
    setSeedState("loading");
    setSeedError(null);
    try {
      const res = await fetch("/api/seed-workspace");
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSeedData(data);
      setSeedPreview(data.summary);
      setSeedState("preview");
    } catch (err) {
      setSeedError(String(err));
      setSeedState("error");
    }
  }

  async function handleConfirmSeed() {
    if (!seedData) return;
    setSeedState("importing");
    try {
      // Resolve ce/mx aiId to actual agent IDs
      const allAIs = await db.ais.toArray();
      const claudeAgent = allAIs.find((a) => a.provider === "claude");
      const mmAgent = allAIs.find((a) => a.provider === "minimax");

      // Import projects (skip if id already exists)
      for (const p of seedData.projects as { id: string }[]) {
        const exists = await db.projects.get(p.id);
        if (!exists) await db.projects.add(p as Parameters<typeof db.projects.add>[0]);
      }

      // Import notes (skip if id already exists)
      for (const n of seedData.notes as { id: string }[]) {
        const exists = await db.notes.get(n.id);
        if (!exists) await db.notes.add(n as Parameters<typeof db.notes.add>[0]);
      }

      // Import activities (skip if id already exists), resolving ce/mx
      for (const a of seedData.activities as { id: string; aiId: string }[]) {
        const exists = await db.activities.get(a.id);
        if (exists) continue;
        let aiId = a.aiId;
        if (aiId === "ce" && claudeAgent) aiId = claudeAgent.id;
        if (aiId === "mx" && mmAgent) aiId = mmAgent.id;
        await db.activities.add({ ...a, aiId } as Parameters<typeof db.activities.add>[0]);
      }

      setSeedState("done");
    } catch (err) {
      setSeedError(String(err));
      setSeedState("error");
    }
    loadStats();
  }

  async function handleClearSyncQueue() { await db.syncQueue.clear(); loadStats(); }

  async function handleClearAllData() {
    if (!confirm("Clear ALL local data? This cannot be undone.")) return;
    await Promise.all([db.ais.clear(), db.projects.clear(), db.activities.clear(), db.messages.clear(), db.syncQueue.clear()]);
    loadStats();
  }

  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[10%] right-[10%] w-[400px] h-[400px] rounded-full bg-slate-600/8 blur-[100px]" />
      </div>

      <div className="relative px-8 pt-8 pb-6">
        <h2 className="text-xl font-bold text-white">Settings</h2>
        <p className="text-slate-400 text-sm mt-0.5">Local storage & sync</p>
      </div>

      <div className="relative px-8 pb-8 space-y-4 max-w-2xl">

        {/* Current State Sync */}
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-5">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-violet-400" />
            <h3 className="text-white font-semibold text-sm">工作狀態檔</h3>
            <span className="text-xs text-slate-600 font-mono ml-1">~/workspace/current-state.md</span>
          </div>
          <p className="text-slate-500 text-xs mb-4">Claude 同 MiniMax 嘅共同記憶。開工前讀一次即可上手，無需重複解釋背景。</p>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleSyncState}
              disabled={syncStateStatus === "syncing"}
              className="h-8 px-3 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncStateStatus === "syncing" ? "animate-spin" : ""}`} />
              重新生成狀態檔
            </button>
            <button
              onClick={() => setShowStateEdit(!showStateEdit)}
              className="h-8 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 text-xs transition-colors"
            >
              快速更新
            </button>
            {syncStateStatus === "done" && (
              <span className="flex items-center gap-1 text-emerald-400 text-xs">
                <CheckCircle className="w-3.5 h-3.5" /> 已更新
              </span>
            )}
            {syncStateStatus === "error" && syncStateError && (
              <span className="text-red-400 text-xs">{syncStateError}</span>
            )}
          </div>

          {showStateEdit && (
            <form onSubmit={handleUpdateState} className="mt-4 space-y-3 border-t border-white/8 pt-4">
              <div>
                <label className="text-slate-400 text-xs font-medium mb-1.5 block">宜家做緊（覆寫 Active Now）</label>
                <textarea
                  value={activeNow}
                  onChange={(e) => setActiveNow(e.target.value)}
                  placeholder="e.g. - THYC bug 修復中（GF/LS 分類問題）"
                  rows={3}
                  className="w-full rounded-lg bg-white/5 border border-white/15 text-slate-200 placeholder:text-slate-600 px-3 py-2 text-sm outline-none focus:border-violet-500/50 transition-colors resize-none font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 text-xs font-medium mb-1.5 block">新決定（加到最近決定）</label>
                <input
                  value={newDecision}
                  onChange={(e) => setNewDecision(e.target.value)}
                  placeholder="e.g. 採用方案A做 backlinks 系統"
                  className="w-full h-9 rounded-lg bg-white/5 border border-white/15 text-slate-200 placeholder:text-slate-600 px-3 text-sm outline-none focus:border-violet-500/50 transition-colors"
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="h-8 px-4 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium transition-colors">
                  儲存更新
                </button>
                <button type="button" onClick={() => setShowStateEdit(false)} className="h-8 px-3 rounded-lg border border-white/10 text-slate-400 text-xs hover:text-white transition-colors">
                  取消
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Local DB */}
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-4 h-4 text-blue-400" />
            <h3 className="text-white font-semibold text-sm">Local Database</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[{ label: "AI Agents", value: dbStats.ais }, { label: "Projects", value: dbStats.projects }, { label: "Activities", value: dbStats.activities }, { label: "Messages", value: dbStats.messages }].map((s) => (
              <div key={s.label} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2.5">
                <span className="text-slate-400 text-xs">{s.label}</span>
                <span className="text-white font-medium text-sm">{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sync Queue */}
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Cloud className="w-4 h-4 text-green-400" />
            <h3 className="text-white font-semibold text-sm">Sync Queue</h3>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-slate-300 text-sm">{syncQueue.length} items pending</span>
          </div>
          <p className="text-slate-500 text-xs mb-3">Cloud sync disabled — all data stays local.</p>
          {syncQueue.length > 0 && (
            <button onClick={handleClearSyncQueue} className="h-7 px-3 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:border-white/20 text-xs transition-colors">Clear Queue</button>
          )}
        </div>

        {/* Cloud Config */}
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-slate-400" />
            <h3 className="text-white font-semibold text-sm">Cloud Sync (Optional)</h3>
          </div>
          <p className="text-slate-400 text-xs mb-3">Supabase credentials not configured.</p>
          <div className="bg-black/30 rounded-lg px-3 py-2 text-xs text-slate-500 font-mono">
            NEXT_PUBLIC_SUPABASE_URL=<br />NEXT_PUBLIC_SUPABASE_ANON_KEY=
          </div>
        </div>

        {/* Seed from Workspace */}
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Download className="w-4 h-4 text-emerald-400" />
            <h3 className="text-white font-semibold text-sm">從 Workspace 匯入</h3>
          </div>
          <p className="text-slate-400 text-xs mb-4">
            自動讀取 <span className="font-mono text-slate-300">~/workspace/profiles/</span> 同埋工作記錄，建立項目、活動記錄及筆記。重複執行唔會有重覆資料。
          </p>

          {seedState === "idle" && (
            <button onClick={handleFetchSeed} className="h-8 px-4 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs transition-colors flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" /> 預覽匯入資料
            </button>
          )}

          {seedState === "loading" && (
            <div className="flex items-center gap-2 text-slate-400 text-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> 讀取中...
            </div>
          )}

          {seedState === "preview" && seedPreview && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "項目", value: seedPreview.projects, color: "text-emerald-400" },
                  { label: "活動記錄", value: seedPreview.activities, color: "text-amber-400" },
                  { label: "筆記", value: seedPreview.notes, color: "text-blue-400" },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg bg-white/5 border border-white/8 p-2.5 text-center">
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={handleConfirmSeed} className="h-8 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5" /> 確認匯入
                </button>
                <button onClick={() => setSeedState("idle")} className="h-8 px-3 rounded-lg border border-white/10 text-slate-400 hover:text-white text-xs transition-colors">
                  取消
                </button>
              </div>
            </div>
          )}

          {seedState === "importing" && (
            <div className="flex items-center gap-2 text-slate-400 text-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> 匯入中...
            </div>
          )}

          {seedState === "done" && (
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400 text-xs">匯入完成！</span>
              <button onClick={() => setSeedState("idle")} className="ml-auto text-slate-600 hover:text-slate-400 text-xs transition-colors">重置</button>
            </div>
          )}

          {seedState === "error" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span className="text-red-400 text-xs">匯入失敗</span>
              </div>
              {seedError && <p className="text-slate-500 text-xs font-mono break-all">{seedError}</p>}
              <button onClick={() => setSeedState("idle")} className="h-7 px-3 rounded-lg border border-white/10 text-slate-400 hover:text-white text-xs transition-colors">重試</button>
            </div>
          )}
        </div>

        {/* Danger Zone */}
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
          <h3 className="text-red-400 font-semibold text-sm mb-3">Danger Zone</h3>
          <button onClick={handleClearAllData} className="h-8 px-3 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 text-xs transition-colors flex items-center gap-1.5">
            <Trash2 className="w-3.5 h-3.5" /> Clear All Local Data
          </button>
        </div>
      </div>
    </div>
  );
}
