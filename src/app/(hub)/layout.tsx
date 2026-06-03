"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brain, Users, FolderKanban, Zap, MessageSquare, Settings, ChevronRight, Sparkles, FileText } from "lucide-react";
import { useLang } from "@/lib/lang-context";

const NAV_ITEMS = [
  { href: "/", key: "hub" as const, icon: Brain, emoji: "🏠", color: "blue" },
  { href: "/notes", key: "notes" as const, icon: FileText, emoji: "📝", color: "blue" },
  { href: "/projects", key: "projects" as const, icon: FolderKanban, emoji: "📁", color: "emerald" },
  { href: "/activity", key: "activity" as const, icon: Zap, emoji: "📋", color: "amber" },
  { href: "/team", key: "team" as const, icon: Users, emoji: "🤖", color: "blue" },
  { href: "/messages", key: "messages" as const, icon: MessageSquare, emoji: "💬", color: "violet" },
];

const colorMap: Record<string, { active: string }> = {
  blue: { active: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  emerald: { active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  amber: { active: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  violet: { active: "bg-violet-500/20 text-violet-400 border-violet-500/30" },
};

export default function HubLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t, lang, toggle } = useLang();

  return (
    <div className="flex h-screen" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)" }}>
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[20%] left-[5%] w-[300px] h-[400px] rounded-full bg-blue-600/10 blur-[100px]" />
      </div>

      {/* Sidebar */}
      <aside className="relative w-56 flex-shrink-0 border-r border-white/10 flex flex-col">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/25 flex-shrink-0">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm truncate">AI Dashboard</p>
              <p className="text-slate-500 text-xs flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> {t.workspace}
              </p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          <p className="text-slate-600 text-xs font-medium px-2 pb-2 uppercase tracking-wider">
            {lang === "zh" ? "導航" : "Navigation"}
          </p>
          {NAV_ITEMS.map(({ href, key, emoji, color }) => {
            const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
            const c = colorMap[color];
            return (
              <Link key={href} href={href}>
                <div
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-150 group ${
                    isActive
                      ? `${c.active} border shadow-sm`
                      : "text-slate-500 hover:text-slate-300 hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <span className="text-base flex-shrink-0">{emoji}</span>
                  <span className={`font-medium flex-1 ${isActive ? "text-white" : ""}`}>
                    {t.nav[key]}
                  </span>
                  {isActive && <ChevronRight className="w-3 h-3 opacity-60" />}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Bottom: Settings + Lang toggle */}
        <div className="px-2 py-3 border-t border-white/10 space-y-0.5">
          <Link href="/settings">
            <div
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-150 ${
                pathname === "/settings"
                  ? "bg-slate-500/20 text-slate-300 border border-slate-500/30"
                  : "text-slate-500 hover:text-slate-300 hover:bg-white/5 border border-transparent"
              }`}
            >
              <span className="text-base">⚙️</span>
              <span className="font-medium">{t.nav.settings}</span>
            </div>
          </Link>

          {/* Language toggle */}
          <button
            onClick={toggle}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-300 hover:bg-white/5 border border-transparent transition-all duration-150"
          >
            <span className="text-base">🌐</span>
            <span className="font-medium flex-1 text-left">
              {lang === "zh" ? "English" : "中文"}
            </span>
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
