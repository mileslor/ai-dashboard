import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const HOME = process.env.HOME ?? "/Users/mileslor";
const CHANNEL_FILE = path.join(HOME, "workspace", "agents", "channel.md");
const STATE_FILE = path.join(HOME, "workspace", "current-state.md");

export interface ChoiceOption {
  label: string;
  text: string;
}

export interface DecisionItem {
  id: string;
  type: "choice" | "unresolved_task" | "warning" | "pending" | "cron_failure";
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  timestamp?: number;
  source: "channel" | "state";
  options?: ChoiceOption[];
  // For choice items that Miles has already replied to
  milesReply?: string;
  latestAiActivity?: string;
  isResolved?: boolean;
}

// ─── Parse all messages from channel.md ──────────────────────────────────────

interface Msg { sender: string; ts: number; content: string; }

function parseMsgs(content: string): Msg[] {
  const msgs: Msg[] = [];
  const headerRe = /^\[(ce|mx|Miles|miles)\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\]:\s*(.*)/i;
  let cur: Msg | null = null;
  for (const line of content.split("\n")) {
    const m = line.match(headerRe);
    if (m) {
      if (cur) msgs.push(cur);
      cur = { sender: m[1].toLowerCase(), ts: new Date(`${m[2]}T${m[3]}:00`).getTime(), content: m[4] };
    } else if (cur) {
      cur.content += "\n" + line;
    }
  }
  if (cur) msgs.push(cur);
  return msgs;
}

// ─── Parse choice items (pending + answered) ─────────────────────────────────

function parseChoices(msgs: Msg[]): DecisionItem[] {
  const items: DecisionItem[] = [];
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const letters = ["A", "B", "C", "D", "E"];

  for (let i = 0; i < msgs.length; i++) {
    const msg = msgs[i];
    if (msg.sender === "miles" || msg.sender === "system") continue;
    if (msg.ts < cutoff) continue;

    const options: ChoiceOption[] = [];
    for (const line of msg.content.split("\n")) {
      const m = line.trim().match(/^(\d+)[.、)]\s+(.+)/);
      if (m) {
        const text = m[2].replace(/\*\*/g, "").trim();
        if (text) options.push({ label: letters[options.length] ?? m[1], text });
        if (options.length >= 5) break;
      }
    }
    if (options.length < 2) continue;

    const later = msgs.slice(i + 1);

    // Miles "replied" only if their message starts with an option label (A./B./C./D.)
    // or explicitly references the choice — not just any unrelated message
    const milesMsg = later.find((m) => {
      if (m.sender !== "miles" || m.ts <= msg.ts) return false;
      const t = m.content.trim();
      return options.some((opt) => t.startsWith(`${opt.label}.`) || t.startsWith(`${opt.label} `));
    });

    // Latest AI (ce/mx) activity after Miles' reply (or after the original message)
    const afterTs = milesMsg?.ts ?? msg.ts;
    const aiMsgs = later.filter((m) => (m.sender === "ce" || m.sender === "mx") && m.ts > afterTs);
    const latestAi = aiMsgs[aiMsgs.length - 1];
    const latestAiActivity = latestAi
      ? latestAi.content.trim().split("\n")[0].slice(0, 100)
      : undefined;
    const isResolved = aiMsgs.some((m) => m.content.includes("✅"));

    const firstLine = msg.content.split("\n")[0].replace(/\*\*/g, "").trim().slice(0, 60) || "AI 需要你決定";

    items.push({
      id: `choice-${msg.ts}`,
      type: "choice",
      severity: milesMsg ? "low" : "high",
      title: firstLine,
      detail: msg.content.trim().slice(0, 400),
      timestamp: msg.ts,
      source: "channel",
      options,
      milesReply: milesMsg?.content.trim().slice(0, 120),
      latestAiActivity,
      isResolved,
    });
  }
  return items;
}

// ─── Parse channel.md for warnings and unresolved tasks ──────────────────────

function parseChannel(content: string): DecisionItem[] {
  const items: DecisionItem[] = [];
  const lines = content.split("\n");
  const mxTaskRe = /^\[mx (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})\]:\s*(.*)/;
  const ceResolvedRe = /^\[ce (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})\]:\s*✅/;
  const ceWarningRe = /^\[ce (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})\]:\s*⚠️\s*(.*)/;

  const resolvedAfter: number[] = [];
  for (const line of lines) {
    const m = line.match(ceResolvedRe);
    if (m) resolvedAfter.push(new Date(`${m[1]}T${m[2]}:00`).getTime());
  }

  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const mx = line.match(mxTaskRe);
    if (mx && line.includes("→ ce 請")) {
      const ts = new Date(`${mx[1]}T${mx[2]}:00`).getTime();
      if (ts < cutoff) continue;
      const resolved = resolvedAfter.some((r) => r > ts);
      if (!resolved) {
        const detail = lines.slice(i, i + 4).join(" ").replace(/^\[mx[^\]]+\]:\s*/, "").slice(0, 120);
        items.push({ id: `channel-unresolved-${ts}`, type: "unresolved_task", severity: "medium", title: `未完成任務 · ${mx[1]} ${mx[2]}`, detail: detail.trim(), timestamp: ts, source: "channel" });
      }
    }
    const warn = line.match(ceWarningRe);
    if (warn) {
      const ts = new Date(`${warn[1]}T${warn[2]}:00`).getTime();
      if (ts < cutoff) continue;
      items.push({ id: `channel-warn-${ts}`, type: "warning", severity: "high", title: `Ce 警告 · ${warn[1]} ${warn[2]}`, detail: warn[3].slice(0, 120), timestamp: ts, source: "channel" });
    }
  }
  return items;
}

// ─── Parse current-state.md pending items ────────────────────────────────────

function parseStatePending(content: string): DecisionItem[] {
  const pendingRaw = content.match(/## ⏳ 等待處理 · Pending\n\n([\s\S]*?)(?=\n---)/)?.[1] ?? "";
  return pendingRaw
    .split("\n")
    .map((l) => l.replace(/^- \[[ x]\] /, "").trim())
    .filter(Boolean)
    .map((item, i) => ({ id: `state-pending-${i}`, type: "pending" as const, severity: "low" as const, title: item.slice(0, 80), detail: item, source: "state" as const }));
}

export async function GET() {
  const items: DecisionItem[] = [];

  try {
    if (fs.existsSync(CHANNEL_FILE)) {
      const channel = fs.readFileSync(CHANNEL_FILE, "utf8");
      const msgs = parseMsgs(channel);
      items.push(...parseChoices(msgs));
      items.push(...parseChannel(channel));
    }
  } catch {}

  try {
    if (fs.existsSync(STATE_FILE)) {
      const state = fs.readFileSync(STATE_FILE, "utf8");
      items.push(...parseStatePending(state));
    }
  } catch {}

  items.sort((a, b) => {
    const sev: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const ds = sev[a.severity] - sev[b.severity];
    if (ds !== 0) return ds;
    return (b.timestamp ?? 0) - (a.timestamp ?? 0);
  });

  return NextResponse.json({ items });
}
