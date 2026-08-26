# 삭제 내용 검토 보고서

- 작성일: 2026-08-26
- 대상 브랜치: `chore/remove-obsolete-features`
- 대상 커밋: `7bef53f255468f9505bcc17b31e83ce54d564e9d`
- 비교 기준: `5b2f4f0ad4ecd30f438f0b28b3f16572f0cc6c51`
- 범위: 추적 파일 삭제·수정, 로컬 ignored 파일 정리, 삭제된 stash·tag, 관련 운영 경로

## 결론

**조건부 승인입니다.** 사용 중인 웹·Python 기능이 삭제됐다는 증거는 없고, 유지 대상의 고유
작업이 유실된 흔적도 찾지 못했습니다. 다만 이 브랜치를 `develop`·`main`에 병합하기 전 아래
두 항목은 확인해야 합니다.

1. **높음 — 운영 데이터 배치:** GitHub 예약 실행을 없앤 판단은 타당하지만, 이를 대신한다고
   적은 OCI 배치가 현재 저장소에서 재현되지 않으며 서버에서 계속 성공하는지도 확인되지
   않았습니다. 현재 `scores.yml` 수동 실행도 운영 복구 수단이 아닙니다.
2. **중간 — 챕터 레이아웃:** 미사용 CSS 삭제와 함께 데스크톱 챕터 본문의 실제 최대 폭이
   약 720px에서 약 592px로 줄었습니다. 동작 검사는 통과했지만 시각 검증이 필요합니다.

삭제 코드 자체에는 높은 위험도의 회귀가 없었습니다. 병합 보류 사유는 삭제된 기능이 아니라,
예약 실행 삭제가 의존하는 운영 대체 경로의 불확실성입니다.

## 판정 요약

| 범주 | 판정 | 요약 |
|---|---|---|
| `DuoQuiz`, `Quiz` | ✅ 안전 | 삭제 전에도 import가 없었고 현재 흐름은 `ChapterExercises`가 담당합니다. |
| 장별 mood API·반응 이미지 | ✅ 안전 | 정의·자체 테스트 외 소비자가 없고, 사용 중인 `guide`·`stand` 자산은 남았습니다. |
| TypeScript 편의 함수·이벤트 타입 | ✅ 안전 | 삭제 전 호출처가 없었고 엄격한 미사용 검사를 통과했습니다. |
| CSS 미사용 selector | ✅ 대체로 안전 | 정확한 현재 markup 참조가 없거나 `master-tabs.css`에 같은 역할의 규칙이 있습니다. |
| 챕터 중앙 정렬 변경 | ⚠️ 확인 필요 | 외곽 `.wrap`의 padding까지 720px 안에 들어가 데스크톱 본문이 더 좁아졌습니다. |
| Python stub·wrapper | ✅ 안전 | 저장소 내부 호출처가 없습니다. |
| `scores.yml` 예약 제거 | ❌ 병합 전 확인 | 기존 예약 실행은 실패 중이지만 OCI 대체 경로도 현재 저장소만으로 검증되지 않습니다. |
| Persona 계약 수정 | ⚠️ 검사 보완 | 실제 오류는 고쳤지만 OCI Dockerfile은 여전히 해당 테스트를 제외합니다. |
| Supabase 기준 스키마 | ✅ 소스 안전 / ⚠️ 원격 잔존 | 현재 호출처는 없지만 원격 객체는 삭제되지 않았습니다. |
| ignored 로컬 디렉터리 | ✅ 정리 타당 / ⚠️ 일부 복구 불가 | 캐시는 재생성 가능하지만 Git 밖 설정·로그는 내용 보존을 증명할 수 없습니다. |
| stash·archive tag | ✅ 고유 작업 유실 없음 / ⚠️ 임시 복구 | 객체는 현재 읽히지만 Git GC 이후에는 보장되지 않습니다. |

## 1. 웹 삭제 검토

### 퀴즈 컴포넌트

- 삭제된 `apps/web/components/DuoQuiz.tsx`와 `Quiz.tsx`는 비교 기준 커밋에서도 import가
  0건이었습니다.
- 현재 학습 흐름은 `ChapterExercises`가 읽기·가이드·퀴즈·기록·요약 단계를 처리합니다.
  `markLessonDone`, `recordQuiz`, `saveJournalEntry`, `master_lesson_completed` 기록도 이 경로에
  남아 있습니다.
