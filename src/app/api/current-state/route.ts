import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const HOME = process.env.HOME ?? "/Users/mileslor";
const STATE_FILE = path.join(HOME, "workspace", "current-state.md");

interface ProjectStatus {
  title: string;
  icon: string;
  status: string;
  detail: string;
}

interface ParsedState {
  lastUpdated: string;
  activeNow: string[];
  projects: ProjectStatus[];
  pending: string[];
  decisions: string[];
}

function parseStateFile(content: string): ParsedState {
  const lastUpdated = content.match(/最後更新：(\d{4}-\d{2}-\d{2})/)?.[1] ?? "";

  // Active Now
  const activeRaw = content.match(/## 🔴 宜家做緊 · Active Now\n\n([\s\S]*?)(?=\n---)/)?.[1] ?? "";
  const activeNow = activeRaw
    .split("\n")
    .map((l) => l.replace(/^[-*]\s*/, "").trim())
    .filter((l) => l && !l.startsWith("_"));

  // Projects — each block: ### Title Icon Status\n- detail
  const projects: ProjectStatus[] = [];
  const projectBlocks = content.matchAll(/### (.+?) ([⚠️🟡🟢🔴🔵]+) (.+?)\n- (.+?)(?=\n|$)/g);
  for (const m of projectBlocks) {
    projects.push({
      title: m[1].trim(),
      icon: m[2].trim(),
      status: m[3].trim(),
      detail: m[4].trim(),
    });
  }

  // Pending
  const pendingRaw = content.match(/## ⏳ 等待處理 · Pending\n\n([\s\S]*?)(?=\n---)/)?.[1] ?? "";
  const pending = pendingRaw
    .split("\n")
    .map((l) => l.replace(/^- \[[ x]\] /, "").trim())
    .filter(Boolean);

  // Recent decisions (last 3)
  const decisionsRaw = content.match(/## 🗒️ 最近決定 · Recent Decisions\n\n([\s\S]*?)$/)?.[1] ?? "";
  const decisions = decisionsRaw
    .split("\n")
    .map((l) => l.replace(/^- /, "").trim())
    .filter(Boolean)
    .slice(0, 3);

  return { lastUpdated, activeNow, projects, pending, decisions };
}

export async function GET() {
  try {
    if (!fs.existsSync(STATE_FILE)) {
      return NextResponse.json({ error: "current-state.md not found" }, { status: 404 });
    }
    const content = fs.readFileSync(STATE_FILE, "utf8");
    const parsed = parseStateFile(content);
    return NextResponse.json(parsed);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
