"use client";

import { useRef, useState } from "react";
import { makeBoard, findMatches, isValidSwap, collapse, hasMove, type Board, type Cell } from "@/lib/match3/board.ts";
import "./match3.css";

/** 투자 지표 타일(테마 B). 목표 = 특정 대가가 보는 기준 타일을 모으기.
 *  타일 자체가 학습 소재라 놀며 지표에 익숙해진다. */
const TYPES = [
  { icon: "💰", name: "ROIC" },
  { icon: "💧", name: "FCF" },
  { icon: "🛡️", name: "부채" },
  { icon: "📈", name: "성장" },
  { icon: "🏷️", name: "가격" },
];
const ROWS = 5;
const COLS = 5;
const GOAL_TYPE = 0; // ROIC
const GOAL_NEED = 8;
const START_MOVES = 12;

type Phase = "intro" | "play" | "win" | "lose";

const rand = () => Math.floor(Math.random() * TYPES.length);
const adjacent = (a: Cell, b: Cell) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;

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
    /* 사운드 실패는 게임 진행과 무관 */
  }
}

export default function Match3() {
  const [board, setBoard] = useState<Board>([]);
  const [sel, setSel] = useState<Cell | null>(null);
  const [popped, setPopped] = useState<Set<string>>(new Set());
  const [shaken, setShaken] = useState<Set<string>>(new Set());
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(START_MOVES);
  const [collected, setCollected] = useState(0);
  const [combo, setCombo] = useState(0);
  const [phase, setPhase] = useState<Phase>("intro");
  const busy = useRef(false);

  const stars = moves >= 6 ? "★★★" : moves >= 3 ? "★★☆" : moves >= 1 ? "★☆☆" : "☆☆☆";

  function begin() {
    setBoard(makeBoard(ROWS, COLS, TYPES.length, rand));
    setSel(null);
    setScore(0);
    setMoves(START_MOVES);
    setCollected(0);
    setCombo(0);
    setPopped(new Set());
    busy.current = false;
    setPhase("play");
  }

  function resolve(current: Board, chain: number, movesLeft: number, got: number) {
    const matches = findMatches(current);
    if (matches.size === 0) {
      busy.current = false;
      setCombo(0);
      if (got >= GOAL_NEED) {
        beep(523, 0.15, "triangle");
        setPhase("win");
      } else if (movesLeft <= 0) {
        beep(200, 0.3, "sine");
        setPhase("lose");
      } else if (!hasMove(current)) {
        // 둘 수 있는 수가 없으면 새 보드로 섞는다
        setBoard(makeBoard(ROWS, COLS, TYPES.length, rand));
      }
      return;
    }
    busy.current = true;
    setPopped(matches);
    setCombo(chain);
    beep(420 + chain * 90, 0.18, "triangle");

    let gained = 0;
    for (const key of matches) {
      const [r, c] = key.split(",").map(Number);
      if (current[r][c] === GOAL_TYPE) gained += 1;
    }
    const nextGot = got + gained;
    setCollected(nextGot);
    setScore((s) => s + matches.size * 10 * chain);

    window.setTimeout(() => {
      const next = collapse(current, matches, rand);
      setBoard(next);
      setPopped(new Set());
      resolve(next, chain + 1, movesLeft, nextGot);
    }, 260);
  }

  function click(r: number, c: number) {
    if (busy.current || phase !== "play") return;
    const cell = { r, c };
    if (!sel) {
      setSel(cell);
      return;
    }
    if (sel.r === r && sel.c === c) {
      setSel(null);
      return;
    }
    if (!adjacent(sel, cell)) {
      setSel(cell);
      return;
    }
    const a = sel;
    setSel(null);
    if (!isValidSwap(board, a, cell)) {
      beep(150, 0.16, "sawtooth");
      setShaken(new Set([`${a.r},${a.c}`, `${r},${c}`]));
      window.setTimeout(() => setShaken(new Set()), 320);
      return;
    }
    const swapped = board.map((row) => row.slice());
    [swapped[a.r][a.c], swapped[r][c]] = [swapped[r][c], swapped[a.r][a.c]];
    const movesLeft = moves - 1;
    setBoard(swapped);
    setMoves(movesLeft);
    resolve(swapped, 1, movesLeft, collected);
  }

  return (
    <div className="m3-card">
      <div className="m3-head">
        <div className="m3-title">기준 매칭 — 버핏 스테이지</div>
        <div className="m3-stars">{phase === "play" ? stars : ""}</div>
      </div>
      <p className="m3-quest">
        목표: <b>{TYPES[GOAL_TYPE].name}</b> 타일 <b>{GOAL_NEED}</b>개 수집 · 버핏이 가장 먼저 보는 기준
      </p>

      <div className="m3-meters">
        <div className="m3-meter"><span>점수</span><strong>{score}</strong></div>
        <div className="m3-meter"><span>남은 이동</span><strong>{moves}</strong></div>
        <div className="m3-meter"><span>수집</span><strong>{collected} / {GOAL_NEED}</strong></div>
      </div>

      <div className="m3-board" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
        {phase === "intro" && (
          <div className="m3-overlay">
            <div className="m3-badge">💰</div>
            <h3>버핏의 첫 기준 · ROIC</h3>
            <p>자본을 얼마나 효율적으로 굴리는가. ROIC 타일 {GOAL_NEED}개를 모아보세요.</p>
            <ol className="m3-how">
              <li>타일을 클릭한 뒤 인접한 타일을 클릭해 교환</li>
              <li>같은 종류 3개 이상 연결되면 사라짐</li>
              <li>💰 ROIC 타일 {GOAL_NEED}개를 모으면 클리어!</li>
            </ol>
            <button type="button" className="btn" onClick={begin}>시작</button>
          </div>
        )}
        {(phase === "win" || phase === "lose") && (
          <div className="m3-overlay">
            <div className="m3-badge">{phase === "win" ? "🎉" : "⏳"}</div>
            <h3>{phase === "win" ? "스테이지 클리어!" : "이동 소진"}</h3>
            <p>
              {phase === "win"
                ? `ROIC를 ${collected}개 모았어요. 남은 이동 ${moves} 보너스 +${moves * 5} XP`
                : `ROIC ${collected}/${GOAL_NEED} 수집. 한 번 더!`}
            </p>
            <button type="button" className="btn" onClick={begin}>다시 하기</button>
          </div>
        )}
        {phase === "play" &&
          board.map((row, r) =>
            row.map((t, c) => {
              const key = `${r},${c}`;
              const cls = [
                "m3-tile",
                sel && sel.r === r && sel.c === c ? "sel" : "",
                popped.has(key) ? "pop" : "",
                shaken.has(key) ? "shake" : "",
              ].join(" ");
              return (
                <button key={key} type="button" className={cls} data-t={t} onClick={() => click(r, c)}>
                  <span>{TYPES[t]?.icon}</span>
                  <small>{TYPES[t]?.name}</small>
                </button>
              );
            }),
          )}
      </div>

      {combo >= 2 && phase === "play" && <div className="m3-combo">COMBO x{combo}</div>}
    </div>
  );
}