- 두 컴포넌트가 쓰던 `QuizItem` 타입 역시 해당 컴포넌트 외 소비자가 없었습니다.

삭제 전 `DuoQuiz`에는 잠재 저장 오류도 있었습니다. 마지막 답을 `history`에 이미 넣은 뒤
`correctCount + 현재 정답`으로 다시 합산해, 마지막 문제를 맞히면 3문항 결과가 `4/3`으로
저장될 수 있었습니다. 호출되지 않는 코드였으므로 이번 삭제는 회귀가 아니라 잠재 결함 제거입니다.

### mood 로직과 이미지

- `chapterMood.ts`는 자체 테스트 외 호출처가 없었습니다.
- 버핏의 장별 반응 이미지를 소비하던 화면은 앞선 변경에서 이미 제거됐습니다.
- 삭제한 `aha.webp`, `great.webp`, `main.png`, `nope.webp`, `proud.webp`, `mascot/idle.webp`의
  현재 소스·빌드 문자열 참조는 0건입니다.
- 현재 사용 중인 `guide.webp`, 각 대가의 `stand.webp`, 게임의 `correct`·`wrong`·`celebrate`·
  `teach` 자산은 보존됐습니다.
- 삭제된 바이너리 합계는 1,688,695 bytes, 약 1.61 MiB입니다.

### TypeScript API와 CSS

`isChapterUnlocked`, `companyNames`, `isSupabaseConfigured`, 삭제한 analytics 이벤트 등은 정의와
자체 테스트 외 호출처가 없었습니다. 삭제한 CSS selector도 정확한 class token으로 재검색했습니다.
현재 markup이 쓰는 업적 관련 selector 세 종류는 `apps/web/app/master-tabs.css`에 대체 규칙이 있고
해당 페이지가 그 파일을 직접 import합니다.

다만 챕터 CSS는 단순한 dead-code 삭제가 아닙니다.

- 이전: `.chapter-page` 외곽 최대 1080px, 내부 콘텐츠 최대 720px
- 현재: `.wrap.chapter-page` 외곽 자체가 최대 720px
- `.wrap`에는 최대 좌우 64px padding이 있고 전역 `box-sizing: border-box`가 적용됨
- 결과: 넓은 화면의 실제 콘텐츠 폭 상한은 약 `720 - 128 = 592px`

의도가 “외곽을 포함한 720px 칼럼”이면 정상입니다. “본문 720px 유지”가 의도였다면 과도하게
좁아진 것입니다. 900px·1080px·1440px와 390px·640px에서 챕터 페이지를 직접 확인해야 합니다.

## 2. 백엔드·워크플로·스키마 검토

### Python dead code

`median`, `VendorProvider`, Persona 편의 wrapper 네 개와 미사용 `json` import는 삭제 전에도
저장소 내부 호출처가 없었습니다. 현재 계약을 깨는 내부 소비자는 찾지 못했습니다.

함께 수정된 `magicFormulaRoc` → `magic_formula_roc` 변환은 웹·파이프라인 계약과 일치하며,
Persona 전체 테스트가 95건 통과하도록 기존 실패를 고쳤습니다.

### 높은 위험: 운영 데이터 갱신 경로

