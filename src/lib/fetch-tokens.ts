import type { MiniMaxQuota } from "./token-api";

export async function fetchMiniMaxQuota(_apiKey: string): Promise<MiniMaxQuota | null> {
  try {
    const res = await fetch("/api/minimax", { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error) return null;
    return data as MiniMaxQuota;
  } catch {
    return null;
  }
}

export interface ClaudeUsage {
  today_input: number;
  today_output: number;
  today_cache_create: number;
  today_cache_read: number;
  today_total: number;
  session_total: number;
  session_start_ts: string | null;
  session_elapsed_min: number;
  burn_rate_per_hour: number;
  // OAuth quota (cross-machine)
  five_hour_utilization: number | null;
  five_hour_resets_at: string | null;
  seven_day_utilization: number | null;
  seven_day_resets_at: string | null;
  extra_enabled: boolean;
  extra_used_usd: number | null;
  extra_limit_usd: number | null;
  extra_utilization: number | null;
  // Cost
  today_cost_usd: number;
  session_cost_usd: number;
  timestamp: number;
}

export async function fetchClaudeTokens(): Promise<ClaudeUsage | null> {
  try {
    const res = await fetch("/api/claude-usage", { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
