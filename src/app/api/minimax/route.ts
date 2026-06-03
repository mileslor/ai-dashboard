import { NextResponse } from "next/server";
import path from "path";

export const dynamic = "force-dynamic";

const CONFIG_PATH = "/Users/mileslor/.openclaw/openclaw.json";
const LOCAL_CONFIG = path.join(process.env.HOME ?? "/Users/mileslor", ".ai-dashboard", "config.json");
const QUOTA_ENDPOINTS = [
  "https://api.minimaxi.com/v1/query/quota",
  "https://api.minimaxi.chat/v1/query/quota",
  "https://api.minimax.chat/v1/query/quota",
];

async function tryQuota(apiKey: string): Promise<Response | null> {
  for (const url of QUOTA_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) return res;
    } catch {
      // try next
    }
  }
  return null;
}

export async function GET() {
  try {
    const fs = await import("fs");
    let apiKey = "";

    // 1. Check local dashboard config first (real key takes priority)
    try {
      const local = JSON.parse(fs.readFileSync(LOCAL_CONFIG, "utf8"));
      apiKey = local?.minimax_api_key ?? "";
    } catch { /* file may not exist */ }

    // 2. Fall back to openclaw.json proxy key
    if (!apiKey) {
      try {
        const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
        apiKey =
          config?.models?.providers?.minimax?.apiKey ??
          config?.MINIMAX_API_KEY ??
          config?.OPENCLAW_API_KEY ??
          "";
      } catch {
        return NextResponse.json({ error: "Cannot read openclaw.json" }, { status: 500 });
      }
    }

    if (!apiKey) {
      return NextResponse.json({ error: "No MiniMax API key found" }, { status: 400 });
    }

    const res = await tryQuota(apiKey);
    if (!res) {
      // Quota API not accessible with proxy key — return key info so client knows why
      return NextResponse.json(
        { error: "proxy_key", message: "OpenClaw proxy key — quota API unavailable" },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
