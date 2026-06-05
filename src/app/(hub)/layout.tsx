"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Brain, Users, FolderKanban, Zap, MessageSquare, Settings, ChevronRight, Sparkles, FileText, Cog, Target } from "lucide-react";
import { useLang } from "@/lib/lang-context";

const NAV_ITEMS = [
  { href: "/decisions",  key: "decisions"  as const, emoji: "🎯", color: "red" },
  { href: "/automation", key: "automation" as const, emoji: "⚙️", color: "orange" },
  { href: "/notes",      key: "notes"      as const, emoji: "📝", color: "blue" },
  { href: "/projects",   key: "projects"   as const, emoji: "📁", color: "emerald" },
  { href: "/activity",   key: "activity"   as const, emoji: "⚡", color: "amber" },
  { href: "/team",       key: "team"       as const, emoji: "🤖", color: "blue" },
  { href: "/messages",   key: "messages"   as const, emoji: "💬", color: "violet" },
  { href: "/tokens",     key: "tokens"     as const, emoji: "🔋", color: "cyan" },
];

const colorMap: Record<string, { active: string }> = {
  blue:    { active: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  emerald: { active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  amber:   { active: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  violet:  { active: "bg-violet-500/20 text-violet-400 border-violet-500/30" },
  red:     { active: "bg-red-500/20 text-red-400 border-red-500/30" },
  orange:  { active: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  cyan:    { active: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
};

export default function HubLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t, lang, toggle } = useLang();
  const [decisionCount, setDecisionCount] = useState(0);

  useEffect(() => {
    fetch("/api/decisions")
      .then((r) => r.json())
      .then((d) => {
        const high = (d.items ?? []).filter((i: { severity: string }) => i.severity !== "low").length;
        setDecisionCount(high);
      })
      .catch(() => {});
  }, [pathname]); // refresh badge on every page change

  return (
    <div className="flex h-screen" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)" }}>
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[20%] left-[5%] w-[300px] h-[400px] rounded-full bg-blue-600/10 blur-[100px]" />
      </div>

      {/* Sidebar */}
      <aside className="relative w-52 flex-shrink-0 border-r border-white/10 flex flex-col">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-white/10">
          <Link href="/decisions">
            <div className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/25 flex-shrink-0">
                <Brain className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-white font-semibold text-sm truncate">AI Dashboard</p>
                <p className="text-slate-500 text-xs flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> {t.workspace}
                </p>
              </div>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ href, key, emoji, color }) => {
            const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
            const c = colorMap[color] ?? colorMap.blue;
            const isDecisions = href === "/decisions";
            return (
              <Link key={href} href={href}>
                <div
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-150 group ${
                    isActive
                      ? `${c.active} border shadow-sm`
                      : "text-slate-500 hover:text-slate-300 hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <span className="text-base flex-shrink-0 leading-none">{emoji}</span>
                  <span className={`font-medium flex-1 truncate ${isActive ? "text-white" : ""}`}>
                    {t.nav[key] ?? key}
                  </span>
                  {isDecisions && decisionCount > 0 && (
                    <span className="text-xs bg-red-500/25 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-full flex-shrink-0 leading-none">
                      {decisionCount}
                    </span>
                  )}
                  {isActive && !isDecisions && <ChevronRight className="w-3 h-3 opacity-60 flex-shrink-0" />}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="px-2 py-3 border-t border-white/10 space-y-0.5">
          <Link href="/settings">
            <div className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-150 ${
              pathname === "/settings"
                ? "bg-slate-500/20 text-slate-300 border border-slate-500/30"
                : "text-slate-500 hover:text-slate-300 hover:bg-white/5 border border-transparent"
            }`}>
              <span className="text-base leading-none">⚙️</span>
              <span className="font-medium">{t.nav.settings}</span>
            </div>
          </Link>
          <button
            onClick={toggle}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-300 hover:bg-white/5 border border-transparent transition-all duration-150"
          >
            <span className="text-base leading-none">🌐</span>
            <span className="font-medium flex-1 text-left">{lang === "zh" ? "English" : "中文"}</span>
            <span className="text-xs text-slate-600 font-mono">{lang.toUpperCase()}</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
