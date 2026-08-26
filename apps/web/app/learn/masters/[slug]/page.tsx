import "../../../master-tabs.css";
import Link from "next/link";
import { notFound } from "next/navigation";
import MasterPath from "@/components/MasterPath";
import MatchPairs from "@/components/game/MatchPairs";
import MobileMasterDock from "@/components/MobileMasterDock";
import MasterTabs, { type MasterTab } from "@/components/MasterTabs";
import { CURRICULUM_BY_MASTER } from "@/content/curriculum";
import { MASTERS, MASTER_BY_ID, type Master } from "@/content/masters";
import { styleMeta } from "@/lib/scores";

export function generateStaticParams() {
  return MASTERS.map((m) => ({ slug: m.id }));
}

export default async function MasterLesson({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const master = MASTER_BY_ID[slug as Master["id"]];
  if (!master) notFound();

  const meta = styleMeta(master.id);
  const curriculum = CURRICULUM_BY_MASTER[master.id];

  const masterTabs: MasterTab[] = [
    {
      id: "achievements",
      label: "업적",
      shortLabel: "업적",
      description: "이 투자자가 시장과 투자사에 남긴 기록",
      kind: "achievements",
      content: (
        <ol className="achievement-records">
          {master.achievements.map((achievement) => (
            <li key={`${achievement.label}-${achievement.title}`}>
              <span className="achievement-label">{achievement.label}</span>
              <div className="achievement-body">
                <h4>{achievement.title}</h4>
                <p>{achievement.body}</p>
                <small>근거 · {achievement.source}</small>
              </div>
            </li>
          ))}
        </ol>
      ),
    },
    {
      id: "principles",
      label: "원칙",
      shortLabel: "원칙",
      description: "이 철학이 기업을 바라보는 기준",
      content: (
        <ul className="master-list">
          {master.principles.map((p) => (
            <li key={p.title}>
              <strong>{p.title}</strong> — {p.body}
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: "likes",
      label: "기업 조건",
      shortLabel: "조건",
      description: "이 철학이 선호하는 기업의 조건",
      content: (
        <ul className="reason-list">
          {master.likes.map((l, i) => (
            <li key={i} data-kind="pass">
              {l}
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: "sources",
      label: "근거",
      shortLabel: "근거",
      description: "판단의 바탕이 된 자료와 출처",
      content: (
        // 개수를 세지 않는다. primarySources에는 자료 외에 앞 항목의 세부·배경 사실·
        // 주의문이 섞여 있어서, 배열 길이가 자료 종수와 일치하지 않는다
        <>
          <ul className="master-list">
            {curriculum.primarySources.map((source) => (
              <li key={source}>{source}</li>
            ))}
          </ul>
          <p className="master-note">
            각 장의 본문 아래에 문단별 출처가 접혀 있습니다.{" "}
            <Link href="/learn/sources">전체 참고문헌</Link>
          </p>
        </>
      ),
    },
    {
      id: "fails",
      label: "한계",
      shortLabel: "한계",
      description: "이 철학이 잘 통하지 않거나 추가 확인이 필요한 상황",
      kind: "limits",
      content: (
        <ul className="reason-list">
          {master.failsWhen.map((f, i) => (
            <li key={i} data-kind="fail">
              {f}
            </li>
          ))}
        </ul>
      ),
    },
  ];

  if (!meta) {
    masterTabs.push({
      id: "diagnosis",
      label: "자가진단",
      shortLabel: "진단",
      description: "공시 숫자만으로 판정할 수 없는 확인 항목",
      kind: "diagnosis",
      content: (
        <>
          <p className="master-note">
            이 항목들은 공시 숫자만으로 판정할 수 없습니다. 답을 알고 있는지보다 근거를 직접
            구할 수 있는지가 중요합니다.
          </p>
          <ul className="reason-list">
            {master.principles.map((p) => (
              <li key={p.title} data-kind="unknown">
                {p.title}
              </li>
            ))}
          </ul>
        </>
      ),
    });
  }

  return (
    <div className="wrap master-page">
      <div className="master-shell">
        <nav className="master-rail" aria-label="다른 대가로 이동">
          {MASTERS.map((m) => (
            <Link
              key={m.id}
              href={`/learn/masters/${m.id}`}
              className="master-rail-item"
              data-current={m.id === master.id ? "true" : undefined}
              aria-current={m.id === master.id ? "page" : undefined}
            >
              <img src={`/investors/${m.id}.png`} alt={m.name} width={64} height={64} />
              <span className="master-rail-name" aria-hidden="true">
                {m.name}
              </span>
            </Link>
          ))}
        </nav>

        <MobileMasterDock currentId={master.id} />

        <div className="master-main">
          <div className="unit-banner">
            <Link href="/learn" className="unit-banner-back" aria-label="배우기 목록으로">
              <span aria-hidden="true">←</span>
            </Link>
            <div className="unit-banner-text">
              <p className="unit-banner-style">{master.styleName}</p>
              <h1 className="unit-banner-name">{master.name}</h1>
            </div>
            <a href="#achievements" className="unit-banner-guide">
              업적 보기
            </a>
          </div>

          <p className="lede" style={{ textAlign: "center", margin: "1.25rem auto 2rem" }}>
            {master.oneLine}
          </p>

          <MasterPath
            masterId={master.id}
            scorable={!!meta}
            chapterTitles={curriculum.chapters.map((chapter) => chapter.title)}
          />

          {master.principles.length >= 3 && (
            <MatchPairs
              title={`${master.name}의 원칙과 뜻 잇기`}
              pairs={master.principles.slice(0, 5).map((p) => ({ term: p.title, def: p.body }))}
            />
          )}

          <section className="master-achievements" id="achievements" aria-labelledby="achievements-title">
            <MasterTabs
              tabs={masterTabs}
              title={`${master.name}의 투자 파일`}
              headingId="achievements-title"
              footer={
                <p>
                  수익률 숫자보다 오래 남은 질문과 도구를 중심으로 봅니다. 무엇을 해냈는지와
                  오늘의 투자자가 무엇을 이어받았는지를 함께 정리했습니다.
                </p>
              }
            />
          </section>
        </div>
      </div>
    </div>
  );
}
