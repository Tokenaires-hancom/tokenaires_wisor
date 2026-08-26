"use client";

import { useMemo, useRef, useState, type CSSProperties } from "react";
import Mascot from "@/components/game/Mascot";
import { isMatch, isComplete, type PairItem } from "@/lib/matchPairs.ts";
import "./match.css";

// 사운드 (WebAudio, 에셋 없이)
let AC: AudioContext | null = null;
function beep(freq: number, dur: number, type: OscillatorType) {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    AC = AC ?? new Ctor();
    const o = AC.createOscillator();
    const g = AC.createGain();
    o.type = type;
    o.frequency.value = freq;
    o.connect(g);
    g.connect(AC.destination);
    g.gain.setValueAtTime(0.1, AC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + dur);
    o.start();
    o.stop(AC.currentTime + dur);
  } catch {
    /* 사운드 실패는 진행과 무관 */
  }
}

const shuffle = <T,>(arr: T[]): T[] => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const keyOf = (item: PairItem) => `${item.side}-${item.pairId}`;

/** 개념 짝맞추기. 왼쪽 용어와 오른쪽 정의를 이어 맞춘다.
 *  내용은 서버에서 대가 principles를 넘겨받는다(클라 번들에 콘텐츠 싣지 않음). */
export default function MatchPairs({ pairs, title }: { pairs: { term: string; def: string }[]; title: string }) {
  const terms = useMemo<PairItem[]>(
    () => pairs.map((p, i) => ({ pairId: i, side: "term", text: p.term })),
    [pairs],
  );
  const defs = useMemo<PairItem[]>(
    () => shuffle(pairs.map((p, i) => ({ pairId: i, side: "def", text: p.def }))),
    [pairs],
  );

  const [selKey, setSelKey] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [wrong, setWrong] = useState<Set<string>>(new Set());
  const busy = useRef(false);

  const selected = [...terms, ...defs].find((it) => keyOf(it) === selKey) ?? null;
  const done = isComplete(matched, pairs.length);

  function click(item: PairItem) {
    if (busy.current || matched.has(item.pairId)) return;
    const key = keyOf(item);
    if (!selKey) {
      setSelKey(key);
      return;
    }
    if (selKey === key) {
      setSelKey(null);
      return;
    }
    if (selected && isMatch(selected, item)) {
      const next = new Set(matched).add(item.pairId);
      setMatched(next);
      setSelKey(null);
      beep(560, 0.16, "triangle");
    } else {
      busy.current = true;
      setWrong(new Set([selKey, key]));
      beep(150, 0.16, "sawtooth");
      window.setTimeout(() => {
        setWrong(new Set());
        setSelKey(null);
        busy.current = false;
      }, 500);
    }
  }

  function reset() {
    setMatched(new Set());
    setSelKey(null);
    setWrong(new Set());
    busy.current = false;
  }

  const cls = (item: PairItem) => {
    const key = keyOf(item);
    return [
      "match-item",
      matched.has(item.pairId) ? "matched" : "",
      selKey === key ? "sel" : "",
      wrong.has(key) ? "wrong" : "",
    ].join(" ");
  };

  return (
    <div className="match-card">
      <div className="match-head">
        <p className="eyebrow">개념 짝맞추기</p>
        <h3 className="sub">{title}</h3>
        {!done && (
          <p className="match-count" aria-live="polite">
            맞춘 짝 {matched.size} / {pairs.length}
          </p>
        )}
      </div>

      {done ? (
        <div className="match-done">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
            const rad = (deg * Math.PI) / 180;
            return (
              <span
                key={i}
                className="match-confetti"
                style={{ "--dx": `${Math.round(Math.cos(rad) * 90)}px`, "--dy": `${Math.round(Math.sin(rad) * 90)}px` } as CSSProperties}
              />
            );
          })}
          <Mascot state="celebrate" />
          <strong>다 맞혔어요!</strong>
          <p>{pairs.length}개 원칙을 정의와 이어봤습니다.</p>
          <button type="button" className="btn" onClick={reset}>
            다시 하기
          </button>
        </div>
      ) : (
        <div className="match-grid">
          <div className="match-col">
            {terms.map((item, i) => (
              <button key={keyOf(item)} type="button" className={cls(item)} style={{ "--i": i } as CSSProperties} disabled={matched.has(item.pairId)} onClick={() => click(item)}>
                {item.text}
              </button>
            ))}
          </div>
          <div className="match-col">
            {defs.map((item, i) => (
              <button key={keyOf(item)} type="button" className={cls(item)} style={{ "--i": i } as CSSProperties} disabled={matched.has(item.pairId)} onClick={() => click(item)}>
                {item.text}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
