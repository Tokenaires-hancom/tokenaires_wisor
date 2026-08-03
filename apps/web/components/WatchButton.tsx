"use client";

import { useEffect, useState } from "react";
import { isWatched, toggleWatch } from "@/lib/store";
import { track } from "@/lib/analytics";

export default function WatchButton({ ticker }: { ticker: string }) {
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

  return (
    <button
      type="button"
      className="btn"
      data-variant={watched ? undefined : "quiet"}
      onClick={() => {
        void toggleWatch(ticker).then((next) => {
          setWatched(next);
          if (next) track("watchlist_added", { ticker });
        });
      }}
      aria-pressed={watched}
    >
      {ready && watched ? "관심종목에 담김" : "관심종목에 담기"}
    </button>
  );
}
