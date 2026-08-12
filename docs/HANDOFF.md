# 인계 노트

에이전트(Codex ↔ Claude Code)나 사람이 바뀔 때 읽는 파일입니다.
**작업을 마치면 이 파일을 갱신하세요.** 오래된 인계 노트는 없는 것보다 나쁩니다.

마지막 갱신: 2026-08-11 · Claude Code

---

## 지금 상태

| | |
|---|---|
| 브랜치 | `feat/learn-duolingo-redesign` |
| 기준 | `develop` |
| PR | [#9](https://github.com/chrusterd/tokenaires_wisor/pull/9) — Draft |
| 커밋 | develop 대비 16개 |
| 테스트 | 70 pass / 0 fail |
| 정본 경로 | `C:\Users\Har27\Documents\Codex\2026-08-11\new-chat\tokenaires_wisor` |

## 무엇을 하는 중인가

배우기 화면을 듀오링고를 레퍼런스 삼아 다시 짜고 있습니다. 워런 버핏 캐릭터
에셋이 준비돼 있어 버핏 경로를 먼저 완성하고, 나머지 여섯 대가는 빈 슬롯으로 둡니다.

설계와 계획은 커밋돼 있습니다.

- `docs/superpowers/specs/2026-08-11-buffett-learn-redesign-design.md`
- `docs/superpowers/plans/2026-08-11-buffett-learn-redesign.md`
- `docs/superpowers/specs/2026-08-11-learn-master-carousel-design.md`
- `docs/superpowers/plans/2026-08-11-learn-master-carousel.md`

## 끝난 것

- 캐릭터 에셋 가공 — `apps/web/public/characters/buffett/`
- 팔레트 교체 — 골드 `#FFA000`(듀오링고 초록 자리) · 버건디 `#C2183C`(포인트) · 배경 순백
- 명조 제거, 굵기로 대비
- `content/characters.ts` — 대가별 에셋 유무 판정
- `components/MasterCharacter.tsx` — 캐릭터 한 장
- 대가 선택 화면, 지그재그 노드 경로, 골드 유닛 배너
- 챕터 단계별 캐릭터 반응 (`content/chapterMood.ts`)
- 대가 선택 카드 레일 (`components/MasterCarousel.tsx`)

## 다음

- 계획서 Task 9 — 전체 화면 점검이 아직입니다. 14개 라우트 200 확인, 콘솔 에러,
  모바일 가로 스크롤, 키보드 포커스.
- PR #9은 Draft입니다. 올리기 전에 Task 9를 끝내세요.

## 결정된 것 (뒤집기 전에 읽으세요)

- **기준 막대의 충족은 골드입니다. 버건디가 아닙니다.** 기준 막대는 스크리너와
  종목 상세에 나오는데, 그 화면에서 빨강은 가격 방향을 뜻합니다. 버건디는 붉은
  계열이라 충족 표시로 쓰면 제품이 하지 않기로 한 말을 하게 됩니다.
  버건디는 버튼과 배우기 화면 UI에만 씁니다.
- **골드와 황토는 색상환에서 가깝습니다.** 그래서 충족·미충족·미판정은 색이 아니라
  모양으로 갈립니다 — 단색 채움 / 빗금 / 점선 테두리. 이 구분을 없애지 마세요.
- **게임 요소는 파생 가능한 것까지만.** XP·레벨·진행률·완료 표시는 이미 저장된
  `lessonsDone`에서 계산합니다. 스트릭과 오늘의 목표는 `store.ts`에 필드 두 개를
  더하는 선까지. 하트(체력)·젬 상점·리더보드는 범위 밖입니다 — 리더보드는 서버가
  필요한데 Supabase가 아직 연결돼 있지 않습니다.
- **캐릭터 GIF는 높이 360으로 통일돼 있고 폭은 제각각입니다.** 일부러입니다.
  각 GIF를 캐릭터에 맞춰 잘라내서, 높이를 고정하면 표정이 바뀌어도 발이 같은 자리에
  놓입니다. 폭을 고정하거나 `object-fit: cover`를 넣으면 이 성질이 깨집니다.

## 함정

- **이 머신에 저장소 사본이 둘 이상 있습니다.** `Downloads\tokenaires_wisor-main`이
  그중 하나입니다. 개발 서버가 그 사본에서 떠서, 고치지도 않은 화면을 검증한 사고가
  있었습니다. 서버를 띄우면 어느 경로에서 도는지 먼저 확인하세요.
- **`~/.codex/.claude/launch.json`이 개발 서버 경로를 정합니다.** 저장소 안의
  `.claude/launch.json`이 아닙니다. 사본을 옮기면 이 파일도 같이 고쳐야 합니다.
- **개발 서버가 살아 있는 동안 `.next`를 지우면 서버가 깨집니다.**
  `Cannot find module './885.js'` 같은 오류가 나면 서버를 멈추고 `.next`를 지운 뒤
  다시 띄우세요. 순서가 중요합니다.
- **브라우저 콘솔 버퍼가 재시작 전 오류를 계속 들고 있습니다.** 오류가 오래돼
  보이면 실제 요청 기록과 대조하고 나서 판단하세요.
- **바이너리 diff는 리뷰로 안 잡힙니다.** 캐릭터 이미지의 머리카락이 배경 제거
  과정에서 지워진 적이 있는데, diff에는 `Bin 0 -> 40690 bytes`로만 보였습니다.
  이미지를 바꿨으면 열어서 보세요.

## 미해결

- **`lucide-react` 설치는 보류 중입니다.** 아이콘 라이브러리로 쓰기로 했지만,
  루트 `CLAUDE.md`가 "의존성 추가 금지, 지금 웹은 Next와 React뿐"이라고 못박고
  있습니다. 4인이 공유하는 규칙이라 팀 합의가 필요합니다.
- **`.claude/launch.json`에 머신별 절대 경로가 들어 있습니다.** PR #9에 포함돼
  있어 다른 사람 머신에서는 동작하지 않습니다. `.gitignore`로 옮겼습니다 —
  이미 추적 중인 파일은 `git rm --cached`가 따로 필요합니다.
- **`public/characters/buffett/main.png`는 알파 채널이 없습니다.** 흰 배경 위에
  올리면 문제없지만 골드 위에 올리면 흰 사각형이 보입니다. 배치된 자리를 확인하세요.
