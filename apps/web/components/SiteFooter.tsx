"use client";

import { usePathname } from "next/navigation";

/** 종목 찾기는 스크롤 없이 한 화면에 우겨넣는 고정 화면이다. 이 고지 문단은
 *  그 자리를 낼 수 없어 이 라우트에서만 숨긴다. 투자자 미보증 문단은
 *  `/learn/masters/[slug]`에도 필요해 다른 화면에서는 그대로 남는다.
 *
 *  `Nav.tsx`가 이미 같은 방식(`usePathname()`으로 현재 라우트를 갈라 보기)을
 *  쓰고 있어서 처음 보는 패턴이 아니다. */
export default function SiteFooter() {
  const pathname = usePathname() ?? "/";
  if (pathname.startsWith("/screener")) return null;

  return (
    <footer className="foot">
      <div className="wrap">
        <p>
          투자 철학은 각 투자자가 공개한 원칙을 참고해 Wisor가 재구성한 것입니다. 해당
          투자자가 이 서비스에 참여하거나 이를 보증하지 않습니다.
        </p>
      </div>
    </footer>
  );
}
