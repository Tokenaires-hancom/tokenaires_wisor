import Link from "next/link";
import { notFound } from "next/navigation";
import ChapterExercises from "@/components/ChapterExercises";
import LearnGameDock from "@/components/game/LearnGameDock";
import {
  CHAPTER_SLOTS,
  CURRICULA,
  chapterOf,
} from "@/content/curriculum";
import { chapterSteps } from "@/content/curriculum/steps";
import { MASTER_BY_ID, type Master } from "@/content/masters";
import { styleMeta } from "@/lib/scores";

export function generateStaticParams() {
  return CURRICULA.flatMap((curriculum) =>
    curriculum.chapters.map((_, index) => ({
      slug: curriculum.masterId,
      chapter: String(index + 1),
    })),
  );
}

export default async function ChapterPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; chapter: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { slug, chapter: chapterParam } = await params;
  const { step } = await searchParams;
  const master = MASTER_BY_ID[slug as Master["id"]];
  const no = Number(chapterParam);
  const chapter = chapterOf(slug, no);

  if (!master || !Number.isInteger(no) || !chapter) notFound();

  const slot = CHAPTER_SLOTS[no - 1];
  const nextSlot = no < CHAPTER_SLOTS.length ? CHAPTER_SLOTS[no] : undefined;
  const meta = styleMeta(master.id);
  const next = nextSlot
    ? { href: `/learn/masters/${master.id}/${nextSlot.no}`, label: "다음 장" }
    : meta
      ? { href: `/screener/${master.id}`, label: "이 기준으로 종목 보기" }
      : { href: `/learn/masters/${master.id}`, label: "개요로 돌아가기" };

  const stepCount = chapterSteps(chapter.exercises).length;
  const parsedStep = Number(step);
  const initialStep = Number.isInteger(parsedStep)
    ? Math.min(Math.max(parsedStep, 0), stepCount - 1)
    : 0;

  return (
    <div className="wrap chapter-page">
      <div className="chapter-page-copy">
        <Link href={`/learn/masters/${master.id}`} className="chapter-back-link">
          <span aria-hidden="true">←</span>
          <strong>{master.name} 목차</strong>
        </Link>

        <nav className="chapter-route" aria-label="챕터 단계">
          <ol>
            {CHAPTER_SLOTS.map((chapterSlot) => {
              const isCurrent = chapterSlot.no === slot.no;

              return (
                <li key={chapterSlot.slot} data-current={isCurrent || undefined}>
                  <Link
                    href={`/learn/masters/${master.id}/${chapterSlot.no}`}
                    aria-current={isCurrent ? "page" : undefined}
                  >
                    <span className="chapter-route-number" aria-hidden="true">
                      {chapterSlot.no}
                    </span>
                    <span className="chapter-route-label">{chapterSlot.label}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </nav>

        <p className="lede">{slot.asks}</p>
        <h1 className="chapter-title">{chapter.title}</h1>
        <p className="chapter-lede">{chapter.lede}</p>

        <hr className="rule" />
      </div>

      <ChapterExercises
        chapterId={`master:${master.id}:${slot.no}`}
        masterId={master.id}
        exercises={chapter.exercises}
        body={chapter.body}
        sources={chapter.sources}
        closing={chapter.lede}
        initialStep={initialStep}
        next={next}
      />

      <LearnGameDock masterId={master.id} />
    </div>
  );
}
