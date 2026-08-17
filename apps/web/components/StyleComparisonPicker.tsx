"use client";

import { useState } from "react";
import { percentShares } from "@/lib/percent";

/** 표가 그리는 데 필요한 문장만 받는다. 커리큘럼 본문이나 대가 객체를 통째로
 *  넘기면 그것이 전부 브라우저 번들에 실린다. */
export type PickerSlot = { no: number; label: string; picks: string };
export type PickerRow = { masterId: string; name: string; cells: string[] };

function cellKey(masterId: string, no: number) {
  return `${masterId}-${no}`;
}

export default function StyleComparisonPicker({
  slots,
  rows,
}: {
  slots: PickerSlot[];
  rows: PickerRow[];
}) {
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  const [opened, setOpened] = useState(false);
  // 좁은 화면에서 접었다 펴는 질문. 처음에는 첫 질문만 펴 둔다 — 넷을 다 펴면
  // 스물여덟 줄이 한꺼번에 쏟아지고, 다 접으면 할 일이 안 보인다
  const [openSlots, setOpenSlots] = useState<ReadonlySet<number>>(() => new Set([slots[0].no]));

  function toggleSection(no: number) {
    setOpenSlots((before) => {
      const after = new Set(before);
      if (!after.delete(no)) after.add(no);
      return after;
    });
  }

  function toggle(key: string) {
    setPicked((before) => {
      const after = new Set(before);
      if (!after.delete(key)) after.add(key);
      // 다 지우면 그래프도 닫는다. 빈 그래프를 열어 두면 다음에 고를 때
      // 누르지도 않은 결과가 튀어나온다
      if (after.size === 0) setOpened(false);
      return after;
    });
  }

  function reset() {
    setPicked(new Set());
    setOpened(false);
  }

  const total = picked.size;
  const counts = rows.map(
    (row) => slots.filter((slot) => picked.has(cellKey(row.masterId, slot.no))).length,
  );
  const shares = percentShares(counts);

  // 큰 쪽부터 읽히게 두되 같은 값은 커리큘럼 순서를 지킨다. 동점을 순위로 가르지 않는다
  const ranked = rows
    .map((row, index) => ({
      masterId: row.masterId,
      name: row.name,
      count: counts[index],
      share: shares[index],
    }))
    .sort((a, b) => b.share - a.share);

  return (
    <div className="comparison-layout">
      <div className="comparison-scroll" tabIndex={0} aria-label="일곱 투자 철학의 네 질문 비교표">
        <table className="comparison-matrix">
          <thead>
            <tr>
              <th scope="col">투자 철학</th>
              {slots.map((slot) => (
                <th key={slot.no} scope="col">
                  <span>{slot.label}</span>
                  <small>{slot.picks}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.masterId} data-master={row.masterId}>
                <th scope="row">
                  <span className="comparison-master">
                    {/* 이름이 바로 옆에 있으므로 alt는 비운다 */}
                    <img src={`/investors/${row.masterId}.png`} alt="" width={40} height={40} />
                    <span>{row.name}</span>
                  </span>
                </th>
                {row.cells.map((cell, cellIndex) => {
                  const slot = slots[cellIndex];
                  const key = cellKey(row.masterId, slot.no);
                  const on = picked.has(key);
                  return (
                    <td key={slot.no} className={on ? "is-picked" : undefined}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        aria-label={`${row.name} · ${slot.label} · ${cell}`}
                        className="comparison-cell"
                        onClick={() => toggle(key)}
                      >
                        {cell}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 좁은 화면. 표를 접어 넣을 수 없어 질문 단위로 다시 쌓는다. 행이 대가이고
          열이 질문이라 CSS로는 뒤집히지 않으므로 마크업이 한 벌 더 있다.
          여기에는 대가 이름을 넣지 않는다 — 이름을 보고 고르면 그래프가 확인이 아니라
          답 맞히기가 된다. 누구였는지는 그래프에서 밝혀진다 */}
      <div className="comparison-stack">
        {slots.map((slot, slotIndex) => {
          const isOpen = openSlots.has(slot.no);
          const chosen = rows.filter((row) => picked.has(cellKey(row.masterId, slot.no))).length;
          return (
            <section key={slot.no} className="comparison-stack-group">
              <h3 className="comparison-stack-question">
                <button
                  type="button"
                  className="comparison-stack-toggle"
                  aria-expanded={isOpen}
                  aria-controls={`stack-${slot.no}`}
                  onClick={() => toggleSection(slot.no)}
                >
                  <span className="comparison-stack-label">
                    <span>{slot.label}</span>
                    <small>{slot.picks}</small>
                  </span>
                  {/* 접어 둬도 이 질문에서 몇 개를 골랐는지는 남는다 */}
                  {chosen > 0 && <span className="mono">{chosen}</span>}
                  <span className="comparison-stack-caret" aria-hidden="true" />
                </button>
              </h3>
              <ul id={`stack-${slot.no}`} hidden={!isOpen}>
                  {rows.map((row) => {
                    const key = cellKey(row.masterId, slot.no);
                    const on = picked.has(key);
                    const text = row.cells[slotIndex];
                    return (
                      <li key={row.masterId} data-master={row.masterId}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          aria-label={`${slot.label} · ${text}`}
                          className={on ? "comparison-choice is-picked" : "comparison-choice"}
                          onClick={() => toggle(key)}
                        >
                          {text}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
      </div>

      <aside className="comparison-rail">
        <p className="comparison-rail-title">내 기준</p>

        {/* 읽어 줄 자리는 개수 줄 하나다. 레일 전체에 걸면 칸을 누를 때마다
            막대 일곱 개가 통째로 다시 읽힌다 */}
        {total === 0 ? (
          <p className="comparison-rail-empty" aria-live="polite">
            표에서 공감되는 칸을 고르세요.
          </p>
        ) : (
          <p className="comparison-rail-count" aria-live="polite">
            <span className="mono">{total}칸</span>을 골랐습니다.
          </p>
        )}

        {total > 0 && !opened && (
          <button type="button" className="comparison-open" onClick={() => setOpened(true)}>
            클릭하여 내 기준 살펴보기
          </button>
        )}

        {total > 0 && opened && (
          <ul className="comparison-chart">
            {ranked.map((entry) => (
              <li
                key={entry.masterId}
                data-master={entry.masterId}
                title={`고른 ${total}칸 중 ${entry.count}칸`}
              >
                <span className="comparison-chart-label">
                  {/* 얼굴은 이름 옆의 표식이다. 이름이 이미 있으므로 alt는 비운다 */}
                  <img
                    className="comparison-chart-face"
                    src={`/investors/${entry.masterId}.png`}
                    alt=""
                    width={26}
                    height={26}
                  />
                  <span className="comparison-chart-name">{entry.name}</span>
                  <span className="mono">{entry.share}%</span>
                </span>
                {/* 막대 길이는 100% 기준이다. 최댓값에 맞춰 늘이면 43%가 꽉 찬 막대로
                    보여 "거의 전부 이 대가"로 읽힌다 */}
                <span className="comparison-chart-track">
                  <span
                    className="comparison-chart-bar"
                    style={{ ["--share" as string]: `${entry.share}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}

        {total > 0 && (
          <button type="button" className="comparison-reset" onClick={reset}>
            고른 칸 지우기
          </button>
        )}
      </aside>
    </div>
  );
}
