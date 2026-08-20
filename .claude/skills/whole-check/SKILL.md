---
name: whole-check
description: 저장소 전체가 지금 루트 CLAUDE.md의 "절대 하지 말 것"과 "클린 코드 5원칙"을 지킨 상태인지 한 번에 점검하고, docs/audit/ 에 보고서를 남긴다. 사용자가 "전체 점검", "whole check"라고 할 때 실행한다. push 직전 검수는 이게 아니라 clean-check 다.
---

# 전체 점검

`clean-check`가 **이번에 나갈 변경**을 보는 것과 달리, 이건 **지금 저장소 전체의 상태**를 본다.

| | clean-check | whole-check |
|---|---|---|
| 언제 | push 직전, 자동 | 사람이 부를 때만 |
| 대상 | `@{upstream}..HEAD` diff | 저장소 전체 |
| 결과 | 채팅에만 | `docs/audit/YYYY-MM-DD.md` 파일 |

diff만 보는 검수는 "지금 전체가 어떤 상태인가"를 영원히 볼 수 없다. 그 구멍을 메우는 것이 이 스킬의 전부다.

## 검사 범위

**여기 적힌 곳만 본다. 회차마다 볼 곳이 달라지면 ❌·⚠️ 개수가 실제 변화 없이 흔들려서, 맨 윗줄 숫자를 비교하는 의미가 사라진다.** 범위를 바꾸려면 이 목록을 먼저 고치고, 보고서에 "이번 회차부터 범위가 바뀌었다"고 적는다.

| | 경로 |
|---|---|
| **본다** | `apps/web/` · `data-pipeline/` · `persona_explain/` · `supabase/` |
| **안 본다** | `.claude/` · `docs/` · `.github/` · `apps/web/lib/generated/` |

안 보는 쪽의 이유는 하나다. **파일이 몇 개뿐이라 사람이 통째로 읽을 수 있고, 바뀔 때마다 전부 diff에 나타나 `clean-check`가 본다.** 이 스킬의 존재 이유는 "어느 diff에도 안 나타나는 것"이라 여기엔 해당하지 않는다. `lib/generated/`는 배치가 만드는 산출물이라 사람이 쓴 코드가 아니다.

## 절대 규칙

**공통 규칙은 루트 `CLAUDE.md`의 "검수 등급" 절에 있다** — 고치지 않는다, 항목을 전부 출력한다, 근거 없이 ❌를 달지 않는다. 여기에 옮겨 적지 않는다.

이 검수에만 해당하는 규칙은 아래다.

- **테스트를 돌리지 않는다.** 배치도 빌드도 돌리지 않는다. "통과하나"는 `check.yml`이 본다.
- **사실과 판단을 섞지 않는다.** 1부는 기계가 센 것(틀리지 않음), 2부는 AI 판정(틀릴 수 있음). 한 항목 안에서도 섞지 않는다.
- **항목 개수가 고정이다.** 1부 7개, 2부 5개. 늘리지도 줄이지도 않는다.
- **개수를 세 곳에 적는다** — 맨 윗줄 표에 두 줄, 그리고 1부·2부 제목 바로 아래에
그 부의 개수 한 줄씩. 보고서가 길어서 2부만 펼쳐 보는 사람이 그 부의 상태를
제목 옆에서 바로 알 수 있어야 한다.

**개수를 1부·2부로 나눠 세고, 두 줄을 더하지 않는다.** 합치면 "틀리지 않는 것"과
"틀릴 수 있는 것"이 한 숫자에 섞여서, 사실과 판단을 나눈 의미가 맨 윗줄에서 사라진다.

**맨 윗줄에 "변경분이 아니라 전체"라고 밝힌다.** 커밋 해시만 적으면 그 커밋 하나를
조사한 것처럼 읽힌다. 파일 개수는 `git ls-tree -r --name-only HEAD | wc -l`로 센다.

**형식을 바꾸지 않는다.** 회차끼리 비교하는 것이 이 보고서의 목적이라, 제목 순서와 맨 윗줄 개수가 고정이어야 한다.

## 순서

### 1. 기계 검사를 돌린다

저장소 루트에서 아래를 그대로 실행한다. 고치지 말 것 — 각 명령이 왜 이 모양인지 주석에 있다.

