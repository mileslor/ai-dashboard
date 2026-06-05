"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, AlertTriangle, Clock, CheckSquare, ChevronRight, Inbox } from "lucide-react";

interface DecisionItem {
  id: string;
  type: "unresolved_task" | "warning" | "pending" | "cron_failure";
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  timestamp?: number;
  source: "channel" | "state";
}

function relTime(ms?: number): string {
  if (!ms) return "";
  const diff = Date.now() - ms;
  if (diff < 3600000) return `${Math.round(diff / 60000)}m 前`;
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h 前`;
  return `${Math.round(diff / 86400000)}d 前`;
}

const TYPE_META: Record<DecisionItem["type"], { label: string; icon: string; color: string; border: string; bg: string }> = {
  warning:         { label: "Ce 警告", icon: "⚠️", color: "text-amber-400",   border: "border-amber-500/25",  bg: "bg-amber-500/5" },
  unresolved_task: { label: "未完成任務", icon: "📋", color: "text-violet-400", border: "border-violet-500/20", bg: "bg-violet-500/5" },
  pending:         { label: "待處理",   icon: "⏳", color: "text-slate-400",   border: "border-white/8",       bg: "bg-white/3" },
  cron_failure:    { label: "自動化失敗", icon: "🔴", color: "text-red-400",    border: "border-red-500/25",    bg: "bg-red-500/5" },
};

const SECTION_ORDER: DecisionItem["type"][] = ["warning", "unresolved_task", "cron_failure", "pending"];

const SECTION_TITLES: Record<DecisionItem["type"], string> = {
  warning:         "⚠️ Ce 警告",
  unresolved_task: "📋 未完成任務",
  cron_failure:    "🔴 自動化失敗",
  pending:         "⏳ 待你處理",
};

function ItemCard({ item, onDismiss }: { item: DecisionItem; onDismiss?: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const meta = TYPE_META[item.type];

  return (
    <div
      className={`rounded-xl border ${meta.border} ${meta.bg} cursor-pointer transition-colors hover:opacity-90`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="px-3.5 py-2.5 flex items-start gap-3">
        <span className="text-base leading-none mt-0.5 flex-shrink-0">{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${meta.color} truncate`}>{item.title}</p>
          {!expanded && (
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{item.detail}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {item.timestamp && (
            <span className="text-xs text-slate-700">{relTime(item.timestamp)}</span>
          )}
          <ChevronRight className={`w-3.5 h-3.5 text-slate-600 transition-transform ${expanded ? "rotate-90" : ""}`} />
        </div>
      </div>
      {expanded && (
        <div className="px-3.5 pb-3 border-t border-white/5 pt-2.5">
          <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap break-words">
            {item.detail}
          </p>
          {item.source === "channel" && (
            <p className="text-xs text-slate-700 mt-2">來源：channel.md</p>
          )}
          {item.source === "state" && (
            <p className="text-xs text-slate-700 mt-2">來源：current-state.md</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function DecisionsPage() {
  const [items, setItems] = useState<DecisionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/decisions");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
      }
    } finally {
      setLoading(false);
      setLastRefresh(Date.now());
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Group by type in defined order
  const grouped = SECTION_ORDER.reduce<Record<string, DecisionItem[]>>((acc, type) => {
    acc[type] = items.filter((i) => i.type === type);
    return acc;
  }, {} as Record<string, DecisionItem[]>);

  const total = items.length;

  return (
    <div className="min-h-screen bg-[#0d1117] text-slate-100">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-100">🎯 決策中心</h1>
            <p className="text-xs text-slate-600 mt-0.5">
              {lastRefresh > 0
                ? total === 0
                  ? "冇待處理事項 ✓"
                  : `${total} 項需要關注`
                : "載入中…"}
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

        {/* Stats strip */}
        {total > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {SECTION_ORDER.map((type) => {
              const count = grouped[type].length;
              const meta = TYPE_META[type];
              return (
                <div key={type} className={`rounded-xl border ${meta.border} ${meta.bg} px-3 py-2.5`}>
                  <p className="text-xs text-slate-600 truncate">{meta.label}</p>
                  <p className={`text-lg font-bold mt-0.5 ${count > 0 ? meta.color : "text-slate-700"}`}>
                    {count}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!loading && total === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <Inbox className="w-10 h-10 text-slate-700" />
            <p className="text-slate-500 text-sm">冇待處理事項</p>
            <p className="text-slate-700 text-xs">所有任務已完成，系統運作正常</p>
          </div>
        )}

        {/* Sections */}
        {SECTION_ORDER.map((type) => {
          const sectionItems = grouped[type];
          if (sectionItems.length === 0) return null;
          return (
            <div key={type} className="space-y-2">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest">
                {SECTION_TITLES[type]} · {sectionItems.length}
              </p>
              <div className="space-y-1.5">
                {sectionItems.map((item) => (
                  <ItemCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          );
        })}

      </div>
    </div>
  );
}
