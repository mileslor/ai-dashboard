import { NextResponse } from "next/server";
import { execSync } from "child_process";

export const dynamic = "force-dynamic";

function getOAuthToken(): string | null {
  try {
    const creds = execSync("security find-generic-password -s 'Claude Code-credentials' -w 2>/dev/null", {
      timeout: 5000,
    }).toString().trim();
    const parsed = JSON.parse(creds);
    return parsed?.claudeAiOauth?.accessToken ?? null;
  } catch {
    return null;
  }
}

async function fetchOAuthUsage(token: string) {
  const res = await fetch("https://api.anthropic.com/api/oauth/usage", {
    headers: {
      Authorization: `Bearer ${token}`,
      "anthropic-beta": "oauth-2025-04-20",
      "User-Agent": "claude-code/2.1.76",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export async function GET() {
  try {
    // ccusage for local session detail (burn rate, today cost, etc.)
    const blocksJson = execSync("npx --yes ccusage blocks --json 2>/dev/null", {
      timeout: 15000,
      env: { ...process.env, PATH: `/Users/mileslor/.bun/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH}` },
    }).toString();

    const dailyJson = execSync("npx --yes ccusage daily --json 2>/dev/null", {
      timeout: 15000,
      env: { ...process.env, PATH: `/Users/mileslor/.bun/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH}` },
    }).toString();

    const blocks = JSON.parse(blocksJson).blocks ?? [];
    const daily = JSON.parse(dailyJson).daily ?? [];

    const activeBlock = blocks.find((b: { isActive: boolean }) => b.isActive) ?? blocks[blocks.length - 1] ?? null;

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayData = daily.find((d: { date: string }) => d.date === todayStr) ?? null;

    const sessionTotal = activeBlock
      ? (activeBlock.tokenCounts?.inputTokens ?? 0) +
        (activeBlock.tokenCounts?.outputTokens ?? 0) +
        (activeBlock.tokenCounts?.cacheCreationInputTokens ?? 0)
      : 0;

    const sessionElapsedMin = activeBlock?.startTime
      ? Math.round((Date.now() - new Date(activeBlock.startTime).getTime()) / 60000)
      : 0;

    const burnRatePerHour =
      sessionTotal > 0 && sessionElapsedMin > 0
        ? Math.round((sessionTotal / sessionElapsedMin) * 60)
        : 0;

    // OAuth usage — cross-machine accurate quota percentages
    let oauthUsage = null;
    const token = getOAuthToken();
    if (token) {
      oauthUsage = await fetchOAuthUsage(token);
    }

    const fiveHour = oauthUsage?.five_hour ?? null;
    const sevenDay = oauthUsage?.seven_day ?? null;
    const extraUsage = oauthUsage?.extra_usage ?? null;

    return NextResponse.json({
      // Today
      today_input: todayData?.inputTokens ?? 0,
      today_output: todayData?.outputTokens ?? 0,
      today_cache_create: todayData?.cacheCreationTokens ?? 0,
      today_cache_read: todayData?.cacheReadTokens ?? 0,
      today_total: todayData?.totalTokens ?? 0,

      // Current session (active billing block) — local machine only
      session_total: sessionTotal,
      session_start_ts: activeBlock?.startTime ?? null,
      session_elapsed_min: sessionElapsedMin,
      burn_rate_per_hour: burnRatePerHour,

      // OAuth quota — cross-machine accurate
      five_hour_utilization: fiveHour?.utilization ?? null,
      five_hour_resets_at: fiveHour?.resets_at ?? null,
      seven_day_utilization: sevenDay?.utilization ?? null,
      seven_day_resets_at: sevenDay?.resets_at ?? null,

      // Extra usage
      extra_enabled: extraUsage?.is_enabled ?? false,
      extra_used_usd: extraUsage?.used_credits ?? null,
      extra_limit_usd: extraUsage?.monthly_limit ?? null,
      extra_utilization: extraUsage?.utilization ?? null,

      // Cost (local ccusage)
      today_cost_usd: todayData?.totalCost ?? 0,
      session_cost_usd: activeBlock?.costUSD ?? 0,

      timestamp: Date.now(),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
