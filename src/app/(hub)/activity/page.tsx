"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, X, Zap as ActivityIcon, Clock, FolderKanban, RefreshCw, Search } from "lucide-react";

interface ActivityEntry {
  id: string;
  aiId: string;
  projectId: string | null;
  action: string;
  details: string;
  timestamp: number;
  source: string;
}

const AI_LABELS: Record<string, { name: string; color: string }> = {
  ce:   { name: "Claude",   color: "text-violet-400" },
  mx:   { name: "MiniMax",  color: "text-blue-400" },
  user: { name: "User",     color: "text-slate-400" },
};

const PROJECT_COLORS: Record<string, string> = {
  "seed-thyc_system":      "#22c55e",
  "seed-ai-dashboard":     "#8b5cf6",
  "seed-karaqueue":        "#a855f7",
  "seed-pilot":            "#3b82f6",
  "seed-visapath":         "#f59e0b",
  "seed-token-monitor":    "#06b6d4",
  "seed-milestone":        "#0ea5e9",
  "seed-youtube-lofi":     "#6366f1",
  "seed-nintendo-research":"#ef4444",
};

const PROJECT_NAMES: Record<string, string> = {
  "seed-thyc_system":      "THYC CRM",
  "seed-ai-dashboard":     "AI Dashboard",
  "seed-karaqueue":        "KaraQueue",
  "seed-pilot":            "PilotLog",
  "seed-visapath":         "VisaPath",
  "seed-token-monitor":    "Token Monitor",
  "seed-milestone":        "Milestone 網站",
  "seed-youtube-lofi":     "YouTube Lo-Fi",
  "seed-nintendo-research":"Nintendo 研究",
};

