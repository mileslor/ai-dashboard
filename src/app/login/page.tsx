"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Brain, Sparkles, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    setMessage({ text: "Local mode active — click Continue to enter.", ok: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)" }}>
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[30%] w-[600px] h-[600px] rounded-full bg-blue-600/15 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[30%] w-[500px] h-[500px] rounded-full bg-violet-600/15 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10 gap-3">
          <div className="bg-gradient-to-br from-blue-500 to-violet-600 rounded-2xl p-4 shadow-xl shadow-blue-500/30">
            <Brain className="w-9 h-9 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-white text-2xl font-bold tracking-tight">AI Dashboard</h1>
            <p className="text-slate-400 text-sm mt-1">Local-first AI Team Workspace</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-xl">
          <div className="mb-5">
            <h2 className="text-white font-semibold text-center">Sign in</h2>
            <p className="text-slate-500 text-xs text-center mt-1">No account needed — local mode</p>
          </div>

          <form onSubmit={handleMagicLink} className="space-y-3">
            <div>
              <label className="text-slate-300 text-xs font-medium mb-1.5 block">Email</label>
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 h-10 text-sm"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-gradient-to-r from-blue-600 to-violet-600 hover:opacity-90 text-white text-sm font-medium shadow-lg shadow-blue-500/25"
            >
              {loading ? (
                "..."
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>

          {message && (
            <div className={`mt-4 px-3 py-2 rounded-lg text-xs ${
              message.ok
                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                : "bg-red-500/20 text-red-400 border border-red-500/30"
            }`}>
              {message.text}
            </div>
          )}
        </div>

        <p className="text-slate-600 text-xs text-center mt-4">
          Local mode — all data stays on your device
        </p>
      </div>
    </div>
  );
}
