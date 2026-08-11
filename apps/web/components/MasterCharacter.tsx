import { characterMood, characterStand, type CharacterMood } from "@/content/characters";

/** 캐릭터 한 장. 에셋이 없는 대가면 아무것도 그리지 않는다 —
 *  호출부가 매번 조건을 쓰지 않아도 되게 여기서 null을 반환한다.
 *
 *  mood를 주면 움직이는 GIF, 안 주면 정지 이미지다. 움직임을 꺼 달라고
 *  한 사용자에게는 mood와 무관하게 정지 이미지를 준다 — CSS로는 GIF를
 *  멈출 수 없으므로 src 자체를 바꾼다. */
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

  return (
    <picture className="character" data-dimmed={dimmed ? "true" : undefined}>
      {moving && <source srcSet={stand} media="(prefers-reduced-motion: reduce)" />}
      <img src={moving ?? stand} alt="" height={height} style={{ height }} />
    </picture>
  );
}
