"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, MessageSquare, ChevronDown, ChevronRight } from "lucide-react";

interface Section { heading: string; bullets: string[] }
interface Session { date: string; timestamp: number; sections: Section[] }

const AI_COLOR: Record<string, string> = {
  "[ce]": "text-violet-400",
  "[mx]": "text-blue-400",
  "[user]": "text-slate-400",
};

function colorize(text: string) {
  for (const [key, cls] of Object.entries(AI_COLOR)) {
    if (text.startsWith(key)) {
      const rest = text.slice(key.length).trim();
      return <><span className={`${cls} font-semibold`}>{key}</span> {rest}</>;
    }
  }
  return text;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sessions");
      if (res.ok) {
        const data = await res.json() as { sessions: Session[] };
        setSessions(data.sessions ?? []);
        // Auto-expand the first (most recent) session
        if (data.sessions?.length > 0) {
          setExpanded(new Set([data.sessions[0].date]));
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggleExpand(date: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  function fmtDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("zh-HK", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
  }

  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[15%] left-[20%] w-[350px] h-[350px] rounded-full bg-violet-600/6 blur-[100px]" />
      </div>

      <div className="relative px-8 pt-8 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Sessions</h2>
          <p className="text-slate-400 text-sm mt-0.5">{sessions.length} 次工作記錄 · 從 conversation-log.md</p>
        </div>
        <button onClick={load} disabled={loading}
          className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors disabled:opacity-40">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="relative px-8 pb-12 max-w-2xl space-y-2">
        {loading && (
          <div className="text-center py-16">
            <RefreshCw className="w-8 h-8 text-slate-700 mx-auto animate-spin" />
          </div>
        )}
        {!loading && sessions.length === 0 && (
          <div className="text-center py-16">
            <MessageSquare className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-600 text-sm">未有 session 記錄</p>
            <p className="text-slate-700 text-xs mt-1">~/.claude/conversation-log.md</p>
          </div>
        )}

        {sessions.map((session) => {
          const isOpen = expanded.has(session.date);
          const totalBullets = session.sections.reduce((s, sec) => s + sec.bullets.length, 0);
          return (
            <div key={session.date} className="rounded-xl border border-white/8 bg-white/3 overflow-hidden">
              {/* Session header */}
              <button onClick={() => toggleExpand(session.date)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/4 transition-colors text-left">
                {isOpen
                  ? <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-200">{fmtDate(session.date)}</p>
                </div>
                <span className="text-xs text-slate-600">{totalBullets} 條記錄</span>
              </button>

              {/* Session body */}
              {isOpen && (
                <div className="border-t border-white/6 px-5 py-3 space-y-3">
                  {session.sections.map((sec, i) => (
                    <div key={i}>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{sec.heading}</p>
                      <ul className="space-y-1">
                        {sec.bullets.map((b, j) => (
                          <li key={j} className="text-xs text-slate-400 leading-relaxed flex items-start gap-2">
                            <span className="text-slate-700 mt-0.5 flex-shrink-0">·</span>
                            <span>{colorize(b)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
