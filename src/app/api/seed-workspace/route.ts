import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const HOME = process.env.HOME ?? "/Users/mileslor";
const WS = path.join(HOME, "workspace");
const PROFILES = path.join(WS, "profiles");
const CONV_LOG = path.join(HOME, ".claude", "conversation-log.md");

// ─── Project definitions ──────────────────────────────────────────────────────
// Combine workspace root dirs + profiles dirs

const PROJECTS = [
  // ── Active development ──
  {
    id: "seed-ai-dashboard",
    title: "AI Dashboard",
    description: "AI 工作管理 Dashboard，Obsidian 風格設計。Next.js + Tailwind + Dexie.js 本地 IndexedDB。Dev: localhost:3456",
    status: "active",
    color: "#8b5cf6",
    createdAt: new Date("2026-05-02").getTime(),
    updatedAt: new Date("2026-05-04").getTime(),
    dir: "ai-dashboard",
  },
  {
    id: "seed-karaqueue",
    title: "KaraQueue",
    description: "本地 WiFi YouTube KTV 點歌系統。用家透過手機掃 QR Code 點歌，主機播放 YouTube 視頻。Node.js",
    status: "active",
    color: "#a855f7",
    createdAt: new Date("2026-03-01").getTime(),
    updatedAt: new Date("2026-04-01").getTime(),
    dir: "karaqueue",
  },
  {
    id: "seed-pilot",
    title: "PilotLog Platform",
    description: "飛行員工具平台 pilot.hkmilestone.com。面向香港及亞太區商業飛行員，提供飛行日誌、工具及資訊。",
    status: "active",
    color: "#3b82f6",
    createdAt: new Date("2026-04-12").getTime(),
    updatedAt: new Date("2026-04-12").getTime(),
    dir: "pilot",
  },
  {
    id: "seed-visapath",
    title: "VisaPath",
    description: "簽證申請資訊平台。React + Vite，部署至 Cloudflare Pages（GitHub 自動部署）。",
    status: "active",
    color: "#f59e0b",
    createdAt: new Date("2026-03-01").getTime(),
    updatedAt: new Date("2026-04-01").getTime(),
    dir: "visapath",
  },
  {
    id: "seed-token-monitor",
    title: "Token Monitor",
    description: "Claude + MiniMax token 用量監察工具。目標：Web app (hkmilestone.com/token-monitor) + Mac Menu Bar App (Electron)。",
    status: "active",
    color: "#06b6d4",
    createdAt: new Date("2026-04-01").getTime(),
    updatedAt: new Date("2026-04-01").getTime(),
    dir: "token-monitor",
  },
  // ── Completed / maintenance ──
  {
    id: "seed-thyc_system",
    title: "THYC CRM 系統",
    description: "大坑坊眾福利會 大坑青年中心 CRM 系統。Flask + MySQL，Windows + IIS 部署。合約功能 100% 完成，UAT 階段。",
    status: "completed",
    color: "#22c55e",
    createdAt: new Date("2025-12-01").getTime(),
    updatedAt: new Date("2026-04-19").getTime(),
    dir: "thyc_system",
  },
  {
    id: "seed-milestone",
    title: "Milestone Technology 網站",
    description: "公司網站 hkmilestone.com。含 lwrc-payment 付款頁面。",
    status: "active",
    color: "#0ea5e9",
    createdAt: new Date("2025-01-01").getTime(),
    updatedAt: new Date("2026-01-01").getTime(),
    dir: "milestone",
  },
  {
    id: "seed-travian-bot",
    title: "Travian Bot",
    description: "Travian 瀏覽器遊戲自動化機器人。Python，自動農場、建設等操作。",
    status: "archived",
    color: "#ef4444",
    createdAt: new Date("2025-06-01").getTime(),
    updatedAt: new Date("2025-12-01").getTime(),
    dir: "travian-bot",
  },
  {
    id: "seed-youtube-lofi",
    title: "YouTube Lo-Fi 頻道",
    description: "YouTube Lo-Fi 冥想音樂頻道。用 MiniMax music-2.6 API 生成純音樂，19段合拼成58分鐘完整版。第一階段已完成。",
    status: "active",
    color: "#6366f1",
    createdAt: new Date("2026-04-17").getTime(),
    updatedAt: new Date("2026-04-17").getTime(),
    dir: "youtube-lofi-music",
  },
  {
    id: "seed-nintendo-research",
    title: "Nintendo 2026 研究",
    description: "Nintendo Switch 2026 遊戲研究。整理任天堂第一方及第三方遊戲列表，來源：Wikipedia、Nintendo Life、Gematsu。",
    status: "active",
    color: "#ef4444",
    createdAt: new Date("2026-04-30").getTime(),
    updatedAt: new Date("2026-04-30").getTime(),
    dir: "nintendo_2026_research",
  },
];

