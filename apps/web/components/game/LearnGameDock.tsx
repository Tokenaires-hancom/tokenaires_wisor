"use client";

import { useState } from "react";
import Match3 from "@/components/game/Match3";
import "./learn-dock.css";

/** 배우기 화면 좌측 접이식 게임 패널. 데스크톱 전용(모바일은 CSS로 숨김).
 *  학습 방해를 막으려고 기본은 접힘 — 버튼을 눌러야 열린다. */
export default function LearnGameDock() {
  const [open, setOpen] = useState(false);
  return (
    <div className="learn-dock" data-open={open}>
      {!open && (
        <button type="button" className="learn-dock-fab" onClick={() => setOpen(true)}>
          🎮 두뇌 휴식
        </button>
      )}
      <aside className="learn-dock-panel" aria-hidden={!open}>
        <div className="learn-dock-head">
          <span>두뇌 휴식 · 기준 매칭</span>
          <button type="button" className="learn-dock-close" onClick={() => setOpen(false)} aria-label="닫기">
            ✕
          </button>
        </div>
        <Match3 />
      </aside>
    </div>
  );
}
