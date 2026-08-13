"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import DuoQuiz from "@/components/DuoQuiz";
import { STOCK_BASICS } from "@/content/stockBasics";

/** /learn 카드를 누르면 다섯 단원 + 퀴즈를 페이지 이동 없이 모달로 보여준다.
 *  이전에는 별도 라우트(/learn/basics)였지만, 진입 장벽을 낮추려고 모달로 옮겼다. */
export default function StockBasicsLauncher() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="learn-tool"
        onClick={() => setOpen(true)}
      >
        <span>주식 기본개념</span>
        <span className="learn-tool-arrow" aria-hidden="true">→</span>
      </button>

      {open && mounted &&
        createPortal(
          <div
            className="modal-overlay"
            role="presentation"
            onClick={() => setOpen(false)}
          >
            <div
              className="modal-panel"
              role="dialog"
              aria-modal="true"
              aria-label="주식 기본개념"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="modal-close"
                aria-label="닫기"
                onClick={() => setOpen(false)}
              >
                ×
              </button>

              <div className="wrap wrap-narrow" style={{ paddingBlock: "2.5rem 3rem" }}>
                <p className="eyebrow">배우기 · 주식 기본개념</p>
                <h1 className="thesis" style={{ fontSize: "1.6rem" }}>
                  한 페이지로 끝내는 주식 기본개념
                </h1>
                <p className="lede">
                  주식이 무엇인지부터 시장의 작동 방식, 시가총액, 배당, 분산투자까지 다섯 단원을
                  이어서 봅니다. 단원마다 끝에 바로 문항을 확인하는 퀴즈가 있습니다.
                </p>

                <nav className="toc" aria-label="단원 목차">
                  {STOCK_BASICS.map((lesson) => (
                    <a key={lesson.id} href={`#modal-${lesson.id}`} className="toc-item">
                      <span className="toc-no">{String(lesson.order).padStart(2, "0")}</span>
                      <span>
                        <span className="toc-title">{lesson.title}</span>
                        <span className="toc-question">{lesson.oneLine}</span>
                      </span>
                    </a>
                  ))}
                </nav>

                {STOCK_BASICS.map((lesson, index) => (
                  <section
                    key={lesson.id}
                    id={`modal-${lesson.id}`}
                    style={{ scrollMarginTop: "1.5rem" }}
                  >
                    <hr className="rule" />

                    <p className="eyebrow">
                      {lesson.order}단원 / {STOCK_BASICS.length}
                    </p>
                    <h2 className="section">{lesson.title}</h2>
                    <p className="lede">{lesson.oneLine}</p>

                    <div className="stack" style={{ marginTop: "1.25rem" }}>
                      {lesson.concepts.map((c, i) => (
                        <div key={i} className="card">
                          <h3 className="sub">{c.term}</h3>
                          <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: "0.93rem" }}>
                            {c.body}
                          </p>
                        </div>
                      ))}
                    </div>

                    <p className="eyebrow" style={{ marginTop: "2rem" }}>
                      상황으로 보기
                    </p>
                    <div className="chart-example">
                      <h3>{lesson.scenario.title}</h3>
                      <p>{lesson.scenario.body}</p>
                      <p className="chart-example-conclusion">
                        <strong>여기까지 말할 수 있습니다.</strong> {lesson.scenario.takeaway}
                      </p>
                    </div>

                    <p className="eyebrow" style={{ marginTop: "2rem" }}>
                      한 문항씩 풀어보기
                    </p>
                    <h3 className="sub" style={{ marginBottom: "1.25rem" }}>
                      {lesson.quiz.length}문항
                    </h3>
                    <DuoQuiz
                      id={`basics:${lesson.id}`}
                      items={lesson.quiz}
                      startEvent="stock_basics_started"
                      completedEvent="stock_basics_completed"
                    />

                    {index === STOCK_BASICS.length - 1 && (
                      <>
                        <hr className="rule" />
                        <Link
                          href="/learn"
                          className="card card-link"
                          onClick={() => setOpen(false)}
                        >
                          <p className="eyebrow">다음 단계</p>
                          <strong>투자 대가에게 배우기</strong>
                        </Link>
                      </>
                    )}
                  </section>
                ))}

                <p className="disclaimer">
                  이 단원들은 주식 거래의 기본 개념을 설명하는 것이며, 특정 종목의 매수·매도를
                  권하지 않습니다.
                </p>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