// ─── Hardcoded activities for file-based projects ────────────────────────────

const EXTRA_ACTIVITIES = [
  {
    id: "seed-act-lofi-phase1",
    aiId: "user",
    projectId: "seed-youtube-lofi",
    action: "完成 YouTube Lo-Fi 冥想音樂第一階段：19段音樂 + 58分鐘合拼版",
    details: "youtube-lofi-music.md",
    timestamp: new Date("2026-04-17").getTime(),
  },
  {
    id: "seed-act-channel-locked-1",
    aiId: "mx",
    projectId: null,
    action: "channel.md 讀取失敗 — 檔案鎖定，無法寫入",
    details: "agents/channel.md",
    timestamp: new Date("2026-04-19").getTime(),
  },
  {
    id: "seed-act-channel-locked-2",
    aiId: "mx",
    projectId: null,
    action: "channel.md 仍然鎖定，建議改用 channel_alt.md 作備用通道",
    details: "agents/channel.md",
    timestamp: new Date("2026-04-28").getTime(),
  },
  {
    id: "seed-act-nintendo-research",
    aiId: "user",
    projectId: "seed-nintendo-research",
    action: "完成 Nintendo Switch 2026 遊戲研究，整理第一方及第三方遊戲列表",
    details: "nintendo_2026_research.md",
    timestamp: new Date("2026-04-30").getTime(),
  },
];

// ─── Activity parsers ─────────────────────────────────────────────────────────

function parseThycMilestones(content: string): object[] {
  const acts: object[] = [];
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
      id: `seed-thyc-ms-${ts}-${event.slice(0, 12)}`,
      aiId: "ce",
      projectId: "seed-thyc_system",
      action: event.slice(0, 120),
      details: "THYC 系統開發里程碑",
      timestamp: ts,
    });
  }
  return acts;
}

