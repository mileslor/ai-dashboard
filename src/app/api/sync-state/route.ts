import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const HOME = process.env.HOME ?? "/Users/mileslor";
const STATE_FILE = path.join(HOME, "workspace", "current-state.md");
const PROFILES = path.join(HOME, "workspace", "profiles");

// Read active section from existing current-state.md if present
function readExistingActiveSection(): string {
  try {
    const content = fs.readFileSync(STATE_FILE, "utf8");
    const match = content.match(/## 🔴 宜家做緊 · Active Now\n([\s\S]*?)(?=\n---|\n## )/);
    return match ? match[1].trim() : "";
  } catch {
    return "";
  }
}

function readExistingDecisions(): string {
  try {
    const content = fs.readFileSync(STATE_FILE, "utf8");
    const match = content.match(/## 🗒️ 最近決定 · Recent Decisions\n([\s\S]*?)$/);
    return match ? match[1].trim() : "";
  } catch {
    return "";
  }
}

// Build project status lines from known profiles
function buildProjectSection(): string {
  const projectDefs = [
    {
      dir: "thyc_system",
      title: "THYC CRM 系統",
      icon: "⚠️",
      status: "維護中",
      detail: "合約功能 100% 完成，仍有未解決 bugs（高：GF/LS分類、義工時數、Double Count）",
    },
    {
      dir: "karaqueue",
      title: "KaraQueue",
      icon: "🟡",
      status: "進行中",
      detail: "本地 WiFi YouTube KTV 點歌系統",
    },
    {
      dir: "pilot",
      title: "PilotLog Platform",
      icon: "🟡",
      status: "進行中",
      detail: "pilot.hkmilestone.com — 飛行員工具平台",
    },
    {
      dir: "visapath",
      title: "VisaPath",
      icon: "🟡",
      status: "進行中",
      detail: "Cloudflare Pages，React + Vite",
    },
    {
      dir: "ai-dashboard",
      title: "AI Dashboard",
      icon: "🟡",
      status: "進行中",
      detail: "~/workspace/ai-dashboard，localhost:3456，Obsidian 風格",
    },
    {
      dir: "milestone",
      title: "Milestone Technology 網站",
      icon: "🟢",
      status: "維護",
      detail: "hkmilestone.com",
    },
  ];

  const lines: string[] = [];
  for (const p of projectDefs) {
    const exists = fs.existsSync(path.join(PROFILES, p.dir)) ||
      fs.existsSync(path.join(HOME, "workspace", p.dir));
    if (!exists) continue;
    lines.push(`### ${p.title} ${p.icon} ${p.status}`);
    lines.push(`- ${p.detail}`);
    lines.push("");
  }
  return lines.join("\n");
}

export async function GET() {
  const now = new Date().toISOString().split("T")[0];
  const activeSection = readExistingActiveSection();
  const decisions = readExistingDecisions();
  const projects = buildProjectSection();

  const content = `# 工作狀態 · Current State

> 此檔案係 Claude 同 MiniMax 嘅共同工作記憶。
> 每次開始工作前讀呢份，唔需要讀其他背景檔案。
> 完成工作後更新對應 section。

最後更新：${now}

---

## 🔴 宜家做緊 · Active Now

${activeSection || "_（未有記錄，請更新）_"}

---

## 📁 項目狀態 · Projects

${projects}
---

## ⏳ 等待處理 · Pending

- [ ] Telegram Bot 設定（需要 Bot Token）
- [ ] THYC bugs 修復（GF/LS分類、義工時數、Double Count）
- [ ] AI Dashboard backlinks 系統

---

## 🤖 AI 分工 · Team

| AI | 暱稱 | 負責 |
|----|------|------|
| Claude Sonnet 4.6 | \`ce\` | 寫代碼、改代碼、讀本地檔案、架構設計 |
| MiniMax M2.7 | \`mx\` | 需求分析、文檔、問答、總結、非代碼任務 |

工作流程：MiniMax 分析 → Claude 寫代碼 → MiniMax 收尾

---

## 📋 工作慣例 · Conventions

- 語言：廣東話
- 報告/文檔輸出：~/workspace/profiles/<專檔>/
- 備份：~/workspace/profiles/backup-profile.sh <專檔>

---

## 🗒️ 最近決定 · Recent Decisions

${decisions || "- 2026-05-04：確立三層 context 架構（CLAUDE.md / profiles / current-state.md）\n- 2026-05-04：AI Dashboard 設計參考定為 Obsidian 風格"}
`;

  try {
    fs.writeFileSync(STATE_FILE, content, "utf8");
    return NextResponse.json({ ok: true, path: STATE_FILE, updated: now });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body: {
      activeNow?: string;
      decisions?: string;
      pendingAdd?: string;
      pendingRemove?: string;
    } = await req.json();

    if (!fs.existsSync(STATE_FILE)) {
      return NextResponse.json({ error: "current-state.md not found, call GET first" }, { status: 404 });
    }

    let content = fs.readFileSync(STATE_FILE, "utf8");
    const now = new Date().toISOString().split("T")[0];

    content = content.replace(/最後更新：\d{4}-\d{2}-\d{2}/, `最後更新：${now}`);

    if (body.activeNow !== undefined) {
      content = content.replace(
        /(## 🔴 宜家做緊 · Active Now\n\n)([\s\S]*?)(\n---)/,
        `$1${body.activeNow}\n$3`
      );
    }

    if (body.decisions) {
      content = content.replace(
        /(## 🗒️ 最近決定 · Recent Decisions\n\n)/,
        `$1- ${now}：${body.decisions}\n`
      );
    }

    // Add a new pending item
    if (body.pendingAdd) {
      content = content.replace(
        /(## ⏳ 等待處理 · Pending\n\n)/,
        `$1- [ ] ${body.pendingAdd}\n`
      );
    }

    // Remove a pending item (mark as done by removing the line)
    if (body.pendingRemove) {
      const escaped = body.pendingRemove.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      content = content.replace(new RegExp(`- \\[[ x]\\] ${escaped}\\n?`), "");
    }

    fs.writeFileSync(STATE_FILE, content, "utf8");
    return NextResponse.json({ ok: true, updated: now });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
