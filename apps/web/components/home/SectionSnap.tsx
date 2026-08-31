"use client";

import { useEffect } from "react";

/** 예전 home-v5.css의 scroll-snap-type: y proximity 조건과 같다 — 그 CSS 규칙을
 *  이 컴포넌트가 대신한다. 네이티브 스냅과 이 컴포넌트가 동시에 스크롤을 건드리면
 *  드래그 때처럼 부딪힌다(HomeMasters.tsx의 DRAG_RATIO 주석 참고). */
const ACTIVE_WHEN = "(min-width: 768px) and (prefers-reduced-motion: no-preference)";
/** .hv-scene에 이미 걸려 있는 scroll-margin-top과 같은 값이다. */
const HEADER = 61;
/** 양쪽 정지점 모두 이보다(화면 높이 배수) 멀면 대가 카드 구간처럼 화면보다 훨씬
 *  긴 섹션 한가운데다 — 손대지 않는다. 안 그러면 카드 넘기다 살짝 멈춰도 다음
 *  섹션으로 끌려간다. */
const REACH = 1;
/** 당기는 자리가 목표에 가까워지는 비율. HomeMasters.tsx의 GLIDE와 같은 방식이되,
 *  값을 낮춰 카드보다 훨씬 천천히 붙게 한다. */
const PULL = 0.12;
/** 이보다 가까우면 붙은 것으로 보고 애니메이션을 멈춘다(px). */
const CLOSE = 0.5;
/** 마지막 scroll 이벤트 뒤 이만큼(ms) 조용하면 스크롤이 "멈췄다"고 본다.
 *  scrollend 이벤트를 쓰지 않는다 — 이 프로젝트가 지원하는 범위에서도 프로그램이
 *  건 즉시 스크롤(behavior: instant)에는 안 붙는 경우가 있어, scroll 이벤트
 *  디바운스 하나로 통일하는 편이 더 믿을 만하다. */
const SETTLE_MS = 150;

/** 대가 카드 붙잡기 구간 안의 카드별 정지점(.hv-masters-stop)은 건드리지 않는다 —
 *  그건 HomeMasters.tsx가 이미 스스로 맡고 있다. 여기서는 큰 섹션끼리의 경계만 본다. */
export default function SectionSnap() {
  useEffect(() => {
    const active = window.matchMedia(ACTIVE_WHEN);
    const home = document.querySelector<HTMLElement>(".hv-home");
    if (!home) return;

    let raf = 0;
    let timer: number | undefined;
    let pulling = false;
    /* 직전에 있던(또는 있기로 한) 자리. 다음 판단의 방향 기준점이다. */
    let restY: number | null = null;

    /* 대가 섹션은 붙잡히는 동안 통(.hv-masters-pin-outer)이 실제 스크롤 길이를
       갖고, 안의 .hv-scene.hv-masters는 sticky라 위치가 고정돼 있다 — 그래서
       .hv-scene 대신 이 통을 정지점으로 쓴다. */
    const stops = () =>
      Array.from(home.children)
        .filter(
          (el): el is HTMLElement =>
            el instanceof HTMLElement &&
            (el.classList.contains("hv-scene") || el.classList.contains("hv-masters-pin-outer")),
        )
        .map((el) => el.getBoundingClientRect().top + window.scrollY - HEADER);

    const cancelPull = () => {
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      pulling = false;
    };

    const pullTo = (target: number) => {
      pulling = true;
      const step = () => {
        const gap = target - window.scrollY;
        if (Math.abs(gap) < CLOSE) {
          window.scrollTo({ top: target, behavior: "instant" });
          pulling = false;
          raf = 0;
          return;
        }
        window.scrollTo({ top: window.scrollY + gap * PULL, behavior: "instant" });
        raf = window.requestAnimationFrame(step);
      };
      raf = window.requestAnimationFrame(step);
    };

    const nearest = (list: number[], y: number) =>
      list.reduce((best, s) => (Math.abs(s - y) < Math.abs(best - y) ? s : best));

    const settle = () => {
      if (pulling || !active.matches) return;
      const list = stops();
      if (list.length < 2) return;
      const y = window.scrollY;
      if (restY === null || y === restY) {
        restY = y;
        return;
      }
      const rest = restY;
      const vh = window.innerHeight;
      const down = y > rest;
      /* 떠나온 정지점(departure)과 그 다음으로 갈 정지점(arrival)을, 방금 있던
         자리(rest) 기준으로 고른다 — y 기준으로 고르면 방향을 알 수 없다. */
      const departure = down
        ? [...list].reverse().find((s) => s <= rest) ?? list[0]
        : list.find((s) => s >= rest) ?? list[list.length - 1];
      const arrival = down
        ? list[list.indexOf(departure) + 1]
        : list[list.indexOf(departure) - 1];

      if (arrival === undefined) {
        restY = y;
        return; // 이미 처음 또는 마지막 섹션이다
      }

      /* 한 번에 정지점을 두 개 이상 지나치는 빠른 플릭은 가장 가까운 정지점으로
         보낸다 — departure/arrival 사이를 벗어난 경우다. */
      if (down ? y > arrival : y < arrival) {
        const target = nearest(list, y);
        restY = target;
        if (Math.abs(target - y) >= CLOSE) pullTo(target);
        return;
      }

      /* 대가 카드 구간처럼 화면보다 훨씬 긴 섹션 한가운데면 손대지 않는다. */
      const farFromDeparture = Math.abs(y - departure) > vh * REACH;
      const farFromArrival = Math.abs(arrival - y) > vh * REACH;
      if (farFromDeparture && farFromArrival) {
        restY = y;
        return;
      }

      /* 거리는 안 본다 — 방향만 보고 그쪽 다음 정지점으로 붙는다. */
      restY = arrival;
      if (Math.abs(arrival - y) >= CLOSE) pullTo(arrival);
    };

    const onScroll = () => {
      if (pulling) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(settle, SETTLE_MS);
    };
    /* 당기는 도중 사용자가 다시 휠·터치를 쓰면 즉시 손을 놓는다 — 안 그러면
       붙잡혀서 안 놓아주는 느낌이 든다. */
    const onInterrupt = () => cancelPull();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onInterrupt, { passive: true });
    window.addEventListener("touchstart", onInterrupt, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onInterrupt);
      window.removeEventListener("touchstart", onInterrupt);
      window.clearTimeout(timer);
      cancelPull();
    };
  }, []);

  return null;
}