export default function ActivityPage() {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProject, setFilterProject] = useState("");
  const [filterAi, setFilterAi] = useState("");
  const [filterTime, setFilterTime] = useState<"" | "today" | "week">("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newAction, setNewAction] = useState("");
  const [newDetails, setNewDetails] = useState("");
  const [newAiId, setNewAiId] = useState("ce");
  const [newProjectId, setNewProjectId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/activities");
      if (res.ok) {
        const data = await res.json() as { activities: ActivityEntry[] };
        setActivities(data.activities ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => load(), 30000);
    return () => clearInterval(t);
  }, [load]);

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay()); weekStart.setHours(0, 0, 0, 0);

  const displayed = [...activities]
    .filter((a) => !filterProject || a.projectId === filterProject)
    .filter((a) => !filterAi || a.aiId === filterAi)
    .filter((a) => {
      if (filterTime === "today") return a.timestamp >= todayStart.getTime();
      if (filterTime === "week") return a.timestamp >= weekStart.getTime();
      return true;
    })
    .filter((a) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return a.action.toLowerCase().includes(q) || (a.details ?? "").toLowerCase().includes(q);
    })
    .reverse();

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newAction.trim() || saving) return;
    setSaving(true);
    try {
      await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: newAction.trim(), aiId: newAiId, projectId: newProjectId || undefined, details: newDetails.trim() || undefined }),
      });
      setNewAction(""); setNewDetails(""); setNewAiId("ce"); setNewProjectId("");
      setShowAdd(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  function formatTime(ts: number) {
    return new Date(ts).toLocaleString("en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function relTime(ts: number): string {
    const diff = Date.now() - ts;
    if (diff < 60000) return "剛才";
    if (diff < 3600000) return `${Math.round(diff / 60000)}m 前`;
    if (diff < 86400000) return `${Math.round(diff / 3600000)}h 前`;
    return `${Math.round(diff / 86400000)}d 前`;
  }

  const usedProjects = [...new Set(activities.map((a) => a.projectId).filter(Boolean))] as string[];
  const usedAis = [...new Set(activities.map((a) => a.aiId))];

  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[10%] right-[10%] w-[400px] h-[400px] rounded-full bg-amber-600/8 blur-[100px]" />
      </div>

      <div className="relative px-8 pt-8 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xl font-bold text-white">Activity Feed</h2>
            <p className="text-slate-400 text-sm mt-0.5">{displayed.length} / {activities.length} 條記錄 · live</p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} disabled={loading}
              className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors disabled:opacity-40">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={() => setShowAdd(true)} className="h-8 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium flex items-center gap-1.5 transition-colors">
              <Plus className="w-4 h-4" /> Log
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 pointer-events-none" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜尋活動..."
            className="w-full max-w-xs h-8 bg-white/5 border border-white/10 rounded-lg pl-8 pr-8 text-sm text-slate-300 placeholder:text-slate-600 outline-none focus:border-amber-500/40 transition-colors"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Project filter */}
        <div className="flex gap-1.5 flex-wrap mb-2">
          <button onClick={() => setFilterProject("")}
            className={`h-6 px-2.5 rounded-full text-xs transition-colors border ${!filterProject ? "bg-amber-600/30 text-amber-300 border-amber-500/40" : "bg-white/5 text-slate-500 border-white/10 hover:text-slate-300"}`}>
            全部項目
          </button>
          {usedProjects.map((pid) => {
            const color = PROJECT_COLORS[pid] ?? "#888";
            const name = PROJECT_NAMES[pid] ?? pid;
            const active = filterProject === pid;
            return (
              <button key={pid} onClick={() => setFilterProject(active ? "" : pid)}
                className="h-6 px-2.5 rounded-full text-xs transition-colors border"
                style={active ? { backgroundColor: `${color}30`, borderColor: `${color}60`, color } : { backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)", color: "#64748b" }}>
                {name}
              </button>
            );
          })}
        </div>

        {/* AI filter */}
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setFilterAi("")}
            className={`h-5 px-2 rounded-full text-xs transition-colors border ${!filterAi ? "bg-white/10 text-white border-white/20" : "bg-white/3 text-slate-600 border-white/8 hover:text-slate-400"}`}>
            全部 AI
          </button>
          {usedAis.map((id) => {
            const label = AI_LABELS[id] ?? { name: id, color: "text-slate-400" };
            const active = filterAi === id;
            return (
              <button key={id} onClick={() => setFilterAi(active ? "" : id)}
                className={`h-5 px-2 rounded-full text-xs transition-colors border ${active ? "bg-white/10 border-white/20" : "bg-white/3 border-white/8 hover:text-slate-400 text-slate-600"}`}>
                <span className={active ? label.color : ""}>{label.name}</span>
              </button>
            );
          })}
        </div>

        {/* Time filter */}
        <div className="flex gap-1.5 flex-wrap mt-2">
          {(["", "today", "week"] as const).map((val) => {
            const label = val === "" ? "全部時間" : val === "today" ? "今日" : "本週";
            return (
              <button key={val} onClick={() => setFilterTime(val)}
                className={`h-5 px-2 rounded-full text-xs transition-colors border ${filterTime === val ? "bg-white/10 text-white border-white/20" : "bg-white/3 text-slate-600 border-white/8 hover:text-slate-400"}`}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative px-8 pb-8 space-y-2 max-w-2xl">
        {loading && activities.length === 0 && (
          <div className="text-center py-20">
            <RefreshCw className="w-8 h-8 text-slate-600 mx-auto mb-3 animate-spin" />
          </div>
        )}
        {!loading && displayed.length === 0 && (
          <div className="text-center py-20">
            <ActivityIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500">暫無記錄</p>
          </div>
        )}

        {displayed.map((activity) => {
          const label = AI_LABELS[activity.aiId] ?? { name: activity.aiId, color: "text-slate-400" };
          const showAi = activity.aiId !== "user";
          const color = activity.projectId ? (PROJECT_COLORS[activity.projectId] ?? "#888") : null;
          const projName = activity.projectId ? (PROJECT_NAMES[activity.projectId] ?? activity.projectId) : null;

          return (
            <div key={activity.id} className="rounded-xl border border-white/8 bg-white/4 p-3 flex items-start gap-3 hover:border-white/16 transition-colors">
              {showAi && (
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold ${activity.aiId === "ce" ? "bg-violet-500/20 text-violet-300" : activity.aiId === "mx" ? "bg-blue-500/20 text-blue-300" : "bg-white/10 text-slate-400"}`}>
                  {activity.aiId === "ce" ? "C" : activity.aiId === "mx" ? "M" : activity.aiId.slice(0, 1).toUpperCase()}
                </div>
              )}
              {!showAi && (
                <div className="w-7 h-7 rounded-full bg-white/8 flex items-center justify-center flex-shrink-0 mt-0.5 text-xs text-slate-500">U</div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm leading-snug">{activity.action}</p>
                {activity.details && activity.details !== "conversation-log.md" && (
                  <p className="text-slate-500 text-xs mt-0.5 truncate">{activity.details}</p>
                )}
                <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-600 flex-wrap">
                  <Clock className="w-3 h-3" />
                  <span title={formatTime(activity.timestamp)}>{relTime(activity.timestamp)}</span>
                  {showAi && <span className={label.color}>· {label.name}</span>}
                  {projName && color && (
                    <span className="flex items-center gap-1" style={{ color }}>
                      <FolderKanban className="w-3 h-3" /> {projName}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-800/90 backdrop-blur-xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-semibold">記錄活動</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="text-slate-300 text-xs font-medium mb-1.5 block">內容</label>
                <input value={newAction} onChange={(e) => setNewAction(e.target.value)}
                  placeholder="做咗乜嘢..." required
                  className="w-full h-10 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-slate-500 px-3 text-sm outline-none focus:border-amber-500/50 transition-colors" />
              </div>
              <div>
                <label className="text-slate-300 text-xs font-medium mb-1.5 block">備註（選填）</label>
                <input value={newDetails} onChange={(e) => setNewDetails(e.target.value)}
                  placeholder="來源檔案、補充說明..."
                  className="w-full h-10 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-slate-500 px-3 text-sm outline-none focus:border-amber-500/50 transition-colors" />
              </div>
              <div>
                <label className="text-slate-300 text-xs font-medium mb-1.5 block">AI</label>
                <select value={newAiId} onChange={(e) => setNewAiId(e.target.value)}
                  className="w-full h-10 rounded-lg bg-white/10 border border-white/20 text-white text-sm px-3 outline-none focus:border-amber-500/50 transition-colors">
                  <option value="ce">Claude (ce)</option>
                  <option value="mx">MiniMax (mx)</option>
                  <option value="user">User</option>
                </select>
              </div>
              <div>
                <label className="text-slate-300 text-xs font-medium mb-1.5 block">項目（選填）</label>
                <select value={newProjectId} onChange={(e) => setNewProjectId(e.target.value)}
                  className="w-full h-10 rounded-lg bg-white/10 border border-white/20 text-white text-sm px-3 outline-none focus:border-amber-500/50 transition-colors">
                  <option value="">無</option>
                  {Object.entries(PROJECT_NAMES).map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </select>
              </div>
              <button type="submit" disabled={saving}
                className="w-full h-10 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:opacity-90 text-white text-sm font-medium transition-opacity disabled:opacity-60">
                {saving ? "儲存中..." : "記錄"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
