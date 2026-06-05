import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const HOME = process.env.HOME ?? "/Users/mileslor";
const CHANNEL_FILE = path.join(HOME, "workspace", "agents", "channel.md");
const STATE_FILE = path.join(HOME, "workspace", "current-state.md");

export interface DecisionItem {
  id: string;
  type: "unresolved_task" | "warning" | "pending" | "cron_failure";
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  timestamp?: number;
  source: "channel" | "state";
}

// Parse channel.md for items needing attention
function parseChannel(content: string): DecisionItem[] {
  const items: DecisionItem[] = [];
  const lines = content.split("\n");

  // Find all mx→ce task entries and check if they're resolved
  const mxTaskRe = /^\[mx (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})\]:\s*(.*)/;
  const ceResolvedRe = /^\[ce (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})\]:\s*✅/;
  const ceWarningRe = /^\[ce (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})\]:\s*⚠️\s*(.*)/;

  // Collect all timestamps of resolved ce entries
  const resolvedAfter: number[] = [];
  for (const line of lines) {
    const m = line.match(ceResolvedRe);
    if (m) {
      resolvedAfter.push(new Date(`${m[1]}T${m[2]}:00`).getTime());
    }
  }

  // Find unresolved mx tasks (last 7 days only)
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const mx = line.match(mxTaskRe);
    if (mx && line.includes("→ ce 請")) {
      const ts = new Date(`${mx[1]}T${mx[2]}:00`).getTime();
      if (ts < cutoff) continue;

      // Check if resolved (any ce ✅ after this timestamp)
      const resolved = resolvedAfter.some((r) => r > ts);
      if (!resolved) {
        // Collect task description (next few lines)
        const detail = lines
          .slice(i, i + 4)
          .join(" ")
          .replace(/^\[mx[^\]]+\]:\s*/, "")
          .slice(0, 120);

        items.push({
          id: `channel-unresolved-${ts}`,
          type: "unresolved_task",
          severity: "medium",
          title: `未完成任務 · ${mx[1]} ${mx[2]}`,
          detail: detail.trim(),
          timestamp: ts,
          source: "channel",
        });
      }
    }

    // Collect ce warnings
    const warn = line.match(ceWarningRe);
    if (warn) {
      const ts = new Date(`${warn[1]}T${warn[2]}:00`).getTime();
      if (ts < cutoff) continue;
      items.push({
        id: `channel-warn-${ts}`,
        type: "warning",
        severity: "high",
        title: `Ce 警告 · ${warn[1]} ${warn[2]}`,
        detail: warn[3].slice(0, 120),
        timestamp: ts,
        source: "channel",
      });
    }
  }

  return items;
}

// Parse current-state.md pending items
function parseStatePending(content: string): DecisionItem[] {
  const pendingRaw =
    content.match(/## ⏳ 等待處理 · Pending\n\n([\s\S]*?)(?=\n---)/)?.[1] ?? "";

  return pendingRaw
    .split("\n")
    .map((l) => l.replace(/^- \[[ x]\] /, "").trim())
    .filter(Boolean)
    .map((item, i) => ({
      id: `state-pending-${i}`,
      type: "pending" as const,
      severity: "low" as const,
      title: item.slice(0, 80),
      detail: item,
      source: "state" as const,
    }));
}

export async function GET() {
  const items: DecisionItem[] = [];

  try {
    if (fs.existsSync(CHANNEL_FILE)) {
      const channel = fs.readFileSync(CHANNEL_FILE, "utf8");
      items.push(...parseChannel(channel));
    }
  } catch {}

  try {
    if (fs.existsSync(STATE_FILE)) {
      const state = fs.readFileSync(STATE_FILE, "utf8");
      items.push(...parseStatePending(state));
    }
  } catch {}

  // Sort: warnings first, then unresolved, then pending; newest first
  items.sort((a, b) => {
    const sev = { high: 0, medium: 1, low: 2 };
    const ds = sev[a.severity] - sev[b.severity];
    if (ds !== 0) return ds;
    return (b.timestamp ?? 0) - (a.timestamp ?? 0);
  });

  return NextResponse.json({ items });
}
