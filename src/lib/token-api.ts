import { db } from "./db";
import { fetchMiniMaxQuota, fetchClaudeTokens } from "./fetch-tokens";

export interface MiniMaxQuota {
  available_text: number;
  available_speech: number;
  available_video: number;
  total_text: number;
  used_text: number;
}

export interface TokenData {
  provider: string;
  emoji: string;
  contextUsed: number;
  contextMax: number;
  quotaUsed?: number;
  quotaTotal?: number;
  lastUpdated: number;
  error?: string;
}

// ─── Token History (Dexie) ──────────────────────────────────────────────────

export interface TokenSnapshot {
  id?: number;
  provider: "minimax" | "claude";
  tokens_used: number;
  context_used: number;
  timestamp: number;
}

export async function getTokenHistory(
  provider: "minimax" | "claude",
  limit = 10
): Promise<TokenSnapshot[]> {
  try {
    return await db.tokenHistory
      .where("provider")
      .equals(provider)
      .reverse()
      .limit(limit)
      .sortBy("timestamp");
  } catch {
    return [];
  }
}

export { fetchMiniMaxQuota, fetchClaudeTokens };
