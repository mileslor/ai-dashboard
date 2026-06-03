import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const HOME = process.env.HOME ?? "/Users/mileslor";
const WS = path.join(HOME, "workspace");
const CONV_LOG = path.join(HOME, ".claude", "conversation-log.md");

interface ActivityEntry {
  id: string;
  aiId: string;
  projectId: string | null;
  action: string;
  details: string;
  timestamp: number;
  source: string;
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

function parseConversationLog(content: string): ActivityEntry[] {
  const acts: ActivityEntry[] = [];
  for (const section of content.split(/^## /m).filter(Boolean)) {
    const dateMatch = section.match(/^(\d{4}-\d{2}-\d{2})/);
    if (!dateMatch) continue;
    const ts = new Date(dateMatch[1]).getTime();

    // Session titles (### headings)
    for (const m of section.matchAll(/^### (.+)$/gm)) {
      const title = m[1].trim();
      if (!title || title.length < 3) continue;
      acts.push({
        id: `log-session-${ts}-${title.slice(0, 20)}`,
        aiId: "ce",
        projectId: null,
        action: title,
        details: "conversation-log.md",
        timestamp: ts,
        source: "conversation-log",
      });
    }

    // Bullet points
    for (const m of section.matchAll(/^- (?!\[)(.+)$/gm)) {
      const action = m[1].trim();
      if (action.length < 5) continue;
      acts.push({
        id: `log-bullet-${ts}-${action.slice(0, 25)}`,
        aiId: "ce",
        projectId: null,
        action: action.slice(0, 140),
        details: "conversation-log.md",
        timestamp: ts,
        source: "conversation-log",
      });
    }
  }
  return acts;
}

function parseThycMilestones(content: string): ActivityEntry[] {
  const acts: ActivityEntry[] = [];
  const section = content.match(/## 4️⃣[\s\S]*?(?=## 5️⃣)/)?.[0] ?? "";

  for (const row of section.split("\n").filter((l) => l.trim().startsWith("|"))) {
    const cells = row.split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length < 2 || cells[0].includes("---") || cells[0].includes("里程碑")) continue;

    const dateRaw = cells[0].replace(/\*\*/g, "").replace(/[⭐✅]/g, "").trim();
    const event = cells[1].replace(/\*\*/g, "").replace(/[⭐✅]/g, "").trim();
    if (!event || event.includes("---")) continue;

    const full = dateRaw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    const short = dateRaw.match(/^(\d{1,2})\/(\d{1,2})$/);
    let ts: number;
    if (full) ts = new Date(+full[3], +full[2] - 1, +full[1]).getTime();
    else if (short) ts = new Date(2026, +short[2] - 1, +short[1]).getTime();
    else continue;

    acts.push({
      id: `thyc-ms-${ts}-${event.slice(0, 12)}`,
      aiId: "ce",
      projectId: "seed-thyc_system",
      action: event.slice(0, 120),
      details: "THYC 系統開發里程碑",
      timestamp: ts,
      source: "thyc-log",
    });
  }
  return acts;
}

function parseChannelMd(content: string): ActivityEntry[] {
  const acts: ActivityEntry[] = [];
  for (const m of content.matchAll(/\[(mx|ce|user)\s+(\d{4}-\d{2}-\d{2})[^\]]*\]:\s*(.+)/g)) {
    const sender = m[1];
    const ts = new Date(m[2]).getTime();
    const firstLine = m[3].trim().slice(0, 120);
    if (!firstLine) continue;
    acts.push({
      id: `channel-${ts}-${sender}-${firstLine.slice(0, 15)}`,
      aiId: sender === "mx" ? "mx" : sender === "ce" ? "ce" : "user",
      projectId: null,
      action: firstLine,
      details: "agents/channel.md",
      timestamp: ts,
      source: "channel",
    });
  }
  return acts;
}

// ─── Hardcoded entries for file-based projects ────────────────────────────────

const STATIC_ENTRIES: ActivityEntry[] = [
  {
    id: "static-lofi-phase1",
    aiId: "user",
    projectId: "seed-youtube-lofi",
    action: "完成 YouTube Lo-Fi 冥想音樂第一階段：19段音樂 + 58分鐘合拼版",
    details: "youtube-lofi-music.md",
    timestamp: new Date("2026-04-17").getTime(),
    source: "static",
  },
  {
    id: "static-channel-locked-1",
    aiId: "mx",
    projectId: null,
    action: "channel.md 讀取失敗 — 檔案鎖定，無法寫入",
    details: "agents/channel.md",
    timestamp: new Date("2026-04-19").getTime(),
    source: "static",
  },
  {
    id: "static-channel-locked-2",
    aiId: "mx",
    projectId: null,
    action: "channel.md 仍然鎖定，建議改用 channel_alt.md 作備用通道",
    details: "agents/channel.md",
    timestamp: new Date("2026-04-28").getTime(),
    source: "static",
  },
  {
    id: "static-nintendo-research",
    aiId: "user",
    projectId: "seed-nintendo-research",
    action: "完成 Nintendo Switch 2026 遊戲研究，整理第一方及第三方遊戲列表",
    details: "nintendo_2026_research.md",
    timestamp: new Date("2026-04-30").getTime(),
    source: "static",
  },
];

// ─── GET — return all parsed activities ──────────────────────────────────────

export async function GET() {
  try {
    let acts: ActivityEntry[] = [...STATIC_ENTRIES];

    if (fs.existsSync(CONV_LOG))
      acts.push(...parseConversationLog(fs.readFileSync(CONV_LOG, "utf8")));

    const thycLog = path.join(WS, "thyc_system", "work_log_whatsapp.md");
    if (fs.existsSync(thycLog))
      acts.push(...parseThycMilestones(fs.readFileSync(thycLog, "utf8")));

    const channelMd = path.join(WS, "agents", "channel.md");
    if (fs.existsSync(channelMd))
      acts.push(...parseChannelMd(fs.readFileSync(channelMd, "utf8")));

    // Deduplicate
    const seen = new Set<string>();
    acts = acts.filter((a) => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });

    acts.sort((a, b) => a.timestamp - b.timestamp);
    return NextResponse.json({ activities: acts, total: acts.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ─── POST — append a new entry to conversation-log.md ────────────────────────

export async function POST(req: Request) {
  try {
    const body = await req.json() as { action: string; aiId?: string; projectId?: string; details?: string };
    if (!body.action?.trim()) return NextResponse.json({ error: "action required" }, { status: 400 });

    const today = new Date().toISOString().slice(0, 10);
    const aiLabel = body.aiId === "ce" ? "ce" : body.aiId === "mx" ? "mx" : "user";
    const line = `- [${aiLabel} ${today}]: ${body.action.trim()}${body.details ? ` (${body.details.trim()})` : ""}`;

    let content = fs.existsSync(CONV_LOG) ? fs.readFileSync(CONV_LOG, "utf8") : "# 對話記錄\n";

    const sectionHeader = `## ${today}`;
    if (content.includes(sectionHeader)) {
      // Append under existing section
      content = content.replace(
        new RegExp(`(## ${today}[^\\n]*\\n)`),
        `$1${line}\n`
      );
    } else {
      // Add new section at end
      content = content.trimEnd() + `\n\n${sectionHeader}\n\n${line}\n`;
    }

    fs.writeFileSync(CONV_LOG, content, "utf8");
    return NextResponse.json({ ok: true, appended: line });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
