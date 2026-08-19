import { characterMood, characterStand, type CharacterMood } from "@/content/characters";

/** 캐릭터 한 장. 정지 이미지는 대가별 전용 자산을 쓰고, 장별 화면에서
 *  요청한 반응 이미지가 아직 없는 대가는 이미지를 렌더링하지 않는다.
 *
 *  mood를 주면 움직이는 WebP, 안 주면 정지 이미지다. 움직임을 꺼 달라고
 *  한 사용자에게는 mood와 무관하게 정지 이미지를 준다 — CSS로는 애니메이션
 *  파일을 멈출 수 없으므로 src 자체를 바꾼다. */
export default function MasterCharacter({
  masterId,
  mood,
  height = 220,
  dimmed = false,
}: {
  masterId: string;
  mood?: CharacterMood;
  height?: number;
  dimmed?: boolean;
}) {
  const stand = characterStand(masterId);
  if (!stand) return null;

  const moving = mood ? characterMood(masterId, mood) : null;
  if (mood && !moving) return null;

  return (
    <picture className="character" data-dimmed={dimmed ? "true" : undefined}>
      {moving && <source srcSet={stand} media="(prefers-reduced-motion: reduce)" />}
      <img src={moving ?? stand} alt="" height={height} style={{ height }} />
    </picture>
  );
}
