"use client";

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";

export default function TokensPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<"ok" | "error" | null>(null);

  async function openTokenMonitor() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/focus-token-monitor", { method: "POST" });
      const data = await res.json();
      setResult(data.ok ? "ok" : "error");
    } catch {
      setResult("error");
    } finally {
      setLoading(false);
      setTimeout(() => setResult(null), 2000);
    }
  }

  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-sm">

        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-cyan-500/30 to-blue-600/30 border border-cyan-500/20 flex items-center justify-center text-4xl shadow-lg shadow-cyan-500/10">
            🔋
          </div>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-xl font-semibold text-white">Token Monitor</h1>
          <p className="text-sm text-slate-500 mt-1">Claude + MiniMax 用量追蹤</p>
        </div>

        {/* Description */}
        <p className="text-sm text-slate-600 leading-relaxed">
          Token 用量由獨立嘅 <span className="text-cyan-400 font-medium">Token Monitor</span> 負責追蹤，
          有更精確嘅圖表同實時數據。
        </p>

        {/* Launch button */}
        <button
          onClick={openTokenMonitor}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-cyan-500/15 border border-cyan-500/25 text-cyan-300 hover:bg-cyan-500/25 hover:border-cyan-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ExternalLink className="w-4 h-4" />
          )}
          {loading ? "開緊…" : "開啟 Token Monitor"}
        </button>

        {result === "ok" && (
          <p className="text-xs text-emerald-500">✓ 已切換到 Token Monitor</p>
        )}
        {result === "error" && (
          <p className="text-xs text-red-400">未能開啟，請點擊 Tray 圖示</p>
        )}

        <p className="text-xs text-slate-700">
          或者直接點頂部 menubar 嘅 Token Monitor 圖示
        </p>

      </div>
    </div>
  );
}
