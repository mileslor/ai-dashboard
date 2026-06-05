"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Play, CheckCircle2, XCircle, Clock, AlertTriangle, Zap, Activity } from "lucide-react";

interface CronState {
  nextRunAtMs?: number;
  lastRunAtMs?: number;
  lastRunStatus?: string;
  lastStatus?: string;
  consecutiveErrors?: number;
  lastError?: string;
  lastDurationMs?: number;
  runningAtMs?: number;
}

interface CronJob {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  schedule: { kind: string; expr?: string; everyMs?: number; tz?: string };
  state?: CronState;
  status?: string;
  failureAlert?: { after: number; channel: string; to: string };
  delivery?: { bestEffort?: boolean };
}

interface ChannelMsg {
  sender: "ce" | "mx" | "miles" | "system";
  timestamp: number;
  content: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relTime(ms?: number): string {
  if (!ms) return "—";
  const diff = Date.now() - ms;
  if (diff < 0) {
    const abs = Math.abs(diff);
    if (abs < 60000) return `${Math.round(abs / 1000)}s 後`;
    if (abs < 3600000) return `${Math.round(abs / 60000)}m 後`;
    const h = Math.floor(abs / 3600000);
    const m = Math.round((abs % 3600000) / 60000);
    return m > 0 ? `${h}h ${m}m 後` : `${h}h 後`;
  }
  if (diff < 60000) return `${Math.round(diff / 1000)}s 前`;
  if (diff < 3600000) return `${Math.round(diff / 60000)}m 前`;
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h 前`;
  return `${Math.round(diff / 86400000)}d 前`;
}

function scheduleLabel(s: CronJob["schedule"]): string {
  if (s.kind === "cron") return s.expr ?? "";
  if (s.kind === "every" && s.everyMs) {
    const m = Math.round(s.everyMs / 60000);
    return m >= 60 ? `每 ${Math.round(m / 60)}h` : `每 ${m}m`;
  }
  return s.kind;
}

function jobStatus(job: CronJob): "running" | "ok" | "error" | "disabled" {
  if (!job.enabled) return "disabled";
  if (job.status === "running" || job.state?.runningAtMs) return "running";
  const s = job.state?.lastStatus ?? job.state?.lastRunStatus;
  if (s === "error") return "error";
  return "ok";
}

const STATUS_STYLE = {
  running: { dot: "bg-blue-400 animate-pulse", badge: "text-blue-400 bg-blue-500/10 border-blue-500/25", label: "跑緊" },
  ok:      { dot: "bg-emerald-400",            badge: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25", label: "正常" },
  error:   { dot: "bg-red-400",                badge: "text-red-400 bg-red-500/10 border-red-500/25", label: "錯誤" },
  disabled:{ dot: "bg-slate-600",              badge: "text-slate-500 bg-slate-500/10 border-slate-500/25", label: "停用" },
};

// ─── Parse channel.md preview ────────────────────────────────────────────────

function parseChannelPreview(raw: string): ChannelMsg[] {
  const re = /^\[(ce|mx|Miles|miles)\s+(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?\]:\s*(.*)/im;
  const msgs: ChannelMsg[] = [];
  let cur: ChannelMsg | null = null;

  for (const line of raw.split("\n")) {
    const m = line.match(re);
    if (m) {
      if (cur) msgs.push({ ...cur, content: cur.content.trimEnd() });
      const sender = m[1].toLowerCase() as ChannelMsg["sender"];
      const ts = m[3]
        ? new Date(`${m[2]}T${m[3]}:00`).getTime()
        : new Date(m[2]).getTime();
      cur = { sender, timestamp: ts, content: m[4] };
    } else if (cur && line.trim()) {
      cur.content += "\n" + line;
    }
  }
  if (cur) msgs.push({ ...cur, content: cur.content.trimEnd() });
  return msgs.slice(-15).reverse();
}

const SENDER_META = {
  ce:    { label: "ce", color: "text-sky-400",    dot: "bg-sky-500" },
  mx:    { label: "mx", color: "text-violet-400", dot: "bg-violet-500" },
  miles: { label: "Miles", color: "text-slate-300", dot: "bg-slate-400" },
  system:{ label: "sys", color: "text-slate-600",  dot: "bg-slate-700" },
};

// ─── Job card ────────────────────────────────────────────────────────────────

function JobCard({ job, onRun }: { job: CronJob; onRun: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [running, setRunning] = useState(false);
  const st = jobStatus(job);
  const style = STATUS_STYLE[st];
  const errs = job.state?.consecutiveErrors ?? 0;

  async function handleRun() {
    setRunning(true);
    await fetch("/api/openclaw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "run", id: job.id }),
    });
    setTimeout(() => { setRunning(false); onRun(job.id); }, 2000);
  }

  return (
    <div className={`rounded-xl border bg-white/3 transition-colors ${
      st === "error" ? "border-red-500/20 hover:border-red-500/30" :
      st === "running" ? "border-blue-500/20" :
      "border-white/6 hover:border-white/10"
    }`}>
      <div
        className="px-3.5 py-2.5 flex items-center gap-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-medium truncate ${job.enabled ? "text-slate-200" : "text-slate-600"}`}>
              {job.name}
            </p>
            {errs > 0 && (
              <span className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full flex-shrink-0">
                ×{errs}
              </span>
            )}
            {job.failureAlert && (
              <span className="text-xs text-amber-500/60 flex-shrink-0" title="Failure alert on">🔔</span>
            )}
          </div>
          <p className="text-xs text-slate-600 font-mono mt-0.5">{scheduleLabel(job.schedule)}</p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-slate-600">
              {st === "running" ? "跑緊…" : `上次 ${relTime(job.state?.lastRunAtMs)}`}
            </p>
            <p className="text-xs text-slate-700">
              下次 {relTime(job.state?.nextRunAtMs)}
            </p>
          </div>

