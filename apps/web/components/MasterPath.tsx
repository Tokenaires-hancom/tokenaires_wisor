"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import MasterCharacter from "@/components/MasterCharacter";
// 배럴(@/content/curriculum)이 아니라 types를 직접 부른다. 배럴은 일곱 커리큘럼을
// 전부 import하므로, 클라이언트 컴포넌트가 배럴을 거치면 본문과 각주 전체가 번들에 실린다
import { CHAPTER_SLOTS } from "@/content/curriculum/types";
import { MASTER_BY_ID, type Master } from "@/content/masters";
import { getCharacterAnchor } from "@/lib/masterPathAnchor";
import { getProgress, resetMasterProgress } from "@/lib/store";

const SWAY = [0, 48, 72, 48, 0];

/** 대가 한 명의 5장 경로 + 그 위의 진행 인지 CTA. 잠금은 없다 — 모든 노드가
 *  항상 눌린다. '완료'는 저장된 진도에서 오고, '다음'은 진도가 없는 첫 장이다.
 *
 *  scorable은 서버에서 styleMeta(masterId)로 계산해 내려받는다 — lib/scores.ts를
 *  여기서 직접 import하면 클라이언트 번들에 재무 데이터가 실린다.
 *
 *  chapterTitles도 같은 이유로 props다. CURRICULUM_BY_MASTER를 여기서 부르면
 *  일곱 커리큘럼의 본문과 각주 전체가 브라우저로 내려간다. 여기 필요한 건 제목뿐이다. */
export default function MasterPath({
  masterId,
  scorable,
  chapterTitles,
}: {
  masterId: Master["id"];
  scorable: boolean;
  chapterTitles: string[];
}) {
  const master = MASTER_BY_ID[masterId];
  const [done, setDone] = useState<Set<number>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    void getProgress().then((progress) => {
      if (!alive) return;
      const doneNos = CHAPTER_SLOTS.filter((slot) =>
        progress.lessonsDone.includes(`master:${masterId}:${slot.no}`),
      ).map((slot) => slot.no);
      setDone(new Set(doneNos));
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [masterId]);

  const nextNo = CHAPTER_SLOTS.find((slot) => !done.has(slot.no))?.no;
  const allDone = ready && nextNo === undefined;
  const isResume = ready && done.size > 0 && !allDone;

  // 진도를 읽기 전(첫 페인트)엔 '처음 오는 사람' 기준으로 보여준다. 진도가
  // 있는 재방문자는 읽힌 직후 '이어서 하기'로 한 번 바뀐다 — 체크 표시도
  // 같은 방식으로 뒤늦게 뜬다.
  const cta = allDone
    ? scorable
      ? { href: `/screener/${masterId}`, label: "이 기준으로 종목 보기" }
      : null
    : ready && done.size > 0
      ? { href: `/learn/masters/${masterId}/${nextNo}`, label: `${nextNo}장부터 이어서 하기` }
      : { href: `/learn/masters/${masterId}/1`, label: "1장부터 시작하기" };

  const figureAt = getCharacterAnchor(nextNo);
  const figureSway = SWAY[(figureAt - 1) % SWAY.length];

  async function restartLearning() {
    const confirmed = window.confirm(
      `${master.name} 학습을 처음부터 다시 시작할까요? 완료 상태와 퀴즈 결과만 초기화되며 기록형 답변은 유지됩니다.`,
    );
    if (!confirmed) return;
    await resetMasterProgress(masterId);
    setDone(new Set());
    setReady(true);
  }

  return (
    <div className="path-shell">
      <div className="path-map">
      <ol className="path" aria-label={`${master.name} 학습 경로`}>
        {chapterTitles.map((title, index) => {
          const slot = CHAPTER_SLOTS[index];
          const isDone = ready && done.has(slot.no);
          const isCurrent = ready && slot.no === nextNo;
          return (
            <li
              key={slot.no}
              className="path-row"
              data-current={isCurrent ? "true" : undefined}
              style={{ "--sway": `${SWAY[index % SWAY.length]}px` } as React.CSSProperties}
            >
              {isCurrent && (
                <span className="path-bubble" aria-hidden="true">
                  시작
                </span>
              )}
              <Link
                href={`/learn/masters/${masterId}/${slot.no}`}
                className="path-node"
                data-state={isDone ? "done" : isCurrent ? "current" : "todo"}
              >
                <span className="path-node-mark" aria-hidden="true">
                  {isDone ? "✓" : slot.no}
                </span>
                <span className="visually-hidden">
                  {slot.no}장 {title}
                  {isDone ? " · 완료" : isCurrent ? " · 지금 여기" : ""}
                </span>
              </Link>
              <span className="path-label" aria-hidden="true">
                <span className="path-label-slot">{slot.label}</span>
                <span className="path-label-title">{title}</span>
              </span>
              {isCurrent && cta && (
                <Link
                  href={cta.href}
                  className="btn path-cta-mobile"
                  data-resume={isResume ? "true" : undefined}
                >
                  {cta.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>

      <span
        className="path-figure"
        data-anchor={figureAt}
        style={
          {
            "--sway": `${figureSway}px`,
            "--path-row": figureAt - 1,
          } as React.CSSProperties
        }
      >
        {cta && !allDone && (
          <Link
            href={cta.href}
            className="path-guide-cta"
            data-resume={isResume ? "true" : undefined}
          >
            {cta.label}
          </Link>
        )}
        <MasterCharacter masterId={masterId} height={170} dimmed={!ready} />
      </span>
      </div>

      {allDone && cta && (
        <Link href={cta.href} className="btn path-cta">
          {cta.label}
        </Link>
      )}
      {ready && done.size > 0 && (
        <button type="button" className="path-restart" onClick={restartLearning}>
          처음부터 학습하기
        </button>
      )}
    </div>
  );
}
