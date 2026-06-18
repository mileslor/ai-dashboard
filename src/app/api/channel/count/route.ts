import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const channelPath = path.join(process.cwd(), "../../openclaw-shared/agents/channel.md");
    const content = fs.readFileSync(channelPath, "utf-8");

    const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    const re = /^\[(ce|mx|Miles|miles)\s+(\d{4}-\d{2}-\d{2})/gim;
    let count = 0;
    let m;
    while ((m = re.exec(content)) !== null) {
      if (m[2] === today) count++;
    }

    return NextResponse.json({ count, today });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
