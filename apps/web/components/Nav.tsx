"use client";

import Image from "next/image";
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
  /* 종목 찾기 화면은 아래 철학 탭이 wrap-wide(1700px)를 쓴다. 헤더가 좁은
     wrap(1080px)에 머물면 로고·로그인 위치가 탭 첫 칸(버핏)·마지막 칸(그린블랫)
     위에서 벗어난다 — 같은 너비를 써서 두 줄의 좌우 끝을 맞춘다.
     기본 화면(홈)도 가장자리까지 그림이 꽉 차는 레이아웃이라 같은 이유로
     맞춘다.
     배우기·마이페이지·로그인은 본문이 좁은 wrap을 그대로 쓰지만, 헤더까지
     페이지마다 너비가 바뀌면 오갈 때마다 로고·메뉴 위치가 흔들린다 — 헤더만은
     주요 화면 전부에서 같은 너비로 고정한다. */
  const isWide =
    pathname === "/" ||
    pathname.startsWith("/screener") ||
    pathname.startsWith("/learn") ||
    pathname.startsWith("/me") ||
    pathname.startsWith("/login");

  return (
    <header className="masthead">
      <div className={`wrap masthead-inner${isWide ? " wrap-wide" : ""}`}>
        <Link href="/" className="wordmark">
          <Image
            src="/brand/wisor-logo.png"
            alt="Wisor"
            width={1915}
            height={821}
            priority
            className="wordmark-logo"
          />
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
