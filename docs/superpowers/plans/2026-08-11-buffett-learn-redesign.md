# 배우기 루트 리디자인 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 듀오링고를 레퍼런스로 `/learn` 대가 선택과 버핏 학습 경로를 다시 짜고, 준비된 워런 버핏 캐릭터 에셋을 화면에 넣는다.

**Architecture:** 색·활자 토큰을 `globals.css` 한 곳에서 갈아끼워 전 화면이 새 팔레트를 자동으로 입게 한 뒤, `/learn` 카드 그리드와 `MasterPath`의 마크업을 바꾼다. 캐릭터는 `public/characters/buffett/`의 정적 파일이고, 어느 대가가 캐릭터를 가졌는지는 상수 배열 하나로 판정한다. 챕터의 GIF 전환은 `ChapterExercises`가 이미 들고 있는 단계·정답 상태를 읽는 순수 함수로 계산한다.

**Tech Stack:** Next.js 15.5.22 (App Router), React 19, TypeScript 5.7, 순수 CSS(프레임워크 없음), 테스트는 `node --test`

## Global Constraints

- 작업 폴더는 `C:\Users\Har27\Documents\Codex\2026-08-11\new-chat\tokenaires_wisor`. 브랜치 `develop`.
- **원격은 읽기 권한만 있다. 절대 push하지 않는다.** 로컬 커밋까지만.
- 웹 앱 명령은 전부 `apps/web`에서 실행한다.
- 테스트 러너는 `npm test`(= `node --test "content/**/*.test.ts" "lib/**/*.test.ts"`)다. vitest도 jest도 아니다. 테스트 파일은 이 두 glob 안에 있어야 실행된다.
- 기준선: 시작 시점 `npm test` 52개 전부 통과. 매 커밋 전 이 숫자가 줄지 않아야 한다.
- Node 24.18.0. `package.json`의 `engines`는 `>=23`.
- 색은 아래 값을 **글자 그대로** 쓴다. 근사값 금지.
  - `--gold: #FFA000` `--gold-deep: #C67B00` `--gold-soft: #FFF4E0` `--gold-line: #FFD08A`
  - `--wine: #C2183C` `--wine-deep: #92102C` `--wine-soft: #FCE9ED` `--wine-line: #EFA9B7`
  - `--paper: #FFFFFF` `--surface: #FFFFFF` `--surface-sunk: #F7F7F7`
  - `--ink: #4B4B4B` `--ink-soft: #777777` `--ink-faint: #AFAFAF`
  - `--line: #E5E5E5` `--line-strong: #CFCFCF`
