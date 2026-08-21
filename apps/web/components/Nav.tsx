"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthNav from "./AuthNav";

const ITEMS = [
  { href: "/learn", label: "배우기" },
  { href: "/screener/buffett", label: "종목 찾기", match: "/screener" },
  { href: "/me", label: "마이페이지" },
];

export default function Nav() {
  const pathname = usePathname() ?? "/";

  return (
    <header className="masthead">
      <div className="wrap masthead-inner">
        <Link href="/" className="wordmark">
          Wisor<span>학습</span>
        </Link>
        <nav className="nav" aria-label="주요 메뉴">
          {ITEMS.map((item) => {
            const base = item.match ?? item.href;
            const active = pathname === base || pathname.startsWith(`${base}/`);
            return (
              <Link key={item.href} href={item.href} data-active={active}>
                {item.label}
              </Link>
            );
          })}
          <AuthNav />
        </nav>
      </div>
    </header>
  );
}
