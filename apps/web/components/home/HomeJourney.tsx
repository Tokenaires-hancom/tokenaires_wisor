"use client";

import { useInView } from "@/lib/useInView";

const STEPS = [
  {
    n: "01",
    label: "대가에게 배우기",
    body: ["대가의 관점을 짧게 읽고", "판단의 핵심을 잡습니다."],
  },
  {
    n: "02",
    label: "기업에 적용",
    body: ["기업과 시장을 직접 보며", "원칙을 내 언어로 시험합니다."],
  },
  {
    n: "03",
    label: "나의 판단 기록",
    body: ["결과보다 판단 과정을 남겨", "다음 선택의 기준으로 만듭니다."],
  },
];

/** 곡선이 그려지고 점이 그 위를 지나가면서 세 걸음이 차례로 밝아진다.
 *  피그마는 밝아진 뒤 다시 0.46까지 내리지만 그건 곧 다음 바퀴가 오기 때문이다.
 *  밝아지는 시점만 쓰고 내리는 값은 뺐다 — 내려간 값이 끝 상태로 남으면 흰 배경에서
 *  2.9:1이라 globals.css가 못 박은 4.5:1을 못 넘긴다.
 *
 *  다른 섹션과 달리 [useInView]를 쓴다. 화면에서 나갔다 들어올 때마다 data-in이
 *  빠졌다 붙어 애니메이션이 처음부터 다시 돈다. */
export default function HomeJourney() {
  const [ref, seen] = useInView<HTMLElement>(0.3);

  return (
    <section
      ref={ref}
      className="hv-scene hv-journey"
      data-in={seen ? "true" : undefined}
      aria-labelledby="hv-journey-title"
    >
      <h2 id="hv-journey-title" className="hv-journey-title">
        <span>배움에서 판단까지</span>
        배움은 한 번에 끝나지 않고 판단으로 퍼집니다.
      </h2>

      <div className="hv-journey-path" aria-hidden="true">
        <svg className="hv-journey-curve" viewBox="0 0 1110 102.997" fill="none" preserveAspectRatio="none">
          <path
            d="M2.00042 49.4538C209.375 -56.5449 302.788 147.139 487.744 91.022C695.119 28.6698 835.237 -50.3097 1108 49.4538"
            pathLength={1}
            stroke="#FFA000"
            strokeWidth={4}
            strokeLinecap="round"
          />
        </svg>

        {/* 세 번째 점은 없다 — 움직이는 점이 정확히 그 자리(97.8%)에 멈춰 그 역할을 한다. */}
        <span className="hv-journey-node hv-journey-node-1" />
        <span className="hv-journey-node hv-journey-node-2" />

        <img className="hv-journey-pin" src="/home/icon-pin.webp" alt="" />
        <span className="hv-journey-point" />
      </div>

      <img className="hv-journey-pencil" src="/home/icon-pencil.webp" alt="" aria-hidden="true" />
      <img className="hv-journey-mobile" src="/home/icon-mobile.webp" alt="" aria-hidden="true" />

      <ol className="hv-journey-steps">
        {STEPS.map((s, i) => (
          <li key={s.n} className={`hv-journey-step hv-journey-step-${i + 1}`}>
            <p className="hv-journey-step-head">
              <strong>{s.n}</strong>
              {s.label}
            </p>
            <span className="hv-journey-step-body">
              {s.body[0]}
              <br />
              {s.body[1]}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
