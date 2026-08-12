"use client";

import Link from "next/link";
import { useState } from "react";
import { MASTERS, MASTER_BY_ID, type Master } from "@/content/masters";

/** 좁은 화면 전용 대가 이동 버튼. 데스크톱의 세로 레일(.master-rail) 대신,
 *  왼쪽 아래에 떠 있는 현재 대가 아이콘 하나를 누르면 나머지가 위로 펼쳐진다.
 *  화면 폭에 따른 표시/숨김은 CSS(.mobile-master-dock)가 담당한다 —
 *  이 컴포넌트는 항상 렌더링되고 데스크톱에서는 그냥 안 보인다.
 *
 *  masters를 prop으로 안 받고 여기서 직접 가져오는 이유: content/masters.ts는
 *  대가마다 원칙·선호기업·실패조건까지 다 들어있는 큰 객체라, prop으로 넘기면
 *  이 페이지에서 안 쓰는 텍스트까지 client 쪽으로 다시 실린다. */
export default function MobileMasterDock({ currentId }: { currentId: Master["id"] }) {
  const [open, setOpen] = useState(false);
  const current = MASTER_BY_ID[currentId];
  const others = MASTERS.filter((m) => m.id !== currentId);

  if (!current) return null;

  return (
    <div className="mobile-master-dock">
      {open && (
        <button
          type="button"
          className="mobile-master-dock-backdrop"
          aria-label="닫기"
          onClick={() => setOpen(false)}
        />
      )}
      {open && (
        <ul className="mobile-master-dock-list">
          {others.map((m) => (
            <li key={m.id}>
              <Link
                href={`/learn/masters/${m.id}`}
                className="mobile-master-dock-item"
                onClick={() => setOpen(false)}
              >
                <img src={`/investors/${m.id}.png`} alt={m.name} width={44} height={44} />
                <span className="mobile-master-dock-name" aria-hidden="true">
                  {m.name}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="mobile-master-dock-toggle"
        aria-expanded={open}
        aria-label={open ? "닫기" : "다른 대가 보기"}
        onClick={() => setOpen((v) => !v)}
      >
        <img src={`/investors/${current.id}.png`} alt="" width={56} height={56} />
      </button>
    </div>
  );
}
