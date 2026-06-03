"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    // In local-only mode, skip auth check
    if (!supabase) {
      setUser(null);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user === undefined) return;
    // Local-only mode: skip redirect
    if (!supabase) return;
    if (user === null && pathname !== "/login" && pathname !== "/login/") {
      router.replace("/login/");
    }
    if (user !== null && (pathname === "/login" || pathname === "/login/")) {
      router.replace("/");
    }
  }, [user, pathname, router]);

  return <>{children}</>;
}