```bash
cd "$(git rev-parse --show-toplevel)"
web=apps/web

echo "== [1] 없는 값을 0으로 채우기 =="
# 재검사하지 않는다. pytest가 이미 보고, 실패하면 check.yml이 병합을 막는다.
grep -rho "def test_[a-z_]*unknown[a-z_]*" data-pipeline/tests/*.py | sed 's/def /  /'

echo "== [2] 주식 화면에 빨강·초록 =="
# greenblatt 는 대가 이름이라 뺀다. 결과가 나오면 색 값인지 사람 말인지 2부에서 판정한다.
grep -rniE "\b(red|green|crimson|lime)\b|#(f00|ff0000|0f0|00ff00)\b" \
  $web/app $web/components --include=*.tsx --include=*.css 2>/dev/null | grep -vi greenblatt

echo "== [3] scores.json 직접 수정 =="
# 배치를 돌리면 generatedAt 이 반드시 바뀐다. 안 바뀐 채 파일만 바뀌었으면 손으로 고친 것이다.
f=$web/lib/generated/scores.json; prev=""
for c in $(git log --reverse --format=%h -- "$f"); do
  g=$(git show "$c:$f" 2>/dev/null | head -3 | grep -o '"generatedAt": "[^"]*"')
  [ "$g" = "$prev" ] && [ -n "$g" ] && echo "  $c $(git log -1 --format=%s $c)"
  prev="$g"
done

echo "== [4] 컴포넌트에서 localStorage 직접 호출 =="
grep -rn "localStorage" $web/app $web/components 2>/dev/null

echo "== [5] 클라이언트에서 lib/scores.ts import =="
# 재검사하지 않는다. check.yml 이 빌드 결과물을 grep 하는 쪽이 더 확실하다
# (중간 모듈을 거친 간접 유출까지 잡힌다).

echo "== [6] 의존성 =="
node -e "const p=require('./$web/package.json');console.log('  dep:',Object.keys(p.dependencies).join(', '));console.log('  dev:',Object.keys(p.devDependencies).join(', '))"

echo "== [7] 금지 문구가 검사되지 않는 곳 =="
# base.py 는 점수 화면 생성 문구를, validate.ts 는 커리큘럼만 본다.
# 나머지는 아무도 안 보므로 위치만 뽑는다. 교육 콘텐츠는 금지어를 설명하려고
# 쓰기 때문에 grep 결과 자체는 판정이 아니다 — 2부에서 문장을 읽고 판정한다.
for w in 매수 매도 목표가 손절 추천 보장 확실 오를 내릴 급등 바닥; do
  n=$(grep -rho "$w" $web/components $web/content/masters.ts $web/content/stockBasics.ts 2>/dev/null | wc -l)
  [ "$n" -gt 0 ] && echo "  $w $n건"
done

echo "== [원칙1] 짝이 되는 테스트 파일이 없는 소스 =="
# 목록은 사실이다. "그래서 검증이 안 되는가"는 2부에서 판정한다
# (예: content/curriculum/*.ts 는 validate.test.ts 가 한꺼번에 본다).
for s in $(git ls-files "$web/lib/*.ts" "$web/content/*.ts" "$web/content/curriculum/*.ts" | grep -v '\.test\.ts$'); do
  [ -f "${s%.ts}.test.ts" ] || echo "  $s"
done
# persona_explain은 파일 옆에 test_<이름>.py를 두는 방식이라 짝 규칙이 다르다.
for s in $(git ls-files 'persona_explain/*.py' | grep -v '/test_'); do
  d=$(dirname "$s"); b=$(basename "$s" .py)
  [ -f "$d/test_$b.py" ] || echo "  $s"
done
echo "  --- 지금 있는 테스트 파일 (한 파일이 위 여러 개를 한꺼번에 볼 수도 있다) ---"
git ls-files "$web/lib/*.test.ts" "$web/content/*.test.ts" "$web/content/curriculum/*.test.ts" 'persona_explain/test_*.py' | sed 's|^|    |'

echo "== [원칙2] 큰 파일과 많이 쓰이는 모듈 =="
git ls-files "$web/**/*.ts" "$web/**/*.tsx" 'data-pipeline/**/*.py' 'persona_explain/*.py' | grep -vE '\.test\.|test_' | xargs wc -l 2>/dev/null | sort -rn | sed -n '2,9p'
for m in $(git ls-files "$web/lib/*.ts" | grep -v '\.test\.ts$'); do
  b=$(basename "$m" .ts)
  echo "  $(grep -rl "/$b\"\|/$b'" $web/app $web/components $web/lib 2>/dev/null | wc -l)곳이 import  lib/$b"
done | sort -rn | head -6

echo "== [원칙5] 화면 목록 vs 설계 문서 목록 =="
git ls-files "$web/app/**/page.tsx" | sed "s|$web/app/||;s|/page.tsx||;s|^|  화면 |"
git ls-files 'docs/superpowers/specs/*.md' | sed 's|.*/[0-9-]*||;s|-design.md||;s|^|  문서 |'
```

### 2. 기준을 읽는다

루트 `CLAUDE.md`의 "절대 하지 말 것"과 "클린 코드 5원칙". 그리고 `apps/web/CLAUDE.md`, `data-pipeline/CLAUDE.md`.

### 3. 판정한다

**1부는 판정하지 않는다.** 위 출력을 그대로 옮긴다. 숫자가 0이면 ✅, 아니면 걸린 것을 적고 2부로 넘긴다. 1부는 기계가 센 숫자가 곧 근거라 "해당 없음"이 나올 일이 없다.

**2부만 판정한다.** 등급은 루트 `CLAUDE.md`의 "검수 등급" 절을 따른다 — 2단계에서 이미 읽은 그 파일이고, `clean-check`도 같은 절을 본다.

