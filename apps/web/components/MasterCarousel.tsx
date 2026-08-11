"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { MASTERS } from "@/content/masters";

export default function MasterCarousel() {
  const trackRef = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);
  const [atEnd, setAtEnd] = useState(false);

  function cardStep() {
    const track = trackRef.current;
    const card = track?.querySelector<HTMLElement>(".master-carousel-item");
    if (!track || !card) return 0;
    const styles = getComputedStyle(track);
    return card.getBoundingClientRect().width + Number.parseFloat(styles.columnGap || styles.gap);
  }

  function move(direction: -1 | 1) {
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth";
    trackRef.current?.scrollBy({ left: cardStep() * direction, behavior });
  }

  function updateActive() {
    const track = trackRef.current;
    const step = cardStep();
    if (!track || !step) return;
    setActive(Math.min(MASTERS.length - 1, Math.max(0, Math.round(track.scrollLeft / step))));
    setAtEnd(track.scrollLeft >= track.scrollWidth - track.clientWidth - 1);
  }

  return (
    <section className="master-carousel" aria-label="투자 대가 선택">
      <button
        type="button"
        className="master-carousel-arrow"
        data-side="prev"
        aria-label="이전 대가 보기"
        disabled={active === 0}
        onClick={() => move(-1)}
      >
        <span aria-hidden="true">←</span>
      </button>

      <ul ref={trackRef} className="master-carousel-track" onScroll={updateActive}>
        {MASTERS.map((master) => {
          const featured = master.id === "buffett";
          return (
            <li key={master.id} className="master-carousel-item">
              <Link
                href={`/learn/masters/${master.id}`}
                className="master-card"
                data-featured={featured ? "true" : undefined}
              >
                <span className="master-card-art">
                  <img
                    className={featured ? "master-card-main-character" : "master-card-portrait"}
                    src={featured ? "/characters/buffett/main.png" : `/investors/${master.id}.png`}
                    alt=""
                  />
                </span>
                <span className="master-card-body">
                  <span className="style-name">{master.styleName}</span>
                  <strong className="master-card-name">{master.name}</strong>
                  <span className="master-card-line">{master.oneLine}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        className="master-carousel-arrow"
        data-side="next"
        aria-label="다음 대가 보기"
        disabled={atEnd}
        onClick={() => move(1)}
      >
        <span aria-hidden="true">→</span>
      </button>

      <p className="master-carousel-progress" aria-live="polite">
        <strong>{active + 1}</strong> / {MASTERS.length}
      </p>
    </section>
  );
}