- 골드 위에 얹는 글자는 16px 이상, `font-weight: 700` 이상만 허용한다. 작은 설명 문구를 골드 배경에 올리지 않는다.
- 상태를 색만으로 구분하지 않는다. 완료는 체크 표시, 현재는 테두리를 함께 쓴다.
- 원본 에셋은 `C:\Users\Har27\Desktop\캐릭\`에 있다. 읽기만 하고 수정하지 않는다.
- 커밋 메시지는 한국어 본문에 conventional prefix를 쓴다. 끝에 `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` 한 줄.
- 스펙 원문: `docs/superpowers/specs/2026-08-11-buffett-learn-redesign-design.md`

---

## 파일 구조

| 파일 | 책임 | 상태 |
|---|---|---|
| `apps/web/app/globals.css` | 토큰과 모든 컴포넌트 스타일 | 수정 |
| `apps/web/content/characters.ts` | 어느 대가가 캐릭터를 가졌는지, GIF 이름 매핑 | 신규 |
| `apps/web/content/characters.test.ts` | 위 모듈의 순수 함수 테스트 | 신규 |
| `apps/web/components/MasterCharacter.tsx` | 캐릭터 이미지 한 장을 그리는 표현 전용 컴포넌트 | 신규 |
| `apps/web/app/learn/page.tsx` | 대가 선택 카드 그리드 | 수정 |
| `apps/web/components/MasterPath.tsx` | 지그재그 노드 경로 | 수정 |
| `apps/web/app/learn/masters/[slug]/page.tsx` | 유닛 배너 + 경로 + 캐릭터 배치 | 수정 |
| `apps/web/components/ChapterExercises.tsx` | 단계 상태에 따라 캐릭터 GIF 전환 | 수정 |
| `apps/web/public/characters/buffett/*` | 가공된 정적 에셋 | 신규 |

`characters.ts`를 `masters.ts`와 분리하는 이유: `masters.ts`는 여러 화면과 데이터 파이프라인이 참조하는 콘텐츠 정의다. 에셋 유무는 화면에만 필요한 사실이므로 타입을 건드리지 않고 옆에 둔다.

---

### Task 1: 에셋 가공

**Files:**
- Create: `apps/web/public/characters/buffett/stand.webp`
- Create: `apps/web/public/characters/buffett/guide.gif`
- Create: `apps/web/public/characters/buffett/great.gif`
- Create: `apps/web/public/characters/buffett/nope.gif`
- Create: `apps/web/public/characters/buffett/proud.gif`
- Create: `apps/web/public/characters/buffett/aha.gif`

**Interfaces:**
- Consumes: 없음
- Produces: 위 6개 경로. 이후 모든 태스크가 `/characters/buffett/<name>`으로 참조한다.

원본 `워랜 소메인.png`는 알파 채널이 있지만 값이 전부 255다 — 투명이 아니라 흰 배경이다. 흰색을 일괄 제거하면 셔츠 깃과 소매까지 뚫린다. 이미지 네 모서리에서 시작하는 flood fill로 **바깥쪽에 연결된 밝은 픽셀만** 지운다.

- [ ] **Step 1: 출력 폴더 만들기**

```bash
mkdir -p apps/web/public/characters/buffett
```

- [ ] **Step 2: 배경 제거 스크립트를 임시 폴더에 쓴다**

저장소에 남기지 않는다. 결과 파일만 커밋한다.

파일: `C:\Users\Har27\AppData\Local\Temp\claude\cutout.py`

```python
import sys
from collections import deque
from PIL import Image
import numpy as np

src, dst, height = sys.argv[1], sys.argv[2], int(sys.argv[3])

im = Image.open(src).convert("RGBA")
a = np.array(im)
rgb = a[:, :, :3].astype(np.int16)
h, w = rgb.shape[:2]

# 모서리 색을 배경색으로 삼는다. 네 모서리 평균이 아니라 좌상단 하나를
# 쓴다 — 평균은 캐릭터가 모서리에 걸친 경우 엉뚱한 값이 된다.
bg = rgb[0, 0]
tol = 28

close = (np.abs(rgb - bg).max(axis=2) <= tol)

# 가장자리에서 시작하는 flood fill. close한 픽셀만 타고 번진다.
seen = np.zeros((h, w), dtype=bool)
q = deque()
for x in range(w):
    for y in (0, h - 1):
        if close[y, x] and not seen[y, x]:
            seen[y, x] = True
            q.append((y, x))
for y in range(h):
    for x in (0, w - 1):
        if close[y, x] and not seen[y, x]:
            seen[y, x] = True
            q.append((y, x))

while q:
    y, x = q.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < h and 0 <= nx < w and close[ny, nx] and not seen[ny, nx]:
            seen[ny, nx] = True
            q.append((ny, nx))

a[:, :, 3] = np.where(seen, 0, 255)
out = Image.fromarray(a)

# 투명 여백을 잘라내고 높이를 맞춘다
box = out.getbbox()
out = out.crop(box)
ratio = height / out.height
out = out.resize((round(out.width * ratio), height), Image.LANCZOS)
out.save(dst, "WEBP", quality=90, method=6)
print(f"{box} -> {out.size}")
```

- [ ] **Step 3: 캐릭터 배경을 제거하고 webp로 저장**

```bash
python "C:/Users/Har27/AppData/Local/Temp/claude/cutout.py" "C:/Users/Har27/Desktop/캐릭/워랜 소메인.png" apps/web/public/characters/buffett/stand.webp 720
```

Expected: `(좌, 상, 우, 하) -> (너비, 720)` 형태로 출력. 너비는 대략 380~440 사이.

- [ ] **Step 4: 결과를 눈으로 확인한다**

```bash
python -c "from PIL import Image; im=Image.open('apps/web/public/characters/buffett/stand.webp'); print(im.size, im.mode); a=im.split()[3]; print('투명픽셀', sum(1 for p in a.getdata() if p==0), '/', im.width*im.height)"
```

Expected: `mode`가 `RGBA`, 투명 픽셀이 전체의 20~60% 사이.

투명 픽셀이 5% 미만이면 flood fill이 번지지 않은 것이다 — `tol`을 40으로 올려 Step 3을 다시 실행한다. 90%를 넘으면 캐릭터까지 지운 것이다 — `tol`을 18로 낮춘다.

- [ ] **Step 5: GIF 5개를 폭 320으로 줄인다**

```bash
cd apps/web
D="C:/Users/Har27/Desktop/캐릭"
O="public/characters/buffett"
ffmpeg -y -v error -i "$D/안내.gif"   -vf "fps=15,scale=320:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer" "$O/guide.gif"
ffmpeg -y -v error -i "$D/잘했음.gif" -vf "fps=15,scale=320:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer" "$O/great.gif"
ffmpeg -y -v error -i "$D/부정적.gif" -vf "fps=15,scale=320:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer" "$O/nope.gif"
ffmpeg -y -v error -i "$D/으쓱.gif"   -vf "fps=15,scale=320:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer" "$O/proud.gif"
ffmpeg -y -v error -i "$D/깨닭음.gif" -vf "fps=15,scale=320:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer" "$O/aha.gif"
```

- [ ] **Step 6: 총 용량을 확인한다**

```bash
du -sh apps/web/public/characters/buffett && ls -la apps/web/public/characters/buffett
```

Expected: 폴더 전체 2MB 이하. 넘으면 `fps=12`, `max_colors=96`으로 Step 5를 다시 실행한다.

- [ ] **Step 7: 커밋**

```bash
git add apps/web/public/characters/buffett
git commit -m "$(cat <<'EOF'
feat: 워런 버핏 캐릭터 에셋 추가

전신 정지 이미지 한 장과 반응 GIF 다섯 개를 넣었다. 원본 14MB를
2MB 아래로 줄였다.

전신 이미지는 흰 배경 위에 그려져 있어 흰색을 일괄 제거하면 셔츠
깃과 소매까지 뚫린다. 가장자리에서 시작하는 flood fill로 바깥쪽에
연결된 픽셀만 지워 옷 안쪽 흰색을 남겼다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 색·활자 토큰 교체

**Files:**
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/components/MyLearning.tsx`
- Modify: `apps/web/components/DuoQuiz.tsx`
- Modify: `apps/web/components/StockLenses.tsx`
- Modify: `apps/web/components/CriteriaBar.tsx`
- Modify: `apps/web/app/learn/chart/[slug]/page.tsx`
- Modify: `apps/web/app/stocks/[ticker]/page.tsx`
- Modify: `apps/web/components/ChapterExercises.tsx`

**Interfaces:**
- Consumes: 없음
- Produces: CSS 변수 `--gold` `--gold-deep` `--gold-soft` `--gold-line` `--wine` `--wine-deep` `--wine-soft` `--wine-line`. 이후 모든 태스크가 이 이름을 쓴다. `--plum*`과 `--serif`는 이 태스크 이후 존재하지 않는다.

이 태스크는 마크업을 바꾸지 않는다. 색과 폰트만 갈아끼운다. 그래야 다음 태스크에서 레이아웃이 깨졌을 때 원인이 색인지 구조인지 헷갈리지 않는다.

- [ ] **Step 1: `--plum`을 `--wine`으로 일괄 치환**

```bash
cd apps/web
grep -rl -- '--plum' app components content lib | while read f; do
  sed -i 's/--plum-deep/--wine-deep/g; s/--plum-soft/--wine-soft/g; s/--plum-line/--wine-line/g; s/--plum/--wine/g' "$f"
done
grep -rn -- '--plum' app components content lib || echo "남은 --plum 없음"
```

Expected: `남은 --plum 없음`

`--plum-deep`을 `--plum`보다 먼저 치환하는 순서가 중요하다. 반대로 하면 `--plum-deep`이 `--wine-deep`이 아니라 `--wine-deep`의 일부가 잘못 만들어진다.

- [ ] **Step 2: 토큰 블록을 새 값으로 바꾼다**

`apps/web/app/globals.css`의 맨 위 주석과 `:root` 블록을 통째로 아래로 교체한다.

```css
/* Wisor 디자인 토큰
 *
 * 듀오링고를 레퍼런스로 삼는다. 듀오링고가 초록(--color-owl #58CC02)을
 * 쓰는 자리를 골드가 받고, 버건디는 포인트에만 쓴다.
 *
 * 골드 #FFA000의 흰 글씨 대비는 2.05:1로 듀오링고 초록(2.06:1)과 사실상
 * 같다. 레퍼런스와 동일한 조건이므로 흰 글씨를 얹되, 같은 조건을 따라
 * 16px 이상 굵기 700 이상으로만 쓴다. 작은 설명 문구는 올리지 않는다.
 *
 * 회색 계열은 듀오링고 값을 그대로 가져왔다 (snow/polar/eel/wolf/swan).
 */

