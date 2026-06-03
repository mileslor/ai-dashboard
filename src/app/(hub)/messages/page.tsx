"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { db, getAllAIs } from "@/lib/db";
import type { AI, AIMessage } from "@/types";
import { Send, Hash, Bot, Users, RefreshCw } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ChannelMsg = {
  id: string;
  sender: "ce" | "mx" | "miles" | "system";
  timestamp: number;
  content: string;
};

type Channel = { id: string; type: "meeting" | "dm"; label: string; emoji: string };

const CHANNELS: Channel[] = [
  { id: "meeting", type: "meeting", label: "會議室", emoji: "🏛️" },
  { id: "ce",      type: "dm",      label: "Claude (ce)", emoji: "🤖" },
  { id: "mx",      type: "dm",      label: "MiniMax (mx)", emoji: "🟣" },
];

const SENDER_META: Record<string, { label: string; emoji: string; color: string; bubble: string }> = {
  ce:     { label: "Claude (ce)", emoji: "🤖", color: "text-sky-400",    bubble: "bg-sky-500/15 border-sky-500/25 text-sky-100" },
  mx:     { label: "MiniMax (mx)", emoji: "🟣", color: "text-violet-400", bubble: "bg-violet-500/15 border-violet-500/25 text-violet-100" },
  miles:  { label: "Miles",       emoji: "👤", color: "text-slate-300",  bubble: "bg-white/8 border-white/12 text-slate-200" },
  system: { label: "System",      emoji: "⚙️", color: "text-slate-600",  bubble: "bg-white/4 border-white/8 text-slate-500" },
};

// ─── Parse channel.md ─────────────────────────────────────────────────────────

