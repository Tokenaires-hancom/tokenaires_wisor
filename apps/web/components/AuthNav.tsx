"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { syncLearningState } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";

export default function AuthNav() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) void syncLearningState();
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) void syncLearningState();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (!user) {
    const href = pathname === "/login" ? "/login" : `/login?next=${encodeURIComponent(pathname)}`;
    return <Link className="nav-account" href={href} data-active={pathname === "/login"}>로그인</Link>;
  }

  return (
    <button
      type="button"
      className="nav-account nav-account-user"
      title={`${user.email ?? "Wisor 계정"} 로그아웃`}
      onClick={async () => {
        const supabase = createClient();
        if (!supabase) return;
        await supabase.auth.signOut();
        router.push("/");
        router.refresh();
      }}
    >
      <span aria-hidden="true">{(user.email ?? "W").slice(0, 1).toUpperCase()}</span>
      로그아웃
    </button>
  );
}
