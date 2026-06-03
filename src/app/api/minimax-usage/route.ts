import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const LOG_FILE = path.join(process.env.HOME ?? "/Users/mileslor", ".ai-dashboard", "minimax-usage.jsonl");
const WINDOW_HOURS = 5;
const WINDOW_MS = WINDOW_HOURS * 60 * 60 * 1000;
// MiniMax windows UTC+8: 03:00, 08:00, 13:00, 18:00, 23:00
const WINDOW_STARTS_UTC8 = [3, 8, 13, 18, 23];

interface LogEntry {
  ts: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  model: string;
}

function getCurrentWindow(): { start: number; end: number } {
  const now = new Date();
  // Shift to UTC+8
  const utc8Ms = now.getTime() + 8 * 60 * 60 * 1000;
  const utc8 = new Date(utc8Ms);
  const h = utc8.getUTCHours();

  // Find which window start we're in
  let windowStartH = WINDOW_STARTS_UTC8[0];
  for (let i = WINDOW_STARTS_UTC8.length - 1; i >= 0; i--) {
    if (h >= WINDOW_STARTS_UTC8[i]) {
      windowStartH = WINDOW_STARTS_UTC8[i];
      break;
    }
  }
  // Handle wrap: if h < first window start (03), use last window (23:00 previous day)
  if (h < WINDOW_STARTS_UTC8[0]) {
    windowStartH = WINDOW_STARTS_UTC8[WINDOW_STARTS_UTC8.length - 1];
  }

  // Build window start timestamp in UTC
  const dayStart = new Date(utc8);
  dayStart.setUTCHours(0, 0, 0, 0);
  let windowStartMs = dayStart.getTime() + windowStartH * 60 * 60 * 1000 - 8 * 60 * 60 * 1000;
  // If window started yesterday (23:00 window when h < 3)
  if (h < WINDOW_STARTS_UTC8[0]) {
    windowStartMs -= 24 * 60 * 60 * 1000;
  }
  const windowEndMs = windowStartMs + WINDOW_MS;

  return { start: windowStartMs, end: windowEndMs };
}

export async function GET() {
  try {
    const window = getCurrentWindow();

    let entries: LogEntry[] = [];
    try {
      const content = fs.readFileSync(LOG_FILE, "utf8");
      entries = content
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l) as LogEntry);
    } catch {
      // File may not exist yet
    }

    // Filter to current window
    const windowEntries = entries.filter((e) => e.ts >= window.start && e.ts < window.end);
    const windowTotal = windowEntries.reduce((s, e) => s + (e.total_tokens ?? 0), 0);
    const windowCalls = windowEntries.length;

    // All-time stats
    const allTotal = entries.reduce((s, e) => s + (e.total_tokens ?? 0), 0);

    // Today stats (UTC+8)
    const todayStr = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const todayEntries = entries.filter((e) => {
      const d = new Date(e.ts + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
      return d === todayStr;
    });
    const todayTotal = todayEntries.reduce((s, e) => s + (e.total_tokens ?? 0), 0);

    const resetMin = Math.max(0, Math.round((window.end - Date.now()) / 60000));

    return NextResponse.json({
      window_used: windowTotal,
      window_calls: windowCalls,
      window_start: window.start,
      window_end: window.end,
      window_reset_min: resetMin,
      today_total: todayTotal,
      all_total: allTotal,
      last_call_ts: entries.length > 0 ? entries[entries.length - 1].ts : null,
      has_data: entries.length > 0,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
