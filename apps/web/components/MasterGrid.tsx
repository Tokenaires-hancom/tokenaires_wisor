import Link from "next/link";
import { MASTERS } from "@/content/masters";

/** 일곱 대가를 한 화면에 모두 펼치고, 카드 뒤로 지나가는 골드 리본으로
 *  버핏에서 소로스로 이어지는 학습 순서를 보여준다.
 *
 *  캐러셀이 아니라 그리드인 이유: 가로 스크롤은 화면 밖으로 밀린 대가를
 *  "없는 것"으로 만든다. 일곱 명이 하나의 여정이라는 게 이 화면의 요지라서
 *  전부 보이는 편이 맞다.
 *
 *  상호작용이 없으므로 서버 컴포넌트다. "use client"를 붙이지 않는다. */
export default function MasterGrid() {
  return (
    <section className="master-grid" aria-label="투자 대가 학습 순서">
      {/* 리본은 장식이다. 순서는 목록의 DOM 순서가 이미 담고 있으므로
       *  보조기기에는 숨긴다. preserveAspectRatio="none"으로 그리드 상자에
       *  맞춰 늘어나되, non-scaling-stroke가 선 굵기는 3px로 지킨다. */}
      <svg
        className="master-grid-ribbon"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <path
          className="master-grid-ribbon-path"
          data-shape="wide"
          vectorEffect="non-scaling-stroke"
          d="M 20 235 C 120 235, 180 160, 245 178 C 320 199, 420 318, 498 302 C 580 285, 680 158, 751 178 C 838 202, 940 225, 968 320 C 1000 432, 1000 556, 960 662 C 928 748, 828 700, 751 744 C 700 773, 660 848, 625 828 C 540 780, 450 688, 372 700 C 282 714, 190 788, 118 800 C 82 814, 58 852, 58 896"
        />
        <path
          className="master-grid-ribbon-path"
          data-shape="narrow"
          vectorEffect="non-scaling-stroke"
          d="M 500 30 C 580 140, 420 240, 500 350 C 580 460, 420 560, 500 670 C 580 760, 760 800, 850 884 C 878 910, 880 946, 880 976"
        />
        <path
          className="master-grid-ribbon-path"
          data-shape="medium"
          vectorEffect="non-scaling-stroke"
          d="M 250 120 C 390 80, 610 80, 750 120 C 860 205, 860 300, 750 370 C 610 430, 390 430, 250 370 C 140 455, 140 550, 250 620 C 390 680, 610 680, 750 620 C 860 710, 820 830, 650 875 C 500 915, 360 900, 250 875 C 140 850, 160 930, 360 930 C 540 930, 720 920, 744 942 C 750 948, 750 960, 750 972"
        />
        <path
          className="master-grid-ribbon-arrow"
          data-shape="wide"
          vectorEffect="non-scaling-stroke"
          d="M 58 882 L 58 910 M 45 902 L 58 926 L 71 902"
        />
        <path
          className="master-grid-ribbon-arrow"
          data-shape="medium"
          vectorEffect="non-scaling-stroke"
          d="M 750 956 L 750 978 M 738 970 L 750 990 L 762 970"
        />
        <path
          className="master-grid-ribbon-arrow"
          data-shape="narrow"
          vectorEffect="non-scaling-stroke"
          d="M 880 956 L 880 978 M 856 970 L 880 990 L 904 970"
        />
      </svg>

      <ol className="master-grid-list">
        {MASTERS.map((master, index) => {
          const featured = master.id === "buffett";
          return (
            <li key={master.id} className="master-grid-item">
              <Link
                href={`/learn/masters/${master.id}`}
                className="master-card"
                data-featured={featured ? "true" : undefined}
              >
                <span className="master-card-art">
                  <span className="master-card-sequence" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <img
                    className="master-card-portrait"
                    src={`/investors/${master.id}.png`}
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
      </ol>

      {/* 리본 화살표 꼭지 바로 아래에 선다. 화살표가 그리드 상자 안에서 끝나므로
       *  이 링크도 같은 상자 안에 절대 위치로 둬야 4px 간격이 지켜진다.
       *  좌표는 globals.css의 --arrow-x/--arrow-y에 있고 위 path와 짝이다. */}
      <a className="compare-jump" href="#compare">
        <span>투자 철학</span>
        <span>한눈에 비교하기</span>
      </a>
    </section>
  );
}
