import { createClient } from "@supabase/supabase-js";

// For now: local-only mode
// Later, connect to pilottools Supabase project
const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase =
  NEXT_PUBLIC_SUPABASE_URL && NEXT_PUBLIC_SUPABASE_ANON_KEY
    ? createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)
    : null; // local-only mode

// Auth state helpers
export async function getCurrentUser() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
}

export async function signInWithEmail(email: string) {
  if (!supabase) throw new Error("Supabase not configured");
  return supabase.auth.signInWithOtp({ email });
}

export async function signOut() {
  if (!supabase) return;
  return supabase.auth.signOut();
}
