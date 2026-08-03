"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { LESSON_BY_ID } from "@/content/chartLessons";
import { track } from "@/lib/analytics";

const API = process.env.NEXT_PUBLIC_CHART_API ?? "http://localhost:8000";
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

const VISIBILITY_LABEL: Record<string, string> = {
  clear: "명확히 보임",
  partial: "일부 보임",
  unclear: "판독 어려움",
};

const CATEGORY_LABEL: Record<string, string> = {
  chart_type: "차트 유형",
  candle: "캔들",
  moving_average: "이동평균선",
  trend: "추세",
  support_resistance: "지지와 저항",
  volume: "거래량",
  axis: "축",
};

type Observation = { category: string; visibility: string; description: string };

type Analysis = {
  chartType: string;
  observations: Observation[];
  uncertainties: string[];
  learningPoints: string[];
  relatedLessons: string[];
  disclaimer: string;
  filtered: boolean;
};

const CHART_TYPE_LABEL: Record<string, string> = {
  candlestick: "캔들 차트",
  line: "선 차트",
  bar: "바 차트",
  area: "영역 차트",
  unknown: "판독하지 못함",
};

export default function ChartAnalyzer({ lessonId }: { lessonId?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Analysis | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function send(file: File) {
    setError(null);
    setResult(null);

    if (!ACCEPTED.includes(file.type)) {
      setError("JPG, PNG, WebP 이미지만 올릴 수 있습니다.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("이미지가 5MB를 넘습니다. 차트 영역만 잘라서 올려주세요.");
      return;
    }

    setFileName(file.name);
    setBusy(true);
    track("chart_analysis_requested", { lessonId });

    const form = new FormData();
    form.append("image", file);
    if (lessonId) form.append("lesson_id", lessonId);

    try {
      const response = await fetch(`${API}/api/chart/analyze`, { method: "POST", body: form });
      const body = await response.json();

      if (!response.ok) {
        setError(body.detail ?? "분석하지 못했습니다. 다른 이미지로 다시 시도해 주세요.");
        return;
      }
      setResult(body as Analysis);
      track("chart_analysis_completed", { lessonId, chartType: body.chartType });
    } catch {
      setError(
        `분석 서비스에 연결하지 못했습니다. 차트 분석 서버가 켜져 있는지 확인해 주세요 (${API}).`
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <p className="notice">
        계좌번호, 보유금액, 주문 내역 같은 개인정보가 보이지 않도록 <strong>차트 영역만
        잘라서</strong> 올려주세요. 올린 이미지는 저장하지 않고 분석 직후 버립니다.
      </p>

      <div
        className="dropzone"
        data-over={over}
        style={{ marginTop: "1rem" }}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void send(file);
        }}
      >
        <p style={{ margin: "0 0 1rem" }}>
          {busy
            ? "차트에서 보이는 요소를 읽는 중입니다…"
            : fileName
              ? `${fileName} — 다른 이미지로 바꾸려면 다시 올려주세요.`
              : "차트 이미지를 여기에 끌어다 놓으세요."}
        </p>
        <button type="button" className="btn" disabled={busy} onClick={() => inputRef.current?.click()}>
          이미지 고르기
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void send(file);
            e.target.value = "";
          }}
        />
        <p className="mono" style={{ marginBottom: 0, color: "var(--ink-faint)" }}>
          JPG · PNG · WebP · 5MB 이하 · 베타 기능
        </p>
      </div>

      {error && (
        <p className="notice" style={{ marginTop: "1rem" }}>
          {error}
        </p>
      )}

      {result && (
        <div style={{ marginTop: "2rem" }}>
          <p className="eyebrow">차트 유형</p>
          <h2 className="section">{CHART_TYPE_LABEL[result.chartType] ?? result.chartType}</h2>

          <h3 className="sub" style={{ marginTop: "2rem" }}>
            차트에서 관찰되는 요소
          </h3>
          {result.observations.map((obs, i) => (
            <div className="observation" key={i}>
              <span className="visibility" data-v={obs.visibility}>
                {VISIBILITY_LABEL[obs.visibility] ?? obs.visibility}
              </span>
              <span>
                <span className="obs-category">{CATEGORY_LABEL[obs.category] ?? obs.category}</span>
                {obs.description}
              </span>
            </div>
          ))}

          <h3 className="sub" style={{ marginTop: "2rem" }}>
            이 이미지로는 알기 어려운 것
          </h3>
          <ul className="reason-list">
            {result.uncertainties.map((u, i) => (
              <li key={i} data-kind="unknown">
                {u}
              </li>
            ))}
          </ul>

          {result.relatedLessons.length > 0 && (
            <>
              <h3 className="sub" style={{ marginTop: "2rem" }}>
                이어서 볼 학습
              </h3>
              <div className="grid">
                {result.relatedLessons.map((id) => {
                  const lesson = LESSON_BY_ID[id];
                  if (!lesson) return null;
                  return (
                    <Link
                      key={id}
                      href={`/learn/chart/${id}`}
                      className="card card-link"
                      onClick={() => track("related_chart_lesson_opened", { id })}
                    >
                      <p className="eyebrow">{lesson.order}단원</p>
                      <strong>{lesson.title}</strong>
                    </Link>
                  );
                })}
              </div>
            </>
          )}

          <p className="disclaimer">
            {result.disclaimer}
            {result.filtered && " 설명 중 교육 목적에 맞지 않는 문장은 제외했습니다."}
          </p>
        </div>
      )}
    </section>
  );
}