**질문 2와 5는 시제를 바꿔서 묻는다.** 나머지 셋은 `CLAUDE.md`의 문장 그대로다.

| | diff에서 (clean-check) | 전체에서 (여기) |
|---|---|---|
| 2 | 한 번에 한 가지만 **고쳤는가?** | 지금 한 가지만 **고칠 수 있는 구조인가?** |
| 5 | 왜 그렇게 했는지가 **남았는가?** | 왜 그런지가 **어디엔가 있는가?** |

갈라진 게 아니라 같은 질문의 시제 차이다. 완성된 코드를 놓고 "이번에 고쳤나"를 물을 수는 없다.

**큰 파일은 반드시 열어본다.** 파일명과 줄 수만 보고 "한 가지만 한다"고 적으면 안 된다.
`MyLearning.tsx`를 "내 학습 화면"이라고 적는 것은 **위치**이지 하는 일이 아니다. 열어서
안에 몇 개의 섹션·몇 개의 데이터 출처가 들어 있는지 세고 나서 판정한다.

**원칙 2를 줄 수로 판정하지 않는다.** `content/masters.ts` 472줄은 대가 목록 한 가지만 하는 데이터 파일이라 정상이다. 기준은 **"이 파일이 하는 일을 한 문장으로 말할 수 있나"** 하나다. 줄 수와 import 개수는 어디를 들여다볼지 고르는 힌트일 뿐이다.

### 4. 보고서를 쓴다

`docs/audit/YYYY-MM-DD.md`에 쓴다. **제목 순서와 맨 윗줄을 바꾸지 않는다.**

```markdown
# 전체 점검 2026-08-20

bdbbfc1 (develop) 시점의 저장소 전체 · 파일 186개

| | 항목 | ❌ | ⚠️ | ✅ | — |
|---|---|---|---|---|---|
| **1부** 절대 하지 말 것 (사실) | 7 | 0 | 1 | 6 | 0 |
| **2부** 클린 코드 5원칙 (판정) | 5 | 1 | 2 | 1 | 1 |

이 커밋의 변경분이 아니라, 이 시점에 저장소에 있던 파일 전부를 봤습니다.

## 1부 — 절대 하지 말 것 (기계가 센 것, 틀리지 않음)

❌ 0 · ⚠️ 1 · ✅ 6

| # | 항목 | 결과 |
|---|---|---|
| 1 | 없는 값을 0으로 | ✅ pytest 4개가 봄 (여기서 재검사 안 함) |
| 2 | 빨강·초록 | ✅ 0건 |
| 3 | scores.json 직접 수정 | ✅ generatedAt 없이 바뀐 커밋 0개 |
| 4 | localStorage 직접 호출 | ✅ 0건 |
| 5 | 클라 lib/scores.ts import | ✅ check.yml이 봄 (여기서 재검사 안 함) |
| 6 | 의존성 | ✅ next·react·react-dom 3개 유지 |
| 7 | 금지 문구 | ⚠️ 검사 밖 영역에 31건 — 2부 참조 |

## 2부 — 클린 코드 5원칙 (AI 판정, 틀릴 수 있음)

❌ 1 · ⚠️ 2 · ✅ 2

**1. 기능에 맞는 테스트가 있는가?** ⚠️
lib/analytics.ts, lib/personaApi.ts 에 짝이 되는 테스트가 없습니다.
→ 이 파일들이 맞게 도는지 지금은 확인할 방법이 없습니다.

**2. 한 번에 한 가지만 고쳤는가?** ✅
가장 큰 파일이 472줄이고 전부 하는 일을 한 문장으로 말할 수 있습니다.

**3. 같은 일을 하는 코드가 한 곳에만 있는가?** ❌
(근거를 CLAUDE.md에서 인용)

**4. 처음 보는 방식이 들어갔는가?** — 해당 없음
이번 회차에 새로 들어온 방식이 없습니다.
(✅를 달려면 무엇과 비교했는지 적습니다 — "네 스타일 모듈이 전부 base.py의
 Criterion 구조를 그대로 씁니다"처럼 셀 수 있는 사실이어야 합니다.)

**5. 왜 그렇게 했는지가 코드 밖에 남았는가?** ⚠️
스크리너·종목 상세 화면은 왜 지금 모양인지 docs 어디에도 없습니다.
→ 다음에 AI에게 이 화면을 고치라고 할 때 넣어줄 맥락이 없습니다.

## 지난 회차와 달라진 것

(첫 회차면 "첫 회차입니다"라고 적는다. 아니면 직전 파일을 읽고 개수 변화만 적는다.)
```

각 지적은 **왜 문제인지 한 줄** — "무엇이 잘못됐다"가 아니라 **"그래서 나중에 뭐가 터진다"**로 쓴다. 코드를 못 읽는 사람이 읽는다.

### 5. 사람에게 넘긴다

보고서 경로를 알려주고, 1부·2부 요약을 채팅에도 한 번 출력한다. 그다음 묻는다 — **어느 항목을 고칠지, 커밋할지.** 스스로 고치지 않고 커밋하지 않는다.
