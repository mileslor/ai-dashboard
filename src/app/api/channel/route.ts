import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const channelPath = path.join(process.cwd(), "../../openclaw-shared/agents/channel.md");
    const content = fs.readFileSync(channelPath, "utf-8");
    return new NextResponse(content, { headers: { "Content-Type": "text/plain" } });
  } catch {
    return new NextResponse("", { status: 200 });
  }
}

export async function POST(req: Request) {
  try {
    const { content, append } = await req.json();
    const channelPath = path.join(process.cwd(), "../../openclaw-shared/agents/channel.md");
    if (append) {
      fs.appendFileSync(channelPath, content + "\n");
    } else {
      fs.writeFileSync(channelPath, content + "\n");
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
