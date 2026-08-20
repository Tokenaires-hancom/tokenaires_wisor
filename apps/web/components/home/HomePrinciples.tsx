"use client";

import { useInView } from "@/lib/useInView";

/** AI가 쏟아내는 답들. 가격과 분위기를 따라 흔들리는 쪽이라 각기 다른 각도로 기울여 둔다. */
const DRIFTS = [
  { label: "뉴스 요약", tilt: -3 },
  { label: "실적 해석", tilt: 4 },
  { label: "시장 전망", tilt: -2 },
];

/** 원칙이 미리 정해 두는 세 가지. 흔들리는 쪽과 달리 기울기가 없고 왼쪽 끝이 맞는다.
 *  순서가 아니라 한 벌이라 번호는 없다 — 대신 세로 스파인에 점으로 걸어 "고정점"임을 보인다.
 *  질문(굵게) + 한 줄 서브카피로 위계를 준다. */
const ANCHORS = [
  { q: "무엇을 볼까?", sub: "원칙에 필요한 질문부터 고른다" },
  { q: "언제 다시 볼까?", sub: "가설을 바꿀 조건을 먼저 정한다" },
  { q: "무엇이 틀렸나?", sub: "판단의 이유를 남겨 다음에 쓴다" },
];

export default function HomePrinciples() {
  const [ref, inView] = useInView<HTMLElement>(0.4);

  return (
    <section
      ref={ref}
      className="hv-scene hv-principles"
      data-in={inView ? "true" : undefined}
      aria-labelledby="hv-principles-title"
    >
      <div className="hv-principles-field-shadow" aria-hidden="true">
        <svg viewBox="0 0 733.923 670" preserveAspectRatio="none">
          <path d="M35.9231 0C-22.0769 122 -11.0769 530 77.9231 670H733.923V0H35.9231Z" fill="#FFF2B8" />
        </svg>
      </div>
      <div className="hv-principles-field" aria-hidden="true">
        <svg viewBox="0 0 715.938 670" preserveAspectRatio="none">
          <defs>
            <linearGradient id="hv-principles-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFD24D" />
              <stop offset="1" stopColor="#F5B200" />
            </linearGradient>
          </defs>
          <path d="M45.9375 0C-24.0625 130 -14.0625 532 75.9375 670H715.938V0H45.9375Z" fill="url(#hv-principles-fill)" />
        </svg>
      </div>

      <h2 id="hv-principles-title" className="hv-principles-eyebrow">
        AI 시대의 투자원칙
      </h2>
      <span className="hv-principles-underline" aria-hidden="true" />
      <p className="hv-principles-line">흔들리는 시장에서,</p>
      <p className="hv-principles-line hv-principles-line-accent">원칙은 판단을 붙드는 기준입니다</p>
      <p className="hv-principles-intro">
        가격과 분위기가 바뀔 때마다 확신도 쉽게 흔들립니다. 원칙은 무엇을 보고, 언제 생각을 바꾸며,
        결과에서 무엇을 배울지 미리 정해 두어 AI가 내놓는 수많은 답에 끌려가지 않게 합니다.
      </p>

      {/* 흔들리는 쪽 — 기울어진 알약들이 점선을 타고 오른쪽 패널로 이어진다. */}
      <ul className="hv-principles-drifts" aria-label="AI가 내놓는 답">
        {DRIFTS.map((d) => (
          <li key={d.label} className="hv-principles-drift" style={{ rotate: `${d.tilt}deg` }}>
            {d.label}
          </li>
        ))}
      </ul>
      {/* 흔들리는 알약에서 패널로 건너가는 실. 직선 노란 점선이 패널 쪽으로 흐른다. */}
      <svg className="hv-principles-thread" viewBox="0 0 120 20" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 10 L120 10" pathLength="100" />
      </svg>

      {/* 고정된 쪽 — 노란 패널 안. 라벨은 위로, 세 질문은 가운데로. 점은 있고 잇는 선은 없다. */}
      <p className="hv-principles-anchor-label">나의 투자원칙</p>
      <ul className="hv-principles-anchor-list">
        {ANCHORS.map((a) => (
          <li key={a.q} className="hv-principles-anchor-item">
            <p className="hv-principles-anchor-q">{a.q}</p>
            <p className="hv-principles-anchor-sub">{a.sub}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
