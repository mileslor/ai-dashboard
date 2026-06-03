"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, Activity, Users, FolderKanban, Settings, MessageSquare, Zap, ArrowRight, FileText } from "lucide-react";

const tiles = [
  {
    href: "/team",
    icon: Users,
    name: "AI Team",
    desc: "Manage AI agents & roles",
    color: "blue",
    emoji: "🤖",
  },
  {
    href: "/projects",
    icon: FolderKanban,
    name: "Projects",
    desc: "Track & manage projects",
    color: "emerald",
    emoji: "📁",
  },
  {
    href: "/notes",
    icon: FileText,
    name: "Notes",
    desc: "Local markdown notes",
    color: "teal",
    emoji: "📝",
  },
  {
    href: "/activity",
    icon: Activity,
    name: "Activity",
    desc: "AI work log & history",
    color: "amber",
    emoji: "⚡",
  },
  {
    href: "/messages",
    icon: MessageSquare,
    name: "Messages",
    desc: "Channel conversations",
    color: "violet",
    emoji: "💬",
  },
  {
    href: "/settings",
    icon: Settings,
    name: "Settings",
    desc: "Local storage & sync",
    color: "slate",
    emoji: "⚙️",
  },
];

const colorMap: Record<string, { bg: string; border: string; icon: string; hover: string; glow: string }> = {
  blue: {
    bg: "bg-blue-500/20",
    border: "border-blue-500/30",
    icon: "text-blue-400",
    hover: "hover:bg-blue-500/25",
    glow: "hover:shadow-blue-500/20",
  },
  emerald: {
    bg: "bg-emerald-500/20",
    border: "border-emerald-500/30",
    icon: "text-emerald-400",
    hover: "hover:bg-emerald-500/25",
    glow: "hover:shadow-emerald-500/20",
  },
  amber: {
    bg: "bg-amber-500/20",
    border: "border-amber-500/30",
    icon: "text-amber-400",
    hover: "hover:bg-amber-500/25",
    glow: "hover:shadow-amber-500/20",
  },
  violet: {
    bg: "bg-violet-500/20",
    border: "border-violet-500/30",
    icon: "text-violet-400",
    hover: "hover:bg-violet-500/25",
    glow: "hover:shadow-violet-500/20",
  },
  teal: {
    bg: "bg-teal-500/20",
    border: "border-teal-500/30",
    icon: "text-teal-400",
    hover: "hover:bg-teal-500/25",
    glow: "hover:shadow-teal-500/20",
  },
  slate: {
    bg: "bg-slate-500/20",
    border: "border-slate-500/30",
    icon: "text-slate-400",
    hover: "hover:bg-slate-500/25",
    glow: "hover:shadow-slate-500/20",
  },
};

export default function HubPage() {
  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)" }}>
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[20%] w-[500px] h-[500px] rounded-full bg-violet-600/10 blur-[100px]" />
      </div>

      {/* Header */}
      <header className="relative border-b border-white/10 px-6 py-5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="bg-gradient-to-br from-blue-500 to-violet-600 rounded-2xl p-3 shadow-lg shadow-blue-500/30">
                <Brain className="w-7 h-7 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-slate-900" />
            </div>
            <div>
              <h1 className="text-white font-bold text-xl tracking-tight">AI Dashboard</h1>
              <p className="text-slate-400 text-sm flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-green-400" />
                Local-first workspace
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Local mode</span>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          </div>
        </div>
      </header>

      {/* Hero text */}
      <main className="relative max-w-4xl mx-auto px-6 pt-10 pb-6">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-1">Welcome back</h2>
          <p className="text-slate-400 text-sm">Your AI team workspace, all local.</p>
        </div>

        {/* Tile grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {tiles.map((tile) => {
            const c = colorMap[tile.color];
            return (
              <Link key={tile.href} href={tile.href}>
                <Card
                  className={`border-white/10 bg-white/5 backdrop-blur-sm ${c.hover} ${c.glow} transition-all duration-200 cursor-pointer group h-full hover:border-white/20 hover:-translate-y-0.5`}
                  style={{ background: `linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)` }}
                >
                  <CardContent className="p-5 flex flex-col gap-3">
                    <div className={`w-11 h-11 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center text-xl shadow-sm`}>
                      {tile.emoji}
                    </div>
                    <div>
                      <h3 className="text-white font-semibold flex items-center gap-1.5 text-sm">
                        {tile.name}
                        <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-slate-400" />
                      </h3>
                      <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">{tile.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* Info strip */}
        <div className="mt-8 p-4 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-3 text-slate-400">
              <span className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                All data stored locally
              </span>
              <span>·</span>
              <span>No account needed</span>
              <span>·</span>
              <span>Your workspace, your rules</span>
            </div>
            <span className="text-slate-600">v0.1.0</span>
          </div>
        </div>
      </main>
    </div>
  );
}