GitHub 예약 실행 제거 자체는 합리적입니다. 확인한 최근 예약 실행 20건이 모두 실패했고,
최신 실행은 토스 인증 `HTTP 403`으로 종료됐습니다. 근거는
[최신 scores 예약 실행](https://github.com/Tokenaires-hancom/tokenaires_wisor/actions/runs/32938269980)입니다.

그러나 남긴 `workflow_dispatch`는 다음 이유로 “운영 복구”가 아닙니다.

1. 같은 GitHub Secrets와 같은 인증 코드를 사용하므로 자격증명 문제가 해결되기 전에는 같은
   403이 날 가능성이 높습니다.
2. 성공해도 선택한 브랜치에 `scores.json`·`fundamentals.json`을 커밋할 뿐입니다.
3. `deploy-oci.yml`은 이 두 산출물만 바뀐 push를 의도적으로 무시하므로 OCI 운영 데이터는
   갱신되지 않습니다.

OCI 배치도 저장소 기준으로는 재현되지 않습니다.

- 현재 `deploy/oci/`에는 `wisor-batch.timer`, `wisor-batch@.service`, `wisor-batch.sh`,
  `verify_runtime.py`가 없습니다.
- 이 파일들과 `wisor_data/scores_contract.py`는 보존한 로컬 브랜치
  `feat/windows-batch-scheduler`의 `62f7559`에만 있습니다.
- 현재 `wisor-deploy`는 앱 배포 때 `/opt/wisor/batch-source`를 새 커밋으로 교체합니다.
- 보존 브랜치의 batch wrapper는 `wisor_data.scores_contract`를 요구하지만 현재 커밋에는 그
  모듈이 없습니다. 배포 전 호환성 검사는 CLI option만 확인해 이 차이를 잡지 못합니다.

`main`의 자동 배포는 2026-08-26 14:10 KST에 성공했습니다
([배포 실행](https://github.com/Tokenaires-hancom/tokenaires_wisor/actions/runs/32932136220)).
16:18 KST [공개 Persona 메타데이터](https://wisor.site/api/persona/meta)는 07:05 KST 생성본
379종목으로 정상 응답했지만, 이는 새 배포 후 timer가 성공했다는 증거가 아닙니다. 직접
SSH/journal 접근이 없어 실제 unit 상태는 확정하지 못했습니다.

병합 전에 서버에서 다음을 확인해야 합니다.

```bash
sudo systemctl is-enabled wisor-batch.timer
sudo systemctl is-active wisor-batch.timer
systemctl list-timers wisor-batch.timer
sudo journalctl -u 'wisor-batch@*.service' --since '2026-08-26 13:50' --no-pager
```

그 뒤 unit·wrapper·계약 validator를 현재 저장소에 편입하거나, 외부 운영 기반이라면 그 정확한
버전과 호환성 검사를 저장소에 명시해야 합니다. `scores.yml`은 “저장소 산출물 수동 갱신”으로
이름을 바로잡거나 OCI 게시 단계까지 연결해야 합니다.

### Persona 배포 검사

`deploy/oci/app/Dockerfile.persona`는 이미 해결된 계약 테스트를 아직 `--deselect`하고 주석도
“기존 불일치”라고 적습니다. `.github/workflows/check.yml` 역시 Persona 테스트를 실행하지 않습니다.
현재 코드는 통과하지만 같은 계약 오류가 재발해도 PR·배포 전에 잡히지 않는 상태이므로, 제외와
오래된 주석을 제거하고 전체 Persona 테스트를 필수 검사에 넣는 것이 좋습니다.

### Supabase

기준 `supabase/schema.sql`에서 아래 객체를 제거한 것은 현재 애플리케이션 기준으로 안전합니다.
호출처가 없고 새 환경에 폐기 기능을 만들지 않게 합니다.

- `study_notes.chart_observations`
- `chart_analysis_events` 및 인덱스
- `chart_analysis_count_today`
- 관련 RLS 정책

원격 Supabase에는 `DROP`을 실행하지 않았고 파괴적 migration도 만들지 않았으므로 기존 객체와
데이터는 그대로 남습니다. 원격 정리는 백업·보존 결정을 받은 뒤 별도 승인 작업으로 해야 합니다.

### 문서 불일치

- `docs/oci-autodeploy.md`는 아직 예약 데이터 작업이 `main`에 직접 push한다고 적습니다.
- 같은 문서는 “tracked unit”을 언급하지만 현재 브랜치에는 batch unit이 없습니다.
- `docs/deploy.md`의 “수동 복구” 표현은 실제 운영 반영 경로와 다릅니다.
- `scores.yml` concurrency 주석에는 삭제된 “3시간짜리” GitHub 실행이 남아 있습니다.
- `docs/system-design.md`는 존재하지 않는 `scripts/pr_checks/`를 가리킵니다.
- 여러 현재 문서의 380종목 표기는 실제 379종목과 다릅니다.

## 3. 로컬 정리 포렌식

### ignored 디렉터리

삭제된 로컬 데이터는 약 506.4 MiB였습니다.

- `apps/web/.next-stale-*`, `.pyc`, 가상환경: 생성물이므로 재생성 가능
- `services/chart-api`의 추적됐던 소스: `e9055e5`의 Git 이력에서 복구 가능
- `services/chart-api/.env`, 로그: Git 밖 파일이어서 byte 단위 복구 불가
- `.netlify/state.json`: Git 복구 불가지만 계정에서 다시 link 가능
- `.superpowers/sdd/...`: Git 밖 작업 메모의 정확한 내용은 복구 보장 불가

디렉터리를 지웠다고 외부 자격증명·Netlify 사이트가 폐기되지는 않습니다. 예전 chart API `.env`의
자격증명이 아직 유효하다면 공급자에서 revoke/rotate해야 하고, 원격 Netlify 서비스의 보존 여부도
별도로 확인해야 합니다.

### dropped stash와 tag

유지 대상 고유 작업 유실은 발견되지 않았습니다. 두 stash의 차이는 삭제한 시장심리 기능 또는
이후 구현으로 대체된 부분이었고, 고유 작업 브랜치 여섯 개는 모두 정상 보존됐습니다.

다만 삭제한 ref의 객체는 dangling 상태입니다. 현재는 읽히지만 Git GC 이후 복구를 보장할 수
없습니다.

| 종류 | 객체 | 현재 상태 |
|---|---|---|
| stash | `368672b9c07397de8c501587170ca373d1546251` | 현재 복구 가능, GC 이후 미보장 |
| stash | `29351e99a04d7807ce208b5fccbf91710191a132` | 현재 복구 가능, GC 이후 미보장 |
| archive tag 대상 | `5937ffeb54e70a8f00c767d9a5158d3b7c7f0dc1` | 최종 OCI 구현으로 대체, 정확한 초기본은 GC 이후 미보장 |

정확한 옛 구현을 안전 기간 동안 더 보존해야 한다면 GC 전에 아래처럼 ref를 되살릴 수 있습니다.
이번 검토에서는 실행하지 않았습니다.

```bash
git stash store -m "recovered market-sentiment stash" 368672b9c07397de8c501587170ca373d1546251
git stash store -m "recovered pre-rebase stash" 29351e99a04d7807ce208b5fccbf91710191a132
git tag archive/oci-main-autodeploy-2026-08-26 5937ffeb54e70a8f00c767d9a5158d3b7c7f0dc1
```

추적 파일 삭제는 커밋 이력에 있으므로 `git revert 7bef53f` 또는 비교 기준 커밋에서 개별 파일을
꺼내는 방식으로 복구할 수 있습니다. ignored 설정·로그는 백업이나 파일 복구 도구가 없다면 Git으로
되살릴 수 없습니다.

## 4. 검증 근거와 한계

수행·확인한 검증은 다음과 같습니다.

- 비교 기준과 현재 커밋 양쪽에서 삭제 심볼·파일명·CSS token 참조 검색
- data-pipeline 132 passed
- Persona 95 passed
- Web 129 passed
- `tsc --noEmit` 및 미사용 local·parameter 엄격 검사 통과
- Next 빌드 성공, 정적 페이지 439/439 생성
- 재무 데이터 브라우저 번들 경계 검사 통과
- OCI 셸 계약 테스트와 Python 테스트 6건 통과
- 주요 URL `/`, `/learn`, 버핏 대가·1장, `/learn/compare`, `/play` HTTP 200
- Git ref 연결성 검사 통과; 유지한 로컬 브랜치 6개의 고유 commit 확인

한계도 있습니다.

- `.ua/knowledge-graph.json`이 없어 지식 그래프 기반 영향도 overlay는 만들지 못했고 Git·검색·
  타입 검사로 대체했습니다.
- 연결 가능한 인앱 브라우저가 없어 챕터 폭 변경을 이미지로 검증하지 못했습니다.
- OCI에 직접 SSH할 수 없어 timer 활성 상태와 최근 journal을 확인하지 못했습니다.
- 이미 삭제된 ignored 파일의 정확한 내용은 사후에 무유실을 증명할 수 없습니다.

## 권고 순서

1. OCI timer·최근 journal·batch wrapper 버전을 확인하고 `scores_contract` 호환성을 복구합니다.
2. `scores.yml`을 운영 복구가 아닌 저장소 산출물 갱신으로 정정하거나 실제 OCI 게시까지 연결합니다.
3. 챕터 화면을 390·640·900·1080·1440px에서 확인해 목표 본문 폭을 확정합니다.
4. Persona 계약 테스트 제외를 없애고 PR 필수 검사에 Persona 전체 테스트를 추가합니다.
5. Supabase 원격 객체, Netlify 사이트, 옛 chart API 자격증명의 보존·폐기 여부를 별도로 결정합니다.
6. 옛 stash·OCI 초기 스냅샷을 더 보존할 필요가 있으면 Git GC 전에 임시 ref를 복구합니다.

위 1번이 확인되기 전에는 `chore/remove-obsolete-features`를 `develop` 또는 `main`에 병합하지 않는
것을 권합니다.
