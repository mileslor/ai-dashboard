import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const HOME = process.env.HOME ?? "/Users/mileslor";
const CONV_LOG = path.join(HOME, ".claude", "conversation-log.md");

interface SessionEntry {
  date: string;
  timestamp: number;
  sections: { heading: string; bullets: string[] }[];
}

function parseConversationLog(content: string): SessionEntry[] {
  const sessions: SessionEntry[] = [];

  for (const block of content.split(/^## /m).filter(Boolean)) {
    const dateMatch = block.match(/^(\d{4}-\d{2}-\d{2})/);
    if (!dateMatch) continue;
    const date = dateMatch[1];
    const ts = new Date(date).getTime();

    const sections: { heading: string; bullets: string[] }[] = [];
    let currentHeading = "記錄";
    let currentBullets: string[] = [];

    for (const line of block.split("\n").slice(1)) {
      const h3 = line.match(/^### (.+)/);
      if (h3) {
        if (currentBullets.length > 0) sections.push({ heading: currentHeading, bullets: currentBullets });
        currentHeading = h3[1].trim();
        currentBullets = [];
        continue;
      }
      // Inline log entries like [ce 2026-05-04]: text
      const inlineLog = line.match(/^- \[(ce|mx|user)[^\]]*\]:\s*(.+)/);
      if (inlineLog) {
        currentBullets.push(`[${inlineLog[1]}] ${inlineLog[2].trim()}`);
        continue;
      }
      const bullet = line.match(/^- (.+)/);
      if (bullet) currentBullets.push(bullet[1].trim());
    }
    if (currentBullets.length > 0) sections.push({ heading: currentHeading, bullets: currentBullets });

    if (sections.length > 0) sessions.push({ date, timestamp: ts, sections });
  }

  return sessions.sort((a, b) => b.timestamp - a.timestamp);
}

export async function GET() {
  if (!fs.existsSync(CONV_LOG)) {
    return NextResponse.json({ sessions: [] });
  }
  const content = fs.readFileSync(CONV_LOG, "utf8");
  const sessions = parseConversationLog(content);
  return NextResponse.json({ sessions, total: sessions.length });
}
