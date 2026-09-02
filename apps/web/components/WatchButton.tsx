"use client";

import { useEffect, useState } from "react";
import { isWatched, toggleWatch } from "@/lib/store";
import { track } from "@/lib/analytics";

export default function WatchButton({
  ticker,
  size = "md",
}: {
  ticker: string;
  /** "sm"은 목록 줄처럼 고정 행 높이(28px 로고 칸)에 맞춰야 하는 자리에 쓴다. */
  size?: "sm" | "md";
}) {
  const [watched, setWatched] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    void isWatched(ticker).then((value) => {
      if (!alive) return;
      setWatched(value);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [ticker]);

  const filled = ready && watched;

  return (
    <button
      type="button"
      className="watch-heart-btn"
      data-size={size}
      data-watched={filled ? "true" : undefined}
      onClick={() => {
        void toggleWatch(ticker).then((next) => {
          setWatched(next);
          if (next) track("watchlist_added", { ticker });
        });
      }}
      aria-pressed={watched}
      aria-label={filled ? "관심종목에서 빼기" : "관심종목에 담기"}
    >
      <svg viewBox="0 0 24 24" width="1.4em" height="1.4em" aria-hidden="true">
        <path
          d="M12 21s-7.5-4.6-10.2-9.1C.1 8.7 1 5.3 4.1 4.1 6.4 3.2 8.9 4 10.4 6c.6.8 1.2 1.8 1.6 2.5.4-.7 1-1.7 1.6-2.5C15.1 4 17.6 3.2 19.9 4.1c3.1 1.2 4 4.6 2.3 7.8C19.5 16.4 12 21 12 21z"
          fill={filled ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