function parseConversationLog(content: string): object[] {
  const acts: object[] = [];
  for (const section of content.split(/^## /m).filter(Boolean)) {
    const dateMatch = section.match(/^(\d{4}-\d{2}-\d{2})/);
    if (!dateMatch) continue;
    const ts = new Date(dateMatch[1]).getTime();
    for (const m of section.matchAll(/^- (?!\[)(.+)$/gm)) {
      const action = m[1].trim();
      if (action.length < 5) continue;
      acts.push({
        id: `seed-convlog-${ts}-${action.slice(0, 20)}`,
        aiId: "ce",
        action: action.slice(0, 120),
        details: "conversation-log.md",
        timestamp: ts,
      });
    }
  }
  return acts;
}

function parseChannelMd(content: string): object[] {
  const acts: object[] = [];
  for (const m of content.matchAll(/\[(mx|ce|user)\s+(\d{4}-\d{2}-\d{2})[^\]]*\]:\s*(.+)/g)) {
    const sender = m[1];
    const ts = new Date(m[2]).getTime();
    const firstLine = m[3].trim().slice(0, 120);
    if (!firstLine) continue;
    acts.push({
      id: `seed-channel-${ts}-${sender}-${firstLine.slice(0, 15)}`,
      aiId: sender === "mx" ? "mx" : sender === "ce" ? "ce" : "user",
      action: firstLine,
      details: "agents/channel.md",
      timestamp: ts,
    });
  }
  return acts;
}

// ─── Note builders ────────────────────────────────────────────────────────────

function buildNotes(): object[] {
  const notes: object[] = [];

  const noteFiles = [
    {
      id: "seed-note-pilot-direction",
      filePath: path.join(WS, "pilot", "PRODUCT_DIRECTION.md"),
      title: "PilotLog — Product Direction",
      tags: ["pilot", "product"],
      projectId: "seed-pilot",
      date: "2026-04-12",
    },
    {
      id: "seed-note-thyc-features",
      filePath: path.join(WS, "thyc_system", "功能清單及工作細明_20260418.md"),
      title: "THYC 功能清單及工作細明",
      tags: ["thyc", "features"],
      projectId: "seed-thyc_system",
      date: "2026-04-18",
    },
    {
      id: "seed-note-thyc-spec",
      filePath: path.join(WS, "thyc_system", "THYC_CRM_系統功能及規格說明書_v1.0.md"),
      title: "THYC CRM 規格說明書 v1.0",
      tags: ["thyc", "spec"],
      projectId: "seed-thyc_system",
      date: "2026-04-17",
    },
    {
      id: "seed-note-thyc-billing",
      filePath: path.join(WS, "thyc_system", "工作進度及收費記錄報告_20260417.md"),
      title: "THYC 工作進度及收費記錄報告",
      tags: ["thyc", "billing"],
      projectId: "seed-thyc_system",
      date: "2026-04-17",
    },
    {
      id: "seed-note-thyc-security",
      filePath: path.join(WS, "thyc_system", "安全保護記錄.md"),
      title: "THYC 安全保護記錄",
      tags: ["thyc", "security"],
      projectId: "seed-thyc_system",
      date: "2026-04-17",
    },
    {
      id: "seed-note-token-monitor",
      filePath: path.join(WS, "token-monitor", "SPEC.md"),
      title: "Token Monitor — 規格",
      tags: ["token-monitor", "spec"],
      projectId: "seed-token-monitor",
      date: "2026-04-01",
    },
    {
      id: "seed-note-youtube-lofi",
      filePath: path.join(WS, "youtube-lofi-music.md"),
      title: "YouTube Lo-Fi — 第一階段完成記錄",
      tags: ["youtube-lofi", "music", "minimax"],
      projectId: "seed-youtube-lofi",
      date: "2026-04-17",
    },
    {
      id: "seed-note-nintendo-research",
      filePath: path.join(WS, "nintendo_2026_research.md"),
      title: "Nintendo Switch 2026 遊戲研究",
      tags: ["nintendo", "gaming", "research"],
      projectId: "seed-nintendo-research",
      date: "2026-04-30",
    },
    {
      id: "seed-note-nintendo-exclusives",
      filePath: path.join(WS, "nintendo_exclusives.md"),
      title: "Nintendo Switch 獨佔遊戲列表",
      tags: ["nintendo", "gaming"],
      projectId: "seed-nintendo-research",
      date: "2026-04-30",
    },
  ];

  for (const n of noteFiles) {
    if (!fs.existsSync(n.filePath)) continue;
    const content = fs.readFileSync(n.filePath, "utf8");
    const ts = new Date(n.date).getTime();
    notes.push({
      id: n.id,
      title: n.title,
      content,
      tags: n.tags,
      projectId: n.projectId,
      createdAt: ts,
      updatedAt: ts,
    });
  }
  return notes;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    // Filter to only projects whose dir actually exists
    const projects = PROJECTS.filter((p) => {
      const wsPath = path.join(WS, p.dir);
      const profilePath = path.join(PROFILES, p.dir);
      return fs.existsSync(wsPath) || fs.existsSync(profilePath);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    }).map(({ dir: _dir, ...rest }) => rest);

    let activities: object[] = [...EXTRA_ACTIVITIES];

    if (fs.existsSync(CONV_LOG))
      activities.push(...parseConversationLog(fs.readFileSync(CONV_LOG, "utf8")));

    const thycLog = path.join(WS, "thyc_system", "work_log_whatsapp.md");
    if (fs.existsSync(thycLog))
      activities.push(...parseThycMilestones(fs.readFileSync(thycLog, "utf8")));

    const channelMd = path.join(WS, "agents", "channel.md");
    if (fs.existsSync(channelMd))
      activities.push(...parseChannelMd(fs.readFileSync(channelMd, "utf8")));

    // Deduplicate by id
    const seen = new Set<string>();
    activities = activities.filter((a) => {
      const id = (a as { id: string }).id;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    activities.sort((a, b) => (a as { timestamp: number }).timestamp - (b as { timestamp: number }).timestamp);

    const notes = buildNotes();

    return NextResponse.json({
      projects,
      activities,
      notes,
      summary: { projects: projects.length, activities: activities.length, notes: notes.length },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
