import Link from "next/link";

/** 일곱 명이 무대에 서는 순서. 지연은 피그마 값을 초로 바꾼 것이다.
 *
 *  일러스트가 저마다 다른 여백과 다른 얼굴 비율로 그려져 있다. 머리 폭이 몸 높이의
 *  38%인 것과 49%인 것이 섞여 있어, 그냥 세우면 얼굴 크기가 28%까지 벌어진다.
 *  그렇다고 키를 맞추면 얼굴이 다시 어긋난다 — 둘 다 맞추려면 머리 크기를 맞춘 뒤
 *  같은 신체 지점에서 잘라내야 한다. 원본이 가장 짧은 버핏이 한계를 정해서
 *  머리 폭 140px, 공통 높이 284px가 1440 기준 최대다.
 *
 *  자리는 폭이 아니라 얼굴 중심을 191px 간격으로 고르게 놓아 정한다. 어깨 폭이
 *  제각각이라 같은 여백으로 늘어놓으면 얼굴 간격이 들쭉날쭉해진다. */
/** 무대 공통 높이(1440 기준 284px)를 cqw로 옮긴 값. scale로 개별 인물만 키운다. */
const MASTER_H = 19.722;

/** scale은 이 인물만 키운다. 버핏·린치는 원본에서 얼굴이 작게 그려져 나란히 세우면
 *  혼자 작아 보인다 — 키(높이)와 폭을 같은 배율로 올려 비율은 지킨 채 크기만 맞춘다. */
const MASTERS: { id: string; left: number; width: number; delay: number; scale?: number }[] = [
  { id: "buffett", left: 0, width: 18.299, delay: 0.55 },
  { id: "graham", left: 9.54, width: 25.75, delay: 0.64 },
  { id: "lynch", left: 26.665, width: 18.035, delay: 0.73 },
  { id: "marks", left: 37.5, width: 22.896, delay: 0.82 },
  { id: "fisher", left: 50.731, width: 22.965, delay: 0.91 },
  { id: "greenblatt", left: 63.14, width: 24.681, delay: 1.0 },
  { id: "soros", left: 77.493, width: 22.507, delay: 1.09 },
];
/** 진입 동작은 전부 CSS 애니메이션이다. 자바스크립트가 한 줄도 돌지 않아도
 *  글자와 그림은 제자리에 보인다 — 모션은 그 위에 얹히는 것이지 보이게 하는 수단이 아니다. */
export default function HomeHero() {
  return (
    <section className="hv-scene hv-hero" aria-labelledby="hv-hero-title">
      <svg className="hv-hero-stage" viewBox="0 0 1440 258.753" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 50.7531C232 -19.2469 454 -11.2469 686 40.7531C914 92.7531 1160 0.753078 1440 14.7531V258.753H0V50.7531Z" fill="#FFC72D" />
      </svg>

      <div className="hv-hero-coin hv-hero-coin-left">
        <img src="/home/coin-dollar.webp" alt="" aria-hidden="true" />
      </div>
      <div className="hv-hero-coin hv-hero-coin-top">
        <img src="/home/coin-bundle.webp" alt="" aria-hidden="true" />
      </div>
      <div className="hv-hero-coin hv-hero-coin-right">
        <img src="/home/coin-dollar.webp" alt="" aria-hidden="true" />
      </div>

      <h1 id="hv-hero-title" className="hv-hero-title">
        투자 대가에게 배우는
        <br />
        판단의 기준
      </h1>

      <p className="hv-hero-lede">일곱 명의 시선을 지나, 나만의 투자원칙을 세웁니다.</p>

      <div className="hv-hero-cta">
        <Link href="/learn" className="hv-btn">
          배우러 가기
        </Link>
      </div>

      <div className="hv-hero-masters" aria-hidden="true">
        {MASTERS.map((m) => {
          const s = m.scale ?? 1;
          return (
            <img
              key={m.id}
              src={`/home/masters/${m.id}.webp`}
              alt=""
              style={{
                left: `${m.left}%`,
                width: `${(m.width * s).toFixed(3)}%`,
                ...(m.scale ? { height: `${(MASTER_H * s).toFixed(3)}cqw` } : {}),
                animationDelay: `${m.delay}s`,
              }}
            />
          );
        })}
      </div>
    </section>
  );
}