:root {
  --paper: #ffffff;
  --surface: #ffffff;
  --surface-sunk: #f7f7f7;
  --ink: #4b4b4b;
  --ink-soft: #777777;
  --ink-faint: #afafaf;
  --line: #e5e5e5;
  --line-strong: #cfcfcf;

  --gold: #ffa000;
  --gold-deep: #c67b00;
  --gold-soft: #fff4e0;
  --gold-line: #ffd08a;

  --wine: #c2183c;
  --wine-deep: #92102c;
  --wine-soft: #fce9ed;
  --wine-line: #efa9b7;

  --ochre: #8a5a17;
  --ochre-soft: #f5ecdd;
  --ochre-line: #dcc49a;

  --sans: "Pretendard Variable", Pretendard, -apple-system, system-ui, sans-serif;
  --mono: "Pretendard Variable", Pretendard, -apple-system, system-ui, sans-serif;

  --gutter: clamp(1.25rem, 5vw, 4rem);
  --radius: 12px;
}
```

`--serif`가 사라졌고 `--radius`가 3px에서 12px로 커졌다. 듀오링고는 모서리를 크게 굴린다.

- [ ] **Step 3: `var(--serif)` 호출부를 없앤다**

CSS에서는 선언 줄을 지운다(본문 폰트를 상속받는다). TSX 인라인 스타일에서는 그 속성만 지운다.

```bash
cd apps/web
grep -rn 'var(--serif)' app components content lib
```

`globals.css`에서 아래 선택자의 `font-family: var(--serif);` 줄을 삭제한다:
`.wordmark` `.thesis` `h2.section` `.lens-note` `.chapter-title` `.chapter-lede` `.comparison-matrix thead th`

TSX 3곳은 `fontFamily: "var(--serif)"` 속성만 지운다:
- `app/learn/chart/[slug]/page.tsx:77`
- `app/stocks/[ticker]/page.tsx:34`
- `components/ChapterExercises.tsx:199`

- [ ] **Step 4: 제목 굵기를 올린다**

`globals.css`에서 아래 세 선택자의 `font-weight: 400`을 `font-weight: 800`으로 바꾸고, `.thesis`의 `max-width`를 `26ch`에서 `20ch`으로 줄인다.

`.thesis` `h2.section` `.chapter-title`

`26ch`은 명조 "0" 폭(0.54em) 기준으로 계산된 값이라 산세리프에서는 너무 넓어진다.

- [ ] **Step 5: 버튼에 듀오링고식 입체감을 준다**

`globals.css`의 `.btn` 규칙을 아래로 교체한다.

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: var(--gold);
  color: #fff;
  border: 0;
  border-radius: var(--radius);
  padding: 0.75rem 1.25rem;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  box-shadow: 0 4px 0 var(--gold-deep);
}

.btn:hover {
  background: var(--gold-deep);
  box-shadow: 0 4px 0 var(--gold-deep);
}

/* 눌리는 촉감. 그림자가 줄고 그만큼 버튼이 내려앉아 전체 높이는 그대로다.
 * 움직임이 아니라 형태이므로 reduced-motion에서도 유지한다. */
.btn:active {
  transform: translateY(2px);
  box-shadow: 0 2px 0 var(--gold-deep);
}

.btn[data-variant="quiet"] {
  background: var(--surface);
  color: var(--wine);
  box-shadow: 0 4px 0 var(--line);
  border: 2px solid var(--line);
  padding: calc(0.75rem - 2px) calc(1.25rem - 2px);
}

.btn[data-variant="quiet"]:hover {
  background: var(--wine-soft);
  border-color: var(--wine-line);
  box-shadow: 0 4px 0 var(--wine-line);
}

.btn[data-variant="quiet"]:active {
  transform: translateY(2px);
  box-shadow: 0 2px 0 var(--wine-line);
}

.btn:disabled {
  background: var(--line);
  color: var(--ink-faint);
  box-shadow: 0 4px 0 var(--line-strong);
  cursor: not-allowed;
}

.btn:disabled:active {
  transform: none;
  box-shadow: 0 4px 0 var(--line-strong);
}
```

- [ ] **Step 6: 포커스 링을 버건디로 바꾼다**

`globals.css`의 `:focus-visible` 규칙에서 `outline: 2px solid var(--wine);`이 되도록 한다. Step 1의 치환으로 이미 `--wine`이 되어 있다면 확인만 한다.

- [ ] **Step 7: 테스트가 여전히 통과하는지 확인**

```bash
cd apps/web && npm test 2>&1 | tail -8
```

Expected: `pass 52`, `fail 0`

- [ ] **Step 8: 빌드가 통과하는지 확인**

```bash
cd apps/web && npm run build 2>&1 | tail -20
```

Expected: 에러 없이 완료. `--serif`나 `--plum`을 참조하는 곳이 남아 있으면 빌드는 통과하지만 화면에서 색이 빠진다 — Step 1과 Step 3의 grep이 비어 있었는지 다시 확인한다.

- [ ] **Step 9: 화면을 실제로 확인**

dev 서버는 `http://localhost:3000`에 이미 떠 있다. 없으면 `preview_start`로 띄운다.

`/learn`, `/learn/masters/buffett`, `/screener/buffett` 세 화면을 열고:
- `read_console_messages`로 에러가 없는지
- `javascript_tool`로 `getComputedStyle(document.querySelector('.btn')).backgroundColor`가 `rgb(255, 160, 0)`인지
- `getComputedStyle(document.body).backgroundColor`가 `rgb(255, 255, 255)`인지

- [ ] **Step 10: 커밋**

```bash
git add apps/web
git commit -m "$(cat <<'EOF'
feat: 팔레트를 듀오링고 기준 골드·버건디로 교체

듀오링고가 초록을 쓰는 자리를 골드 #FFA000이 받는다. 두 색의 흰 글씨
대비가 2.05:1과 2.06:1로 사실상 같아 같은 조건에서 글자를 얹을 수 있다.
버건디 #C2183C는 포인트에만 쓴다.

배경과 회색 계열도 듀오링고 값으로 바꿨다. 자두색 토큰은 이름까지
--wine으로 옮겨 화면 전체가 새 색을 함께 입는다.

명조 제목을 없애고 굵기로 대비를 만든다. .thesis의 max-width 26ch은
명조 "0" 폭 기준이라 산세리프에서 20ch으로 줄였다.

버튼에 0 4px 0 그림자를 넣고 눌릴 때 2px 내려앉게 했다. 움직임이
아니라 형태라서 reduced-motion에서도 유지한다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: 캐릭터 판정 모듈

**Files:**
- Create: `apps/web/content/characters.ts`
- Test: `apps/web/content/characters.test.ts`

**Interfaces:**
- Consumes: `Master` 타입 (`@/content/masters`)
- Produces:
  - `type CharacterMood = "guide" | "great" | "nope" | "proud" | "aha"`
  - `hasCharacter(id: string): boolean`
  - `characterStand(id: string): string | null` — `"/characters/buffett/stand.webp"` 또는 `null`
  - `characterMood(id: string, mood: CharacterMood): string | null` — `"/characters/buffett/great.gif"` 또는 `null`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

파일: `apps/web/content/characters.test.ts`

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { characterMood, characterStand, hasCharacter } from "./characters.ts";

test("버핏은 캐릭터를 가지고 있다", () => {
  assert.equal(hasCharacter("buffett"), true);
});

test("아직 캐릭터가 없는 대가는 false", () => {
  assert.equal(hasCharacter("graham"), false);
  assert.equal(hasCharacter("soros"), false);
});

test("모르는 id도 false — 예외를 던지지 않는다", () => {
  assert.equal(hasCharacter("nobody"), false);
});

test("전신 이미지 경로", () => {
  assert.equal(characterStand("buffett"), "/characters/buffett/stand.webp");
});

test("캐릭터가 없으면 전신 경로도 null", () => {
  assert.equal(characterStand("graham"), null);
});

test("기분별 GIF 경로", () => {
  assert.equal(characterMood("buffett", "great"), "/characters/buffett/great.gif");
  assert.equal(characterMood("buffett", "nope"), "/characters/buffett/nope.gif");
  assert.equal(characterMood("buffett", "guide"), "/characters/buffett/guide.gif");
  assert.equal(characterMood("buffett", "proud"), "/characters/buffett/proud.gif");
  assert.equal(characterMood("buffett", "aha"), "/characters/buffett/aha.gif");
});

test("캐릭터가 없으면 기분 경로도 null", () => {
  assert.equal(characterMood("lynch", "great"), null);
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
cd apps/web && npm test 2>&1 | tail -12
```

Expected: FAIL — `Cannot find module './characters.ts'`

- [ ] **Step 3: 최소 구현을 쓴다**

파일: `apps/web/content/characters.ts`

