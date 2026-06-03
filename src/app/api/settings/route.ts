import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const CONFIG_DIR = path.join(process.env.HOME ?? "/Users/mileslor", ".ai-dashboard");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readConfig(): Record<string, any> {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return {};
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function writeConfig(data: Record<string, any>) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
}

export async function GET() {
  const config = readConfig();
  return NextResponse.json({
    has_minimax_key: !!(config.minimax_api_key),
    minimax_quota: config.minimax_quota ?? null,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const config = readConfig();

    if (typeof body.minimax_api_key === "string") {
      if (body.minimax_api_key.trim() === "") {
        delete config.minimax_api_key;
      } else {
        config.minimax_api_key = body.minimax_api_key.trim();
      }
    }

    // Save manual quota sync: { used, limit, reset_at (unix ms) }
    if (body.minimax_quota !== undefined) {
      config.minimax_quota = body.minimax_quota;
    }

    writeConfig(config);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
