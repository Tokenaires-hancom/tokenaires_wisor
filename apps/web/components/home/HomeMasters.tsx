"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { pinProgress } from "@/lib/pinProgress";

export type MasterCard = {
  id: string;
  name: string;
  styleName: string;
  oneLine: string;
};

/** 피그마가 카드마다 다르게 준 기울기. 무대에 흩어 놓은 느낌을 이 값이 만든다. */
const TILT = [2, 6, -3, 3, -4, 4, -6];

/** 이 폭 아래로는 섹션이 세로 배치로 바뀐다. 붙잡지 않고 손으로 미는 방식을 그대로 둔다. */
const PIN_FROM = "(min-width: 1200px)";

export default function HomeMasters({ masters }: { masters: MasterCard[] }) {
  const outer = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLSpanElement>(null);

  /** 붙잡아 두고 카드를 가로로 민다.
   *
   *  스크롤을 가로채지 않는다. 통을 길게 만들어 두고 그 안의 sticky가 화면에 붙는
   *  동안, 통을 얼마나 지나왔는지만 읽어 트랙을 옮긴다. 그래서 휠·트랙패드·키보드·
   *  스크롤바가 전부 평소대로 동작한다.
   *
   *  핀은 CSS 기본값이 아니라 여기서 켠다. 이 코드가 뜨지 않으면 통은 그냥 평범한
   *  div로 남고 트랙은 지금처럼 손으로 밀 수 있다 — 카드가 영영 안 움직이는 화면이
   *  되지 않는다. */
  useEffect(() => {
    const outerEl = outer.current;
    const sceneEl = scene.current;
    const trackEl = track.current;
    if (!outerEl || !sceneEl || !trackEl) return;

    const wide = window.matchMedia(PIN_FROM);
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");

    /** 카드 한 장을 넘기는 데 드는 스크롤을, 카드가 실제로 가는 거리보다 길게 잡는다.
     *  1이면 손과 카드가 1:1로 붙어 카드가 눈보다 빨리 지나간다. */
    const SLOW = 1.35;
    /** 그려진 자리가 목표를 따라가는 비율. 작을수록 더 미끄러지고, 크면 더 빨리 붙는다.
     *  스냅이 스크롤을 순간이동시켜도 카드는 이 비율로 뒤따라가 부드럽게 붙는다. */
    const GLIDE = 0.19;
    /** 이만큼 끌면 넘기려는 뜻으로 보고, 그 위의 링크는 열지 않는다(px). */
    const SLOP = 6;
    /** 이보다 가까우면 붙은 것으로 보고 프레임을 멈춘다(px). */
    const CLOSE = 0.5;

    let travel = 0; /* 카드가 가로로 가는 거리 */
    let pinnable = 0; /* 붙잡혀 있는 동안 스크롤되는 거리 = travel × SLOW */
    let shown = 0; /* 지금 그려진 가로 위치 */
    let want = 0; /* 스크롤이 가리키는 가로 위치 */
    let frame = 0;
    let dragging = false;
    let lastX = 0;
    let dragged = 0; /* 끈 거리의 합 — 링크를 열지 말지 가른다 */

    const fill = (p: number) => {
      if (bar.current) bar.current.style.transform = `scaleX(${p})`;
    };

    const paint = () => {
      trackEl.style.transform = `translate3d(${-shown}px, 0, 0)`;
      fill(travel > 0 ? shown / travel : 0);
    };

    /** 목표까지 남은 거리의 일부씩만 좁힌다 — 급하게 서지 않고 미끄러져 붙는다. */
    const glide = () => {
      frame = 0;
      const gap = want - shown;
      if (Math.abs(gap) < CLOSE) {
        shown = want;
        paint();
        return;
      }
      shown += gap * GLIDE;
      paint();
      frame = window.requestAnimationFrame(glide);
    };

    const aim = () => {
      want = pinProgress(outerEl.getBoundingClientRect().top, pinnable) * travel;
    };

    const ask = () => {
      aim();
      /* 끄는 동안에는 미끄러뜨리지 않는다 — 손과 카드가 어긋나면 굼떠 보인다. */
      if (dragging) {
        shown = want;
        paint();
        return;
      }
      if (!frame) frame = window.requestAnimationFrame(glide);
    };

    /** 카드를 손으로 끄는 길.
     *
     *  붙잡힌 동안 트랙은 스크롤 컨테이너가 아니라 transform으로 움직이는 판이라,
     *  트랙을 직접 스크롤시킬 수 없다. 그래서 끈 거리를 페이지 스크롤로 바꾼다 —
     *  카드를 왼쪽으로 끌면 그만큼 아래로 스크롤되고, 손을 떼면 스냅이 가까운
     *  카드에 세운다. 끄는 값에 SLOW를 곱해야 손과 카드가 1:1로 붙는다.
     *
     *  scroll-behavior: smooth가 걸려 있어 그냥 스크롤하면 한 박자 늦게 따라온다.
     *  끄는 동안에는 instant로 즉시 옮긴다. */
    const grab = (e: PointerEvent) => {
      if (e.button !== 0) return;
      dragging = true;
      lastX = e.clientX;
      dragged = 0;
      trackEl.setPointerCapture(e.pointerId);
      trackEl.classList.add("is-dragging");
    };

    const haul = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      dragged += Math.abs(dx);
      window.scrollBy({ top: -dx * SLOW, behavior: "instant" });
    };

    const drop = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      if (trackEl.hasPointerCapture(e.pointerId)) trackEl.releasePointerCapture(e.pointerId);
      trackEl.classList.remove("is-dragging");
      /* 손을 뗀 자리에서 스냅이 걸리도록 한 번 흔들어 준다. */
      window.scrollBy({ top: 0, left: 0 });
    };

    /** 끌고 나서 손을 뗀 것은 카드를 열려는 뜻이 아니다. */
    const hush = (e: MouseEvent) => {
      if (dragged <= SLOP) return;
      e.preventDefault();
      e.stopPropagation();
    };

    /** 링크와 그림은 기본 끌기(고스트 이미지)가 있어 넘기기를 방해한다. */
    const noGhost = (e: DragEvent) => e.preventDefault();

    /** 붙잡지 않는 화면에서는 트랙을 손으로 미는 만큼 막대가 찬다.
     *  이게 없으면 좁은 화면에서 막대가 영영 비어 있다. */
    const readTrack = () => {
      const span = trackEl.scrollWidth - trackEl.clientWidth;
      fill(span > 0 ? trackEl.scrollLeft / span : 0);
    };

    /** 밀 거리를 잰다. 카드 수가 바뀌거나 창 폭이 달라져도 잰 값을 쓰므로 손댈 곳이 없다.
     *
     *  카드는 1440을 넘어 화면 끝까지 흘러나오므로, 기준은 트랙의 scrollWidth가 아니라
     *  마지막 카드의 오른쪽 끝이다. 다 밀었을 때 그 끝이 화면 오른쪽에 서야 오른쪽에
     *  흰 여백이 남지 않는다. */
    /** 카드가 한 장씩 서는 자리를 통 안에 심는다.
     *
     *  카드 i가 화면 가운데 오는 지점은 트랙을 (카드중심 − 화면중심)만큼 민 때다.
     *  민 거리는 곧 통을 지나온 거리(p·travel)이므로, 그 값을 통 안의 top으로 주면
     *  브라우저가 거기에 맞춰 멈춘다. 다 민 뒤(travel)로는 갈 수 없어 마지막 두 장은
     *  같은 자리를 쓴다 — 그 자리가 마지막 카드 오른쪽이 화면 끝에 서는 지점이다.
     *
     *  트랙의 transform이 걷힌 상태에서만 부를 것. 걸린 채로 재면 민 만큼 밀려 나온다. */
    const mark = () => {
      const half = window.innerWidth / 2;
      const seen = new Set<number>();
      const stops: number[] = [];
      for (const card of Array.from(trackEl.children) as HTMLElement[]) {
        const box = card.getBoundingClientRect();
        const go = Math.min(Math.max(box.left + box.width / 2 - half, 0), travel);
        /* 통 안에서의 자리는 카드가 가는 거리가 아니라 그만큼 스크롤한 거리다. */
        const at = Math.round(go * SLOW);
        if (seen.has(at)) continue;
        seen.add(at);
        stops.push(at);
      }
      outerEl.querySelectorAll(".hv-masters-stop").forEach((s) => s.remove());
      for (const at of stops) {
        const dot = document.createElement("div");
        dot.className = "hv-masters-stop";
        dot.style.top = `${at}px`;
        outerEl.appendChild(dot);
      }
    };

    const measure = () => {
      const last = trackEl.lastElementChild as HTMLElement | null;
      if (last) {
        trackEl.style.transform = "none";
        travel = Math.max(0, last.getBoundingClientRect().right - window.innerWidth);
        pinnable = travel * SLOW;
        mark();
      }
      outerEl.style.height = `${sceneEl.offsetHeight + pinnable}px`;
      /* 섹션이 화면보다 높으면(노트북) 아래를 화면 바닥에 맞춰 카드가 잘리지 않게 한다. */
      outerEl.style.setProperty(
        "--hv-pin-top",
        `${Math.min(0, window.innerHeight - sceneEl.offsetHeight)}px`,
      );
      /* 다시 잰 직후에는 미끄러질 이유가 없다 — 목표에 바로 세워 둔다. */
      aim();
      shown = want;
      paint();
    };

    const release = () => {
      outerEl.removeAttribute("data-pinned");
      outerEl.style.height = "";
      outerEl.style.removeProperty("--hv-pin-top");
      trackEl.style.transform = "";
      if (bar.current) bar.current.style.transform = "";
      shown = 0;
      want = 0;
      /* 붙잡지 않는 화면에는 정지점이 있을 자리가 없다 — 남겨 두면 엉뚱한 곳에서 멈춘다. */
      outerEl.querySelectorAll(".hv-masters-stop").forEach((s) => s.remove());
    };

    let watching: ResizeObserver | null = null;

    /** 붙잡힌 동안에만 손으로 끌 수 있다. 붙잡지 않는 화면은 트랙 자체가
     *  가로 스크롤 컨테이너라 브라우저가 알아서 끌어 준다. */
    const listenDrag = (on: boolean) => {
      const fn = on ? trackEl.addEventListener : trackEl.removeEventListener;
      fn.call(trackEl, "pointerdown", grab as EventListener);
      fn.call(trackEl, "pointermove", haul as EventListener);
      fn.call(trackEl, "pointerup", drop as EventListener);
      fn.call(trackEl, "pointercancel", drop as EventListener);
      fn.call(trackEl, "dragstart", noGhost as EventListener);
      fn.call(trackEl, "click", hush as EventListener, true);
    };

    const apply = () => {
      if (!(wide.matches && !still.matches)) {
        watching?.disconnect();
        watching = null;
        window.removeEventListener("scroll", ask);
        listenDrag(false);
        release();
        trackEl.addEventListener("scroll", readTrack, { passive: true });
        readTrack();
        return;
      }
      trackEl.removeEventListener("scroll", readTrack);
      outerEl.setAttribute("data-pinned", "true");
      measure();
      listenDrag(false);
      listenDrag(true);
      window.addEventListener("scroll", ask, { passive: true });
      watching?.disconnect();
      watching = new ResizeObserver(measure);
      watching.observe(trackEl);
      watching.observe(sceneEl);
    };

    apply();
    wide.addEventListener("change", apply);
    still.addEventListener("change", apply);

    return () => {
      wide.removeEventListener("change", apply);
      still.removeEventListener("change", apply);
      window.removeEventListener("scroll", ask);
      trackEl.removeEventListener("scroll", readTrack);
      listenDrag(false);
      watching?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      release();
    };
  }, []);

  return (
    <div className="hv-masters-pin-outer" ref={outer}>
      <div className="hv-masters-pin">
        <section ref={scene} className="hv-scene hv-masters" aria-labelledby="hv-masters-title">
          <h2 id="hv-masters-title" className="hv-masters-title">
            어떤 기준으로 기업을 보시겠습니까?
          </h2>
          <p className="hv-masters-lede">일곱 투자 철학을 직접 넘겨보며, 나에게 맞는 판단 기준을 찾습니다.</p>

          <div className="hv-masters-meta">
            <div className="hv-masters-progress" aria-hidden="true">
              <span ref={bar} />
            </div>
          </div>

          <div className="hv-masters-track" ref={track}>
            {masters.map((m, i) => (
              <Link
                key={m.id}
                href={`/learn/masters/${m.id}`}
                className="hv-master-card"
                style={{ rotate: `${TILT[i % TILT.length]}deg` }}
              >
                <span className="hv-master-tag">{m.styleName}</span>
                <span className="hv-master-name">{m.name}</span>
                <span className="hv-master-line">{m.oneLine}</span>
                <img
                  className="hv-master-portrait"
                  src={`/home/masters/${m.id}.webp`}
                  alt=""
                  aria-hidden="true"
                  loading={i > 1 ? "lazy" : undefined}
                />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