function parseChannelMd(raw: string): ChannelMsg[] {
  const lines = raw.split("\n");
  const msgs: ChannelMsg[] = [];
  let cur: ChannelMsg | null = null;

  const re = /^\[(ce|mx|Miles|miles)\s+(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?\]:\s*(.*)/i;

  for (const line of lines) {
    const m = line.match(re);
    if (m) {
      if (cur) msgs.push({ ...cur, content: cur.content.trimEnd() });
      const [, rawSender, date, time, first] = m;
      const sender = rawSender.toLowerCase() as ChannelMsg["sender"];
      const ts = time
        ? new Date(`${date}T${time}:00`).getTime()
        : new Date(date).getTime();
      cur = { id: `${sender}-${ts}`, sender, timestamp: ts, content: first };
    } else if (cur) {
      cur.content += "\n" + line;
    }
  }
  if (cur) msgs.push({ ...cur, content: cur.content.trimEnd() });
  return msgs;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString())
    return d.toLocaleTimeString("zh-HK", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("zh-HK", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function todayStamp() {
  const d = new Date();
  const date = d.toISOString().slice(0, 10);
  const time = d.toTimeString().slice(0, 5);
  return `${date} ${time}`;
}

function groupByDay<T extends { timestamp: number }>(items: T[]) {
  const result: { date: number; items: T[] }[] = [];
  let lastDate = "";
  for (const item of items) {
    const d = new Date(item.timestamp).toDateString();
    if (d !== lastDate) { result.push({ date: item.timestamp, items: [item] }); lastDate = d; }
    else result[result.length - 1].items.push(item);
  }
  return result;
}

// ─── DayDivider ──────────────────────────────────────────────────────────────

function DayDivider({ ts }: { ts: number }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-white/5" />
      <span className="text-xs text-slate-600 px-2">
        {new Date(ts).toLocaleDateString("zh-HK", { year: "numeric", month: "long", day: "numeric" })}
      </span>
      <div className="flex-1 h-px bg-white/5" />
    </div>
  );
}

// ─── MeetingBubble ───────────────────────────────────────────────────────────

function MeetingBubble({ msg }: { msg: ChannelMsg }) {
  const isMiles = msg.sender === "miles";
  const meta = SENDER_META[msg.sender] ?? SENDER_META.system;
  return (
    <div className={`flex items-end gap-2.5 ${isMiles ? "flex-row-reverse" : "flex-row"}`}>
      {!isMiles && (
        <div className="w-7 h-7 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-sm flex-shrink-0 mb-0.5">
          {meta.emoji}
        </div>
      )}
      <div className={`flex flex-col max-w-[75%] gap-0.5 ${isMiles ? "items-end" : "items-start"}`}>
        <div className={`flex items-center gap-1.5 px-0.5 ${isMiles ? "flex-row-reverse" : ""}`}>
          <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
          <span className="text-xs text-slate-700">{fmtTime(msg.timestamp)}</span>
        </div>
        <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words border ${meta.bubble} ${isMiles ? "rounded-br-sm" : "rounded-bl-sm"}`}>
          {msg.content}
        </div>
      </div>
    </div>
  );
}

// ─── DmBubble ────────────────────────────────────────────────────────────────

function DmBubble({ msg, agentName, agentEmoji }: { msg: AIMessage; agentName: string; agentEmoji: string }) {
  const isUser = msg.sender === "user";
  return (
    <div className={`flex items-end gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-md bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-sm flex-shrink-0 mb-0.5">
          {agentEmoji}
        </div>
      )}
      <div className={`flex flex-col max-w-[72%] gap-0.5 ${isUser ? "items-end" : "items-start"}`}>
        <div className={`flex items-center gap-1.5 px-0.5 ${isUser ? "flex-row-reverse" : ""}`}>
          <span className="text-xs text-slate-500 font-medium">{isUser ? "你" : agentName}</span>
          <span className="text-xs text-slate-700">{fmtTime(msg.timestamp)}</span>
        </div>
        <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${isUser ? "bg-violet-600/30 border border-violet-500/30 text-violet-100 rounded-br-sm" : "bg-white/6 border border-white/10 text-slate-200 rounded-bl-sm"}`}>
          {msg.content}
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const [activeChannel, setActiveChannel] = useState<string>("meeting");

  // Meeting room state
  const [meetingMsgs, setMeetingMsgs] = useState<ChannelMsg[]>([]);
  const [meetingDraft, setMeetingDraft] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // DM state
  const [agents, setAgents] = useState<AI[]>([]);
  const [dmMsgs, setDmMsgs] = useState<AIMessage[]>([]);
  const [dmDraft, setDmDraft] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Meeting room ────────────────────────────────────────────────────────────

  const loadMeeting = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch("/api/channel", { cache: "no-store" });
      const text = await res.text();
      setMeetingMsgs(parseChannelMd(text));
      setLastRefresh(new Date());
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMeeting();
    const t = setInterval(() => loadMeeting(true), 8000);
    return () => clearInterval(t);
  }, [loadMeeting]);

  async function sendMeeting() {
    if (!meetingDraft.trim()) return;
    const line = `\n[Miles ${todayStamp()}]: ${meetingDraft.trim()}`;
    await fetch("/api/channel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: line, append: true }),
    });
    setMeetingDraft("");
    await loadMeeting();
    inputRef.current?.focus();
  }

  // ── DM ──────────────────────────────────────────────────────────────────────

  async function loadDm(channelId: string) {
    const msgs = await db.messages.where("channelId").equals(channelId).sortBy("timestamp");
    setDmMsgs(msgs);
  }

  useEffect(() => {
    getAllAIs().then(setAgents);
  }, []);

  useEffect(() => {
    if (activeChannel !== "meeting") loadDm(activeChannel);
  }, [activeChannel]);

  async function sendDm() {
    if (!dmDraft.trim() || activeChannel === "meeting") return;
    await db.messages.add({
      id: crypto.randomUUID(),
      sender: "user",
      content: dmDraft.trim(),
      timestamp: Date.now(),
      channelId: activeChannel,
    });
    setDmDraft("");
    await loadDm(activeChannel);
    inputRef.current?.focus();
  }

  // ── Scroll ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [meetingMsgs, dmMsgs]);

  function handleKeyDown(e: React.KeyboardEvent, send: () => void) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const isMeeting = activeChannel === "meeting";
  const selectedAgent = agents.find((a) => a.id === activeChannel) ?? null;
  const meetingGrouped = groupByDay(meetingMsgs);
  const dmGrouped = groupByDay(dmMsgs);

  return (
    <div className="h-full flex overflow-hidden">
      {/* ── Sidebar ───────────────────────────────────────────────── */}
      <aside className="w-52 flex-shrink-0 border-r border-white/8 flex flex-col bg-black/15">
        <div className="px-3 pt-4 pb-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-1 mb-1">頻道</p>
        </div>

        <div className="flex-1 overflow-y-auto pb-2 space-y-0.5 px-1">
          {CHANNELS.map((ch) => {
            const isMtg = ch.type === "meeting";
            const active = activeChannel === ch.id;
            return (
              <button
                key={ch.id}
                onClick={() => setActiveChannel(ch.id)}
                className={`w-full text-left px-3 py-1.5 transition-colors flex items-center gap-2 rounded-md ${
                  active ? "bg-violet-500/15 text-violet-200" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                {isMtg
                  ? <Users className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
                  : <Hash className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />}
                <span className="text-sm font-medium truncate flex-1">{ch.label}</span>
                {isMtg && <span className="text-xs text-violet-400 font-semibold">●</span>}
              </button>
            );
          })}
        </div>

        <div className="border-t border-white/8 px-4 py-3">
          <p className="text-xs text-slate-600">會議室同步自 channel.md</p>
        </div>
      </aside>

      {/* ── Meeting Room ──────────────────────────────────────────── */}
      {isMeeting && (
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="border-b border-white/8 px-5 py-3 flex items-center gap-3 flex-shrink-0 bg-black/10">
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-lg">🏛️</div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">AI 會議室</p>
              <p className="text-slate-500 text-xs">ce + mx 協作頻道 · 實時讀取 channel.md</p>
            </div>
            <button
              onClick={() => loadMeeting()}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              {lastRefresh && <span>{lastRefresh.toLocaleTimeString("zh-HK", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
            {meetingMsgs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 opacity-40">
                <Users className="w-12 h-12 text-slate-600" />
                <p className="text-slate-500 text-sm">會議室暫無記錄</p>
                <p className="text-slate-700 text-xs">ce 同 mx 完成工作後會自動寫入</p>
              </div>
            ) : (
              meetingGrouped.map((group) => (
                <div key={group.date}>
                  <DayDivider ts={group.date} />
                  <div className="space-y-3">
                    {group.items.map((msg) => <MeetingBubble key={msg.id} msg={msg} />)}
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-white/8 px-4 py-3 flex-shrink-0 bg-black/10">
            <div className="flex items-end gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 focus-within:border-violet-500/40 transition-colors">
              <textarea
                ref={inputRef}
                value={meetingDraft}
                onChange={(e) => setMeetingDraft(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, sendMeeting)}
                placeholder="寫訊息到會議室... (Enter 發送, Shift+Enter 換行)"
                rows={1}
                style={{ resize: "none", minHeight: "24px", maxHeight: "120px" }}
                className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 outline-none leading-relaxed"
                onInput={(e) => {
                  const t = e.currentTarget;
                  t.style.height = "auto";
                  t.style.height = Math.min(t.scrollHeight, 120) + "px";
                }}
              />
              <button
                onClick={sendMeeting}
                disabled={!meetingDraft.trim()}
                className="w-7 h-7 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0 transition-colors"
              >
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
            <p className="text-xs text-slate-700 mt-1.5 px-1">以 [Miles] 身份寫入 channel.md · 每 8 秒自動更新</p>
          </div>
        </div>
      )}

      {/* ── DM channel ────────────────────────────────────────────── */}
      {!isMeeting && selectedAgent && (
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="border-b border-white/8 px-5 py-3 flex items-center gap-3 flex-shrink-0 bg-black/10">
            <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center text-lg">{selectedAgent.emoji ?? "🤖"}</div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">{selectedAgent.name}</p>
              <p className="text-slate-500 text-xs truncate">{selectedAgent.role}</p>
            </div>
            <div className="text-xs text-slate-600">{dmMsgs.length} 條</div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
            {dmMsgs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 opacity-50">
                <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-3xl">{selectedAgent.emoji ?? "🤖"}</div>
                <p className="text-slate-500 text-sm">私人備忘頻道</p>
              </div>
            ) : (
              dmGrouped.map((group) => (
                <div key={group.date}>
                  <DayDivider ts={group.date} />
                  <div className="space-y-3">
                    {group.items.map((msg) => (
                      <DmBubble key={msg.id} msg={msg} agentName={selectedAgent.name} agentEmoji={selectedAgent.emoji ?? "🤖"} />
                    ))}
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-white/8 px-4 py-3 flex-shrink-0 bg-black/10">
            <div className="flex items-end gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 focus-within:border-violet-500/40 transition-colors">
              <textarea
                ref={inputRef}
                value={dmDraft}
                onChange={(e) => setDmDraft(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, sendDm)}
                placeholder={`備忘給 ${selectedAgent.name}... (Enter 發送)`}
                rows={1}
                style={{ resize: "none", minHeight: "24px", maxHeight: "120px" }}
                className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 outline-none leading-relaxed"
                onInput={(e) => {
                  const t = e.currentTarget;
                  t.style.height = "auto";
                  t.style.height = Math.min(t.scrollHeight, 120) + "px";
                }}
              />
              <button
                onClick={sendDm}
                disabled={!dmDraft.trim()}
                className="w-7 h-7 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0 transition-colors"
              >
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── No selection ─────────────────────────────────────────── */}
      {!isMeeting && !selectedAgent && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center opacity-40">
            <Bot className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">選擇頻道</p>
          </div>
        </div>
      )}
    </div>
  );
}
