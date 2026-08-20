"use client";

import { useEffect, useState } from "react";

/** 긴 화면에서 맨 위로 돌아가는 버튼. 한 화면 이상 내려가야 나타난다.
 *  왼쪽 아래는 좁은 화면에서 대가 이동 독(.mobile-master-dock)이 쓰므로
 *  오른쪽 아래에 둔다. 숨김/표시는 CSS가 담당하고, 이 컴포넌트는 항상
 *  렌더링된다. */
export default function ScrollTop() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("hv-home-active");
    /* 화면 높이에 비례해 잡으면 세로가 긴 모니터에서 끝까지 내려도 문턱을
     * 못 넘는 페이지가 생긴다. 짧은 페이지에서도 나오도록 고정값으로 둔다. */
    const onScroll = () => setShown(window.scrollY > 320);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.documentElement.classList.remove("hv-home-active");
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <button
      type="button"
      className="scroll-top"
      data-shown={shown}
      aria-label="맨 위로"
      onClick={() =>
        window.scrollTo({
          top: 0,
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
        })
      }
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
        <path
          d="M12 19V6M12 6l-6 6M12 6l6 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