```ts
/** 대가별 캐릭터 에셋 유무와 경로.
 *
 *  masters.ts를 건드리지 않는 이유: 그 파일은 화면과 데이터 파이프라인이
 *  함께 참조하는 콘텐츠 정의다. 에셋이 그려졌는지는 화면에만 필요한
 *  사실이므로 타입을 늘리지 않고 옆에 둔다.
 *
 *  새 캐릭터를 그리면 public/characters/<id>/ 에 같은 파일 이름으로 넣고
 *  아래 배열에 id 한 줄을 더한다. */

export type CharacterMood = "guide" | "great" | "nope" | "proud" | "aha";

const READY = ["buffett"];

export function hasCharacter(id: string): boolean {
  return READY.includes(id);
}

export function characterStand(id: string): string | null {
  return hasCharacter(id) ? `/characters/${id}/stand.webp` : null;
}

export function characterMood(id: string, mood: CharacterMood): string | null {
  return hasCharacter(id) ? `/characters/${id}/${mood}.gif` : null;
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

```bash
cd apps/web && npm test 2>&1 | tail -8
```

Expected: `pass 60`, `fail 0` (기존 52 + 새 8)

- [ ] **Step 5: 커밋**

```bash
git add apps/web/content/characters.ts apps/web/content/characters.test.ts
git commit -m "$(cat <<'EOF'
feat: 대가별 캐릭터 에셋 경로 모듈 추가

캐릭터가 그려진 대가와 아닌 대가를 상수 배열 하나로 가른다. 새 캐릭터를
그리면 배열에 id 한 줄을 더하면 된다.

masters.ts에 필드를 늘리지 않았다. 그 파일은 데이터 파이프라인도 읽는
콘텐츠 정의라, 화면에만 필요한 사실을 섞지 않는다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: 캐릭터 표시 컴포넌트

**Files:**
- Create: `apps/web/components/MasterCharacter.tsx`
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Consumes: `characterStand`, `characterMood`, `CharacterMood` (Task 3)
- Produces: `<MasterCharacter masterId={string} mood?={CharacterMood} height?={number} dimmed?={boolean} />` — 캐릭터가 없으면 `null`을 반환한다(호출부에서 조건 분기를 안 해도 된다).

- [ ] **Step 1: 컴포넌트를 쓴다**

파일: `apps/web/components/MasterCharacter.tsx`

```tsx
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
```

`<picture>`의 `media`는 화면 폭뿐 아니라 모든 미디어 쿼리를 받는다. `prefers-reduced-motion: reduce`가 맞으면 브라우저가 `<source>`의 정지 이미지를 고르고, 아니면 `<img>`의 GIF로 떨어진다. JS 없이 동작한다.

- [ ] **Step 2: 스타일을 더한다**

`apps/web/app/globals.css` 맨 아래에 붙인다.

```css
/* ---------- 캐릭터 ---------- */

.character {
  display: block;
  flex: none;
  line-height: 0;
}

.character img {
  display: block;
  width: auto;
  max-width: 100%;
  object-fit: contain;
}

/* 아직 도달하지 않은 구간의 캐릭터. 듀오링고는 미완 구간을 통째로
 * 회색으로 둔다 — 색이 곧 진행 상태다. */
.character[data-dimmed="true"] img {
  filter: grayscale(1);
  opacity: 0.45;
}
```

- [ ] **Step 3: 임시 페이지로 렌더링을 확인한다**

`apps/web/app/learn/page.tsx` 맨 위 `<StockBasicsLauncher />` 바로 아래에 임시로 넣는다.

```tsx
<MasterCharacter masterId="buffett" height={200} />
<MasterCharacter masterId="buffett" mood="great" height={200} />
<MasterCharacter masterId="graham" height={200} />
```

import도 함께 추가한다: `import MasterCharacter from "@/components/MasterCharacter";`

`http://localhost:3000/learn`에서 확인할 것:
- 정지 이미지와 움직이는 GIF 두 장이 보이고, graham 자리에는 아무것도 없다
- `read_console_messages`에 404가 없다
- `javascript_tool`로 `document.querySelectorAll('.character').length`가 `2`

- [ ] **Step 4: 임시 코드를 되돌린다**

Step 3에서 넣은 세 줄과 import를 지운다. Task 5에서 제대로 배치한다.

```bash
cd apps/web && git diff --stat app/learn/page.tsx
```

Expected: 출력 없음 (되돌려졌다)

- [ ] **Step 5: 커밋**

```bash
git add apps/web/components/MasterCharacter.tsx apps/web/app/globals.css
git commit -m "$(cat <<'EOF'
feat: 캐릭터 표시 컴포넌트 추가

에셋이 없는 대가면 null을 반환해서, 호출부가 매번 조건을 쓰지 않아도
되게 했다.

움직임을 꺼 달라고 한 사용자에게는 정지 이미지를 준다. CSS로는 GIF를
멈출 수 없어 picture/source의 미디어 쿼리로 src 자체를 바꾼다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: 대가 선택 카드 그리드

**Files:**
- Modify: `apps/web/app/learn/page.tsx`
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Consumes: `hasCharacter` (Task 3), `MasterCharacter` (Task 4)
- Produces: `.master-grid` `.master-card` `.master-card-art` `.master-card-body` CSS 클래스

세로 카드 3열. 카드 상단은 골드 배경에 캐릭터가 아래로 걸쳐 서 있고, 아래에 스타일 뱃지·이름·한 줄 설명이 온다. 캐릭터가 없는 대가는 점선 테두리에 회색 상단과 "캐릭터 준비 중" 문구를 쓴다.

- [ ] **Step 1: 페이지를 새로 쓴다**

파일: `apps/web/app/learn/page.tsx` 전체를 교체한다.

```tsx
import Link from "next/link";
import MasterCharacter from "@/components/MasterCharacter";
import StockBasicsLauncher from "@/components/StockBasicsLauncher";
import { hasCharacter } from "@/content/characters";
import { MASTERS } from "@/content/masters";

