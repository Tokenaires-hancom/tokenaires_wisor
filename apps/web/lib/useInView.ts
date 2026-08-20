"use client";

import { useEffect, useRef, useState } from "react";

/** 화면에 들어오면 true, 나가면 다시 false가 된다.
 *
 *  볼 때마다 다시 튼다 — data-in이 빠졌다 붙을 때 CSS 애니메이션이 처음부터 다시 돈다.
 *
 *  진입 동작은 CSS가 맡는다. 여기서는 언제 트는지만 정한다 — JS가 멈추더라도 요소는
 *  CSS의 평상 상태(보이는 상태)로 남아야 하므로 시작 상태를 JS로 찍지 않는다. */
export function useInView<T extends HTMLElement>(amount = 0.3) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      threshold: amount,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [amount]);

  return [ref, inView] as const;
}
