import { useEffect, useState } from "react";
import "./wave-mascot.css";

/** 스크롤이 이 값(px)을 넘으면 맨 위로 돌아갈 수 있다는 표시("UP")를 보여준다. */
const SCROLL_UP_THRESHOLD = 240;

/** 본문 왼쪽 여백에 서는 안내자. 애니메이션 WebP 대신 순수 SVG라 확대해도
 *  안 흐려지고 용량도 훨씬 작다. 든 팔(오른팔)만 CSS로 살짝 흔들어서
 *  본문 쪽을 가리키는 듯한 모션을 준다 — 나머지 부위는 정지 상태다.
 *  파츠 출처: Documents/Codex/2026-08-21 대화에서 만들어 두고 안 쓰던
 *  마스코트 벡터(몸통·팔다리·눈·눈썹·입을 부위별로 쪼갠 SVG)를 그대로 가져와
 *  하나의 SVG로 합쳤다.
 *  누르면 맨 위로 스크롤한다 — 스크롤을 내렸을 때만 그 위에 "UP" 표시가 뜬다. */
export default function WaveMascot() {
  const [scrolledDown, setScrolledDown] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolledDown(window.scrollY > SCROLL_UP_THRESHOLD);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      className="wave-mascot-button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="맨 위로 이동"
    >
      {scrolledDown && <span className="wave-mascot-up">UP</span>}
      <svg
      className="wave-mascot"
      viewBox="0 0 409 396"
      role="img"
      aria-label="마스코트 — 안내"
    >
      <defs>
        <linearGradient id="wm-leg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff9210" />
          <stop offset="0.48" stopColor="#f26600" />
          <stop offset="1" stopColor="#d94300" />
        </linearGradient>
        <filter id="wm-legShadow" x="-40%" y="-30%" width="180%" height="180%">
          <feDropShadow dx="1" dy="3" stdDeviation="2.4" floodColor="#bd3900" floodOpacity="0.28" />
        </filter>
        <linearGradient id="wm-limbLeft" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff9413" />
          <stop offset="0.42" stopColor="#f76b00" />
          <stop offset="1" stopColor="#dc4300" />
        </linearGradient>
        <linearGradient id="wm-limbRight" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#dc4300" />
          <stop offset="0.55" stopColor="#f76b00" />
          <stop offset="1" stopColor="#ff9918" />
        </linearGradient>
        <filter id="wm-limbShadow" x="-30%" y="-30%" width="170%" height="170%">
          <feDropShadow dx="1" dy="3" stdDeviation="2.4" floodColor="#bd3900" floodOpacity="0.3" />
        </filter>
        <radialGradient id="wm-outer" cx="35%" cy="24%" r="78%">
          <stop offset="0" stopColor="#fff8ae" />
          <stop offset="0.28" stopColor="#ffe45c" />
          <stop offset="0.72" stopColor="#ffc400" />
          <stop offset="1" stopColor="#f39a00" />
        </radialGradient>
        <linearGradient id="wm-rim" x1="18%" y1="10%" x2="82%" y2="92%">
          <stop offset="0" stopColor="#fff8c4" />
          <stop offset="0.22" stopColor="#fff078" />
          <stop offset="0.58" stopColor="#ffd22a" />
          <stop offset="1" stopColor="#fff09a" />
        </linearGradient>
        <radialGradient id="wm-face" cx="34%" cy="25%" r="76%">
          <stop offset="0" stopColor="#ffe45c" />
          <stop offset="0.44" stopColor="#ffd321" />
          <stop offset="0.82" stopColor="#ffc20a" />
          <stop offset="1" stopColor="#f5aa00" />
        </radialGradient>
        <linearGradient id="wm-lowerGlow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#fff7bd" stopOpacity="0.72" />
        </linearGradient>
        <filter id="wm-soften" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <linearGradient id="wm-eyebrow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff8a08" />
          <stop offset="0.55" stopColor="#f26100" />
          <stop offset="1" stopColor="#dd4300" />
        </linearGradient>
        <linearGradient id="wm-eye" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff8a08" />
          <stop offset="0.55" stopColor="#f26100" />
          <stop offset="1" stopColor="#dd4300" />
        </linearGradient>
        <filter id="wm-eyeShadow" x="-40%" y="-30%" width="180%" height="180%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#d74b00" floodOpacity="0.28" />
        </filter>
        <filter id="wm-symbolShadow" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="2" stdDeviation="1.6" floodColor="#d68c00" floodOpacity="0.24" />
        </filter>
      </defs>

      {/* 다리 — 몸통 뒤 */}
      <g className="wave-mascot-leg-left" fill="none" stroke="url(#wm-leg)" strokeLinecap="round" strokeLinejoin="round" filter="url(#wm-legShadow)">
        <path d="M127 263 C125 286 121 316 120 340" strokeWidth="19" />
        <path d="M120 340 C112 343 105 343 99 342 L140 342" strokeWidth="18" />
        <path d="M122 280 C120 302 118 322 118 333" stroke="#ffad2b" strokeWidth="4" opacity="0.42" filter="none" />
      </g>
      <g className="wave-mascot-leg-right" fill="none" stroke="url(#wm-leg)" strokeLinecap="round" strokeLinejoin="round" filter="url(#wm-legShadow)">
        <path d="M209 263 C211 287 215 317 217 340" strokeWidth="19" />
        <path d="M217 340 C225 343 234 343 253 342" strokeWidth="18" />
        <path d="M211 280 C213 303 215 323 216 333" stroke="#ffad2b" strokeWidth="4" opacity="0.42" filter="none" />
      </g>

      {/* 왼팔(내림) — 몸통 뒤, 든 팔보다 훨씬 작게 흔들려서 숨쉬는 듯한 느낌만 준다 */}
      <g className="wave-mascot-arm-left">
        <path d="M86 201 C63 210 45 232 36 264" fill="none" stroke="url(#wm-limbLeft)" strokeWidth="17" strokeLinecap="round" filter="url(#wm-limbShadow)" />
        <path d="M76 208 C57 220 45 240 40 256" fill="none" stroke="#ffb237" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
      </g>

      {/* 오른팔(든 팔) — 본문 쪽을 가리키며 살짝 흔들린다 */}
      <g className="wave-mascot-arm">
        <g fill="none" stroke="url(#wm-limbRight)" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" filter="url(#wm-limbShadow)">
          <path d="M286 178 C309 174 325 160 334 139 C337 133 340 129 344 126" />
          <path d="M343 127 L371 111" />
          <path d="M343 128 L323 122" />
        </g>
        <path d="M296 172 C315 167 326 154 333 139" fill="none" stroke="#ffb237" strokeWidth="4" strokeLinecap="round" opacity="0.48" />
      </g>

      {/* 몸통 */}
      <g>
        <circle cx="175" cy="166" r="126" fill="url(#wm-outer)" />
        <circle cx="175" cy="166" r="122" fill="url(#wm-rim)" />
        <circle cx="175" cy="166" r="103" fill="url(#wm-face)" />
        <path d="M72 190 A106 106 0 0 0 278 190 A103 103 0 0 1 72 190Z" fill="url(#wm-lowerGlow)" opacity="0.28" />
        <path d="M79 113 A108 108 0 0 1 130 62" fill="none" stroke="#fff" strokeWidth="11" strokeLinecap="round" opacity="0.66" filter="url(#wm-soften)" />
        <path d="M77 126 A107 107 0 0 1 131 65" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.62" />
      </g>

      {/* 얼굴 */}
      <path d="M124 100 Q133 93 142 100" fill="none" stroke="url(#wm-eyebrow)" strokeWidth="7" strokeLinecap="round" />
      <path d="M204 100 Q213 93 222 100" fill="none" stroke="url(#wm-eyebrow)" strokeWidth="7" strokeLinecap="round" />
      <g fill="url(#wm-eye)" filter="url(#wm-eyeShadow)">
        <rect x="126" y="111" width="16" height="40" rx="8" />
        <rect x="205" y="111" width="16" height="40" rx="8" />
      </g>
      <g filter="url(#wm-symbolShadow)">
        <path d="M129 168 C130 191 135 218 150 218 C161 218 163 182 170 181 C181 180 187 218 198 218 C210 218 215 194 221 177" fill="none" stroke="#fff" strokeWidth="19" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <path d="M224 157 C227 157 229 160 231 164 L238 176 C240 180 237 183 233 183 L222 181 L212 183 C208 184 205 180 208 176 L218 162 C220 159 222 157 224 157 Z" fill="#fff" />
      </svg>
    </button>
  );
}
