"use client";

import { useState } from "react";
import Match3 from "@/components/game/Match3";
import type { Master } from "@/content/masters";
import "./learn-dock.css";

/** 배우기 화면 우측 하단 팝업형 게임 패널. 모바일 폭에서도 노출된다.
 *  학습 방해를 막으려고 기본은 접힘 — 버튼을 누르면 열리고, 같은 버튼을 다시 누르면 닫힌다.
 *  Match3 보드가 버핏의 ROIC 기준을 소재로 만들어져 있어 버핏 페이지에서만 렌더링한다 —
 *  이 판단을 호출부마다 반복하지 않도록 여기 한 곳에 둔다. */
export default function LearnGameDock({ masterId }: { masterId: Master["id"] }) {
  const [open, setOpen] = useState(false);
  if (masterId !== "buffett") return null;
  return (
    <div className="learn-dock" data-open={open}>
      {open && (
        <aside className="learn-dock-panel">
          <div className="learn-dock-head">
            <span>두뇌 휴식 · 기준 매칭</span>
            <button type="button" className="learn-dock-close" onClick={() => setOpen(false)} aria-label="닫기">
              ✕
            </button>
          </div>
          <Match3 />
        </aside>
      )}
      <button
        type="button"
        className="learn-dock-fab"
        aria-expanded={open}
        aria-label={open ? "두뇌 휴식 닫기" : "두뇌 휴식 열기"}
        onClick={() => setOpen((v) => !v)}
      >
        🎮 두뇌 휴식
      </button>
    </div>
  );
}
