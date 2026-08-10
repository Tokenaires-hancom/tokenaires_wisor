import Link from "next/link";
import { notFound } from "next/navigation";
import ChapterExercises from "@/components/ChapterExercises";
import {
  CHAPTER_SLOTS,
  CURRICULA,
  CURRICULUM_BY_MASTER,
  chapterOf,
} from "@/content/curriculum";
import { MASTER_BY_ID, type Master } from "@/content/masters";

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
}: {
  params: Promise<{ slug: string; chapter: string }>;
}) {
  const { slug, chapter: chapterParam } = await params;
  const master = MASTER_BY_ID[slug as Master["id"]];
  const no = Number(chapterParam);
  const chapter = chapterOf(slug, no);

  if (!master || !Number.isInteger(no) || !chapter) notFound();

  const curriculum = CURRICULUM_BY_MASTER[master.id];
  const slot = CHAPTER_SLOTS[no - 1];
  const previous = no > 1 ? CHAPTER_SLOTS[no - 2] : undefined;
  const next = no < CHAPTER_SLOTS.length ? CHAPTER_SLOTS[no] : undefined;

  return (
    <div className="wrap wrap-narrow" style={{ paddingBlock: "3.5rem 5rem" }}>
      <p className="eyebrow">
        {master.name} · {slot.no}장 {slot.label} / {curriculum.chapters.length}
      </p>

      <h1 className="chapter-title">{chapter.title}</h1>
      <p className="chapter-lede">{chapter.lede}</p>
      <p className="lede">{slot.asks}</p>

      <hr className="rule" />

      <ChapterExercises
        chapterId={`master:${master.id}:${slot.no}`}
        exercises={chapter.exercises}
        body={chapter.body}
        closing={chapter.lede}
      />

      <nav className="chapter-nav" aria-label="장 이동">
        <div>
          {previous ? (
            <Link href={`/learn/masters/${master.id}/${previous.no}`} className="card card-link">
              <p className="eyebrow">이전 장</p>
              <strong>
                {previous.no}장 {previous.label}
              </strong>
            </Link>
          ) : (
            <Link href={`/learn/masters/${master.id}`} className="card card-link">
              <p className="eyebrow">목차</p>
              <strong>{master.name} 전체 보기</strong>
            </Link>
          )}
        </div>
        <div>
          {next ? (
            <Link href={`/learn/masters/${master.id}/${next.no}`} className="card card-link">
              <p className="eyebrow">다음 장</p>
              <strong>
                {next.no}장 {next.label}
              </strong>
            </Link>
          ) : (
            <Link href={`/screener/${master.id}`} className="card card-link">
              <p className="eyebrow">다음 단계</p>
              <strong>이 기준으로 종목 보기</strong>
            </Link>
          )}
        </div>
      </nav>

      <p className="disclaimer">{curriculum.currency}</p>
    </div>
  );
}
