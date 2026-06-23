import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const HOME = process.env.HOME ?? "/Users/mileslor";
const WS = path.join(HOME, "workspace");

export async function GET() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    let count = 0;

    // Count today's channel.md entries
    const channelPath = path.join(WS, "agents", "channel.md");
    if (fs.existsSync(channelPath)) {
      const content = fs.readFileSync(channelPath, "utf-8");
      const re = /^\[(ce|mx|user|Miles|miles)\s+(\d{4}-\d{2}-\d{2})/gim;
      let m;
      while ((m = re.exec(content)) !== null) {
        if (m[2] === today) count++;
      }
    }

    // Count today's conversation-log.md entries
    const convLog = path.join(HOME, ".claude", "conversation-log.md");
    if (fs.existsSync(convLog)) {
      const content = fs.readFileSync(convLog, "utf-8");
      const sections = content.split(/^## /m).filter(Boolean);
      for (const section of sections) {
        if (!section.startsWith(today)) continue;
        const bullets = section.match(/^- (?!\[).+$/gm) ?? [];
        const sessionTitles = section.match(/^### .+$/gm) ?? [];
        count += bullets.length + sessionTitles.length;
      }
    }

    return NextResponse.json({ count, today });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