export default function LearnIndex() {
  return (
    <div className="wrap" style={{ paddingBlock: "3.5rem 5rem" }}>
      <p className="eyebrow">배우기</p>
      <h1 className="thesis">누구의 눈으로 기업을 볼까요</h1>

      <StockBasicsLauncher />

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "2rem" }}>
        <Link href="/learn/compare" className="btn" data-variant="quiet">
          다섯 질문으로 일곱 투자 철학 비교하기
        </Link>
      </div>

      <ul className="master-grid">
        {MASTERS.map((m) => {
          const ready = hasCharacter(m.id);
          return (
            <li key={m.id}>
              <Link
                href={`/learn/masters/${m.id}`}
                className="master-card"
                data-ready={ready ? "true" : "false"}
              >
                <span className="master-card-art">
                  {ready ? (
                    <MasterCharacter masterId={m.id} height={150} />
                  ) : (
                    <img
                      className="investor-avatar"
                      src={`/investors/${m.id}.png`}
                      alt=""
                      width={64}
                      height={64}
                    />
                  )}
                </span>
                <span className="master-card-body">
                  <span className="style-name">{m.styleName}</span>
                  <strong className="master-card-name">{m.name}</strong>
                  <span className="master-card-line">
                    {ready ? m.oneLine : "캐릭터 준비 중 · 내용은 볼 수 있어요"}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: 스타일을 더한다**

`apps/web/app/globals.css` 맨 아래에 붙인다.

```css
/* ---------- 대가 선택 그리드 ---------- */

.master-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.master-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  border: 2px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: 0 4px 0 var(--line);
  transition: border-color 0.15s ease;
}

.master-card:hover {
  border-color: var(--gold-line);
  box-shadow: 0 4px 0 var(--gold-line);
}

.master-card:active {
  transform: translateY(2px);
  box-shadow: 0 2px 0 var(--gold-line);
}

/* 캐릭터가 아래 가장자리에 발을 딛고 선다 */
.master-card-art {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  height: 150px;
  background: var(--gold);
  overflow: hidden;
}

/* 아직 캐릭터가 없는 대가. 색을 빼고 테두리를 점선으로 둬서
 * '비어 있음'을 색과 모양 두 가지로 말한다. */
.master-card[data-ready="false"] {
  border-style: dashed;
}

.master-card[data-ready="false"] .master-card-art {
  align-items: center;
  background: var(--surface-sunk);
}

.master-card[data-ready="false"] .master-card-name,
.master-card[data-ready="false"] .master-card-line {
  color: var(--ink-soft);
}

.master-card-body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.4rem;
  padding: 0.9rem 1rem 1.1rem;
}

.master-card-name {
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: -0.01em;
  word-break: keep-all;
}

.master-card-line {
  color: var(--ink-soft);
  font-size: 0.85rem;
  line-height: 1.55;
  word-break: keep-all;
}
```

- [ ] **Step 3: `.style-name` 뱃지를 버건디로 맞춘다**

`globals.css`의 기존 `.style-name` 규칙에서 배경·테두리·글자색을 바꾼다.

```css
.style-name {
  background: var(--wine);
  border: 0;
  border-radius: 999px;
  color: #fff;
  font-family: var(--sans);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1;
  padding: 0.38rem 0.6rem;
  white-space: nowrap;
}
```

- [ ] **Step 4: 화면을 확인한다**

`http://localhost:3000/learn`에서:
- 카드 7장이 보이고 버핏 카드만 골드 상단에 캐릭터가 서 있다
- 나머지 6장은 점선 테두리에 회색 상단, "캐릭터 준비 중" 문구
- `read_console_messages`에 에러 없음
- `javascript_tool`로 `document.querySelectorAll('.master-card[data-ready="false"]').length`가 `6`
- `resize_window`로 `mobile`(375px) 전환 후 카드가 1열로 떨어지고 가로 스크롤이 없는지 — `document.documentElement.scrollWidth <= window.innerWidth`가 `true`

- [ ] **Step 5: 빌드와 테스트**

```bash
cd apps/web && npm test 2>&1 | tail -6 && npm run build 2>&1 | tail -12
```

Expected: `pass 60`, `fail 0`, 빌드 성공

- [ ] **Step 6: 커밋**

```bash
git add apps/web/app/learn/page.tsx apps/web/app/globals.css
git commit -m "$(cat <<'EOF'
feat: 대가 선택을 세로 카드 그리드로 바꾼다

카드 상단 골드 면에 캐릭터가 발을 딛고 선다. 아직 캐릭터가 없는 여섯
대가는 점선 테두리와 회색 상단으로 둬서, 비어 있다는 사실을 색과 모양
두 가지로 말한다. 글은 이미 다 있으므로 링크는 살려 뒀다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: 지그재그 노드 경로

**Files:**
- Modify: `apps/web/components/MasterPath.tsx`
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Consumes: `MasterCharacter` (Task 4), `CHAPTER_SLOTS` `CURRICULUM_BY_MASTER` (`@/content/curriculum`), `getProgress` (`@/lib/store`)
- Produces: `.path` `.path-node` `.path-bubble` `.path-figure` CSS 클래스

기존 세로 목록을 원형 노드로 바꾼다. 진도 계산 로직(`done`, `nextNo`, `cta`)은 그대로 두고 마크업과 스타일만 바꾼다.

- [ ] **Step 1: 컴포넌트를 새로 쓴다**

파일: `apps/web/components/MasterPath.tsx` 전체를 교체한다.

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import MasterCharacter from "@/components/MasterCharacter";
import { CHAPTER_SLOTS, CURRICULUM_BY_MASTER } from "@/content/curriculum";
import { MASTER_BY_ID, type Master } from "@/content/masters";
import { getProgress } from "@/lib/store";

/** 노드가 좌우로 흔들리는 폭(px). 듀오링고처럼 한 번 나갔다 돌아온다.
 *  장이 5개보다 많아지면 이 배열을 순환해서 쓴다. */
const SWAY = [0, 48, 72, 48, 0];

/** 대가 한 명의 5장 경로 + 그 위의 진행 인지 CTA. 잠금은 없다 — 모든
 *  노드가 항상 눌린다. '완료'는 저장된 진도에서 오고, '다음'은 진도가
 *  없는 첫 장이다.
 *
 *  scorable은 서버에서 styleMeta(masterId)로 계산해 내려받는다 —
 *  lib/scores.ts를 여기서 직접 import하면 클라이언트 번들에 재무
 *  데이터가 실린다. */
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

  // 캐릭터는 지금 서 있는 장 옆에 둔다. 다 끝냈으면 마지막 장 옆이다.
  const figureAt = nextNo ?? CHAPTER_SLOTS[CHAPTER_SLOTS.length - 1].no;

  return (
    <div className="path-shell">
      <ol className="path" aria-label={`${master.name} 학습 경로`}>
        {curriculum.chapters.map((chapter, index) => {
          const slot = CHAPTER_SLOTS[index];
          const isDone = ready && done.has(slot.no);
          const isCurrent = ready && slot.no === nextNo;
          return (
            <li
              key={slot.no}
              className="path-row"
              style={{ "--sway": `${SWAY[index % SWAY.length]}px` } as React.CSSProperties}
            >
              {isCurrent && (
                <span className="path-bubble" aria-hidden="true">
                  시작
                </span>
              )}
              <Link
                href={`/learn/masters/${masterId}/${slot.no}`}
                className="path-node"
                data-state={isDone ? "done" : isCurrent ? "current" : "todo"}
              >
                <span className="path-node-mark" aria-hidden="true">
                  {isDone ? "✓" : slot.no}
                </span>
                <span className="visually-hidden">
                  {slot.no}장 {chapter.title}
                  {isDone ? " · 완료" : isCurrent ? " · 지금 여기" : ""}
                </span>
              </Link>
              <span className="path-label" aria-hidden="true">
                <span className="path-label-slot">{slot.label}</span>
                <span className="path-label-title">{chapter.title}</span>
              </span>
              {slot.no === figureAt && (
                <span className="path-figure">
                  <MasterCharacter masterId={masterId} height={170} dimmed={!ready} />
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {cta && (
        <Link href={cta.href} className="btn path-cta">
          {cta.label}
        </Link>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 스타일을 더한다**

`apps/web/app/globals.css`의 기존 `.master-path*` 규칙 블록(`.master-path`부터 `.master-path-check`까지)을 아래로 교체한다.

```css
/* ---------- 학습 경로: 지그재그 노드 ---------- */

.path-shell {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.path {
  list-style: none;
  margin: 0 0 2rem;
  padding: 0;
  width: 100%;
  max-width: 460px;
}

/* 노드를 가운데 두고 --sway만큼 옆으로 민다. 라벨은 노드 오른쪽에
 * 붙고, 캐릭터는 행 바깥 오른쪽에 절대 위치로 선다. */
.path-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 1rem;
  min-height: 92px;
  padding-left: calc(50% - 34px + var(--sway, 0px));
}

.path-node {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 68px;
  height: 68px;
  border-radius: 50%;
  background: var(--line);
  box-shadow: 0 5px 0 var(--line-strong);
  color: #fff;
  font-size: 1.35rem;
  font-weight: 800;
}

.path-node:active {
  transform: translateY(3px);
  box-shadow: 0 2px 0 var(--line-strong);
}

.path-node[data-state="done"] {
  background: var(--gold);
  box-shadow: 0 5px 0 var(--gold-deep);
}

.path-node[data-state="done"]:active {
  box-shadow: 0 2px 0 var(--gold-deep);
}

/* 지금 여기. 색만이 아니라 테두리와 말풍선이 함께 붙는다 */
.path-node[data-state="current"] {
  background: var(--gold);
  border: 4px solid var(--wine);
  box-shadow: 0 5px 0 var(--gold-deep);
}

.path-node[data-state="current"]:active {
  box-shadow: 0 2px 0 var(--gold-deep);
}

.path-node[data-state="todo"] .path-node-mark {
  color: var(--ink-faint);
}

.path-bubble {
  position: absolute;
  top: 2px;
  left: calc(50% - 34px + var(--sway, 0px));
  transform: translateY(-50%);
  background: var(--surface);
  border: 2px solid var(--wine);
  border-radius: 999px;
  color: var(--wine);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  padding: 0.25rem 0.7rem;
  white-space: nowrap;
}

.path-label {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.path-label-slot {
  color: var(--ink-faint);
  font-size: 0.7rem;
  letter-spacing: 0.04em;
}

.path-label-title {
  color: var(--ink);
  font-size: 0.9rem;
  font-weight: 700;
  word-break: keep-all;
}

/* 캐릭터는 경로 바깥에 선다. 좁은 화면에서는 숨긴다 — 노드와 겹치느니
 * 없는 편이 낫다. */
.path-figure {
  position: absolute;
  right: -190px;
  bottom: 0;
  pointer-events: none;
}

.path-cta {
  width: min(100%, 460px);
}

@media (max-width: 1100px) {
  .path-figure {
    display: none;
  }
}

@media (max-width: 640px) {
  .path-row {
    min-height: 84px;
    padding-left: calc(50% - 34px + var(--sway, 0px) * 0.5);
  }

  .path-label-title {
    font-size: 0.82rem;
  }
}
```

- [ ] **Step 3: 화면을 확인한다**

`http://localhost:3000/learn/masters/buffett`에서:
- 노드 5개가 좌우로 흔들리며 세로로 쌓여 있다
- 진도가 없으면 1번 노드가 골드 + 버건디 테두리 + "시작" 말풍선, 나머지는 회색
- 캐릭터가 오른쪽에 서 있다
- `javascript_tool`로 `document.querySelectorAll('.path-node').length`가 `5`
- `document.querySelectorAll('.path-node[data-state="current"]').length`가 `1`
- `read_console_messages`에 에러 없음

`/learn/masters/graham`도 열어서 노드는 그대로 나오고 캐릭터만 없는지 확인한다.

- [ ] **Step 4: 진도가 있을 때를 확인한다**

브라우저 콘솔에서 진도를 심고 새로고침한다.

```js
javascript_tool: (() => {
  const k = Object.keys(localStorage).find(k => k.includes('wisor') || k.includes('progress'));
  return { keys: Object.keys(localStorage), found: k, value: k && localStorage.getItem(k) };
})()
```

`lib/store.ts`가 쓰는 키를 확인한 뒤, 1·2장을 완료로 넣고 새로고침해서:
- 1·2번 노드가 골드 + 체크 표시
- 3번 노드에 "시작" 말풍선
- CTA가 "3장부터 이어서 하기"

확인 후 심은 값을 지운다.

- [ ] **Step 5: 좁은 화면을 확인한다**

`resize_window`로 `mobile`(375px) 전환 후:
- `document.documentElement.scrollWidth <= window.innerWidth`가 `true` (가로 스크롤 없음)
- `getComputedStyle(document.querySelector('.path-figure')).display`가 `"none"`

- [ ] **Step 6: 빌드와 테스트**

```bash
cd apps/web && npm test 2>&1 | tail -6 && npm run build 2>&1 | tail -12
```

Expected: `pass 60`, `fail 0`, 빌드 성공

- [ ] **Step 7: 커밋**

```bash
git add apps/web/components/MasterPath.tsx apps/web/app/globals.css
git commit -m "$(cat <<'EOF'
feat: 학습 경로를 지그재그 노드로 바꾼다

세로 목록을 원형 노드 다섯 개로 바꿨다. 노드가 좌우로 한 번 나갔다
돌아오고, 지금 서 있는 장 옆에 캐릭터가 선다.

상태를 색만으로 구분하지 않는다 — 완료는 체크 표시, 지금 여기는
버건디 테두리와 말풍선이 함께 붙는다.

진도 계산은 건드리지 않았다. 마크업과 스타일만 바뀐다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: 유닛 배너

**Files:**
- Modify: `apps/web/app/learn/masters/[slug]/page.tsx`
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Consumes: `MasterPath` (Task 6)
- Produces: `.unit-banner` CSS 클래스

대가 개요 페이지 상단에 골드 배너를 얹는다. 좌측에 배우기 목록으로 가는 화살표, 가운데에 스타일과 대가 이름, 우측에 원칙 펼치기 버튼.

- [ ] **Step 1: 페이지 머리 부분을 바꾼다**

`apps/web/app/learn/masters/[slug]/page.tsx`에서 `<div className="master-main">` 안의 첫 `<div style={{ display: "flex", gap: "0.85rem", ... }}>` 블록(초상 + 스타일 + oneLine)을 아래로 교체한다.

```tsx
          <div className="unit-banner">
            <Link href="/learn" className="unit-banner-back" aria-label="배우기 목록으로">
              <span aria-hidden="true">←</span>
            </Link>
            <div className="unit-banner-text">
              <p className="unit-banner-style">{master.styleName}</p>
              <h1 className="unit-banner-name">{master.name}</h1>
            </div>
            <a href="#principles" className="unit-banner-guide">
              원칙 보기
            </a>
          </div>

          <p className="lede" style={{ textAlign: "center", margin: "1.25rem auto 2rem" }}>
            {master.oneLine}
          </p>
```

같은 파일에서 원칙 `<details>`에 앵커를 단다. `<details>` 여는 태그를 `<details id="principles">`로 바꾼다.

- [ ] **Step 2: 스타일을 더한다**

`apps/web/app/globals.css` 맨 아래에 붙인다.

```css
/* ---------- 유닛 배너 ---------- */

.unit-banner {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: var(--gold);
  border-radius: var(--radius);
  box-shadow: 0 4px 0 var(--gold-deep);
  color: #fff;
  padding: 0.9rem 1.1rem;
}

.unit-banner-back,
.unit-banner-guide {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  border: 2px solid rgba(255, 255, 255, 0.55);
  border-radius: var(--radius);
  color: #fff;
  font-size: 0.85rem;
  font-weight: 700;
}

.unit-banner-back {
  width: 40px;
  height: 40px;
  font-size: 1.1rem;
}

.unit-banner-guide {
  padding: 0.5rem 0.85rem;
  margin-left: auto;
  white-space: nowrap;
}

.unit-banner-back:hover,
.unit-banner-guide:hover {
  background: rgba(255, 255, 255, 0.16);
  border-color: #fff;
}

.unit-banner-text {
  min-width: 0;
}

/* 골드 위 작은 글씨는 대비가 모자란다. 스타일 이름은 흰색을 유지하되
 * 굵기를 올려 획을 두껍게 만든다 — 대비 대신 획 굵기로 읽힌다. */
.unit-banner-style {
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  margin: 0;
  opacity: 0.9;
}

.unit-banner-name {
  font-size: 1.35rem;
  font-weight: 800;
  letter-spacing: -0.01em;
  margin: 0.1rem 0 0;
  word-break: keep-all;
}

@media (max-width: 480px) {
  .unit-banner-guide {
    display: none;
  }
}
```

- [ ] **Step 3: 화면을 확인한다**

`http://localhost:3000/learn/masters/buffett`에서:
- 골드 배너가 맨 위에 있고 좌측 ← , 우측 "원칙 보기"
- "원칙 보기"를 눌러 `#principles`로 이동하는지
- `javascript_tool`로 `getComputedStyle(document.querySelector('.unit-banner')).backgroundColor`가 `rgb(255, 160, 0)`
- `read_console_messages`에 에러 없음

`/learn/masters/soros`(점수 없는 철학)도 열어 배너가 같게 나오는지 확인한다.

- [ ] **Step 4: 빌드와 테스트**

```bash
cd apps/web && npm test 2>&1 | tail -6 && npm run build 2>&1 | tail -12
```

Expected: `pass 60`, `fail 0`, 빌드 성공

- [ ] **Step 5: 커밋**

```bash
git add "apps/web/app/learn/masters/[slug]/page.tsx" apps/web/app/globals.css
git commit -m "$(cat <<'EOF'
feat: 대가 개요에 골드 유닛 배너를 얹는다

좌측 뒤로가기, 가운데 스타일과 이름, 우측 원칙 펼치기로 나눴다.
아래에 있던 원칙 목록에 앵커를 달아 배너에서 바로 간다.

골드 위 작은 글씨는 대비가 모자라므로, 스타일 이름은 굵기를 800으로
올려 대비 대신 획 굵기로 읽히게 했다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: 챕터 단계별 캐릭터 반응

**Files:**
- Create: `apps/web/content/chapterMood.ts`
- Test: `apps/web/content/chapterMood.test.ts`
- Modify: `apps/web/components/ChapterExercises.tsx`
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Consumes: `CharacterMood` (Task 3), `MasterCharacter` (Task 4), `Exercise` (`@/content/curriculum/types`), `isCorrect` (`@/content/curriculum/grading`), `Step` (`@/content/curriculum/steps`)
- Produces: `moodFor(input: MoodInput): CharacterMood`

기분 계산을 순수 함수로 떼어내 테스트한다. 컴포넌트에는 호출과 배치만 남긴다.

참고로 관련 타입은 이미 확인해 뒀다. `content/curriculum/steps.ts`의
`Step["kind"]`는 `"read" | "exercise" | "summary"`이고 `exercise`일 때만
`index: number`를 갖는다. `content/curriculum/types.ts`의 `Exercise["kind"]`는
`"graded" | "guided" | "journal"`이다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

파일: `apps/web/content/chapterMood.test.ts`

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { moodFor } from "./chapterMood.ts";

test("본문 읽는 중에는 안내한다", () => {
  assert.equal(moodFor({ stepKind: "read" }), "guide");
});

test("요약에서는 깨달은 얼굴", () => {
  assert.equal(moodFor({ stepKind: "summary" }), "aha");
});

test("문항을 아직 제출하지 않았으면 안내한다", () => {
  assert.equal(
    moodFor({ stepKind: "exercise", exerciseKind: "graded", submitted: false, correct: false }),
    "guide",
  );
});

test("채점 문항을 맞히면 칭찬한다", () => {
  assert.equal(
    moodFor({ stepKind: "exercise", exerciseKind: "graded", submitted: true, correct: true }),
    "great",
  );
});

test("채점 문항을 틀리면 아쉬워한다", () => {
  assert.equal(
    moodFor({ stepKind: "exercise", exerciseKind: "graded", submitted: true, correct: false }),
    "nope",
  );
});

test("써보기를 제출하면 으쓱한다 — 채점하지 않으므로 틀림이 없다", () => {
  assert.equal(
    moodFor({ stepKind: "exercise", exerciseKind: "guided", submitted: true, correct: false }),
    "proud",
  );
});

test("기록을 저장해도 으쓱한다", () => {
  assert.equal(
    moodFor({ stepKind: "exercise", exerciseKind: "journal", submitted: true, correct: false }),
    "proud",
  );
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
cd apps/web && npm test 2>&1 | tail -12
```

Expected: FAIL — `Cannot find module './chapterMood.ts'`

- [ ] **Step 3: 최소 구현을 쓴다**

파일: `apps/web/content/chapterMood.ts`

```ts
import type { CharacterMood } from "@/content/characters";
import type { Exercise } from "@/content/curriculum/types";

export type MoodInput = {
  stepKind: "read" | "exercise" | "summary";
  exerciseKind?: Exercise["kind"];
  submitted?: boolean;
  correct?: boolean;
};

/** 지금 화면 상태에서 캐릭터가 지을 표정.
 *
 *  채점하는 문항(graded)만 맞고 틀림이 있다. 써보기와 기록은 점수를
 *  매기지 않으므로 제출 자체를 성취로 본다 — 정답이 없는 문항에
 *  아쉬운 얼굴을 보이면 사용자가 틀렸다고 오해한다. */
export function moodFor(input: MoodInput): CharacterMood {
  if (input.stepKind === "summary") return "aha";
  if (input.stepKind === "read") return "guide";
  if (!input.submitted) return "guide";
  if (input.exerciseKind !== "graded") return "proud";
  return input.correct ? "great" : "nope";
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

```bash
cd apps/web && npm test 2>&1 | tail -8
```

Expected: `pass 67`, `fail 0` (60 + 새 7)

- [ ] **Step 5: 컴포넌트에 캐릭터를 붙인다**

`apps/web/components/ChapterExercises.tsx`를 세 군데 고친다.

**(a) import 추가** — 파일 위쪽 import 블록에 넣는다.

```tsx
import MasterCharacter from "@/components/MasterCharacter";
import { moodFor } from "@/content/chapterMood";
```

**(b) props에 `masterId` 추가** — 컴포넌트 시그니처의 타입에 넣고 구조 분해에도 넣는다.

```tsx
  /** 캐릭터를 띄울 대가. 없으면 캐릭터 없이 그린다 — compare 페이지처럼
   *  특정 대가에 속하지 않는 화면이 있다. */
  masterId?: string;
```

**(c) 기분 계산과 배치** — `const step = steps[at];` 아래에 계산을 넣는다.

```tsx
  const mood = moodFor({
    stepKind: step.kind,
    exerciseKind: currentExercise?.kind,
    submitted: currentSubmitted,
    correct:
      currentExercise?.kind === "graded" && exerciseIndex !== undefined
        ? isCorrect(
            (exercises[exerciseIndex] as Extract<Exercise, { kind: "graded" }>).answers,
            picks[exerciseIndex],
          )
        : false,
  });
```

`return` 안에서 `<div ref={contentRef} ...>`를 감싸는 래퍼를 만든다. 기존 `<div ref={contentRef}>`를 그대로 두고 그 바깥에 `<div className="chapter-stage">`를 두른 뒤, 형제로 캐릭터를 넣는다.

```tsx
      <div className="chapter-stage">
        <div
          ref={contentRef}
          tabIndex={-1}
          role="group"
          aria-label={`${stepLabel(step)} 단계, ${at + 1}/${steps.length}`}
        >
          {/* 기존 내용 그대로 */}
        </div>

        {masterId && (
          <div className="chapter-figure">
            <MasterCharacter masterId={masterId} mood={mood} height={190} />
          </div>
        )}
      </div>
```

**(d) 호출부에서 `masterId`를 넘긴다** — `apps/web/app/learn/masters/[slug]/[chapter]/page.tsx`의 `<ChapterExercises ... />`에 `masterId={master.id}`를 추가한다.

- [ ] **Step 6: 스타일을 더한다**

`apps/web/app/globals.css` 맨 아래에 붙인다.

```css
/* ---------- 챕터 무대: 본문 + 캐릭터 ---------- */

.chapter-stage {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 1.5rem;
  align-items: end;
}

/* 스크롤을 따라오되 본문 아래로는 안 내려간다 */
.chapter-figure {
  position: sticky;
  bottom: 1.5rem;
  flex: none;
}

@media (max-width: 860px) {
  .chapter-stage {
    grid-template-columns: minmax(0, 1fr);
  }

  /* 좁은 화면에서는 본문 위로 올리고 작게 줄인다 */
  .chapter-figure {
    position: static;
    order: -1;
    justify-self: center;
  }

  .chapter-figure img {
    height: 110px !important;
  }
}
```

- [ ] **Step 7: 화면을 확인한다**

`http://localhost:3000/learn/masters/buffett/1`에서:
- 오른쪽에 캐릭터가 있고 처음에는 `guide.gif`
- `computer`로 "계속"을 눌러 문항 단계로 간 뒤, 틀린 보기를 고르고 "답 확인하기"를 누르면 `nope.gif`로 바뀌는지 — `javascript_tool`로 `document.querySelector('.chapter-figure img').getAttribute('src')`
- 마지막 요약 단계에서 `aha.gif`
- `read_console_messages`에 404나 에러 없음

`/learn/masters/graham/1`도 열어서 캐릭터 없이 본문만 정상인지 확인한다.

- [ ] **Step 8: 움직임 끄기를 확인한다**

```js
javascript_tool: (() => {
  const img = document.querySelector('.chapter-figure img');
  const src = document.querySelector('.chapter-figure source');
  return { imgSrc: img && img.currentSrc, sourceMedia: src && src.media, sourceSet: src && src.srcset };
})()
```

`source`의 `media`가 `(prefers-reduced-motion: reduce)`이고 `srcset`이 `stand.webp`인지 확인한다.

- [ ] **Step 9: 빌드와 테스트**

```bash
cd apps/web && npm test 2>&1 | tail -6 && npm run build 2>&1 | tail -12
```

Expected: `pass 67`, `fail 0`, 빌드 성공

- [ ] **Step 10: 커밋**

```bash
git add apps/web/content/chapterMood.ts apps/web/content/chapterMood.test.ts apps/web/components/ChapterExercises.tsx "apps/web/app/learn/masters/[slug]/[chapter]/page.tsx" apps/web/app/globals.css
git commit -m "$(cat <<'EOF'
feat: 챕터 단계에 따라 캐릭터가 반응한다

읽기는 안내, 정답은 칭찬, 오답은 아쉬움, 요약은 깨달음이다.

써보기와 기록은 채점하지 않으므로 제출 자체를 성취로 본다. 정답이
없는 문항에 아쉬운 얼굴을 보이면 틀렸다고 오해하기 때문이다.

표정 계산을 순수 함수로 떼어 테스트했다. 컴포넌트에는 호출과 배치만
남는다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: 전체 화면 점검과 마무리

**Files:**
- Modify: `apps/web/app/globals.css` (발견된 문제만)

**Interfaces:**
- Consumes: Task 1~8 전부
- Produces: 없음

색 토큰을 전역으로 바꿨으므로 배우기 밖의 화면도 확인한다.

- [ ] **Step 1: 모든 주요 화면이 200을 주는지 확인**

```js
javascript_tool: (async () => {
  const paths = ['/', '/learn', '/learn/compare', '/learn/scoring', '/learn/masters/buffett',
    '/learn/masters/graham', '/learn/masters/soros', '/learn/masters/buffett/1',
    '/learn/masters/buffett/5', '/screener/buffett', '/screener/greenblatt',
    '/stocks/AAPL', '/practice', '/me'];
  const out = [];
  for (const p of paths) {
    const r = await fetch(p);
    out.push({ p, status: r.status });
  }
  return out;
})()
```

Expected: 전부 `200`. `/stocks/AAPL`은 데이터에 따라 404일 수 있다 — 그때는 `scores.json`에 있는 다른 티커로 바꿔 확인한다.

- [ ] **Step 2: 각 화면 콘솔 에러를 확인한다**

`/`, `/learn`, `/screener/buffett`, `/stocks/<티커>`, `/me`를 차례로 열고 매번 `read_console_messages`로 에러가 없는지 본다.

- [ ] **Step 3: 남은 옛 토큰이 없는지 확인**

```bash
cd apps/web && grep -rn -- '--plum\|--serif\|Gowun\|Nanum' app components content lib || echo "남은 것 없음"
```

Expected: `남은 것 없음`

- [ ] **Step 4: 좁은 화면에서 가로 스크롤이 없는지 확인**

`resize_window`로 `mobile`(375px) 전환 후 `/learn`, `/learn/masters/buffett`, `/learn/masters/buffett/1` 세 화면에서:

```js
javascript_tool: ({ scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth, ok: document.documentElement.scrollWidth <= window.innerWidth })
```

Expected: `ok`가 `true`. `false`면 어느 요소가 넘치는지 찾는다:

```js
javascript_tool: [...document.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > window.innerWidth).map(e => e.className || e.tagName).slice(0, 10)
```

- [ ] **Step 5: 키보드로 경로를 이동할 수 있는지 확인**

`/learn/masters/buffett`에서 Tab을 눌러가며 노드 5개에 포커스가 가고, 버건디 포커스 링이 보이는지 확인한다.

```js
javascript_tool: (() => { document.querySelector('.path-node').focus(); const s = getComputedStyle(document.activeElement); return { cls: document.activeElement.className, outline: s.outlineColor, width: s.outlineWidth }; })()
```

- [ ] **Step 6: 최종 테스트와 빌드**

```bash
cd apps/web && npm test 2>&1 | tail -8 && npm run build 2>&1 | tail -20
```

Expected: `pass 67`, `fail 0`, 빌드 성공

- [ ] **Step 7: 발견된 문제를 고치고 커밋**

Step 1~5에서 문제가 없었으면 이 단계는 건너뛴다. 있었으면 고친 뒤:

```bash
git add apps/web
git commit -m "$(cat <<'EOF'
fix: 리디자인 이후 남은 화면 문제를 고친다

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 8: 변경 전체를 훑는다**

```bash
git log --oneline ccf70f6..HEAD && git diff --stat ccf70f6..HEAD
```

스펙 커밋 2개 + 구현 커밋 8개 안팎이어야 한다. **push하지 않는다.**

---

## 자체 점검

**스펙 대응:**

| 스펙 절 | 태스크 |
|---|---|
| 1. 색 | Task 2 |
| 2. 활자 | Task 2 |
| 3. 에셋 | Task 1 |
| 4. `/learn` 대가 선택 | Task 5 (판정은 Task 3) |
| 5. 노드 패스 | Task 6, 배너는 Task 7 |
| 6. 챕터 캐릭터 동반 | Task 8 (컴포넌트는 Task 4) |
| 7. 만들지 않는 것 | 해당 태스크 없음 — 의도된 것 |
| 8. 검증 | 각 태스크 끝 + Task 9 |
| 9. 배포 | Global Constraints |

**타입 일관성:** `CharacterMood`는 Task 3에서 정의하고 Task 4·8에서 쓴다. 다섯 값(`guide` `great` `nope` `proud` `aha`)이 Task 1의 파일 이름, Task 3의 타입, Task 8의 테스트에서 모두 같다. `MasterCharacter`의 props(`masterId` `mood` `height` `dimmed`)는 Task 4에서 정의하고 Task 5·6·8에서 그대로 쓴다.

**남은 위험:** Task 8 Step 1에서 `chapterSteps()`의 반환 타입을 실제로 확인하게 해 뒀다. `steps.ts`를 직접 읽지 않고 `page.tsx`의 사용법에서 추론했기 때문이다.
