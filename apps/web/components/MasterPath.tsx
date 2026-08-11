"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CHAPTER_SLOTS, CURRICULUM_BY_MASTER } from "@/content/curriculum";
import { MASTER_BY_ID, type Master } from "@/content/masters";
import { getProgress } from "@/lib/store";

/** 대가 한 명의 5장 경로 + 그 위의 진행 인지 CTA. 잠금은 없다 — 모든 노드가
 *  항상 눌린다. '완료'는 저장된 진도에서 오고, '다음'은 진도가 없는 첫 장이다.
 *
 *  scorable은 서버에서 styleMeta(masterId)로 계산해 내려받는다 — lib/scores.ts를
 *  여기서 직접 import하면 클라이언트 번들에 재무 데이터가 실린다. */
export default function MasterPath({
  masterId,
  scorable,
}: {
  masterId: Master["id"];
  scorable: boolean;
}) {
  const master = MASTER_BY_ID[masterId];
  const curriculum = CURRICULUM_BY_MASTER[masterId];
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

  return (
    <div>
      {cta && (
        <Link href={cta.href} className="btn" style={{ marginBottom: "1rem" }}>
          {cta.label}
        </Link>
      )}
      <ol className="master-path" aria-label={`${master.name} 학습 경로`}>
        {curriculum.chapters.map((chapter, index) => {
          const slot = CHAPTER_SLOTS[index];
          const isDone = ready && done.has(slot.no);
          const isCurrent = ready && slot.no === nextNo;
          return (
            <li key={slot.no}>
              <Link
                href={`/learn/masters/${masterId}/${slot.no}`}
                className="master-path-node"
                data-state={isDone ? "done" : isCurrent ? "current" : undefined}
              >
                <span className="master-path-no">{String(slot.no).padStart(2, "0")}</span>
                <span className="master-path-body">
                  <span className="master-path-label">{slot.label}</span>
                  <span className="master-path-title">{chapter.title}</span>
                </span>
                {isDone && (
                  <span className="master-path-check" aria-hidden="true">
                    ✓
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