          <span className={`text-xs px-2 py-0.5 rounded-full border ${style.badge}`}>
            {style.label}
          </span>

          {job.enabled && st !== "running" && (
            <button
              onClick={(e) => { e.stopPropagation(); handleRun(); }}
              disabled={running}
              className="p-1.5 rounded-lg border border-white/8 hover:bg-white/8 hover:border-white/15 text-slate-500 hover:text-slate-300 transition-colors"
              title="立即執行"
            >
              {running ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-3.5 pb-3 border-t border-white/5 pt-2.5 space-y-1.5">
          {job.description && (
            <p className="text-xs text-slate-500">{job.description}</p>
          )}
          {job.state?.lastError && (
            <div className="rounded-lg bg-red-500/8 border border-red-500/15 px-3 py-2">
              <p className="text-xs text-red-400 font-mono break-all">{job.state.lastError}</p>
            </div>
          )}
          <div className="flex gap-3 text-xs text-slate-600">
            {job.state?.lastDurationMs && (
              <span>耗時 {(job.state.lastDurationMs / 1000).toFixed(1)}s</span>
            )}
            {job.delivery?.bestEffort && <span className="text-emerald-600">bestEffort ✓</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AutomationPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [gatewayOk, setGatewayOk] = useState<boolean | null>(null);
  const [channelMsgs, setChannelMsgs] = useState<ChannelMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(0);
  const [filter, setFilter] = useState<"all" | "error" | "running">("all");

  const loadJobs = useCallback(async () => {
    const res = await fetch("/api/openclaw");
    const data = await res.json();
    setGatewayOk(data.ok);
    setJobs(data.jobs ?? []);
    setLastRefresh(Date.now());
  }, []);

  const loadChannel = useCallback(async () => {
    const res = await fetch("/api/channel");
    if (res.ok) {
      const raw = await res.text();
      setChannelMsgs(parseChannelPreview(raw));
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadJobs(), loadChannel()]);
    setLoading(false);
  }, [loadJobs, loadChannel]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30s
  useEffect(() => {
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const filtered = jobs.filter((j) => {
    if (filter === "error") return jobStatus(j) === "error";
    if (filter === "running") return jobStatus(j) === "running";
    return true;
  });

  const errorCount = jobs.filter((j) => jobStatus(j) === "error").length;
  const runningCount = jobs.filter((j) => jobStatus(j) === "running").length;
  const okCount = jobs.filter((j) => jobStatus(j) === "ok").length;

  return (
    <div className="min-h-screen bg-[#0d1117] text-slate-100">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-100">⚙️ 自動化</h1>
            <p className="text-xs text-slate-600 mt-0.5">
              {lastRefresh > 0 ? `更新 ${relTime(lastRefresh)}` : "載入中…"}
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-lg border border-white/8 hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Gateway + stats */}
        <div className="grid grid-cols-4 gap-2">
          <div className={`rounded-xl border px-3 py-2.5 ${
            gatewayOk === null ? "border-white/6 bg-white/3" :
            gatewayOk ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"
          }`}>
            <p className="text-xs text-slate-600">Gateway</p>
            <p className={`text-sm font-semibold mt-0.5 ${
              gatewayOk === null ? "text-slate-500" : gatewayOk ? "text-emerald-400" : "text-red-400"
            }`}>
              {gatewayOk === null ? "…" : gatewayOk ? "在線 ✓" : "離線 ✗"}
            </p>
          </div>
          {[
            { label: "正常", count: okCount, color: "text-emerald-400" },
            { label: "跑緊", count: runningCount, color: "text-blue-400" },
            { label: "錯誤", count: errorCount, color: "text-red-400" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-white/6 bg-white/3 px-3 py-2.5">
              <p className="text-xs text-slate-600">{s.label}</p>
              <p className={`text-lg font-bold mt-0.5 ${s.color}`}>{s.count}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5">
          {(["all", "error", "running"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                filter === f
                  ? "bg-white/10 border-white/15 text-slate-200"
                  : "border-white/6 text-slate-500 hover:text-slate-300 hover:border-white/10"
              }`}
            >
              {f === "all" ? `全部 (${jobs.length})` : f === "error" ? `錯誤 (${errorCount})` : `跑緊 (${runningCount})`}
            </button>
          ))}
        </div>

        {/* Jobs list */}
        <div className="space-y-1.5">
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-600 text-center py-8">
              {loading ? "載入中…" : "冇符合條件嘅 job"}
            </p>
          ) : (
            filtered.map((job) => (
              <JobCard key={job.id} job={job} onRun={loadJobs} />
            ))
          )}
        </div>

        {/* Channel feed */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-3.5 h-3.5 text-slate-600" />
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest">Channel 最新</p>
          </div>
          <div className="space-y-1.5">
            {channelMsgs.length === 0 ? (
              <p className="text-xs text-slate-700 py-4 text-center">暫無記錄</p>
            ) : channelMsgs.map((msg, i) => {
              const meta = SENDER_META[msg.sender] ?? SENDER_META.system;
              const isTask = msg.content.includes("→ ce 請") || msg.content.includes("→ mx 請");
              const isDone = msg.content.startsWith("✅");
              const isWarn = msg.content.startsWith("⚠️");
              return (
                <div
                  key={i}
                  className={`rounded-lg border px-3 py-2 ${
                    isWarn ? "border-amber-500/20 bg-amber-500/5" :
                    isTask ? "border-violet-500/15 bg-violet-500/5" :
                    isDone ? "border-emerald-500/15 bg-emerald-500/5" :
                    "border-white/5 bg-white/2"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                    <span className={`text-xs font-mono font-semibold ${meta.color}`}>{meta.label}</span>
                    <span className="text-xs text-slate-700">{relTime(msg.timestamp)}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{msg.content}</p>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
