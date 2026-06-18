"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { RefreshCw, ChevronRight, Inbox, Send, CheckCircle2, Clock, Loader2 } from "lucide-react";

interface ChoiceOption { label: string; text: string; }

interface DecisionItem {
  id: string;
  type: "choice" | "unresolved_task" | "warning" | "pending" | "cron_failure";
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  timestamp?: number;
  source: "channel" | "state";
  options?: ChoiceOption[];
  milesReply?: string;
  latestAiActivity?: string;
  isResolved?: boolean;
}

function relTime(ms?: number): string {
  if (!ms) return "";
  const diff = Date.now() - ms;
  if (diff < 60000) return "剛才";
  if (diff < 3600000) return `${Math.round(diff / 60000)}m 前`;
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h 前`;
  return `${Math.round(diff / 86400000)}d 前`;
}

const TYPE_META = {
  choice:          { label: "等你決定",   icon: "🎯", color: "text-emerald-400", border: "border-emerald-500/30", bg: "bg-emerald-500/8" },
  warning:         { label: "Ce 警告",   icon: "⚠️", color: "text-amber-400",   border: "border-amber-500/25",  bg: "bg-amber-500/5" },
  unresolved_task: { label: "未完成任務", icon: "📋", color: "text-violet-400",  border: "border-violet-500/20", bg: "bg-violet-500/5" },
  pending:         { label: "待處理",    icon: "⏳", color: "text-slate-400",    border: "border-white/8",       bg: "bg-white/3" },
  cron_failure:    { label: "自動化失敗", icon: "🔴", color: "text-red-400",     border: "border-red-500/25",    bg: "bg-red-500/5" },
};

const SECTION_ORDER: DecisionItem["type"][] = ["choice", "warning", "unresolved_task", "cron_failure", "pending"];
const SECTION_TITLES: Record<DecisionItem["type"], string> = {
  choice:          "🎯 等你決定",
  warning:         "⚠️ Ce 警告",
  unresolved_task: "📋 未完成任務",
  cron_failure:    "🔴 自動化失敗",
  pending:         "⏳ 待你處理",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayStamp() {
  const d = new Date();
  return `${d.toISOString().slice(0, 10)} ${d.toTimeString().slice(0, 5)}`;
}

async function postToChannel(text: string) {
  await fetch("/api/channel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: `\n[Miles ${todayStamp()}]: ${text}`, append: true }),
  });
}

// ─── AnsweredChoiceCard — shows progress after a decision ────────────────────

function AnsweredChoiceCard({ item, myReply }: { item: DecisionItem; myReply: string }) {
  const [expanded, setExpanded] = useState(false);
  const reply = item.milesReply ?? myReply;
  const aiActivity = item.latestAiActivity;
  const resolved = item.isResolved;

  return (
    <div className="rounded-xl border border-white/8 bg-white/3 transition-all">
      <div className="px-3.5 py-2.5 flex items-start gap-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex-shrink-0 mt-0.5">
          {resolved
            ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            : aiActivity
              ? <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
              : <Clock className="w-4 h-4 text-slate-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-400 truncate">{item.title}</p>
          <p className="text-xs text-slate-600 mt-0.5 truncate">
            你: {reply.slice(0, 60)}
          </p>
          {aiActivity && (
            <p className={`text-xs mt-0.5 truncate ${resolved ? "text-emerald-600" : "text-blue-500/80"}`}>
              AI: {aiActivity}
            </p>
          )}
          {!aiActivity && (
            <p className="text-xs text-slate-700 mt-0.5">等待 AI 回應中…</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {item.timestamp && <span className="text-xs text-slate-700">{relTime(item.timestamp)}</span>}
          <ChevronRight className={`w-3.5 h-3.5 text-slate-700 transition-transform ${expanded ? "rotate-90" : ""}`} />
        </div>
      </div>

      {expanded && (
        <div className="px-3.5 pb-3 border-t border-white/5 pt-2.5 space-y-2">
          <div className="space-y-1.5">
            <p className="text-xs text-slate-600 font-medium">原問題</p>
            <p className="text-xs text-slate-500 leading-relaxed whitespace-pre-wrap break-words">{item.detail}</p>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-slate-600 font-medium">你嘅決定</p>
            <p className="text-xs text-slate-300 bg-white/5 rounded-lg px-2.5 py-1.5">{reply}</p>
          </div>
          {aiActivity && (
            <div className="space-y-1.5">
              <p className="text-xs text-slate-600 font-medium">AI 最新動態</p>
              <p className={`text-xs leading-relaxed rounded-lg px-2.5 py-1.5 ${resolved ? "text-emerald-400 bg-emerald-500/8" : "text-blue-300 bg-blue-500/8"}`}>
                {aiActivity}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ChoiceCard — pending decision ───────────────────────────────────────────

function ChoiceCard({ item, onAnswered }: { item: DecisionItem; onAnswered: (id: string, reply: string) => void }) {
  const [otherText, setOtherText] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function choose(text: string) {
    if (!text.trim()) return;
    setLoading(true);
    try {
      await postToChannel(text.trim());
      onAnswered(item.id, text.trim());
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`rounded-xl border border-emerald-500/30 bg-emerald-500/8 transition-all ${loading ? "opacity-60" : ""}`}>
      <div className="px-3.5 pt-3 pb-1">
        <div className="flex items-start gap-2 mb-2">
          <span className="text-base leading-none mt-0.5 flex-shrink-0">🎯</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-300">{item.title}</p>
            {item.timestamp && <p className="text-xs text-slate-600 mt-0.5">{relTime(item.timestamp)}</p>}
          </div>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed whitespace-pre-wrap break-words mb-3 pl-6">
          {item.detail}
        </p>
      </div>

      <div className="px-3.5 pb-3 space-y-2.5">
        <div className="flex flex-wrap gap-2">
          {(item.options ?? []).map((opt) => (
            <button
              key={opt.label}
              disabled={loading}
              onClick={() => choose(`${opt.label}. ${opt.text}`)}
              className="flex items-start gap-2 px-3 py-2 rounded-xl border border-emerald-500/25 bg-black/20 hover:bg-emerald-500/15 hover:border-emerald-500/40 transition-colors text-left disabled:opacity-40 max-w-full"
            >
              <span className="text-xs font-bold text-emerald-400 flex-shrink-0 mt-0.5 w-4">{opt.label}</span>
              <span className="text-xs text-slate-300 leading-relaxed">{opt.text}</span>
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") choose(otherText); }}
            placeholder="Other — 自行輸入..."
            disabled={loading}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:border-emerald-500/40 transition-colors disabled:opacity-40"
          />
          <button
            disabled={loading || !otherText.trim()}
            onClick={() => choose(otherText)}
            className="w-7 h-7 rounded-lg bg-emerald-600/60 hover:bg-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0 transition-colors"
          >
            <Send className="w-3 h-3 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Action buttons per type ─────────────────────────────────────────────────

async function actionMarkDone(item: DecisionItem) {
  if (item.source === "state") {
    await fetch("/api/sync-state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pendingRemove: item.detail }) });
  } else {
    const ts = new Date().toLocaleString("sv").replace(" ", " ").slice(0, 16);
    await fetch("/api/channel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: `\n[ce ${ts}]: ✅ 已確認處理：${item.title.slice(0, 60)} (manual-decision)`, append: true }) });
  }
}

async function actionRetrigger(item: DecisionItem) {
  const ts = new Date().toLocaleString("sv").replace(" ", " ").slice(0, 16);
  await fetch("/api/channel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: `\n[Miles ${ts}]: 🔄 請重新處理：${item.title.slice(0, 60)}`, append: true }) });
}

// ─── ItemCard ─────────────────────────────────────────────────────────────────

function ItemCard({ item, onAction }: { item: DecisionItem; onAction: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const meta = TYPE_META[item.type];

  async function handle(fn: () => Promise<void>) {
    setLoading(true);
    try { await fn(); await new Promise((r) => setTimeout(r, 300)); onAction(); }
    finally { setLoading(false); }
  }

  const actions = (() => {
    switch (item.type) {
      case "pending":         return [{ label: "完成 ✓",  style: "bg-emerald-500/15 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/25", fn: () => actionMarkDone(item) }];
      case "unresolved_task": return [{ label: "標記完成", style: "bg-emerald-500/15 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/25", fn: () => actionMarkDone(item) }, { label: "重新觸發", style: "bg-blue-500/15 border-blue-500/25 text-blue-400 hover:bg-blue-500/25", fn: () => actionRetrigger(item) }];
      case "warning":         return [{ label: "已知悉",  style: "bg-amber-500/15 border-amber-500/25 text-amber-400 hover:bg-amber-500/25", fn: () => actionMarkDone(item) }, { label: "重新觸發", style: "bg-blue-500/15 border-blue-500/25 text-blue-400 hover:bg-blue-500/25", fn: () => actionRetrigger(item) }];
      default:                return [{ label: "已知悉",  style: "bg-slate-500/15 border-slate-500/25 text-slate-400 hover:bg-slate-500/25", fn: () => actionMarkDone(item) }];
    }
  })();

  return (
    <div className={`rounded-xl border ${meta.border} ${meta.bg} transition-all ${loading ? "opacity-50" : ""}`}>
      <div className="px-3.5 py-2.5 flex items-start gap-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <span className="text-base leading-none mt-0.5 flex-shrink-0">{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${meta.color}`}>{item.title}</p>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{item.detail}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {item.timestamp && <span className="text-xs text-slate-700">{relTime(item.timestamp)}</span>}
          <ChevronRight className={`w-3.5 h-3.5 text-slate-600 transition-transform ${expanded ? "rotate-90" : ""}`} />
        </div>
      </div>
      {expanded && (
        <div className="px-3.5 pb-3 border-t border-white/5 pt-2.5 space-y-3">
          <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap break-words">{item.detail}</p>
          <p className="text-xs text-slate-700">來源：{item.source === "channel" ? "channel.md" : "current-state.md"}</p>
          <div className="flex gap-2 flex-wrap">
            {actions.map((a) => (
              <button key={a.label} disabled={loading} onClick={(e) => { e.stopPropagation(); handle(a.fn); }} className={`text-xs px-3 py-1.5 rounded-lg border transition-colors font-medium ${a.style} disabled:opacity-40`}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type SeverityFilter = "all" | "high" | "medium";

const SEVERITY_CHIPS: { value: SeverityFilter; label: string }[] = [
  { value: "all",    label: "全部" },
  { value: "high",   label: "⚠️ 高優先" },
  { value: "medium", label: "📌 中優先" },
];

function matchSeverity(sev: DecisionItem["severity"], filter: SeverityFilter) {
  if (filter === "all") return true;
  if (filter === "high") return sev === "high";
  return sev === "high" || sev === "medium";
}

export default function DecisionsPage() {
  const [items, setItems] = useState<DecisionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(0);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  // id → reply text for choices answered in this session
  const [localAnswers, setLocalAnswers] = useState<Map<string, string>>(new Map());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/decisions");
      if (res.ok) setItems((await res.json()).items ?? []);
    } finally {
      setLoading(false);
      setLastRefresh(Date.now());
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  // Auto-refresh every 15s to pick up AI progress
  useEffect(() => {
    const t = setInterval(() => load(), 15000);
    return () => clearInterval(t);
  }, [load]);

  function handleAnswered(id: string, reply: string) {
    setLocalAnswers((prev) => new Map([...prev, [id, reply]]));
  }

  const choices = items.filter((i) => i.type === "choice" && matchSeverity(i.severity, severityFilter));
  // Pending: no milesReply from API AND not answered locally
  const pendingChoices = choices.filter((i) => !i.milesReply && !localAnswers.has(i.id));
  // Answered: has milesReply from API OR answered locally this session
  const answeredChoices = choices.filter((i) => i.milesReply || localAnswers.has(i.id));

  const otherItems = items.filter((i) => i.type !== "choice" && matchSeverity(i.severity, severityFilter));
  const grouped = SECTION_ORDER.filter((t) => t !== "choice").reduce<Record<string, DecisionItem[]>>((acc, type) => {
    acc[type] = otherItems.filter((i) => i.type === type);
    return acc;
  }, {} as Record<string, DecisionItem[]>);

  const totalPending = pendingChoices.length + otherItems.filter((i) => i.severity !== "low").length;

  return (
    <div className="min-h-screen bg-[#0d1117] text-slate-100">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-100">🎯 決策中心</h1>
            <p className="text-xs text-slate-600 mt-0.5">
              {lastRefresh > 0
                ? `${totalPending === 0 ? "冇待處理事項 ✓" : `${totalPending} 項需要關注`} · ${new Date(lastRefresh).toLocaleTimeString("zh-HK", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
                : "載入中…"}
            </p>
          </div>
          <button onClick={load} disabled={loading} className="p-2 rounded-lg border border-white/8 hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Severity filter chips */}
        <div className="flex gap-2">
          {SEVERITY_CHIPS.map((chip) => (
            <button
              key={chip.value}
              onClick={() => setSeverityFilter(chip.value)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors font-medium ${
                severityFilter === chip.value
                  ? "bg-slate-500/25 border-slate-400/40 text-slate-200"
                  : "border-white/8 text-slate-600 hover:text-slate-400 hover:border-white/15"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Pending choices */}
        {pendingChoices.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest">🎯 等你決定 · {pendingChoices.length}</p>
            <div className="space-y-2">
              {pendingChoices.map((item) => (
                <ChoiceCard key={item.id} item={item} onAnswered={handleAnswered} />
              ))}
            </div>
          </div>
        )}

        {/* Other sections */}
        {SECTION_ORDER.filter((t) => t !== "choice").map((type) => {
          const sectionItems = grouped[type] ?? [];
          if (sectionItems.length === 0) return null;
          return (
            <div key={type} className="space-y-2">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest">{SECTION_TITLES[type]} · {sectionItems.length}</p>
              <div className="space-y-1.5">
                {sectionItems.map((item) => <ItemCard key={item.id} item={item} onAction={load} />)}
              </div>
            </div>
          );
        })}

        {/* Empty */}
        {!loading && pendingChoices.length === 0 && otherItems.length === 0 && answeredChoices.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <Inbox className="w-10 h-10 text-slate-700" />
            <p className="text-slate-500 text-sm">冇待處理事項</p>
          </div>
        )}

        {/* Answered choices — progress tracking */}
        {answeredChoices.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700 uppercase tracking-widest">✓ 已決定 · {answeredChoices.length}</p>
            <div className="space-y-1.5">
              {answeredChoices.map((item) => (
                <AnsweredChoiceCard
                  key={item.id}
                  item={item}
                  myReply={localAnswers.get(item.id) ?? item.milesReply ?? ""}
                />
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
